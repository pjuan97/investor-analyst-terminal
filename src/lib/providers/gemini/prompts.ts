import type { ModelVote } from '@/types';

interface MetricThreshold {
  name: string;
  actual: number | null;
  threshold: number;
  unit: string;
  higherIsBetter: boolean;
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) return 'N/A';
  if (unit === '%') return `${(value * 100).toFixed(1)}%`;
  if (unit === 'x') return `${value.toFixed(2)}x`;
  return value.toFixed(2);
}

function formatDelta(actual: number | null, threshold: number, unit: string, higherIsBetter: boolean): string {
  if (actual === null) return 'N/A';
  const delta = actual - threshold;
  const sign = delta >= 0 ? '+' : '';
  const formatted = unit === '%' ? `${sign}${(delta * 100).toFixed(1)}%` : `${sign}${delta.toFixed(2)}${unit}`;
  const status = higherIsBetter
    ? (delta >= 0 ? 'PASS' : 'FAIL')
    : (delta <= 0 ? 'PASS' : 'FAIL');
  return `${formatted} (${status})`;
}

function buildMetricsTable(metrics: MetricThreshold[]): string {
  const rows = metrics.map((m) => {
    const actual = formatMetric(m.actual, m.unit);
    const threshold = formatMetric(m.threshold, m.unit);
    const delta = formatDelta(m.actual, m.threshold, m.unit, m.higherIsBetter);
    return `| ${m.name} | ${actual} | ${threshold} | ${delta} |`;
  });

  return `| Metric | Actual | Threshold | Delta |
|--------|--------|-----------|-------|
${rows.join('\n')}`;
}

export interface PromptContext {
  companyName: string;
  ticker: string;
  vote: ModelVote;
  keyMetrics: Record<string, number | null>;
}

export function buildBuffettPrompt(ctx: PromptContext): string {
  const metrics: MetricThreshold[] = [
    { name: 'ROE', actual: ctx.keyMetrics.roe ?? null, threshold: 0.15, unit: '%', higherIsBetter: true },
    { name: 'ROIC', actual: ctx.keyMetrics.roic ?? null, threshold: 0.12, unit: '%', higherIsBetter: true },
    { name: 'Debt/Equity', actual: ctx.keyMetrics.debtToEquity ?? null, threshold: 0.5, unit: 'x', higherIsBetter: false },
    { name: 'Operating Margin', actual: ctx.keyMetrics.operatingMargin ?? null, threshold: 0.15, unit: '%', higherIsBetter: true },
    { name: 'Net Margin', actual: ctx.keyMetrics.netMargin ?? null, threshold: 0.10, unit: '%', higherIsBetter: true },
    { name: 'Current Ratio', actual: ctx.keyMetrics.currentRatio ?? null, threshold: 1.5, unit: 'x', higherIsBetter: true },
    { name: 'P/E Ratio', actual: ctx.keyMetrics.peRatio ?? null, threshold: 20, unit: 'x', higherIsBetter: false },
  ];

  return `Analyze ${ctx.companyName} (${ctx.ticker}) using Warren Buffett's value investing philosophy.

## Investment Philosophy
Warren Buffett seeks companies with:
- Durable competitive advantages ("moats")
- High and consistent returns on equity (ROE > 15%)
- Strong returns on invested capital (ROIC > 12%)
- Conservative debt levels (D/E < 0.5)
- Wide profit margins (Operating > 15%, Net > 10%)
- Strong liquidity (Current Ratio > 1.5)
- Reasonable valuation (P/E < 20)

## Current Metrics vs Thresholds
${buildMetricsTable(metrics)}

## Model Assessment
- Rating: ${ctx.vote.rating}
- Confidence: ${(ctx.vote.confidence * 100).toFixed(0)}%
- Key Observations: ${ctx.vote.reasons.join('; ')}

## Your Analysis Task
Based on the metrics above, provide a detailed analysis covering:
1. **Metric Assessment**: Which metrics pass/fail Buffett's criteria and why they matter
2. **Moat Analysis**: What competitive advantages or disadvantages does this company have?
3. **Key Risks**: What could erode the company's competitive position?
4. **Conclusion**: Is this a Buffett-style investment? Why or why not?

Keep your response concise (around 400-500 words). Use markdown formatting.`;
}

export function buildGreenblattPrompt(ctx: PromptContext): string {
  const metrics: MetricThreshold[] = [
    { name: 'Earnings Yield (EBIT/EV)', actual: ctx.keyMetrics.earningsYieldMF ?? null, threshold: 0.10, unit: '%', higherIsBetter: true },
    { name: 'Return on Capital', actual: ctx.keyMetrics.returnOnCapitalMF ?? null, threshold: 0.20, unit: '%', higherIsBetter: true },
    { name: 'ROIC', actual: ctx.keyMetrics.roic ?? null, threshold: 0.15, unit: '%', higherIsBetter: true },
    { name: 'EV/EBITDA', actual: ctx.keyMetrics.evToEbitda ?? null, threshold: 10, unit: 'x', higherIsBetter: false },
    { name: 'P/E Ratio', actual: ctx.keyMetrics.peRatio ?? null, threshold: 15, unit: 'x', higherIsBetter: false },
  ];

  return `Analyze ${ctx.companyName} (${ctx.ticker}) using Joel Greenblatt's Magic Formula investing strategy.

## Investment Philosophy
Greenblatt's Magic Formula seeks to find:
- High earnings yield (cheap stocks): EBIT/EV > 10%
- High return on capital (quality businesses): EBIT/(Net Working Capital + Net Fixed Assets) > 20%
- The formula ranks stocks by combining these two factors
- Buy the top 20-30 ranked stocks and hold for 1 year

## Current Metrics vs Thresholds
${buildMetricsTable(metrics)}

## Model Assessment
- Rating: ${ctx.vote.rating}
- Confidence: ${(ctx.vote.confidence * 100).toFixed(0)}%
- Key Observations: ${ctx.vote.reasons.join('; ')}

## Your Analysis Task
Based on the metrics above, provide a detailed analysis covering:
1. **Valuation Assessment**: Is the stock cheap relative to its earnings power?
2. **Quality Assessment**: Does the business generate high returns on capital employed?
3. **Magic Formula Fit**: How does this stock rank on both dimensions?
4. **Conclusion**: Is this a good Magic Formula candidate? Why or why not?

Keep your response concise (around 400-500 words). Use markdown formatting.`;
}

export function buildGrowthPrompt(ctx: PromptContext): string {
  const metrics: MetricThreshold[] = [
    { name: 'Revenue Growth', actual: ctx.keyMetrics.revenueGrowth ?? null, threshold: 0.10, unit: '%', higherIsBetter: true },
    { name: 'EPS Growth', actual: ctx.keyMetrics.epsGrowth ?? null, threshold: 0.10, unit: '%', higherIsBetter: true },
    { name: 'Operating Margin', actual: ctx.keyMetrics.operatingMargin ?? null, threshold: 0.12, unit: '%', higherIsBetter: true },
    { name: 'Net Margin', actual: ctx.keyMetrics.netMargin ?? null, threshold: 0.08, unit: '%', higherIsBetter: true },
    { name: 'ROE', actual: ctx.keyMetrics.roe ?? null, threshold: 0.12, unit: '%', higherIsBetter: true },
    { name: 'Debt/Equity', actual: ctx.keyMetrics.debtToEquity ?? null, threshold: 0.6, unit: 'x', higherIsBetter: false },
  ];

  return `Analyze ${ctx.companyName} (${ctx.ticker}) using Philip Fisher's growth investing philosophy.

## Investment Philosophy
Philip Fisher focuses on:
- Sustained revenue growth above industry average (>10% annually)
- Consistent earnings growth (>10% annually)
- Rising or stable profit margins
- Strong management with integrity
- R&D effectiveness and innovation
- Conservative financing (moderate debt)
- Long-term holding period (years, not months)

## Current Metrics vs Thresholds
${buildMetricsTable(metrics)}

## Model Assessment
- Rating: ${ctx.vote.rating}
- Confidence: ${(ctx.vote.confidence * 100).toFixed(0)}%
- Key Observations: ${ctx.vote.reasons.join('; ')}

## Your Analysis Task
Based on the metrics above, provide a detailed analysis covering:
1. **Growth Assessment**: Is the company demonstrating consistent, sustainable growth?
2. **Margin Trends**: Are margins expanding, stable, or contracting?
3. **Financial Health**: Is growth being financed responsibly?
4. **Conclusion**: Is this a Fisher-style growth investment? Why or why not?

Keep your response concise (around 400-500 words). Use markdown formatting.`;
}

export function buildLynchPrompt(ctx: PromptContext): string {
  const pegRatio = ctx.keyMetrics.peRatio && ctx.keyMetrics.epsGrowth
    ? ctx.keyMetrics.peRatio / (ctx.keyMetrics.epsGrowth * 100)
    : null;

  const metrics: MetricThreshold[] = [
    { name: 'P/E Ratio', actual: ctx.keyMetrics.peRatio ?? null, threshold: 20, unit: 'x', higherIsBetter: false },
    { name: 'EPS Growth', actual: ctx.keyMetrics.epsGrowth ?? null, threshold: 0.15, unit: '%', higherIsBetter: true },
    { name: 'PEG Ratio', actual: pegRatio, threshold: 1.0, unit: 'x', higherIsBetter: false },
    { name: 'Debt/Equity', actual: ctx.keyMetrics.debtToEquity ?? null, threshold: 0.5, unit: 'x', higherIsBetter: false },
    { name: 'FCF Margin', actual: ctx.keyMetrics.fcfMargin ?? null, threshold: 0.08, unit: '%', higherIsBetter: true },
  ];

  return `Analyze ${ctx.companyName} (${ctx.ticker}) using Peter Lynch's GARP (Growth at a Reasonable Price) investing strategy.

## Investment Philosophy
Peter Lynch's approach involves:
- PEG ratio < 1 (P/E divided by earnings growth rate)
- Stock categorization: Slow Grower, Stalwart, Fast Grower, Cyclical, Turnaround, or Asset Play
- "Story" alignment: The numbers should support the investment thesis
- Understandable businesses that you can research
- Conservative debt levels
- Positive free cash flow

## Current Metrics vs Thresholds
${buildMetricsTable(metrics)}

## Model Assessment
- Rating: ${ctx.vote.rating}
- Confidence: ${(ctx.vote.confidence * 100).toFixed(0)}%
- Key Observations: ${ctx.vote.reasons.join('; ')}

## Your Analysis Task
Based on the metrics above, provide a detailed analysis covering:
1. **PEG Analysis**: Is the P/E justified by the growth rate?
2. **Stock Category**: What type of stock is this (Fast Grower, Stalwart, etc.)?
3. **Story Check**: Do the numbers support a compelling investment story?
4. **Conclusion**: Is this a good GARP investment? Why or why not?

Keep your response concise (around 400-500 words). Use markdown formatting.`;
}

export function getPromptBuilder(modelId: string): ((ctx: PromptContext) => string) | null {
  switch (modelId) {
    case 'buffett':
      return buildBuffettPrompt;
    case 'greenblatt':
      return buildGreenblattPrompt;
    case 'growth':
      return buildGrowthPrompt;
    case 'lynch':
      return buildLynchPrompt;
    default:
      return null;
  }
}

export const MODEL_IDS = ['buffett', 'greenblatt', 'growth', 'lynch'] as const;
export type ModelId = typeof MODEL_IDS[number];
