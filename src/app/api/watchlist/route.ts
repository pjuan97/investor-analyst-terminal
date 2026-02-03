import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSecProvider } from '@/lib/providers';
import { z } from 'zod';

const addTickerSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
  cik: z.string().optional(), // Optional manual CIK
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, cik: manualCik } = addTickerSchema.parse(body);

    // Check if company exists in our database
    let company = await prisma.company.findUnique({
      where: { ticker },
    });

    if (!company) {
      // Fetch company info from SEC
      const secProvider = getSecProvider();
      const companyInfoResult = await secProvider.getCompanyInfo(ticker);

      if (!companyInfoResult.success || !companyInfoResult.data) {
        // If SEC lookup fails but user provided CIK, create anyway
        if (manualCik) {
          company = await prisma.company.create({
            data: {
              ticker,
              cik: manualCik.padStart(10, '0'),
              name: ticker, // Will be updated when data is fetched
            },
          });
        } else {
          return NextResponse.json(
            {
              error: `Could not find company info for ${ticker}. You can try providing the CIK manually.`,
              needsCik: true,
            },
            { status: 404 }
          );
        }
      } else {
        // Create company with fetched info
        company = await prisma.company.create({
          data: {
            ticker: companyInfoResult.data.ticker,
            cik: companyInfoResult.data.cik,
            name: companyInfoResult.data.name,
            exchange: companyInfoResult.data.exchange,
            sector: companyInfoResult.data.sector,
            industry: companyInfoResult.data.industry,
          },
        });
      }
    }

    // Check if already in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_companyId: {
          userId: session.userId,
          companyId: company.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `${ticker} is already in your watchlist` },
        { status: 400 }
      );
    }

    // Add to watchlist
    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: session.userId,
        companyId: company.id,
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: watchlistItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Add to watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to add ticker' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlist = await prisma.watchlist.findMany({
      where: { userId: session.userId },
      include: {
        company: {
          include: {
            recommendations: {
              orderBy: { date: 'desc' },
              take: 1,
            },
            prices: {
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    return NextResponse.json({ data: watchlist });
  } catch (error) {
    console.error('Get watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to get watchlist' },
      { status: 500 }
    );
  }
}
