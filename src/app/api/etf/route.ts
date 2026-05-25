import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

function serialize<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

// GET — List all ETFs
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const etfs = await prisma.company.findMany({
      where: { isEtf: true },
      include: {
        etfDetails: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 2,
        },
      },
      orderBy: { ticker: 'asc' },
    });

    // Compute price change for each ETF
    const result = etfs.map((etf) => {
      const latest = etf.prices[0];
      const prev = etf.prices[1];
      const price = latest ? Number(latest.close) : null;
      const change = latest && prev
        ? ((Number(latest.close) - Number(prev.close)) / Number(prev.close)) * 100
        : null;

      return {
        id: etf.id,
        ticker: etf.ticker,
        name: etf.name,
        exchange: etf.exchange,
        price,
        changePercent: change,
        netAssets: etf.etfDetails?.netAssets ? Number(etf.etfDetails.netAssets) : null,
        expenseRatio: etf.etfDetails?.expenseRatio ? Number(etf.etfDetails.expenseRatio) : null,
        dividendYield: etf.etfDetails?.dividendYield ? Number(etf.etfDetails.dividendYield) : null,
        createdAt: etf.createdAt,
      };
    });

    return NextResponse.json(serialize({ success: true, etfs: result }));
  } catch (error) {
    console.error('ETF list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ETFs' },
      { status: 500 }
    );
  }
}
