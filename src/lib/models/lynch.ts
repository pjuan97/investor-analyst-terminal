/**
 * Peter Lynch GARP Investment Model
 *
 * Philosophy: Growth At a Reasonable Price (GARP)
 * "Invest in what you know" - find companies with clear, understandable stories
 *
 * Key KPIs:
 * 1. P/E Ratio - basic valuation anchor
 * 2. EPS Growth - consistent, above-average growth over years
 * 3. PEG Ratio (P/E ÷ EPS Growth) - Lynch's signature metric
 *    - PEG < 1 = potentially undervalued
 *    - PEG ≈ 1 = fairly valued
 *    - PEG > 1.5 = potentially overvalued
 * 4. PEGY Ratio (P/E ÷ (EPS Growth + Dividend Yield)) - for dividend payers
 * 5. Balance Sheet Strength - manageable debt
 * 6. Story-Numbers Alignment - the story must be supported by financials
 *
 * Lynch's Six Stock Categories:
 * 1. Slow Growers (2-4% growth, high dividends)
 * 2. Stalwarts (10-12% growth, stable large caps)
 * 3. Fast Growers (20-25%+ growth, small aggressive companies)
 * 4. Cyclicals (tied to economic cycles)
 * 5. Turnarounds (recovering from problems)
 * 6. Asset Plays (hidden asset value)
 */

import type { Rating, ModelVote } from '@/types';

type LynchCategory =
  | 'slow_grower'
  | 'stalwart'
  | 'fast_grower'
  | 'cyclical'
  | 'turnaround'
  | 'asset_play'
  | 'unknown';

interface LynchInput {
  fiscalYear: number;

  // Core GARP metrics
  peRatio: number | null;
  epsGrowth: number | null; // Historical EPS growth rate (use 5Y CAGR if available)
  revenueGrowth: number | null;

  // PEG/PEGY components
  dividendYield?: number | null; // For PEGY calculation

  // Valuation
  psRatio: number | null;
  pbRatio: number | null;
  earningsYield: number | null;

  // Balance Sheet
  debtToEquity: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;

  // Cash Flow Quality
  fcfMargin: number | null;
  fcfYield: number | null;

  // Profitability
  netMargin: number | null;
  roe: number | null;

  // For cyclical analysis
  operatingMargin: number | null;

  // Estimated category (optional - can be inferred)
  category?: LynchCategory;
}

interface LynchHistoricalData {
  current: LynchInput;
  historical: LynchInput[]; // Previous years
}

/**
 * Lynch's GARP thresholds
 */
const THRESHOLDS = {
  // P/E thresholds (context-dependent on growth)
  PE_VERY_LOW: 8,
  PE_LOW: 12,
  PE_FAIR: 18,
  PE_HIGH: 25,
  PE_VERY_HIGH: 35,

  // EPS Growth thresholds
  EPS_GROWTH_FAST: 0.20, // 20%+ = Fast grower territory
  EPS_GROWTH_STALWART: 0.10, // 10-12% = Stalwart
  EPS_GROWTH_SLOW: 0.04, // 2-4% = Slow grower
  EPS_GROWTH_NEGATIVE: 0, // Potential turnaround or problem

  // PEG thresholds (Lynch's key metric)
  PEG_VERY_ATTRACTIVE: 0.5, // Very undervalued
  PEG_ATTRACTIVE: 0.75, // Undervalued
  PEG_FAIR: 1.0, // Fairly valued
  PEG_SLIGHTLY_HIGH: 1.25,
  PEG_EXPENSIVE: 1.5, // Getting expensive
  PEG_VERY_EXPENSIVE: 2.0, // Overvalued

  // PEGY thresholds (for dividend payers)
  PEGY_ATTRACTIVE: 1.0,
  PEGY_FAIR: 1.5,

  // Debt thresholds
  DEBT_TO_EQUITY_CONSERVATIVE: 0.4,
  DEBT_TO_EQUITY_MODERATE: 0.8,
  DEBT_TO_EQUITY_HIGH: 1.5,

  // Interest Coverage
  INTEREST_COVERAGE_STRONG: 8,
  INTEREST_COVERAGE_ADEQUATE: 4,

  // Dividend Yield (for slow growers/stalwarts)
  DIVIDEND_YIELD_HIGH: 0.04, // 4%+
  DIVIDEND_YIELD_GOOD: 0.025, // 2.5%
};

/**
 * Calculate PEG Ratio
 * PEG = P/E ÷ EPS Growth Rate (expressed as whole number, e.g., 15% = 15)
 */
function calculatePEG(peRatio: number, epsGrowth: number): number | null {
  if (peRatio <= 0 || epsGrowth <= 0) return null;
  const epsGrowthPercent = epsGrowth * 100; // Convert to percentage points
  return peRatio / epsGrowthPercent;
}

/**
 * Calculate PEGY Ratio (for dividend payers)
 * PEGY = P/E ÷ (EPS Growth % + Dividend Yield %)
 */
function calculatePEGY(
  peRatio: number,
  epsGrowth: number,
  dividendYield: number
): number | null {
  if (peRatio <= 0) return null;
  const combinedGrowthYield = epsGrowth * 100 + dividendYield * 100;
  if (combinedGrowthYield <= 0) return null;
  return peRatio / combinedGrowthYield;
}

/**
 * Infer stock category based on growth characteristics
 */
function inferCategory(data: LynchInput, historical: LynchInput[]): LynchCategory {
  // If category is explicitly set, use it
  if (data.category && data.category !== 'unknown') {
    return data.category;
  }

  const epsGrowth = data.epsGrowth;

  // Check for turnaround characteristics
  const hasNegativeMargins = (data.netMargin ?? 0) < 0;
  const recentRecovery =
    historical.length > 0 &&
    (historical[0].netMargin ?? 0) < 0 &&
    (data.netMargin ?? 0) > 0;

  if (hasNegativeMargins || recentRecovery) {
    return 'turnaround';
  }

  if (epsGrowth === null) return 'unknown';

  // Classify based on growth rate
  if (epsGrowth >= THRESHOLDS.EPS_GROWTH_FAST) {
    return 'fast_grower';
  } else if (epsGrowth >= THRESHOLDS.EPS_GROWTH_STALWART) {
    return 'stalwart';
  } else if (epsGrowth >= THRESHOLDS.EPS_GROWTH_SLOW) {
    return 'slow_grower';
  } else if (epsGrowth < 0) {
    // Check for cyclical patterns
    const growthRates = [data, ...historical]
      .map((h) => h.epsGrowth)
      .filter((g): g is number => g !== null);

    if (growthRates.length >= 3) {
      const hasNegatives = growthRates.some((g) => g < 0);
      const hasPositives = growthRates.some((g) => g > THRESHOLDS.EPS_GROWTH_STALWART);
      if (hasNegatives && hasPositives) {
        return 'cyclical';
      }
    }
    return 'turnaround';
  }

  return 'unknown';
}

/**
 * Score PEG/PEGY valuation (core Lynch metric)
 */
function scorePEGValuation(data: LynchInput): { score: number; details: string[]; peg: number | null; pegy: number | null } {
  const details: string[] = [];

  const peRatio = data.peRatio;
  const epsGrowth = data.epsGrowth;
  const dividendYield = data.dividendYield ?? 0;

  if (peRatio === null || peRatio <= 0) {
    return { score: 0, details: ['P/E ratio not available'], peg: null, pegy: null };
  }

  if (epsGrowth === null || epsGrowth <= 0) {
    // No growth - can only evaluate P/E directly
    let score = 0;
    if (peRatio <= THRESHOLDS.PE_VERY_LOW) {
      score = 0.5;
      details.push(`P/E ${peRatio.toFixed(1)} (low, but no growth data)`);
    } else {
      score = 0.2;
      details.push(`P/E ${peRatio.toFixed(1)} (cannot calculate PEG without growth)`);
    }
    return { score, details, peg: null, pegy: null };
  }

  // Calculate PEG
  const peg = calculatePEG(peRatio, epsGrowth);
  const pegy = dividendYield > 0 ? calculatePEGY(peRatio, epsGrowth, dividendYield) : null;

  let score = 0;

  if (peg !== null) {
    if (peg <= THRESHOLDS.PEG_VERY_ATTRACTIVE) {
      score = 1.0;
      details.push(`PEG ${peg.toFixed(2)} (very attractive - potential bargain)`);
    } else if (peg <= THRESHOLDS.PEG_ATTRACTIVE) {
      score = 0.85;
      details.push(`PEG ${peg.toFixed(2)} (attractive)`);
    } else if (peg <= THRESHOLDS.PEG_FAIR) {
      score = 0.70;
      details.push(`PEG ${peg.toFixed(2)} (fairly valued)`);
    } else if (peg <= THRESHOLDS.PEG_SLIGHTLY_HIGH) {
      score = 0.55;
      details.push(`PEG ${peg.toFixed(2)} (slightly elevated)`);
    } else if (peg <= THRESHOLDS.PEG_EXPENSIVE) {
      score = 0.35;
      details.push(`PEG ${peg.toFixed(2)} (getting expensive)`);
    } else {
      score = 0.15;
      details.push(`PEG ${peg.toFixed(2)} (expensive relative to growth)`);
    }
  }

  // Add PEGY context for dividend payers
  if (pegy !== null && dividendYield > 0.01) {
    if (pegy <= THRESHOLDS.PEGY_ATTRACTIVE) {
      details.push(`PEGY ${pegy.toFixed(2)} (attractive with ${(dividendYield * 100).toFixed(1)}% yield)`);
      score = Math.max(score, 0.75); // PEGY can improve overall score
    } else if (pegy <= THRESHOLDS.PEGY_FAIR) {
      details.push(`PEGY ${pegy.toFixed(2)}`);
    }
  }

  return { score, details, peg, pegy };
}

/**
 * Score EPS growth quality and consistency
 */
function scoreGrowthQuality(
  current: LynchInput,
  historical: LynchInput[]
): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Current EPS growth (0-40 points)
  if (current.epsGrowth !== null) {
    maxPoints += 40;
    if (current.epsGrowth >= THRESHOLDS.EPS_GROWTH_FAST) {
      totalPoints += 40;
      details.push(`EPS Growth ${(current.epsGrowth * 100).toFixed(1)}% (fast grower)`);
    } else if (current.epsGrowth >= THRESHOLDS.EPS_GROWTH_STALWART) {
      totalPoints += 30;
      details.push(`EPS Growth ${(current.epsGrowth * 100).toFixed(1)}% (stalwart)`);
    } else if (current.epsGrowth >= THRESHOLDS.EPS_GROWTH_SLOW) {
      totalPoints += 18;
      details.push(`EPS Growth ${(current.epsGrowth * 100).toFixed(1)}% (slow grower)`);
    } else if (current.epsGrowth > 0) {
      totalPoints += 10;
    } else {
      details.push(`EPS Growth ${(current.epsGrowth * 100).toFixed(1)}% (declining)`);
    }
  }

  // Growth consistency over time (0-35 points)
  if (historical.length >= 2) {
    maxPoints += 35;
    const allGrowths = [current, ...historical]
      .map((h) => h.epsGrowth)
      .filter((g): g is number => g !== null);

    if (allGrowths.length >= 2) {
      const positiveYears = allGrowths.filter((g) => g > 0).length;
      const avgGrowth = allGrowths.reduce((a, b) => a + b, 0) / allGrowths.length;
      const consistencyRatio = positiveYears / allGrowths.length;

      if (consistencyRatio >= 0.8 && avgGrowth >= THRESHOLDS.EPS_GROWTH_STALWART) {
        totalPoints += 35;
        details.push(`Consistent growth: ${positiveYears}/${allGrowths.length} years positive`);
      } else if (consistencyRatio >= 0.6) {
        totalPoints += 25;
      } else {
        totalPoints += 10;
        details.push('Inconsistent earnings growth pattern');
      }
    }
  }

  // Revenue growth supports EPS growth (0-25 points)
  if (current.revenueGrowth !== null) {
    maxPoints += 25;
    if (current.revenueGrowth >= 0.15) {
      totalPoints += 25;
    } else if (current.revenueGrowth >= 0.08) {
      totalPoints += 18;
    } else if (current.revenueGrowth > 0) {
      totalPoints += 10;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Score balance sheet strength
 */
function scoreBalanceSheet(data: LynchInput): { score: number; details: string[] } {
  const details: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Debt to Equity (0-40 points)
  if (data.debtToEquity !== null) {
    maxPoints += 40;
    if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_CONSERVATIVE) {
      totalPoints += 40;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (conservative)`);
    } else if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_MODERATE) {
      totalPoints += 28;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (moderate)`);
    } else if (data.debtToEquity <= THRESHOLDS.DEBT_TO_EQUITY_HIGH) {
      totalPoints += 12;
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (elevated)`);
    } else {
      details.push(`Debt/Equity ${data.debtToEquity.toFixed(2)} (high leverage risk)`);
    }
  }

  // Interest Coverage (0-30 points)
  if (data.interestCoverage !== null) {
    maxPoints += 30;
    if (data.interestCoverage >= THRESHOLDS.INTEREST_COVERAGE_STRONG) {
      totalPoints += 30;
    } else if (data.interestCoverage >= THRESHOLDS.INTEREST_COVERAGE_ADEQUATE) {
      totalPoints += 20;
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

  // FCF Yield as cash quality check (0-15 points)
  if (data.fcfYield !== null) {
    maxPoints += 15;
    if (data.fcfYield >= 0.08) {
      totalPoints += 15;
    } else if (data.fcfYield >= 0.05) {
      totalPoints += 10;
    } else if (data.fcfYield > 0) {
      totalPoints += 5;
    }
  }

  return {
    score: maxPoints > 0 ? totalPoints / maxPoints : 0,
    details,
  };
}

/**
 * Score story-numbers alignment (qualitative consistency check)
 * The "story" (growth thesis) must be supported by actual numbers
 */
function scoreStoryAlignment(
  current: LynchInput,
  category: LynchCategory,
  pegScore: number
): { score: number; details: string[] } {
  const details: string[] = [];
  let score = 0;

  // Based on category, check if numbers support the expected characteristics
  switch (category) {
    case 'fast_grower':
      // Fast growers should have high growth AND reasonable PEG
      if (
        (current.epsGrowth ?? 0) >= 0.20 &&
        (current.revenueGrowth ?? 0) >= 0.15 &&
        pegScore >= 0.6
      ) {
        score = 1.0;
        details.push('Fast grower profile: High growth at reasonable valuation');
      } else if ((current.epsGrowth ?? 0) >= 0.15) {
        score = 0.7;
        details.push('Moderate fast grower profile');
      } else {
        score = 0.4;
        details.push('Growth not meeting fast grower expectations');
      }
      break;

    case 'stalwart':
      // Stalwarts should be steady, profitable, with modest valuation
      if (
        (current.epsGrowth ?? 0) >= 0.08 &&
        (current.roe ?? 0) >= 0.12 &&
        (current.peRatio ?? 20) <= 22
      ) {
        score = 1.0;
        details.push('Stalwart profile: Steady growth, profitable, reasonably valued');
      } else if ((current.roe ?? 0) >= 0.10) {
        score = 0.7;
      } else {
        score = 0.4;
      }
      break;

    case 'slow_grower':
      // Slow growers need high dividends and low valuation
      if (
        (current.dividendYield ?? 0) >= 0.03 &&
        (current.peRatio ?? 15) <= 15
      ) {
        score = 0.9;
        details.push('Slow grower profile: Low valuation with dividend yield');
      } else if ((current.dividendYield ?? 0) >= 0.02) {
        score = 0.6;
      } else {
        score = 0.3;
        details.push('Slow grower without compelling dividend yield');
      }
      break;

    case 'turnaround':
      // Turnarounds need improving margins and reasonable debt
      if (
        (current.netMargin ?? 0) > 0 &&
        (current.debtToEquity ?? 2) < 1.5
      ) {
        score = 0.8;
        details.push('Turnaround profile: Returning to profitability');
      } else {
        score = 0.4;
        details.push('Turnaround still in progress');
      }
      break;

    case 'cyclical':
      // Cyclicals - valuation matters most at cycle bottom
      if ((current.peRatio ?? 20) <= 12 && (current.operatingMargin ?? 0) > 0) {
        score = 0.8;
        details.push('Cyclical at potentially attractive valuation');
      } else {
        score = 0.5;
      }
      break;

    default:
      score = 0.5; // Neutral for unknown category
      details.push('Unable to classify stock type');
  }

  return { score, details };
}

/**
 * Main Lynch GARP analysis function
 */
export function analyzeLynch(data: LynchHistoricalData): ModelVote {
  const { current, historical } = data;

  // Infer stock category
  const category = inferCategory(current, historical);

  // Calculate individual scores
  const pegValuation = scorePEGValuation(current);
  const growthQuality = scoreGrowthQuality(current, historical);
  const balanceSheet = scoreBalanceSheet(current);
  const storyAlignment = scoreStoryAlignment(current, category, pegValuation.score);

  // Lynch weighting (GARP focused):
  // PEG/PEGY Valuation = 35% (core Lynch metric)
  // Growth Quality = 25%
  // Balance Sheet = 20%
  // Story-Numbers Alignment = 20%
  const totalScore =
    pegValuation.score * 0.35 +
    growthQuality.score * 0.25 +
    balanceSheet.score * 0.20 +
    storyAlignment.score * 0.20;

  // Collect all reasons
  const allReasons = [
    ...pegValuation.details,
    ...growthQuality.details,
    ...balanceSheet.details,
    ...storyAlignment.details,
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
  const scoreDecisiveness = Math.abs(totalScore - 0.5) * 2;
  const confidence = Math.min(1, dataCompleteness * 0.6 + scoreDecisiveness * 0.4);

  return {
    rating,
    confidence,
    reasons: [...allReasons.slice(0, 7), `Category: ${category.replace('_', ' ')}`],
    keyMetrics: {
      peRatio: current.peRatio,
      epsGrowth: current.epsGrowth,
      peg: pegValuation.peg,
      pegy: pegValuation.pegy,
      debtToEquity: current.debtToEquity,
      roe: current.roe,
      fcfYield: current.fcfYield,
      totalScore: Math.round(totalScore * 100),
    },
  };
}

/**
 * Calculate data completeness for confidence adjustment
 */
function calculateDataCompleteness(data: LynchInput): number {
  const fields = [
    data.peRatio,
    data.epsGrowth,
    data.revenueGrowth,
    data.debtToEquity,
    data.currentRatio,
    data.fcfYield,
    data.roe,
  ];

  const nonNull = fields.filter((f) => f !== null).length;
  return nonNull / fields.length;
}

export { calculatePEG, calculatePEGY, inferCategory };
export type { LynchInput, LynchHistoricalData, LynchCategory };
