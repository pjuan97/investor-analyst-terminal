/**
 * Adam Seessel BMP (Business, Management, Price) Investment Model
 *
 * Philosophy: Buy wonderful digital-age businesses at reasonable prices
 * Focus: Asset-light models, high FCF margins, rational capital allocation,
 *        GAAP-adjusted economics (R&D as investment, SBC as real cost)
 *
 * Scoring weights:
 *   Business Quality  — 50%
 *   Management Quality — 25%
 *   Price              — 25%
 */

import type { Rating, ModelVote } from '@/types';

export interface SeesselInput {
  fiscalYear: number;

  // Revenue quality
  revenueGrowthCagr3y: number | null;
  grossMargin: number | null;
  fcfMargin: number | null;

  // GAAP adjustment proxies
  rdAsPercentRevenue: number | null; // R&D / Revenue
  sbcAsPercentRevenue: number | null; // SBC / Revenue

  // Dilution
  netDilutionPercent: number | null; // YoY diluted shares change

  // Valuation
  evToFcf: number | null;

  // Asset intensity
  ppeTotalAssetsRatio: number | null; // PP&E / Total Assets
}

export interface SeesselHistoricalData {
  current: SeesselInput;
  historical: SeesselInput[];
}

interface SeesselResult {
  rating: Rating;
  confidence: number; // 0-1 (stored 0-1, displayed 0-100)
  score: number; // 0-100
  components: {
    business: number;
    management: number;
    price: number;
  };
  keyFindings: string[];
  flags: string[]; // [DATA UNAVAILABLE] fields
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

function scoreBusiness(data: SeesselInput): {
  score: number;
  findings: string[];
  flags: string[];
} {
  const findings: string[] = [];
  const flags: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // Gross Margin
  if (data.grossMargin !== null) {
    maxPoints += 100;
    if (data.grossMargin >= 0.70) {
      totalPoints += 100;
      findings.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (exceptional — digital-era business)`);
    } else if (data.grossMargin >= 0.60) {
      totalPoints += 75;
      findings.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (strong)`);
    } else if (data.grossMargin >= 0.50) {
      totalPoints += 50;
      findings.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (adequate)`);
    } else {
      totalPoints += 25;
      findings.push(`Gross Margin ${(data.grossMargin * 100).toFixed(1)}% (below BMP threshold)`);
    }
  } else {
    flags.push('grossMargin [DATA UNAVAILABLE]');
  }

  // Revenue Growth CAGR 3Y
  if (data.revenueGrowthCagr3y !== null) {
    maxPoints += 100;
    if (data.revenueGrowthCagr3y >= 0.20) {
      totalPoints += 100;
      findings.push(`Revenue CAGR (3Y) ${(data.revenueGrowthCagr3y * 100).toFixed(1)}% (high growth)`);
    } else if (data.revenueGrowthCagr3y >= 0.10) {
      totalPoints += 75;
      findings.push(`Revenue CAGR (3Y) ${(data.revenueGrowthCagr3y * 100).toFixed(1)}% (good growth)`);
    } else if (data.revenueGrowthCagr3y >= 0.05) {
      totalPoints += 50;
      findings.push(`Revenue CAGR (3Y) ${(data.revenueGrowthCagr3y * 100).toFixed(1)}% (moderate growth)`);
    } else {
      totalPoints += 25;
      findings.push(`Revenue CAGR (3Y) ${(data.revenueGrowthCagr3y * 100).toFixed(1)}% (slow growth)`);
    }
  } else {
    flags.push('revenueGrowthCagr3y [DATA UNAVAILABLE]');
  }

  // FCF Margin
  if (data.fcfMargin !== null) {
    maxPoints += 100;
    if (data.fcfMargin >= 0.20) {
      totalPoints += 100;
      findings.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (excellent cash generation)`);
    } else if (data.fcfMargin >= 0.10) {
      totalPoints += 75;
      findings.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (solid)`);
    } else if (data.fcfMargin >= 0.05) {
      totalPoints += 50;
      findings.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (acceptable)`);
    } else {
      totalPoints += 25;
      findings.push(`FCF Margin ${(data.fcfMargin * 100).toFixed(1)}% (weak)`);
    }
  } else {
    flags.push('fcfMargin [DATA UNAVAILABLE]');
  }

  // PP&E / Total Assets (asset-light signal — lower is better)
  if (data.ppeTotalAssetsRatio !== null) {
    maxPoints += 100;
    if (data.ppeTotalAssetsRatio <= 0.10) {
      totalPoints += 100;
      findings.push(`PP&E/Assets ${(data.ppeTotalAssetsRatio * 100).toFixed(1)}% (very asset-light)`);
    } else if (data.ppeTotalAssetsRatio <= 0.20) {
      totalPoints += 75;
      findings.push(`PP&E/Assets ${(data.ppeTotalAssetsRatio * 100).toFixed(1)}% (asset-light)`);
    } else if (data.ppeTotalAssetsRatio <= 0.40) {
      totalPoints += 50;
      findings.push(`PP&E/Assets ${(data.ppeTotalAssetsRatio * 100).toFixed(1)}% (moderate)`);
    } else {
      totalPoints += 25;
      findings.push(`PP&E/Assets ${(data.ppeTotalAssetsRatio * 100).toFixed(1)}% (asset-heavy)`);
    }
  } else {
    flags.push('ppeTotalAssetsRatio [DATA UNAVAILABLE]');
  }

  // R&D as % Revenue (investing in moat maintenance)
  if (data.rdAsPercentRevenue !== null) {
    maxPoints += 100;
    if (data.rdAsPercentRevenue >= 0.10 && data.rdAsPercentRevenue <= 0.30) {
      totalPoints += 100;
      findings.push(`R&D/Revenue ${(data.rdAsPercentRevenue * 100).toFixed(1)}% (sweet spot — investing in moat)`);
    } else if (data.rdAsPercentRevenue > 0.30) {
      totalPoints += 75;
      findings.push(`R&D/Revenue ${(data.rdAsPercentRevenue * 100).toFixed(1)}% (heavy — may need GAAP adjustment)`);
    } else {
      totalPoints += 50;
      findings.push(`R&D/Revenue ${(data.rdAsPercentRevenue * 100).toFixed(1)}% (low — limited moat reinvestment)`);
    }
  } else {
    flags.push('rdAsPercentRevenue [DATA UNAVAILABLE]');
  }

  return {
    score: maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0,
    findings,
    flags,
  };
}

function scoreManagement(data: SeesselInput): {
  score: number;
  findings: string[];
  flags: string[];
} {
  const findings: string[] = [];
  const flags: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // SBC as % Revenue
  if (data.sbcAsPercentRevenue !== null) {
    maxPoints += 100;
    if (data.sbcAsPercentRevenue <= 0.03) {
      totalPoints += 100;
      findings.push(`SBC/Revenue ${(data.sbcAsPercentRevenue * 100).toFixed(1)}% (shareholder-friendly)`);
    } else if (data.sbcAsPercentRevenue <= 0.05) {
      totalPoints += 75;
      findings.push(`SBC/Revenue ${(data.sbcAsPercentRevenue * 100).toFixed(1)}% (acceptable)`);
    } else if (data.sbcAsPercentRevenue <= 0.10) {
      totalPoints += 50;
      findings.push(`SBC/Revenue ${(data.sbcAsPercentRevenue * 100).toFixed(1)}% (elevated — dilution risk)`);
    } else {
      totalPoints += 25;
      findings.push(`SBC/Revenue ${(data.sbcAsPercentRevenue * 100).toFixed(1)}% (excessive dilution)`);
    }
  } else {
    flags.push('sbcAsPercentRevenue [DATA UNAVAILABLE]');
  }

  // Net Dilution (YoY diluted shares change)
  if (data.netDilutionPercent !== null) {
    maxPoints += 100;
    if (data.netDilutionPercent <= 0.0) {
      totalPoints += 100;
      findings.push(`Net Dilution ${(data.netDilutionPercent * 100).toFixed(1)}% (buybacks exceeding SBC — excellent)`);
    } else if (data.netDilutionPercent <= 0.02) {
      totalPoints += 80;
      findings.push(`Net Dilution ${(data.netDilutionPercent * 100).toFixed(1)}% (minimal)`);
    } else if (data.netDilutionPercent <= 0.05) {
      totalPoints += 50;
      findings.push(`Net Dilution ${(data.netDilutionPercent * 100).toFixed(1)}% (moderate)`);
    } else {
      totalPoints += 25;
      findings.push(`Net Dilution ${(data.netDilutionPercent * 100).toFixed(1)}% (significant)`);
    }
  } else {
    flags.push('netDilutionPercent [DATA UNAVAILABLE]');
  }

  return {
    score: maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0,
    findings,
    flags,
  };
}

function scorePrice(data: SeesselInput): {
  score: number;
  findings: string[];
  flags: string[];
} {
  const findings: string[] = [];
  const flags: string[] = [];
  let totalPoints = 0;
  let maxPoints = 0;

  // EV/FCF
  if (data.evToFcf !== null) {
    maxPoints += 100;
    if (data.evToFcf <= 20) {
      totalPoints += 100;
      findings.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (cheap — strong margin of safety)`);
    } else if (data.evToFcf <= 35) {
      totalPoints += 75;
      findings.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (fair — reasonable for quality business)`);
    } else if (data.evToFcf <= 50) {
      totalPoints += 50;
      findings.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (expensive — requires high growth assumption)`);
    } else {
      totalPoints += 25;
      findings.push(`EV/FCF ${data.evToFcf.toFixed(1)}x (very expensive)`);
    }
  } else {
    flags.push('evToFcf [DATA UNAVAILABLE]');
  }

  return {
    score: maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0,
    findings,
    flags,
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

function analyzeSeessel(data: SeesselHistoricalData): SeesselResult {
  const { current } = data;

  const business = scoreBusiness(current);
  const management = scoreManagement(current);
  const price = scorePrice(current);

  // Weighted final score
  const finalScore =
    business.score * 0.50 +
    management.score * 0.25 +
    price.score * 0.25;

  // Rating
  let rating: Rating;
  if (finalScore >= 70) {
    rating = 'BUY';
  } else if (finalScore >= 50) {
    rating = 'HOLD';
  } else {
    rating = 'SELL';
  }

  // Confidence: based on data availability and score decisiveness
  const allFlags = [...business.flags, ...management.flags, ...price.flags];
  const totalInputs = 8; // total possible inputs
  const availableInputs = totalInputs - allFlags.length;
  const dataCompleteness = availableInputs / totalInputs;
  const scoreDecisiveness = Math.abs(finalScore - 50) / 50; // 0 at 50, 1 at 0 or 100
  const confidence = Math.min(1, dataCompleteness * 0.6 + scoreDecisiveness * 0.4);

  return {
    rating,
    confidence,
    score: Math.round(finalScore),
    components: {
      business: Math.round(business.score),
      management: Math.round(management.score),
      price: Math.round(price.score),
    },
    keyFindings: [...business.findings, ...management.findings, ...price.findings],
    flags: allFlags,
  };
}

/**
 * Adapter: convert SeesselResult to the standard ModelVote interface
 * used by the aggregator in src/lib/models/index.ts
 */
export function analyzeSeesselAsVote(data: SeesselHistoricalData): ModelVote {
  const result = analyzeSeessel(data);

  return {
    rating: result.rating,
    confidence: result.confidence,
    reasons: [
      ...result.keyFindings.slice(0, 6),
      ...result.flags.map((f) => `Missing: ${f}`),
    ].slice(0, 8),
    keyMetrics: {
      grossMargin: data.current.grossMargin,
      fcfMargin: data.current.fcfMargin,
      evToFcf: data.current.evToFcf,
      rdAsPercentRevenue: data.current.rdAsPercentRevenue,
      sbcAsPercentRevenue: data.current.sbcAsPercentRevenue,
      netDilutionPercent: data.current.netDilutionPercent,
      totalScore: result.score,
    },
  };
}

export type { SeesselResult };
