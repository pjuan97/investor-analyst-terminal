import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { calculateAndStoreMetrics } from '@/lib/metrics';
import { runAllModels, type UnifiedMetricsInput } from '@/lib/models';

/**
 * Run daily update job
 * - Updates prices for all companies in watchlists
 * - Checks for new SEC filings
 * - Recalculates metrics
 * - Generates recommendations (when models are implemented)
 */
export async function POST(request: NextRequest) {
  // Check authorization
  const cronSecret = request.headers.get('x-cron-secret');
  const session = await getSession();

  // Allow if: valid cron secret OR authenticated user
  if (cronSecret !== process.env.CRON_SECRET && !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  // Create job run record
  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: 'daily_update',
      status: 'running',
      startedAt: new Date(),
    },
  });

  const results = {
    companiesProcessed: 0,
    pricesUpdated: 0,
    financialsUpdated: 0,
    metricsCalculated: 0,
    recommendationsGenerated: 0,
    errors: [] as string[],
  };

  try {
    // Get all unique companies from all watchlists
    const watchlistCompanies = await prisma.company.findMany({
      where: {
        watchlists: {
          some: {},
        },
      },
      select: {
        id: true,
        ticker: true,
        lastPriceUpdate: true,
        lastSecFiling: true,
      },
    });

    const providers = getProviders();

    for (const company of watchlistCompanies) {
      try {
        results.companiesProcessed++;

        // 1. Update prices (always)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 7); // Get last week of prices

        const pricesResult = await providers.prices.getDailyPrices(
          company.ticker,
          yesterday,
          new Date()
        );

        if (pricesResult.success && pricesResult.data) {
          for (const price of pricesResult.data) {
            await prisma.priceDaily.upsert({
              where: {
                companyId_date: {
                  companyId: company.id,
                  date: price.date,
                },
              },
              update: {
                close: price.close,
                open: price.open,
                high: price.high,
                low: price.low,
                volume: price.volume ? BigInt(price.volume) : null,
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
                dataSource: 'stooq',
              },
            });
          }
          results.pricesUpdated += pricesResult.data.length;
        }

        // 2. Check if we need to refresh financials (weekly)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        if (!company.lastSecFiling || company.lastSecFiling < oneWeekAgo) {
          const financialsResult = await providers.financials.getAnnualFinancials(
            company.ticker,
            10
          );

          if (financialsResult.success && financialsResult.data) {
            for (const statement of financialsResult.data) {
              await prisma.financialStatementAnnual.upsert({
                where: {
                  companyId_fiscalYear: {
                    companyId: company.id,
                    fiscalYear: statement.fiscalYear,
                  },
                },
                update: {
                  periodEnd: statement.periodEnd,
                  revenue: statement.revenue,
                  grossProfit: statement.grossProfit,
                  operatingIncome: statement.operatingIncome,
                  netIncome: statement.netIncome,
                  totalAssets: statement.totalAssets,
                  totalEquity: statement.totalEquity,
                  totalDebt: statement.totalDebt,
                  operatingCashFlow: statement.operatingCashFlow,
                  freeCashFlow: statement.freeCashFlow,
                  researchAndDevelopment: statement.researchAndDevelopment,
                  sellingGeneralAdmin: statement.sellingGeneralAdmin,
                  stockBasedCompensation: statement.stockBasedCompensation,
                  dataSource: statement.dataSource,
                  dataQuality: statement.dataQuality,
                  missingFields: statement.missingFields,
                  updatedAt: new Date(),
                },
                create: {
                  companyId: company.id,
                  fiscalYear: statement.fiscalYear,
                  periodEnd: statement.periodEnd,
                  revenue: statement.revenue,
                  costOfRevenue: statement.costOfRevenue,
                  grossProfit: statement.grossProfit,
                  operatingExpenses: statement.operatingExpenses,
                  operatingIncome: statement.operatingIncome,
                  interestExpense: statement.interestExpense,
                  netIncome: statement.netIncome,
                  sharesOutstanding: statement.sharesOutstanding,
                  sharesOutstandingDiluted: statement.sharesOutstandingDiluted,
                  eps: statement.eps,
                  epsDiluted: statement.epsDiluted,
                  totalAssets: statement.totalAssets,
                  currentAssets: statement.currentAssets,
                  cash: statement.cash,
                  totalLiabilities: statement.totalLiabilities,
                  currentLiabilities: statement.currentLiabilities,
                  shortTermDebt: statement.shortTermDebt,
                  longTermDebt: statement.longTermDebt,
                  totalDebt: statement.totalDebt,
                  totalEquity: statement.totalEquity,
                  operatingCashFlow: statement.operatingCashFlow,
                  capitalExpenditure: statement.capitalExpenditure,
                  freeCashFlow: statement.freeCashFlow,
                  researchAndDevelopment: statement.researchAndDevelopment,
                  sellingGeneralAdmin: statement.sellingGeneralAdmin,
                  stockBasedCompensation: statement.stockBasedCompensation,
                  dataSource: statement.dataSource,
                  dataQuality: statement.dataQuality,
                  missingFields: statement.missingFields,
                },
              });
            }
            results.financialsUpdated += financialsResult.data.length;

            await prisma.company.update({
              where: { id: company.id },
              data: { lastSecFiling: new Date() },
            });
          }
        }

        // 3. Recalculate metrics
        const metricsResult = await calculateAndStoreMetrics(company.id);
        if (metricsResult.success) {
          results.metricsCalculated += metricsResult.metricsCount;
        }

        // 4. Generate recommendation using investment models
        try {
          const metricsRecords = await prisma.metricsAnnual.findMany({
            where: { companyId: company.id },
            orderBy: { fiscalYear: 'desc' },
          });

          const latestPrice = await prisma.priceDaily.findFirst({
            where: { companyId: company.id },
            orderBy: { date: 'desc' },
          });

          if (metricsRecords.length > 0) {
            // Seessel fields are left null in cron — computed on-the-fly in /recommend
            const unifiedMetrics: UnifiedMetricsInput[] = metricsRecords.map((m) => ({
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
            }));

            const currentMetrics = unifiedMetrics[0];
            const historicalMetrics = unifiedMetrics.slice(1);
            const currentPrice = latestPrice ? Number(latestPrice.close) : 0;

            const { votes, recommendation } = runAllModels(
              currentMetrics,
              historicalMetrics,
              currentPrice
            );

            await prisma.recommendationDaily.upsert({
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

            results.recommendationsGenerated++;
          }
        } catch (recError) {
          console.error(`Error generating recommendation for ${company.ticker}:`, recError);
        }

        // Update last price update
        await prisma.company.update({
          where: { id: company.id },
          data: { lastPriceUpdate: new Date() },
        });
      } catch (error) {
        const errorMsg = `Error processing ${company.ticker}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    // Update job run record
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        companiesProcessed: results.companiesProcessed,
        errors: results.errors.length > 0 ? results.errors : undefined,
        summary: `Processed ${results.companiesProcessed} companies. Prices: ${results.pricesUpdated}, Financials: ${results.financialsUpdated}, Metrics: ${results.metricsCalculated}`,
      },
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(1)}s`,
      results,
    });
  } catch (error) {
    // Update job run as failed
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: [String(error)],
      },
    });

    console.error('Daily update job failed:', error);
    return NextResponse.json(
      { error: 'Daily update job failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Support GET for easier testing
export async function GET(request: NextRequest) {
  return POST(request);
}
