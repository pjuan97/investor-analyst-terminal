import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAlphaVantageProvider } from '@/lib/providers/alphavantage';
import { getYahooFinanceProvider } from '@/lib/providers/prices/yahoo';

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
    console.log('ETF refresh called for:', upperTicker);

    // Find company — must exist and be an ETF
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company || !company.isEtf) {
      return NextResponse.json({ error: 'ETF not found' }, { status: 404 });
    }

    const results = {
      profile: { success: false, error: null as string | null },
      prices: { success: false, count: 0, error: null as string | null },
    };

    // STEP 1 — Refresh ETF Profile (Alpha Vantage)
    try {
      const av = getAlphaVantageProvider();
      const profile = await av.fetchEtfProfile(upperTicker);

      if (profile) {
        await prisma.etfDetails.upsert({
          where: { companyId: company.id },
          update: {
            netAssets: profile.netAssets,
            expenseRatio: profile.expenseRatio,
            dividendYield: profile.dividendYield,
            portfolioTurnover: profile.portfolioTurnover,
            inceptionDate: profile.inceptionDate ? new Date(profile.inceptionDate) : null,
            isLeveraged: profile.isLeveraged,
            assetClass: profile.assetClass || undefined,
            topHoldings: profile.topHoldings as unknown as object,
            sectorBreakdown: profile.sectorBreakdown as unknown as object,
            fetchedAt: new Date(),
          },
          create: {
            companyId: company.id,
            netAssets: profile.netAssets,
            expenseRatio: profile.expenseRatio,
            dividendYield: profile.dividendYield,
            portfolioTurnover: profile.portfolioTurnover,
            inceptionDate: profile.inceptionDate ? new Date(profile.inceptionDate) : null,
            isLeveraged: profile.isLeveraged,
            assetClass: profile.assetClass || null,
            topHoldings: profile.topHoldings as unknown as object,
            sectorBreakdown: profile.sectorBreakdown as unknown as object,
            fetchedAt: new Date(),
          },
        });
        results.profile.success = true;
      }
    } catch (err) {
      console.error('ETF profile refresh error:', err);
      results.profile.error = err instanceof Error ? err.message : 'Profile refresh failed';
    }

    // STEP 2 — Refresh Prices (Yahoo Finance)
    try {
      const yahoo = getYahooFinanceProvider();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 10);

      const priceResult = await yahoo.getDailyPrices(upperTicker, startDate);

      if (priceResult.success && priceResult.data && priceResult.data.length > 0) {
        for (const price of priceResult.data) {
          await prisma.priceDaily.upsert({
            where: {
              companyId_date: {
                companyId: company.id,
                date: price.date,
              },
            },
            update: {
              open: price.open,
              high: price.high,
              low: price.low,
              close: price.close,
              adjClose: price.adjClose,
              volume: price.volume ? BigInt(price.volume) : null,
              dataSource: 'yahoo',
            },
            create: {
              companyId: company.id,
              date: price.date,
              open: price.open,
              high: price.high,
              low: price.low,
              close: price.close,
              adjClose: price.adjClose,
              volume: price.volume ? BigInt(price.volume) : null,
              dataSource: 'yahoo',
            },
          });
        }

        await prisma.company.update({
          where: { id: company.id },
          data: { lastPriceUpdate: new Date() },
        });

        results.prices = { success: true, count: priceResult.data.length, error: null };
      }
    } catch (err) {
      console.error('ETF price refresh error:', err);
      results.prices.error = err instanceof Error ? err.message : 'Price refresh failed';
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { lastRefreshedAt: new Date() },
    });

    const updated = await prisma.company.findUnique({
      where: { id: company.id },
      select: { ticker: true, lastRefreshedAt: true },
    });
    console.log('ETF refresh saved:', updated);

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      results,
    });
  } catch (error) {
    console.error('ETF refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh ETF data' },
      { status: 500 }
    );
  }
}
