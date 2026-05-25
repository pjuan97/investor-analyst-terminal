import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAlphaVantageProvider } from '@/lib/providers/alphavantage';
import { getYahooFinanceProvider } from '@/lib/providers/prices/yahoo';

// Helper to serialize Prisma objects
function serialize<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

// GET — Fetch ETF data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
      include: {
        etfDetails: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 2520,
        },
        recommendations: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        watchlists: {
          where: { userId: session.userId },
          take: 1,
        },
      },
    });

    if (!company || !company.isEtf) {
      return NextResponse.json({ error: 'ETF not found' }, { status: 404 });
    }

    return NextResponse.json(serialize({
      success: true,
      company,
      etfDetails: company.etfDetails,
      prices: company.prices,
      recommendation: company.recommendations[0] || null,
      isInWatchlist: company.watchlists.length > 0,
    }));
  } catch (error) {
    console.error('ETF fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ETF data' },
      { status: 500 }
    );
  }
}

// POST — Add new ETF
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();
    console.log('ETF POST called for:', upperTicker);

    // Check if already exists
    const existing = await prisma.company.findUnique({
      where: { ticker: upperTicker },
      include: { etfDetails: true },
    });

    if (existing) {
      if (!existing.isEtf) {
        return NextResponse.json(
          { error: `${upperTicker} exists as a stock, not an ETF` },
          { status: 400 }
        );
      }
      return NextResponse.json(serialize({
        success: true,
        company: existing,
        message: 'ETF already exists',
      }));
    }

    // Verify via Yahoo Finance that it's actually an ETF
    const yahoo = getYahooFinanceProvider();
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance();

    let etfName = upperTicker;
    let exchange: string | null = null;

    try {
      const chart = await yf.chart(upperTicker, {
        period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        interval: '1d',
      });

      const meta = chart?.meta;
      console.log('Yahoo chart meta:', JSON.stringify(meta, null, 2));
      if (!meta) {
        return NextResponse.json(
          { error: `Could not find ${upperTicker} on Yahoo Finance` },
          { status: 404 }
        );
      }

      if (meta.instrumentType !== 'ETF') {
        return NextResponse.json(
          { error: `${upperTicker} is not an ETF (type: ${meta.instrumentType})` },
          { status: 400 }
        );
      }

      etfName = meta.longName || meta.shortName || upperTicker;
      exchange = meta.fullExchangeName || meta.exchangeName || null;
    } catch {
      return NextResponse.json(
        { error: `Could not verify ${upperTicker} on Yahoo Finance` },
        { status: 404 }
      );
    }

    // Create company record
    const company = await prisma.company.create({
      data: {
        ticker: upperTicker,
        name: etfName,
        exchange,
        isEtf: true,
        country: 'US',
        currency: 'USD',
      },
    });

    // Fetch ETF profile from Alpha Vantage
    try {
      const av = getAlphaVantageProvider();
      const profile = await av.fetchEtfProfile(upperTicker);

      if (profile) {
        await prisma.etfDetails.create({
          data: {
            companyId: company.id,
            netAssets: profile.netAssets,
            expenseRatio: profile.expenseRatio,
            dividendYield: profile.dividendYield,
            portfolioTurnover: profile.portfolioTurnover,
            inceptionDate: profile.inceptionDate ? new Date(profile.inceptionDate) : null,
            isLeveraged: profile.isLeveraged,
            assetClass: profile.assetClass,
            topHoldings: profile.topHoldings as unknown as object,
            sectorBreakdown: profile.sectorBreakdown as unknown as object,
            fetchedAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.error('Alpha Vantage ETF profile fetch error:', err);
      // Non-fatal — continue without ETF details
    }

    // Fetch historical prices from Yahoo
    try {
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 10);
      const priceResult = await yahoo.getDailyPrices(upperTicker, startDate);

      if (priceResult.success && priceResult.data && priceResult.data.length > 0) {
        const priceRecords = priceResult.data.map((p) => ({
          companyId: company.id,
          date: p.date,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
          adjClose: p.adjClose,
          volume: p.volume ? BigInt(p.volume) : null,
          dataSource: 'yahoo',
        }));

        // Batch insert in chunks
        const CHUNK = 500;
        for (let i = 0; i < priceRecords.length; i += CHUNK) {
          await prisma.priceDaily.createMany({
            data: priceRecords.slice(i, i + CHUNK),
            skipDuplicates: true,
          });
        }

        await prisma.company.update({
          where: { id: company.id },
          data: { lastPriceUpdate: new Date() },
        });
      }
    } catch (err) {
      console.error('Yahoo price fetch error:', err);
    }

    // Return full company with details
    const fullCompany = await prisma.company.findUnique({
      where: { id: company.id },
      include: {
        etfDetails: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });

    return NextResponse.json(serialize({
      success: true,
      company: fullCompany,
    }));
  } catch (error) {
    console.error('ETF creation error:', error instanceof Error ? error.message : error);
    console.error('ETF creation stack:', error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { error: 'Failed to add ETF' },
      { status: 500 }
    );
  }
}
