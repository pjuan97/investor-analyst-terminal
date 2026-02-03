import { getSecProvider, SecEdgarProvider } from './sec';
import { getPriceProvider, PriceProviderType } from './prices';
import { CompanyInfoProvider, FinancialDataProvider, PriceDataProvider } from '@/types/providers';

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

export interface Providers {
  companyInfo: CompanyInfoProvider;
  financials: FinancialDataProvider;
  prices: PriceDataProvider;
}

/**
 * Get all configured providers.
 * This is the main entry point for accessing data providers.
 */
export function getProviders(): Providers {
  const secProvider = getSecProvider();
  const priceProvider = getPriceProvider();

  // Check if FMP is available for better financial data
  const hasFmp = !!process.env.FMP_API_KEY;

  if (hasFmp) {
    // TODO: When FMP provider is implemented, use it for financials
    // For now, fall back to SEC
    console.log('FMP API key detected - would use FMP for financials (not yet implemented)');
  }

  return {
    companyInfo: secProvider,
    financials: secProvider, // Can be swapped for FMP when available
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
  const providers = getProviders();

  const [secHealth, pricesHealth] = await Promise.all([
    providers.companyInfo.healthCheck(),
    providers.prices.healthCheck(),
  ]);

  return {
    sec: secHealth,
    prices: pricesHealth,
    fmp: false, // Not implemented yet
  };
}

// Re-export providers
export { getSecProvider, SecEdgarProvider } from './sec';
export { getPriceProvider, getStooqProvider } from './prices';
export * from './base';
