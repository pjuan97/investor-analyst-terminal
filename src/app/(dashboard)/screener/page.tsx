'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/language-provider';
import type { TranslationKey } from '@/lib/i18n/translations';

// ── Types ───────────────────────────────────────────────────
interface ScreenerResult {
  ticker: string;
  name: string;
  sector: string | null;
  exchange: string | null;
  fiscalYear: number;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  roic: number | null;
  roa: number | null;
  peRatio: number | null;
  evToEbitda: number | null;
  pbRatio: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  fcfGrowth: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  qualityScore: number | null;
  earningsYieldMF: number | null;
  returnOnCapitalMF: number | null;
  dataCompleteness: number | null;
  recommendation: string | null;
  confidence: number | null;
}

interface Filters {
  minGrossMargin: string;
  maxGrossMargin: string;
  minNetMargin: string;
  maxNetMargin: string;
  minROE: string;
  maxROE: string;
  minROIC: string;
  maxROIC: string;
  minRevenueGrowth: string;
  maxRevenueGrowth: string;
  minEpsGrowth: string;
  maxEpsGrowth: string;
  minPE: string;
  maxPE: string;
  minEVEBITDA: string;
  maxEVEBITDA: string;
  minDebtToEquity: string;
  maxDebtToEquity: string;
  minMarketCap: string;
  maxMarketCap: string;
  minQualityScore: string;
  maxQualityScore: string;
  sector: string;
  recommendation: string;
}

const emptyFilters: Filters = {
  minGrossMargin: '',
  maxGrossMargin: '',
  minNetMargin: '',
  maxNetMargin: '',
  minROE: '',
  maxROE: '',
  minROIC: '',
  maxROIC: '',
  minRevenueGrowth: '',
  maxRevenueGrowth: '',
  minEpsGrowth: '',
  maxEpsGrowth: '',
  minPE: '',
  maxPE: '',
  minEVEBITDA: '',
  maxEVEBITDA: '',
  minDebtToEquity: '',
  maxDebtToEquity: '',
  minMarketCap: '',
  maxMarketCap: '',
  minQualityScore: '',
  maxQualityScore: '',
  sector: '',
  recommendation: '',
};

// ── Formatters ──────────────────────────────────────────────
function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMultiple(v: number | null): string {
  if (v === null) return '—';
  return `${v.toFixed(1)}x`;
}

function fmtMarketCap(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function fmtScore(v: number | null): string {
  if (v === null) return '—';
  return (v * 100).toFixed(0);
}

function fmtRatio(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(2);
}

// ── Column defs ─────────────────────────────────────────────
interface Column {
  key: string;
  label: TranslationKey;
  sortKey: string;
  render: (r: ScreenerResult) => React.ReactNode;
  align?: 'left' | 'right';
}

const columns: Column[] = [
  {
    key: 'ticker',
    label: 'watchlist.col.ticker',
    sortKey: 'ticker',
    render: (r) => (
      <Link
        href={`/company/${r.ticker}`}
        className="text-terminal-accent hover:underline font-mono font-medium"
      >
        {r.ticker}
      </Link>
    ),
  },
  {
    key: 'name',
    label: 'screener.col.name',
    sortKey: 'name',
    render: (r) => (
      <span className="text-terminal-text truncate max-w-[180px] inline-block">
        {r.name}
      </span>
    ),
  },
  {
    key: 'sector',
    label: 'screener.col.sector',
    sortKey: 'sector',
    render: (r) => (
      <span className="text-terminal-muted text-xs truncate max-w-[140px] inline-block">
        {r.sector || '—'}
      </span>
    ),
  },
  {
    key: 'recommendation',
    label: 'screener.col.rec',
    sortKey: 'recommendation',
    render: (r) => {
      if (!r.recommendation) return <span className="text-terminal-muted">—</span>;
      const cls =
        r.recommendation === 'BUY'
          ? 'badge-buy'
          : r.recommendation === 'HOLD'
            ? 'badge-hold'
            : 'badge-sell';
      return <span className={`badge ${cls}`}>{r.recommendation}</span>;
    },
  },
  {
    key: 'grossMargin',
    label: 'screener.col.grossMargin',
    sortKey: 'gross_margin',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtPct(r.grossMargin)}</span>,
  },
  {
    key: 'netMargin',
    label: 'screener.col.netMargin',
    sortKey: 'net_margin',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtPct(r.netMargin)}</span>,
  },
  {
    key: 'roe',
    label: 'screener.col.roe',
    sortKey: 'roe',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtPct(r.roe)}</span>,
  },
  {
    key: 'peRatio',
    label: 'screener.col.pe',
    sortKey: 'pe_ratio',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtMultiple(r.peRatio)}</span>,
  },
  {
    key: 'revenueGrowth',
    label: 'screener.col.revGrowth',
    sortKey: 'revenue_growth',
    align: 'right',
    render: (r) => {
      if (r.revenueGrowth === null) return <span className="font-mono text-terminal-muted">—</span>;
      const color = r.revenueGrowth >= 0 ? 'text-positive' : 'text-negative';
      return <span className={`font-mono ${color}`}>{fmtPct(r.revenueGrowth)}</span>;
    },
  },
  {
    key: 'debtToEquity',
    label: 'screener.col.debtEquity',
    sortKey: 'debt_to_equity',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtRatio(r.debtToEquity)}</span>,
  },
  {
    key: 'marketCap',
    label: 'screener.col.marketCap',
    sortKey: 'market_cap',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtMarketCap(r.marketCap)}</span>,
  },
  {
    key: 'qualityScore',
    label: 'screener.col.quality',
    sortKey: 'quality_score',
    align: 'right',
    render: (r) => <span className="font-mono">{fmtScore(r.qualityScore)}</span>,
  },
];

// ── Filter Input Component ──────────────────────────────────
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
  const { t } = useTranslation();

  return (
    <div className="mb-3">
      <label className="text-xs text-terminal-muted font-medium block mb-1">
        {label} <span className="text-terminal-muted/60">({suffix})</span>
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder={t('screener.min')}
          value={filters[minKey]}
          onChange={(e) => onChange(minKey, e.target.value)}
          className="input text-xs py-1.5 px-2 w-full"
        />
        <input
          type="number"
          placeholder={t('screener.max')}
          value={filters[maxKey]}
          onChange={(e) => onChange(maxKey, e.target.value)}
          className="input text-xs py-1.5 px-2 w-full"
        />
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function ScreenerPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('market_cap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load sectors on mount
  useEffect(() => {
    fetch('/api/screener?sectors=true')
      .then((r) => r.json())
      .then((d) => setSectors(d.sectors || []))
      .catch(() => {});
  }, []);

  const fetchResults = useCallback(
    async (f: Filters, sort: string, order: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(f)) {
          if (val !== '') params.set(key, val);
        }
        params.set('sortBy', sort);
        params.set('sortOrder', order);

        const res = await fetch(`/api/screener?${params.toString()}`);
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

  // Load all companies on mount
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
    setSortBy('market_cap');
    setSortOrder('desc');
    fetchResults(emptyFilters, 'market_cap', 'desc');
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
        <h1 className="text-2xl font-bold text-terminal-text">{t('screener.title')}</h1>
        <p className="text-sm text-terminal-muted mt-1">
          {t('screener.subtitle')}
        </p>
      </div>

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* ── Left: Filters Panel ──────────────────────────── */}
        <div className="w-72 flex-shrink-0">
          <div className="card space-y-1">
            {/* Profitability */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider mb-0.5">
              {t('screener.section.profitability')}
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              {t('screener.section.profitabilityDesc')}
            </p>
            <RangeFilter
              label={t('screener.filter.grossMargin')}
              minKey="minGrossMargin"
              maxKey="maxGrossMargin"
              filters={filters}
              onChange={handleFilterChange}
            />
            <RangeFilter
              label={t('screener.filter.netMargin')}
              minKey="minNetMargin"
              maxKey="maxNetMargin"
              filters={filters}
              onChange={handleFilterChange}
            />

            {/* Returns */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider pt-2 mb-0.5">
              {t('screener.section.returns')}
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              {t('screener.section.returnsDesc')}
            </p>
            <RangeFilter
              label="ROE"
              minKey="minROE"
              maxKey="maxROE"
              filters={filters}
              onChange={handleFilterChange}
            />
            <RangeFilter
              label="ROIC"
              minKey="minROIC"
              maxKey="maxROIC"
              filters={filters}
              onChange={handleFilterChange}
            />

            {/* Growth */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider pt-2 mb-0.5">
              {t('screener.section.growth')}
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              {t('screener.section.growthDesc')}
            </p>
            <RangeFilter
              label={t('screener.filter.revenueGrowth')}
              minKey="minRevenueGrowth"
              maxKey="maxRevenueGrowth"
              filters={filters}
              onChange={handleFilterChange}
            />
            <RangeFilter
              label={t('screener.filter.epsGrowth')}
              minKey="minEpsGrowth"
              maxKey="maxEpsGrowth"
              filters={filters}
              onChange={handleFilterChange}
            />

            {/* Valuation */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider pt-2 mb-0.5">
              {t('screener.section.valuation')}
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              {t('screener.section.valuationDesc')}
            </p>
            <RangeFilter
              label={t('screener.filter.peRatio')}
              minKey="minPE"
              maxKey="maxPE"
              filters={filters}
              onChange={handleFilterChange}
              suffix="x"
            />
            <RangeFilter
              label={t('screener.filter.evEbitda')}
              minKey="minEVEBITDA"
              maxKey="maxEVEBITDA"
              filters={filters}
              onChange={handleFilterChange}
              suffix="x"
            />

            {/* Other */}
            <h3 className="text-xs font-semibold text-terminal-accent uppercase tracking-wider pt-2 mb-0.5">
              Other
            </h3>
            <p className="text-xs text-terminal-muted mb-2">
              Size, leverage, and overall data quality score
            </p>
            <RangeFilter
              label={t('screener.filter.marketCap')}
              minKey="minMarketCap"
              maxKey="maxMarketCap"
              filters={filters}
              onChange={handleFilterChange}
              suffix="$B"
            />
            <RangeFilter
              label={t('screener.filter.qualityScore')}
              minKey="minQualityScore"
              maxKey="maxQualityScore"
              filters={filters}
              onChange={handleFilterChange}
              suffix="0-1"
            />
            <RangeFilter
              label={t('screener.filter.debtEquity')}
              minKey="minDebtToEquity"
              maxKey="maxDebtToEquity"
              filters={filters}
              onChange={handleFilterChange}
              suffix="ratio"
            />

            {/* Sector dropdown */}
            <div className="mb-3">
              <label className="text-xs text-terminal-muted font-medium block mb-1">
                Sector
              </label>
              <select
                value={filters.sector}
                onChange={(e) => handleFilterChange('sector', e.target.value)}
                className="input text-xs py-1.5 px-2 w-full"
              >
                <option value="">{t('screener.allSectors')}</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Recommendation */}
            <div className="mb-3">
              <label className="text-xs text-terminal-muted font-medium block mb-1">
                Recommendation
              </label>
              <select
                value={filters.recommendation}
                onChange={(e) =>
                  handleFilterChange('recommendation', e.target.value)
                }
                className="input text-xs py-1.5 px-2 w-full"
              >
                <option value="">All</option>
                <option value="BUY">BUY</option>
                <option value="HOLD">HOLD</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

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
                  {t(results.length === 1 ? 'screener.showingOne' : 'screener.showing', {
                    n: results.length,
                  })}
                </span>
                {loading && (
                  <span className="text-xs text-terminal-accent animate-pulse">
                    {t('common.loading')}
                  </span>
                )}
              </div>
              <p className="text-xs text-terminal-muted/70 mt-1">
                {t('screener.dataNote')}
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
                          {t(col.label)}
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
                        No companies match your criteria
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
