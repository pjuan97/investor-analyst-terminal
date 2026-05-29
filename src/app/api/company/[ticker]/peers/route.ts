import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

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

    // Find the target company
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
      select: { id: true, ticker: true, name: true, sector: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!company.sector) {
      return NextResponse.json({
        success: true,
        sector: null,
        peers: [],
        message: 'Company has no sector assigned',
      });
    }

    // Find peers in the same sector (max 8, ordered by market cap from latest metrics)
    const peerCompanies = await prisma.company.findMany({
      where: {
        sector: company.sector,
        isEtf: false,
      },
      select: {
        id: true,
        ticker: true,
        name: true,
      },
      take: 9, // get 9 to ensure we have up to 8 peers + current
    });

    // For each peer, fetch latest metrics and recommendation
    const peers = await Promise.all(
      peerCompanies.map(async (peer) => {
        const latestMetrics = await prisma.metricsAnnual.findFirst({
          where: { companyId: peer.id },
          orderBy: { fiscalYear: 'desc' },
        });

        const latestRec = await prisma.recommendationDaily.findFirst({
          where: { companyId: peer.id },
          orderBy: { date: 'desc' },
        });

        return {
          ticker: peer.ticker,
          name: peer.name,
          isCurrent: peer.ticker === upperTicker,
          grossMargin: toNum(latestMetrics?.grossMargin),
          netMargin: toNum(latestMetrics?.netMargin),
          fcfMargin: toNum(latestMetrics?.fcfMargin),
          roe: toNum(latestMetrics?.roe),
          roic: toNum(latestMetrics?.roic),
          peRatio: toNum(latestMetrics?.peRatio),
          evToEbitda: toNum(latestMetrics?.evToEbitda),
          revenueGrowth: toNum(latestMetrics?.revenueGrowth),
          epsGrowth: toNum(latestMetrics?.epsGrowth),
          marketCap: toNum(latestMetrics?.marketCap),
          debtToEquity: toNum(latestMetrics?.debtToEquity),
          qualityScore: toNum(latestMetrics?.qualityScore),
          recommendation: latestRec?.rating || null,
          confidence: latestRec ? toNum(latestRec.confidence) : null,
        };
      })
    );

    // Sort by market cap desc (nulls last), limit to 9 total
    peers.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      if (a.marketCap === null && b.marketCap === null) return 0;
      if (a.marketCap === null) return 1;
      if (b.marketCap === null) return -1;
      return b.marketCap - a.marketCap;
    });

    return NextResponse.json({
      success: true,
      sector: company.sector,
      peers: peers.slice(0, 9),
    });
  } catch (error) {
    console.error('Peers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch peers' },
      { status: 500 }
    );
  }
}
