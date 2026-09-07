// ============================================================================
// OPPORTUNITY SCREENER — TYPES
// ============================================================================

/**
 * A single reason a company surfaced in the ranking.
 *
 * Signals are kept as discrete, self-describing units (rather than folded
 * straight into a number) so the UI can show *why* something ranked where it
 * did, and so the score stays auditable.
 */
export interface Signal {
  /** Stable id, used for filtering/testing. */
  id: SignalId;
  /** Short human-readable label for the UI chip. */
  label: string;
  /** Longer explanation shown on hover. */
  detail: string;
  /** Points contributed to the composite score (can be negative). */
  points: number;
  /** Visual treatment for the chip. */
  tone: 'positive' | 'neutral' | 'negative';
}

export type SignalId =
  | 'model_consensus'
  | 'cheap_vs_history'
  | 'drawdown'
  | 'price_fundamentals_divergence'
  | 'earnings_yield_above_hurdle'
  | 'fcf_quality'
  | 'growth'
  | 'rating_upgrade'
  | 'confidence_jump'
  | 'new_fiscal_year'
  | 'low_data_quality';

/** A change detected against the previous stored snapshot. */
export interface Delta {
  id: 'rating_upgrade' | 'rating_downgrade' | 'confidence_jump' | 'new_fiscal_year';
  label: string;
  detail: string;
  /** Direction of the change, for colouring. */
  tone: 'positive' | 'neutral' | 'negative';
}

export interface Opportunity {
  companyId: string;
  ticker: string;
  name: string;
  /** 'BVC' for Colombian tickers, 'WALL_STREET' otherwise. */
  market: 'BVC' | 'WALL_STREET';
  /** ISO currency of the company's reported figures (COP, USD, …). */
  currency: string;

  /** Composite 0-100 score. Higher = more worth a closer look. */
  score: number;
  signals: Signal[];
  deltas: Delta[];

  /** Context shown in the row — all currency-neutral ratios except `price`. */
  price: number | null;
  priceChange30d: number | null;
  drawdownFromHigh: number | null;
  peRatio: number | null;
  evToFcf: number | null;
  earningsYield: number | null;
  rating: 'BUY' | 'HOLD' | 'SELL' | null;
  confidence: number | null;
  dataQuality: number | null;
  fiscalYear: number | null;
}

export interface OpportunityScan {
  generatedAt: string;
  /** Hurdle rate used for the earnings-yield signal (e.g. 0.10). */
  hurdleRate: number;
  /** Companies examined, before ranking. */
  scanned: number;
  opportunities: Opportunity[];
  /** Tickers skipped and why — surfaced so gaps are visible, not silent. */
  skipped: { ticker: string; reason: string }[];
}
