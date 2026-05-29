'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Range = '1w' | '2w' | '1m';
type Filter = 'all' | 'watchlist';

interface EarningsRow {
  symbol: string;
  companyName: string;
  date: string;
  dayOfWeek: string;
  epsEstimated: number | null;
  epsActual: number | null;
  surprise: number | null;
  revenueEstimated: number | null;
  revenueActual: number | null;
  isInWatchlist: boolean;
}

function formatRevenue(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatEps(value: number | null): string {
  if (value === null) return '—';
  return `$${value.toFixed(2)}`;
}

function formatDate(dateStr: string, dayOfWeek: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day} \u00B7 ${dayOfWeek}`;
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('1m');
  const [filter, setFilter] = useState<Filter>('all');

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/earnings-calendar?range=${range}`);
      const data = await res.json();
      if (data.success) {
        setEarnings(data.earnings);
      }
    } catch {
      console.error('Failed to fetch earnings');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const filtered =
    filter === 'watchlist'
      ? earnings.filter((e) => e.isInWatchlist)
      : earnings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-terminal-text">
            Earnings Calendar
          </h1>
          <p className="text-sm text-terminal-muted mt-1">
            Upcoming and recent earnings reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div className="flex rounded-md border border-terminal-border overflow-hidden">
            {(['all', 'watchlist'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-terminal-accent text-terminal-bg'
                    : 'bg-terminal-card text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {f === 'all' ? 'All' : 'Watchlist Only'}
              </button>
            ))}
          </div>

          {/* Range selector */}
          <div className="flex rounded-md border border-terminal-border overflow-hidden">
            {(['1w', '2w', '1m'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r
                    ? 'bg-terminal-accent text-terminal-bg'
                    : 'bg-terminal-card text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-terminal-muted">
            Loading earnings calendar...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-terminal-muted">
            <p>No earnings found for this period.</p>
            {filter === 'watchlist' && (
              <p className="text-sm mt-2">
                Try switching to &quot;All&quot; to see all known companies.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Company</th>
                  <th className="text-right">EPS Est</th>
                  <th className="text-right">EPS Actual</th>
                  <th className="text-right">Surprise</th>
                  <th className="text-right">Rev Est</th>
                  <th className="text-right">Rev Actual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const reported = e.epsActual !== null;
                  const beat =
                    reported &&
                    e.epsEstimated !== null &&
                    e.epsActual! > e.epsEstimated;
                  const miss =
                    reported &&
                    e.epsEstimated !== null &&
                    e.epsActual! < e.epsEstimated;
                  const revBeat =
                    e.revenueActual !== null &&
                    e.revenueEstimated !== null &&
                    e.revenueActual > e.revenueEstimated;
                  const revMiss =
                    e.revenueActual !== null &&
                    e.revenueEstimated !== null &&
                    e.revenueActual < e.revenueEstimated;

                  return (
                    <tr
                      key={`${e.symbol}-${e.date}-${i}`}
                      className={
                        e.isInWatchlist
                          ? 'bg-terminal-accent/5'
                          : ''
                      }
                    >
                      <td className="text-terminal-muted text-sm whitespace-nowrap">
                        {formatDate(e.date, e.dayOfWeek)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {e.isInWatchlist ? (
                            <>
                              <span
                                className="text-terminal-accent text-xs"
                                title="In your watchlist"
                              >
                                ★
                              </span>
                              <Link
                                href={`/company/${e.symbol}`}
                                className="text-terminal-accent hover:underline font-medium"
                              >
                                {e.symbol}
                              </Link>
                            </>
                          ) : (
                            <>
                              <span className="text-terminal-text font-medium">
                                {e.symbol}
                              </span>
                              <span
                                className="text-terminal-muted text-xs cursor-help"
                                title={`Add ${e.symbol} to your Watchlist to view full analysis`}
                              >
                                +
                              </span>
                            </>
                          )}
                          <span className="text-terminal-muted text-sm truncate max-w-[180px]">
                            {e.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-mono text-sm text-terminal-text">
                        {formatEps(e.epsEstimated)}
                      </td>
                      <td
                        className={`text-right font-mono text-sm ${
                          beat
                            ? 'text-positive'
                            : miss
                              ? 'text-negative'
                              : 'text-terminal-text'
                        }`}
                      >
                        {formatEps(e.epsActual)}
                      </td>
                      <td
                        className={`text-right font-mono text-sm ${
                          e.surprise !== null && e.surprise > 0
                            ? 'text-positive'
                            : e.surprise !== null && e.surprise < 0
                              ? 'text-negative'
                              : 'text-terminal-muted'
                        }`}
                      >
                        {e.surprise !== null
                          ? `${e.surprise > 0 ? '+' : ''}${e.surprise.toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="text-right font-mono text-sm text-terminal-text">
                        {formatRevenue(e.revenueEstimated)}
                      </td>
                      <td
                        className={`text-right font-mono text-sm ${
                          revBeat
                            ? 'text-positive'
                            : revMiss
                              ? 'text-negative'
                              : 'text-terminal-text'
                        }`}
                      >
                        {formatRevenue(e.revenueActual)}
                      </td>
                      <td>
                        {reported ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              beat
                                ? 'bg-green-900/30 text-positive'
                                : miss
                                  ? 'bg-red-900/30 text-negative'
                                  : 'bg-gray-800 text-terminal-muted'
                            }`}
                          >
                            {beat ? 'Beat' : miss ? 'Missed' : 'Reported'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400">
                            Upcoming
                          </span>
                        )}
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
