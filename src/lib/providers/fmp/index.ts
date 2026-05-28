import { FinancialDataProvider } from '@/types/providers';
import { FinancialStatementData, ProviderResponse } from '@/types';
import {
  RateLimiter,
  withRetry,
  createErrorResponse,
  createSuccessResponse,
} from '../base';
import { fillDerivedFields } from '../derived';

// ============================================================================
// FMP STABLE API TYPES (current endpoints, post Aug 2025)
// ============================================================================

interface FmpStableIncomeStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fiscalYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  interestExpense: number;
  netIncome: number;
  eps: number;
  epsDiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
  researchAndDevelopmentExpenses?: number;
  sellingGeneralAndAdministrativeExpenses?: number;
}

interface FmpStableBalanceSheet {
  date: string;
  symbol: string;
  fiscalYear: string;
  totalAssets: number;
  totalCurrentAssets: number;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  propertyPlantEquipmentNet: number;
  goodwill: number;
  intangibleAssets: number;
  totalLiabilities: number;
  totalCurrentLiabilities: number;
  accountPayables: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalDebt: number;
  totalStockholdersEquity: number;
  retainedEarnings: number;
}

interface FmpStableCashFlow {
  date: string;
  symbol: string;
  fiscalYear: string;
  netCashProvidedByOperatingActivities: number;
  investmentsInPropertyPlantAndEquipment: number;
  commonStockRepurchased: number;
  commonDividendsPaid: number;
  freeCashFlow?: number;
  stockBasedCompensation?: number;
}

// ============================================================================
// FMP PROVIDER
// ============================================================================

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

export class FmpProvider implements FinancialDataProvider {
  readonly name = 'fmp';
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter(5);
  }

  get isAvailable(): boolean {
    return !!this.apiKey;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${FMP_BASE_URL}/profile?symbol=AAPL&apikey=${this.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAnnualFinancials(
    ticker: string,
    years: number = 5
  ): Promise<ProviderResponse<FinancialStatementData[]>> {
    try {
      const [incomeStatements, balanceSheets, cashFlows] = await Promise.all([
        this.fetchIncomeStatements(ticker, years),
        this.fetchBalanceSheets(ticker, years),
        this.fetchCashFlows(ticker, years),
      ]);

      if (!incomeStatements.length) {
        return createErrorResponse(
          new Error(`No income statement data found for ${ticker}`)
        );
      }

      const statements = this.combineStatements(
        incomeStatements,
        balanceSheets,
        cashFlows
      );

      const rawUrl = `${FMP_BASE_URL}/income-statement?symbol=${ticker}&period=annual&limit=${years}&apikey=***`;

      return createSuccessResponse(statements, {
        url: rawUrl,
        payload: { incomeStatements, balanceSheets, cashFlows },
      });
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  // --------------------------------------------------------------------------
  // COMPANY PROFILE
  // --------------------------------------------------------------------------

  async fetchCompanyProfile(ticker: string): Promise<{
    description: string | null;
    industry: string | null;
    website: string | null;
    ceo: string | null;
    employees: number | null;
    ipoDate: string | null;
    logoUrl: string | null;
    country: string | null;
  } | null> {
    const url = `${FMP_BASE_URL}/profile?symbol=${ticker}&apikey=${this.apiKey}`;
    const data = await this.fetchWithRetry<Record<string, unknown>[]>(url);

    if (!Array.isArray(data) || data.length === 0) return null;

    const p = data[0];
    return {
      description: (p.description as string) || null,
      industry: (p.industry as string) || null,
      website: (p.website as string) || null,
      ceo: (p.ceo as string) || null,
      employees: typeof p.fullTimeEmployees === 'number'
        ? p.fullTimeEmployees
        : p.fullTimeEmployees
          ? parseInt(String(p.fullTimeEmployees), 10) || null
          : null,
      ipoDate: (p.ipoDate as string) || null,
      logoUrl: (p.image as string) || null,
      country: (p.country as string) || null,
    };
  }

  // --------------------------------------------------------------------------
  // PRIVATE FETCH METHODS
  // --------------------------------------------------------------------------

  private async fetchIncomeStatements(
    ticker: string,
    limit: number
  ): Promise<FmpStableIncomeStatement[]> {
    const url = `${FMP_BASE_URL}/income-statement?symbol=${ticker}&period=annual&limit=${limit}&apikey=${this.apiKey}`;
    return this.fetchWithRetry<FmpStableIncomeStatement[]>(url);
  }

  private async fetchBalanceSheets(
    ticker: string,
    limit: number
  ): Promise<FmpStableBalanceSheet[]> {
    const url = `${FMP_BASE_URL}/balance-sheet-statement?symbol=${ticker}&period=annual&limit=${limit}&apikey=${this.apiKey}`;
    return this.fetchWithRetry<FmpStableBalanceSheet[]>(url);
  }

  private async fetchCashFlows(
    ticker: string,
    limit: number
  ): Promise<FmpStableCashFlow[]> {
    const url = `${FMP_BASE_URL}/cash-flow-statement?symbol=${ticker}&period=annual&limit=${limit}&apikey=${this.apiKey}`;
    return this.fetchWithRetry<FmpStableCashFlow[]>(url);
  }

  private async fetchWithRetry<T>(url: string): Promise<T> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();

      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // FMP returns an error message object when something goes wrong
      if (data && typeof data === 'object' && !Array.isArray(data) && 'Error Message' in data) {
        throw new Error(`FMP API: ${(data as Record<string, string>)['Error Message']}`);
      }

      return data as T;
    });
  }

  // --------------------------------------------------------------------------
  // DATA MAPPING
  // --------------------------------------------------------------------------

  private combineStatements(
    incomeStatements: FmpStableIncomeStatement[],
    balanceSheets: FmpStableBalanceSheet[],
    cashFlows: FmpStableCashFlow[]
  ): FinancialStatementData[] {
    const balanceByDate = new Map<string, FmpStableBalanceSheet>();
    for (const bs of balanceSheets) {
      balanceByDate.set(bs.date, bs);
    }

    const cashFlowByDate = new Map<string, FmpStableCashFlow>();
    for (const cf of cashFlows) {
      cashFlowByDate.set(cf.date, cf);
    }

    return incomeStatements.map((income) => {
      const balance = balanceByDate.get(income.date) || null;
      const cashFlow = cashFlowByDate.get(income.date) || null;

      return fillDerivedFields(this.mapToFinancialStatement(income, balance, cashFlow));
    });
  }

  private mapToFinancialStatement(
    income: FmpStableIncomeStatement,
    balance: FmpStableBalanceSheet | null,
    cashFlow: FmpStableCashFlow | null
  ): FinancialStatementData {
    const missingFields: string[] = [];

    if (!balance) {
      missingFields.push(
        'totalAssets', 'currentAssets', 'cash', 'totalLiabilities',
        'currentLiabilities', 'totalEquity'
      );
    }

    if (!cashFlow) {
      missingFields.push('operatingCashFlow', 'capitalExpenditure', 'freeCashFlow');
    }

    // Calculate free cash flow
    let freeCashFlow: number | null = null;
    if (cashFlow) {
      const opCashFlow = cashFlow.netCashProvidedByOperatingActivities;
      const capex = cashFlow.investmentsInPropertyPlantAndEquipment;
      if (opCashFlow != null && capex != null) {
        freeCashFlow = opCashFlow - Math.abs(capex);
      }
    }

    const fiscalYear = parseInt(income.fiscalYear, 10);

    const statement: FinancialStatementData = {
      fiscalYear,
      periodEnd: new Date(income.date),

      // Income Statement
      revenue: income.revenue ?? null,
      costOfRevenue: income.costOfRevenue ?? null,
      grossProfit: income.grossProfit ?? null,
      operatingExpenses: income.operatingExpenses ?? null,
      operatingIncome: income.operatingIncome ?? null,
      interestExpense: income.interestExpense ?? null,
      netIncome: income.netIncome ?? null,
      researchAndDevelopment: income.researchAndDevelopmentExpenses ?? null,
      sellingGeneralAdmin: income.sellingGeneralAndAdministrativeExpenses ?? null,

      // Per Share
      sharesOutstanding: income.weightedAverageShsOut ?? null,
      sharesOutstandingDiluted: income.weightedAverageShsOutDil ?? null,
      eps: income.eps ?? null,
      epsDiluted: income.epsDiluted ?? null,
      dividendPerShare: null,

      // Balance Sheet - Assets
      totalAssets: balance?.totalAssets ?? null,
      currentAssets: balance?.totalCurrentAssets ?? null,
      cash: balance?.cashAndCashEquivalents ?? null,
      shortTermInvestments: balance?.shortTermInvestments ?? null,
      receivables: balance?.netReceivables ?? null,
      inventory: balance?.inventory ?? null,
      propertyPlantEquipment: balance?.propertyPlantEquipmentNet ?? null,
      goodwill: balance?.goodwill ?? null,
      intangibleAssets: balance?.intangibleAssets ?? null,

      // Balance Sheet - Liabilities
      totalLiabilities: balance?.totalLiabilities ?? null,
      currentLiabilities: balance?.totalCurrentLiabilities ?? null,
      accountsPayable: balance?.accountPayables ?? null,
      shortTermDebt: balance?.shortTermDebt ?? null,
      longTermDebt: balance?.longTermDebt ?? null,
      totalDebt: balance?.totalDebt ?? null,

      // Balance Sheet - Equity
      totalEquity: balance?.totalStockholdersEquity ?? null,
      retainedEarnings: balance?.retainedEarnings ?? null,

      // Cash Flow
      operatingCashFlow: cashFlow?.netCashProvidedByOperatingActivities ?? null,
      capitalExpenditure: cashFlow?.investmentsInPropertyPlantAndEquipment ?? null,
      freeCashFlow,
      dividendsPaid: cashFlow?.commonDividendsPaid ?? null,
      shareRepurchases: cashFlow?.commonStockRepurchased ?? null,
      stockBasedCompensation: cashFlow?.stockBasedCompensation ?? null,

      // Metadata
      dataSource: 'fmp',
      dataQuality: missingFields.length === 0 ? 'complete' : 'partial',
      missingFields,
    };

    return statement;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let fmpInstance: FmpProvider | null = null;

export function getFmpProvider(): FmpProvider | null {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  if (!fmpInstance) {
    fmpInstance = new FmpProvider(apiKey);
  }
  return fmpInstance;
}
