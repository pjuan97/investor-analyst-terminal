'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ───────────────────────────────────────────────────
interface EtfScreenerResult {
  ticker: string;
  name: string;
  sector: string | null;
  netAssets: number | null;
  expenseRatio: number | null;
  dividendYield: number | null;
  portfolioTurnover: number | null;
  inceptionDate: string | null;
  isLeveraged: boolean;
  assetClass: string | null;
  numHoldings: number | null;
}

interface Filters {
  netAssetsMin: string;
  netAssetsMax: string;
  expenseRatioMin: string;
  expenseRatioMax: string;
  dividendYieldMin: string;
  dividendYieldMax: string;
  portfolioTurnoverMin: string;
  portfolioTurnoverMax: string;
  inceptionBefore: string;
  inceptionAfter: string;
  isLeveraged: string;
  assetClass: string;
}

const emptyFilters: Filters = {
  netAssetsMin: '',
  netAssetsMax: '',
  expenseRatioMin: '',
  expenseRatioMax: '',
  dividendYieldMin: '',
  dividendYieldMax: '',
  portfolioTurnoverMin: '',
  portfolioTurnoverMax: '',
  inceptionBefore: '',
  inceptionAfter: '',
  isLeveraged: 'all',
  assetClass: '',
};

// ── Formatters ──────────────────────────────────────────────
function fmtAum(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

// ── Column defs ─────────────────────────────────────────────
interface Column {
  key: string;
  label: string;
  sortKey: string;
  render: (r: EtfScreenerResult) => React.ReactNode;
  align?: 'left' | 'right';
}

const columns: Column[] = [
  {
    key: 'ticker',
    label: 'Ticker',
    sortKey: 'ticker',
    render: (r) => (
      <Link
        href={`/etf/${r.ticker}`}
        className="text-terminal-accent hover:underline font-mono font-medium"
      >
        {r.ticker}
      </Link>
    ),
  },
  {
    key: 'name',
    label: 'Name',
    sortKey: 'name',
    render: (r) => (
      <span className="text-terminal-text truncate max-w-[200px] inline-block">
        {r.name}
      </span>
    ),
  },
  {
    key: 'assetClass',
    label: 'Asset Class',
    sortKey: 'assetClass',
    render: (r) => (
      <span className="text-terminal-muted text-xs truncate max-w-[100px] inline-block">
        {r.assetClass || '—'}
      </span>
    ),
  },
  {
    key: 'netAssets',
    label: 'AUM',
    sortKey: 'netAssets',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtAum(r.netAssets)}</span>,
  },
  {
    key: 'expenseRatio',
    label: 'Expense Ratio',
    sortKey: 'expenseRatio',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtPct(r.expenseRatio)}</span>,
  },
  {
    key: 'dividendYield',
    label: 'Div Yield',
    sortKey: 'dividendYield',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtPct(r.dividendYield)}</span>,
  },
  {
    key: 'portfolioTurnover',
    label: 'Turnover',
    sortKey: 'portfolioTurnover',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtPct(r.portfolioTurnover)}</span>,
  },
  {
    key: 'isLeveraged',
    label: 'Leveraged',
    sortKey: 'isLeveraged',
    render: (r) => (
      <span
        className={`text-xs px-1.5 py-0.5 rounded ${
          r.isLeveraged
            ? 'bg-terminal-danger/20 text-terminal-danger'
            : 'bg-terminal-success/20 text-terminal-success'
        }`}
      >
        {r.isLeveraged ? 'Yes' : 'No'}
      </span>
    ),
  },
  {
    key: 'numHoldings',
    label: 'Holdings',
    sortKey: 'numHoldings',
    align: 'right',
    render: (r) => (
      <span className="font-mono">{r.numHoldings ?? '—'}</span>
    ),
  },
];

// ── Filter Input Components ─────────────────────────────────
function RangeFilter({
  label,
  minKey,
  maxKey,
  filters,
  onChange,
  suffix = '%',
}: {
  label: string;
  minKey: keyof Filters;
  maxKey: keyof Filters;
  filters: Filters;
  onChange: (key: keyof Filters, val: string) => void;
  suffix?: string;
}) {
  return (
    <div className="mb-3">
      <label className="text-xs text-terminal-muted font-medium block mb-1">
        {label} <span className="text-terminal-muted/60">({suffix})</span>
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Min"
          value={filters[minKey]}
          onChange={(e) => onChange(minKey, e.target.value)}
          className="input text-xs py-1.5 px-2 w-full"
        />
        <input
          type="number"
          placeholder="Max"
          value={filters[maxKey]}
          onChange={(e) => onChange(maxKey, e.target.value)}
          className="input text-xs py-1.5 px-2 w-full"
        />
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function EtfScreenerPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [results, setResults] = useState<EtfScreenerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('netAssets');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load asset classes on mount
  useEffect(() => {
    fetch('/api/etf/screener?assetClasses=true')
      .then((r) => r.json())
      .then((d) => setAssetClasses(d.assetClasses || []))
      .catch(() => {});
  }, []);

  const fetchResults = useCallback(
    async (f: Filters, sort: string, order: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(f)) {
          if (val !== '' && val !== 'all' && val !== 'All') {
            params.set(key, val);
          }
        }
        params.set('sortBy', sort);
        params.set('sortDir', order);

        const res = await fetch(`/api/etf/screener?${params.toString()}`);
        const json = await res.json();
        setResults(json.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load all ETFs on mount
  useEffect(() => {
    fetchResults(emptyFilters, sortBy, sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (key: keyof Filters, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const handleRunScreen = () => {
    fetchResults(filters, sortBy, sortOrder);
  };

  const handleReset = () => {
    setFilters(emptyFilters);
    setSortBy('netAssets');
    setSortOrder('desc');
    fetchResults(emptyFilters, 'netAssets', 'desc');
  };

  const handleSort = (colSortKey: string) => {
    let newOrder: 'asc' | 'desc' = 'desc';
    if (sortBy === colSortKey) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(colSortKey);
    setSortOrder(newOrder);
    fetchResults(filters, colSortKey, newOrder);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-terminal-text">ETF Screener</h1>
        <p className="text-sm text-terminal-muted mt-1">
          Filter ETFs by fund metrics and structure
        </p>
      </div>

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* ── Left: Filters Panel ──────────────────────────── */}
        <div className="w-72 flex-shrink-0">
          <div className="card space-y-1">
            {/* Fundamentals */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider mb-0.5">
              Fundamentals
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              Size, cost, and income characteristics
            </p>
            <RangeFilter
              label="Net Assets / AUM"
              minKey="netAssetsMin"
              maxKey="netAssetsMax"
              filters={filters}
              onChange={handleFilterChange}
              suffix="$B"
            />
            <RangeFilter
              label="Expense Ratio"
              minKey="expenseRatioMin"
              maxKey="expenseRatioMax"
              filters={filters}
              onChange={handleFilterChange}
            />
            <RangeFilter
              label="Dividend Yield"
              minKey="dividendYieldMin"
              maxKey="dividendYieldMax"
              filters={filters}
              onChange={handleFilterChange}
            />

            {/* Structure */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider pt-2 mb-0.5">
              Structure
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              Fund type, leverage, and inception
            </p>

            {/* Asset Class dropdown */}
            <div className="mb-3">
              <label className="text-xs text-terminal-muted font-medium block mb-1">
                Asset Class
              </label>
              <select
                value={filters.assetClass}
                onChange={(e) => handleFilterChange('assetClass', e.target.value)}
                className="input text-xs py-1.5 px-2 w-full"
              >
                <option value="">All</option>
                {assetClasses.map((ac) => (
                  <option key={ac} value={ac}>
                    {ac}
                  </option>
                ))}
              </select>
            </div>

            {/* Leveraged dropdown */}
            <div className="mb-3">
              <label className="text-xs text-terminal-muted font-medium block mb-1">
                Leveraged
              </label>
              <select
                value={filters.isLeveraged}
                onChange={(e) => handleFilterChange('isLeveraged', e.target.value)}
                className="input text-xs py-1.5 px-2 w-full"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Inception Date */}
            <div className="mb-3">
              <label className="text-xs text-terminal-muted font-medium block mb-1">
                Inception After
              </label>
              <input
                type="date"
                value={filters.inceptionAfter}
                onChange={(e) => handleFilterChange('inceptionAfter', e.target.value)}
                className="input text-xs py-1.5 px-2 w-full"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs text-terminal-muted font-medium block mb-1">
                Inception Before
              </label>
              <input
                type="date"
                value={filters.inceptionBefore}
                onChange={(e) => handleFilterChange('inceptionBefore', e.target.value)}
                className="input text-xs py-1.5 px-2 w-full"
              />
            </div>

            {/* Performance */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider pt-2 mb-0.5">
              Performance
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              Portfolio activity and turnover rate
            </p>
            <RangeFilter
              label="Portfolio Turnover"
              minKey="portfolioTurnoverMin"
              maxKey="portfolioTurnoverMax"
              filters={filters}
              onChange={handleFilterChange}
            />

            {/* Buttons */}
            <div className="flex gap-2 pt-3">
              <button onClick={handleRunScreen} className="btn btn-primary text-sm flex-1">
                Run Screen
              </button>
              <button onClick={handleReset} className="btn btn-secondary text-sm flex-1">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Results Table ─────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="card p-0">
            {/* Results header */}
            <div className="px-4 py-3 border-b border-terminal-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-terminal-muted">
                  Showing{' '}
                  <span className="text-terminal-text font-medium">
                    {results.length}
                  </span>{' '}
                  {results.length === 1 ? 'ETF' : 'ETFs'}
                </span>
                {loading && (
                  <span className="text-xs text-terminal-accent animate-pulse">
                    Loading...
                  </span>
                )}
              </div>
              <p className="text-xs text-terminal-muted/70 mt-1">
                Data reflects ETF profiles from Alpha Vantage. Add ETFs in the{' '}
                <Link href="/etf" className="text-terminal-accent hover:underline">
                  ETF Watchlist
                </Link>{' '}
                to include them here.
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {columns.map((col) => {
                      const isActive = sortBy === col.sortKey;
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.sortKey)}
                          className={`cursor-pointer select-none transition-colors whitespace-nowrap group ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          } ${isActive ? 'bg-terminal-accent/10' : ''}`}
                        >
                          {col.label}
                          <span
                            className={`ml-1 inline-block transition-colors ${
                              isActive
                                ? 'text-terminal-accent'
                                : 'text-terminal-muted/30 group-hover:text-terminal-text'
                            }`}
                          >
                            {isActive
                              ? sortOrder === 'asc'
                                ? '▲'
                                : '▼'
                              : '↕'}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {!loading && results.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="text-center py-12 text-terminal-muted"
                      >
                        No ETFs match your criteria
                      </td>
                    </tr>
                  )}
                  {results.map((row) => (
                    <tr key={row.ticker}>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap ${
                            col.align === 'right' ? 'text-right' : ''
                          }`}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
