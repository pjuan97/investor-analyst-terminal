'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BatchRefreshModal } from './batch-refresh-modal';

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  price: number | null;
  priceDate: Date | null;
  recommendation: 'BUY' | 'HOLD' | 'SELL' | null;
  confidence: number | null;
  lastUpdate: Date | null;
  dataQuality: number | null;
}

interface WatchlistTableProps {
  data: WatchlistItem[];
}

export function WatchlistTable({ data }: WatchlistTableProps) {
  const router = useRouter();
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this ticker from your watchlist?')) return;

    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleSelectAll = () => {
    if (selectedTickers.size === data.length) {
      setSelectedTickers(new Set());
    } else {
      setSelectedTickers(new Set(data.map((item) => item.ticker)));
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

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
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
      return <span className="badge bg-gray-800 text-gray-400">No data</span>;
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
        <span className="badge bg-gray-800 text-gray-400" title="Data quality not yet assessed">
          ?
        </span>
      );
    }

    if (quality >= 0.8) {
      return (
        <span className="badge badge-quality-high" title="High: 80%+ of financial metrics available">
          High
        </span>
      );
    } else if (quality >= 0.5) {
      return (
        <span className="badge badge-quality-medium" title="Medium: 50-79% of financial metrics available">
          Medium
        </span>
      );
    } else {
      return (
        <span className="badge badge-quality-low" title="Low: Less than 50% of financial metrics available">
          Low
        </span>
      );
    }
  };

  return (
    <>
      {/* Toolbar */}
      {data.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-terminal-muted">
            {selectedTickers.size > 0 && (
              <span>{selectedTickers.size} selected</span>
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
              Refresh Selected ({selectedTickers.size})
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
                  checked={data.length > 0 && selectedTickers.size === data.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-terminal-border bg-terminal-bg text-terminal-accent focus:ring-terminal-accent focus:ring-offset-0"
                />
              </th>
              <th>Ticker</th>
              <th>Company</th>
              <th className="text-right">Price</th>
              <th>Recommendation</th>
              <th className="text-right">Confidence</th>
              <th title="Percentage of financial data fields populated from SEC filings">Data Quality</th>
              <th title="Date when recommendation was last generated">Analyzed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
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
                <td className="text-right font-mono">{formatPrice(item.price)}</td>
                <td>{getRatingBadge(item.recommendation)}</td>
                <td className="text-right font-mono">
                  {formatConfidence(item.confidence)}
                </td>
                <td>{getQualityBadge(item.dataQuality)}</td>
                <td className="text-terminal-muted">{formatDate(item.lastUpdate)}</td>
                <td>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-terminal-muted hover:text-red-400 transition-colors"
                    title="Remove from watchlist"
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
