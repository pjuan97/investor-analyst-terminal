/**
 * Investment Models Aggregator
 *
 * Combines analysis from 4 legendary investors:
 * 1. Warren Buffett - Quality at fair price
 * 2. Joel Greenblatt - Magic Formula (EY + ROC)
 * 3. Philip Fisher - Growth investing
 * 4. Peter Lynch - GARP (Growth at Reasonable Price)
 *
 * Generates unified BUY/HOLD/SELL recommendations with explanations.
 */

import type { Rating, ModelVote, ModelVotes, Recommendation } from '@/types';
import { analyzeBuffett, type BuffettHistoricalData } from './buffett';
import { analyzeGreenblatt, type GreenblattHistoricalData } from './greenblatt';
import { analyzeFisher, type FisherHistoricalData } from './fisher';
import { analyzeLynch, type LynchHistoricalData } from './lynch';
import { analyzeSeesselAsVote, type SeesselHistoricalData } from './seessel';

// Re-export individual models
export { analyzeBuffett } from './buffett';
export { analyzeGreenblatt } from './greenblatt';
export { analyzeFisher } from './fisher';
export { analyzeLynch } from './lynch';
export { analyzeSeesselAsVote } from './seessel';

/**
 * Unified input for all models
 * Contains all metrics needed by any model
 */
interface UnifiedMetricsInput {
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

  // Greenblatt Magic Formula
  earningsYieldMF: number | null;
  returnOnCapitalMF: number | null;

  // Quality
  qualityScore: number | null;

  // Optional - for Lynch
  dividendYield?: number | null;

  // Optional - for Seessel BMP
  revenueGrowthCagr3y?: number | null;
  rdAsPercentRevenue?: number | null;
  sbcAsPercentRevenue?: number | null;
  netDilutionPercent?: number | null;
  ppeTotalAssetsRatio?: number | null;
}

/**
 * Run all investment models and aggregate results
 */
export function runAllModels(
  current: UnifiedMetricsInput,
  historical: UnifiedMetricsInput[],
  currentPrice: number
): {
  votes: ModelVotes;
  recommendation: Recommendation;
} {
  // Prepare data for each model
  const buffettData: BuffettHistoricalData = {
    current: mapToBuffettInput(current),
    historical: historical.map(mapToBuffettInput),
  };

  const greenblattData: GreenblattHistoricalData = {
    current: mapToGreenblattInput(current),
    historical: historical.map(mapToGreenblattInput),
  };

  const fisherData: FisherHistoricalData = {
    current: mapToFisherInput(current),
    historical: historical.map(mapToFisherInput),
  };

  const lynchData: LynchHistoricalData = {
    current: mapToLynchInput(current),
    historical: historical.map(mapToLynchInput),
  };

  const seesselData: SeesselHistoricalData = {
    current: mapToSeesselInput(current),
    historical: historical.map(mapToSeesselInput),
  };

  // Run all models
  const buffettVote = analyzeBuffett(buffettData);
  const greenblattVote = analyzeGreenblatt(greenblattData);
  const fisherVote = analyzeFisher(fisherData);
  const lynchVote = analyzeLynch(lynchData);
  const seesselVote = analyzeSeesselAsVote(seesselData);

  const votes: ModelVotes = {
    buffett: buffettVote,
    greenblatt: greenblattVote,
    growth: fisherVote, // Fisher is the "growth" model
    lynch: lynchVote,
    seessel: seesselVote,
  };

  // Aggregate into final recommendation
  const recommendation = aggregateVotes(votes, current.fiscalYear, currentPrice);

  return { votes, recommendation };
}

/**
 * Map unified input to Buffett-specific input
 */
function mapToBuffettInput(data: UnifiedMetricsInput) {
  return {
    fiscalYear: data.fiscalYear,
    roe: data.roe,
    roic: data.roic,
    grossMargin: data.grossMargin,
    operatingMargin: data.operatingMargin,
    netMargin: data.netMargin,
    fcfMargin: data.fcfMargin,
    fcfPerShare: data.fcfPerShare,
    debtToEquity: data.debtToEquity,
    debtToEbitda: data.debtToEbitda,
    interestCoverage: data.interestCoverage,
    currentRatio: data.currentRatio,
    peRatio: data.peRatio,
    pbRatio: data.pbRatio,
    earningsYield: data.earningsYield,
    fcfYield: data.fcfYield,
    revenueGrowth: data.revenueGrowth,
    epsGrowth: data.epsGrowth,
    fcfGrowth: data.fcfGrowth,
  };
}

/**
 * Map unified input to Greenblatt-specific input
 */
function mapToGreenblattInput(data: UnifiedMetricsInput) {
  return {
    fiscalYear: data.fiscalYear,
    earningsYieldMF: data.earningsYieldMF,
    returnOnCapitalMF: data.returnOnCapitalMF,
    earningsYield: data.earningsYield,
    roic: data.roic,
    marketCap: data.marketCap,
    enterpriseValue: data.enterpriseValue,
    evToEbitda: data.evToEbitda,
    evToFcf: data.evToFcf,
    operatingMargin: data.operatingMargin,
    netMargin: data.netMargin,
    debtToEquity: data.debtToEquity,
    currentRatio: data.currentRatio,
  };
}

/**
 * Map unified input to Fisher-specific input
 */
function mapToFisherInput(data: UnifiedMetricsInput) {
  return {
    fiscalYear: data.fiscalYear,
    revenueGrowth: data.revenueGrowth,
    epsGrowth: data.epsGrowth,
    fcfGrowth: data.fcfGrowth,
    grossMargin: data.grossMargin,
    operatingMargin: data.operatingMargin,
    netMargin: data.netMargin,
    roe: data.roe,
    roic: data.roic,
    roce: data.roce,
    debtToEquity: data.debtToEquity,
    debtToEbitda: data.debtToEbitda,
    currentRatio: data.currentRatio,
    interestCoverage: data.interestCoverage,
    fcfMargin: data.fcfMargin,
    fcfYield: data.fcfYield,
    qualityScore: data.qualityScore,
  };
}

/**
 * Map unified input to Lynch-specific input
 */
function mapToLynchInput(data: UnifiedMetricsInput) {
  return {
    fiscalYear: data.fiscalYear,
    peRatio: data.peRatio,
    epsGrowth: data.epsGrowth,
    revenueGrowth: data.revenueGrowth,
    dividendYield: data.dividendYield,
    psRatio: data.psRatio,
    pbRatio: data.pbRatio,
    earningsYield: data.earningsYield,
    debtToEquity: data.debtToEquity,
    currentRatio: data.currentRatio,
    interestCoverage: data.interestCoverage,
    fcfMargin: data.fcfMargin,
    fcfYield: data.fcfYield,
    netMargin: data.netMargin,
    roe: data.roe,
    operatingMargin: data.operatingMargin,
  };
}

/**
 * Map unified input to Seessel-specific input
 */
function mapToSeesselInput(data: UnifiedMetricsInput) {
  return {
    fiscalYear: data.fiscalYear,
    revenueGrowthCagr3y: data.revenueGrowthCagr3y ?? null,
    grossMargin: data.grossMargin,
    fcfMargin: data.fcfMargin,
    rdAsPercentRevenue: data.rdAsPercentRevenue ?? null,
    sbcAsPercentRevenue: data.sbcAsPercentRevenue ?? null,
    netDilutionPercent: data.netDilutionPercent ?? null,
    evToFcf: data.evToFcf,
    ppeTotalAssetsRatio: data.ppeTotalAssetsRatio ?? null,
  };
}

/**
 * Aggregate model votes into final recommendation
 */
function aggregateVotes(
  votes: ModelVotes,
  metricsYear: number,
  priceAtRec: number
): Recommendation {
  const modelVotes = Object.values(votes).filter(
    (v): v is ModelVote => v !== undefined
  );

  if (modelVotes.length === 0) {
    return {
      rating: 'HOLD',
      confidence: 0,
      modelVotes: votes,
      explanationShort: 'Insufficient data for analysis',
      explanationFull: 'No models could be executed due to missing data.',
      triggers: ['Obtain more financial data'],
      priceAtRec,
      metricsYear,
    };
  }

  // Calculate weighted votes
  // Weight each model by its confidence
  let buyScore = 0;
  let holdScore = 0;
  let sellScore = 0;
  let totalWeight = 0;

  for (const vote of modelVotes) {
    const weight = vote.confidence;
    totalWeight += weight;

    switch (vote.rating) {
      case 'BUY':
        buyScore += weight;
        break;
      case 'HOLD':
        holdScore += weight;
        break;
      case 'SELL':
        sellScore += weight;
        break;
    }
  }

  // Normalize scores
  if (totalWeight > 0) {
    buyScore /= totalWeight;
    holdScore /= totalWeight;
    sellScore /= totalWeight;
  }

  // Determine final rating
  let rating: Rating;
  let confidence: number;

  if (buyScore >= 0.5) {
    rating = 'BUY';
    confidence = buyScore;
  } else if (sellScore >= 0.5) {
    rating = 'SELL';
    confidence = sellScore;
  } else {
    rating = 'HOLD';
    confidence = holdScore;
  }

  // Count agreement
  const buyModels = modelVotes.filter((v) => v.rating === 'BUY').length;
  const holdModels = modelVotes.filter((v) => v.rating === 'HOLD').length;
  const sellModels = modelVotes.filter((v) => v.rating === 'SELL').length;

  // Generate explanations
  const { explanationShort, explanationFull } = generateExplanations(
    votes,
    rating,
    buyModels,
    holdModels,
    sellModels
  );

  // Generate triggers (what could change the recommendation)
  const triggers = generateTriggers(votes, rating);

  return {
    rating,
    confidence: Math.min(confidence, 1),
    modelVotes: votes,
    explanationShort,
    explanationFull,
    triggers,
    priceAtRec,
    metricsYear,
  };
}

/**
 * Generate human-readable explanations
 */
function generateExplanations(
  votes: ModelVotes,
  rating: Rating,
  buyCount: number,
  holdCount: number,
  sellCount: number
): { explanationShort: string; explanationFull: string } {
  const total = buyCount + holdCount + sellCount;

  // Short explanation (1-2 sentences)
  let explanationShort: string;
  if (rating === 'BUY') {
    explanationShort = `${buyCount} of ${total} investment models recommend BUY. The company shows strong fundamentals across multiple analytical frameworks.`;
  } else if (rating === 'SELL') {
    explanationShort = `${sellCount} of ${total} investment models recommend SELL. Key metrics fall short of investment criteria across multiple frameworks.`;
  } else {
    explanationShort = `Mixed signals from ${total} investment models. The company shows some strengths but also areas of concern.`;
  }

  // Full explanation (detailed breakdown)
  const sections: string[] = [];

  // Buffett analysis
  if (votes.buffett) {
    sections.push(`BUFFETT (Quality): ${votes.buffett.rating} (${Math.round(votes.buffett.confidence * 100)}% confidence)`);
    sections.push(`  Key factors: ${votes.buffett.reasons.slice(0, 3).join('; ')}`);
  }

  // Greenblatt analysis
  if (votes.greenblatt) {
    sections.push(`GREENBLATT (Magic Formula): ${votes.greenblatt.rating} (${Math.round(votes.greenblatt.confidence * 100)}% confidence)`);
    sections.push(`  Key factors: ${votes.greenblatt.reasons.slice(0, 3).join('; ')}`);
  }

  // Fisher analysis
  if (votes.growth) {
    sections.push(`FISHER (Growth): ${votes.growth.rating} (${Math.round(votes.growth.confidence * 100)}% confidence)`);
    sections.push(`  Key factors: ${votes.growth.reasons.slice(0, 3).join('; ')}`);
  }

  // Lynch analysis
  if (votes.lynch) {
    sections.push(`LYNCH (GARP): ${votes.lynch.rating} (${Math.round(votes.lynch.confidence * 100)}% confidence)`);
    sections.push(`  Key factors: ${votes.lynch.reasons.slice(0, 3).join('; ')}`);
  }

  // Seessel analysis
  if (votes.seessel) {
    sections.push(`SEESSEL (BMP): ${votes.seessel.rating} (${Math.round(votes.seessel.confidence * 100)}% confidence)`);
    sections.push(`  Key factors: ${votes.seessel.reasons.slice(0, 3).join('; ')}`);
  }

  const explanationFull = sections.join('\n\n');

  return { explanationShort, explanationFull };
}

/**
 * Generate triggers that could change the recommendation
 */
function generateTriggers(votes: ModelVotes, currentRating: Rating): string[] {
  const triggers: string[] = [];

  // If BUY, what could make it worse?
  if (currentRating === 'BUY') {
    if (votes.buffett?.keyMetrics.roe && Number(votes.buffett.keyMetrics.roe) < 0.20) {
      triggers.push('ROE falling below 15% would weaken quality thesis');
    }
    if (votes.greenblatt?.keyMetrics.evToEbitda && Number(votes.greenblatt.keyMetrics.evToEbitda) < 8) {
      triggers.push('EV/EBITDA rising above 12x would reduce value proposition');
    }
    if (votes.growth?.keyMetrics.revenueGrowth && Number(votes.growth.keyMetrics.revenueGrowth) > 0.10) {
      triggers.push('Revenue growth slowing below 10% would hurt growth thesis');
    }
    triggers.push('Significant increase in debt levels');
    triggers.push('Margin compression or deteriorating profitability');
  }

  // If HOLD, what could improve or worsen?
  if (currentRating === 'HOLD') {
    triggers.push('Improvement in profitability metrics could upgrade to BUY');
    triggers.push('Valuation becoming more attractive (P/E, EV/EBITDA declining)');
    triggers.push('Deteriorating margins or rising debt could downgrade to SELL');
    triggers.push('Accelerating revenue/EPS growth could upgrade to BUY');
  }

  // If SELL, what could improve?
  if (currentRating === 'SELL') {
    triggers.push('Significant improvement in return metrics (ROE, ROIC)');
    triggers.push('Debt reduction and balance sheet strengthening');
    triggers.push('Margin expansion and profitability improvement');
    triggers.push('Valuation becoming attractive relative to peers');
  }

  return triggers.slice(0, 5);
}

export type { UnifiedMetricsInput };
