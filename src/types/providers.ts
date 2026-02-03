import {
  CompanyInfo,
  FinancialStatementData,
  PriceData,
  ProviderResponse,
} from './index';

// ============================================================================
// PROVIDER INTERFACES
// ============================================================================

/**
 * Base interface for all data providers
 */
export interface DataProvider {
  readonly name: string;
  readonly isAvailable: boolean;

  /**
   * Check if the provider is properly configured and accessible
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Provider that can fetch company information
 */
export interface CompanyInfoProvider extends DataProvider {
  /**
   * Get basic company information by ticker
   */
  getCompanyInfo(ticker: string): Promise<ProviderResponse<CompanyInfo>>;

  /**
   * Search for companies by name or ticker
   */
  searchCompanies?(query: string): Promise<ProviderResponse<CompanyInfo[]>>;

  /**
   * Resolve ticker to CIK (SEC identifier)
   */
  resolveCik?(ticker: string): Promise<ProviderResponse<string>>;
}

/**
 * Provider that can fetch financial statements
 */
export interface FinancialDataProvider extends DataProvider {
  /**
   * Get annual financial statements
   * @param ticker Stock ticker
   * @param years Number of years to fetch (default: 10)
   */
  getAnnualFinancials(
    ticker: string,
    years?: number
  ): Promise<ProviderResponse<FinancialStatementData[]>>;

  /**
   * Get quarterly financial statements (optional)
   */
  getQuarterlyFinancials?(
    ticker: string,
    quarters?: number
  ): Promise<ProviderResponse<FinancialStatementData[]>>;
}

/**
 * Provider that can fetch price data
 */
export interface PriceDataProvider extends DataProvider {
  /**
   * Get daily historical prices
   * @param ticker Stock ticker
   * @param startDate Start date for historical data
   * @param endDate End date (default: today)
   */
  getDailyPrices(
    ticker: string,
    startDate: Date,
    endDate?: Date
  ): Promise<ProviderResponse<PriceData[]>>;

  /**
   * Get the latest price
   */
  getLatestPrice(ticker: string): Promise<ProviderResponse<PriceData>>;
}

// ============================================================================
// SEC EDGAR SPECIFIC TYPES
// ============================================================================

export interface SecSubmissionsResponse {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

export interface SecCompanyFactsResponse {
  cik: number;
  entityName: string;
  facts: {
    'us-gaap'?: Record<string, SecFactItem>;
    'dei'?: Record<string, SecFactItem>;
    [namespace: string]: Record<string, SecFactItem> | undefined;
  };
}

export interface SecFactItem {
  label: string;
  description: string;
  units: {
    [unit: string]: SecFactValue[];
  };
}

export interface SecFactValue {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string; // "FY", "Q1", "Q2", "Q3", "Q4"
  form: string;
  filed: string;
  frame?: string;
}

// ============================================================================
// FMP SPECIFIC TYPES (for future implementation)
// ============================================================================

export interface FmpIncomeStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  operatingExpenses: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  interestExpense: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsDiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
}

export interface FmpBalanceSheet {
  date: string;
  symbol: string;
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

export interface FmpCashFlowStatement {
  date: string;
  symbol: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  dividendsPaid: number;
  commonStockRepurchased: number;
}

export interface FmpHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

// ============================================================================
// PROVIDER FACTORY TYPES
// ============================================================================

export interface ProviderConfig {
  sec: {
    userAgent: string;
    rateLimit: number; // requests per second
    cacheTtl: number; // seconds
  };
  fmp?: {
    apiKey: string;
    rateLimit: number;
  };
  prices: {
    provider: 'fmp' | 'stooq' | 'alpha_vantage';
    apiKey?: string;
    rateLimit: number;
  };
}

export type ProviderType = 'sec' | 'fmp' | 'stooq' | 'alpha_vantage';
