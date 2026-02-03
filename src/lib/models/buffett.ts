/**
 * Warren Buffett Investment Model
 *
 * Philosophy: Own wonderful businesses at fair prices
 * Focus: Quality, durability, competitive advantage (moat), management integrity
 *
 * Key KPIs:
 * 1. Long-term EPS/Revenue history (10+ years growth)
 * 2. ROE (Return on Equity) - consistently high (>15%)
 * 3. ROIC (Return on Invested Capital) - consistently high (>12%)
 * 4. Profit Margins - stable or improving
 * 5. Balance Sheet Strength - manageable debt
 * 6. Owner Earnings / Free Cash Flow
 * 7. Intrinsic Value vs Market Price (margin of safety)
 */

import type { Rating, ModelVote } from '@/types';

interface BuffettInput {
  fiscalYear: number;

  // Profitability
  roe: number | null;
  roic: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;

  // Cash Flow
  fcfMargin: number | null;
  fcfPerShare: number | null;

  // Leverage
  debtToEquity: number | null;
  debtToEbitda: number | null;
  interestCoverage: number | null;
  currentRatio: number | null;

  // Valuation
  peRatio: number | null;
  pbRatio: number | null;
  earningsYield: number | null;
  fcfYield: number | null;

  // Growth (YoY)
  revenueGrowth: number | null;
  epsGrowth: number | null;
  fcfGrowth: number | null;
}

interface BuffettHistoricalData {
  current: BuffettInput;
  historical: BuffettInput[]; // Previous years for trend analysis
}

interface BuffettScores {
  profitabilityScore: number;
  balanceSheetScore: number;
  cashFlowScore: number;
  valuationScore: number;
  consistencyScore: number;
  totalScore: number;
}

/**
 * Buffett scoring thresholds
 */
const THRESHOLDS = {
  // ROE thresholds
  ROE_EXCELLENT: 0.20, // 20%
  ROE_GOOD: 0.15, // 15%
  ROE_ACCEPTABLE: 0.10, // 10%

  // ROIC thresholds
  ROIC_EXCELLENT: 0.15,
  ROIC_GOOD: 0.12,
  ROIC_ACCEPTABLE: 0.08,

  // Margin thresholds
  GROSS_MARGIN_EXCELLENT: 0.40,
  GROSS_MARGIN_GOOD: 0.30,
  OPERATING_MARGIN_EXCELLENT: 0.20,
  OPERATING_MARGIN_GOOD: 0.12,
  NET_MARGIN_EXCELLENT: 0.15,
  NET_MARGIN_GOOD: 0.08,

  // FCF thresholds
  FCF_MARGIN_EXCELLENT: 0.15,
  FCF_MARGIN_GOOD: 0.08,
  FCF_YIELD_EXCELLENT: 0.08,
  FCF_YIELD_GOOD: 0.05,

  // Debt thresholds (lower is better)
  DEBT_TO_EQUITY_EXCELLENT: 0.3,
  DEBT_TO_EQUITY_GOOD: 0.6,
  DEBT_TO_EQUITY_ACCEPTABLE: 1.0,
  DEBT_TO_EBITDA_EXCELLENT: 1.5,
  DEBT_TO_EBITDA_GOOD: 3.0,

  // Coverage thresholds (higher is better)
  INTEREST_COVERAGE_EXCELLENT: 10,
  INTEREST_COVERAGE_GOOD: 5,
  CURRENT_RATIO_GOOD: 1.5,

  // Valuation thresholds
  PE_RATIO_ATTRACTIVE: 15,
  PE_RATIO_FAIR: 20,
  PE_RATIO_EXPENSIVE: 30,
  EARNINGS_YIELD_ATTRACTIVE: 0.07, // 7%
  EARNINGS_YIELD_FAIR: 0.05, // 5%

  // Growth thresholds
  REVENUE_GROWTH_EXCELLENT: 0.15,
  REVENUE_GROWTH_GOOD: 0.08,
  EPS_GROWTH_EXCELLENT: 0.15,
  EPS_GROWTH_GOOD: 0.08,
};

/**
 * Calculate profitability score (0-1)
 */
function scoreProfitability(data: BuffettInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // ROE scoring (0-25 points)
  if (data.roe !== null) {
    maxPoints += 25;
    if (data.roe >= THRESHOLDS.ROE_EXCELLENT) {
      totalPoints += 25;
      details.push(`ROE ${(data.roe * 100).toFixed(1)}% (excellent)`);
    } else if (data.roe >= THRESHOLDS.ROE_GOOD) {
      totalPoints += 18;
      details.push(`ROE ${(data.roe * 100).toFixed(1)}% (good)`);
    } else if (data.roe >= THRESHOLDS.ROE_ACCEPTABLE) {
      totalPoints += 10;
      details.push(`ROE ${(data.roe * 100).toFixed(1)}% (acceptable)`);
    } else {
      details.push(`ROE ${(data.roe * 100).toFixed(1)}% (weak)`);
    }
  }

  // ROIC scoring (0-25 points)
  if (data.roic !== null) {
    maxPoints += 25;
    if (data.roic >= THRESHOLDS.ROIC_EXCELLENT) {
      totalPoints += 25;
      details.push(`ROIC ${(data.roic * 100).toFixed(1)}% (excellent)`);
    } else if (data.roic >= THRESHOLDS.ROIC_GOOD) {
      totalPoints += 18;
      details.push(`ROIC ${(data.roic * 100).toFixed(1)}% (good)`);
    } else if (data.roic >= THRESHOLDS.ROIC_ACCEPTABLE) {
      totalPoints += 10;
      details.push(`ROIC ${(data.roic * 100).toFixed(1)}% (acceptable)`);
    } else {
      details.push(`ROIC ${(data.roic * 100).toFixed(1)}% (weak)`);
    }
  }

  // Gross Margin (0-20 points)
  if (data.grossMargin !== null) {
    maxPoints += 20;
    if (data.grossMargin >= THRESHOLDS.GROSS_MARGIN_EXCELLENT) {
      totalPoints += 20;
      details.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (excellent)`);
    } else if (data.grossMargin >= THRESHOLDS.GROSS_MARGIN_GOOD) {
      totalPoints += 14;
      details.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (good)`);
    } else {
      totalPoints += 5;
      details.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (low)`);
    }
  }

  // Operating Margin (0-15 points)
  if (data.operatingMargin !== null) {
    maxPoints += 15;
    if (data.operatingMargin >= THRESHOLDS.OPERATING_MARGIN_EXCELLENT) {
      totalPoints += 15;
    } else if (data.operatingMargin >= THRESHOLDS.OPERATING_MARGIN_GOOD) {
      totalPoints += 10;
    } else {
      totalPoints += 3;
    }
  }

  // Net Margin (0-15 points)
  if (data.netMargin !== null) {
    maxPoints += 15;
    if (data.netMargin >= THRESHOLDS.NET_MARGIN_EXCELLENT) {
      totalPoints += 15;
    } else if (data.netMargin >= THRESHOLDS.NET_MARGIN_GOOD) {
      totalPoints += 10;
    } else {
      totalPoints += 3;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Calculate balance sheet strength score (0-1)
 */
function scoreBalanceSheet(data: BuffettInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Debt to Equity (0-30 points, lower is better)
  if (data.debtToEquity !== null) {
    maxPoints += 30;
    if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_EXCELLENT) {
      totalPoints += 30;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (conservative)`);
    } else if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_GOOD) {
      totalPoints += 22;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (moderate)`);
    } else if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_ACCEPTABLE) {
      totalPoints += 12;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (acceptable)`);
    } else {
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (high leverage)`);
    }
  }

  // Debt to EBITDA (0-30 points)
  if (data.debtToEbitda !== null) {
    maxPoints += 30;
    if (data.debtToEbitda <= THRESHOLDS.DEBT_TO_EBITDA_EXCELLENT) {
      totalPoints += 30;
    } else if (data.debtToEbitda <= THRESHOLDS.DEBT_TO_EBITDA_GOOD) {
      totalPoints += 18;
    } else {
      totalPoints += 5;
    }
  }

  // Interest Coverage (0-25 points, higher is better)
  if (data.interestCoverage !== null) {
    maxPoints += 25;
    if (data.interestCoverage >= THRESHOLDS.INTEREST_COVERAGE_EXCELLENT) {
      totalPoints += 25;
      details.push(`Interest Coverage ${data.interestCoverage.toFixed(1)}x (strong)`);
    } else if (data.interestCoverage >= THRESHOLDS.INTEREST_COVERAGE_GOOD) {
      totalPoints += 18;
      details.push(`Interest Coverage ${data.interestCoverage.toFixed(1)}x (adequate)`);
    } else {
      totalPoints += 5;
      details.push(`Interest Coverage ${data.interestCoverage.toFixed(1)}x (weak)`);
    }
  }

  // Current Ratio (0-15 points)
  if (data.currentRatio !== null) {
    maxPoints += 15;
    if (data.currentRatio >= THRESHOLDS.CURRENT_RATIO_GOOD) {
      totalPoints += 15;
    } else if (data.currentRatio >= 1.0) {
      totalPoints += 10;
    } else {
      totalPoints += 3;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Calculate cash flow quality score (0-1)
 */
function scoreCashFlow(data: BuffettInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // FCF Margin (0-40 points)
  if (data.fcfMargin !== null) {
    maxPoints += 40;
    if (data.fcfMargin >= THRESHOLDS.FCF_MARGIN_EXCELLENT) {
      totalPoints += 40;
      details.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (excellent)`);
    } else if (data.fcfMargin >= THRESHOLDS.FCF_MARGIN_GOOD) {
      totalPoints += 28;
      details.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (good)`);
    } else if (data.fcfMargin > 0) {
      totalPoints += 12;
      details.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (low)`);
    } else {
      details.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (negative)`);
    }
  }

  // FCF Yield (0-35 points)
  if (data.fcfYield !== null) {
    maxPoints += 35;
    if (data.fcfYield >= THRESHOLDS.FCF_YIELD_EXCELLENT) {
      totalPoints += 35;
      details.push(`FCF Yield ${(data.fcfYield * 100).toFixed(1)}% (high)`);
    } else if (data.fcfYield >= THRESHOLDS.FCF_YIELD_GOOD) {
      totalPoints += 25;
      details.push(`FCF Yield ${(data.fcfYield * 100).toFixed(1)}% (moderate)`);
    } else if (data.fcfYield > 0) {
      totalPoints += 12;
    }
  }

  // FCF Growth (0-25 points)
  if (data.fcfGrowth !== null) {
    maxPoints += 25;
    if (data.fcfGrowth >= 0.15) {
      totalPoints += 25;
    } else if (data.fcfGrowth >= 0.05) {
      totalPoints += 18;
    } else if (data.fcfGrowth >= 0) {
      totalPoints += 10;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Calculate valuation score (0-1)
 * Buffett seeks margin of safety - buying wonderful companies at fair prices
 */
function scoreValuation(data: BuffettInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // P/E Ratio (0-35 points, lower is better for same quality)
  if (data.peRatio !== null && data.peRatio > 0) {
    maxPoints += 35;
    if (data.peRatio <= THRESHOLDS.PE_RATIO_ATTRACTIVE) {
      totalPoints += 35;
      details.push(`P/E ${data.peRatio.toFixed(1)} (attractive)`);
    } else if (data.peRatio <= THRESHOLDS.PE_RATIO_FAIR) {
      totalPoints += 25;
      details.push(`P/E ${data.peRatio.toFixed(1)} (fair)`);
    } else if (data.peRatio <= THRESHOLDS.PE_RATIO_EXPENSIVE) {
      totalPoints += 12;
      details.push(`P/E ${data.peRatio.toFixed(1)} (elevated)`);
    } else {
      details.push(`P/E ${data.peRatio.toFixed(1)} (expensive)`);
    }
  }

  // Earnings Yield (0-35 points, higher is better)
  if (data.earningsYield !== null) {
    maxPoints += 35;
    if (data.earningsYield >= THRESHOLDS.EARNINGS_YIELD_ATTRACTIVE) {
      totalPoints += 35;
      details.push(`Earnings Yield ${(data.earningsYield * 100).toFixed(1)}% (attractive)`);
    } else if (data.earningsYield >= THRESHOLDS.EARNINGS_YIELD_FAIR) {
      totalPoints += 25;
      details.push(`Earnings Yield ${(data.earningsYield * 100).toFixed(1)}% (fair)`);
    } else {
      totalPoints += 10;
      details.push(`Earnings Yield ${(data.earningsYield * 100).toFixed(1)}% (low)`);
    }
  }

  // P/B Ratio (0-30 points)
  if (data.pbRatio !== null && data.pbRatio > 0) {
    maxPoints += 30;
    if (data.pbRatio <= 1.5) {
      totalPoints += 30;
    } else if (data.pbRatio <= 3.0) {
      totalPoints += 20;
    } else if (data.pbRatio <= 5.0) {
      totalPoints += 10;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Calculate consistency score based on historical data (0-1)
 * Buffett values consistent performance over time
 */
function scoreConsistency(historical: BuffettInput[]): { score: number; details: string[] } {
  const details: string[] = [];

  if (historical.length < 3) {
    details.push('Insufficient historical data for consistency analysis');
    return { score: 0.5, details }; // Neutral score if not enough data
  }

  let totalPoints = 0;
  let maxPoints = 0;

  // ROE consistency (0-25 points)
  const roeValues = historical.filter((h) => h.roe !== null).map((h) => h.roe!);
  if (roeValues.length >= 3) {
    maxPoints += 25;
    const aboveThreshold = roeValues.filter((r) => r >= THRESHOLDS.ROE_GOOD).length;
    const consistencyRatio = aboveThreshold / roeValues.length;
    if (consistencyRatio >= 0.8) {
      totalPoints += 25;
      details.push(`ROE consistently >15% (${aboveThreshold}/${roeValues.length} years)`);
    } else if (consistencyRatio >= 0.6) {
      totalPoints += 18;
    } else {
      totalPoints += 8;
    }
  }

  // Margin stability (0-25 points)
  const marginValues = historical.filter((h) => h.netMargin !== null).map((h) => h.netMargin!);
  if (marginValues.length >= 3) {
    maxPoints += 25;
    const avgMargin = marginValues.reduce((a, b) => a + b, 0) / marginValues.length;
    const variance =
      marginValues.reduce((sum, m) => sum + Math.pow(m - avgMargin, 2), 0) / marginValues.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgMargin !== 0 ? stdDev / Math.abs(avgMargin) : 1;

    if (coefficientOfVariation < 0.2) {
      totalPoints += 25;
      details.push('Stable profit margins');
    } else if (coefficientOfVariation < 0.4) {
      totalPoints += 18;
    } else {
      totalPoints += 8;
      details.push('Volatile profit margins');
    }
  }

  // Positive earnings streak (0-25 points)
  const positiveEarnings = historical.filter(
    (h) => h.netMargin !== null && h.netMargin > 0
  ).length;
  if (historical.length >= 3) {
    maxPoints += 25;
    const positiveRatio = positiveEarnings / historical.length;
    if (positiveRatio >= 0.9) {
      totalPoints += 25;
      details.push(`Profitable in ${positiveEarnings}/${historical.length} years`);
    } else if (positiveRatio >= 0.7) {
      totalPoints += 18;
    } else {
      totalPoints += 5;
    }
  }

  // Growth trajectory (0-25 points)
  const revenueGrowths = historical
    .filter((h) => h.revenueGrowth !== null)
    .map((h) => h.revenueGrowth!);
  if (revenueGrowths.length >= 3) {
    maxPoints += 25;
    const avgGrowth = revenueGrowths.reduce((a, b) => a + b, 0) / revenueGrowths.length;
    const positiveGrowths = revenueGrowths.filter((g) => g > 0).length;

    if (avgGrowth >= THRESHOLDS.REVENUE_GROWTH_EXCELLENT && positiveGrowths >= revenueGrowths.length * 0.8) {
      totalPoints += 25;
      details.push('Strong, consistent revenue growth');
    } else if (avgGrowth >= THRESHOLDS.REVENUE_GROWTH_GOOD) {
      totalPoints += 18;
    } else if (avgGrowth > 0) {
      totalPoints += 10;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0.5,
    details,
  };
}

/**
 * Main Buffett analysis function
 */
export function analyzeBuffett(data: BuffettHistoricalData): ModelVote {
  const { current, historical } = data;

  // Calculate individual scores
  const profitability = scoreProfitability(current);
  const balanceSheet = scoreBalanceSheet(current);
  const cashFlow = scoreCashFlow(current);
  const valuation = scoreValuation(current);
  const consistency = scoreConsistency([current, ...historical]);

  // Weight the scores (Buffett priorities)
  // Quality (profitability + cash flow + consistency) = 60%
  // Balance sheet safety = 20%
  // Valuation = 20%
  const totalScore =
    profitability.score * 0.25 +
    cashFlow.score * 0.20 +
    consistency.score * 0.15 +
    balanceSheet.score * 0.20 +
    valuation.score * 0.20;

  // Collect all reasons
  const allReasons = [
    ...profitability.details,
    ...balanceSheet.details,
    ...cashFlow.details,
    ...valuation.details,
    ...consistency.details,
  ];

  // Determine rating
  let rating: Rating;
  if (totalScore >= 0.70) {
    rating = 'BUY';
  } else if (totalScore >= 0.45) {
    rating = 'HOLD';
  } else {
    rating = 'SELL';
  }

  // Calculate confidence (0-1)
  // Higher confidence when we have more data points and scores are decisive
  const dataCompleteness = calculateDataCompleteness(current);
  const scoreDecisiveness = Math.abs(totalScore - 0.5) * 2; // 0 at 0.5, 1 at 0 or 1
  const confidence = Math.min(1, dataCompleteness * 0.6 + scoreDecisiveness * 0.4);

  return {
    rating,
    confidence,
    reasons: allReasons.slice(0, 8), // Top 8 reasons
    keyMetrics: {
      roe: current.roe,
      roic: current.roic,
      netMargin: current.netMargin,
      fcfMargin: current.fcfMargin,
      debtToEquity: current.debtToEquity,
      peRatio: current.peRatio,
      earningsYield: current.earningsYield,
      totalScore: Math.round(totalScore * 100),
    },
  };
}

/**
 * Calculate data completeness for confidence adjustment
 */
function calculateDataCompleteness(data: BuffettInput): number {
  const fields = [
    data.roe,
    data.roic,
    data.grossMargin,
    data.operatingMargin,
    data.netMargin,
    data.fcfMargin,
    data.debtToEquity,
    data.peRatio,
    data.earningsYield,
  ];

  const nonNull = fields.filter((f) => f !== null).length;
  return nonNull / fields.length;
}

export type { BuffettInput, BuffettHistoricalData, BuffettScores };
