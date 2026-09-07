'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BatchRefreshModal } from './batch-refresh-modal';
import { useTranslation } from '@/components/language-provider';

type Market = 'BVC' | 'WALL_STREET';

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  price: number | null;
  priceDate: Date | null;
  recommendation: 'BUY' | 'HOLD' | 'SELL' | null;
  confidence: number | null;
  lastUpdate: Date | null;
  lastRefreshedAt: Date | null;
  dataQuality: number | null;
  currency: string;
  market: Market;
}

interface WatchlistTableProps {
  data: WatchlistItem[];
}

type SortKey = 'ticker' | 'name' | 'price' | 'confidence' | 'lastUpdate';
type SortDir = 'asc' | 'desc';
type MarketFilter = 'ALL' | Market;

function getSortValue(item: WatchlistItem, key: SortKey): number | string | null {
  switch (key) {
    case 'ticker':
      return item.ticker;
    case 'name':
      return item.name;
    case 'price':
      return item.price;
    case 'confidence':
      return item.confidence;
    case 'lastUpdate':
      return item.lastUpdate ? new Date(item.lastUpdate).getTime() : null;
  }
}

export function WatchlistTable({ data }: WatchlistTableProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filteredData = useMemo(
    () => (marketFilter === 'ALL' ? data : data.filter((item) => item.market === marketFilter)),
    [data, marketFilter]
  );

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1; // nulls always last
      if (bVal === null) return -1;
      const cmp =
        typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredData, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-terminal-accent">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleRemove = async (id: string) => {
    if (!confirm(t('watchlist.removeConfirm'))) return;

    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleSelectAll = () => {
    if (selectedTickers.size === sortedData.length) {
      setSelectedTickers(new Set());
    } else {
      setSelectedTickers(new Set(sortedData.map((item) => item.ticker)));
    }
  };

  const handleSelectTicker = (ticker: string) => {
    const newSelected = new Set(selectedTickers);
    if (newSelected.has(ticker)) {
      newSelected.delete(ticker);
    } else {
      newSelected.add(ticker);
    }
    setSelectedTickers(newSelected);
  };

  const handleBatchRefresh = () => {
    if (selectedTickers.size > 0) {
      setShowBatchModal(true);
    }
  };

  const handleBatchComplete = () => {
    setSelectedTickers(new Set());
    router.refresh();
  };

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(price);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatConfidence = (confidence: number | null) => {
    if (confidence === null) return '—';
    return `${(confidence * 100).toFixed(0)}%`;
  };

  const getRatingBadge = (rating: 'BUY' | 'HOLD' | 'SELL' | null) => {
    if (!rating) {
      return <span className="badge bg-gray-800 text-gray-400">{t('badge.noData')}</span>;
    }

    const classes = {
      BUY: 'badge-buy',
      HOLD: 'badge-hold',
      SELL: 'badge-sell',
    };

    return <span className={`badge ${classes[rating]}`}>{rating}</span>;
  };

  const getQualityBadge = (quality: number | null) => {
    if (quality === null) {
      return (
        <span className="badge bg-gray-800 text-gray-400" title={t('badge.qualityUnknownTitle')}>
          ?
        </span>
      );
    }

    if (quality >= 0.8) {
      return (
        <span className="badge badge-quality-high" title={t('badge.qualityHighTitle')}>
          {t('badge.qualityHigh')}
        </span>
      );
    } else if (quality >= 0.5) {
      return (
        <span className="badge badge-quality-medium" title={t('badge.qualityMediumTitle')}>
          {t('badge.qualityMedium')}
        </span>
      );
    } else {
      return (
        <span className="badge badge-quality-low" title={t('badge.qualityLowTitle')}>
          {t('badge.qualityLow')}
        </span>
      );
    }
  };

  const getMarketBadge = (market: Market) => {
    if (market === 'BVC') {
      return (
        <span className="badge badge-market-bvc" title={t('watchlist.marketBvcTitle')}>
          {t('watchlist.filter.bvc')}
        </span>
      );
    }
    return (
      <span className="badge badge-market-us" title={t('watchlist.marketUsTitle')}>
        {t('watchlist.filter.wallStreet')}
      </span>
    );
  };

  return (
    <>
      {/* Toolbar */}
      {data.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex rounded-md border border-terminal-border overflow-hidden">
              {(
                [
                  { id: 'ALL', labelKey: 'watchlist.filter.all' },
                  { id: 'WALL_STREET', labelKey: 'watchlist.filter.wallStreet' },
                  { id: 'BVC', labelKey: 'watchlist.filter.bvc' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMarketFilter(opt.id)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    marketFilter === opt.id
                      ? 'bg-terminal-accent text-terminal-bg'
                      : 'bg-terminal-card text-terminal-muted hover:text-terminal-text'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
            {selectedTickers.size > 0 && (
              <span className="text-sm text-terminal-muted">{t('watchlist.selected', { n: selectedTickers.size })}</span>
            )}
          </div>
          {selectedTickers.size > 0 && (
            <button
              onClick={handleBatchRefresh}
              className="px-4 py-2 bg-terminal-accent text-terminal-bg rounded font-medium hover:bg-terminal-accent/90 transition-colors flex items-center gap-2"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t('watchlist.refreshSelected', { n: selectedTickers.size })}
            </button>
          )}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={sortedData.length > 0 && selectedTickers.size === sortedData.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-terminal-border bg-terminal-bg text-terminal-accent focus:ring-terminal-accent focus:ring-offset-0"
                />
              </th>
              <th className="cursor-pointer select-none" onClick={() => handleSort('ticker')}>
                {t('watchlist.col.ticker')}{sortIndicator('ticker')}
              </th>
              <th className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                {t('watchlist.col.company')}{sortIndicator('name')}
              </th>
              <th>{t('watchlist.col.market')}</th>
              <th
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('price')}
              >
                {t('watchlist.col.price')}{sortIndicator('price')}
              </th>
              <th>{t('watchlist.col.recommendation')}</th>
              <th
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('confidence')}
              >
                {t('watchlist.col.confidence')}{sortIndicator('confidence')}
              </th>
              <th title={t('watchlist.col.dataQualityTitle')}>{t('watchlist.col.dataQuality')}</th>
              <th
                className="cursor-pointer select-none"
                title={t('watchlist.col.analyzedTitle')}
                onClick={() => handleSort('lastUpdate')}
              >
                {t('watchlist.col.analyzed')}{sortIndicator('lastUpdate')}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedTickers.has(item.ticker)}
                    onChange={() => handleSelectTicker(item.ticker)}
                    className="w-4 h-4 rounded border-terminal-border bg-terminal-bg text-terminal-accent focus:ring-terminal-accent focus:ring-offset-0"
                  />
                </td>
                <td>
                  <Link
                    href={`/company/${item.ticker}`}
                    className="font-medium text-terminal-accent hover:underline"
                  >
                    {item.ticker}
                  </Link>
                </td>
                <td className="text-terminal-text">{item.name}</td>
                <td>{getMarketBadge(item.market)}</td>
                <td className="text-right font-mono">{formatPrice(item.price, item.currency)}</td>
                <td>{getRatingBadge(item.recommendation)}</td>
                <td className="text-right font-mono">
                  {formatConfidence(item.confidence)}
                </td>
                <td>{getQualityBadge(item.dataQuality)}</td>
                <td className="text-terminal-muted">
                  <div>{formatDate(item.lastUpdate)}</div>
                  {item.lastRefreshedAt && (
                    <div className="text-xs text-terminal-muted">
                      {t('watchlist.refreshedOn', { date: formatDate(item.lastRefreshedAt) })}
                    </div>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-terminal-muted hover:text-danger-semantic transition-colors"
                    title={t('watchlist.removeTitle')}
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Batch Refresh Modal */}
      <BatchRefreshModal
        tickers={Array.from(selectedTickers)}
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onComplete={handleBatchComplete}
      />
    </>
  );
}
