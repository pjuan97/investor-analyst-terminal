import type { Signal, Delta } from './types';

// ============================================================================
// OPPORTUNITY SIGNALS — pure functions over plain data
// ============================================================================
//
// Every signal is deterministic and takes plain values (no Prisma types, no
// I/O) so the ranking can be reasoned about and tested without a database.
//
// A note on currency: every signal below is built on ratios (P/E, EV/FCF,
// margins, growth rates, percentage drawdowns). Ratios divide same-currency
// figures, so a COP-reporting company and a USD-reporting one are directly
// comparable. Absolute values (market cap, revenue) are deliberately NOT used
// for ranking — they would make BVC and Wall Street incomparable.

export interface MetricsSnapshot {
  fiscalYear: number;
  peRatio: number | null;
  evToFcf: number | null;
  earningsYield: number | null;
  fcfMargin: number | null;
  revenueGrowth: number | null;
  roic: number | null;
}

export interface ModelVote {
  rating?: 'BUY' | 'HOLD' | 'SELL';
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fraction of `history` that the current value sits below (0 = cheapest the
 * company has been, 1 = most expensive). Only positive values are considered:
 * a negative multiple means losses, where "cheap" is meaningless.
 */
export function percentileOfHistory(current: number, history: number[]): number | null {
  const usable = history.filter((v) => Number.isFinite(v) && v > 0);
  if (current <= 0 || usable.length < 3) return null;

  const below = usable.filter((v) => current < v).length;
  return below / usable.length;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** How strongly the five investment models agree on BUY, weighted by confidence. */
export function modelConsensusSignal(votes: Record<string, ModelVote>): Signal | null {
  const entries = Object.values(votes ?? {}).filter(
    (v): v is ModelVote => !!v && typeof v === 'object' && !!v.rating
  );
  if (entries.length === 0) return null;

  const buys = entries.filter((v) => v.rating === 'BUY');
  const sells = entries.filter((v) => v.rating === 'SELL');
  if (buys.length === 0 && sells.length === 0) return null;

  const buyWeight = buys.reduce((sum, v) => sum + (v.confidence ?? 0.5), 0);
  const sellWeight = sells.reduce((sum, v) => sum + (v.confidence ?? 0.5), 0);
  const net = buyWeight - sellWeight;

  if (net <= 0) {
    if (sells.length === 0) return null;
    return {
      id: 'model_consensus',
      label: `${sells.length}/${entries.length} SELL`,
      detail: `${sells.length} of ${entries.length} models vote SELL (confidence-weighted).`,
      points: Math.max(-20, -net * 8),
      tone: 'negative',
    };
  }

  return {
    id: 'model_consensus',
    label: `${buys.length}/${entries.length} BUY`,
    detail: `${buys.length} of ${entries.length} models vote BUY (confidence-weighted score ${net.toFixed(2)}).`,
    points: Math.min(30, net * 10),
    tone: 'positive',
  };
}

/** Valuation multiple sitting low against the company's own history. */
export function cheapVsHistorySignal(
  latest: MetricsSnapshot,
  history: MetricsSnapshot[]
): Signal | null {
  const candidates: { name: string; current: number | null; past: number[] }[] = [
    {
      name: 'EV/FCF',
      current: latest.evToFcf,
      past: history.map((m) => m.evToFcf).filter((v): v is number => v != null),
    },
    {
      name: 'P/E',
      current: latest.peRatio,
      past: history.map((m) => m.peRatio).filter((v): v is number => v != null),
    },
  ];

  for (const c of candidates) {
    if (c.current == null) continue;
    const p = percentileOfHistory(c.current, c.past);
    if (p == null) continue;

    // Bottom third of its own range = notably cheap for this business.
    if (p >= 0.66) {
      return {
        id: 'cheap_vs_history',
        label: `${c.name} barato vs. su historia`,
        detail: `${c.name} de ${c.current.toFixed(1)}x — más barato que el ${pct(p)} de sus propios años.`,
        points: 10 + (p - 0.66) * 30,
        tone: 'positive',
      };
    }
  }

  return null;
}

/** Distance below the 52-week high. */
export function drawdownSignal(drawdown: number | null): Signal | null {
  if (drawdown == null || drawdown > -0.15) return null;

  return {
    id: 'drawdown',
    label: `${pct(drawdown)} desde máximo 52s`,
    detail: `Cotiza ${pct(Math.abs(drawdown))} por debajo de su máximo de 52 semanas.`,
    points: Math.min(15, Math.abs(drawdown) * 40),
    tone: 'neutral',
  };
}

/**
 * The classic setup worth a closer look: the price has fallen materially while
 * the underlying business is still growing and generating cash.
 */
export function divergenceSignal(
  drawdown: number | null,
  latest: MetricsSnapshot
): Signal | null {
  if (drawdown == null || drawdown > -0.15) return null;

  const growing = (latest.revenueGrowth ?? 0) > 0.03;
  const cashGenerative = (latest.fcfMargin ?? 0) > 0.05;
  if (!growing || !cashGenerative) return null;

  return {
    id: 'price_fundamentals_divergence',
    label: 'Precio cae, fundamentales no',
    detail: `Precio ${pct(Math.abs(drawdown))} bajo su máximo, pero ingresos +${pct(latest.revenueGrowth!)} y margen FCF ${pct(latest.fcfMargin!)}.`,
    points: 25,
    tone: 'positive',
  };
}

/** Earnings yield clearing the hurdle rate. */
export function earningsYieldSignal(
  earningsYield: number | null,
  hurdleRate: number
): Signal | null {
  if (earningsYield == null || earningsYield < hurdleRate) return null;

  return {
    id: 'earnings_yield_above_hurdle',
    label: `Earnings yield ${pct(earningsYield)}`,
    detail: `Earnings yield de ${pct(earningsYield)} supera tu hurdle rate de ${pct(hurdleRate)}.`,
    points: Math.min(20, 10 + (earningsYield - hurdleRate) * 100),
    tone: 'positive',
  };
}

/** Strong free-cash-flow conversion. */
export function fcfQualitySignal(fcfMargin: number | null): Signal | null {
  if (fcfMargin == null || fcfMargin < 0.15) return null;

  return {
    id: 'fcf_quality',
    label: `Margen FCF ${pct(fcfMargin)}`,
    detail: `Convierte ${pct(fcfMargin)} de sus ingresos en flujo de caja libre.`,
    points: Math.min(12, fcfMargin * 40),
    tone: 'positive',
  };
}

/** Revenue growth worth noting. */
export function growthSignal(revenueGrowth: number | null): Signal | null {
  if (revenueGrowth == null || revenueGrowth < 0.10) return null;

  return {
    id: 'growth',
    label: `Ingresos +${pct(revenueGrowth)}`,
    detail: `Los ingresos crecieron ${pct(revenueGrowth)} en el último año fiscal.`,
    points: Math.min(12, revenueGrowth * 30),
    tone: 'positive',
  };
}

/**
 * Penalty, not a reason to buy: thin data makes every other signal less
 * trustworthy, so it pushes the row down rather than hiding it.
 */
export function dataQualitySignal(quality: number | null): Signal | null {
  if (quality == null) {
    return {
      id: 'low_data_quality',
      label: 'Sin evaluar',
      detail: 'Aún no se ha calculado la calidad de datos de esta empresa.',
      points: -10,
      tone: 'negative',
    };
  }
  if (quality >= 0.5) return null;

  return {
    id: 'low_data_quality',
    label: `Datos incompletos (${pct(quality)})`,
    detail: `Solo ${pct(quality)} de las métricas financieras están disponibles — las demás señales son menos confiables.`,
    points: -15,
    tone: 'negative',
  };
}

// ---------------------------------------------------------------------------
// Deltas — what changed since the previous stored snapshot
// ---------------------------------------------------------------------------

const RATING_ORDER: Record<string, number> = { SELL: 0, HOLD: 1, BUY: 2 };

export function computeDeltas(
  current: { rating: string; confidence: number; fiscalYear: number | null },
  previous: { rating: string; confidence: number; fiscalYear: number | null } | null
): Delta[] {
  if (!previous) return [];

  const deltas: Delta[] = [];
  const now = RATING_ORDER[current.rating] ?? 1;
  const before = RATING_ORDER[previous.rating] ?? 1;

  if (now > before) {
    deltas.push({
      id: 'rating_upgrade',
      label: `${previous.rating} → ${current.rating}`,
      detail: `Los modelos subieron su recomendación de ${previous.rating} a ${current.rating}.`,
      tone: 'positive',
    });
  } else if (now < before) {
    deltas.push({
      id: 'rating_downgrade',
      label: `${previous.rating} → ${current.rating}`,
      detail: `Los modelos bajaron su recomendación de ${previous.rating} a ${current.rating}.`,
      tone: 'negative',
    });
  }

  const confidenceJump = current.confidence - previous.confidence;
  if (Math.abs(confidenceJump) >= 0.15) {
    deltas.push({
      id: 'confidence_jump',
      label: `Confianza ${confidenceJump > 0 ? '+' : ''}${pct(confidenceJump)}`,
      detail: `La confianza pasó de ${pct(previous.confidence)} a ${pct(current.confidence)}.`,
      tone: confidenceJump > 0 ? 'positive' : 'negative',
    });
  }

  if (
    current.fiscalYear != null &&
    previous.fiscalYear != null &&
    current.fiscalYear > previous.fiscalYear
  ) {
    deltas.push({
      id: 'new_fiscal_year',
      label: `Nuevo año fiscal ${current.fiscalYear}`,
      detail: `Llegaron los estados financieros de ${current.fiscalYear}.`,
      tone: 'neutral',
    });
  }

  return deltas;
}

/** Extra score for changes — recent movement is where opportunity tends to live. */
export function deltaPoints(deltas: Delta[]): number {
  return deltas.reduce((sum, d) => {
    if (d.id === 'rating_upgrade') return sum + 20;
    if (d.id === 'rating_downgrade') return sum - 15;
    if (d.id === 'confidence_jump') return sum + (d.tone === 'positive' ? 8 : -8);
    if (d.id === 'new_fiscal_year') return sum + 5;
    return sum;
  }, 0);
}
