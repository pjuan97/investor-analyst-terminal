// ============================================================================
// CORE TYPES
// ============================================================================

export type Rating = 'BUY' | 'HOLD' | 'SELL';

export interface Company {
  id: string;
  ticker: string;
  cik: string | null;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
}

// ============================================================================
// FINANCIAL DATA TYPES
// ============================================================================

export interface FinancialStatementData {
  fiscalYear: number;
  periodEnd: Date;

  // Income Statement
  revenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  operatingIncome: number | null;
  interestExpense: number | null;
  netIncome: number | null;

  // Per Share
  sharesOutstanding: number | null;
  sharesOutstandingDiluted: number | null;
  eps: number | null;
  epsDiluted: number | null;
  dividendPerShare: number | null;

  // Balance Sheet - Assets
  totalAssets: number | null;
  currentAssets: number | null;
  cash: number | null;
  shortTermInvestments: number | null;
  receivables: number | null;
  inventory: number | null;
  propertyPlantEquipment: number | null;
  goodwill: number | null;
  intangibleAssets: number | null;

  // Balance Sheet - Liabilities
  totalLiabilities: number | null;
  currentLiabilities: number | null;
  accountsPayable: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  totalDebt: number | null;

  // Balance Sheet - Equity
  totalEquity: number | null;
  retainedEarnings: number | null;

  // Income Statement — additional detail
  researchAndDevelopment: number | null;
  sellingGeneralAdmin: number | null;

  // Cash Flow Statement
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  dividendsPaid: number | null;
  shareRepurchases: number | null;
  stockBasedCompensation: number | null;

  // Metadata
  dataSource: string;
  dataQuality: 'complete' | 'partial' | 'estimated';
  missingFields: string[];
  unmappedTags?: Record<string, unknown>;
}

export interface PriceData {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  adjClose: number | null;
  volume: number | null;
}

// ============================================================================
// METRICS TYPES
// ============================================================================

export interface CalculatedMetrics {
  fiscalYear: number;

  // Profitability
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;

  // Returns
  roe: number | null;
  roa: number | null;
  roic: number | null;
  roce: number | null;

  // Cash Flow
  fcfMargin: number | null;
  fcfYield: number | null;
  fcfPerShare: number | null;

  // Leverage
  debtToEquity: number | null;
  debtToEbitda: number | null;
  debtToFcf: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;

  // Valuation
  marketCap: number | null;
  enterpriseValue: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evToEbitda: number | null;
  evToFcf: number | null;
  earningsYield: number | null;
  fcfYieldOnEv: number | null;

  // Growth
  revenueGrowth: number | null;
  epsGrowth: number | null;
  fcfGrowth: number | null;

  // Greenblatt
  earningsYieldMF: number | null;
  returnOnCapitalMF: number | null;

  // Quality
  qualityScore: number | null;
  dataCompleteness: number;
}

// ============================================================================
// MODEL TYPES
// ============================================================================

export interface ModelVote {
  rating: Rating;
  confidence: number; // 0-1
  reasons: string[];
  keyMetrics: Record<string, number | null>;
}

export interface ModelVotes {
  buffett?: ModelVote;
  greenblatt?: ModelVote;
  growth?: ModelVote; // Fisher growth model
  lynch?: ModelVote; // Lynch GARP model
  [key: string]: ModelVote | undefined;
}

export interface Recommendation {
  rating: Rating;
  confidence: number;
  modelVotes: ModelVotes;
  explanationShort: string;
  explanationFull: string;
  triggers: string[];
  priceAtRec: number;
  metricsYear: number;
}

// ============================================================================
// PROVIDER RESPONSE TYPES
// ============================================================================

export interface ProviderResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  warnings?: string[];
  rawDocument?: {
    url: string;
    payload: unknown;
  };
}

export interface CompanyInfo {
  ticker: string;
  cik: string | null;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
}
