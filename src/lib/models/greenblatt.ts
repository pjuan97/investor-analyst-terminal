/**
 * Joel Greenblatt Magic Formula Investment Model
 *
 * Philosophy: Buy good companies at bargain prices
 * The "Magic Formula" ranks stocks on two factors:
 * 1. Earnings Yield (EY) = EBIT / Enterprise Value (higher is better)
 * 2. Return on Capital (ROC) = EBIT / (Net Working Capital + Net Fixed Assets) (higher is better)
 *
 * Key concepts:
 * - Enterprise Value = Market Cap + Total Debt - Excess Cash
 * - Net Working Capital = Current Assets - Current Liabilities (excluding cash/debt)
 * - Net Fixed Assets = Property, Plant & Equipment (net)
 * - Capital Employed = NWC + NFA
 *
 * The formula combines quality (ROC) and value (EY) to find stocks that are
 * both high-quality businesses AND trading at attractive prices.
 */

import type { Rating, ModelVote } from '@/types';

interface GreenblattInput {
  fiscalYear: number;

  // Core Magic Formula metrics (pre-calculated)
  earningsYieldMF: number | null; // EBIT / EV
  returnOnCapitalMF: number | null; // EBIT / (NWC + NFA)

  // Alternative measures if MF-specific not available
  earningsYield: number | null; // E/P (traditional earnings yield)
  roic: number | null; // ROIC as proxy for ROC

  // Enterprise Value components
  marketCap: number | null;
  enterpriseValue: number | null;
  evToEbitda: number | null;
  evToFcf: number | null;

  // Supporting metrics
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;

  // For ranking context (percentile position)
  eyRank?: number; // 1-100 percentile (higher is better)
  rocRank?: number; // 1-100 percentile (higher is better)
}

interface GreenblattHistoricalData {
  current: GreenblattInput;
  historical: GreenblattInput[]; // Previous years
}

/**
 * Greenblatt's Magic Formula thresholds
 * Based on "The Little Book That Beats the Market"
 */
const THRESHOLDS = {
  // Earnings Yield (higher is better)
  EY_EXCELLENT: 0.15, // 15% - very cheap
  EY_GOOD: 0.10, // 10% - attractive
  EY_FAIR: 0.07, // 7% - fair
  EY_POOR: 0.05, // 5% - expensive

  // Return on Capital (higher is better)
  ROC_EXCELLENT: 0.50, // 50% - exceptional business
  ROC_VERY_GOOD: 0.30, // 30% - very good business
  ROC_GOOD: 0.20, // 20% - good business
  ROC_ACCEPTABLE: 0.12, // 12% - decent business

  // EV/EBITDA (lower is better)
  EV_EBITDA_CHEAP: 6,
  EV_EBITDA_FAIR: 10,
  EV_EBITDA_EXPENSIVE: 15,

  // EV/FCF (lower is better)
  EV_FCF_CHEAP: 10,
  EV_FCF_FAIR: 15,
  EV_FCF_EXPENSIVE: 25,

  // Combined Magic Formula score thresholds
  // (Sum of EY rank + ROC rank, where each is 1-100)
  MF_EXCELLENT: 160, // Top 20% in both
  MF_GOOD: 130, // Good in both
  MF_FAIR: 100, // Average
};

/**
 * Score Earnings Yield (value component)
 * Higher EY = stock is cheaper relative to earnings power
 */
function scoreEarningsYield(data: GreenblattInput): { score: number; details: string[] } {
  const details: string[] = [];

  // Prefer Magic Formula EY, fall back to traditional EY
  const ey = data.earningsYieldMF ?? data.earningsYield;

  if (ey === null) {
    return { score: 0, details: ['Earnings yield not available'] };
  }

  let score: number;

  if (ey >= THRESHOLDS.EY_EXCELLENT) {
    score = 1.0;
    details.push(`Earnings Yield ${(ey * 100).toFixed(1)}% (very cheap)`);
  } else if (ey >= THRESHOLDS.EY_GOOD) {
    score = 0.8;
    details.push(`Earnings Yield ${(ey * 100).toFixed(1)}% (attractive)`);
  } else if (ey >= THRESHOLDS.EY_FAIR) {
    score = 0.6;
    details.push(`Earnings Yield ${(ey * 100).toFixed(1)}% (fair)`);
  } else if (ey >= THRESHOLDS.EY_POOR) {
    score = 0.4;
    details.push(`Earnings Yield ${(ey * 100).toFixed(1)}% (modest)`);
  } else {
    score = 0.2;
    details.push(`Earnings Yield ${(ey * 100).toFixed(1)}% (expensive)`);
  }

  return { score, details };
}

/**
 * Score Return on Capital (quality component)
 * Higher ROC = better business quality
 */
function scoreReturnOnCapital(data: GreenblattInput): { score: number; details: string[] } {
  const details: string[] = [];

  // Prefer Magic Formula ROC, fall back to ROIC
  const roc = data.returnOnCapitalMF ?? data.roic;

  if (roc === null) {
    return { score: 0, details: ['Return on capital not available'] };
  }

  let score: number;

  if (roc >= THRESHOLDS.ROC_EXCELLENT) {
    score = 1.0;
    details.push(`Return on Capital ${(roc * 100).toFixed(1)}% (exceptional)`);
  } else if (roc >= THRESHOLDS.ROC_VERY_GOOD) {
    score = 0.85;
    details.push(`Return on Capital ${(roc * 100).toFixed(1)}% (very good)`);
  } else if (roc >= THRESHOLDS.ROC_GOOD) {
    score = 0.7;
    details.push(`Return on Capital ${(roc * 100).toFixed(1)}% (good)`);
  } else if (roc >= THRESHOLDS.ROC_ACCEPTABLE) {
    score = 0.5;
    details.push(`Return on Capital ${(roc * 100).toFixed(1)}% (acceptable)`);
  } else {
    score = 0.25;
    details.push(`Return on Capital ${(roc * 100).toFixed(1)}% (weak)`);
  }

  return { score, details };
}

/**
 * Score EV-based valuation metrics
 */
function scoreEnterpriseValue(data: GreenblattInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // EV/EBITDA (0-50 points)
  if (data.evToEbitda !== null && data.evToEbitda > 0) {
    maxPoints += 50;
    if (data.evToEbitda <= THRESHOLDS.EV_EBITDA_CHEAP) {
      totalPoints += 50;
      details.push(`EV/EBITDA ${data.evToEbitda.toFixed(1)}x (cheap)`);
    } else if (data.evToEbitda <= THRESHOLDS.EV_EBITDA_FAIR) {
      totalPoints += 35;
      details.push(`EV/EBITDA ${data.evToEbitda.toFixed(1)}x (fair)`);
    } else if (data.evToEbitda <= THRESHOLDS.EV_EBITDA_EXPENSIVE) {
      totalPoints += 18;
      details.push(`EV/EBITDA ${data.evToEbitda.toFixed(1)}x (elevated)`);
    } else {
      details.push(`EV/EBITDA ${data.evToEbitda.toFixed(1)}x (expensive)`);
    }
  }

  // EV/FCF (0-50 points)
  if (data.evToFcf !== null && data.evToFcf > 0) {
    maxPoints += 50;
    if (data.evToFcf <= THRESHOLDS.EV_FCF_CHEAP) {
      totalPoints += 50;
      details.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (cheap)`);
    } else if (data.evToFcf <= THRESHOLDS.EV_FCF_FAIR) {
      totalPoints += 35;
      details.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (fair)`);
    } else if (data.evToFcf <= THRESHOLDS.EV_FCF_EXPENSIVE) {
      totalPoints += 18;
      details.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (elevated)`);
    } else {
      details.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (expensive)`);
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Score operating efficiency (supports quality assessment)
 */
function scoreOperatingEfficiency(data: GreenblattInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Operating Margin
  if (data.operatingMargin !== null) {
    maxPoints += 50;
    if (data.operatingMargin >= 0.20) {
      totalPoints += 50;
      details.push(`Operating Margin ${(data.operatingMargin * 100).toFixed(1)}% (strong)`);
    } else if (data.operatingMargin >= 0.12) {
      totalPoints += 35;
    } else if (data.operatingMargin >= 0.06) {
      totalPoints += 20;
    } else {
      totalPoints += 5;
    }
  }

  // Balance sheet check (conservative leverage preferred)
  if (data.debtToEquity !== null) {
    maxPoints += 30;
    if (data.debtToEquity <= 0.5) {
      totalPoints += 30;
    } else if (data.debtToEquity <= 1.0) {
      totalPoints += 22;
    } else if (data.debtToEquity <= 2.0) {
      totalPoints += 10;
    }
  }

  // Liquidity
  if (data.currentRatio !== null) {
    maxPoints += 20;
    if (data.currentRatio >= 1.5) {
      totalPoints += 20;
    } else if (data.currentRatio >= 1.0) {
      totalPoints += 12;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Analyze consistency of Magic Formula metrics over time
 */
function scoreConsistency(historical: GreenblattInput[]): { score: number; details: string[] } {
  const details: string[] = [];

  if (historical.length < 2) {
    return { score: 0.5, details: ['Limited historical data'] };
  }

  let totalPoints = 0;
  let maxPoints = 0;

  // ROC consistency (consistently high ROC is a good sign)
  const rocValues = historical
    .map((h) => h.returnOnCapitalMF ?? h.roic)
    .filter((v): v is number => v !== null);

  if (rocValues.length >= 2) {
    maxPoints += 50;
    const avgRoc = rocValues.reduce((a, b) => a + b, 0) / rocValues.length;
    const aboveThreshold = rocValues.filter((r) => r >= THRESHOLDS.ROC_ACCEPTABLE).length;
    const consistencyRatio = aboveThreshold / rocValues.length;

    if (avgRoc >= THRESHOLDS.ROC_GOOD && consistencyRatio >= 0.8) {
      totalPoints += 50;
      details.push(`Consistently high ROC over ${rocValues.length} years`);
    } else if (avgRoc >= THRESHOLDS.ROC_ACCEPTABLE && consistencyRatio >= 0.6) {
      totalPoints += 35;
    } else {
      totalPoints += 15;
    }
  }

  // EY trend (improving EY can signal value opportunity)
  const eyValues = historical
    .map((h) => h.earningsYieldMF ?? h.earningsYield)
    .filter((v): v is number => v !== null);

  if (eyValues.length >= 2) {
    maxPoints += 50;
    const latestEy = eyValues[0];
    const avgEy = eyValues.reduce((a, b) => a + b, 0) / eyValues.length;

    if (latestEy >= avgEy && latestEy >= THRESHOLDS.EY_GOOD) {
      totalPoints += 50;
      details.push('Earnings yield at/above historical average');
    } else if (latestEy >= THRESHOLDS.EY_FAIR) {
      totalPoints += 30;
    } else {
      totalPoints += 15;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0.5,
    details,
  };
}

/**
 * Main Greenblatt Magic Formula analysis function
 */
export function analyzeGreenblatt(data: GreenblattHistoricalData): ModelVote {
  const { current, historical } = data;

  // Calculate the two core Magic Formula components
  const earningsYieldScore = scoreEarningsYield(current);
  const returnOnCapitalScore = scoreReturnOnCapital(current);

  // Supporting scores
  const evValuationScore = scoreEnterpriseValue(current);
  const operatingScore = scoreOperatingEfficiency(current);
  const consistencyScore = scoreConsistency([current, ...historical]);

  // Magic Formula weighting:
  // The original formula weights EY and ROC equally, but we add supporting factors
  // Core Magic Formula (EY + ROC) = 60%
  // Supporting EV metrics = 15%
  // Operating efficiency = 15%
  // Consistency = 10%
  const totalScore =
    earningsYieldScore.score * 0.30 + // Value component
    returnOnCapitalScore.score * 0.30 + // Quality component
    evValuationScore.score * 0.15 +
    operatingScore.score * 0.15 +
    consistencyScore.score * 0.10;

  // Collect all reasons
  const allReasons = [
    ...earningsYieldScore.details,
    ...returnOnCapitalScore.details,
    ...evValuationScore.details,
    ...operatingScore.details,
    ...consistencyScore.details,
  ];

  // Determine rating based on combined score
  let rating: Rating;
  if (totalScore >= 0.70) {
    rating = 'BUY';
  } else if (totalScore >= 0.45) {
    rating = 'HOLD';
  } else {
    rating = 'SELL';
  }

  // Calculate confidence
  const dataCompleteness = calculateDataCompleteness(current);
  const scoreDecisiveness = Math.abs(totalScore - 0.5) * 2;
  const confidence = Math.min(1, dataCompleteness * 0.6 + scoreDecisiveness * 0.4);

  return {
    rating,
    confidence,
    reasons: allReasons.slice(0, 8),
    keyMetrics: {
      earningsYieldMF: current.earningsYieldMF ?? current.earningsYield,
      returnOnCapitalMF: current.returnOnCapitalMF ?? current.roic,
      evToEbitda: current.evToEbitda,
      evToFcf: current.evToFcf,
      operatingMargin: current.operatingMargin,
      debtToEquity: current.debtToEquity,
      totalScore: Math.round(totalScore * 100),
    },
  };
}

/**
 * Calculate data completeness for confidence adjustment
 */
function calculateDataCompleteness(data: GreenblattInput): number {
  const coreFields = [
    data.earningsYieldMF ?? data.earningsYield,
    data.returnOnCapitalMF ?? data.roic,
  ];

  const supportingFields = [
    data.evToEbitda,
    data.evToFcf,
    data.operatingMargin,
    data.debtToEquity,
  ];

  const coreNonNull = coreFields.filter((f) => f !== null).length;
  const supportingNonNull = supportingFields.filter((f) => f !== null).length;

  // Core fields are more important
  return coreNonNull / coreFields.length * 0.6 + supportingNonNull / supportingFields.length * 0.4;
}

/**
 * Calculate Magic Formula rank (for comparison with universe of stocks)
 * Returns a combined rank where lower is better
 */
export function calculateMagicFormulaRank(
  eyRank: number, // 1-100, where 1 is highest EY
  rocRank: number // 1-100, where 1 is highest ROC
): number {
  // Combined rank is sum of both ranks
  // Lower combined rank = better Magic Formula candidate
  return eyRank + rocRank;
}

export type { GreenblattInput, GreenblattHistoricalData };
