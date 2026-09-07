'use client';

import { useState, useMemo, useCallback } from 'react';
import type {
  Company,
  FinancialStatementAnnual,
  MetricsAnnual,
  PriceDaily,
  RecommendationDaily,
} from '@prisma/client';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from '@/components/language-provider';

interface OverviewTabProps {
  recommendation: RecommendationDaily | null;
  company: Company;
  latestMetrics: MetricsAnnual | null;
  prices: PriceDaily[];
  financials: FinancialStatementAnnual[];
}

type PriceRange = '1m' | '3m' | '6m' | '1y' | '3y' | 'max';

const RANGE_DAYS: Record<PriceRange, number> = {
  '1m': 21,
  '3m': 63,
  '6m': 126,
  '1y': 252,
  '3y': 756,
  'max': Infinity,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: unknown, style: 'pct' | 'ratio' | 'money', currency = 'USD'): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  if (style === 'pct') return `${(num * 100).toFixed(1)}%`;
  if (style === 'money') return formatLargeNumber(num, currency);
  return num.toFixed(2);
}

function formatLargeNumber(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverviewTab({
  recommendation,
  company,
  latestMetrics,
  prices,
  financials,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const [priceRange, setPriceRange] = useState<PriceRange>('1y');
  const [companyData, setCompanyData] = useState<Company>(company);
  const [enriching, setEnriching] = useState(false);

  const enrichProfile = useCallback(async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/company/${company.ticker}/profile`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.company) setCompanyData(json.company);
      }
    } finally {
      setEnriching(false);
    }
  }, [company.ticker]);

  // ---- Price chart data ---------------------------------------------------
  const {
    chartData,
    currentPrice,
    priceChange,
    priceChangePct,
    isPositive,
    financialMarkers,
  } = useMemo(() => {
    if (prices.length === 0) {
      return {
        chartData: [],
        currentPrice: 0,
        priceChange: 0,
        priceChangePct: 0,
        isPositive: true,
        financialMarkers: [],
      };
    }

    const days = RANGE_DAYS[priceRange];
    const sliceCount = days === Infinity ? prices.length : Math.min(days, prices.length);
    const sliced = prices.slice(0, sliceCount).reverse();

    const data = sliced.map((p) => ({
      date: new Date(p.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: sliceCount > 252 ? '2-digit' : undefined,
      }),
      rawDate: new Date(p.date),
      close: Number(p.close),
      volume: Number(p.volume ?? 0),
    }));

    const first = data[0]?.close ?? 0;
    const last = data[data.length - 1]?.close ?? 0;
    const change = last - first;
    const changePct = first !== 0 ? (change / first) * 100 : 0;

    // Build financial year-end markers (only for 3Y / Max)
    let markers: { dateLabel: string; year: number; revenue: number; netIncome: number; closeAtDate: number }[] = [];
    if ((priceRange === '3y' || priceRange === 'max') && financials.length > 0) {
      const sorted = [...financials].sort((a, b) => a.fiscalYear - b.fiscalYear);
      for (const fin of sorted) {
        const endDate = new Date(fin.periodEnd);
        // Find closest price data point
        let closest = data[0];
        let minDiff = Infinity;
        for (const d of data) {
          const diff = Math.abs(d.rawDate.getTime() - endDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closest = d;
          }
        }
        // Only include if within ~30 days
        if (minDiff < 30 * 24 * 60 * 60 * 1000) {
          markers.push({
            dateLabel: closest.date,
            year: fin.fiscalYear,
            revenue: fin.revenue ? Number(fin.revenue) : 0,
            netIncome: fin.netIncome ? Number(fin.netIncome) : 0,
            closeAtDate: closest.close,
          });
        }
      }
    }

    return {
      chartData: data,
      currentPrice: last,
      priceChange: change,
      priceChangePct: changePct,
      isPositive: change >= 0,
      financialMarkers: markers,
    };
  }, [prices, priceRange, financials]);

  const accentColor = isPositive ? '#22c55e' : '#ef4444';
  const fillOpacity = 0.12;

  // ---- About section visibility ------------------------------------------
  const hasAbout =
    companyData.description || companyData.sector || companyData.industry || companyData.exchange || companyData.website;

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* SECTION 1 — Price Chart + Key Metrics                             */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Price Chart (2/3) */}
        <div className="lg:col-span-2 card">
          {prices.length > 0 ? (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="card-header mb-0">{t('overview.priceHistory')}</h3>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-2xl font-bold text-terminal-text font-mono">
                      ${currentPrice.toFixed(2)}
                    </span>
                    <span
                      className={`text-sm font-mono font-medium ${
                        isPositive ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {priceChange.toFixed(2)} ({isPositive ? '+' : ''}
                      {priceChangePct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 mt-1">
                  {(['1m', '3m', '6m', '1y', '3y', 'max'] as PriceRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setPriceRange(range)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        priceRange === range
                          ? 'bg-terminal-accent text-white'
                          : 'bg-terminal-bg text-terminal-muted hover:text-terminal-text'
                      }`}
                    >
                      {range === 'max' ? 'Max' : range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area Chart */}
              <div className="h-[220px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="overviewPriceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accentColor} stopOpacity={fillOpacity} />
                        <stop offset="100%" stopColor={accentColor} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      stroke="#8b949e"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161b22',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      labelStyle={{ color: '#c9d1d9' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Close']}
                    />
                    {financialMarkers.map((m) => (
                      <ReferenceLine
                        key={m.year}
                        x={m.dateLabel}
                        stroke="#8b949e"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        label={{
                          value: `FY${m.year}`,
                          position: 'top',
                          fill: '#8b949e',
                          fontSize: 10,
                        }}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={accentColor}
                      strokeWidth={2}
                      fill="url(#overviewPriceGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: accentColor }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Volume Bar Chart */}
              <div className="h-[60px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 0, left: 4 }}>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161b22',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      labelStyle={{ color: '#c9d1d9' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Volume']}
                    />
                    <Bar dataKey="volume" fill="#6b7280" fillOpacity={0.25} radius={[1, 1, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-terminal-muted">
              <p>{t('overview.noPriceData')}</p>
            </div>
          )}
        </div>

        {/* Right: Key Metrics (1/3) */}
        <div className="card overflow-y-auto max-h-[480px]">
          <h3 className="card-header">{t('overview.keyMetrics')}</h3>

          {latestMetrics ? (
            <div className="space-y-4 text-sm">
              {/* Market Data */}
              <MetricsSection title={t('metric.group.marketData')}>
                <MetricRow label={t('metric.marketCap')} value={fmt(latestMetrics.marketCap, 'money', companyData.currency)} />
                <MetricRow label={t('metric.enterpriseValue')} value={fmt(latestMetrics.enterpriseValue, 'money', companyData.currency)} />
                <MetricRow label={t('metric.peRatio')} value={fmt(latestMetrics.peRatio, 'ratio')} />
                <MetricRow label={t('metric.pbRatio')} value={fmt(latestMetrics.pbRatio, 'ratio')} />
              </MetricsSection>

              {/* Efficiency */}
              <MetricsSection title={t('metric.group.efficiency')}>
                <MetricRow label={t('metric.roe')} value={fmt(latestMetrics.roe, 'pct')} />
                <MetricRow label={t('metric.roic')} value={fmt(latestMetrics.roic, 'pct')} />
                <MetricRow label={t('metric.roa')} value={fmt(latestMetrics.roa, 'pct')} />
                <MetricRow label={t('metric.netMargin')} value={fmt(latestMetrics.netMargin, 'pct')} />
                <MetricRow label={t('metric.grossMargin')} value={fmt(latestMetrics.grossMargin, 'pct')} />
              </MetricsSection>

              {/* Valuation */}
              <MetricsSection title={t('metric.group.valuation')}>
                <MetricRow label={t('metric.evEbitda')} value={fmt(latestMetrics.evToEbitda, 'ratio')} />
                <MetricRow label={t('metric.earningsYield')} value={fmt(latestMetrics.earningsYield, 'pct')} />
                <MetricRow label={t('metric.debtEquity')} value={fmt(latestMetrics.debtToEquity, 'ratio')} />
              </MetricsSection>

              {/* Growth */}
              <MetricsSection title={t('metric.group.growth')}>
                <GrowthRow label={t('metric.revenueGrowth')} value={latestMetrics.revenueGrowth} />
                <GrowthRow label={t('metric.epsGrowth')} value={latestMetrics.epsGrowth} />
                <GrowthRow label={t('metric.fcfGrowth')} value={latestMetrics.fcfGrowth} />
              </MetricsSection>

              {/* Quality Score */}
              <MetricsSection title={t('metric.group.qualityScore')}>
                <QualityBar
                  score={latestMetrics.qualityScore ? Number(latestMetrics.qualityScore) : null}
                />
              </MetricsSection>
            </div>
          ) : (
            <div className="text-center py-8 text-terminal-muted">
              <p>{t('overview.noMetrics')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 2 — Investment Recommendation                             */}
      {/* ================================================================= */}
      <div className="card">
        <h3 className="card-header">{t('overview.investmentRecommendation')}</h3>

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
              <div className="text-sm text-terminal-muted mb-2">{t('overview.summary')}</div>
              <p className="text-terminal-text">{recommendation.explanationShort}</p>
            </div>

            <div className="prose prose-invert max-w-none">
              <div className="text-sm text-terminal-muted mb-2">{t('overview.detailedAnalysis')}</div>
              <div className="text-sm text-terminal-text whitespace-pre-wrap">
                {recommendation.explanationFull}
              </div>
            </div>

            {recommendation.triggers && (
              <div className="mt-4 p-4 alert-warning rounded-lg">
                <div className="text-sm font-medium mb-2">
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
            <p>{t('overview.noRecommendation')}</p>
            <p className="text-sm mt-2">
              Click the &quot;Refresh&quot; button above to fetch data and generate a
              recommendation.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 3 — About the Company                                     */}
      {/* ================================================================= */}
      {/* Always render About — show Enrich button when description is missing */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="card-header mb-0">About {companyData.name}</h3>
          {!companyData.description && (
            <button
              onClick={enrichProfile}
              disabled={enriching}
              className="px-3 py-1 text-xs rounded bg-terminal-accent text-white hover:bg-terminal-accent/80 disabled:opacity-50 transition-colors"
            >
              {enriching ? t('overview.fetchingProfile') : t('overview.enrichProfile')}
            </button>
          )}
        </div>

        {companyData.description && (
          <p className="text-sm text-terminal-text leading-relaxed mb-4">
            {companyData.description}
          </p>
        )}

        {hasAbout && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {companyData.sector && (
              <div className="flex justify-between py-1">
                <span className="text-terminal-muted">{t('overview.sector')}</span>
                <span className="text-terminal-text">{companyData.sector}</span>
              </div>
            )}
            {companyData.industry && (
              <div className="flex justify-between py-1">
                <span className="text-terminal-muted">{t('overview.industry')}</span>
                <span className="text-terminal-text">{companyData.industry}</span>
              </div>
            )}
            {companyData.exchange && (
              <div className="flex justify-between py-1">
                <span className="text-terminal-muted">{t('overview.exchange')}</span>
                <span className="text-terminal-text">{companyData.exchange}</span>
              </div>
            )}
            {companyData.website && (
              <div className="flex justify-between py-1">
                <span className="text-terminal-muted">{t('overview.website')}</span>
                <a
                  href={companyData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terminal-accent hover:underline"
                >
                  {companyData.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 border-t border-terminal-border first:border-t-0 first:pt-0">
      <div className="text-xs text-terminal-muted uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-terminal-muted">{label}</span>
      <span className="font-mono text-terminal-text">{value}</span>
    </div>
  );
}

function GrowthRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return <MetricRow label={label} value="—" />;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return <MetricRow label={label} value="—" />;
  }
  const pct = (num * 100).toFixed(1);
  const color = num >= 0 ? 'text-positive' : 'text-negative';
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-terminal-muted">{label}</span>
      <span className={`font-mono ${color}`}>
        {num >= 0 ? '+' : ''}
        {pct}%
      </span>
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
    BUY: 'badge-buy',
    HOLD: 'badge-hold',
    SELL: 'badge-sell',
  };
  const sizeClasses = size === 'large' ? 'text-2xl px-4 py-2' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center font-bold rounded ${colors[rating]} ${sizeClasses}`}
    >
      {rating}
    </span>
  );
}

function QualityBar({ score }: { score: number | null }) {
  const { t } = useTranslation();
  if (score === null) {
    return <div className="text-sm text-terminal-muted">{t('overview.notCalculated')}</div>;
  }

  const percentage = score * 100;
  const color =
    percentage >= 80 ? 'bg-success-dot' : percentage >= 50 ? 'bg-warning-dot' : 'bg-danger-dot';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-terminal-muted">{t('overview.score')}</span>
        <span className="text-terminal-text font-mono">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-terminal-border rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
