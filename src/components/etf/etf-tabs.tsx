'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface EtfCompany {
  id: string;
  ticker: string;
  name: string;
  exchange: string | null;
  lastRefreshedAt: string | null;
}

interface EtfDetailsData {
  netAssets: number | string | null;
  expenseRatio: number | string | null;
  dividendYield: number | string | null;
  portfolioTurnover: number | string | null;
  inceptionDate: string | null;
  isLeveraged: boolean;
  assetClass: string | null;
  topHoldings: Array<{ symbol: string; name: string; weight: number }> | null;
  sectorBreakdown: Array<{ sector: string; weight: number }> | null;
}

interface PriceData {
  date: string;
  close: number | string;
  volume: number | string | null;
  open: number | string | null;
  high: number | string | null;
  low: number | string | null;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

type PriceRange = '1m' | '3m' | '6m' | '1y' | '3y' | 'max';
type TabId = 'overview' | 'performance' | 'score' | 'analysis';

interface EtfTabsProps {
  company: EtfCompany;
  etfDetails: EtfDetailsData | null;
  prices: PriceData[];
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SECTOR_COLORS = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#bc8cff',
  '#ff7b72',
  '#ffa657',
  '#79c0ff',
  '#56d364',
  '#e3b341',
];

const ETF_BENCHMARKS: Record<
  string,
  Array<{ max: number; label: string; color: string }>
> = {
  expenseRatio: [
    { max: 0.001, label: 'Excellent', color: 'text-positive' },
    { max: 0.003, label: 'Very Low', color: 'text-positive' },
    { max: 0.010, label: 'Low', color: 'text-positive' },
    { max: 0.020, label: 'Average', color: 'text-warn' },
    { max: 0.050, label: 'High', color: 'text-warn' },
    { max: 1.000, label: 'Very High', color: 'text-negative' },
  ],
  dividendYield: [
    { max: 0.005, label: 'Minimal', color: 'text-terminal-muted' },
    { max: 0.015, label: 'Low', color: 'text-terminal-muted' },
    { max: 0.030, label: 'Moderate', color: 'text-positive' },
    { max: 0.050, label: 'High', color: 'text-positive' },
    { max: 1.000, label: 'Very High', color: 'text-warn' },
  ],
  portfolioTurnover: [
    { max: 0.05, label: 'Very Low', color: 'text-positive' },
    { max: 0.15, label: 'Low', color: 'text-positive' },
    { max: 0.50, label: 'Moderate', color: 'text-warn' },
    { max: 1.00, label: 'High', color: 'text-warn' },
    { max: 10.0, label: 'Very High', color: 'text-negative' },
  ],
};

function getBenchmark(
  metric: string,
  value: number | null
): { label: string; color: string } | null {
  if (value === null) return null;
  const thresholds = ETF_BENCHMARKS[metric];
  if (!thresholds) return null;
  for (const t of thresholds) {
    if (value <= t.max) return { label: t.label, color: t.color };
  }
  return null;
}

function formatDollar(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function formatAum(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPct(value: number | null, decimals = 2): string {
  if (value === null) return '—';
  return (value * 100).toFixed(decimals) + '%';
}

function filterByRange(prices: PriceData[], range: PriceRange): PriceData[] {
  if (range === 'max') return prices;
  const now = new Date();
  const rangeMap: Record<string, number> = {
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365,
    '3y': 1095,
  };
  const days = rangeMap[range] || 365;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return prices.filter((p) => new Date(p.date) >= cutoff);
}

function calculatePeriodReturn(
  prices: PriceData[],
  days: number
): number | null {
  if (prices.length < 2) return null;
  const latestPrice = toNum(prices[0]?.close);
  if (latestPrice === null) return null;

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pastEntry = [...prices].find((p) => new Date(p.date) <= cutoffDate);
  if (!pastEntry) return null;

  const pastPrice = toNum(pastEntry.close);
  if (pastPrice === null || pastPrice === 0) return null;

  return (latestPrice - pastPrice) / pastPrice;
}

function calculateMaxDrawdown(prices: PriceData[]): number | null {
  const sorted = [...prices].reverse();
  let peak = -Infinity;
  let maxDd = 0;

  for (const p of sorted) {
    const price = toNum(p.close);
    if (price === null) continue;
    if (price > peak) peak = price;
    const dd = (peak - price) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  return maxDd > 0 ? maxDd : null;
}

function calculateVolatility(prices: PriceData[]): number | null {
  if (prices.length < 20) return null;
  const sorted = [...prices].reverse();
  const returns: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = toNum(sorted[i - 1].close);
    const curr = toNum(sorted[i].close);
    if (prev && curr && prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length < 10) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(variance);
  return dailyVol * Math.sqrt(252);
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

export function EtfTabs({ company, etfDetails, prices }: EtfTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'score', label: 'ETF Score' },
    { id: 'analysis', label: 'Deep Analysis' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <EtfHeader company={company} prices={prices} />

      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-terminal-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-terminal-accent text-terminal-accent'
                : 'border-transparent text-terminal-muted hover:text-terminal-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <OverviewTab
          etfDetails={etfDetails}
          prices={prices}
          ticker={company.ticker}
        />
      ) : activeTab === 'performance' ? (
        <PerformanceTab prices={prices} />
      ) : activeTab === 'score' ? (
        <EtfScoreTab etfDetails={etfDetails} />
      ) : (
        <AnalysisTab ticker={company.ticker} />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// ETF Header
// --------------------------------------------------------------------------

function EtfHeader({
  company,
  prices,
}: {
  company: EtfCompany;
  prices: PriceData[];
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const latest = prices[0];
  const prev = prices[1];
  const currentPrice = toNum(latest?.close);
  const prevPrice = toNum(prev?.close);

  const change = currentPrice && prevPrice ? currentPrice - prevPrice : null;
  const changePct = change && prevPrice ? (change / prevPrice) * 100 : null;
  const isPositive = (change ?? 0) >= 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/etf/${company.ticker}/refresh`, { method: 'POST' });
      await new Promise(resolve => setTimeout(resolve, 500));
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => router.push('/etf')}
        className="flex items-center gap-1 text-sm text-terminal-muted hover:text-terminal-text transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        ETFs
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-terminal-text">
              {company.ticker}
            </h1>
            {company.exchange && (
              <span className="text-xs text-terminal-muted bg-terminal-card px-2 py-0.5 rounded border border-terminal-border">
                {company.exchange}
              </span>
            )}
            <span className="text-xs text-terminal-muted bg-terminal-card px-2 py-0.5 rounded border border-terminal-border">
              ETF
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded border border-terminal-border bg-terminal-card hover:bg-terminal-border transition-colors"
              title="Refresh ETF data"
            >
              <svg
                className={`w-4 h-4 text-terminal-muted ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-terminal-muted">{company.name}</p>
            {company.lastRefreshedAt && (
              <span className="text-xs text-terminal-muted">
                Last refreshed:{' '}
                {new Date(company.lastRefreshedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-terminal-text font-mono">
            {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : '—'}
          </div>
          {change !== null && changePct !== null && (
            <div
              className={`text-sm font-mono ${isPositive ? 'text-positive' : 'text-negative'}`}
            >
              {isPositive ? '+' : ''}
              {change.toFixed(2)} ({isPositive ? '+' : ''}
              {changePct.toFixed(2)}%)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// About Section (simple text, no card)
// --------------------------------------------------------------------------

function AboutSection({ etfDetails }: { etfDetails: EtfDetailsData | null }) {
  if (!etfDetails) return null;

  const sentences: string[] = [];

  if (etfDetails.assetClass) {
    let s = `This is a ${etfDetails.assetClass} ETF`;
    if (etfDetails.isLeveraged) s += ' that uses leverage';
    sentences.push(s);
  } else if (etfDetails.isLeveraged) {
    sentences.push('This is a leveraged ETF');
  }

  if (etfDetails.sectorBreakdown && etfDetails.sectorBreakdown.length > 0) {
    const topSectors = etfDetails.sectorBreakdown
      .slice(0, 3)
      .map(
        (s) =>
          `${s.sector.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} (${(s.weight * 100).toFixed(1)}%)`
      );
    sentences.push(
      `It primarily invests in the ${topSectors.join(', ')} sectors`
    );
  }

  if (etfDetails.topHoldings && etfDetails.topHoldings.length > 0) {
    const topNames = etfDetails.topHoldings.slice(0, 3).map((h) => h.symbol);
    sentences.push(`Top positions include ${topNames.join(', ')}`);
  }

  const aum = toNum(etfDetails.netAssets);
  const er = toNum(etfDetails.expenseRatio);
  if (aum !== null && er !== null) {
    sentences.push(
      `The fund manages ${formatAum(aum)} in assets with an expense ratio of ${formatPct(er)}`
    );
  } else if (aum !== null) {
    sentences.push(`The fund manages ${formatAum(aum)} in assets`);
  } else if (er !== null) {
    sentences.push(`The fund charges an expense ratio of ${formatPct(er)}`);
  }

  const dy = toNum(etfDetails.dividendYield);
  if (dy !== null && dy > 0) {
    sentences.push(`It offers a dividend yield of ${formatPct(dy)}`);
  }

  if (etfDetails.inceptionDate) {
    const date = new Date(etfDetails.inceptionDate).toLocaleDateString(
      'en-US',
      { year: 'numeric', month: 'long' }
    );
    sentences.push(`Available to investors since ${date}`);
  }

  if (sentences.length === 0) return null;

  return (
    <div className="px-1 pb-2">
      <h3 className="text-sm font-medium text-terminal-text mb-1">
        About this ETF
      </h3>
      <p className="text-sm text-terminal-muted leading-relaxed">
        {sentences.join('. ')}.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
// Overview Tab (REDESIGNED)
// --------------------------------------------------------------------------

function OverviewTab({
  etfDetails,
  prices,
  ticker,
}: {
  etfDetails: EtfDetailsData | null;
  prices: PriceData[];
  ticker: string;
}) {
  const [priceRange, setPriceRange] = useState<PriceRange>('1y');

  const chartData = useMemo(() => {
    const filtered = filterByRange(prices, priceRange);
    return [...filtered].reverse().map((p) => ({
      date: new Date(p.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }),
      price: toNum(p.close),
      volume: toNum(p.volume),
    }));
  }, [prices, priceRange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel — 2/3 */}
      <div className="lg:col-span-2 space-y-4">
        {/* About this ETF */}
        <AboutSection etfDetails={etfDetails} />

        {/* Price History */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">Price History</h3>
            <div className="flex gap-1">
              {(['1m', '3m', '6m', '1y', '3y', 'max'] as PriceRange[]).map(
                (range) => (
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
                )
              )}
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="space-y-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="priceGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="rgb(var(--terminal-accent))"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="rgb(var(--terminal-accent))"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 10,
                        fill: 'rgb(var(--terminal-muted))',
                      }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{
                        fontSize: 10,
                        fill: 'rgb(var(--terminal-muted))',
                      }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(var(--terminal-card))',
                        border: '1px solid rgb(var(--terminal-border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'rgb(var(--terminal-text))',
                      }}
                      formatter={(value: number) => [
                        `$${value.toFixed(2)}`,
                        'Price',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="rgb(var(--terminal-accent))"
                      fill="url(#priceGradient)"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Volume */}
              <div className="h-[60px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 0, right: 5, bottom: 0, left: 5 }}
                  >
                    <Bar
                      dataKey="volume"
                      fill="rgb(var(--terminal-border))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-terminal-muted">
              No price data available
            </div>
          )}
        </div>

        {/* ETF News */}
        <EtfNewsSection ticker={ticker} />
      </div>

      {/* Right Panel — 1/3 */}
      <div className="space-y-4">
        {/* Key Metrics with tooltips + benchmarks */}
        <div className="card">
          <h3 className="card-header">Key Metrics</h3>
          <div className="space-y-1">
            <MetricRow
              label="Asset Class"
              value={etfDetails?.assetClass || '—'}
            />
            <MetricRow
              label="Expense Ratio"
              value={formatPct(toNum(etfDetails?.expenseRatio))}
              tooltip="Annual fee as % of assets. VOO at 0.03% means $3/year per $10,000 invested."
              valueColor="text-terminal-accent"
              benchmark={getBenchmark('expenseRatio', toNum(etfDetails?.expenseRatio))}
            />
            <MetricRow
              label="AUM"
              value={formatAum(toNum(etfDetails?.netAssets))}
              tooltip="Total assets managed. Larger funds are more liquid and less likely to close."
              valueColor="text-terminal-accent"
            />
            <MetricRow
              label="Dividend Yield"
              value={formatPct(toNum(etfDetails?.dividendYield))}
              tooltip="Annual dividends as % of price. Distributing ETFs pay this out; accumulating ETFs reinvest it."
              benchmark={getBenchmark('dividendYield', toNum(etfDetails?.dividendYield))}
            />
            <MetricRow
              label="Portfolio Turnover"
              value={formatPct(toNum(etfDetails?.portfolioTurnover), 1)}
              tooltip="% of holdings replaced per year. Low turnover = fewer taxes and transaction costs."
              benchmark={getBenchmark('portfolioTurnover', toNum(etfDetails?.portfolioTurnover))}
            />
            <MetricRow
              label="Inception Date"
              value={
                etfDetails?.inceptionDate
                  ? new Date(etfDetails.inceptionDate).toLocaleDateString(
                      'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )
                  : '—'
              }
              tooltip="When the fund launched. Longer track record = more historical data to evaluate."
            />
            <MetricRow
              label="Leveraged"
              value={etfDetails?.isLeveraged ? 'Yes' : 'No'}
              tooltip="Leveraged ETFs use debt to amplify returns (2x, 3x). Much higher risk."
            />
          </div>
        </div>

        {/* Sector Pie Chart */}
        <SectorPieChart
          sectors={etfDetails?.sectorBreakdown ?? null}
          netAssets={toNum(etfDetails?.netAssets)}
        />

        {/* Top Holdings */}
        {etfDetails?.topHoldings &&
          Array.isArray(etfDetails.topHoldings) &&
          etfDetails.topHoldings.length > 0 && (
            <div className="card">
              <h3 className="card-header">Top Holdings</h3>
              <div className="space-y-1.5">
                {etfDetails.topHoldings.slice(0, 10).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-terminal-accent font-mono font-medium">
                        {h.symbol}
                      </span>
                      <span className="text-terminal-muted text-xs truncate max-w-[120px]">
                        {h.name}
                      </span>
                    </div>
                    <span className="text-terminal-text font-mono">
                      {(h.weight * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sector Pie Chart
// --------------------------------------------------------------------------

interface SectorTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<{ name: string; value: number; payload?: any }>;
  aum: number | null;
}

function SectorTooltip({ active, payload, aum }: SectorTooltipProps) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const dollarValue = aum ? aum * (value / 100) : null;

  return (
    <div className="bg-terminal-card border border-terminal-border rounded p-2 text-xs shadow-lg">
      <p className="font-semibold text-terminal-text">{name}</p>
      <p className="text-terminal-muted">{value.toFixed(1)}% of portfolio</p>
      {dollarValue !== null && (
        <p className="text-terminal-accent">{formatDollar(dollarValue)}</p>
      )}
    </div>
  );
}

function SectorPieChart({
  sectors,
  netAssets,
}: {
  sectors: Array<{ sector: string; weight: number }> | null;
  netAssets: number | null;
}) {
  if (!sectors || sectors.length === 0) return null;

  const data = useMemo(() => {
    const top = sectors.slice(0, 8);
    const rest = sectors.slice(8);

    const entries = top.map((s) => ({
      name: s.sector
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      value: parseFloat((s.weight * 100).toFixed(1)),
    }));

    if (rest.length > 0) {
      const otherWeight = rest.reduce((sum, s) => sum + s.weight, 0);
      entries.push({
        name: 'Other',
        value: parseFloat((otherWeight * 100).toFixed(1)),
      });
    }

    return entries;
  }, [sectors]);

  return (
    <div className="card">
      <h3 className="card-header">Sector Breakdown</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={80}
              paddingAngle={1}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SECTOR_COLORS[index % SECTOR_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<SectorTooltip aum={netAssets} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend */}
      <div className="mt-3 space-y-1">
        {data.map((sector, i) => {
          const dollarValue = netAssets ? netAssets * (sector.value / 100) : null;
          return (
            <div
              key={sector.name}
              className="flex items-center justify-between text-xs py-0.5"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      SECTOR_COLORS[i % SECTOR_COLORS.length],
                  }}
                />
                <span className="text-terminal-muted">{sector.name}</span>
              </div>
              <div className="flex gap-3">
                {dollarValue !== null && (
                  <span className="text-terminal-text font-mono">
                    {formatDollar(dollarValue)}
                  </span>
                )}
                <span className="text-terminal-muted w-10 text-right">
                  {sector.value.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// ETF News Section
// --------------------------------------------------------------------------

function EtfNewsSection({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/etf/${ticker}/news`)
      .then((r) => r.json())
      .then((data) => setNews(data.news || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  return (
    <div className="card">
      <h3 className="card-header">News — {ticker}</h3>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-terminal-muted text-sm">
          <svg
            className="animate-spin w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading news...
        </div>
      ) : news.length === 0 ? (
        <p className="text-sm text-terminal-muted py-2">
          No recent news found for {ticker}.
        </p>
      ) : (
        <div>
          {news.slice(0, 15).map((item, index) => (
            <div key={index}>
              {index > 0 && (
                <div className="border-t border-terminal-border" />
              )}
              <div className="py-3 flex justify-between items-start gap-4">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-terminal-text hover:text-terminal-accent transition-colors flex-1"
                >
                  {item.title}
                </a>
                {item.pubDate && (
                  <span className="text-xs text-terminal-muted whitespace-nowrap">
                    {timeAgo(item.pubDate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Metric Row with tooltip
// --------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  tooltip,
  valueColor,
  benchmark,
}: {
  label: string;
  value: string;
  tooltip?: string;
  valueColor?: string;
  benchmark?: { label: string; color: string } | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex justify-between items-center py-1">
      <div className="flex items-center gap-1">
        <span className="text-sm text-terminal-muted">{label}</span>
        {tooltip && (
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span className="text-xs text-terminal-muted cursor-help">
              &#9432;
            </span>
            {showTooltip && (
              <div className="absolute left-0 bottom-6 z-50 w-48 p-2 bg-terminal-card border border-terminal-border rounded text-xs text-terminal-muted shadow-lg">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-mono ${valueColor || 'text-terminal-text'}`}
        >
          {value}
        </span>
        {benchmark && (
          <span className={`text-xs ${benchmark.color}`}>
            [{benchmark.label}]
          </span>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Performance Tab
// --------------------------------------------------------------------------

function PerformanceTab({ prices }: { prices: PriceData[] }) {
  const [priceRange, setPriceRange] = useState<PriceRange>('1y');

  const chartData = useMemo(() => {
    const filtered = filterByRange(prices, priceRange);
    return [...filtered].reverse().map((p) => ({
      date: new Date(p.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }),
      price: toNum(p.close),
      volume: toNum(p.volume),
    }));
  }, [prices, priceRange]);

  const returns = useMemo(() => {
    return [
      { label: '1 Month', value: calculatePeriodReturn(prices, 30) },
      { label: '3 Months', value: calculatePeriodReturn(prices, 90) },
      { label: '6 Months', value: calculatePeriodReturn(prices, 180) },
      { label: '1 Year', value: calculatePeriodReturn(prices, 365) },
      { label: '3 Years', value: calculatePeriodReturn(prices, 1095) },
      {
        label: 'Max',
        value:
          prices.length >= 2
            ? (() => {
                const latest = toNum(prices[0]?.close);
                const oldest = toNum(prices[prices.length - 1]?.close);
                return latest && oldest && oldest > 0
                  ? (latest - oldest) / oldest
                  : null;
              })()
            : null,
      },
    ];
  }, [prices]);

  const stats = useMemo(() => {
    const prices1Y = filterByRange(prices, '1y');
    const highs = prices1Y
      .map((p) => toNum(p.high))
      .filter((v): v is number => v !== null);
    const lows = prices1Y
      .map((p) => toNum(p.low))
      .filter((v): v is number => v !== null);

    return {
      high52w: highs.length > 0 ? Math.max(...highs) : null,
      low52w: lows.length > 0 ? Math.min(...lows) : null,
      maxDrawdown: calculateMaxDrawdown(prices1Y),
      volatility: calculateVolatility(prices1Y),
    };
  }, [prices]);

  const currentPrice = toNum(prices[0]?.close);

  return (
    <div className="space-y-6">
      {/* Price Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">Price Chart</h3>
          <div className="flex gap-1">
            {(['1m', '3m', '6m', '1y', '3y', 'max'] as PriceRange[]).map(
              (range) => (
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
              )
            )}
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              >
                <defs>
                  <linearGradient
                    id="perfGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="rgb(var(--terminal-accent))"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(var(--terminal-accent))"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 10,
                    fill: 'rgb(var(--terminal-muted))',
                  }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{
                    fontSize: 10,
                    fill: 'rgb(var(--terminal-muted))',
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(var(--terminal-card))',
                    border: '1px solid rgb(var(--terminal-border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'rgb(var(--terminal-text))',
                  }}
                  formatter={(value: number) => [
                    `$${value.toFixed(2)}`,
                    'Price',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="rgb(var(--terminal-accent))"
                  fill="url(#perfGradient)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-terminal-muted">
            No price data available
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Period Returns */}
        <div className="card">
          <div className="mb-4 p-3 bg-terminal-card border border-terminal-border rounded-lg text-xs text-terminal-muted">
            <p className="font-semibold text-terminal-text mb-1">Period Returns</p>
            <p>
              How much the ETF gained or lost over each time period, expressed as
              a percentage. A 1Y return of +28% means that $10,000 invested one
              year ago would be worth $12,800 today. Positive returns are green;
              negative returns are red. Past performance does not guarantee future
              results.
            </p>
          </div>
          <h3 className="card-header">Period Returns</h3>
          <div className="space-y-3">
            {returns.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-terminal-muted">{r.label}</span>
                <span
                  className={`text-sm font-mono font-medium ${
                    r.value === null
                      ? 'text-terminal-muted'
                      : r.value >= 0
                        ? 'text-positive'
                        : 'text-negative'
                  }`}
                >
                  {r.value !== null
                    ? `${r.value >= 0 ? '+' : ''}${(r.value * 100).toFixed(2)}%`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Volatility & Risk */}
        <div className="card">
          <div className="mb-4 p-3 bg-terminal-card border border-terminal-border rounded-lg text-xs text-terminal-muted">
            <p className="font-semibold text-terminal-text mb-1">Risk &amp; Volatility</p>
            <p>
              <strong className="text-terminal-text">52-Week High/Low:</strong>{' '}
              The highest and lowest prices in the past year — shows the range
              of price swings.
              <br />
              <strong className="text-terminal-text">The price bar</strong>{' '}
              shows where the current price sits within that range.
              <br />
              <strong className="text-terminal-text">
                Annualized Volatility:
              </strong>{' '}
              How much the price fluctuates year over year. Below 15% is low
              risk; 15-25% is moderate; above 25% is high.
              <br />
              <strong className="text-terminal-text">Max Drawdown:</strong> The
              worst peak-to-bottom drop in the period. A -9% drawdown means the
              ETF fell 9% from its highest point before recovering.
            </p>
          </div>
          <h3 className="card-header">Risk & Volatility</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-terminal-muted">52-Week High</span>
              <span className="text-sm font-mono text-terminal-text">
                {stats.high52w !== null
                  ? `$${stats.high52w.toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-terminal-muted">52-Week Low</span>
              <span className="text-sm font-mono text-terminal-text">
                {stats.low52w !== null
                  ? `$${stats.low52w.toFixed(2)}`
                  : '—'}
              </span>
            </div>
            {currentPrice !== null &&
              stats.high52w !== null &&
              stats.low52w !== null &&
              stats.high52w > stats.low52w && (
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-terminal-muted mb-1">
                    <span>${stats.low52w.toFixed(2)}</span>
                    <span>${stats.high52w.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-terminal-border rounded-full overflow-hidden relative">
                    <div
                      className="absolute h-full w-1 bg-terminal-accent rounded-full"
                      style={{
                        left: `${((currentPrice - stats.low52w) / (stats.high52w - stats.low52w)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-terminal-muted mt-1 text-center">
                    Current: ${currentPrice.toFixed(2)}
                  </div>
                </div>
              )}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-terminal-muted">
                Annualized Volatility
              </span>
              <span className="text-sm font-mono text-terminal-text">
                {stats.volatility !== null
                  ? `${(stats.volatility * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-terminal-muted">
                Max Drawdown (1Y)
              </span>
              <span className="text-sm font-mono text-negative">
                {stats.maxDrawdown !== null
                  ? `-${(stats.maxDrawdown * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// ETF Score Tab (FIX 3 — descriptive scores)
// --------------------------------------------------------------------------

function EtfScoreTab({
  etfDetails,
}: {
  etfDetails: EtfDetailsData | null;
}) {
  const er = toNum(etfDetails?.expenseRatio);
  const dy = toNum(etfDetails?.dividendYield);
  const holdings = etfDetails?.topHoldings;
  const sectors = etfDetails?.sectorBreakdown;

  // Cost Efficiency
  const erPct = er !== null ? er * 100 : null;
  let costScore = 0;
  let costInterpretation = '';
  if (erPct !== null) {
    if (erPct < 0.05) {
      costScore = 100;
      costInterpretation = `Excellent — Among the lowest-cost ETFs available. At ${erPct.toFixed(2)}% expense ratio, you pay only $${(erPct * 100).toFixed(0)} per year for every $10,000 invested. Over 30 years, low costs can add tens of thousands of dollars to your returns compared to high-cost alternatives.`;
    } else if (erPct < 0.1) {
      costScore = 90;
      costInterpretation = `Very Good — Low-cost fund at ${erPct.toFixed(2)}%. Keeps more of your returns in your pocket. You pay $${(erPct * 100).toFixed(0)} per year per $10,000 invested.`;
    } else if (erPct < 0.2) {
      costScore = 80;
      costInterpretation = `Good — Competitive expense ratio of ${erPct.toFixed(2)}%. Low cost for most investors.`;
    } else if (erPct < 0.5) {
      costScore = 60;
      costInterpretation = `Average — Typical cost of ${erPct.toFixed(2)}% for an actively managed fund. Acceptable if the strategy justifies it, but compare with similar ETFs.`;
    } else if (erPct < 1.0) {
      costScore = 40;
      costInterpretation = `Above Average Cost — At ${erPct.toFixed(2)}%, you are paying more than necessary. That is $${(erPct * 100).toFixed(0)} per year per $10,000 invested. Compare with similar lower-cost ETFs.`;
    } else {
      costScore = 20;
      costInterpretation = `High Cost — At ${erPct.toFixed(2)}%, this significantly reduces long-term returns. Consider lower-cost alternatives that track similar indices.`;
    }
  }

  // Diversification sub-metrics
  const top1Weight = holdings && holdings.length > 0 ? (holdings[0]?.weight ?? 0) * 100 : null;
  const top5Weight =
    holdings && holdings.length > 0
      ? holdings.slice(0, 5).reduce((s, h) => s + h.weight, 0) * 100
      : null;
  const sectorCount = sectors?.length ?? 0;

  let divScore = 0;
  if (holdings && holdings.length > 0) {
    const tw = holdings[0]?.weight ?? 0;
    const t10 = holdings.slice(0, 10).reduce((s, h) => s + h.weight, 0);
    let cs = tw < 0.03 ? 40 : tw < 0.05 ? 35 : tw < 0.08 ? 25 : tw < 0.15 ? 15 : 5;
    let ts = t10 < 0.2 ? 30 : t10 < 0.3 ? 25 : t10 < 0.4 ? 20 : t10 < 0.6 ? 10 : 5;
    let ss = sectorCount >= 8 ? 30 : sectorCount >= 5 ? 20 : sectorCount >= 3 ? 10 : 5;
    divScore = cs + ts + ss;
  }

  const getSubColor = (val: number, greenMax: number, yellowMax: number) => {
    if (val <= greenMax) return 'text-positive';
    if (val <= yellowMax) return 'text-warn';
    return 'text-negative';
  };

  // Income
  const dyPct = dy !== null ? dy * 100 : null;
  let incomeScore = 0;
  let incomeContext = '';
  if (dyPct !== null) {
    if (dyPct > 5) {
      incomeScore = 100;
      incomeContext = 'High income — suitable for income-focused investors';
    } else if (dyPct > 3) {
      incomeScore = 80;
      incomeContext = 'High income — suitable for income-focused investors';
    } else if (dyPct > 1) {
      incomeScore = dyPct > 2 ? 60 : 40;
      incomeContext = 'Moderate income — balanced approach';
    } else if (dyPct > 0) {
      incomeScore = 20;
      incomeContext = 'Low income — growth-focused, reinvests returns';
    } else {
      incomeScore = 0;
      incomeContext = 'No dividend — fully accumulating fund';
    }
  }

  const annualDiv = dyPct !== null ? (10000 * dyPct) / 100 : null;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-positive';
    if (s >= 60) return 'text-terminal-accent';
    if (s >= 40) return 'text-warn';
    return 'text-negative';
  };

  const getBarColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-blue-500';
    if (s >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="card-header">ETF Composite Score</h3>
        <p className="text-sm text-terminal-muted mb-6">
          Scores are calculated from the fund&apos;s characteristics. They
          represent relative quality within each category — not a buy/sell
          recommendation.
        </p>
      </div>

      {/* Cost Efficiency */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-terminal-text">
            Cost Efficiency
          </h4>
          {erPct !== null ? (
            <span
              className={`text-2xl font-bold font-mono ${getScoreColor(costScore)}`}
            >
              {costScore}
            </span>
          ) : (
            <span className="text-sm text-terminal-muted">N/A</span>
          )}
        </div>
        {erPct !== null && (
          <>
            <div className="h-2 bg-terminal-border rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(costScore)}`}
                style={{ width: `${costScore}%` }}
              />
            </div>
            <p className="text-xs text-terminal-muted leading-relaxed">
              {costInterpretation}
            </p>
          </>
        )}
      </div>

      {/* Diversification */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-terminal-text">
            Diversification
          </h4>
          {holdings && holdings.length > 0 ? (
            <span
              className={`text-2xl font-bold font-mono ${getScoreColor(divScore)}`}
            >
              {divScore}
            </span>
          ) : (
            <span className="text-sm text-terminal-muted">N/A</span>
          )}
        </div>
        {holdings && holdings.length > 0 && (
          <>
            <div className="h-2 bg-terminal-border rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(divScore)}`}
                style={{ width: `${divScore}%` }}
              />
            </div>
            <p className="text-xs text-terminal-muted leading-relaxed mb-4">
              Diversification measures how spread out the ETF&apos;s investments
              are. A well-diversified ETF reduces the risk that any single
              company&apos;s problems will hurt your entire investment.
            </p>
            <div className="space-y-2">
              {top1Weight !== null && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-terminal-muted">
                    Largest single position
                  </span>
                  <span
                    className={`font-mono font-medium ${getSubColor(top1Weight, 10, 20)}`}
                  >
                    {top1Weight.toFixed(1)}%
                  </span>
                </div>
              )}
              {top5Weight !== null && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-terminal-muted">
                    Top 5 holdings
                  </span>
                  <span
                    className={`font-mono font-medium ${getSubColor(top5Weight, 25, 40)}`}
                  >
                    {top5Weight.toFixed(1)}% of portfolio
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-terminal-muted">Sector spread</span>
                <span
                  className={`font-mono font-medium ${sectorCount > 5 ? 'text-positive' : sectorCount >= 3 ? 'text-warn' : 'text-negative'}`}
                >
                  {sectorCount} sectors
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Income */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-terminal-text">
            Income Generation
          </h4>
          {dyPct !== null ? (
            <span
              className={`text-2xl font-bold font-mono ${getScoreColor(incomeScore)}`}
            >
              {incomeScore}
            </span>
          ) : (
            <span className="text-sm text-terminal-muted">N/A</span>
          )}
        </div>
        {dyPct !== null && (
          <>
            <div className="h-2 bg-terminal-border rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(incomeScore)}`}
                style={{ width: `${incomeScore}%` }}
              />
            </div>
            <p className="text-xs text-terminal-muted leading-relaxed mb-4">
              Income score reflects how much this ETF pays out in dividends.
              This matters if you want regular cash from your investments.
              Growth-focused ETFs often have low yields — they reinvest profits
              instead of paying them out, which can still build wealth over
              time.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-terminal-muted">
                  Annual Dividend Yield
                </span>
                <span className="font-mono font-medium text-terminal-accent">
                  {dyPct.toFixed(2)}%
                </span>
              </div>
              {annualDiv !== null && (
                <p className="text-xs text-terminal-muted">
                  On a $10,000 investment, this ETF would pay approximately{' '}
                  <span className="text-terminal-text font-mono">
                    ${annualDiv.toFixed(0)}
                  </span>{' '}
                  per year in dividends.
                </p>
              )}
              <p className="text-xs text-terminal-muted italic">
                {incomeContext}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Analysis Tab
// --------------------------------------------------------------------------

function AnalysisTab({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // Load existing analysis on mount
  useEffect(() => {
    fetch(`/api/etf/${ticker}/analysis`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.analysis?.content) {
          setAnalysis(data.analysis.content);
          setAnalysisDate(data.analysis.generatedAt || null);
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [ticker]);

  const runAnalysis = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/etf/${ticker}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate analysis');
        return;
      }

      setAnalysis(data.analysis?.content || 'No analysis generated');
      setAnalysisDate(data.analysis?.generatedAt || null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const formatAnalysisDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="card-header">ETF Deep Analysis</h3>
        <p className="text-sm text-terminal-muted mb-4">
          Powered by Claude AI with web search. Analyzes this ETF across 11
          fundamental factors including costs, holdings, performance, risk, and
          suitability.
        </p>

        <div className="flex items-center gap-3 mb-4">
          {analysis && !loading ? (
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="btn btn-secondary text-sm"
            >
              Re-run Analysis
            </button>
          ) : (
            <button
              onClick={runAnalysis}
              disabled={loading || initialLoading}
              className="btn btn-primary"
            >
              {loading ? `Analyzing ${ticker}...` : 'Run Full Analysis'}
            </button>
          )}

          {analysisDate && !loading && (
            <span className="text-xs text-terminal-muted">
              Last analyzed: {formatAnalysisDate(analysisDate)}
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 alert-error rounded text-sm mb-4">{error}</div>
        )}

        {loading && (
          <div className="flex items-center gap-3 p-4 text-terminal-muted">
            <svg
              className="animate-spin w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>
              Analyzing {ticker} with web search... This may take 30-60
              seconds.
            </span>
          </div>
        )}

        {initialLoading && !analysis && (
          <div className="flex items-center gap-2 py-4 text-terminal-muted text-sm">
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading saved analysis...
          </div>
        )}

        {analysis && (
          <div className="p-4 bg-terminal-bg rounded-lg border border-terminal-border">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold text-terminal-text mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold text-terminal-text mt-4 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold text-terminal-text mt-3 mb-1">{children}</h3>,
                p: ({ children }) => <p className="text-sm text-terminal-muted mb-2 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ol>,
                li: ({ children }) => <li className="text-sm text-terminal-muted">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-terminal-text">{children}</strong>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full text-xs border-collapse border border-terminal-border">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="text-left px-2 py-1 border border-terminal-border bg-terminal-card text-terminal-text font-semibold whitespace-nowrap">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-2 py-1 border border-terminal-border text-terminal-muted text-xs">{children}</td>
                ),
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
