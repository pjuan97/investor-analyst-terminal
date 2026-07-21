import { FinancialStatementData, ProviderResponse } from '@/types';
import { FinancialDataProvider } from '@/types/providers';
import {
  RateLimiter,
  withRetry,
  createErrorResponse,
  createSuccessResponse,
  globalCache,
} from '../base';
import { fillDerivedFields } from '../derived';
import YahooFinance from 'yahoo-finance2';

// ============================================================================
// YAHOO FINANCE FUNDAMENTALS PROVIDER (FREE, NO API KEY)
// ============================================================================

/**
 * Financial statements provider for tickers not covered by FMP/SEC
 * (e.g. non-US exchanges like the BVC, ticker suffix `.CL`).
 *
 * Uses Yahoo's `fundamentalsTimeSeries` endpoint — the classic
 * `quoteSummary` financial-statement submodules return almost no data
 * since Nov 2024, so this is the only reliable path for statements.
 */
export class YahooFinancialsProvider implements FinancialDataProvider {
  readonly name = 'yahoo_fundamentals';
  readonly isAvailable = true;

  private rateLimiter: RateLimiter;
  private cacheTtl: number;

  constructor(options?: { rateLimit?: number; cacheTtl?: number }) {
    this.rateLimiter = new RateLimiter(options?.rateLimit || 5);
    this.cacheTtl = options?.cacheTtl || 3600; // 1 hour
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.getAnnualFinancials('ECOPETROL.CL', 1);
      return result.success;
    } catch {
      return false;
    }
  }

  async getAnnualFinancials(
    ticker: string,
    years = 10
  ): Promise<ProviderResponse<FinancialStatementData[]>> {
    try {
      const cacheKey = `yahoo_financials_${ticker}_${years}`;
      const cached = globalCache.get<FinancialStatementData[]>(cacheKey);
      if (cached) {
        return createSuccessResponse(cached);
      }

      await this.rateLimiter.acquire();

      const period1 = new Date();
      period1.setFullYear(period1.getFullYear() - years);

      const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

      const [incomeRows, balanceRows, cashFlowRows] = await withRetry(() =>
        Promise.all([
          yahooFinance.fundamentalsTimeSeries(ticker, {
            period1,
            module: 'financials',
            type: 'annual',
          }),
          yahooFinance.fundamentalsTimeSeries(ticker, {
            period1,
            module: 'balance-sheet',
            type: 'annual',
          }),
          yahooFinance.fundamentalsTimeSeries(ticker, {
            period1,
            module: 'cash-flow',
            type: 'annual',
          }),
        ])
      ) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];

      if (incomeRows.length === 0) {
        return createErrorResponse(
          new Error(`No financial statement data found for ${ticker}`),
          ['Ticker may be invalid or not covered by Yahoo Finance fundamentals']
        );
      }

      const balanceByYear = new Map(
        balanceRows.map((row: Record<string, unknown>) => [yearOf(row), row])
      );
      const cashFlowByYear = new Map(
        cashFlowRows.map((row: Record<string, unknown>) => [yearOf(row), row])
      );

      const statements = incomeRows.map((income: Record<string, unknown>) => {
        const year = yearOf(income);
        const balance = balanceByYear.get(year) || {};
        const cashFlow = cashFlowByYear.get(year) || {};
        return mapToFinancialStatement(year, income, balance, cashFlow);
      });

      const withDerived = statements
        .map(fillDerivedFields)
        .sort((a, b) => b.fiscalYear - a.fiscalYear);

      globalCache.set(cacheKey, withDerived, this.cacheTtl);

      return createSuccessResponse(withDerived, {
        url: `https://finance.yahoo.com/quote/${ticker}/financials`,
        payload: { source: 'yahoo-finance2 fundamentalsTimeSeries', ticker },
      });
    } catch (error) {
      return createErrorResponse(error);
    }
  }
}

// ============================================================================
// FIELD MAPPING
// ============================================================================

function yearOf(row: Record<string, unknown>): number {
  const date = row.date;
  return date instanceof Date ? date.getFullYear() : new Date(String(date)).getFullYear();
}

function num(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

function mapToFinancialStatement(
  fiscalYear: number,
  income: Record<string, unknown>,
  balance: Record<string, unknown>,
  cashFlow: Record<string, unknown>
): FinancialStatementData {
  return {
    fiscalYear,
    periodEnd: income.date instanceof Date ? income.date : new Date(`${fiscalYear}-12-31`),

    // Income Statement
    revenue: num(income, 'totalRevenue'),
    costOfRevenue: num(income, 'costOfRevenue'),
    grossProfit: num(income, 'grossProfit'),
    operatingExpenses: null, // derived from grossProfit - operatingIncome
    operatingIncome: num(income, 'operatingIncome'),
    interestExpense: num(income, 'interestExpense'),
    netIncome: num(income, 'netIncomeCommonStockholders') ?? num(income, 'netIncome'),

    // Per Share
    sharesOutstanding: num(income, 'basicAverageShares'),
    sharesOutstandingDiluted: num(income, 'dilutedAverageShares'),
    eps: num(income, 'basicEPS'),
    epsDiluted: num(income, 'dilutedEPS'),
    dividendPerShare: null,

    // Balance Sheet - Assets
    totalAssets: num(balance, 'totalAssets'),
    currentAssets: num(balance, 'currentAssets'),
    cash: num(balance, 'cashAndCashEquivalents'),
    shortTermInvestments: num(balance, 'otherShortTermInvestments'),
    receivables: num(balance, 'accountsReceivable'),
    inventory: num(balance, 'inventory'),
    propertyPlantEquipment: num(balance, 'netPPE'),
    goodwill: num(balance, 'goodwill'),
    intangibleAssets: num(balance, 'otherIntangibleAssets'),

    // Balance Sheet - Liabilities
    totalLiabilities: num(balance, 'totalLiabilitiesNetMinorityInterest'),
    currentLiabilities: num(balance, 'currentLiabilities'),
    accountsPayable: num(balance, 'accountsPayable'),
    shortTermDebt: num(balance, 'currentDebt'),
    longTermDebt: num(balance, 'longTermDebt'),
    totalDebt: num(balance, 'totalDebt'),

    // Balance Sheet - Equity
    totalEquity: num(balance, 'stockholdersEquity'),
    retainedEarnings: num(balance, 'retainedEarnings'),

    // Income Statement — additional detail
    researchAndDevelopment: num(income, 'researchAndDevelopment'),
    sellingGeneralAdmin: num(income, 'sellingGeneralAndAdministration'),

    // Cash Flow Statement
    operatingCashFlow: num(cashFlow, 'operatingCashFlow'),
    capitalExpenditure: num(cashFlow, 'capitalExpenditure'),
    freeCashFlow: num(cashFlow, 'freeCashFlow'),
    dividendsPaid: num(cashFlow, 'cashDividendsPaid'),
    shareRepurchases: num(cashFlow, 'repurchaseOfCapitalStock'),
    stockBasedCompensation: num(cashFlow, 'stockBasedCompensation') ?? num(income, 'stockBasedCompensation'),

    // Metadata
    dataSource: 'yahoo_fundamentals',
    dataQuality: 'partial',
    missingFields: [],
  };
}

// Export singleton instance
let yahooFinancialsProvider: YahooFinancialsProvider | null = null;

export function getYahooFinancialsProvider(): YahooFinancialsProvider {
  if (!yahooFinancialsProvider) {
    yahooFinancialsProvider = new YahooFinancialsProvider();
  }
  return yahooFinancialsProvider;
}
