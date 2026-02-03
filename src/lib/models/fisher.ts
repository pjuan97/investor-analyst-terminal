/**
 * Philip Fisher Growth Investment Model
 *
 * Philosophy: Own outstanding growth businesses for the long term
 * Focus: Companies that can grow sales/earnings far above industry averages
 *
 * Key KPIs:
 * 1. Multi-Year Revenue & EPS Growth vs Industry (5-10+ years)
 * 2. Profit Margins (Gross, Operating, Net) - high and rising
 * 3. Return on Capital & R&D Effectiveness
 * 4. Financial Strength (Conservative financing, internal funding)
 *
 * Fisher's philosophy emphasizes:
 * - Long-term growth runway
 * - Management quality and integrity
 * - Innovation culture and R&D effectiveness
 * - Conservative financing (avoid excessive debt)
 * - The "scuttlebutt" method for qualitative research
 */

import type { Rating, ModelVote } from '@/types';

interface FisherInput {
  fiscalYear: number;

  // Growth metrics (multi-year analysis)
  revenueGrowth: number | null; // YoY revenue growth
  epsGrowth: number | null; // YoY EPS growth
  fcfGrowth: number | null; // YoY FCF growth

  // Profitability (margins should be high and rising)
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;

  // Returns on Capital
  roe: number | null;
  roic: number | null;
  roce: number | null;

  // Financial Strength
  debtToEquity: number | null;
  debtToEbitda: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;

  // Cash Flow Quality
  fcfMargin: number | null;
  fcfYield: number | null;

  // Quality Score
  qualityScore: number | null;
}

interface FisherHistoricalData {
  current: FisherInput;
  historical: FisherInput[]; // Previous years for trend analysis (ideally 5-10 years)
}

/**
 * Fisher's criteria thresholds
 * Emphasis on growth ABOVE industry averages and improving trends
 */
const THRESHOLDS = {
  // Revenue Growth (annual)
  REVENUE_GROWTH_EXCELLENT: 0.20, // 20% YoY
  REVENUE_GROWTH_GOOD: 0.12, // 12% YoY
  REVENUE_GROWTH_ACCEPTABLE: 0.07, // 7% YoY

  // EPS Growth (annual)
  EPS_GROWTH_EXCELLENT: 0.20,
  EPS_GROWTH_GOOD: 0.12,
  EPS_GROWTH_ACCEPTABLE: 0.07,

  // Multi-year Growth CAGR
  GROWTH_CAGR_EXCELLENT: 0.15, // 15% CAGR over 5+ years
  GROWTH_CAGR_GOOD: 0.10, // 10% CAGR
  GROWTH_CAGR_ACCEPTABLE: 0.06, // 6% CAGR

  // Gross Margin (higher indicates pricing power)
  GROSS_MARGIN_EXCELLENT: 0.50,
  GROSS_MARGIN_GOOD: 0.35,
  GROSS_MARGIN_ACCEPTABLE: 0.25,

  // Operating Margin
  OPERATING_MARGIN_EXCELLENT: 0.25,
  OPERATING_MARGIN_GOOD: 0.15,
  OPERATING_MARGIN_ACCEPTABLE: 0.08,

  // Net Margin
  NET_MARGIN_EXCELLENT: 0.18,
  NET_MARGIN_GOOD: 0.10,
  NET_MARGIN_ACCEPTABLE: 0.05,

  // Return on Capital (ROIC/ROCE)
  ROIC_EXCELLENT: 0.20,
  ROIC_GOOD: 0.15,
  ROIC_ACCEPTABLE: 0.10,

  // Debt thresholds (Fisher prefers conservative financing)
  DEBT_TO_EQUITY_CONSERVATIVE: 0.30,
  DEBT_TO_EQUITY_MODERATE: 0.60,
  DEBT_TO_EQUITY_ACCEPTABLE: 1.0,

  // Interest Coverage
  INTEREST_COVERAGE_STRONG: 10,
  INTEREST_COVERAGE_ADEQUATE: 5,

  // FCF Margin
  FCF_MARGIN_EXCELLENT: 0.18,
  FCF_MARGIN_GOOD: 0.10,
  FCF_MARGIN_ACCEPTABLE: 0.05,
};

/**
 * Score growth metrics (core Fisher focus)
 * Fisher wants companies growing FAR ABOVE industry averages
 */
function scoreGrowth(
  current: FisherInput,
  historical: FisherInput[]
): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Current year revenue growth (0-30 points)
  if (current.revenueGrowth !== null) {
    maxPoints += 30;
    if (current.revenueGrowth >= THRESHOLDS.REVENUE_GROWTH_EXCELLENT) {
      totalPoints += 30;
      details.push(`Revenue Growth ${(current.revenueGrowth * 100).toFixed(1)}% (excellent)`);
    } else if (current.revenueGrowth >= THRESHOLDS.REVENUE_GROWTH_GOOD) {
      totalPoints += 22;
      details.push(`Revenue Growth ${(current.revenueGrowth * 100).toFixed(1)}% (good)`);
    } else if (current.revenueGrowth >= THRESHOLDS.REVENUE_GROWTH_ACCEPTABLE) {
      totalPoints += 12;
      details.push(`Revenue Growth ${(current.revenueGrowth * 100).toFixed(1)}% (moderate)`);
    } else if (current.revenueGrowth > 0) {
      totalPoints += 5;
      details.push(`Revenue Growth ${(current.revenueGrowth * 100).toFixed(1)}% (slow)`);
    } else {
      details.push(`Revenue Growth ${(current.revenueGrowth * 100).toFixed(1)}% (declining)`);
    }
  }

  // Current year EPS growth (0-30 points)
  if (current.epsGrowth !== null) {
    maxPoints += 30;
    if (current.epsGrowth >= THRESHOLDS.EPS_GROWTH_EXCELLENT) {
      totalPoints += 30;
      details.push(`EPS Growth ${(current.epsGrowth * 100).toFixed(1)}% (excellent)`);
    } else if (current.epsGrowth >= THRESHOLDS.EPS_GROWTH_GOOD) {
      totalPoints += 22;
    } else if (current.epsGrowth >= THRESHOLDS.EPS_GROWTH_ACCEPTABLE) {
      totalPoints += 12;
    } else if (current.epsGrowth > 0) {
      totalPoints += 5;
    }
  }

  // Multi-year growth consistency (0-40 points)
  if (historical.length >= 3) {
    maxPoints += 40;

    const revenueGrowths = [current, ...historical]
      .map((h) => h.revenueGrowth)
      .filter((g): g is number => g !== null);

    const epsGrowths = [current, ...historical]
      .map((h) => h.epsGrowth)
      .filter((g): g is number => g !== null);

    if (revenueGrowths.length >= 3) {
      const avgRevenueGrowth = revenueGrowths.reduce((a, b) => a + b, 0) / revenueGrowths.length;
      const positiveYears = revenueGrowths.filter((g) => g > 0).length;
      const consistencyRatio = positiveYears / revenueGrowths.length;

      // Calculate approximate CAGR
      const cagr = avgRevenueGrowth; // Simplified - use avg as proxy

      if (cagr >= THRESHOLDS.GROWTH_CAGR_EXCELLENT && consistencyRatio >= 0.8) {
        totalPoints += 40;
        details.push(
          `Strong growth consistency: ${positiveYears}/${revenueGrowths.length} years positive`
        );
      } else if (cagr >= THRESHOLDS.GROWTH_CAGR_GOOD && consistencyRatio >= 0.7) {
        totalPoints += 30;
        details.push(`Good growth consistency over ${revenueGrowths.length} years`);
      } else if (cagr >= THRESHOLDS.GROWTH_CAGR_ACCEPTABLE) {
        totalPoints += 18;
      } else {
        totalPoints += 8;
        details.push('Inconsistent or weak historical growth');
      }
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Score margin quality and trends
 * Fisher wants high AND RISING margins over time
 */
function scoreMargins(
  current: FisherInput,
  historical: FisherInput[]
): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Gross Margin (0-25 points)
  if (current.grossMargin !== null) {
    maxPoints += 25;
    if (current.grossMargin >= THRESHOLDS.GROSS_MARGIN_EXCELLENT) {
      totalPoints += 25;
      details.push(`Gross Margin ${(current.grossMargin * 100).toFixed(1)}% (excellent)`);
    } else if (current.grossMargin >= THRESHOLDS.GROSS_MARGIN_GOOD) {
      totalPoints += 18;
      details.push(`Gross Margin ${(current.grossMargin * 100).toFixed(1)}% (good)`);
    } else if (current.grossMargin >= THRESHOLDS.GROSS_MARGIN_ACCEPTABLE) {
      totalPoints += 10;
    } else {
      totalPoints += 3;
    }
  }

  // Operating Margin (0-25 points)
  if (current.operatingMargin !== null) {
    maxPoints += 25;
    if (current.operatingMargin >= THRESHOLDS.OPERATING_MARGIN_EXCELLENT) {
      totalPoints += 25;
      details.push(`Operating Margin ${(current.operatingMargin * 100).toFixed(1)}% (excellent)`);
    } else if (current.operatingMargin >= THRESHOLDS.OPERATING_MARGIN_GOOD) {
      totalPoints += 18;
    } else if (current.operatingMargin >= THRESHOLDS.OPERATING_MARGIN_ACCEPTABLE) {
      totalPoints += 10;
    } else {
      totalPoints += 3;
    }
  }

  // Net Margin (0-20 points)
  if (current.netMargin !== null) {
    maxPoints += 20;
    if (current.netMargin >= THRESHOLDS.NET_MARGIN_EXCELLENT) {
      totalPoints += 20;
    } else if (current.netMargin >= THRESHOLDS.NET_MARGIN_GOOD) {
      totalPoints += 14;
    } else if (current.netMargin >= THRESHOLDS.NET_MARGIN_ACCEPTABLE) {
      totalPoints += 8;
    }
  }

  // Margin trend analysis (0-30 points)
  // Fisher emphasizes RISING margins as evidence of competitive strength
  if (historical.length >= 2) {
    maxPoints += 30;

    const allData = [current, ...historical];
    const grossMargins = allData.map((d) => d.grossMargin).filter((m): m is number => m !== null);
    const opMargins = allData.map((d) => d.operatingMargin).filter((m): m is number => m !== null);

    if (grossMargins.length >= 2 && opMargins.length >= 2) {
      // Check if margins are improving (current vs average of prior years)
      const currentGross = current.grossMargin ?? 0;
      const currentOp = current.operatingMargin ?? 0;
      const avgPriorGross =
        grossMargins.slice(1).reduce((a, b) => a + b, 0) / (grossMargins.length - 1);
      const avgPriorOp =
        opMargins.slice(1).reduce((a, b) => a + b, 0) / (opMargins.length - 1);

      const grossImproving = currentGross >= avgPriorGross;
      const opImproving = currentOp >= avgPriorOp;

      if (grossImproving && opImproving) {
        totalPoints += 30;
        details.push('Margins stable or improving');
      } else if (grossImproving || opImproving) {
        totalPoints += 20;
        details.push('Mixed margin trends');
      } else {
        totalPoints += 8;
        details.push('Margin compression observed');
      }
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Score return on capital (efficiency of capital deployment)
 */
function scoreReturnOnCapital(data: FisherInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // ROIC (0-40 points)
  if (data.roic !== null) {
    maxPoints += 40;
    if (data.roic >= THRESHOLDS.ROIC_EXCELLENT) {
      totalPoints += 40;
      details.push(`ROIC ${(data.roic * 100).toFixed(1)}% (excellent capital efficiency)`);
    } else if (data.roic >= THRESHOLDS.ROIC_GOOD) {
      totalPoints += 30;
      details.push(`ROIC ${(data.roic * 100).toFixed(1)}% (good)`);
    } else if (data.roic >= THRESHOLDS.ROIC_ACCEPTABLE) {
      totalPoints += 18;
    } else {
      totalPoints += 5;
    }
  }

  // ROCE or ROE as alternative (0-30 points)
  const returnMetric = data.roce ?? data.roe;
  if (returnMetric !== null) {
    maxPoints += 30;
    if (returnMetric >= THRESHOLDS.ROIC_EXCELLENT) {
      totalPoints += 30;
    } else if (returnMetric >= THRESHOLDS.ROIC_GOOD) {
      totalPoints += 22;
    } else if (returnMetric >= THRESHOLDS.ROIC_ACCEPTABLE) {
      totalPoints += 12;
    }
  }

  // FCF Margin (0-30 points) - indicates real earnings quality
  if (data.fcfMargin !== null) {
    maxPoints += 30;
    if (data.fcfMargin >= THRESHOLDS.FCF_MARGIN_EXCELLENT) {
      totalPoints += 30;
      details.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (strong cash generation)`);
    } else if (data.fcfMargin >= THRESHOLDS.FCF_MARGIN_GOOD) {
      totalPoints += 22;
    } else if (data.fcfMargin >= THRESHOLDS.FCF_MARGIN_ACCEPTABLE) {
      totalPoints += 12;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Score financial strength (Fisher prefers conservative financing)
 */
function scoreFinancialStrength(data: FisherInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Debt to Equity (0-35 points - Fisher strongly prefers conservative leverage)
  if (data.debtToEquity !== null) {
    maxPoints += 35;
    if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_CONSERVATIVE) {
      totalPoints += 35;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (conservative)`);
    } else if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_MODERATE) {
      totalPoints += 25;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (moderate)`);
    } else if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_ACCEPTABLE) {
      totalPoints += 12;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (acceptable)`);
    } else {
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (high leverage)`);
    }
  }

  // Debt to EBITDA (0-25 points)
  if (data.debtToEbitda !== null) {
    maxPoints += 25;
    if (data.debtToEbitda <= 1.5) {
      totalPoints += 25;
    } else if (data.debtToEbitda <= 3.0) {
      totalPoints += 18;
    } else if (data.debtToEbitda <= 5.0) {
      totalPoints += 8;
    }
  }

  // Interest Coverage (0-25 points)
  if (data.interestCoverage !== null) {
    maxPoints += 25;
    if (data.interestCoverage >= THRESHOLDS.INTEREST_COVERAGE_STRONG) {
      totalPoints += 25;
      details.push(`Interest Coverage ${data.interestCoverage.toFixed(1)}x (strong)`);
    } else if (data.interestCoverage >= THRESHOLDS.INTEREST_COVERAGE_ADEQUATE) {
      totalPoints += 18;
    } else {
      totalPoints += 5;
    }
  }

  // Current Ratio (0-15 points)
  if (data.currentRatio !== null) {
    maxPoints += 15;
    if (data.currentRatio >= 2.0) {
      totalPoints += 15;
    } else if (data.currentRatio >= 1.5) {
      totalPoints += 12;
    } else if (data.currentRatio >= 1.0) {
      totalPoints += 6;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Main Fisher analysis function
 */
export function analyzeFisher(data: FisherHistoricalData): ModelVote {
  const { current, historical } = data;

  // Calculate individual scores
  const growthScore = scoreGrowth(current, historical);
  const marginsScore = scoreMargins(current, historical);
  const capitalScore = scoreReturnOnCapital(current);
  const financialScore = scoreFinancialStrength(current);

  // Fisher weighting (growth-focused):
  // Growth = 35% (core Fisher focus)
  // Margins = 25% (indicates competitive advantage)
  // Return on Capital = 20% (capital efficiency)
  // Financial Strength = 20% (conservative financing)
  const totalScore =
    growthScore.score * 0.35 +
    marginsScore.score * 0.25 +
    capitalScore.score * 0.20 +
    financialScore.score * 0.20;

  // Collect all reasons
  const allReasons = [
    ...growthScore.details,
    ...marginsScore.details,
    ...capitalScore.details,
    ...financialScore.details,
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

  // Calculate confidence
  const dataCompleteness = calculateDataCompleteness(current);
  const historicalDataBonus = Math.min(historical.length / 5, 1) * 0.2; // Bonus for more history
  const scoreDecisiveness = Math.abs(totalScore - 0.5) * 2;
  const confidence = Math.min(
    1,
    dataCompleteness * 0.5 + scoreDecisiveness * 0.3 + historicalDataBonus
  );

  return {
    rating,
    confidence,
    reasons: allReasons.slice(0, 8),
    keyMetrics: {
      revenueGrowth: current.revenueGrowth,
      epsGrowth: current.epsGrowth,
      grossMargin: current.grossMargin,
      operatingMargin: current.operatingMargin,
      roic: current.roic,
      debtToEquity: current.debtToEquity,
      fcfMargin: current.fcfMargin,
      totalScore: Math.round(totalScore * 100),
    },
  };
}

/**
 * Calculate data completeness for confidence adjustment
 */
function calculateDataCompleteness(data: FisherInput): number {
  const fields = [
    data.revenueGrowth,
    data.epsGrowth,
    data.grossMargin,
    data.operatingMargin,
    data.netMargin,
    data.roic,
    data.debtToEquity,
    data.fcfMargin,
  ];

  const nonNull = fields.filter((f) => f !== null).length;
  return nonNull / fields.length;
}

export type { FisherInput, FisherHistoricalData };
