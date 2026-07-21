import { CompanyInfo, ProviderResponse } from '@/types';
import { CompanyInfoProvider } from '@/types/providers';
import {
  RateLimiter,
  withRetry,
  createErrorResponse,
  createSuccessResponse,
  globalCache,
} from '../base';
import YahooFinance from 'yahoo-finance2';

// ============================================================================
// YAHOO FINANCE COMPANY INFO PROVIDER (FREE, NO API KEY)
// ============================================================================

/**
 * Company info provider for tickers not covered by SEC EDGAR
 * (SEC only has US filers; e.g. BVC-listed companies use ticker suffix `.CL`).
 */
export class YahooCompanyInfoProvider implements CompanyInfoProvider {
  readonly name = 'yahoo_company_info';
  readonly isAvailable = true;

  private rateLimiter: RateLimiter;
  private cacheTtl: number;

  constructor(options?: { rateLimit?: number; cacheTtl?: number }) {
    this.rateLimiter = new RateLimiter(options?.rateLimit || 5);
    this.cacheTtl = options?.cacheTtl || 3600; // 1 hour
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.getCompanyInfo('ECOPETROL.CL');
      return result.success;
    } catch {
      return false;
    }
  }

  async getCompanyInfo(ticker: string): Promise<ProviderResponse<CompanyInfo>> {
    try {
      const cacheKey = `yahoo_company_info_${ticker}`;
      const cached = globalCache.get<CompanyInfo>(cacheKey);
      if (cached) {
        return createSuccessResponse(cached);
      }

      await this.rateLimiter.acquire();

      const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

      const summary = await withRetry(() =>
        yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'price'] })
      );

      if (!summary?.price) {
        return createErrorResponse(
          new Error(`No company info found for ${ticker}`),
          ['Ticker may be invalid or not available on Yahoo Finance']
        );
      }

      const companyInfo: CompanyInfo = {
        ticker: summary.price.symbol || ticker.toUpperCase(),
        cik: null,
        name: summary.price.longName || summary.price.shortName || ticker,
        exchange: summary.price.exchangeName || summary.price.exchange || null,
        sector: summary.summaryProfile?.sector || null,
        industry: summary.summaryProfile?.industry || null,
        description: summary.summaryProfile?.longBusinessSummary || null,
        website: summary.summaryProfile?.website || null,
        country: summary.summaryProfile?.country || undefined,
        currency: summary.price.currency || undefined,
      };

      globalCache.set(cacheKey, companyInfo, this.cacheTtl);

      return createSuccessResponse(companyInfo, {
        url: `https://finance.yahoo.com/quote/${ticker}`,
        payload: { source: 'yahoo-finance2 quoteSummary', ticker },
      });
    } catch (error) {
      return createErrorResponse(error);
    }
  }
}

// Export singleton instance
let yahooCompanyInfoProvider: YahooCompanyInfoProvider | null = null;

export function getYahooCompanyInfoProvider(): YahooCompanyInfoProvider {
  if (!yahooCompanyInfoProvider) {
    yahooCompanyInfoProvider = new YahooCompanyInfoProvider();
  }
  return yahooCompanyInfoProvider;
}
