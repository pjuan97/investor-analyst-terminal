'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useTranslation } from '@/components/language-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

interface EtfData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface Mover {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

type MoverTab = 'gainers' | 'losers';
type EtfTab = 'sectors' | 'regions' | 'assets' | 'factors';

interface MarketData {
  indices: IndexData[];
  etfs: Record<string, EtfData[]>;
  news: NewsItem[];
  topMovers: { gainers: Mover[]; losers: Mover[] } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Translate = ReturnType<typeof useTranslation>['t'];

function timeAgo(dateStr: string, t: Translate): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.hoursAgo', { n: hrs });
  const days = Math.floor(hrs / 24);
  return t('time.daysAgo', { n: days });
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [moverTab, setMoverTab] = useState<MoverTab>('gainers');
  const [etfTab, setEtfTab] = useState<EtfTab>('sectors');

  const fetchMarketData = useCallback(() => {
    fetch('/api/market', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.goodMorning');
    if (h < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  })();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-terminal-text">{greeting}</h2>
          <p className="text-sm text-terminal-muted mt-1">{today}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse h-36" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card animate-pulse h-64" />
          <div className="card animate-pulse h-64" />
        </div>
      </div>
    );
  }

  const { indices = [], etfs = {}, news = [], topMovers } = data || {};
  const currentMovers = moverTab === 'gainers' ? topMovers?.gainers : topMovers?.losers;
  const currentEtfs = etfs[etfTab] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-terminal-text">{greeting}</h2>
          <p className="text-sm text-terminal-muted mt-1">{today}</p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-terminal-muted">
            {t('dashboard.lastUpdated')}{' '}
            {lastUpdated.toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* Market Indices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((idx) => (
          <IndexCard key={idx.symbol} data={idx} />
        ))}
        {indices.length === 0 && (
          <div className="col-span-4 card text-center py-8 text-terminal-muted">
            {t('dashboard.noMarketData')}
          </div>
        )}
      </div>

      {/* News + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* News (2/3) */}
        <div className="lg:col-span-2 card max-h-[700px] overflow-y-auto">
          <h3 className="card-header">{t('dashboard.marketNews')}</h3>
          {news.length > 0 ? (
            <div className="divide-y divide-terminal-border">
              {news.map((item, i) => (
                <NewsRow key={i} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-terminal-muted text-sm py-4">{t('dashboard.noNews')}</p>
          )}
        </div>

        {/* Right Panel (1/3) — Movers + ETFs */}
        <div className="card flex flex-col max-h-[700px]">
          {/* Movers Section */}
          {topMovers ? (
            <div className="flex-1 min-h-0 flex flex-col mb-4">
              <div className="flex gap-4 border-b border-terminal-border mb-3">
                {(['gainers', 'losers'] as MoverTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setMoverTab(tab)}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                      moverTab === tab
                        ? 'border-terminal-accent text-terminal-accent'
                        : 'border-transparent text-terminal-muted hover:text-terminal-text'
                    }`}
                  >
                    {tab === 'gainers' ? t('dashboard.gainers') : t('dashboard.losers')}
                  </button>
                ))}
              </div>

              {currentMovers && currentMovers.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-terminal-muted uppercase">
                      <th className="text-left pb-1 font-medium">{t('dashboard.col.ticker')}</th>
                      <th className="text-right pb-1 font-medium">{t('dashboard.col.last')}</th>
                      <th className="text-right pb-1 font-medium">{t('dashboard.col.change')}</th>
                      <th className="text-right pb-1 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMovers.map((m) => {
                      const isPos = m.changePercent >= 0;
                      const color = isPos ? 'text-positive' : 'text-negative';
                      return (
                        <tr key={m.ticker} className="border-t border-terminal-border/50">
                          <td className="py-1.5">
                            <Link
                              href={`/company/${m.ticker}`}
                              className="text-terminal-accent hover:underline font-medium"
                            >
                              {m.ticker}
                            </Link>
                            <div className="text-xs text-terminal-muted truncate max-w-[100px]">
                              {m.name}
                            </div>
                          </td>
                          <td className="text-right font-mono text-terminal-text py-1.5">
                            ${formatPrice(m.price)}
                          </td>
                          <td className={`text-right font-mono py-1.5 ${color}`}>
                            {isPos ? '+' : ''}${formatPrice(Math.abs(m.change))}
                          </td>
                          <td className={`text-right font-mono py-1.5 ${color}`}>
                            {isPos ? '+' : ''}
                            {m.changePercent.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-terminal-muted text-sm py-2">
                  No {moverTab} today
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 mb-4 text-center py-4 text-terminal-muted text-sm">
              Add companies to your watchlist to see movers.
            </div>
          )}

          {/* ETFs Section */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex gap-3 border-b border-terminal-border mb-3">
              {(['sectors', 'regions', 'assets', 'factors'] as EtfTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEtfTab(tab)}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 capitalize ${
                    etfTab === tab
                      ? 'border-terminal-accent text-terminal-accent'
                      : 'border-transparent text-terminal-muted hover:text-terminal-text'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {currentEtfs.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-terminal-card">
                    <tr className="text-xs text-terminal-muted uppercase">
                      <th className="text-left pb-1 font-medium">Name</th>
                      <th className="text-right pb-1 font-medium">Price</th>
                      <th className="text-right pb-1 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentEtfs]
                      .sort((a, b) => b.changePercent - a.changePercent)
                      .map((etf) => {
                        const isPos = etf.changePercent >= 0;
                        const color = isPos ? 'text-positive' : 'text-negative';
                        return (
                          <tr
                            key={etf.symbol}
                            className="border-t border-terminal-border/50"
                          >
                            <td className="py-1.5">
                              <span className="text-terminal-text">{etf.name}</span>
                              <span className="text-terminal-muted text-xs ml-1.5">
                                {etf.symbol}
                              </span>
                            </td>
                            <td className="text-right font-mono text-terminal-text py-1.5">
                              ${formatPrice(etf.price)}
                            </td>
                            <td className={`text-right font-mono py-1.5 ${color}`}>
                              {isPos ? '+' : ''}
                              {etf.changePercent.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              ) : (
                <p className="text-terminal-muted text-sm py-2">Loading...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IndexCard({ data }: { data: IndexData }) {
  const isPositive = data.change >= 0;
  const color = isPositive ? 'text-positive' : 'text-negative';
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';
  const arrow = isPositive ? '\u25B2' : '\u25BC';

  const sparkData = data.sparkline.map((v, i) => ({ i, v }));

  return (
    <div className="card">
      <div className="text-xs text-terminal-muted uppercase tracking-wide">{data.name}</div>
      <div className="text-xl font-bold text-terminal-text font-mono mt-1">
        {formatPrice(data.price)}
      </div>
      <div className={`text-sm font-mono mt-1 ${color}`}>
        {arrow} {isPositive ? '+' : ''}
        {formatPrice(data.change)} ({isPositive ? '+' : ''}
        {data.changePercent.toFixed(2)}%)
      </div>
      {sparkData.length > 1 && (
        <div className="h-[60px] mt-2 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${data.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill={`url(#spark-${data.symbol})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const { t } = useTranslation();

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-terminal-text hover:text-terminal-accent transition-colors leading-snug block"
      >
        {item.title}
      </a>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-terminal-muted">{item.source}</span>
        <span className="text-xs text-terminal-muted">{timeAgo(item.pubDate, t)}</span>
      </div>
    </div>
  );
}
