import { PriceData, ProviderResponse } from '@/types';
import { PriceDataProvider } from '@/types/providers';
import {
  RateLimiter,
  withRetry,
  createErrorResponse,
  createSuccessResponse,
  globalCache,
} from '../base';

// ============================================================================
// STOOQ PRICE PROVIDER (FREE)
// ============================================================================

/**
 * Stooq provides free historical price data via CSV download.
 * No API key required, but we should respect their servers.
 *
 * URL format: https://stooq.com/q/d/l/?s={ticker}.us&d1={YYYYMMDD}&d2={YYYYMMDD}
 */
export class StooqProvider implements PriceDataProvider {
  readonly name = 'stooq';
  readonly isAvailable = true;

  private rateLimiter: RateLimiter;
  private cacheTtl: number;

  constructor(options?: { rateLimit?: number; cacheTtl?: number }) {
    // Be conservative with Stooq - it's a free service
    this.rateLimiter = new RateLimiter(options?.rateLimit || 2);
    this.cacheTtl = options?.cacheTtl || 3600; // 1 hour
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch a single day of AAPL data
      const result = await this.getLatestPrice('AAPL');
      return result.success;
    } catch {
      return false;
    }
  }

  async getDailyPrices(
    ticker: string,
    startDate: Date,
    endDate?: Date
  ): Promise<ProviderResponse<PriceData[]>> {
    try {
      const end = endDate || new Date();
      const cacheKey = `stooq_prices_${ticker}_${formatDate(startDate)}_${formatDate(end)}`;

      const cached = globalCache.get<PriceData[]>(cacheKey);
      if (cached) {
        return createSuccessResponse(cached);
      }

      await this.rateLimiter.acquire();

      const url = this.buildUrl(ticker, startDate, end);
      const response = await withRetry(() => fetch(url));

      if (!response.ok) {
        return createErrorResponse(
          new Error(`Stooq API error: ${response.status}`)
        );
      }

      const csvText = await response.text();
      const prices = this.parseCsv(csvText);

      if (prices.length === 0) {
        return createErrorResponse(
          new Error(`No price data found for ${ticker}`),
          ['Ticker may be invalid or not available on Stooq']
        );
      }

      globalCache.set(cacheKey, prices, this.cacheTtl);

      return createSuccessResponse(prices, { url, payload: csvText });
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  async getLatestPrice(ticker: string): Promise<ProviderResponse<PriceData>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Get last 7 days to ensure we get data

      const result = await this.getDailyPrices(ticker, startDate, endDate);

      if (!result.success || !result.data || result.data.length === 0) {
        return createErrorResponse(
          new Error(`No recent price data for ${ticker}`)
        );
      }

      // Return most recent price
      const latest = result.data[0];
      return createSuccessResponse(latest);
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  private buildUrl(ticker: string, startDate: Date, endDate: Date): string {
    // Stooq uses .US suffix for US stocks
    const stooqTicker = `${ticker.toLowerCase()}.us`;
    const d1 = formatDate(startDate);
    const d2 = formatDate(endDate);

    return `https://stooq.com/q/d/l/?s=${stooqTicker}&d1=${d1}&d2=${d2}`;
  }

  private parseCsv(csvText: string): PriceData[] {
    const lines = csvText.trim().split('\n');

    // First line is header: Date,Open,High,Low,Close,Volume
    if (lines.length < 2) return [];

    const prices: PriceData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 5) continue;

      const [dateStr, open, high, low, close, volume] = parts;

      // Parse date (format: YYYY-MM-DD)
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;

      prices.push({
        date,
        open: parseFloat(open) || null,
        high: parseFloat(high) || null,
        low: parseFloat(low) || null,
        close: parseFloat(close),
        adjClose: parseFloat(close), // Stooq close is adjusted
        volume: volume ? parseInt(volume, 10) : null,
      });
    }

    // Sort by date descending (most recent first)
    prices.sort((a, b) => b.date.getTime() - a.date.getTime());

    return prices;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Export singleton instance
let stooqProvider: StooqProvider | null = null;

export function getStooqProvider(): StooqProvider {
  if (!stooqProvider) {
    stooqProvider = new StooqProvider();
  }
  return stooqProvider;
}
