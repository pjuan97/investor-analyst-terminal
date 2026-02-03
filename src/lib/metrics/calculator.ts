import type { FinancialStatementAnnual, PriceDaily } from '@prisma/client';
import type { CalculatedMetrics } from '@/types';

/**
 * Calculate all financial metrics from financial statements and price data
 */
export function calculateMetrics(
  financials: FinancialStatementAnnual[],
  prices: PriceDaily[],
  previousYearFinancials?: FinancialStatementAnnual
): CalculatedMetrics | null {
  if (financials.length === 0) return null;

  const current = financials[0];
  const previous = previousYearFinancials || financials[1];
  const latestPrice = prices[0];

  // Extract values as numbers
  const revenue = toNumber(current.revenue);
  const grossProfit = toNumber(current.grossProfit);
  const operatingIncome = toNumber(current.operatingIncome);
  const netIncome = toNumber(current.netIncome);
  const totalAssets = toNumber(current.totalAssets);
  const totalEquity = toNumber(current.totalEquity);
  const totalLiabilities = toNumber(current.totalLiabilities);
  const totalDebt = toNumber(current.totalDebt);
  const cash = toNumber(current.cash);
  const operatingCashFlow = toNumber(current.operatingCashFlow);
  const capitalExpenditure = toNumber(current.capitalExpenditure);
  const freeCashFlow = toNumber(current.freeCashFlow) ||
    (operatingCashFlow && capitalExpenditure ? operatingCashFlow - Math.abs(capitalExpenditure) : null);
  const sharesOutstanding = toNumber(current.sharesOutstandingDiluted) || toNumber(current.sharesOutstanding);
  const eps = toNumber(current.epsDiluted) || toNumber(current.eps);
  const interestExpense = toNumber(current.interestExpense);
  const currentAssets = toNumber(current.currentAssets);
  const currentLiabilities = toNumber(current.currentLiabilities);
  const inventory = toNumber(current.inventory);
  const propertyPlantEquipment = toNumber(current.propertyPlantEquipment);

  // Price data
  const price = latestPrice ? toNumber(latestPrice.close) : null;

  // Previous year data for growth calculations
  const prevRevenue = previous ? toNumber(previous.revenue) : null;
  const prevEps = previous ? (toNumber(previous.epsDiluted) || toNumber(previous.eps)) : null;
  const prevFcf = previous ? toNumber(previous.freeCashFlow) : null;

  // ========== PROFITABILITY METRICS ==========
  const grossMargin = safeDivide(grossProfit, revenue);
  const operatingMargin = safeDivide(operatingIncome, revenue);
  const netMargin = safeDivide(netIncome, revenue);

  // ========== RETURN METRICS ==========
  // ROE = Net Income / Shareholders' Equity
  const roe = safeDivide(netIncome, totalEquity);

  // ROA = Net Income / Total Assets
  const roa = safeDivide(netIncome, totalAssets);

  // ROIC = NOPAT / Invested Capital
  // NOPAT = Operating Income * (1 - Tax Rate), assume 21% tax
  // Invested Capital = Total Equity + Total Debt - Cash
  const taxRate = 0.21;
  const nopat = operatingIncome ? operatingIncome * (1 - taxRate) : null;
  const investedCapital = totalEquity !== null && totalDebt !== null && cash !== null
    ? totalEquity + totalDebt - cash
    : null;
  const roic = safeDivide(nopat, investedCapital);

  // ROCE = EBIT / Capital Employed
  // Capital Employed = Total Assets - Current Liabilities
  const capitalEmployed = totalAssets !== null && currentLiabilities !== null
    ? totalAssets - currentLiabilities
    : null;
  const roce = safeDivide(operatingIncome, capitalEmployed);

  // ========== CASH FLOW METRICS ==========
  const fcfMargin = safeDivide(freeCashFlow, revenue);
  const fcfPerShare = safeDivide(freeCashFlow, sharesOutstanding);

  // ========== LEVERAGE METRICS ==========
  const debtToEquity = safeDivide(totalDebt, totalEquity);

  // EBITDA approximation: Operating Income + D&A (use 15% of PPE as rough D&A)
  const depreciationEstimate = propertyPlantEquipment ? propertyPlantEquipment * 0.15 : 0;
  const ebitda = operatingIncome ? operatingIncome + depreciationEstimate : null;
  const debtToEbitda = safeDivide(totalDebt, ebitda);

  const debtToFcf = freeCashFlow && freeCashFlow > 0
    ? safeDivide(totalDebt, freeCashFlow)
    : null;

  const currentRatio = safeDivide(currentAssets, currentLiabilities);

  // Quick Ratio = (Current Assets - Inventory) / Current Liabilities
  const quickAssets = currentAssets !== null && inventory !== null
    ? currentAssets - inventory
    : currentAssets;
  const quickRatio = safeDivide(quickAssets, currentLiabilities);

  const interestCoverage = safeDivide(operatingIncome, interestExpense);

  // ========== VALUATION METRICS (require price) ==========
  let marketCap: number | null = null;
  let enterpriseValue: number | null = null;
  let peRatio: number | null = null;
  let pbRatio: number | null = null;
  let psRatio: number | null = null;
  let evToEbitda: number | null = null;
  let evToFcf: number | null = null;
  let earningsYield: number | null = null;
  let fcfYield: number | null = null;
  let fcfYieldOnEv: number | null = null;

  if (price && sharesOutstanding) {
    marketCap = price * sharesOutstanding;

    // Enterprise Value = Market Cap + Total Debt - Cash
    enterpriseValue = totalDebt !== null && cash !== null
      ? marketCap + totalDebt - cash
      : marketCap;

    // P/E Ratio
    peRatio = eps && eps > 0 ? price / eps : null;

    // P/B Ratio
    const bookValuePerShare = safeDivide(totalEquity, sharesOutstanding);
    pbRatio = bookValuePerShare && bookValuePerShare > 0 ? price / bookValuePerShare : null;

    // P/S Ratio
    const revenuePerShare = safeDivide(revenue, sharesOutstanding);
    psRatio = revenuePerShare && revenuePerShare > 0 ? price / revenuePerShare : null;

    // EV/EBITDA
    evToEbitda = ebitda && ebitda > 0 ? safeDivide(enterpriseValue, ebitda) : null;

    // EV/FCF
    evToFcf = freeCashFlow && freeCashFlow > 0 ? safeDivide(enterpriseValue, freeCashFlow) : null;

    // Earnings Yield = EPS / Price (inverse of P/E)
    earningsYield = eps ? safeDivide(eps, price) : null;

    // FCF Yield = FCF per Share / Price
    fcfYield = fcfPerShare ? safeDivide(fcfPerShare, price) : null;

    // FCF Yield on EV = FCF / EV
    fcfYieldOnEv = freeCashFlow && enterpriseValue ? safeDivide(freeCashFlow, enterpriseValue) : null;
  }

  // ========== GROWTH METRICS ==========
  const revenueGrowth = prevRevenue && prevRevenue > 0 && revenue
    ? (revenue - prevRevenue) / prevRevenue
    : null;

  const epsGrowth = prevEps && prevEps > 0 && eps
    ? (eps - prevEps) / prevEps
    : null;

  const fcfGrowth = prevFcf && prevFcf > 0 && freeCashFlow
    ? (freeCashFlow - prevFcf) / prevFcf
    : null;

  // ========== GREENBLATT MAGIC FORMULA ==========
  // Earnings Yield (MF) = EBIT / Enterprise Value
  const earningsYieldMF = operatingIncome && enterpriseValue && enterpriseValue > 0
    ? operatingIncome / enterpriseValue
    : null;

  // Return on Capital (MF) = EBIT / (Net Working Capital + Net Fixed Assets)
  // Net Working Capital = Current Assets - Current Liabilities
  // Net Fixed Assets = PP&E
  const netWorkingCapital = currentAssets !== null && currentLiabilities !== null
    ? currentAssets - currentLiabilities
    : null;
  const tangibleCapital = netWorkingCapital !== null && propertyPlantEquipment !== null
    ? netWorkingCapital + propertyPlantEquipment
    : null;
  const returnOnCapitalMF = tangibleCapital && tangibleCapital > 0
    ? safeDivide(operatingIncome, tangibleCapital)
    : null;

  // ========== QUALITY SCORE ==========
  // Composite score based on multiple factors
  const qualityScore = calculateQualityScore({
    roe,
    roic,
    grossMargin,
    netMargin,
    debtToEquity,
    currentRatio,
    fcfMargin,
    revenueGrowth,
  });

  // ========== DATA COMPLETENESS ==========
  const allMetrics = [
    grossMargin, operatingMargin, netMargin, roe, roa, roic, roce,
    fcfMargin, fcfYield, debtToEquity, debtToEbitda, currentRatio,
    peRatio, pbRatio, evToEbitda, earningsYield, revenueGrowth, epsGrowth,
  ];
  const nonNullCount = allMetrics.filter((m) => m !== null).length;
  const dataCompleteness = nonNullCount / allMetrics.length;

  return {
    fiscalYear: current.fiscalYear,
    grossMargin,
    operatingMargin,
    netMargin,
    roe,
    roa,
    roic,
    roce,
    fcfMargin,
    fcfYield,
    fcfPerShare,
    debtToEquity,
    debtToEbitda,
    debtToFcf,
    currentRatio,
    interestCoverage,
    marketCap,
    enterpriseValue,
    peRatio,
    pbRatio,
    psRatio,
    evToEbitda,
    evToFcf,
    earningsYield,
    fcfYieldOnEv,
    revenueGrowth,
    epsGrowth,
    fcfGrowth,
    earningsYieldMF,
    returnOnCapitalMF,
    qualityScore,
    dataCompleteness,
  };
}

/**
 * Calculate quality score (0-1) based on financial health indicators
 */
function calculateQualityScore(metrics: {
  roe: number | null;
  roic: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  fcfMargin: number | null;
  revenueGrowth: number | null;
}): number | null {
  let score = 0;
  let factors = 0;

  // ROE > 15% is good
  if (metrics.roe !== null) {
    factors++;
    if (metrics.roe > 0.20) score += 1;
    else if (metrics.roe > 0.15) score += 0.75;
    else if (metrics.roe > 0.10) score += 0.5;
    else if (metrics.roe > 0.05) score += 0.25;
  }

  // ROIC > 15% is good
  if (metrics.roic !== null) {
    factors++;
    if (metrics.roic > 0.20) score += 1;
    else if (metrics.roic > 0.15) score += 0.75;
    else if (metrics.roic > 0.10) score += 0.5;
    else if (metrics.roic > 0.05) score += 0.25;
  }

  // Gross Margin > 40% is good
  if (metrics.grossMargin !== null) {
    factors++;
    if (metrics.grossMargin > 0.50) score += 1;
    else if (metrics.grossMargin > 0.40) score += 0.75;
    else if (metrics.grossMargin > 0.30) score += 0.5;
    else if (metrics.grossMargin > 0.20) score += 0.25;
  }

  // Net Margin > 10% is good
  if (metrics.netMargin !== null) {
    factors++;
    if (metrics.netMargin > 0.20) score += 1;
    else if (metrics.netMargin > 0.15) score += 0.75;
    else if (metrics.netMargin > 0.10) score += 0.5;
    else if (metrics.netMargin > 0.05) score += 0.25;
  }

  // Debt/Equity < 0.5 is good
  if (metrics.debtToEquity !== null) {
    factors++;
    if (metrics.debtToEquity < 0.25) score += 1;
    else if (metrics.debtToEquity < 0.5) score += 0.75;
    else if (metrics.debtToEquity < 1.0) score += 0.5;
    else if (metrics.debtToEquity < 2.0) score += 0.25;
  }

  // Current Ratio > 1.5 is good
  if (metrics.currentRatio !== null) {
    factors++;
    if (metrics.currentRatio > 2.0) score += 1;
    else if (metrics.currentRatio > 1.5) score += 0.75;
    else if (metrics.currentRatio > 1.0) score += 0.5;
    else score += 0.25;
  }

  // FCF Margin > 10% is good
  if (metrics.fcfMargin !== null) {
    factors++;
    if (metrics.fcfMargin > 0.20) score += 1;
    else if (metrics.fcfMargin > 0.15) score += 0.75;
    else if (metrics.fcfMargin > 0.10) score += 0.5;
    else if (metrics.fcfMargin > 0.05) score += 0.25;
  }

  // Positive revenue growth is good
  if (metrics.revenueGrowth !== null) {
    factors++;
    if (metrics.revenueGrowth > 0.20) score += 1;
    else if (metrics.revenueGrowth > 0.10) score += 0.75;
    else if (metrics.revenueGrowth > 0.05) score += 0.5;
    else if (metrics.revenueGrowth > 0) score += 0.25;
  }

  if (factors === 0) return null;
  return score / factors;
}

// ========== UTILITY FUNCTIONS ==========

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'object' ? Number(value) : Number(value);
  return isNaN(num) ? null : num;
}

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}
