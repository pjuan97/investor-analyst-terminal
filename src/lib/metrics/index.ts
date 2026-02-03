export { calculateMetrics } from './calculator';

import { prisma } from '@/lib/db';
import { calculateMetrics } from './calculator';
import type { CalculatedMetrics } from '@/types';

/**
 * Calculate and store metrics for a company
 */
export async function calculateAndStoreMetrics(companyId: string): Promise<{
  success: boolean;
  metricsCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let metricsCount = 0;

  try {
    // Get company financial statements
    const financials = await prisma.financialStatementAnnual.findMany({
      where: { companyId },
      orderBy: { fiscalYear: 'desc' },
    });

    if (financials.length === 0) {
      return { success: false, metricsCount: 0, errors: ['No financial data available'] };
    }

    // Get latest price
    const latestPrice = await prisma.priceDaily.findFirst({
      where: { companyId },
      orderBy: { date: 'desc' },
    });

    const prices = latestPrice ? [latestPrice] : [];

    // Calculate metrics for each year
    for (let i = 0; i < financials.length; i++) {
      const current = financials[i];
      const previous = financials[i + 1] || null;

      try {
        const metrics = calculateMetrics([current], prices, previous);

        if (metrics) {
          await prisma.metricsAnnual.upsert({
            where: {
              companyId_fiscalYear: {
                companyId,
                fiscalYear: current.fiscalYear,
              },
            },
            update: {
              grossMargin: metrics.grossMargin,
              operatingMargin: metrics.operatingMargin,
              netMargin: metrics.netMargin,
              roe: metrics.roe,
              roa: metrics.roa,
              roic: metrics.roic,
              roce: metrics.roce,
              fcfMargin: metrics.fcfMargin,
              fcfYield: metrics.fcfYield,
              fcfPerShare: metrics.fcfPerShare,
              debtToEquity: metrics.debtToEquity,
              debtToEbitda: metrics.debtToEbitda,
              debtToFcf: metrics.debtToFcf,
              currentRatio: metrics.currentRatio,
              interestCoverage: metrics.interestCoverage,
              marketCap: metrics.marketCap,
              enterpriseValue: metrics.enterpriseValue,
              peRatio: metrics.peRatio,
              pbRatio: metrics.pbRatio,
              psRatio: metrics.psRatio,
              evToEbitda: metrics.evToEbitda,
              evToFcf: metrics.evToFcf,
              earningsYield: metrics.earningsYield,
              fcfYieldOnEv: metrics.fcfYieldOnEv,
              revenueGrowth: metrics.revenueGrowth,
              epsGrowth: metrics.epsGrowth,
              fcfGrowth: metrics.fcfGrowth,
              earningsYieldMF: metrics.earningsYieldMF,
              returnOnCapitalMF: metrics.returnOnCapitalMF,
              qualityScore: metrics.qualityScore,
              dataCompleteness: metrics.dataCompleteness,
              calculatedAt: new Date(),
              priceDate: latestPrice?.date || null,
            },
            create: {
              companyId,
              fiscalYear: current.fiscalYear,
              grossMargin: metrics.grossMargin,
              operatingMargin: metrics.operatingMargin,
              netMargin: metrics.netMargin,
              roe: metrics.roe,
              roa: metrics.roa,
              roic: metrics.roic,
              roce: metrics.roce,
              fcfMargin: metrics.fcfMargin,
              fcfYield: metrics.fcfYield,
              fcfPerShare: metrics.fcfPerShare,
              debtToEquity: metrics.debtToEquity,
              debtToEbitda: metrics.debtToEbitda,
              debtToFcf: metrics.debtToFcf,
              currentRatio: metrics.currentRatio,
              interestCoverage: metrics.interestCoverage,
              marketCap: metrics.marketCap,
              enterpriseValue: metrics.enterpriseValue,
              peRatio: metrics.peRatio,
              pbRatio: metrics.pbRatio,
              psRatio: metrics.psRatio,
              evToEbitda: metrics.evToEbitda,
              evToFcf: metrics.evToFcf,
              earningsYield: metrics.earningsYield,
              fcfYieldOnEv: metrics.fcfYieldOnEv,
              revenueGrowth: metrics.revenueGrowth,
              epsGrowth: metrics.epsGrowth,
              fcfGrowth: metrics.fcfGrowth,
              earningsYieldMF: metrics.earningsYieldMF,
              returnOnCapitalMF: metrics.returnOnCapitalMF,
              qualityScore: metrics.qualityScore,
              dataCompleteness: metrics.dataCompleteness,
              calculatedAt: new Date(),
              priceDate: latestPrice?.date || null,
            },
          });

          metricsCount++;
        }
      } catch (error) {
        errors.push(`Error calculating metrics for year ${current.fiscalYear}: ${error}`);
      }
    }

    // Update company data quality score
    const latestMetrics = await prisma.metricsAnnual.findFirst({
      where: { companyId },
      orderBy: { fiscalYear: 'desc' },
    });

    if (latestMetrics?.qualityScore) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          dataQualityScore: Number(latestMetrics.qualityScore),
        },
      });
    }

    return { success: true, metricsCount, errors };
  } catch (error) {
    return {
      success: false,
      metricsCount,
      errors: [`Fatal error: ${error}`],
    };
  }
}

/**
 * Get the latest metrics for a company
 */
export async function getLatestMetrics(companyId: string): Promise<CalculatedMetrics | null> {
  const metrics = await prisma.metricsAnnual.findFirst({
    where: { companyId },
    orderBy: { fiscalYear: 'desc' },
  });

  if (!metrics) return null;

  return {
    fiscalYear: metrics.fiscalYear,
    grossMargin: metrics.grossMargin ? Number(metrics.grossMargin) : null,
    operatingMargin: metrics.operatingMargin ? Number(metrics.operatingMargin) : null,
    netMargin: metrics.netMargin ? Number(metrics.netMargin) : null,
    roe: metrics.roe ? Number(metrics.roe) : null,
    roa: metrics.roa ? Number(metrics.roa) : null,
    roic: metrics.roic ? Number(metrics.roic) : null,
    roce: metrics.roce ? Number(metrics.roce) : null,
    fcfMargin: metrics.fcfMargin ? Number(metrics.fcfMargin) : null,
    fcfYield: metrics.fcfYield ? Number(metrics.fcfYield) : null,
    fcfPerShare: metrics.fcfPerShare ? Number(metrics.fcfPerShare) : null,
    debtToEquity: metrics.debtToEquity ? Number(metrics.debtToEquity) : null,
    debtToEbitda: metrics.debtToEbitda ? Number(metrics.debtToEbitda) : null,
    debtToFcf: metrics.debtToFcf ? Number(metrics.debtToFcf) : null,
    currentRatio: metrics.currentRatio ? Number(metrics.currentRatio) : null,
    interestCoverage: metrics.interestCoverage ? Number(metrics.interestCoverage) : null,
    marketCap: metrics.marketCap ? Number(metrics.marketCap) : null,
    enterpriseValue: metrics.enterpriseValue ? Number(metrics.enterpriseValue) : null,
    peRatio: metrics.peRatio ? Number(metrics.peRatio) : null,
    pbRatio: metrics.pbRatio ? Number(metrics.pbRatio) : null,
    psRatio: metrics.psRatio ? Number(metrics.psRatio) : null,
    evToEbitda: metrics.evToEbitda ? Number(metrics.evToEbitda) : null,
    evToFcf: metrics.evToFcf ? Number(metrics.evToFcf) : null,
    earningsYield: metrics.earningsYield ? Number(metrics.earningsYield) : null,
    fcfYieldOnEv: metrics.fcfYieldOnEv ? Number(metrics.fcfYieldOnEv) : null,
    revenueGrowth: metrics.revenueGrowth ? Number(metrics.revenueGrowth) : null,
    epsGrowth: metrics.epsGrowth ? Number(metrics.epsGrowth) : null,
    fcfGrowth: metrics.fcfGrowth ? Number(metrics.fcfGrowth) : null,
    earningsYieldMF: metrics.earningsYieldMF ? Number(metrics.earningsYieldMF) : null,
    returnOnCapitalMF: metrics.returnOnCapitalMF ? Number(metrics.returnOnCapitalMF) : null,
    qualityScore: metrics.qualityScore ? Number(metrics.qualityScore) : null,
    dataCompleteness: metrics.dataCompleteness ? Number(metrics.dataCompleteness) : 0,
  };
}
