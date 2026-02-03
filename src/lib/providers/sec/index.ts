import {
  CompanyInfo,
  FinancialStatementData,
  ProviderResponse,
} from '@/types';
import {
  CompanyInfoProvider,
  FinancialDataProvider,
  SecCompanyFactsResponse,
  SecSubmissionsResponse,
} from '@/types/providers';
import {
  RateLimiter,
  withRetry,
  createErrorResponse,
  createSuccessResponse,
  globalCache,
} from '../base';
import { mapXbrlToFinancials, XBRL_TAG_MAPPING } from './xbrl-mapper';

// ============================================================================
// SEC EDGAR PROVIDER
// ============================================================================

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_TICKER_URL = 'https://www.sec.gov/files/company_tickers.json';

// SEC requires a descriptive User-Agent
const DEFAULT_USER_AGENT =
  'InvestorAnalystTerminal/1.0 (contact@example.com)';

export class SecEdgarProvider
  implements CompanyInfoProvider, FinancialDataProvider
{
  readonly name = 'sec_edgar';
  readonly isAvailable = true;

  private rateLimiter: RateLimiter;
  private userAgent: string;
  private cacheTtl: number;

  // Ticker to CIK mapping (loaded lazily)
  private tickerToCik: Map<string, string> | null = null;

  constructor(options?: { userAgent?: string; rateLimit?: number; cacheTtl?: number }) {
    this.userAgent = options?.userAgent || DEFAULT_USER_AGENT;
    // SEC allows 10 requests per second
    this.rateLimiter = new RateLimiter(options?.rateLimit || 8);
    this.cacheTtl = options?.cacheTtl || 3600; // 1 hour default
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.loadTickerMapping();
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // COMPANY INFO
  // ==========================================================================

  async getCompanyInfo(ticker: string): Promise<ProviderResponse<CompanyInfo>> {
    try {
      const cik = await this.resolveCikInternal(ticker);
      if (!cik) {
        return createErrorResponse(
          new Error(`Could not resolve CIK for ticker: ${ticker}`)
        );
      }

      const submissions = await this.fetchSubmissions(cik);
      if (!submissions) {
        return createErrorResponse(
          new Error(`Could not fetch SEC submissions for CIK: ${cik}`)
        );
      }

      const companyInfo: CompanyInfo = {
        ticker: ticker.toUpperCase(),
        cik: cik,
        name: submissions.name,
        exchange: submissions.exchanges?.[0] || null,
        sector: submissions.sicDescription || null,
        industry: null,
        description: null,
        website: null,
      };

      return createSuccessResponse(companyInfo);
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  async resolveCik(ticker: string): Promise<ProviderResponse<string>> {
    try {
      const cik = await this.resolveCikInternal(ticker);
      if (!cik) {
        return createErrorResponse(
          new Error(`Could not resolve CIK for ticker: ${ticker}`)
        );
      }
      return createSuccessResponse(cik);
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  private async resolveCikInternal(ticker: string): Promise<string | null> {
    await this.loadTickerMapping();
    return this.tickerToCik?.get(ticker.toUpperCase()) || null;
  }

  // ==========================================================================
  // FINANCIAL DATA
  // ==========================================================================

  async getAnnualFinancials(
    ticker: string,
    years = 10
  ): Promise<ProviderResponse<FinancialStatementData[]>> {
    try {
      const cik = await this.resolveCikInternal(ticker);
      if (!cik) {
        return createErrorResponse(
          new Error(`Could not resolve CIK for ticker: ${ticker}`),
          ['CIK resolution failed. You may need to set CIK manually.']
        );
      }

      const facts = await this.fetchCompanyFacts(cik);
      if (!facts) {
        return createErrorResponse(
          new Error(`Could not fetch company facts for CIK: ${cik}`)
        );
      }

      const { financials, warnings, unmappedTags } = mapXbrlToFinancials(
        facts,
        years
      );

      // Add raw document info
      const url = `${SEC_BASE_URL}/api/xbrl/companyfacts/CIK${cik}.json`;

      return createSuccessResponse(
        financials,
        { url, payload: facts },
        warnings
      );
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async loadTickerMapping(): Promise<void> {
    if (this.tickerToCik) return;

    const cacheKey = 'sec_ticker_mapping';
    const cached = globalCache.get<Map<string, string>>(cacheKey);
    if (cached) {
      this.tickerToCik = cached;
      return;
    }

    await this.rateLimiter.acquire();

    const response = await withRetry(() =>
      fetch(SEC_TICKER_URL, {
        headers: { 'User-Agent': this.userAgent },
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ticker mapping: ${response.status}`);
    }

    const data = await response.json();
    const mapping = new Map<string, string>();

    // Data format: { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }, ... }
    for (const entry of Object.values(data) as Array<{
      cik_str: number;
      ticker: string;
    }>) {
      // Pad CIK to 10 digits
      const paddedCik = String(entry.cik_str).padStart(10, '0');
      mapping.set(entry.ticker.toUpperCase(), paddedCik);
    }

    this.tickerToCik = mapping;
    globalCache.set(cacheKey, mapping, 86400); // Cache for 24 hours
  }

  private async fetchSubmissions(
    cik: string
  ): Promise<SecSubmissionsResponse | null> {
    const cacheKey = `sec_submissions_${cik}`;
    const cached = globalCache.get<SecSubmissionsResponse>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.acquire();

    const url = `${SEC_BASE_URL}/submissions/CIK${cik}.json`;
    const response = await withRetry(() =>
      fetch(url, {
        headers: { 'User-Agent': this.userAgent },
      })
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`SEC API error: ${response.status}`);
    }

    const data = await response.json();
    globalCache.set(cacheKey, data, this.cacheTtl);
    return data;
  }

  private async fetchCompanyFacts(
    cik: string
  ): Promise<SecCompanyFactsResponse | null> {
    const cacheKey = `sec_facts_${cik}`;
    const cached = globalCache.get<SecCompanyFactsResponse>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.acquire();

    const url = `${SEC_BASE_URL}/api/xbrl/companyfacts/CIK${cik}.json`;
    const response = await withRetry(() =>
      fetch(url, {
        headers: { 'User-Agent': this.userAgent },
      })
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`SEC API error: ${response.status}`);
    }

    const data = await response.json();
    globalCache.set(cacheKey, data, this.cacheTtl);
    return data;
  }
}

// Export singleton instance
let secProvider: SecEdgarProvider | null = null;

export function getSecProvider(): SecEdgarProvider {
  if (!secProvider) {
    secProvider = new SecEdgarProvider({
      userAgent: process.env.SEC_USER_AGENT || DEFAULT_USER_AGENT,
    });
  }
  return secProvider;
}

export { XBRL_TAG_MAPPING };
