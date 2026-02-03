'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this ticker from your watchlist?')) return;

    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
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
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
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
  );
}
