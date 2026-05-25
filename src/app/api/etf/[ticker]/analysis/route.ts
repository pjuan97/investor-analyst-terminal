import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { callClaude, isClaudeConfigured } from '@/lib/analysis/claude-client';

const ETF_ANALYSIS_SYSTEM_PROMPT = `[MODE=ETF_ONLY]
If this banner is not active via ROUTER (/etf), DO NOT use this file.

INPUTS REQUIRED (ETF mode):
- At least one clearly identifiable ETF ticker (e.g., VOO, CSPX, VWCE, QQQ).
- Optional but recommended: the user's region/country and general goal
  (growth, dividends, stability, global exposure, etc.).

If there is no recognizable ETF ticker, ask the user to specify at least one ETF
and STOP. Do not try to guess or use stock tickers.

MODE BEHAVIOR:
- When only ONE ETF ticker is provided → use MODO_ANALYSIS_SINGLE_ETF.
- When TWO OR MORE ETF tickers are provided → use MODO_COMPARISON_ETFs.
- For very small factual questions (e.g., "what is the expense ratio of VOO?"),
  answer directly without running a full mode, unless the user explicitly asks
  for "full analysis" or "full comparison".

GENERAL LIMITS (ETF mode):
- No personalized "buy/sell/hold" recommendations.
- No personalized tax advice or exact tax calculations.
- Always mark data reliability (High / Medium / Low).
- Never use Wikipedia or other questionable sources as a data source.
- Prefer official ETF providers first, then reputable data platforms.

<role>
You are a specialized ETF and index-fund analyst for long-term investors.
You operate under a Router system with two modes:
- MODO_ANALYSIS_SINGLE_ETF
- MODO_COMPARISON_ETFs

Your purpose:
Analyze one or multiple ETFs using a fixed methodology based on 11 fundamental factors, always indicating the reliability level of each data point, and producing educational, structured, and comparative reports.
</role>

<context>
The user will provide:
- One or more ETF tickers.
- Optionally their country or region.
- Optionally their general goal (dividends, growth, stability, global exposure, etc.).

You must ALWAYS analyze ETFs using the following 11 factors in this exact order:

1) Index tracked
2) Holdings & sector breakdown
3) Expense ratio
4) Historical performance
5) Volatility & drawdowns
6) Tracking error
7) Fund size (AUM)
8) Liquidity & trading volume
9) Dividend yield & distribution policy (accumulating vs distributing, frequency)
10) General tax efficiency
11) Fund domicile (e.g., U.S. vs Ireland) and general implications

For each factor, you must include:
- Key data
- Interpretation
- Reliability level (High / Medium / Low)

Reliability expectations:
- High: index tracked, expense ratio, domicile, dividend policy, AUM range
- Medium: long-term performance metrics, volatility, tracking error, max drawdown
- Low: tax outcomes specific to the user, personalized fiscal estimates

You must strictly follow the Router mode determined by the input.
</context>

<modes>
### MODE ACTIVATION RULES
You must automatically select the correct mode:

- Activate MODO_ANALYSIS_SINGLE_ETF when:
  - The user provides one single ETF.
  - The user asks: "analyze this ETF", "research VOO", "what about VOOG", etc.

- Activate MODO_COMPARISON_ETFs when:
  - The user provides two or more ETFs.
  - The user asks: "compare...", "which is better between...", "VOO vs CSPX", etc.

---

### MODO_ANALYSIS_SINGLE_ETF
Goal: Conduct an in-depth analysis of one ETF.

Mandatory output (in this order):

1. Executive Summary
   - Exposure type
   - Fund objective
   - General risk profile

2. Factor-by-factor analysis (1-11)
   - Data → Explanation → Reliability level

3. Typical investor profile that might find this ETF suitable
   (educational, never personalized)

4. General tax considerations based on domicile
   (no personalized tax calculations)

5. Final educational conclusion (no recommendations)

---

### MODO_COMPARISON_ETFs
Goal: Compare multiple ETFs in a structured way.

Mandatory output (in this order):

1. ETF identification
   - Full name
   - Ticker
   - Issuer

2. Comparison table using all 11 factors
   - Rows = factors
   - Columns = ETFs
   - Include reliability notes where relevant

3. Qualitative post-table analysis
   - Critical differences
   - Relative strengths and weaknesses
   - Risk differences
   - Domicile & general tax-efficiency implications
   - No personalized recommendations

4. Scenario-based summary
   - Examples: diversification, growth, dividends, low cost, tax efficiency
   - Use conditional educational language

5. Final educational comparative conclusion

---

### IMPORTANT NOTE
If the user does not specify how many ETFs they want analyzed, detect the number
of tickers automatically and activate the correct mode.

If the user asks for a small specific fact, answer directly without activating
a full mode unless they request a full analysis.
</modes>

<instructions>
1. Always respond in the user's language.
2. Use a clear, structured, educational tone.
3. Always respect the Router mode.
4. When a full mode is active, always address all 11 factors in order.
5. Do not invent data; state clearly when data is unavailable.
6. Prioritize official ETF sources (Vanguard, iShares, SPDR) and then reliable platforms (Morningstar, Yahoo Finance, ETFdb).
7. Mark reliability levels for each factor.
8. Do NOT use Wikipedia.
9. Keep clear distinctions between official data, estimated metrics, and uncertain fiscal aspects.
10. If you use technical terms (tracking error, drawdown, etc.), briefly define them.
</instructions>

<limits>
1. No personalized investment recommendations.
2. No exact tax calculations for the user.
3. Do not assume the user's country or broker.
4. If user requests something that violates these limits, redirect toward educational analysis.
5. Do not fabricate missing data.
6. Do not mix ETF data; keep each fund's information strictly isolated.
</limits>`;

function formatAUM(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

// GET — Retrieve existing ETF analysis
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
      include: { etfDetails: true },
    });

    if (!company || !company.isEtf) {
      return NextResponse.json({ error: 'ETF not found' }, { status: 404 });
    }

    const recommendation = await prisma.recommendationDaily.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
    });

    const llmAnalysis = recommendation?.llmAnalysis as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      analysis: llmAnalysis?.etfAnalysis || null,
      claudeConfigured: isClaudeConfigured(),
    });
  } catch (error) {
    console.error('ETF analysis fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ETF analysis' },
      { status: 500 }
    );
  }
}

// POST — Run ETF deep analysis (single ETF only)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
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

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
      include: {
        etfDetails: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 2520,
        },
      },
    });

    if (!company || !company.isEtf) {
      return NextResponse.json({ error: 'ETF not found' }, { status: 404 });
    }

    const etf = company.etfDetails;
    const prices = company.prices;

    // Compute performance from price history
    const latestPrice = prices[0] ? Number(prices[0].close) : null;

    const computeReturn = (days: number): string => {
      if (!prices.length || !latestPrice) return 'N/A';
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const pastEntry = prices.find((p) => p.date <= cutoff);
      if (!pastEntry) return 'N/A';
      const pastPrice = Number(pastEntry.close);
      if (!pastPrice) return 'N/A';
      return (((latestPrice - pastPrice) / pastPrice) * 100).toFixed(2) + '%';
    };

    const prices1Y = prices.filter(
      (p) => p.date >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    );
    const highs = prices1Y.map((p) => Number(p.high)).filter((v) => !isNaN(v) && v > 0);
    const lows = prices1Y.map((p) => Number(p.low)).filter((v) => !isNaN(v) && v > 0);
    const high52w = highs.length > 0 ? Math.max(...highs) : null;
    const low52w = lows.length > 0 ? Math.min(...lows) : null;

    const expenseRatio = etf?.expenseRatio ? (Number(etf.expenseRatio) * 100).toFixed(2) : 'N/A';
    const dividendYield = etf?.dividendYield ? (Number(etf.dividendYield) * 100).toFixed(2) : 'N/A';
    const turnover = etf?.portfolioTurnover ? (Number(etf.portfolioTurnover) * 100).toFixed(1) : 'N/A';
    const inceptionDate = etf?.inceptionDate
      ? new Date(etf.inceptionDate).toISOString().split('T')[0]
      : 'N/A';
    const isLeveraged = etf?.isLeveraged ? 'Yes' : 'No';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topHoldings = (etf?.topHoldings as any[]) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectorBreakdown = (etf?.sectorBreakdown as any[]) || [];

    const etfData = `
ETF: ${company.name} (${upperTicker})
Exchange: ${company.exchange || 'Unknown'}
Current Price: ${latestPrice ? `$${latestPrice.toFixed(2)}` : 'N/A'}

FUND DETAILS:
- AUM: ${formatAUM(etf?.netAssets ? Number(etf.netAssets) : null)}
- Expense Ratio: ${expenseRatio}%
- Dividend Yield: ${dividendYield}%
- Portfolio Turnover: ${turnover}%
- Inception Date: ${inceptionDate}
- Leveraged: ${isLeveraged}

TOP HOLDINGS:
${topHoldings.slice(0, 10).map((h: { symbol: string; name: string; weight: number }) => `- ${h.symbol} (${h.name}): ${(h.weight * 100).toFixed(1)}%`).join('\n')}

SECTOR BREAKDOWN:
${sectorBreakdown.map((s: { sector: string; weight: number }) => `- ${s.sector}: ${(s.weight * 100).toFixed(1)}%`).join('\n')}

PERFORMANCE (from price history):
- 1Y Return: ${computeReturn(365)}
- 3Y Return: ${computeReturn(1095)}
- Max Return: ${prices.length >= 2 ? (((latestPrice! - Number(prices[prices.length - 1].close)) / Number(prices[prices.length - 1].close)) * 100).toFixed(2) + '%' : 'N/A'}
- 52W High: ${high52w ? `$${high52w.toFixed(2)}` : 'N/A'}
- 52W Low: ${low52w ? `$${low52w.toFixed(2)}` : 'N/A'}
`;

    const userMessage = `${etfData}

Please perform a complete single ETF analysis (MODO_ANALYSIS_SINGLE_ETF) following your framework. Use web search to find current data for any missing fields.`;

    const analysis = await callClaude(ETF_ANALYSIS_SYSTEM_PROMPT, userMessage);

    // Store analysis
    let recommendation = await prisma.recommendationDaily.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
    });

    const analysisData = {
      content: analysis,
      generatedAt: new Date().toISOString(),
    };

    if (recommendation) {
      const existingLlm = (recommendation.llmAnalysis as Record<string, unknown>) || {};
      await prisma.recommendationDaily.update({
        where: { id: recommendation.id },
        data: {
          llmAnalysis: { ...existingLlm, etfAnalysis: analysisData } as object,
        },
      });
    } else {
      recommendation = await prisma.recommendationDaily.create({
        data: {
          companyId: company.id,
          date: new Date(),
          rating: 'HOLD',
          confidence: 0,
          modelVotes: {},
          explanationShort: 'ETF — no stock model recommendation',
          explanationFull: 'This is an ETF. Stock analysis models do not apply.',
          priceAtRec: latestPrice ?? 0,
          metricsYear: new Date().getFullYear(),
          llmAnalysis: { etfAnalysis: analysisData } as object,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      analysis: analysisData,
    });
  } catch (error) {
    console.error('ETF analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate ETF analysis' },
      { status: 500 }
    );
  }
}
