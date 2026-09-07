'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/components/language-provider';

interface BatchRefreshModalProps {
  tickers: string[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type TickerStatus = 'pending' | 'processing' | 'success' | 'error';

interface TickerProgress {
  ticker: string;
  status: TickerStatus;
  error?: string;
}

export function BatchRefreshModal({
  tickers,
  isOpen,
  onClose,
  onComplete,
}: BatchRefreshModalProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<TickerProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialize progress when modal opens
  useEffect(() => {
    if (isOpen && tickers.length > 0) {
      setProgress(tickers.map((ticker) => ({ ticker, status: 'pending' })));
      setCurrentIndex(0);
      setIsProcessing(true);
    }
  }, [isOpen, tickers]);

  // Process tickers sequentially
  const processNextTicker = useCallback(async () => {
    if (currentIndex >= tickers.length) {
      setIsProcessing(false);
      return;
    }

    const ticker = tickers[currentIndex];

    // Update status to processing
    setProgress((prev) =>
      prev.map((p) =>
        p.ticker === ticker ? { ...p, status: 'processing' } : p
      )
    );

    try {
      const response = await fetch(`/api/company/${ticker}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update status to success
      setProgress((prev) =>
        prev.map((p) =>
          p.ticker === ticker ? { ...p, status: 'success' } : p
        )
      );
    } catch (error) {
      // Update status to error
      setProgress((prev) =>
        prev.map((p) =>
          p.ticker === ticker
            ? { ...p, status: 'error', error: String(error) }
            : p
        )
      );
    }

    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, tickers]);

  // Trigger processing when currentIndex changes
  useEffect(() => {
    if (isProcessing && currentIndex < tickers.length) {
      processNextTicker();
    } else if (isProcessing && currentIndex >= tickers.length) {
      setIsProcessing(false);
    }
  }, [isProcessing, currentIndex, tickers.length, processNextTicker]);

  const completedCount = progress.filter(
    (p) => p.status === 'success' || p.status === 'error'
  ).length;
  const successCount = progress.filter((p) => p.status === 'success').length;
  const errorCount = progress.filter((p) => p.status === 'error').length;
  const progressPercent =
    tickers.length > 0 ? (completedCount / tickers.length) * 100 : 0;

  const handleClose = () => {
    if (!isProcessing) {
      onComplete();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-terminal-card border border-terminal-border rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-terminal-border">
          <h2 className="text-lg font-semibold text-terminal-text">
            {t('batch.title')}
          </h2>
          <p className="text-sm text-terminal-muted mt-1">
            {isProcessing
              ? t('batch.processing', {
                  ticker: tickers[currentIndex] || '...',
                  done: completedCount + 1,
                  total: tickers.length,
                })
              : t('batch.completed', { ok: successCount, failed: errorCount })}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2 border-b border-terminal-border">
          <div className="h-2 bg-terminal-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-terminal-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Ticker list */}
        <div className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {progress.map((item) => (
              <li
                key={item.ticker}
                className="flex items-center justify-between py-2 px-3 bg-terminal-bg rounded"
              >
                <span className="font-mono text-terminal-text">
                  {item.ticker}
                </span>
                <StatusIcon status={item.status} />
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-terminal-border">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className={`w-full py-2 px-4 rounded font-medium transition-colors ${
              isProcessing
                ? 'bg-terminal-muted/20 text-terminal-muted cursor-not-allowed'
                : 'bg-terminal-accent text-terminal-bg hover:bg-terminal-accent/90'
            }`}
          >
            {isProcessing ? t('batch.processingButton') : t('batch.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TickerStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="text-terminal-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </svg>
        </span>
      );
    case 'processing':
      return (
        <span className="text-terminal-accent animate-spin">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="20 8"
            />
          </svg>
        </span>
      );
    case 'success':
      return (
        <span className="text-success">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      );
    case 'error':
      return (
        <span className="text-danger-semantic">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </span>
      );
  }
}
