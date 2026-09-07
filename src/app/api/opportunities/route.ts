import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  rankOpportunities,
  DEFAULT_HURDLE_RATE,
  type CompanyScanInput,
} from '@/lib/opportunities/score';

// ============================================================================
// GET /api/opportunities — deterministic scan across the user's watchlist
// ============================================================================
//
// Reads only from the database: no external providers are called, so this
// costs nothing and consumes none of the FMP / Alpha Vantage daily quotas.

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hurdleParam = request.nextUrl.searchParams.get('hurdleRate');
    const parsedHurdle = hurdleParam ? Number(hurdleParam) : NaN;
    const hurdleRate =
      Number.isFinite(parsedHurdle) && parsedHurdle > 0 && parsedHurdle < 1
        ? parsedHurdle
        : DEFAULT_HURDLE_RATE;

    const watchlist = await prisma.watchlist.findMany({
      where: { userId: session.userId },
      include: {
        company: {
          include: {
            metrics: { orderBy: { fiscalYear: 'desc' }, take: 10 },
            // 52 weeks of trading days, newest first.
            prices: { orderBy: { date: 'desc' }, take: 260 },
            // Two most recent snapshots: the current one and the one to diff against.
            recommendations: { orderBy: { date: 'desc' }, take: 2 },
          },
        },
      },
    });

    const inputs: CompanyScanInput[] = watchlist.map(({ company }) => {
      const [currentRec, previousRec] = company.recommendations;

      const toRec = (rec: (typeof company.recommendations)[number] | undefined) =>
        rec
          ? {
              rating: rec.rating as 'BUY' | 'HOLD' | 'SELL',
              confidence: num(rec.confidence) ?? 0,
              modelVotes: (rec.modelVotes ?? {}) as Record<
                string,
                { rating?: 'BUY' | 'HOLD' | 'SELL'; confidence?: number }
              >,
              fiscalYear: rec.metricsYear ?? null,
            }
          : null;

      return {
        companyId: company.id,
        ticker: company.ticker,
        name: company.name,
        currency: company.currency,
        dataQualityScore: num(company.dataQualityScore),
        metrics: company.metrics.map((m) => ({
          fiscalYear: m.fiscalYear,
          peRatio: num(m.peRatio),
          evToFcf: num(m.evToFcf),
          earningsYield: num(m.earningsYield),
          fcfMargin: num(m.fcfMargin),
          revenueGrowth: num(m.revenueGrowth),
          roic: num(m.roic),
        })),
        prices: company.prices.map((p) => ({
          date: p.date,
          close: num(p.close) ?? 0,
        })),
        currentRec: toRec(currentRec),
        previousRec: toRec(previousRec),
      };
    });

    const scan = rankOpportunities(inputs, hurdleRate);

    return NextResponse.json(scan);
  } catch (error) {
    console.error('Opportunities scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan for opportunities' },
      { status: 500 }
    );
  }
}
