'use client';

import type { Company, MetricsAnnual, RecommendationDaily } from '@prisma/client';

interface OverviewTabProps {
  recommendation: RecommendationDaily | null;
  company: Company;
  latestMetrics: MetricsAnnual | null;
}

export function OverviewTab({ recommendation, company, latestMetrics }: OverviewTabProps) {
  const formatPercent = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    const num = Number(value);
    if (isNaN(num)) return '—';
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatRatio = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    const num = Number(value);
    if (isNaN(num)) return '—';
    return num.toFixed(2);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Recommendation Card */}
      <div className="lg:col-span-2 card">
        <h3 className="card-header">Investment Recommendation</h3>

        {recommendation ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <RatingBadge rating={recommendation.rating} size="large" />
              <div>
                <div className="text-sm text-terminal-muted">Confidence</div>
                <div className="text-xl font-bold text-terminal-text">
                  {(Number(recommendation.confidence) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="ml-auto text-sm text-terminal-muted">
                Based on {recommendation.metricsYear} data
              </div>
            </div>

            <div className="p-4 bg-terminal-bg rounded-lg border border-terminal-border">
              <div className="text-sm text-terminal-muted mb-2">Summary</div>
              <p className="text-terminal-text">{recommendation.explanationShort}</p>
            </div>

            <div className="prose prose-invert max-w-none">
              <div className="text-sm text-terminal-muted mb-2">Detailed Analysis</div>
              <div className="text-sm text-terminal-text whitespace-pre-wrap">
                {recommendation.explanationFull}
              </div>
            </div>

            {recommendation.triggers && (
              <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <div className="text-sm font-medium text-yellow-400 mb-2">
                  What could change this recommendation?
                </div>
                <ul className="text-sm text-terminal-muted list-disc list-inside space-y-1">
                  {(recommendation.triggers as string[]).map((trigger, i) => (
                    <li key={i}>{trigger}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-terminal-muted">
            <p>No recommendation available yet.</p>
            <p className="text-sm mt-2">
              Click the &quot;Refresh&quot; button above to fetch data and generate a recommendation.
            </p>
          </div>
        )}
      </div>

      {/* Key Metrics Card */}
      <div className="card">
        <h3 className="card-header">Key Metrics</h3>

        {latestMetrics ? (
          <div className="space-y-4">
            <MetricRow
              label="Fiscal Year"
              value={String(latestMetrics.fiscalYear)}
            />

            <div className="pt-2 border-t border-terminal-border">
              <div className="text-xs text-terminal-muted uppercase tracking-wide mb-2">
                Profitability
              </div>
              <MetricRow label="ROE" value={formatPercent(latestMetrics.roe)} />
              <MetricRow label="ROIC" value={formatPercent(latestMetrics.roic)} />
              <MetricRow label="Net Margin" value={formatPercent(latestMetrics.netMargin)} />
            </div>

            <div className="pt-2 border-t border-terminal-border">
              <div className="text-xs text-terminal-muted uppercase tracking-wide mb-2">
                Valuation
              </div>
              <MetricRow label="P/E Ratio" value={formatRatio(latestMetrics.peRatio)} />
              <MetricRow label="P/B Ratio" value={formatRatio(latestMetrics.pbRatio)} />
              <MetricRow label="EV/EBITDA" value={formatRatio(latestMetrics.evToEbitda)} />
              <MetricRow label="Earnings Yield" value={formatPercent(latestMetrics.earningsYield)} />
            </div>

            <div className="pt-2 border-t border-terminal-border">
              <div className="text-xs text-terminal-muted uppercase tracking-wide mb-2">
                Growth
              </div>
              <MetricRow label="Revenue Growth" value={formatPercent(latestMetrics.revenueGrowth)} />
              <MetricRow label="EPS Growth" value={formatPercent(latestMetrics.epsGrowth)} />
            </div>

            <div className="pt-2 border-t border-terminal-border">
              <div className="text-xs text-terminal-muted uppercase tracking-wide mb-2">
                Quality Score
              </div>
              <QualityBar score={latestMetrics.qualityScore ? Number(latestMetrics.qualityScore) : null} />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-terminal-muted">
            <p>No metrics calculated yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingBadge({
  rating,
  size = 'normal',
}: {
  rating: 'BUY' | 'HOLD' | 'SELL';
  size?: 'normal' | 'large';
}) {
  const colors = {
    BUY: 'bg-green-900/50 text-green-400 border-green-700',
    HOLD: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    SELL: 'bg-red-900/50 text-red-400 border-red-700',
  };

  const sizeClasses = size === 'large' ? 'text-2xl px-4 py-2' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center font-bold rounded border ${colors[rating]} ${sizeClasses}`}
    >
      {rating}
    </span>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-terminal-muted">{label}</span>
      <span className="text-sm font-mono text-terminal-text">{value}</span>
    </div>
  );
}

function QualityBar({ score }: { score: number | null }) {
  if (score === null) {
    return <div className="text-sm text-terminal-muted">Not calculated</div>;
  }

  const percentage = score * 100;
  const color =
    percentage >= 80
      ? 'bg-green-500'
      : percentage >= 50
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-terminal-muted">Score</span>
        <span className="text-terminal-text font-mono">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-terminal-border rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
