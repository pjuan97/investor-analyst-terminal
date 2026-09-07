import type { Opportunity, OpportunityScan, Signal } from './types';
import {
  type MetricsSnapshot,
  type ModelVote,
  modelConsensusSignal,
  cheapVsHistorySignal,
  drawdownSignal,
  divergenceSignal,
  earningsYieldSignal,
  fcfQualitySignal,
  growthSignal,
  dataQualitySignal,
  computeDeltas,
  deltaPoints,
} from './signals';

// ============================================================================
// OPPORTUNITY SCORING — deterministic ranking across the whole watchlist
// ============================================================================

export const DEFAULT_HURDLE_RATE = 0.10;

export interface PricePoint {
  date: Date | string;
  close: number;
}

export interface RecommendationSnapshot {
  rating: 'BUY' | 'HOLD' | 'SELL';
  confidence: number;
  modelVotes: Record<string, ModelVote>;
  fiscalYear: number | null;
}

export interface CompanyScanInput {
  companyId: string;
  ticker: string;
  name: string;
  currency: string;
  dataQualityScore: number | null;
  /** Most recent fiscal year first. */
  metrics: MetricsSnapshot[];
  /** Most recent date first. */
  prices: PricePoint[];
  currentRec: RecommendationSnapshot | null;
  previousRec: RecommendationSnapshot | null;
}

// ---------------------------------------------------------------------------
// Price context
// ---------------------------------------------------------------------------

const TRADING_DAYS_52W = 252;
const TRADING_DAYS_30D = 21;

interface PriceContext {
  price: number | null;
  drawdownFromHigh: number | null;
  priceChange30d: number | null;
}

export function priceContext(prices: PricePoint[]): PriceContext {
  if (prices.length === 0) {
    return { price: null, drawdownFromHigh: null, priceChange30d: null };
  }

  const closes = prices.map((p) => p.close).filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length === 0) {
    return { price: null, drawdownFromHigh: null, priceChange30d: null };
  }

  const price = closes[0];
  const window52w = closes.slice(0, TRADING_DAYS_52W);
  const high = Math.max(...window52w);
  const drawdownFromHigh = high > 0 ? price / high - 1 : null;

  const past = closes[Math.min(TRADING_DAYS_30D, closes.length - 1)];
  const priceChange30d = past && past > 0 ? price / past - 1 : null;

  return { price, drawdownFromHigh, priceChange30d };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** BVC-listed Colombian tickers carry the `.CL` suffix (see lib/providers isBvcTicker). */
function marketOf(ticker: string): 'BVC' | 'WALL_STREET' {
  return ticker.toUpperCase().endsWith('.CL') ? 'BVC' : 'WALL_STREET';
}

export function scoreCompany(
  input: CompanyScanInput,
  hurdleRate: number = DEFAULT_HURDLE_RATE
): Opportunity | null {
  const latest = input.metrics[0];
  if (!latest) return null;

  const history = input.metrics.slice(1);
  const { price, drawdownFromHigh, priceChange30d } = priceContext(input.prices);

  const signals: Signal[] = [];
  const push = (s: Signal | null) => {
    if (s) signals.push(s);
  };

  if (input.currentRec) push(modelConsensusSignal(input.currentRec.modelVotes));
  push(cheapVsHistorySignal(latest, history));
  push(drawdownSignal(drawdownFromHigh));
  push(divergenceSignal(drawdownFromHigh, latest));
  push(earningsYieldSignal(latest.earningsYield, hurdleRate));
  push(fcfQualitySignal(latest.fcfMargin));
  push(growthSignal(latest.revenueGrowth));
  push(dataQualitySignal(input.dataQualityScore));

  const deltas = input.currentRec
    ? computeDeltas(
        {
          rating: input.currentRec.rating,
          confidence: input.currentRec.confidence,
          fiscalYear: input.currentRec.fiscalYear,
        },
        input.previousRec
          ? {
              rating: input.previousRec.rating,
              confidence: input.previousRec.confidence,
              fiscalYear: input.previousRec.fiscalYear,
            }
          : null
      )
    : [];

  const raw =
    signals.reduce((sum, s) => sum + s.points, 0) + deltaPoints(deltas);

  return {
    companyId: input.companyId,
    ticker: input.ticker,
    name: input.name,
    market: marketOf(input.ticker),
    currency: input.currency,
    score: Math.max(0, Math.min(100, Math.round(raw))),
    signals,
    deltas,
    price,
    priceChange30d,
    drawdownFromHigh,
    peRatio: latest.peRatio,
    evToFcf: latest.evToFcf,
    earningsYield: latest.earningsYield,
    rating: input.currentRec?.rating ?? null,
    confidence: input.currentRec?.confidence ?? null,
    dataQuality: input.dataQualityScore,
    fiscalYear: latest.fiscalYear,
  };
}

export function rankOpportunities(
  inputs: CompanyScanInput[],
  hurdleRate: number = DEFAULT_HURDLE_RATE
): OpportunityScan {
  const opportunities: Opportunity[] = [];
  const skipped: { ticker: string; reason: string }[] = [];

  for (const input of inputs) {
    if (input.metrics.length === 0) {
      skipped.push({ ticker: input.ticker, reason: 'Sin métricas calculadas — corre un refresh' });
      continue;
    }

    const scored = scoreCompany(input, hurdleRate);
    if (!scored) {
      skipped.push({ ticker: input.ticker, reason: 'No se pudo puntuar' });
      continue;
    }

    // A row with nothing to say isn't an opportunity, it's noise.
    if (scored.signals.length === 0 && scored.deltas.length === 0) {
      skipped.push({ ticker: input.ticker, reason: 'Ninguna señal activa' });
      continue;
    }

    opportunities.push(scored);
  }

  opportunities.sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    hurdleRate,
    scanned: inputs.length,
    opportunities,
    skipped,
  };
}
