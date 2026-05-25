'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
  const [etfs, setEtfs] = useState<EtfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-terminal-text">ETF Watchlist</h1>
          <p className="text-sm text-terminal-muted mt-1">
            Track and analyze Exchange-Traded Funds
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. VOO"
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

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-terminal-muted">Loading ETFs...</div>
        ) : etfs.length === 0 ? (
          <div className="text-center py-8 text-terminal-muted">
            <p>No ETFs added yet.</p>
            <p className="text-sm mt-2">Add an ETF ticker above to get started (e.g. VOO, QQQ, SPY).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Change %</th>
                  <th className="text-right">AUM</th>
                  <th className="text-right">Expense Ratio</th>
                  <th className="text-right">Div Yield</th>
                </tr>
              </thead>
              <tbody>
                {etfs.map((etf) => {
                  const isPos = (etf.changePercent ?? 0) >= 0;
                  return (
                    <tr key={etf.id}>
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
