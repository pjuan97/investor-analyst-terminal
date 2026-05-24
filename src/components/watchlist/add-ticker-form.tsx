'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddTickerFormProps {
  userId: string;
}

export function AddTickerForm({ userId }: AddTickerFormProps) {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add ticker');
        return;
      }

      setTicker('');
      router.refresh();
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="input w-32 uppercase"
          maxLength={10}
          required
        />
        {error && (
          <div className="absolute top-full left-0 mt-1 text-xs text-danger-semantic whitespace-nowrap">
            {error}
          </div>
        )}
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? 'Adding...' : 'Add Ticker'}
      </button>
    </form>
  );
}
