import { getSecProvider, SecEdgarProvider } from './sec';
import { getPriceProvider, PriceProviderType } from './prices';
import { getFmpProvider, FmpProvider } from './fmp';
import { getYahooFinancialsProvider } from './financials/yahoo-financials';
import { getYahooCompanyInfoProvider } from './companyInfo/yahoo-company-info';
import { CompanyInfoProvider, FinancialDataProvider, PriceDataProvider } from '@/types/providers';
import { FinancialStatementData, ProviderResponse } from '@/types';
import { fillDerivedFields } from './derived';

/**
 * BVC-listed Colombian tickers use the `.CL` suffix on Yahoo Finance
 * (e.g. ECOPETROL.CL, CIBEST.CL). Neither FMP nor SEC EDGAR cover them,
 * so they're routed to the Yahoo-based providers instead.
 */
export function isBvcTicker(ticker: string): boolean {
  return ticker.toUpperCase().endsWith('.CL');
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

export interface Providers {
  companyInfo: CompanyInfoProvider;
  financials: FinancialDataProvider;
  prices: PriceDataProvider;
}

/**
 * Combined FMP + SEC provider: fetches from both in parallel,
 * merges results prioritizing FMP where years overlap.
 *
 * - FMP: last 5 years (plan limit), complete data
 * - SEC: up to 15 years, may have gaps
 * - Overlap years: FMP wins (better data quality)
 */
class CombinedFinancialProvider implements FinancialDataProvider {
  readonly name = 'fmp+sec_combined';
  private fmp: FmpProvider;
  private sec: FinancialDataProvider;

  constructor(fmp: FmpProvider, sec: FinancialDataProvider) {
    this.fmp = fmp;
    this.sec = sec;
  }

  get isAvailable(): boolean {
    return this.fmp.isAvailable;
  }

  async healthCheck(): Promise<boolean> {
    const [fmpHealth, secHealth] = await Promise.all([
      this.fmp.healthCheck(),
      this.sec.healthCheck(),
    ]);
    return fmpHealth || secHealth;
  }

  async getAnnualFinancials(
    ticker: string,
    _years?: number
  ): Promise<ProviderResponse<FinancialStatementData[]>> {
    // Fetch from both providers in parallel
    const [fmpResult, secResult] = await Promise.all([
      this.fmp.getAnnualFinancials(ticker, 5).catch(() => null),
      this.sec.getAnnualFinancials(ticker, 15).catch(() => null),
    ]);

    const fmpSuccess = fmpResult?.success && fmpResult.data && fmpResult.data.length > 0;
    const secSuccess = secResult?.success && secResult.data && secResult.data.length > 0;

    // If both fail, return error
    if (!fmpSuccess && !secSuccess) {
      const error = fmpResult?.error || secResult?.error || 'Both FMP and SEC failed';
      return { success: false, data: null, error };
    }

    // If only SEC succeeded
    if (!fmpSuccess && secSuccess) {
      return {
        success: true,
        data: secResult!.data!.map(fillDerivedFields),
        warnings: [`FMP unavailable (${fmpResult?.error}), using SEC only`],
      };
    }

    // If only FMP succeeded
    if (fmpSuccess && !secSuccess) {
      return {
        success: true,
        data: fmpResult!.data!.map(fillDerivedFields),
        warnings: [`SEC unavailable (${secResult?.error}), using FMP only`],
      };
    }

    // Both succeeded — combine with FMP priority
    const combined = new Map<number, FinancialStatementData>();

    // Insert all SEC years first
    for (const statement of secResult!.data!) {
      combined.set(statement.fiscalYear, statement);
    }

    // Overwrite with FMP years (FMP has priority)
    for (const statement of fmpResult!.data!) {
      combined.set(statement.fiscalYear, statement);
    }

    // Apply derived fields and sort descending
    const mergedStatements = Array.from(combined.values())
      .map(fillDerivedFields)
      .sort((a, b) => b.fiscalYear - a.fiscalYear);

    const fmpYears = fmpResult!.data!.length;
    const secOnlyYears = mergedStatements.length - fmpYears;

    return {
      success: true,
      data: mergedStatements,
      warnings: secOnlyYears > 0
        ? [`Combined: ${fmpYears} years from FMP + ${secOnlyYears} years from SEC`]
        : undefined,
      rawDocument: fmpResult!.rawDocument,
    };
  }
}

/**
 * Get all configured providers.
 * This is the main entry point for accessing data providers.
 *
 * If `ticker` is a BVC-listed Colombian stock (`.CL` suffix), routes
 * companyInfo/financials to the Yahoo-based providers — FMP and SEC EDGAR
 * don't cover that exchange. Every other ticker keeps the existing
 * FMP+SEC path unchanged.
 *
 * If FMP_API_KEY is set, uses CombinedFinancialProvider (FMP + SEC in parallel).
 * Otherwise uses SEC EDGAR directly.
 */
export function getProviders(ticker?: string): Providers {
  const secProvider = getSecProvider();
  const priceProvider = getPriceProvider();
  const fmpProvider = getFmpProvider();

  if (ticker && isBvcTicker(ticker)) {
    return {
      companyInfo: getYahooCompanyInfoProvider(),
      financials: getYahooFinancialsProvider(),
      prices: priceProvider,
    };
  }

  const financialsProvider = fmpProvider
    ? new CombinedFinancialProvider(fmpProvider, secProvider)
    : secProvider;

  return {
    companyInfo: secProvider,
    financials: financialsProvider,
    prices: priceProvider,
  };
}

/**
 * Check health of all providers
 */
export async function checkProvidersHealth(): Promise<{
  sec: boolean;
  prices: boolean;
  fmp: boolean;
}> {
  const secProvider = getSecProvider();
  const priceProvider = getPriceProvider();
  const fmpProvider = getFmpProvider();

  const [secHealth, pricesHealth, fmpHealth] = await Promise.all([
    secProvider.healthCheck(),
    priceProvider.healthCheck(),
    fmpProvider ? fmpProvider.healthCheck() : Promise.resolve(false),
  ]);

  return {
    sec: secHealth,
    prices: pricesHealth,
    fmp: fmpHealth,
  };
}

// Re-export providers
export { getSecProvider, SecEdgarProvider } from './sec';
export { getPriceProvider, getStooqProvider, getYahooFinanceProvider } from './prices';
export { getFmpProvider } from './fmp';
export * from './base';
