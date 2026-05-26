'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types ──────────────────────────────────────────────────────────
interface TopSector {
  sector: string;
  weight: number;
}

interface FundInfo {
  ticker: string;
  name: string;
  totalHoldings: number;
  aum: number | null;
  expenseRatio: number | null;
  dividendYield: number | null;
  portfolioTurnover: number | null;
  inceptionDate: string | null;
  isLeveraged: boolean;
  assetClass: string | null;
  topSectors: TopSector[];
}

interface OverlapStats {
  byWeight: number;
  overlappingCount: number;
  fund1OnlyCount: number;
  fund2OnlyCount: number;
}

interface OverlappingHolding {
  symbol: string;
  name: string;
  weightInFund1: number;
  weightInFund2: number;
  overlapWeight: number;
}

interface SectorDriftEntry {
  sector: string;
  fund1Weight: number;
  fund2Weight: number;
  drift: number;
}

interface OverweightHolding {
  symbol: string;
  name: string;
  weight: number;
  diff: number;
}

interface OverlapData {
  fund1: FundInfo;
  fund2: FundInfo;
  overlap: OverlapStats;
  topOverlapping: OverlappingHolding[];
  sectorDrift: SectorDriftEntry[];
  fund1Overweight: OverweightHolding[];
  fund2Overweight: OverweightHolding[];
}

interface EtfOption {
  ticker: string;
  name: string;
}

// ── Helpers ────────────────────────────────────────────────────────
function formatAum(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPct(value: number | null, multiplied = true): string {
  if (value === null) return '—';
  const v = multiplied ? value * 100 : value;
  return v.toFixed(2) + '%';
}

// ── Venn Diagram SVG ───────────────────────────────────────────────
function VennDiagram({
  overlapPct,
  fund1Ticker,
  fund2Ticker,
}: {
  overlapPct: number;
  fund1Ticker: string;
  fund2Ticker: string;
}) {
  // Map overlap % to circle separation (0% → far apart, 100% → fully overlapping)
  const pct = Math.min(Math.max(overlapPct, 0), 1);
  const r = 70;
  const maxSep = r * 2;
  const minSep = 0;
  const separation = maxSep - pct * (maxSep - minSep);
  const cx1 = 150 - separation / 2;
  const cx2 = 150 + separation / 2;
  const cy = 100;

  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-md mx-auto">
      {/* Fund 1 circle */}
      <circle
        cx={cx1}
        cy={cy}
        r={r}
        fill="rgb(var(--terminal-accent) / 0.3)"
        stroke="rgb(var(--terminal-accent))"
        strokeWidth={2}
      />
      {/* Fund 2 circle */}
      <circle
        cx={cx2}
        cy={cy}
        r={r}
        fill="rgb(var(--terminal-success) / 0.3)"
        stroke="rgb(var(--terminal-success))"
        strokeWidth={2}
      />
      {/* Labels */}
      <text
        x={cx1 - 20}
        y={cy - r - 10}
        textAnchor="middle"
        className="fill-terminal-accent text-sm font-bold"
        fontSize="14"
      >
        {fund1Ticker}
      </text>
      <text
        x={cx2 + 20}
        y={cy - r - 10}
        textAnchor="middle"
        className="fill-terminal-success text-sm font-bold"
        fontSize="14"
      >
        {fund2Ticker}
      </text>
      {/* Overlap percentage in center */}
      <text
        x={150}
        y={cy - 5}
        textAnchor="middle"
        className="fill-terminal-text font-bold"
        fontSize="20"
      >
        {(pct * 100).toFixed(0)}%
      </text>
      <text
        x={150}
        y={cy + 14}
        textAnchor="middle"
        className="fill-terminal-muted"
        fontSize="11"
      >
        OVERLAP
      </text>
    </svg>
  );
}

// ── Side by Side Comparison ───────────────────────────────────────
function SideBySideComparison({
  fund1,
  fund2,
}: {
  fund1: FundInfo;
  fund2: FundInfo;
}) {
  const [open, setOpen] = useState(true);

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function topSectorLabel(sectors: TopSector[]): string {
    if (!sectors || sectors.length === 0) return '—';
    const s = sectors[0];
    return `${s.sector} ${(s.weight * 100).toFixed(1)}%`;
  }

  type Favor = 1 | 2 | null;

  interface Row {
    label: string;
    v1: string;
    v2: string;
    favor: Favor;
  }

  const lowerBetter = (a: number | null, b: number | null): Favor => {
    if (a === null || b === null) return null;
    if (a < b) return 1;
    if (b < a) return 2;
    return null;
  };

  const higherBetter = (a: number | null, b: number | null): Favor => {
    if (a === null || b === null) return null;
    if (a > b) return 1;
    if (b > a) return 2;
    return null;
  };

  const leveragedFavor = (): Favor => {
    if (!fund1.isLeveraged && fund2.isLeveraged) return 1;
    if (!fund2.isLeveraged && fund1.isLeveraged) return 2;
    return null;
  };

  const rows: Row[] = [
    {
      label: 'Asset Class',
      v1: fund1.assetClass ?? '—',
      v2: fund2.assetClass ?? '—',
      favor: null,
    },
    {
      label: 'Expense Ratio',
      v1: formatPct(fund1.expenseRatio),
      v2: formatPct(fund2.expenseRatio),
      favor: lowerBetter(fund1.expenseRatio, fund2.expenseRatio),
    },
    {
      label: 'AUM',
      v1: formatAum(fund1.aum),
      v2: formatAum(fund2.aum),
      favor: higherBetter(fund1.aum, fund2.aum),
    },
    {
      label: 'Dividend Yield',
      v1: formatPct(fund1.dividendYield),
      v2: formatPct(fund2.dividendYield),
      favor: null,
    },
    {
      label: 'Portfolio Turnover',
      v1: formatPct(fund1.portfolioTurnover),
      v2: formatPct(fund2.portfolioTurnover),
      favor: lowerBetter(fund1.portfolioTurnover, fund2.portfolioTurnover),
    },
    {
      label: 'Total Holdings',
      v1: String(fund1.totalHoldings),
      v2: String(fund2.totalHoldings),
      favor: higherBetter(fund1.totalHoldings, fund2.totalHoldings),
    },
    {
      label: 'Inception Date',
      v1: formatDate(fund1.inceptionDate),
      v2: formatDate(fund2.inceptionDate),
      favor: null,
    },
    {
      label: 'Leveraged',
      v1: fund1.isLeveraged ? 'Yes' : 'No',
      v2: fund2.isLeveraged ? 'Yes' : 'No',
      favor: leveragedFavor(),
    },
    {
      label: 'Top Sector',
      v1: topSectorLabel(fund1.topSectors),
      v2: topSectorLabel(fund2.topSectors),
      favor: null,
    },
  ];

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h2 className="text-sm font-semibold text-terminal-text uppercase tracking-wider">
          Side by Side Comparison
        </h2>
        <svg
          className={`w-4 h-4 text-terminal-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-terminal-border">
                <th className="text-left px-4 py-2 text-xs text-terminal-muted uppercase tracking-wider font-medium">
                  Metric
                </th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wider font-medium text-terminal-accent">
                  {fund1.ticker}
                </th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wider font-medium text-terminal-accent">
                  {fund2.ticker}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={`border-t border-terminal-border ${i % 2 === 0 ? 'bg-terminal-bg/50' : ''}`}
                >
                  <td className="px-4 py-2 text-terminal-muted">{row.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-terminal-text">
                    {row.v1}
                    {row.favor === 1 && (
                      <span className="ml-2 text-terminal-success">&#10003;</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-terminal-text">
                    {row.v2}
                    {row.favor === 2 && (
                      <span className="ml-2 text-terminal-success">&#10003;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────
export default function EtfOverlapPage() {
  const [etfOptions, setEtfOptions] = useState<EtfOption[]>([]);
  const [fund1, setFund1] = useState('');
  const [fund2, setFund2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<OverlapData | null>(null);
  const [showAllHoldings, setShowAllHoldings] = useState(false);

  // AI analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiError, setAiError] = useState('');

  // Fetch ETF list for dropdowns
  const fetchEtfs = useCallback(async () => {
    try {
      const res = await fetch('/api/etf');
      const json = await res.json();
      if (json.success) {
        setEtfOptions(
          json.etfs.map((e: { ticker: string; name: string }) => ({
            ticker: e.ticker,
            name: e.name,
          }))
        );
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchEtfs();
  }, [fetchEtfs]);

  // Find overlap
  const handleFindOverlap = async () => {
    if (!fund1 || !fund2) return;
    setLoading(true);
    setError('');
    setData(null);
    setAiAnalysis('');
    setAiError('');

    try {
      const res = await fetch(`/api/etf/overlap?fund1=${fund1}&fund2=${fund2}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to calculate overlap');
        return;
      }
      setData(json);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Run AI analysis
  const handleAiAnalysis = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError('');

    try {
      const res = await fetch('/api/etf/overlap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fund1: data.fund1.ticker,
          fund2: data.fund2.ticker,
          overlapData: data,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error || 'Failed to generate analysis');
        return;
      }
      setAiAnalysis(json.analysis.content);
    } catch {
      setAiError('Network error');
    } finally {
      setAiLoading(false);
    }
  };

  // Sector drift chart data
  const sectorChartData = data?.sectorDrift.map((s) => ({
    sector: s.sector.length > 18 ? s.sector.slice(0, 16) + '...' : s.sector,
    drift: +(s.drift * 100).toFixed(2),
    fullSector: s.sector,
    fund1: +(s.fund1Weight * 100).toFixed(2),
    fund2: +(s.fund2Weight * 100).toFixed(2),
  }));

  const holdingsToShow = data
    ? showAllHoldings
      ? data.topOverlapping
      : data.topOverlapping.slice(0, 20)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-terminal-text">ETF Overlap</h1>
        <p className="text-sm text-terminal-muted mt-1">
          See which holdings any two ETFs have in common
        </p>
      </div>

      {/* Input Section */}
      <div className="card p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-terminal-muted mb-1 uppercase tracking-wider">
              Fund 1
            </label>
            <select
              value={fund1}
              onChange={(e) => setFund1(e.target.value)}
              className="input w-full"
              disabled={loading}
            >
              <option value="">Select ETF...</option>
              {etfOptions.map((e) => (
                <option key={e.ticker} value={e.ticker}>
                  {e.ticker} — {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-terminal-muted mb-1 uppercase tracking-wider">
              Fund 2
            </label>
            <select
              value={fund2}
              onChange={(e) => setFund2(e.target.value)}
              className="input w-full"
              disabled={loading}
            >
              <option value="">Select ETF...</option>
              {etfOptions.map((e) => (
                <option key={e.ticker} value={e.ticker}>
                  {e.ticker} — {e.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleFindOverlap}
            disabled={loading || !fund1 || !fund2 || fund1 === fund2}
            className="btn btn-primary"
          >
            {loading ? 'Calculating...' : 'Find Overlap'}
          </button>
        </div>

        {error && (
          <p className="text-danger-semantic text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Results */}
      {data && (
        <>
          {/* Row 1 — Venn + Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 flex items-center justify-center">
              <VennDiagram
                overlapPct={data.overlap.byWeight}
                fund1Ticker={data.fund1.ticker}
                fund2Ticker={data.fund2.ticker}
              />
            </div>

            <div className="card p-6 grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-terminal-bg">
                <p className="text-3xl font-bold text-terminal-accent">
                  {(data.overlap.byWeight * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-terminal-muted mt-1 uppercase tracking-wider">
                  Overlap by Weight
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-terminal-bg">
                <p className="text-3xl font-bold text-terminal-text">
                  {data.overlap.overlappingCount}
                </p>
                <p className="text-xs text-terminal-muted mt-1 uppercase tracking-wider">
                  Overlapping Holdings
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-terminal-bg">
                <p className="text-3xl font-bold text-terminal-accent">
                  {data.overlap.fund1OnlyCount}
                </p>
                <p className="text-xs text-terminal-muted mt-1 uppercase tracking-wider">
                  {data.fund1.ticker} Only
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-terminal-bg">
                <p className="text-3xl font-bold text-terminal-success">
                  {data.overlap.fund2OnlyCount}
                </p>
                <p className="text-xs text-terminal-muted mt-1 uppercase tracking-wider">
                  {data.fund2.ticker} Only
                </p>
              </div>
            </div>
          </div>

          {/* Fund info cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-terminal-accent mb-3 uppercase tracking-wider">
                {data.fund1.ticker}
              </h3>
              <p className="text-terminal-text text-sm mb-2">{data.fund1.name}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-terminal-muted">AUM</span>
                  <span className="text-terminal-text font-mono">
                    {formatAum(data.fund1.aum)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-muted">Expense Ratio</span>
                  <span className="text-terminal-text font-mono">
                    {formatPct(data.fund1.expenseRatio)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-muted">Holdings Analyzed</span>
                  <span className="text-terminal-text font-mono">
                    {data.fund1.totalHoldings}
                  </span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-terminal-success mb-3 uppercase tracking-wider">
                {data.fund2.ticker}
              </h3>
              <p className="text-terminal-text text-sm mb-2">{data.fund2.name}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-terminal-muted">AUM</span>
                  <span className="text-terminal-text font-mono">
                    {formatAum(data.fund2.aum)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-muted">Expense Ratio</span>
                  <span className="text-terminal-text font-mono">
                    {formatPct(data.fund2.expenseRatio)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-muted">Holdings Analyzed</span>
                  <span className="text-terminal-text font-mono">
                    {data.fund2.totalHoldings}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 — Side by Side Comparison */}
          <SideBySideComparison fund1={data.fund1} fund2={data.fund2} />

          {/* Row 3 — Sector Drift */}
          {sectorChartData && sectorChartData.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-terminal-text mb-1 uppercase tracking-wider">
                Sector Drift
              </h2>
              <p className="text-xs text-terminal-muted mb-4">
                Positive = {data.fund1.ticker} has more exposure, Negative ={' '}
                {data.fund2.ticker} has more exposure
              </p>

              <div style={{ width: '100%', height: Math.max(300, sectorChartData.length * 36) }}>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={sectorChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgb(var(--terminal-border))"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => `${v}%`}
                      stroke="rgb(var(--terminal-muted))"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="sector"
                      width={140}
                      stroke="rgb(var(--terminal-muted))"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(var(--terminal-card))',
                        border: '1px solid rgb(var(--terminal-border))',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'rgb(var(--terminal-text))' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, _name: any, props: any) => {
                        const p = props?.payload;
                        if (!p) return [String(value), ''];
                        return [
                          `${p.fullSector}\n${data.fund1.ticker}: ${p.fund1}% | ${data.fund2.ticker}: ${p.fund2}% | Drift: ${value > 0 ? '+' : ''}${value}%`,
                          '',
                        ];
                      }}
                    />
                    <ReferenceLine x={0} stroke="rgb(var(--terminal-muted))" />
                    <Bar dataKey="drift" radius={[0, 4, 4, 0]}>
                      {sectorChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry.drift >= 0
                              ? 'rgb(var(--terminal-accent))'
                              : 'rgb(var(--terminal-success))'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Row 3 — Overlapping Holdings Table */}
          <div className="card">
            <div className="p-4 border-b border-terminal-border">
              <h2 className="text-sm font-semibold text-terminal-text uppercase tracking-wider">
                Overlapping Holdings
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th className="text-right">
                      Weight in {data.fund1.ticker}
                    </th>
                    <th className="text-right">
                      Weight in {data.fund2.ticker}
                    </th>
                    <th className="text-right">Overlap</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsToShow.map((h) => (
                    <tr key={h.symbol}>
                      <td>
                        <span className="text-terminal-accent font-medium">
                          {h.symbol}
                        </span>
                        <span className="text-terminal-muted ml-2 text-xs">
                          {h.name}
                        </span>
                      </td>
                      <td className="text-right font-mono text-terminal-text">
                        {formatPct(h.weightInFund1)}
                      </td>
                      <td className="text-right font-mono text-terminal-text">
                        {formatPct(h.weightInFund2)}
                      </td>
                      <td className="text-right font-mono text-terminal-accent">
                        {formatPct(h.overlapWeight)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.topOverlapping.length > 20 && !showAllHoldings && (
              <div className="p-3 text-center border-t border-terminal-border">
                <button
                  onClick={() => setShowAllHoldings(true)}
                  className="text-sm text-terminal-accent hover:underline"
                >
                  Show all {data.topOverlapping.length} overlapping holdings
                </button>
              </div>
            )}
          </div>

          {/* Row 4 — Overweight Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fund1 Overweight */}
            <div className="card">
              <div className="p-4 border-b border-terminal-border">
                <h2 className="text-sm font-semibold text-terminal-accent uppercase tracking-wider">
                  {data.fund1.ticker} Overweight
                </h2>
                <p className="text-xs text-terminal-muted">
                  relative to {data.fund2.ticker}
                </p>
              </div>
              <div className="p-4 space-y-2">
                {data.fund1Overweight.length === 0 ? (
                  <p className="text-sm text-terminal-muted">No significant overweight positions</p>
                ) : (
                  data.fund1Overweight.map((h) => (
                    <div key={h.symbol} className="flex items-center gap-3">
                      <div className="w-16 text-sm">
                        <span className="text-terminal-accent font-medium">
                          {h.symbol}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="h-3 bg-terminal-bg rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(h.diff * 100 * 10, 100)}%`,
                              backgroundColor: 'rgb(var(--terminal-accent))',
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-mono text-terminal-accent w-16 text-right">
                        +{(h.diff * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Fund2 Overweight */}
            <div className="card">
              <div className="p-4 border-b border-terminal-border">
                <h2 className="text-sm font-semibold text-terminal-success uppercase tracking-wider">
                  {data.fund2.ticker} Overweight
                </h2>
                <p className="text-xs text-terminal-muted">
                  relative to {data.fund1.ticker}
                </p>
              </div>
              <div className="p-4 space-y-2">
                {data.fund2Overweight.length === 0 ? (
                  <p className="text-sm text-terminal-muted">No significant overweight positions</p>
                ) : (
                  data.fund2Overweight.map((h) => (
                    <div key={h.symbol} className="flex items-center gap-3">
                      <div className="w-16 text-sm">
                        <span className="text-terminal-success font-medium">
                          {h.symbol}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="h-3 bg-terminal-bg rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(h.diff * 100 * 10, 100)}%`,
                              backgroundColor: 'rgb(var(--terminal-success))',
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-mono text-terminal-success w-16 text-right">
                        +{(h.diff * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 5 — AI Analysis */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-terminal-text uppercase tracking-wider">
                  AI Overlap Analysis
                </h2>
                <p className="text-xs text-terminal-muted mt-1">
                  Deep comparison between these ETFs using web search for additional context
                </p>
              </div>
              <button
                onClick={handleAiAnalysis}
                disabled={aiLoading}
                className="btn btn-primary"
              >
                {aiLoading ? 'Analyzing...' : aiAnalysis ? 'Re-run Analysis' : 'Run AI Analysis'}
              </button>
            </div>

            {aiError && (
              <p className="text-danger-semantic text-sm mb-3">{aiError}</p>
            )}

            {aiLoading && (
              <div className="text-center py-8 text-terminal-muted">
                <div className="inline-block w-5 h-5 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-sm">Analyzing overlap...</p>
              </div>
            )}

            {aiAnalysis && !aiLoading && (
              <div className="prose prose-invert max-w-none text-sm leading-relaxed text-terminal-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {aiAnalysis}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
