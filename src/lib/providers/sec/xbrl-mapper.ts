import { FinancialStatementData } from '@/types';
import { SecCompanyFactsResponse, SecFactValue } from '@/types/providers';
import { fillDerivedFields } from '../derived';

// ============================================================================
// XBRL TAG MAPPING
// ============================================================================

/**
 * Mapping from our normalized field names to possible XBRL US-GAAP tags.
 * Multiple tags are listed in priority order (first found wins).
 */
export const XBRL_TAG_MAPPING: Record<string, string[]> = {
  // Income Statement
  revenue: [
    'Revenues',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'TotalRevenues',
    'SalesRevenueGoodsNet',
    'SalesRevenueServicesNet',
    'TotalRevenuesAndOtherIncome',
    'NetSales',
  ],
  costOfRevenue: [
    'CostOfRevenue',
    'CostOfGoodsAndServicesSold',
    'CostOfGoodsSold',
    'CostOfServices',
  ],
  grossProfit: ['GrossProfit'],
  operatingExpenses: [
    'OperatingExpenses',
    'CostsAndExpenses',
    'OperatingCostsAndExpenses',
  ],
  operatingIncome: [
    'OperatingIncomeLoss',
    'IncomeLossFromOperations',
  ],
  interestExpense: [
    'InterestExpense',
    'InterestAndDebtExpense',
    'InterestExpenseDebt',
  ],
  netIncome: [
    'NetIncomeLoss',
    'ProfitLoss',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
  ],

  // Per Share
  sharesOutstanding: [
    'CommonStockSharesOutstanding',
    'WeightedAverageNumberOfSharesOutstandingBasic',
  ],
  sharesOutstandingDiluted: [
    'WeightedAverageNumberOfDilutedSharesOutstanding',
  ],
  eps: ['EarningsPerShareBasic', 'BasicEarningsLossPerShare'],
  epsDiluted: ['EarningsPerShareDiluted', 'DilutedEarningsLossPerShare'],
  dividendPerShare: [
    'CommonStockDividendsPerShareDeclared',
    'CommonStockDividendsPerShareCashPaid',
  ],

  // Balance Sheet - Assets
  totalAssets: ['Assets'],
  currentAssets: ['AssetsCurrent'],
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'Cash',
    'CashCashEquivalentsAndShortTermInvestments',
  ],
  shortTermInvestments: [
    'ShortTermInvestments',
    'MarketableSecuritiesCurrent',
    'AvailableForSaleSecuritiesCurrent',
  ],
  receivables: [
    'AccountsReceivableNetCurrent',
    'ReceivablesNetCurrent',
    'AccountsReceivableNet',
  ],
  inventory: [
    'InventoryNet',
    'InventoryFinishedGoodsNetOfReserves',
  ],
  propertyPlantEquipment: [
    'PropertyPlantAndEquipmentNet',
    'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization',
  ],
  goodwill: ['Goodwill'],
  intangibleAssets: [
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
  ],

  // Balance Sheet - Liabilities
  totalLiabilities: ['Liabilities', 'LiabilitiesAndStockholdersEquity'],
  currentLiabilities: ['LiabilitiesCurrent'],
  accountsPayable: ['AccountsPayableCurrent', 'AccountsPayableAndAccruedLiabilitiesCurrent'],
  shortTermDebt: [
    'ShortTermBorrowings',
    'DebtCurrent',
    'LongTermDebtCurrent',
  ],
  longTermDebt: [
    'LongTermDebtNoncurrent',
    'LongTermDebt',
    'LongTermDebtAndCapitalLeaseObligations',
  ],
  totalDebt: [
    'DebtAndCapitalLeaseObligations',
    'LongTermDebtAndCapitalLeaseObligations',
  ],

  // Balance Sheet - Equity
  totalEquity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  retainedEarnings: ['RetainedEarningsAccumulatedDeficit'],

  // Cash Flow Statement
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  capitalExpenditure: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
    'CapitalExpendituresIncurredButNotYetPaid',
  ],
  dividendsPaid: [
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfDividends',
    'DividendsCash',
  ],
  shareRepurchases: [
    'PaymentsForRepurchaseOfCommonStock',
    'StockRepurchasedAndRetiredDuringPeriodValue',
  ],

  // Additional detail
  researchAndDevelopment: [
    'ResearchAndDevelopmentExpense',
    'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
  ],
  sellingGeneralAdmin: [
    'SellingGeneralAndAdministrativeExpense',
    'GeneralAndAdministrativeExpense',
  ],
  stockBasedCompensation: [
    'ShareBasedCompensation',
    'AllocatedShareBasedCompensationExpense',
  ],
};

// ============================================================================
// MAPPER LOGIC
// ============================================================================

interface MappingResult {
  financials: FinancialStatementData[];
  warnings: string[];
  unmappedTags: string[];
}

export function mapXbrlToFinancials(
  facts: SecCompanyFactsResponse,
  maxYears: number = 10
): MappingResult {
  const warnings: string[] = [];
  const unmappedTags: string[] = [];
  const financialsByYear = new Map<number, Partial<FinancialStatementData>>();

  const usGaap = facts.facts['us-gaap'];
  if (!usGaap) {
    warnings.push('No us-gaap facts found in SEC data');
    return { financials: [], warnings, unmappedTags };
  }

  // Get available fiscal years from the data
  const availableYears = new Set<number>();
  for (const tagData of Object.values(usGaap)) {
    for (const unitValues of Object.values(tagData.units)) {
      for (const value of unitValues) {
        if (value.fp === 'FY' && value.form === '10-K') {
          availableYears.add(value.fy);
        }
      }
    }
  }

  // Sort years descending and take most recent N
  const sortedYears = Array.from(availableYears)
    .sort((a, b) => b - a)
    .slice(0, maxYears);

  // Initialize financial data for each year
  for (const year of sortedYears) {
    financialsByYear.set(year, {
      fiscalYear: year,
      periodEnd: new Date(`${year}-12-31`), // Will be updated if we find actual date
      dataSource: 'sec_xbrl',
      dataQuality: 'partial',
      missingFields: [],
    });
  }

  // Track which of our fields were found
  const foundFields = new Set<string>();

  // Fields that represent costs/expenses and must always be stored as positive values.
  // SEC XBRL sometimes reports these with inconsistent signs.
  const ALWAYS_POSITIVE_FIELDS = new Set([
    'costOfRevenue',
    'operatingExpenses',
    'capitalExpenditure',
    'interestExpense',
    'dividendsPaid',
    'shareRepurchases',
  ]);

  // Map each of our normalized fields
  for (const [fieldName, possibleTags] of Object.entries(XBRL_TAG_MAPPING)) {
    let tagFound = false;

    for (const tag of possibleTags) {
      const tagData = usGaap[tag];
      if (!tagData) continue;

      tagFound = true;

      // Get USD values (most common unit for financial data)
      const usdValues = tagData.units['USD'] || tagData.units['USD/shares'] || [];

      for (const value of usdValues) {
        // Only use annual (10-K) filings with FY period
        if (value.fp !== 'FY' || value.form !== '10-K') continue;

        const year = value.fy;
        if (!financialsByYear.has(year)) continue;

        // Verify the period end date matches the fiscal year
        // This filters out historical comparison data reported in newer 10-Ks
        if (value.end) {
          const endYear = new Date(value.end).getFullYear();
          // Allow for fiscal years that end in different calendar years (e.g., Apple's Sep year-end)
          // The end date year should be the same as fiscal year or fiscal year - 1
          if (endYear !== year && endYear !== year - 1) continue;
        }

        const yearData = financialsByYear.get(year)!;

        // Only set if not already set (first matching tag wins)
        if ((yearData as Record<string, unknown>)[fieldName] === undefined) {
          const normalizedVal = ALWAYS_POSITIVE_FIELDS.has(fieldName)
            ? Math.abs(value.val)
            : value.val;
          (yearData as Record<string, unknown>)[fieldName] = normalizedVal;
          foundFields.add(fieldName);

          // Update period end date if available
          if (value.end) {
            yearData.periodEnd = new Date(value.end);
          }
        }
      }

      // Also check for share count in 'shares' unit
      if (fieldName.includes('shares') || fieldName.includes('Shares')) {
        const shareValues = tagData.units['shares'] || [];
        for (const value of shareValues) {
          if (value.fp !== 'FY' || value.form !== '10-K') continue;

          const year = value.fy;
          if (!financialsByYear.has(year)) continue;

          const yearData = financialsByYear.get(year)!;
          if ((yearData as Record<string, unknown>)[fieldName] === undefined) {
            (yearData as Record<string, unknown>)[fieldName] = value.val;
            foundFields.add(fieldName);
          }
        }
      }

      break; // Stop searching alternative tags once we found one
    }

    if (!tagFound) {
      unmappedTags.push(fieldName);
    }
  }

  // Calculate derived fields
  for (const yearData of financialsByYear.values()) {
    // Calculate Free Cash Flow if we have the components
    if (
      yearData.operatingCashFlow != null &&
      yearData.capitalExpenditure != null &&
      yearData.freeCashFlow == null
    ) {
      // CapEx is usually reported as positive, but should be subtracted
      yearData.freeCashFlow =
        Number(yearData.operatingCashFlow) - Math.abs(Number(yearData.capitalExpenditure));
    }

    // Calculate total debt if not available
    if (yearData.totalDebt == null) {
      const shortTerm = Number(yearData.shortTermDebt || 0);
      const longTerm = Number(yearData.longTermDebt || 0);
      if (shortTerm > 0 || longTerm > 0) {
        yearData.totalDebt = shortTerm + longTerm;
      }
    }

    // Determine missing fields
    const allFields = Object.keys(XBRL_TAG_MAPPING);
    yearData.missingFields = allFields.filter(
      (f) => (yearData as Record<string, unknown>)[f] == null
    );

    // Set data quality based on completeness
    const completeness =
      (allFields.length - yearData.missingFields.length) / allFields.length;
    if (completeness >= 0.8) {
      yearData.dataQuality = 'complete';
    } else if (completeness >= 0.5) {
      yearData.dataQuality = 'partial';
    } else {
      yearData.dataQuality = 'estimated';
    }
  }

  // Generate warnings
  if (unmappedTags.length > 0) {
    warnings.push(
      `Could not find XBRL tags for: ${unmappedTags.slice(0, 5).join(', ')}${unmappedTags.length > 5 ? ` and ${unmappedTags.length - 5} more` : ''}`
    );
  }

  const avgMissing =
    Array.from(financialsByYear.values()).reduce(
      (sum, y) => sum + y.missingFields!.length,
      0
    ) / financialsByYear.size;

  if (avgMissing > 10) {
    warnings.push(
      `High number of missing fields (avg ${avgMissing.toFixed(1)} per year). Consider using FMP provider for better data quality.`
    );
  }

  // Convert to array, apply derived fields, and sort by year descending
  const financials = Array.from(financialsByYear.values())
    .map((yearData) => fillDerivedFields(yearData as FinancialStatementData))
    .sort((a, b) => b.fiscalYear - a.fiscalYear);

  return { financials, warnings, unmappedTags };
}

/**
 * Get a specific fact value from SEC XBRL data
 */
export function getFactValue(
  facts: SecCompanyFactsResponse,
  tags: string[],
  fiscalYear: number,
  unit: string = 'USD'
): number | null {
  const usGaap = facts.facts['us-gaap'];
  if (!usGaap) return null;

  for (const tag of tags) {
    const tagData = usGaap[tag];
    if (!tagData) continue;

    const values = tagData.units[unit] || [];
    const match = values.find(
      (v) => v.fy === fiscalYear && v.fp === 'FY' && v.form === '10-K'
    );

    if (match) return match.val;
  }

  return null;
}
