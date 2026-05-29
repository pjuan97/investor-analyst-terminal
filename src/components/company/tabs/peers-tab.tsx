'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PeerData {
  ticker: string;
  name: string;
  isCurrent: boolean;
  grossMargin: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
  roe: number | null;
  roic: number | null;
  peRatio: number | null;
  evToEbitda: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  marketCap: number | null;
  debtToEquity: number | null;
  qualityScore: number | null;
  recommendation: string | null;
  confidence: number | null;
}

interface MetricDef {
  key: keyof PeerData;
  label: string;
  format: (v: number | null) => string;
  higherIsBetter: boolean;
}

const metricGroups: { label: string; metrics: MetricDef[] }[] = [
  {
    label: 'PROFITABILITY',
    metrics: [
      {
        key: 'grossMargin',
        label: 'Gross Margin',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
      {
        key: 'netMargin',
        label: 'Net Margin',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
      {
        key: 'fcfMargin',
        label: 'FCF Margin',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
    ],
  },
  {
    label: 'RETURNS',
    metrics: [
      {
        key: 'roe',
        label: 'ROE',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
      {
        key: 'roic',
        label: 'ROIC',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
    ],
  },
  {
    label: 'VALUATION',
    metrics: [
      {
        key: 'peRatio',
        label: 'P/E Ratio',
        format: (v) => (v !== null ? v.toFixed(1) : '—'),
        higherIsBetter: false,
      },
      {
        key: 'evToEbitda',
        label: 'EV/EBITDA',
        format: (v) => (v !== null ? v.toFixed(1) : '—'),
        higherIsBetter: false,
      },
    ],
  },
  {
    label: 'GROWTH',
    metrics: [
      {
        key: 'revenueGrowth',
        label: 'Revenue Growth',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
      {
        key: 'epsGrowth',
        label: 'EPS Growth',
        format: (v) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—'),
        higherIsBetter: true,
      },
    ],
  },
  {
    label: 'OTHER',
    metrics: [
      {
        key: 'marketCap',
        label: 'Market Cap',
        format: (v) => {
          if (v === null) return '—';
          if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
          if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
          if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
          return `$${v.toLocaleString()}`;
        },
        higherIsBetter: true,
      },
      {
        key: 'debtToEquity',
        label: 'Debt/Equity',
        format: (v) => (v !== null ? v.toFixed(2) : '—'),
        higherIsBetter: false,
      },
      {
        key: 'qualityScore',
        label: 'Quality Score',
        format: (v) => (v !== null ? `${(v * 100).toFixed(0)}%` : '—'),
        higherIsBetter: true,
      },
      {
        key: 'recommendation',
        label: 'Recommendation',
        format: () => '',
        higherIsBetter: true,
      },
    ],
  },
];

function getBestValue(
  peers: PeerData[],
  key: keyof PeerData,
  higherIsBetter: boolean
): number | null {
  const values = peers
    .map((p) => p[key])
    .filter((v): v is number => typeof v === 'number' && v !== null);
  if (values.length === 0) return null;
  return higherIsBetter ? Math.max(...values) : Math.min(...values);
}

export function PeersTab({ ticker }: { ticker: string }) {
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [sector, setSector] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/company/${ticker}/peers`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPeers(data.peers);
          setSector(data.sector);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="text-center py-8 text-terminal-muted">
        Loading peer comparison...
      </div>
    );
  }

  if (!sector) {
    return (
      <div className="card text-center py-8">
        <p className="text-terminal-muted">
          No sector assigned to this company. Peer comparison requires sector data.
        </p>
      </div>
    );
  }

  if (peers.filter((p) => !p.isCurrent).length < 1) {
    return (
      <div className="card text-center py-8">
        <p className="text-terminal-muted">
          Add more companies from the{' '}
          <span className="text-terminal-text font-medium">{sector}</span>{' '}
          sector to your watchlist to enable peer comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-terminal-text">
          Peer Comparison — {sector}
        </h3>
        <p className="text-xs text-terminal-muted mt-1">
          Companies in your database with the same sector
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-terminal-border">
              <th className="text-left py-2 px-3 text-terminal-muted font-medium text-xs">
                Metric
              </th>
              {peers.map((p) => (
                <th
                  key={p.ticker}
                  className={`text-center py-2 px-3 text-xs font-medium ${
                    p.isCurrent
                      ? 'text-terminal-accent bg-terminal-accent/10'
                      : 'text-terminal-text'
                  }`}
                >
                  <Link
                    href={`/company/${p.ticker}`}
                    className="hover:underline"
                  >
                    {p.ticker}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricGroups.map((group) => (
              <>
                {/* Group header */}
                <tr key={`group-${group.label}`}>
                  <td
                    colSpan={peers.length + 1}
                    className="pt-4 pb-1 px-3 text-xs font-semibold text-terminal-muted uppercase tracking-wider"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.metrics.map((metric) => {
                  const bestVal = getBestValue(
                    peers,
                    metric.key,
                    metric.higherIsBetter
                  );

                  return (
                    <tr
                      key={metric.key}
                      className="border-t border-terminal-border/50"
                    >
                      <td className="py-2 px-3 text-terminal-muted text-xs">
                        {metric.label}
                      </td>
                      {peers.map((p) => {
                        const val = p[metric.key];

                        // Special case for recommendation
                        if (metric.key === 'recommendation') {
                          const rec = p.recommendation;
                          const conf = p.confidence;
                          return (
                            <td
                              key={p.ticker}
                              className={`text-center py-2 px-3 font-mono text-xs ${
                                p.isCurrent ? 'bg-terminal-accent/5' : ''
                              }`}
                            >
                              {rec ? (
                                <span
                                  className={
                                    rec === 'BUY'
                                      ? 'text-positive'
                                      : rec === 'SELL'
                                        ? 'text-negative'
                                        : 'text-warn'
                                  }
                                >
                                  {rec}
                                  {conf !== null
                                    ? ` ${(conf * 100).toFixed(0)}%`
                                    : ''}
                                </span>
                              ) : (
                                <span className="text-terminal-muted">—</span>
                              )}
                            </td>
                          );
                        }

                        const numVal = typeof val === 'number' ? val : null;
                        const isBest =
                          numVal !== null && bestVal !== null && numVal === bestVal;

                        return (
                          <td
                            key={p.ticker}
                            className={`text-center py-2 px-3 font-mono text-xs ${
                              p.isCurrent ? 'bg-terminal-accent/5' : ''
                            } ${isBest ? 'text-positive font-medium' : 'text-terminal-text'}`}
                          >
                            {metric.format(numVal)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
