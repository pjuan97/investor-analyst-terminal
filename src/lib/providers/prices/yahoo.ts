import { PriceData, ProviderResponse } from '@/types';
import { PriceDataProvider } from '@/types/providers';
import {
  RateLimiter,
  withRetry,
  createErrorResponse,
  createSuccessResponse,
  globalCache,
} from '../base';
import YahooFinance from 'yahoo-finance2';

// ============================================================================
// YAHOO FINANCE PRICE PROVIDER (FREE, NO API KEY)
// ============================================================================

/**
 * Yahoo Finance provider using the yahoo-finance2 npm package.
 * No API key required. Must be used server-side only.
 *
 * Uses the `chart` method which returns OHLCV data for a given ticker.
 */
export class YahooFinanceProvider implements PriceDataProvider {
  readonly name = 'yahoo';
  readonly isAvailable = true;

  private rateLimiter: RateLimiter;
  private cacheTtl: number;

  constructor(options?: { rateLimit?: number; cacheTtl?: number }) {
    this.rateLimiter = new RateLimiter(options?.rateLimit || 5);
    this.cacheTtl = options?.cacheTtl || 3600; // 1 hour
  }

  async healthCheck(): Promise<boolean> {
    try {
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
      const cacheKey = `yahoo_prices_${ticker}_${formatDate(startDate)}_${formatDate(end)}`;

      const cached = globalCache.get<PriceData[]>(cacheKey);
      if (cached) {
        return createSuccessResponse(cached);
      }

      await this.rateLimiter.acquire();

      const prices = await withRetry(() => this.fetchChart(ticker, startDate, end));

      if (prices.length === 0) {
        return createErrorResponse(
          new Error(`No price data found for ${ticker}`),
          ['Ticker may be invalid or not available on Yahoo Finance']
        );
      }

      globalCache.set(cacheKey, prices, this.cacheTtl);

      return createSuccessResponse(prices, {
        url: `https://finance.yahoo.com/quote/${ticker}/history`,
        payload: { source: 'yahoo-finance2', ticker, period1: startDate, period2: end },
      });
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  async getLatestPrice(ticker: string): Promise<ProviderResponse<PriceData>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const result = await this.getDailyPrices(ticker, startDate, endDate);

      if (!result.success || !result.data || result.data.length === 0) {
        return createErrorResponse(
          new Error(`No recent price data for ${ticker}`)
        );
      }

      // Return most recent price (data sorted descending)
      const latest = result.data[0];
      return createSuccessResponse(latest);
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  private async fetchChart(
    ticker: string,
    startDate: Date,
    endDate: Date
  ): Promise<PriceData[]> {
    const yahooFinance = new YahooFinance();

    const result = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (!result?.quotes || result.quotes.length === 0) {
      return [];
    }

    const prices: PriceData[] = [];

    for (const quote of result.quotes) {
      if (!quote.date || quote.close == null) continue;

      prices.push({
        date: new Date(quote.date),
        open: quote.open ?? null,
        high: quote.high ?? null,
        low: quote.low ?? null,
        close: quote.close,
        adjClose: quote.adjclose ?? quote.close,
        volume: quote.volume ?? null,
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
let yahooProvider: YahooFinanceProvider | null = null;

export function getYahooFinanceProvider(): YahooFinanceProvider {
  if (!yahooProvider) {
    yahooProvider = new YahooFinanceProvider();
  }
  return yahooProvider;
}
