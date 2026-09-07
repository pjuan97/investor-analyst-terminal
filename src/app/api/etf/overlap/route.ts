import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { callClaude, isClaudeConfigured } from '@/lib/analysis/claude-client';
import { serialize } from '@/lib/utils/serialize';

function formatAUM(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

interface Holding {
  symbol: string;
  name: string;
  weight: number;
}

interface SectorEntry {
  sector: string;
  weight: number;
}

// GET — Calculate overlap between two ETFs
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fund1Ticker = searchParams.get('fund1')?.toUpperCase();
    const fund2Ticker = searchParams.get('fund2')?.toUpperCase();

    if (!fund1Ticker || !fund2Ticker) {
      return NextResponse.json(
        { error: 'Both fund1 and fund2 query params are required' },
        { status: 400 }
      );
    }

    if (fund1Ticker === fund2Ticker) {
      return NextResponse.json(
        { error: 'Please select two different ETFs to compare' },
        { status: 400 }
      );
    }

    // Fetch both ETFs
    const [company1, company2] = await Promise.all([
      prisma.company.findUnique({
        where: { ticker: fund1Ticker },
        include: { etfDetails: true },
      }),
      prisma.company.findUnique({
        where: { ticker: fund2Ticker },
        include: { etfDetails: true },
      }),
    ]);

    if (!company1 || !company1.isEtf || !company1.etfDetails) {
      return NextResponse.json(
        { error: `ETF ${fund1Ticker} not found. Add it to your ETF Watchlist first.` },
        { status: 404 }
      );
    }

    if (!company2 || !company2.isEtf || !company2.etfDetails) {
      return NextResponse.json(
        { error: `ETF ${fund2Ticker} not found. Add it to your ETF Watchlist first.` },
        { status: 404 }
      );
    }

    const etf1 = company1.etfDetails;
    const etf2 = company2.etfDetails;

    const holdings1 = (etf1.topHoldings as unknown as Holding[]) || [];
    const holdings2 = (etf2.topHoldings as unknown as Holding[]) || [];
    const sectors1 = (etf1.sectorBreakdown as unknown as SectorEntry[]) || [];
    const sectors2 = (etf2.sectorBreakdown as unknown as SectorEntry[]) || [];

    // Build lookup map for fund2 holdings
    const fund2Map = new Map<string, Holding>();
    for (const h of holdings2) {
      fund2Map.set(h.symbol, h);
    }

    // Calculate overlapping holdings
    const topOverlapping: Array<{
      symbol: string;
      name: string;
      weightInFund1: number;
      weightInFund2: number;
      overlapWeight: number;
    }> = [];

    const fund1OnlyHoldings: Holding[] = [];

    for (const h1 of holdings1) {
      const h2 = fund2Map.get(h1.symbol);
      if (h2) {
        const overlapWeight = Math.min(h1.weight, h2.weight);
        topOverlapping.push({
          symbol: h1.symbol,
          name: h1.name,
          weightInFund1: h1.weight,
          weightInFund2: h2.weight,
          overlapWeight,
        });
      } else {
        fund1OnlyHoldings.push(h1);
      }
    }

    // Fund2 only holdings
    const overlappingSymbols = new Set(topOverlapping.map((h) => h.symbol));
    const fund2OnlyHoldings = holdings2.filter((h) => !overlappingSymbols.has(h.symbol));

    // Sort overlapping by overlap weight desc
    topOverlapping.sort((a, b) => b.overlapWeight - a.overlapWeight);

    // Overlap by weight
    const overlapByWeight = topOverlapping.reduce((sum, h) => sum + h.overlapWeight, 0);

    // Sector drift
    const allSectors = new Set([
      ...sectors1.map((s) => s.sector),
      ...sectors2.map((s) => s.sector),
    ]);

    const sectorDrift = Array.from(allSectors).map((sector) => {
      const s1 = sectors1.find((s) => s.sector === sector);
      const s2 = sectors2.find((s) => s.sector === sector);
      const fund1Weight = s1?.weight ?? 0;
      const fund2Weight = s2?.weight ?? 0;
      return {
        sector,
        fund1Weight,
        fund2Weight,
        drift: fund1Weight - fund2Weight,
      };
    });

    // Sort by abs(drift) desc
    sectorDrift.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    // Fund1 overweight: top holdings in fund1 not in fund2, or much heavier
    const fund1Overweight = [
      ...fund1OnlyHoldings.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
        diff: h.weight,
      })),
      ...topOverlapping
        .filter((h) => h.weightInFund1 > h.weightInFund2 * 1.5)
        .map((h) => ({
          symbol: h.symbol,
          name: h.name,
          weight: h.weightInFund1,
          diff: h.weightInFund1 - h.weightInFund2,
        })),
    ]
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10);

    // Fund2 overweight: top holdings in fund2 not in fund1, or much heavier
    const fund2Overweight = [
      ...fund2OnlyHoldings.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
        diff: h.weight,
      })),
      ...topOverlapping
        .filter((h) => h.weightInFund2 > h.weightInFund1 * 1.5)
        .map((h) => ({
          symbol: h.symbol,
          name: h.name,
          weight: h.weightInFund2,
          diff: h.weightInFund2 - h.weightInFund1,
        })),
    ]
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10);

    const result = {
      fund1: {
        ticker: fund1Ticker,
        name: company1.name,
        totalHoldings: holdings1.length,
        aum: etf1.netAssets ? Number(etf1.netAssets) : null,
        expenseRatio: etf1.expenseRatio ? Number(etf1.expenseRatio) : null,
        dividendYield: etf1.dividendYield ? Number(etf1.dividendYield) : null,
        portfolioTurnover: etf1.portfolioTurnover ? Number(etf1.portfolioTurnover) : null,
        inceptionDate: etf1.inceptionDate ? String(etf1.inceptionDate) : null,
        isLeveraged: etf1.isLeveraged ?? false,
        assetClass: etf1.assetClass ?? null,
        topSectors: sectors1.slice(0, 3).map((s) => ({ sector: s.sector, weight: s.weight })),
      },
      fund2: {
        ticker: fund2Ticker,
        name: company2.name,
        totalHoldings: holdings2.length,
        aum: etf2.netAssets ? Number(etf2.netAssets) : null,
        expenseRatio: etf2.expenseRatio ? Number(etf2.expenseRatio) : null,
        dividendYield: etf2.dividendYield ? Number(etf2.dividendYield) : null,
        portfolioTurnover: etf2.portfolioTurnover ? Number(etf2.portfolioTurnover) : null,
        inceptionDate: etf2.inceptionDate ? String(etf2.inceptionDate) : null,
        isLeveraged: etf2.isLeveraged ?? false,
        assetClass: etf2.assetClass ?? null,
        topSectors: sectors2.slice(0, 3).map((s) => ({ sector: s.sector, weight: s.weight })),
      },
      overlap: {
        byWeight: overlapByWeight,
        overlappingCount: topOverlapping.length,
        fund1OnlyCount: fund1OnlyHoldings.length,
        fund2OnlyCount: fund2OnlyHoldings.length,
      },
      topOverlapping,
      sectorDrift,
      fund1Overweight,
      fund2Overweight,
    };

    return NextResponse.json(serialize({ success: true, ...result }));
  } catch (error) {
    console.error('ETF overlap error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate ETF overlap' },
      { status: 500 }
    );
  }
}

// POST — Run AI analysis on ETF overlap
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'Claude API not configured. Set ANTHROPIC_API_KEY in your environment.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { fund1, fund2, overlapData } = body;

    if (!fund1 || !fund2 || !overlapData) {
      return NextResponse.json(
        { error: 'fund1, fund2, and overlapData are required' },
        { status: 400 }
      );
    }

    const systemPrompt = `[MODE=ETF_ONLY / MODO_COMPARISON_ETFs]

You are a specialized ETF analyst comparing two ETFs based on their holdings overlap data.

INPUTS: Pre-computed overlap data between two ETFs.

Your task:
1. Summarize the degree of overlap and what it means for diversification.
2. Highlight the most significant sector drift and its implications.
3. Identify which fund is more concentrated vs diversified.
4. Discuss the cost efficiency (expense ratios) relative to the overlap.
5. Provide scenarios where holding both makes sense vs where it's redundant.

RULES:
- No personalized buy/sell/hold recommendations.
- Educational tone.
- Use the provided data; supplement with web search for additional context about the ETFs.
- Always respond in the user's language.
- Mark reliability levels (High/Medium/Low) for key claims.`;

    const overlapPct = (overlapData.overlap.byWeight * 100).toFixed(1);

    const userMessage = `Compare these two ETFs based on their holdings overlap:

FUND 1: ${overlapData.fund1.name} (${overlapData.fund1.ticker})
- AUM: ${formatAUM(overlapData.fund1.aum)}
- Expense Ratio: ${overlapData.fund1.expenseRatio ? (overlapData.fund1.expenseRatio * 100).toFixed(2) + '%' : 'N/A'}
- Total Holdings Analyzed: ${overlapData.fund1.totalHoldings}

FUND 2: ${overlapData.fund2.name} (${overlapData.fund2.ticker})
- AUM: ${formatAUM(overlapData.fund2.aum)}
- Expense Ratio: ${overlapData.fund2.expenseRatio ? (overlapData.fund2.expenseRatio * 100).toFixed(2) + '%' : 'N/A'}
- Total Holdings Analyzed: ${overlapData.fund2.totalHoldings}

OVERLAP SUMMARY:
- Overlap by Weight: ${overlapPct}%
- Overlapping Holdings: ${overlapData.overlap.overlappingCount}
- ${fund1} Only: ${overlapData.overlap.fund1OnlyCount} holdings
- ${fund2} Only: ${overlapData.overlap.fund2OnlyCount} holdings

TOP OVERLAPPING HOLDINGS:
${overlapData.topOverlapping.slice(0, 15).map((h: { symbol: string; name: string; weightInFund1: number; weightInFund2: number; overlapWeight: number }) =>
  `- ${h.symbol} (${h.name}): ${(h.weightInFund1 * 100).toFixed(2)}% in ${fund1}, ${(h.weightInFund2 * 100).toFixed(2)}% in ${fund2}, overlap: ${(h.overlapWeight * 100).toFixed(2)}%`
).join('\n')}

SECTOR DRIFT (${fund1} weight - ${fund2} weight):
${overlapData.sectorDrift.map((s: { sector: string; fund1Weight: number; fund2Weight: number; drift: number }) =>
  `- ${s.sector}: ${fund1} ${(s.fund1Weight * 100).toFixed(1)}% vs ${fund2} ${(s.fund2Weight * 100).toFixed(1)}% (drift: ${(s.drift * 100).toFixed(1)}%)`
).join('\n')}

${fund1} OVERWEIGHT HOLDINGS:
${overlapData.fund1Overweight.slice(0, 5).map((h: { symbol: string; name: string; diff: number }) =>
  `- ${h.symbol} (${h.name}): +${(h.diff * 100).toFixed(2)}%`
).join('\n')}

${fund2} OVERWEIGHT HOLDINGS:
${overlapData.fund2Overweight.slice(0, 5).map((h: { symbol: string; name: string; diff: number }) =>
  `- ${h.symbol} (${h.name}): +${(h.diff * 100).toFixed(2)}%`
).join('\n')}

Please perform a full MODO_COMPARISON_ETFs analysis focusing on the overlap data, diversification implications, and scenarios for portfolio construction. Use web search for additional context about these ETFs.`;

    const analysis = await callClaude(systemPrompt, userMessage);

    return NextResponse.json({
      success: true,
      analysis: {
        content: analysis,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('ETF overlap analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate overlap analysis' },
      { status: 500 }
    );
  }
}
