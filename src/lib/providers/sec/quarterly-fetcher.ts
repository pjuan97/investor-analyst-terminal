import { RateLimiter, withRetry, sleep } from '../base';

// ============================================================================
// TYPES
// ============================================================================

export interface QuarterlyReportData {
  accessionNumber: string;
  filingDate: Date;
  periodEnd: Date;
  fiscalYear: number;
  fiscalQuarter: number;
  formType: string;
  primaryDocument: string;
  rawHtml: string;

  // Quantitative (may be null if parsing fails)
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  cash: number | null;

  // Qualitative
  mdaText: string | null;
  segmentInfo: string | null;
  riskFactors: string | null;
}

interface QuarterlyNumbers {
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  cash: number | null;
}

interface FilingEntry {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
}

// ============================================================================
// SEC QUARTERLY FETCHER
// ============================================================================

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_TICKER_URL = 'https://www.sec.gov/files/company_tickers.json';
const DEFAULT_USER_AGENT =
  'InvestorAnalystTerminal/1.0 (contact@example.com)';

export class SecQuarterlyFetcher {
  private rateLimiter: RateLimiter;
  private userAgent: string;
  private tickerToCik: Map<string, string> | null = null;

  constructor(options?: { userAgent?: string }) {
    this.userAgent = options?.userAgent || DEFAULT_USER_AGENT;
    // SEC allows 10 req/s, we use 5 to be safe
    this.rateLimiter = new RateLimiter(5);
  }

  async fetchLatestQuarterlyReport(
    ticker: string
  ): Promise<QuarterlyReportData> {
    const upperTicker = ticker.toUpperCase();

    // 1. Resolve CIK
    const cik = await this.resolveCik(upperTicker);
    if (!cik) {
      throw new Error(`Could not resolve CIK for ticker: ${upperTicker}`);
    }

    // 2. Fetch submissions to find latest 10-Q
    await this.rateLimiter.acquire();
    const submissionsUrl = `${SEC_BASE_URL}/submissions/CIK${cik}.json`;
    const submissionsRes = await withRetry(() =>
      fetch(submissionsUrl, {
        headers: { 'User-Agent': this.userAgent },
      })
    );

    if (!submissionsRes.ok) {
      throw new Error(
        `Failed to fetch SEC submissions for ${upperTicker}: ${submissionsRes.status}`
      );
    }

    const submissions = await submissionsRes.json();
    const recentFilings = submissions.filings?.recent;

    if (!recentFilings) {
      throw new Error(`No filings data found for ${upperTicker}`);
    }

    // Find the most recent 10-Q
    const filing = this.findLatest10Q(recentFilings);
    if (!filing) {
      throw new Error(`No 10-Q filings found for ${upperTicker}`);
    }

    // 3. Build filing URL and download HTML
    await sleep(200); // Rate limit between requests
    const accessionClean = filing.accessionNumber.replace(/-/g, '');
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionClean}/${filing.primaryDocument}`;

    await this.rateLimiter.acquire();
    const filingRes = await withRetry(() =>
      fetch(filingUrl, {
        headers: { 'User-Agent': this.userAgent },
      })
    );

    if (!filingRes.ok) {
      throw new Error(
        `Failed to download 10-Q filing: ${filingRes.status} — ${filingUrl}`
      );
    }

    const rawHtml = await filingRes.text();

    // 4. Parse the HTML for various sections
    const mdaText = this.extractMDA(rawHtml);
    const segmentInfo = this.extractSegmentInfo(rawHtml);
    const riskFactors = this.extractRiskFactors(rawHtml);
    const strippedText = this.stripHtml(rawHtml);
    const numbers = this.extractQuarterlyNumbers(strippedText, rawHtml);

    // 5. Determine fiscal quarter from period end date
    const periodEnd = new Date(filing.reportDate);
    const { fiscalYear, fiscalQuarter } =
      this.inferFiscalQuarter(periodEnd);

    return {
      accessionNumber: filing.accessionNumber,
      filingDate: new Date(filing.filingDate),
      periodEnd,
      fiscalYear,
      fiscalQuarter,
      formType: filing.form,
      primaryDocument: filing.primaryDocument,
      rawHtml,
      ...numbers,
      mdaText,
      segmentInfo,
      riskFactors,
    };
  }

  // ==========================================================================
  // PRIVATE — CIK Resolution
  // ==========================================================================

  private async resolveCik(ticker: string): Promise<string | null> {
    if (!this.tickerToCik) {
      await this.loadTickerMapping();
    }
    return this.tickerToCik?.get(ticker) || null;
  }

  private async loadTickerMapping(): Promise<void> {
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

    for (const entry of Object.values(data) as Array<{
      cik_str: number;
      ticker: string;
    }>) {
      const paddedCik = String(entry.cik_str).padStart(10, '0');
      mapping.set(entry.ticker.toUpperCase(), paddedCik);
    }

    this.tickerToCik = mapping;
  }

  // ==========================================================================
  // PRIVATE — Filing Discovery
  // ==========================================================================

  private findLatest10Q(recentFilings: {
    form: string[];
    accessionNumber: string[];
    filingDate: string[];
    reportDate: string[];
    primaryDocument: string[];
  }): FilingEntry | null {
    const { form, accessionNumber, filingDate, reportDate, primaryDocument } =
      recentFilings;

    for (let i = 0; i < form.length; i++) {
      if (form[i] === '10-Q') {
        return {
          accessionNumber: accessionNumber[i],
          filingDate: filingDate[i],
          reportDate: reportDate[i],
          form: form[i],
          primaryDocument: primaryDocument[i],
        };
      }
    }

    return null;
  }

  private inferFiscalQuarter(periodEnd: Date): {
    fiscalYear: number;
    fiscalQuarter: number;
  } {
    const month = periodEnd.getMonth() + 1; // 1-based
    const year = periodEnd.getFullYear();

    // Standard calendar fiscal quarters
    if (month <= 3) return { fiscalYear: year, fiscalQuarter: 1 };
    if (month <= 6) return { fiscalYear: year, fiscalQuarter: 2 };
    if (month <= 9) return { fiscalYear: year, fiscalQuarter: 3 };
    // Q4 would be a 10-K, but in case:
    return { fiscalYear: year, fiscalQuarter: 4 };
  }

  // ==========================================================================
  // PRIVATE — HTML Parsing / Extraction
  // ==========================================================================

  extractMDA(html: string): string | null {
    try {
      // Strip HTML tags but keep text structure
      const text = this.stripHtml(html);

      // Find ALL occurrences of Item 2 / MD&A patterns
      const startPatterns = [
        /item\s*2[\.\s:—–-]*management[''s]*\s*discussion/i,
        /management[''s]*\s*discussion\s*and\s*analysis/i,
        /item\s*2[\.\s:—–-]*[\w\s]{0,30}discussion/i,
      ];

      const endPatterns = [
        /item\s*3[\.\s:—–-]/i,
        /quantitative\s+and\s+qualitative\s+disclosures/i,
      ];

      let startIdx = -1;
      for (const pattern of startPatterns) {
        const regex = new RegExp(pattern.source, 'gi');
        let match;

        while ((match = regex.exec(text)) !== null) {
          const candidateStart = match.index;

          // Find the next end marker after this start
          let candidateEnd = -1;
          for (const endPattern of endPatterns) {
            const endRegex = new RegExp(endPattern.source, 'gi');
            endRegex.lastIndex = candidateStart + 100;
            const endMatch = endRegex.exec(text);
            if (endMatch && (candidateEnd === -1 || endMatch.index < candidateEnd)) {
              candidateEnd = endMatch.index;
            }
          }

          // Check if the section between start and end has
          // substantial content (>500 chars = real MD&A, not TOC)
          if (candidateEnd > candidateStart) {
            const sectionLength = candidateEnd - candidateStart;
            if (sectionLength > 500) {
              startIdx = candidateStart;
              break;
            }
          }
        }
        if (startIdx !== -1) break;
      }

      if (startIdx === -1) return null;

      // Find end marker after the real start
      let endIdx = -1;
      for (const endPattern of endPatterns) {
        const endRegex = new RegExp(endPattern.source, 'gi');
        endRegex.lastIndex = startIdx + 500;
        const endMatch = endRegex.exec(text);
        if (endMatch && (endIdx === -1 || endMatch.index < endIdx)) {
          endIdx = endMatch.index;
        }
      }

      let mdaText = endIdx > startIdx
        ? text.slice(startIdx, endIdx).trim()
        : text.slice(startIdx, startIdx + 15000).trim();

      // Truncate to 15,000 chars
      if (mdaText.length > 15000) {
        mdaText = mdaText.slice(0, 15000) + '\n\n[... truncated at 15,000 characters ...]';
      }

      return mdaText.length > 100 ? this.decodeHtmlEntities(mdaText) : null;
    } catch {
      return null;
    }
  }

  extractSegmentInfo(html: string): string | null {
    try {
      const text = this.stripHtml(html);

      const patterns = [
        /Segment\s+Information/i,
        /Operating\s+Segments/i,
        /Reportable\s+Segments/i,
        /Business\s+Segments/i,
      ];

      let startIdx = -1;
      for (const pattern of patterns) {
        const match = text.search(pattern);
        if (match !== -1) {
          startIdx = match;
          break;
        }
      }

      if (startIdx === -1) return null;

      // Take up to 5,000 chars from segment start
      let segmentText = text.slice(startIdx, startIdx + 5000).trim();

      // Try to find a natural end (next section header pattern)
      const sectionEnd = segmentText.search(
        /\n\s*(?:Note\s+\d+|Item\s+\d+|\d+\.\s+[A-Z])/i
      );
      if (sectionEnd > 200) {
        segmentText = segmentText.slice(0, sectionEnd).trim();
      }

      return segmentText.length > 50 ? this.decodeHtmlEntities(segmentText) : null;
    } catch {
      return null;
    }
  }

  private extractRiskFactors(html: string): string | null {
    try {
      const text = this.stripHtml(html);

      const startPatterns = [
        /Item\s*1A[.\s]*[-—]*\s*Risk\s*Factors/i,
        /ITEM\s*1A[.\s]*[-—]*\s*RISK\s*FACTORS/i,
      ];

      let startIdx = -1;
      for (const pattern of startPatterns) {
        const match = text.search(pattern);
        if (match !== -1) {
          startIdx = match;
          break;
        }
      }

      if (startIdx === -1) return null;

      // Find end — Item 2
      const endPatterns = [
        /Item\s*2[.\s]*[-—]*\s*(?:Unregistered|Properties|Management)/i,
        /ITEM\s*2[.\s]*[-—]/i,
      ];

      let endIdx = startIdx + 10000;
      for (const pattern of endPatterns) {
        const searchText = text.slice(startIdx + 50);
        const match = searchText.search(pattern);
        if (match !== -1) {
          endIdx = startIdx + 50 + match;
          break;
        }
      }

      let riskText = text.slice(startIdx, endIdx).trim();

      if (riskText.length > 10000) {
        riskText = riskText.slice(0, 10000) + '\n\n[... truncated at 10,000 characters ...]';
      }

      return riskText.length > 100 ? this.decodeHtmlEntities(riskText) : null;
    } catch {
      return null;
    }
  }

  private detectReportingUnit(html: string): number {
    const text = html.substring(0, 50000); // Only search the beginning

    if (
      /in\s+millions,?\s+except/i.test(text) ||
      /amounts\s+in\s+millions/i.test(text) ||
      /\(in\s+millions\)/i.test(text)
    ) {
      return 1_000_000;
    }

    if (
      /in\s+thousands,?\s+except/i.test(text) ||
      /amounts\s+in\s+thousands/i.test(text) ||
      /\(in\s+thousands\)/i.test(text)
    ) {
      return 1_000;
    }

    if (
      /in\s+billions,?\s+except/i.test(text) ||
      /\(in\s+billions\)/i.test(text)
    ) {
      return 1_000_000_000;
    }

    // Default: millions (most large-cap SEC filers)
    return 1_000_000;
  }

  extractQuarterlyNumbers(strippedText: string, rawHtml: string): QuarterlyNumbers {
    const result: QuarterlyNumbers = {
      revenue: null,
      grossProfit: null,
      operatingIncome: null,
      netIncome: null,
      eps: null,
      operatingCashFlow: null,
      freeCashFlow: null,
      totalDebt: null,
      cash: null,
    };

    try {
      const unit = this.detectReportingUnit(rawHtml);

      // Try to find revenue
      result.revenue = this.findFinancialValue(strippedText, [
        /(?:Net\s+)?(?:Revenue|Sales)[s]?\s*[\$]?\s*([\d,]+(?:\.\d+)?)/i,
        /Total\s+(?:net\s+)?revenue[s]?\s*[\$]?\s*([\d,]+(?:\.\d+)?)/i,
      ]);

      // Net income
      result.netIncome = this.findFinancialValue(strippedText, [
        /Net\s+income(?:\s+\(loss\))?\s*[\$]?\s*([\-\(]?[\d,]+(?:\.\d+)?[\)]?)/i,
      ]);

      // EPS — always in absolute $/share, never multiplied
      result.eps = this.findFinancialValue(strippedText, [
        /(?:Basic|Diluted)\s+(?:net\s+)?(?:income|earnings)\s+per\s+(?:common\s+)?share\s*[\$]?\s*([\-\(]?[\d,.]+[\)]?)/i,
        /(?:Earnings|Income)\s+per\s+share[—:\s]*(?:Basic|Diluted)\s*[\$]?\s*([\-\(]?[\d,.]+[\)]?)/i,
      ]);

      // Apply reporting unit multiplier to all values except EPS
      if (result.revenue !== null) result.revenue *= unit;
      if (result.grossProfit !== null) result.grossProfit *= unit;
      if (result.operatingIncome !== null) result.operatingIncome *= unit;
      if (result.netIncome !== null) result.netIncome *= unit;
      if (result.operatingCashFlow !== null) result.operatingCashFlow *= unit;
      if (result.freeCashFlow !== null) result.freeCashFlow *= unit;
      if (result.totalDebt !== null) result.totalDebt *= unit;
      if (result.cash !== null) result.cash *= unit;

      return result;
    } catch {
      return result;
    }
  }

  // ==========================================================================
  // PRIVATE — Helpers
  // ==========================================================================

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&#x2019;/g, '\u2019') // '
      .replace(/&#x2018;/g, '\u2018') // '
      .replace(/&#x201C;/g, '\u201C') // "
      .replace(/&#x201D;/g, '\u201D') // "
      .replace(/&#x2014;/g, '\u2014') // —
      .replace(/&#x2013;/g, '\u2013') // –
      .replace(/&#x00A0;/g, ' ')
      .replace(/&#xa0;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#\d+;/g, (match) => {
        const code = parseInt(match.slice(2, -1), 10);
        return isNaN(code) ? match : String.fromCharCode(code);
      })
      .replace(/&#x[\da-fA-F]+;/g, (match) => {
        const code = parseInt(match.slice(3, -1), 16);
        return isNaN(code) ? match : String.fromCharCode(code);
      });
  }

  private stripHtml(html: string): string {
    // Decode numeric HTML entities FIRST so regex patterns can match
    html = html
      .replace(/&#160;/g, ' ')
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8212;/g, '—')
      .replace(/&#8211;/g, '–')
      .replace(/&#xa0;/gi, ' ')
      .replace(/&#x[\da-fA-F]+;/g, (m) => {
        const code = parseInt(m.slice(3, -1), 16);
        return isNaN(code) ? m : String.fromCharCode(code);
      })
      .replace(/&#(\d+);/g, (_m, code) => {
        return String.fromCharCode(parseInt(code, 10));
      });

    return html
      // Remove script and style tags with content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Replace common block elements with newlines
      .replace(/<\/?(p|div|br|tr|li|h[1-6])[^>]*>/gi, '\n')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      // Collapse whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  private findFinancialValue(
    text: string,
    patterns: RegExp[]
  ): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1]
          .replace(/[,\s]/g, '')
          .replace(/\((.+)\)/, '-$1');
        const val = parseFloat(cleaned);
        if (!isNaN(val)) return val;
      }
    }
    return null;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let fetcherInstance: SecQuarterlyFetcher | null = null;

export function getSecQuarterlyFetcher(): SecQuarterlyFetcher {
  if (!fetcherInstance) {
    fetcherInstance = new SecQuarterlyFetcher({
      userAgent:
        process.env.SEC_USER_AGENT ||
        DEFAULT_USER_AGENT,
    });
  }
  return fetcherInstance;
}
