import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getProviders, isBvcTicker } from '@/lib/providers';
import { getFmpProvider } from '@/lib/providers/fmp';
import { calculateAndStoreMetrics } from '@/lib/metrics';
import { runAllModels, type UnifiedMetricsInput } from '@/lib/models';

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
    console.log('Refresh called for:', upperTicker);

    // Find company
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const providers = getProviders(upperTicker);
    const results = {
      financials: { success: false, count: 0, error: null as string | null },
      prices: { success: false, count: 0, error: null as string | null },
      metrics: { success: false, count: 0, error: null as string | null },
      recommendation: { success: false, rating: null as string | null, error: null as string | null },
    };

    // 1. Fetch financial statements
    const financialsResult = await providers.financials.getAnnualFinancials(upperTicker);

    if (financialsResult.success && financialsResult.data) {
      // Store raw document
      if (financialsResult.rawDocument) {
        const urlHash = Buffer.from(financialsResult.rawDocument.url).toString('base64').slice(0, 64);

        await prisma.rawSourceDocument.upsert({
          where: {
            companyId_urlHash: {
              companyId: company.id,
              urlHash,
            },
          },
          update: {
            payload: financialsResult.rawDocument.payload as object,
            fetchedAt: new Date(),
          },
          create: {
            companyId: company.id,
            provider: 'sec_edgar',
            documentType: 'company_facts',
            url: financialsResult.rawDocument.url,
            urlHash,
            fetchedAt: new Date(),
            payload: financialsResult.rawDocument.payload as object,
          },
        });
      }

      // Store normalized financials
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
            dividendPerShare: statement.dividendPerShare,
            totalAssets: statement.totalAssets,
            currentAssets: statement.currentAssets,
            cash: statement.cash,
            shortTermInvestments: statement.shortTermInvestments,
            receivables: statement.receivables,
            inventory: statement.inventory,
            propertyPlantEquipment: statement.propertyPlantEquipment,
            goodwill: statement.goodwill,
            intangibleAssets: statement.intangibleAssets,
            totalLiabilities: statement.totalLiabilities,
            currentLiabilities: statement.currentLiabilities,
            accountsPayable: statement.accountsPayable,
            shortTermDebt: statement.shortTermDebt,
            longTermDebt: statement.longTermDebt,
            totalDebt: statement.totalDebt,
            totalEquity: statement.totalEquity,
            retainedEarnings: statement.retainedEarnings,
            operatingCashFlow: statement.operatingCashFlow,
            capitalExpenditure: statement.capitalExpenditure,
            freeCashFlow: statement.freeCashFlow,
            dividendsPaid: statement.dividendsPaid,
            shareRepurchases: statement.shareRepurchases,
            researchAndDevelopment: statement.researchAndDevelopment,
            sellingGeneralAdmin: statement.sellingGeneralAdmin,
            stockBasedCompensation: statement.stockBasedCompensation,
            dataSource: statement.dataSource,
            dataQuality: statement.dataQuality,
            missingFields: statement.missingFields,
            unmappedTags: statement.unmappedTags as object | undefined,
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
            dividendPerShare: statement.dividendPerShare,
            totalAssets: statement.totalAssets,
            currentAssets: statement.currentAssets,
            cash: statement.cash,
            shortTermInvestments: statement.shortTermInvestments,
            receivables: statement.receivables,
            inventory: statement.inventory,
            propertyPlantEquipment: statement.propertyPlantEquipment,
            goodwill: statement.goodwill,
            intangibleAssets: statement.intangibleAssets,
            totalLiabilities: statement.totalLiabilities,
            currentLiabilities: statement.currentLiabilities,
            accountsPayable: statement.accountsPayable,
            shortTermDebt: statement.shortTermDebt,
            longTermDebt: statement.longTermDebt,
            totalDebt: statement.totalDebt,
            totalEquity: statement.totalEquity,
            retainedEarnings: statement.retainedEarnings,
            operatingCashFlow: statement.operatingCashFlow,
            capitalExpenditure: statement.capitalExpenditure,
            freeCashFlow: statement.freeCashFlow,
            dividendsPaid: statement.dividendsPaid,
            shareRepurchases: statement.shareRepurchases,
            researchAndDevelopment: statement.researchAndDevelopment,
            sellingGeneralAdmin: statement.sellingGeneralAdmin,
            stockBasedCompensation: statement.stockBasedCompensation,
            dataSource: statement.dataSource,
            dataQuality: statement.dataQuality,
            missingFields: statement.missingFields,
            unmappedTags: statement.unmappedTags as object | undefined,
          },
        });
      }

      results.financials = {
        success: true,
        count: financialsResult.data.length,
        error: null,
      };

      // Update company last SEC filing date
      await prisma.company.update({
        where: { id: company.id },
        data: { lastSecFiling: new Date() },
      });
    } else {
      results.financials.error = financialsResult.error || 'Failed to fetch financials';
    }

    // 2. Fetch price data
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const pricesResult = await providers.prices.getDailyPrices(
      upperTicker,
      tenYearsAgo,
      new Date()
    );

    if (pricesResult.success && pricesResult.data) {
      // Store prices (batch insert for efficiency)
      for (const price of pricesResult.data) {
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
            dataSource: providers.prices.name,
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
            dataSource: providers.prices.name,
          },
        });
      }

      results.prices = {
        success: true,
        count: pricesResult.data.length,
        error: null,
      };

      // Update company last price update
      await prisma.company.update({
        where: { id: company.id },
        data: { lastPriceUpdate: new Date() },
      });
    } else {
      results.prices.error = pricesResult.error || 'Failed to fetch prices';
    }

    // 2.5 Fetch company profile (enrichment) — FMP doesn't cover the BVC
    const fmp = getFmpProvider();
    if (fmp && !isBvcTicker(upperTicker)) {
      try {
        const profile = await fmp.fetchCompanyProfile(upperTicker);
        if (profile) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              description: profile.description,
              industry: profile.industry,
              website: profile.website,
              ceo: profile.ceo,
              employees: profile.employees,
              ipoDate: profile.ipoDate ? new Date(profile.ipoDate) : null,
              logoUrl: profile.logoUrl,
              country: profile.country,
            },
          });
        }
      } catch (profileError) {
        console.error('Profile enrichment error:', profileError);
      }
    }

    // 3. Calculate metrics
    const metricsResult = await calculateAndStoreMetrics(company.id);
    results.metrics = {
      success: metricsResult.success,
      count: metricsResult.metricsCount,
      error: metricsResult.errors.length > 0 ? metricsResult.errors.join('; ') : null,
    };

    // 4. Generate recommendation if metrics are available
    if (metricsResult.success && metricsResult.metricsCount > 0) {
      try {
        const [metricsRecords, stmtRecords] = await Promise.all([
          prisma.metricsAnnual.findMany({
            where: { companyId: company.id },
            orderBy: { fiscalYear: 'desc' },
          }),
          prisma.financialStatementAnnual.findMany({
            where: { companyId: company.id },
            orderBy: { fiscalYear: 'desc' },
          }),
        ]);

        const latestPrice = await prisma.priceDaily.findFirst({
          where: { companyId: company.id },
          orderBy: { date: 'desc' },
        });

        const currentPrice = latestPrice ? Number(latestPrice.close) : 0;

        // Build statement map for Seessel BMP fields
        const stmtByYear = new Map(stmtRecords.map((s) => [s.fiscalYear, s]));

        const computeCagr3y = (fiscalYear: number): number | null => {
          const cur = stmtByYear.get(fiscalYear);
          const past = stmtByYear.get(fiscalYear - 3);
          if (!cur?.revenue || !past?.revenue) return null;
          const revCurr = Number(cur.revenue);
          const revPast = Number(past.revenue);
          if (revPast <= 0 || revCurr <= 0) return null;
          return Math.pow(revCurr / revPast, 1 / 3) - 1;
        };

        const computeDilution = (fiscalYear: number): number | null => {
          const cur = stmtByYear.get(fiscalYear);
          const prev = stmtByYear.get(fiscalYear - 1);
          if (!cur?.sharesOutstandingDiluted || !prev?.sharesOutstandingDiluted) return null;
          const sharesCurr = Number(cur.sharesOutstandingDiluted);
          const sharesPrev = Number(prev.sharesOutstandingDiluted);
          if (sharesPrev <= 0) return null;
          return (sharesCurr - sharesPrev) / sharesPrev;
        };

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

        const currentMetrics = unifiedMetrics[0];
        const historicalMetrics = unifiedMetrics.slice(1);

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

        results.recommendation = {
          success: true,
          rating: recommendation.rating,
          error: null,
        };
      } catch (recError) {
        console.error('Recommendation generation error:', recError);
        results.recommendation.error = String(recError);
      }
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { lastRefreshedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      results,
      warnings: financialsResult.warnings,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh company data' },
      { status: 500 }
    );
  }
}

// Also support GET for simple refresh link
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const result = await POST(request, context);
  return result;
}
