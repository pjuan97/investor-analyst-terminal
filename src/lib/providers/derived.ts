import { FinancialStatementData } from '@/types';

/**
 * Fill derived/calculated fields when source data is missing but
 * the components needed for calculation are available.
 */
export function fillDerivedFields(
  statement: FinancialStatementData
): FinancialStatementData {
  const s = { ...statement };

  // 1. grossProfit = revenue - abs(costOfRevenue)
  // Some providers report costOfRevenue as negative (expense convention)
  if (s.grossProfit == null && s.revenue != null && s.costOfRevenue != null) {
    s.grossProfit = s.revenue - Math.abs(s.costOfRevenue);
  }

  // Sanity check: if grossProfit is negative but revenue is positive, recalculate
  if (s.grossProfit != null && s.grossProfit < 0 &&
      s.revenue != null && s.revenue > 0 &&
      s.costOfRevenue != null) {
    s.grossProfit = s.revenue - Math.abs(s.costOfRevenue);
  }

  // 2. operatingIncome = grossProfit - abs(operatingExpenses)
  // Same sign convention issue applies to operatingExpenses
  if (s.operatingIncome == null && s.grossProfit != null && s.operatingExpenses != null) {
    s.operatingIncome = s.grossProfit - Math.abs(s.operatingExpenses);
  }

  // 3. operatingExpenses = grossProfit - operatingIncome
  if (s.operatingExpenses == null && s.grossProfit != null && s.operatingIncome != null) {
    s.operatingExpenses = s.grossProfit - s.operatingIncome;
  }

  // 4. freeCashFlow = operatingCashFlow - abs(capitalExpenditure)
  if (s.freeCashFlow == null && s.operatingCashFlow != null && s.capitalExpenditure != null) {
    s.freeCashFlow = s.operatingCashFlow - Math.abs(s.capitalExpenditure);
  }

  // 5. totalDebt = shortTermDebt + longTermDebt
  if (s.totalDebt == null && s.shortTermDebt != null && s.longTermDebt != null) {
    s.totalDebt = s.shortTermDebt + s.longTermDebt;
  }

  // 6. totalLiabilities = totalAssets - totalEquity
  if (s.totalLiabilities == null && s.totalAssets != null && s.totalEquity != null) {
    s.totalLiabilities = s.totalAssets - s.totalEquity;
  }

  // 7. netIncome — intentionally NOT derived (non-operating items can be significant)

  // ========================================================================
  // SANITY CHECKS — null out impossible values rather than show wrong data
  // ========================================================================

  // If grossProfit is still negative after all fixes, the underlying
  // revenue data is unreliable (e.g. SEC XBRL picked a partial revenue tag)
  if (s.grossProfit != null && s.grossProfit < 0) {
    s.grossProfit = null;
  }

  // Sanity check: operatingExpenses should always be positive
  if (s.operatingExpenses != null && s.operatingExpenses < 0) {
    s.operatingExpenses = Math.abs(s.operatingExpenses);
  }

  // If operatingExpenses exceeds grossProfit, the data is inconsistent
  if (s.operatingExpenses != null && s.operatingIncome != null &&
      s.grossProfit != null && s.operatingExpenses > s.grossProfit) {
    s.operatingExpenses = null;
  }

  // Recalculate missingFields
  const fields: Array<{ key: keyof FinancialStatementData; label: string }> = [
    { key: 'revenue', label: 'revenue' },
    { key: 'costOfRevenue', label: 'costOfRevenue' },
    { key: 'grossProfit', label: 'grossProfit' },
    { key: 'operatingExpenses', label: 'operatingExpenses' },
    { key: 'operatingIncome', label: 'operatingIncome' },
    { key: 'netIncome', label: 'netIncome' },
    { key: 'totalAssets', label: 'totalAssets' },
    { key: 'currentAssets', label: 'currentAssets' },
    { key: 'cash', label: 'cash' },
    { key: 'totalLiabilities', label: 'totalLiabilities' },
    { key: 'currentLiabilities', label: 'currentLiabilities' },
    { key: 'totalEquity', label: 'totalEquity' },
    { key: 'operatingCashFlow', label: 'operatingCashFlow' },
    { key: 'capitalExpenditure', label: 'capitalExpenditure' },
    { key: 'freeCashFlow', label: 'freeCashFlow' },
    { key: 'totalDebt', label: 'totalDebt' },
  ];

  s.missingFields = fields
    .filter((f) => s[f.key] == null)
    .map((f) => f.label);

  // Recalculate dataQuality
  if (s.missingFields.length === 0) {
    s.dataQuality = 'complete';
  } else if (s.missingFields.length <= 5) {
    s.dataQuality = 'partial';
  } else {
    s.dataQuality = 'estimated';
  }

  return s;
}
