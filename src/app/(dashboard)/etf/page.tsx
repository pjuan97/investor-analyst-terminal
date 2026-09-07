'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/language-provider';

interface EtfRow {
  id: string;
  ticker: string;
  name: string;
  exchange: string | null;
  price: number | null;
  changePercent: number | null;
  netAssets: number | null;
  expenseRatio: number | null;
  dividendYield: number | null;
  lastRefreshedAt: string | null;
  createdAt: string;
}

function formatAum(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return (value * 100).toFixed(2) + '%';
}

export default function EtfPage() {
  const { t } = useTranslation();
  const [etfs, setEtfs] = useState<EtfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [selectedEtfs, setSelectedEtfs] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });

  const fetchEtfs = useCallback(async () => {
    try {
      const res = await fetch('/api/etf');
      const data = await res.json();
      if (data.success) {
        setEtfs(data.etfs);
      }
    } catch {
      console.error('Failed to fetch ETFs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEtfs();
  }, [fetchEtfs]);

  const handleRemove = async (etfTicker: string) => {
    if (!confirm(`Remove ${etfTicker} from ETF Watchlist?`)) return;

    // Optimistic update
    setEtfs((prev) => prev.filter((e) => e.ticker !== etfTicker));
    setSelectedEtfs((prev) => {
      const next = new Set(prev);
      next.delete(etfTicker);
      return next;
    });

    try {
      const res = await fetch(`/api/etf/${etfTicker}`, { method: 'DELETE' });
      if (!res.ok) {
        await fetchEtfs(); // Revert on failure
      }
    } catch {
      await fetchEtfs(); // Revert on failure
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setAdding(true);
    setError('');

    try {
      const res = await fetch(`/api/etf/${ticker.toUpperCase()}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add ETF');
        return;
      }

      setTicker('');
      await fetchEtfs();
    } catch {
      setError('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedEtfs.size === etfs.length) {
      setSelectedEtfs(new Set());
    } else {
      setSelectedEtfs(new Set(etfs.map((e) => e.ticker)));
    }
  };

  const handleRefreshSelected = async () => {
    const tickers = Array.from(selectedEtfs);
    if (tickers.length === 0) return;

    setRefreshing(true);
    setRefreshProgress({ current: 0, total: tickers.length });

    for (let i = 0; i < tickers.length; i++) {
      setRefreshProgress({ current: i + 1, total: tickers.length });
      try {
        await fetch(`/api/etf/${tickers[i]}/refresh`, { method: 'POST' });
      } catch {
        console.error(`Failed to refresh ${tickers[i]}`);
      }
    }

    setRefreshing(false);
    setSelectedEtfs(new Set());
    setRefreshProgress({ current: 0, total: 0 });
    await new Promise(resolve => setTimeout(resolve, 800));
    await fetchEtfs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-terminal-text">{t('etf.watchlist')}</h1>
          <p className="text-sm text-terminal-muted mt-1">
            {t('etf.subtitle')}
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder={t('etf.tickerPlaceholder')}
              className="input w-32 uppercase"
              maxLength={10}
              disabled={adding}
            />
            {error && (
              <div className="absolute top-full left-0 mt-1 text-xs text-danger-semantic whitespace-nowrap">
                {error}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={adding || !ticker.trim()}
            className="btn btn-primary"
          >
            {adding ? 'Adding...' : 'Add ETF'}
          </button>
        </form>
      </div>

      {/* Toolbar */}
      {etfs.length > 0 && selectedEtfs.size > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-terminal-muted">
            {selectedEtfs.size} selected
          </div>
          <button
            onClick={handleRefreshSelected}
            disabled={refreshing}
            className="px-4 py-2 bg-terminal-accent text-terminal-bg rounded font-medium hover:bg-terminal-accent/90 transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
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
            {refreshing
              ? `Refreshing ${refreshProgress.current}/${refreshProgress.total}...`
              : `Refresh Selected (${selectedEtfs.size})`}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-terminal-muted">{t('etf.loading')}</div>
        ) : etfs.length === 0 ? (
          <div className="text-center py-8 text-terminal-muted">
            <p>{t('etf.noneAdded')}</p>
            <p className="text-sm mt-2">Add an ETF ticker above to get started (e.g. VOO, QQQ, SPY).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={etfs.length > 0 && selectedEtfs.size === etfs.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-terminal-border bg-terminal-bg text-terminal-accent focus:ring-terminal-accent focus:ring-offset-0"
                    />
                  </th>
                  <th>{t('etf.col.ticker')}</th>
                  <th>{t('etf.col.name')}</th>
                  <th className="text-right">{t('etf.col.price')}</th>
                  <th className="text-right">{t('etf.col.changePct')}</th>
                  <th className="text-right">AUM</th>
                  <th className="text-right">{t('etf.col.expenseRatio')}</th>
                  <th className="text-right">{t('etf.col.divYield')}</th>
                  <th>{t('etf.col.lastRefresh')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {etfs.map((etf) => {
                  const isPos = (etf.changePercent ?? 0) >= 0;
                  return (
                    <tr key={etf.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedEtfs.has(etf.ticker)}
                          onChange={(e) => {
                            const next = new Set(selectedEtfs);
                            if (e.target.checked) next.add(etf.ticker);
                            else next.delete(etf.ticker);
                            setSelectedEtfs(next);
                          }}
                          className="w-4 h-4 rounded border-terminal-border bg-terminal-bg text-terminal-accent focus:ring-terminal-accent focus:ring-offset-0"
                        />
                      </td>
                      <td>
                        <Link
                          href={`/etf/${etf.ticker}`}
                          className="text-terminal-accent hover:underline font-medium"
                        >
                          {etf.ticker}
                        </Link>
                      </td>
                      <td className="text-terminal-text max-w-[200px] truncate">
                        {etf.name}
                      </td>
                      <td className="text-right font-mono text-terminal-text">
                        {etf.price !== null ? `$${etf.price.toFixed(2)}` : '—'}
                      </td>
                      <td className={`text-right font-mono ${isPos ? 'text-positive' : 'text-negative'}`}>
                        {etf.changePercent !== null
                          ? `${isPos ? '+' : ''}${etf.changePercent.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="text-right font-mono text-terminal-text">
                        {formatAum(etf.netAssets)}
                      </td>
                      <td className="text-right font-mono text-terminal-text">
                        {formatPct(etf.expenseRatio)}
                      </td>
                      <td className="text-right font-mono text-terminal-text">
                        {formatPct(etf.dividendYield)}
                      </td>
                      <td className="text-sm text-terminal-muted">
                        {etf.lastRefreshedAt
                          ? new Date(etf.lastRefreshedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        <button
                          onClick={() => handleRemove(etf.ticker)}
                          className="text-terminal-muted hover:text-danger-semantic transition-colors"
                          title="Remove from ETF Watchlist"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
