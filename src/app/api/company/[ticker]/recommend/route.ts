import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runAllModels, type UnifiedMetricsInput } from '@/lib/models';

/**
 * Generate investment recommendation for a company
 * Uses all 4 investment models (Buffett, Greenblatt, Fisher, Lynch)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  try {
    // Get company
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get all annual metrics and financial statements (sorted by year descending)
    const [metricsRecords, statementRecords] = await Promise.all([
      prisma.metricsAnnual.findMany({
        where: { companyId: company.id },
        orderBy: { fiscalYear: 'desc' },
      }),
      prisma.financialStatementAnnual.findMany({
        where: { companyId: company.id },
        orderBy: { fiscalYear: 'desc' },
      }),
    ]);

    if (metricsRecords.length === 0) {
      return NextResponse.json(
        { error: 'No metrics available. Please refresh financial data first.' },
        { status: 400 }
      );
    }

    // Get latest price
    const latestPrice = await prisma.priceDaily.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
    });

    const currentPrice = latestPrice ? Number(latestPrice.close) : 0;

    // Build maps for statement data by fiscal year
    const stmtByYear = new Map(statementRecords.map((s) => [s.fiscalYear, s]));

    // Helper: compute 3-year revenue CAGR for a given fiscal year
    const computeCagr3y = (fiscalYear: number): number | null => {
      const current = stmtByYear.get(fiscalYear);
      const past = stmtByYear.get(fiscalYear - 3);
      if (!current?.revenue || !past?.revenue) return null;
      const revCurr = Number(current.revenue);
      const revPast = Number(past.revenue);
      if (revPast <= 0 || revCurr <= 0) return null;
      return Math.pow(revCurr / revPast, 1 / 3) - 1;
    };

    // Helper: compute YoY diluted shares change
    const computeDilution = (fiscalYear: number): number | null => {
      const current = stmtByYear.get(fiscalYear);
      const prev = stmtByYear.get(fiscalYear - 1);
      if (!current?.sharesOutstandingDiluted || !prev?.sharesOutstandingDiluted) return null;
      const sharesCurr = Number(current.sharesOutstandingDiluted);
      const sharesPrev = Number(prev.sharesOutstandingDiluted);
      if (sharesPrev <= 0) return null;
      return (sharesCurr - sharesPrev) / sharesPrev;
    };

    // Convert metrics to unified format
    const unifiedMetrics: UnifiedMetricsInput[] = metricsRecords.map((m) => {
      const stmt = stmtByYear.get(m.fiscalYear);
      const revenue = stmt?.revenue ? Number(stmt.revenue) : null;
      const rd = stmt?.researchAndDevelopment ? Number(stmt.researchAndDevelopment) : null;
      const sbc = stmt?.stockBasedCompensation ? Number(stmt.stockBasedCompensation) : null;
      const ppe = stmt?.propertyPlantEquipment ? Number(stmt.propertyPlantEquipment) : null;
      const totalAssets = stmt?.totalAssets ? Number(stmt.totalAssets) : null;

      return {
        fiscalYear: m.fiscalYear,
        grossMargin: m.grossMargin ? Number(m.grossMargin) : null,
        operatingMargin: m.operatingMargin ? Number(m.operatingMargin) : null,
        netMargin: m.netMargin ? Number(m.netMargin) : null,
        roe: m.roe ? Number(m.roe) : null,
        roa: m.roa ? Number(m.roa) : null,
        roic: m.roic ? Number(m.roic) : null,
        roce: m.roce ? Number(m.roce) : null,
        fcfMargin: m.fcfMargin ? Number(m.fcfMargin) : null,
        fcfYield: m.fcfYield ? Number(m.fcfYield) : null,
        fcfPerShare: m.fcfPerShare ? Number(m.fcfPerShare) : null,
        debtToEquity: m.debtToEquity ? Number(m.debtToEquity) : null,
        debtToEbitda: m.debtToEbitda ? Number(m.debtToEbitda) : null,
        debtToFcf: m.debtToFcf ? Number(m.debtToFcf) : null,
        currentRatio: m.currentRatio ? Number(m.currentRatio) : null,
        interestCoverage: m.interestCoverage ? Number(m.interestCoverage) : null,
        marketCap: m.marketCap ? Number(m.marketCap) : null,
        enterpriseValue: m.enterpriseValue ? Number(m.enterpriseValue) : null,
        peRatio: m.peRatio ? Number(m.peRatio) : null,
        pbRatio: m.pbRatio ? Number(m.pbRatio) : null,
        psRatio: m.psRatio ? Number(m.psRatio) : null,
        evToEbitda: m.evToEbitda ? Number(m.evToEbitda) : null,
        evToFcf: m.evToFcf ? Number(m.evToFcf) : null,
        earningsYield: m.earningsYield ? Number(m.earningsYield) : null,
        fcfYieldOnEv: m.fcfYieldOnEv ? Number(m.fcfYieldOnEv) : null,
        revenueGrowth: m.revenueGrowth ? Number(m.revenueGrowth) : null,
        epsGrowth: m.epsGrowth ? Number(m.epsGrowth) : null,
        fcfGrowth: m.fcfGrowth ? Number(m.fcfGrowth) : null,
        earningsYieldMF: m.earningsYieldMF ? Number(m.earningsYieldMF) : null,
        returnOnCapitalMF: m.returnOnCapitalMF ? Number(m.returnOnCapitalMF) : null,
        qualityScore: m.qualityScore ? Number(m.qualityScore) : null,
        // Seessel BMP fields (computed on-the-fly)
        revenueGrowthCagr3y: computeCagr3y(m.fiscalYear),
        rdAsPercentRevenue: rd !== null && revenue !== null && revenue > 0 ? rd / revenue : null,
        sbcAsPercentRevenue: sbc !== null && revenue !== null && revenue > 0 ? sbc / revenue : null,
        netDilutionPercent: computeDilution(m.fiscalYear),
        ppeTotalAssetsRatio: ppe !== null && totalAssets !== null && totalAssets > 0 ? ppe / totalAssets : null,
      };
    });

    // Run all models
    const currentMetrics = unifiedMetrics[0];
    const historicalMetrics = unifiedMetrics.slice(1);

    const { votes, recommendation } = runAllModels(
      currentMetrics,
      historicalMetrics,
      currentPrice
    );

    // Store recommendation
    const storedRec = await prisma.recommendationDaily.upsert({
      where: {
        companyId_date: {
          companyId: company.id,
          date: new Date(),
        },
      },
      update: {
        rating: recommendation.rating,
        confidence: recommendation.confidence,
        modelVotes: JSON.parse(JSON.stringify(votes)),
        explanationShort: recommendation.explanationShort,
        explanationFull: recommendation.explanationFull,
        triggers: recommendation.triggers,
        priceAtRec: currentPrice,
        metricsYear: currentMetrics.fiscalYear,
      },
      create: {
        companyId: company.id,
        date: new Date(),
        rating: recommendation.rating,
        confidence: recommendation.confidence,
        modelVotes: JSON.parse(JSON.stringify(votes)),
        explanationShort: recommendation.explanationShort,
        explanationFull: recommendation.explanationFull,
        triggers: recommendation.triggers,
        priceAtRec: currentPrice,
        metricsYear: currentMetrics.fiscalYear,
      },
    });

    return NextResponse.json({
      success: true,
      recommendation: {
        rating: storedRec.rating,
        confidence: Number(storedRec.confidence),
        modelVotes: votes,
        explanationShort: storedRec.explanationShort,
        explanationFull: storedRec.explanationFull,
        triggers: storedRec.triggers,
        priceAtRec: Number(storedRec.priceAtRec),
        metricsYear: storedRec.metricsYear,
      },
    });
  } catch (error) {
    console.error('Error generating recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendation', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - Fetch latest recommendation without regenerating
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  try {
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const recommendation = await prisma.recommendationDaily.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: 'No recommendation available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recommendation: {
        rating: recommendation.rating,
        confidence: Number(recommendation.confidence),
        modelVotes: recommendation.modelVotes,
        explanationShort: recommendation.explanationShort,
        explanationFull: recommendation.explanationFull,
        triggers: recommendation.triggers,
        priceAtRec: Number(recommendation.priceAtRec),
        metricsYear: recommendation.metricsYear,
        generatedAt: recommendation.date,
      },
    });
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendation' },
      { status: 500 }
    );
  }
}
