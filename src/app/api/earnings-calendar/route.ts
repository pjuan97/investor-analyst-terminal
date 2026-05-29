import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface FmpEarning {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1m';

    // Calculate date range
    const from = new Date();
    const to = new Date();
    switch (range) {
      case '1w':
        to.setDate(to.getDate() + 7);
        break;
      case '2w':
        to.setDate(to.getDate() + 14);
        break;
      case '1m':
      default:
        to.setMonth(to.getMonth() + 1);
        break;
    }

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    // Fetch from FMP
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'FMP API key not configured' }, { status: 500 });
    }

    const fmpUrl = `https://financialmodelingprep.com/stable/earnings-calendar?from=${fromStr}&to=${toStr}&apikey=${apiKey}`;
    const fmpRes = await fetch(fmpUrl);
    if (!fmpRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch earnings calendar' }, { status: 502 });
    }

    const fmpData: FmpEarning[] = await fmpRes.json();

    // Get user's watchlist tickers (stocks only)
    const watchlistItems = await prisma.watchlist.findMany({
      where: { userId: session.userId },
      include: {
        company: {
          select: { ticker: true, name: true, isEtf: true },
        },
      },
    });

    const watchlistTickers = new Set(
      watchlistItems
        .filter((w) => !w.company.isEtf)
        .map((w) => w.company.ticker)
    );

    // Get known companies from DB (non-ETF, ordered by market cap) for non-watchlist matches
    const knownCompanies = await prisma.company.findMany({
      where: { isEtf: false },
      select: { ticker: true, name: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const companyNameMap = new Map<string, string>();
    for (const c of knownCompanies) {
      companyNameMap.set(c.ticker, c.name);
    }
    for (const w of watchlistItems) {
      companyNameMap.set(w.company.ticker, w.company.name);
    }

    const knownTickers = new Set(knownCompanies.map((c) => c.ticker));

    // Build results: watchlist items + top known companies
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const results = fmpData
      .filter((e) => watchlistTickers.has(e.symbol) || knownTickers.has(e.symbol))
      .map((e) => {
        const d = new Date(e.date + 'T00:00:00');
        const surprise =
          e.epsActual !== null && e.epsEstimated !== null && e.epsEstimated !== 0
            ? ((e.epsActual - e.epsEstimated) / Math.abs(e.epsEstimated)) * 100
            : null;

        return {
          symbol: e.symbol,
          companyName: companyNameMap.get(e.symbol) || e.symbol,
          date: e.date,
          dayOfWeek: dayNames[d.getDay()],
          epsEstimated: e.epsEstimated,
          epsActual: e.epsActual,
          surprise,
          revenueEstimated: e.revenueEstimated,
          revenueActual: e.revenueActual,
          isInWatchlist: watchlistTickers.has(e.symbol),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ success: true, earnings: results });
  } catch (error) {
    console.error('Earnings calendar error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings calendar' },
      { status: 500 }
    );
  }
}
