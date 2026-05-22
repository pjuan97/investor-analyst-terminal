import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

interface EtfData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface Mover {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^RUT', name: 'Russell 2000' },
];

const ETF_CATEGORIES: Record<string, { symbol: string; name: string }[]> = {
  sectors: [
    { symbol: 'XLK', name: 'Technology' },
    { symbol: 'XLV', name: 'Health Care' },
    { symbol: 'XLF', name: 'Financials' },
    { symbol: 'XLRE', name: 'Real Estate' },
    { symbol: 'XLE', name: 'Energy' },
    { symbol: 'XLI', name: 'Industrials' },
    { symbol: 'XLY', name: 'Consumer Disc.' },
    { symbol: 'XLP', name: 'Consumer Staples' },
    { symbol: 'XLB', name: 'Materials' },
    { symbol: 'XLU', name: 'Utilities' },
  ],
  regions: [
    { symbol: 'EFA', name: 'Developed ex-US' },
    { symbol: 'VWO', name: 'Emerging Markets' },
    { symbol: 'EWC', name: 'Canada' },
    { symbol: 'EWU', name: 'United Kingdom' },
    { symbol: 'EWP', name: 'Spain' },
    { symbol: 'EWG', name: 'Germany' },
    { symbol: 'EWD', name: 'Sweden' },
    { symbol: 'EWA', name: 'Australia' },
    { symbol: 'MCHI', name: 'China' },
    { symbol: 'EWJ', name: 'Japan' },
    { symbol: 'EWS', name: 'Singapore' },
    { symbol: 'INDA', name: 'India' },
    { symbol: 'EWZ', name: 'Brazil' },
    { symbol: 'EWW', name: 'Mexico' },
  ],
  assets: [
    { symbol: 'GLD', name: 'Gold' },
    { symbol: 'SLV', name: 'Silver' },
    { symbol: 'USO', name: 'Oil' },
    { symbol: 'UNG', name: 'Natural Gas' },
    { symbol: 'SHY', name: 'U.S. Treasuries' },
    { symbol: 'MUB', name: 'Municipals' },
    { symbol: 'TIP', name: 'TIPS' },
    { symbol: 'EMB', name: 'EM Govt Bonds' },
    { symbol: 'LQD', name: 'Corp Investment Grade' },
    { symbol: 'HYG', name: 'U.S. High Yield' },
  ],
  factors: [
    { symbol: 'VTV', name: 'Value' },
    { symbol: 'QUAL', name: 'Quality' },
    { symbol: 'MTUM', name: 'Momentum' },
    { symbol: 'VUG', name: 'Growth' },
    { symbol: 'VYM', name: 'High Dividend Yield' },
    { symbol: 'VIG', name: 'Dividend Growth' },
    { symbol: 'MGC', name: 'Large Cap' },
    { symbol: 'VO', name: 'Mid Cap' },
    { symbol: 'IJR', name: 'Small Cap' },
    { symbol: 'IWC', name: 'Micro Cap' },
  ],
};

// ---------------------------------------------------------------------------
// Yahoo Finance helper
// ---------------------------------------------------------------------------

async function fetchYahooChart(
  symbol: string,
  interval: string,
  range: string
): Promise<{
  price: number;
  previousClose: number;
  closes: number[];
}> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Yahoo ${res.status}`);

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No chart data');

  const meta = result.meta;
  const price: number = meta.regularMarketPrice ?? 0;
  const closes: number[] = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (c: number | null) => c !== null
  );

  let previousClose: number = meta.chartPreviousClose ?? meta.previousClose ?? 0;
  if (!previousClose && closes.length >= 2) {
    previousClose = closes[closes.length - 2];
  }

  return { price, previousClose, closes };
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

async function fetchIndices(): Promise<IndexData[]> {
  const results = await Promise.allSettled(
    INDICES.map(async (idx) => {
      const { price, previousClose, closes } = await fetchYahooChart(
        idx.symbol,
        '1wk',
        '2y'
      );

      const change = previousClose ? price - previousClose : 0;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;

      return {
        symbol: idx.symbol,
        name: idx.name,
        price,
        change,
        changePercent,
        sparkline: closes,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<IndexData> => r.status === 'fulfilled')
    .map((r) => r.value);
}

async function fetchEtfCategory(
  etfs: { symbol: string; name: string }[]
): Promise<EtfData[]> {
  const results = await Promise.allSettled(
    etfs.map(async (etf) => {
      const { price, previousClose } = await fetchYahooChart(etf.symbol, '1d', '1d');

      const change = previousClose ? price - previousClose : 0;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;

      return {
        symbol: etf.symbol,
        name: etf.name,
        price,
        change,
        changePercent,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<EtfData> => r.status === 'fulfilled')
    .map((r) => r.value);
}

async function fetchAllEtfs(): Promise<Record<string, EtfData[]>> {
  const [sectors, regions, assets, factors] = await Promise.all([
    fetchEtfCategory(ETF_CATEGORIES.sectors),
    fetchEtfCategory(ETF_CATEGORIES.regions),
    fetchEtfCategory(ETF_CATEGORIES.assets),
    fetchEtfCategory(ETF_CATEGORIES.factors),
  ]);

  return { sectors, regions, assets, factors };
}

async function fetchNews(): Promise<NewsItem[]> {
  try {
    const url =
      'https://feeds.finance.yahoo.com/rss/2.0/headline?s=SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GOOGL&region=US&lang=en-US';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const text = await res.text();

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items: NewsItem[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(text)) !== null && items.length < 15) {
      const block = match[1];

      const title = extractTag(block, 'title');
      const link = extractTag(block, 'link');
      const pubDate = extractTag(block, 'pubDate');
      const source = extractTag(block, 'source') || 'Yahoo Finance';

      if (title && link) {
        items.push({ title, link, pubDate: pubDate || '', source });
      }
    }

    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    return items;
  } catch {
    return [];
  }
}

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const plainMatch = plainRegex.exec(xml);
  if (plainMatch) return plainMatch[1].trim();

  return '';
}

async function fetchTopMovers(
  userId: string
): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  const watchlistEntries = await prisma.watchlist.findMany({
    where: { userId },
    include: {
      company: {
        select: {
          id: true,
          ticker: true,
          name: true,
        },
      },
    },
  });

  if (watchlistEntries.length === 0) {
    return { gainers: [], losers: [] };
  }

  const movers: Mover[] = [];

  for (const entry of watchlistEntries) {
    const recentPrices = await prisma.priceDaily.findMany({
      where: { companyId: entry.companyId },
      orderBy: { date: 'desc' },
      take: 2,
    });

    if (recentPrices.length < 2) continue;

    const latest = Number(recentPrices[0].close);
    const previous = Number(recentPrices[1].close);
    const change = latest - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

    movers.push({
      ticker: entry.company.ticker,
      name: entry.company.name,
      price: latest,
      change,
      changePercent,
    });
  }

  const sorted = [...movers].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter((m) => m.changePercent > 0).slice(0, 5);
  const losers = sorted
    .filter((m) => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  return { gainers, losers };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Indices, ETFs, and news don't require auth — fetch in parallel
  const [indices, etfs, news] = await Promise.all([
    fetchIndices(),
    fetchAllEtfs(),
    fetchNews(),
  ]);

  // Top movers require auth — optional
  let topMovers: { gainers: Mover[]; losers: Mover[] } | null = null;
  try {
    const session = await getSession();
    if (session) {
      topMovers = await fetchTopMovers(session.userId);
    }
  } catch {
    // Auth failed — return null for topMovers
  }

  return NextResponse.json({ indices, etfs, news, topMovers });
}
