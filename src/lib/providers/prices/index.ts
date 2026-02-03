import { PriceData, ProviderResponse } from '@/types';
import { PriceDataProvider } from '@/types/providers';
import { StooqProvider, getStooqProvider } from './stooq';

// ============================================================================
// PRICE PROVIDER FACTORY
// ============================================================================

export type PriceProviderType = 'stooq' | 'fmp' | 'alpha_vantage';

/**
 * Get the configured price provider.
 * Currently supports Stooq (free, no API key needed).
 * Can be extended to support FMP or Alpha Vantage.
 */
export function getPriceProvider(
  type?: PriceProviderType
): PriceDataProvider {
  const providerType = type || (process.env.PRICE_PROVIDER as PriceProviderType) || 'stooq';

  switch (providerType) {
    case 'stooq':
      return getStooqProvider();

    case 'fmp':
      // FMP requires API key - would be implemented when FMP provider is added
      if (!process.env.FMP_API_KEY) {
        console.warn('FMP_API_KEY not set, falling back to Stooq');
        return getStooqProvider();
      }
      // TODO: Return FMP provider when implemented
      return getStooqProvider();

    case 'alpha_vantage':
      // Alpha Vantage has strict rate limits on free tier
      if (!process.env.ALPHA_VANTAGE_API_KEY) {
        console.warn('ALPHA_VANTAGE_API_KEY not set, falling back to Stooq');
        return getStooqProvider();
      }
      // TODO: Return Alpha Vantage provider when implemented
      return getStooqProvider();

    default:
      return getStooqProvider();
  }
}

// Re-export for convenience
export { StooqProvider, getStooqProvider };
