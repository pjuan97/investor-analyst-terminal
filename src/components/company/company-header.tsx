'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CompanyHeaderProps {
  company: {
    id: string;
    ticker: string;
    name: string;
    exchange: string | null;
    sector: string | null;
    industry: string | null;
  };
  latestPrice: number | null;
  priceDate: Date | null;
  recommendation: 'BUY' | 'HOLD' | 'SELL' | null;
  confidence: number | null;
  dataQuality: number | null;
  isInWatchlist: boolean;
  userId: string;
}

export function CompanyHeader({
  company,
  latestPrice,
  priceDate,
  recommendation,
  confidence,
  dataQuality,
  isInWatchlist,
  userId,
}: CompanyHeaderProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/company/${company.ticker}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Refresh failed:', data.error);
      }
      router.refresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWatchlistToggle = async () => {
    if (isInWatchlist) {
      // Would need watchlist item ID to delete - for now just refresh
      router.refresh();
    } else {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: company.ticker }),
      });
      router.refresh();
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getRatingColor = (rating: 'BUY' | 'HOLD' | 'SELL' | null) => {
    switch (rating) {
      case 'BUY':
        return 'text-success';
      case 'HOLD':
        return 'text-warn';
      case 'SELL':
        return 'text-danger-semantic';
      default:
        return 'text-terminal-muted';
    }
  };

  const getQualityBadge = (quality: number | null) => {
    if (quality === null) return { text: 'Unknown', color: 'bg-gray-800 text-gray-400' };
    if (quality >= 0.8) return { text: 'High Quality', color: 'badge-quality-high' };
    if (quality >= 0.5) return { text: 'Medium Quality', color: 'badge-quality-medium' };
    return { text: 'Low Quality', color: 'badge-quality-low' };
  };

  const qualityBadge = getQualityBadge(dataQuality);

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/watchlist"
              className="text-terminal-muted hover:text-terminal-text transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-3xl font-bold text-terminal-text">
              {company.ticker}
            </h1>
            <span className={`badge ${qualityBadge.color}`}>
              {qualityBadge.text}
            </span>
          </div>
          <p className="text-lg text-terminal-muted mt-1">{company.name}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-terminal-muted">
            {company.exchange && <span>{company.exchange}</span>}
            {company.sector && (
              <>
                <span>•</span>
                <span>{company.sector}</span>
              </>
            )}
            {company.industry && (
              <>
                <span>•</span>
                <span>{company.industry}</span>
              </>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold text-terminal-text font-mono">
            {formatPrice(latestPrice)}
          </div>
          {priceDate && (
            <div className="text-sm text-terminal-muted">
              as of{' '}
              {new Date(priceDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-terminal-border flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-sm text-terminal-muted">Recommendation</div>
            <div className={`text-2xl font-bold ${getRatingColor(recommendation)}`}>
              {recommendation || 'No Data'}
            </div>
          </div>
          {confidence !== null && (
            <div>
              <div className="text-sm text-terminal-muted">Confidence</div>
              <div className="text-2xl font-bold text-terminal-text">
                {(confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleWatchlistToggle}
            className={`btn ${isInWatchlist ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isInWatchlist ? 'In Watchlist ✓' : 'Add to Watchlist'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            title="Refresh data from providers"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
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
            {isRefreshing && <span className="ml-2">Loading...</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
