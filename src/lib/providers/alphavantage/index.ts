// ============================================================================
// ALPHA VANTAGE ETF PROFILE PROVIDER
// ============================================================================

const AV_BASE_URL = 'https://www.alphavantage.co/query';

export interface EtfHolding {
  symbol: string;
  name: string;
  weight: number;
}

export interface EtfSector {
  sector: string;
  weight: number;
}

export interface EtfProfileData {
  netAssets: number | null;
  expenseRatio: number | null;
  dividendYield: number | null;
  portfolioTurnover: number | null;
  inceptionDate: string | null;
  isLeveraged: boolean;
  assetClass: string | null;
  topHoldings: EtfHolding[];
  sectorBreakdown: EtfSector[];
}

interface AvEtfResponse {
  net_assets?: string;
  net_expense_ratio?: string;
  dividend_yield?: string;
  portfolio_turnover?: string;
  inception_date?: string;
  leveraged?: string;
  asset_class?: string;
  holdings?: Array<{
    symbol?: string;
    description?: string;
    weight?: string;
  }>;
  sectors?: Array<{
    sector?: string;
    weight?: string;
  }>;
  Information?: string;
  Error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AlphaVantageProvider {
  private apiKey: string;

  constructor() {
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) {
      throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
    }
    this.apiKey = key;
  }

  async fetchEtfProfile(ticker: string): Promise<EtfProfileData | null> {
    // Rate limit: 5 requests/minute on free tier
    await sleep(200);

    const url = `${AV_BASE_URL}?function=ETF_PROFILE&symbol=${encodeURIComponent(ticker)}&apikey=${this.apiKey}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'InvestorAnalystTerminal/1.0' },
    });

    if (!response.ok) {
      console.error(`Alpha Vantage API error: ${response.status}`);
      return null;
    }

    const data: AvEtfResponse = await response.json();

    // Check for API errors
    if (data.Information || data.Error) {
      console.error('Alpha Vantage error:', data.Information || data.Error);
      return null;
    }

    // No data returned (not an ETF or invalid ticker)
    if (!data.net_assets && !data.holdings && !data.sectors) {
      return null;
    }

    const toNum = (v?: string): number | null => {
      if (!v) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    // Parse holdings array
    const topHoldings: EtfHolding[] = [];
    if (Array.isArray(data.holdings)) {
      for (const h of data.holdings) {
        if (h.symbol && h.weight) {
          topHoldings.push({
            symbol: h.symbol,
            name: h.description || h.symbol,
            weight: parseFloat(h.weight) || 0,
          });
        }
      }
    }

    // Parse sectors array
    const sectorBreakdown: EtfSector[] = [];
    if (Array.isArray(data.sectors)) {
      for (const s of data.sectors) {
        if (s.sector && s.weight) {
          const weight = parseFloat(s.weight) || 0;
          if (weight > 0) {
            sectorBreakdown.push({
              sector: s.sector,
              weight,
            });
          }
        }
      }
    }

    return {
      netAssets: toNum(data.net_assets),
      expenseRatio: toNum(data.net_expense_ratio),
      dividendYield: toNum(data.dividend_yield),
      portfolioTurnover: toNum(data.portfolio_turnover),
      inceptionDate: data.inception_date || null,
      isLeveraged: data.leveraged === 'YES',
      assetClass: data.asset_class || null,
      topHoldings,
      sectorBreakdown,
    };
  }
}

// Singleton
let provider: AlphaVantageProvider | null = null;

export function getAlphaVantageProvider(): AlphaVantageProvider {
  if (!provider) {
    provider = new AlphaVantageProvider();
  }
  return provider;
}

export function isAlphaVantageConfigured(): boolean {
  return !!process.env.ALPHA_VANTAGE_API_KEY;
}
