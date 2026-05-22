import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;

    // Special handler: return distinct sectors
    if (sp.get('sectors') === 'true') {
      const rows = await prisma.company.findMany({
        where: { sector: { not: null } },
        select: { sector: true },
        distinct: ['sector'],
        orderBy: { sector: 'asc' },
      });
      const sectors = rows.map((r) => r.sector).filter(Boolean) as string[];
      return NextResponse.json({ sectors });
    }

    // ── Parse filter params ─────────────────────────────────
    const param = (key: string) => {
      const v = sp.get(key);
      if (v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const minGrossMargin = param('minGrossMargin');
    const maxGrossMargin = param('maxGrossMargin');
    const minNetMargin = param('minNetMargin');
    const maxNetMargin = param('maxNetMargin');
    const minOperatingMargin = param('minOperatingMargin');
    const maxOperatingMargin = param('maxOperatingMargin');
    const minROE = param('minROE');
    const maxROE = param('maxROE');
    const minROIC = param('minROIC');
    const maxROIC = param('maxROIC');
    const minRevenueGrowth = param('minRevenueGrowth');
    const maxRevenueGrowth = param('maxRevenueGrowth');
    const minEpsGrowth = param('minEpsGrowth');
    const maxEpsGrowth = param('maxEpsGrowth');
    const minPE = param('minPE');
    const maxPE = param('maxPE');
    const minEVEBITDA = param('minEVEBITDA');
    const maxEVEBITDA = param('maxEVEBITDA');
    const minDebtToEquity = param('minDebtToEquity');
    const maxDebtToEquity = param('maxDebtToEquity');
    const minMarketCap = param('minMarketCap'); // in billions
    const maxMarketCap = param('maxMarketCap');
    const minQualityScore = param('minQualityScore');
    const maxQualityScore = param('maxQualityScore');
    const sector = sp.get('sector') || undefined;
    const recommendation = sp.get('recommendation') || undefined;
    const sortBy = sp.get('sortBy') || 'market_cap';
    const sortOrder = sp.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // ── Build WHERE conditions (raw SQL for latest-year subquery) ──
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1; // $1, $2, ...

    const addRange = (col: string, min?: number, max?: number, scale = 0.01) => {
      if (min !== undefined) {
        conditions.push(`${col} IS NOT NULL AND ${col} >= $${idx}`);
        params.push(min * scale);
        idx++;
      }
      if (max !== undefined) {
        conditions.push(`${col} IS NOT NULL AND ${col} <= $${idx}`);
        params.push(max * scale);
        idx++;
      }
    };

    // Profitability (input as %, stored as decimal 0-1)
    addRange('m.gross_margin', minGrossMargin, maxGrossMargin);
    addRange('m.net_margin', minNetMargin, maxNetMargin);
    addRange('m.operating_margin', minOperatingMargin, maxOperatingMargin);

    // Returns (input as %, stored as decimal)
    addRange('m.roe', minROE, maxROE);
    addRange('m.roic', minROIC, maxROIC);

    // Growth (input as %, stored as decimal)
    addRange('m.revenue_growth', minRevenueGrowth, maxRevenueGrowth);
    addRange('m.eps_growth', minEpsGrowth, maxEpsGrowth);

    // Valuation (raw multiples, no scaling)
    addRange('m.pe_ratio', minPE, maxPE, 1);
    addRange('m.ev_to_ebitda', minEVEBITDA, maxEVEBITDA, 1);

    // Leverage (raw ratio)
    addRange('m.debt_to_equity', minDebtToEquity, maxDebtToEquity, 1);

    // Market cap (input in billions, stored as raw number)
    if (minMarketCap !== undefined) {
      conditions.push(`m.market_cap IS NOT NULL AND m.market_cap >= $${idx}`);
      params.push(minMarketCap * 1e9);
      idx++;
    }
    if (maxMarketCap !== undefined) {
      conditions.push(`m.market_cap IS NOT NULL AND m.market_cap <= $${idx}`);
      params.push(maxMarketCap * 1e9);
      idx++;
    }

    // Quality score (input 0-1)
    addRange('m.quality_score', minQualityScore, maxQualityScore, 1);

    // Sector
    if (sector) {
      conditions.push(`c.sector = $${idx}`);
      params.push(sector);
      idx++;
    }

    // Recommendation
    if (recommendation && ['BUY', 'HOLD', 'SELL'].includes(recommendation)) {
      conditions.push(`r.rating = $${idx}`);
      params.push(recommendation);
      idx++;
    }

    // ── Validate sortBy against allowed columns ──
    const sortColumnMap: Record<string, string> = {
      ticker: 'c.ticker',
      name: 'c.name',
      sector: 'c.sector',
      gross_margin: 'm.gross_margin',
      operating_margin: 'm.operating_margin',
      net_margin: 'm.net_margin',
      roe: 'm.roe',
      roic: 'm.roic',
      roa: 'm.roa',
      pe_ratio: 'm.pe_ratio',
      ev_to_ebitda: 'm.ev_to_ebitda',
      pb_ratio: 'm.pb_ratio',
      revenue_growth: 'm.revenue_growth',
      eps_growth: 'm.eps_growth',
      fcf_growth: 'm.fcf_growth',
      debt_to_equity: 'm.debt_to_equity',
      interest_coverage: 'm.interest_coverage',
      market_cap: 'm.market_cap',
      enterprise_value: 'm.enterprise_value',
      quality_score: 'm.quality_score',
      earnings_yield_mf: 'm.earnings_yield_mf',
      return_on_capital_mf: 'm.return_on_capital_mf',
      recommendation: 'r.rating',
      confidence: 'r.confidence',
    };

    const sortCol = sortColumnMap[sortBy] || 'm.market_cap';
    const direction = sortOrder.toUpperCase();

    const whereClause =
      conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    const query = Prisma.sql`
      SELECT
        c.ticker,
        c.name,
        c.sector,
        c.exchange,
        m.fiscal_year        AS "fiscalYear",
        m.gross_margin        AS "grossMargin",
        m.operating_margin    AS "operatingMargin",
        m.net_margin          AS "netMargin",
        m.roe,
        m.roic,
        m.roa,
        m.pe_ratio            AS "peRatio",
        m.ev_to_ebitda        AS "evToEbitda",
        m.pb_ratio            AS "pbRatio",
        m.revenue_growth      AS "revenueGrowth",
        m.eps_growth          AS "epsGrowth",
        m.fcf_growth          AS "fcfGrowth",
        m.debt_to_equity      AS "debtToEquity",
        m.interest_coverage   AS "interestCoverage",
        m.market_cap          AS "marketCap",
        m.enterprise_value    AS "enterpriseValue",
        m.quality_score       AS "qualityScore",
        m.earnings_yield_mf   AS "earningsYieldMF",
        m.return_on_capital_mf AS "returnOnCapitalMF",
        m.data_completeness   AS "dataCompleteness",
        r.rating              AS "recommendation",
        r.confidence
      FROM companies c
      INNER JOIN metrics_annual m
        ON m.company_id = c.id
        AND m.fiscal_year = (
          SELECT MAX(m2.fiscal_year)
          FROM metrics_annual m2
          WHERE m2.company_id = c.id
        )
      LEFT JOIN recommendations_daily r
        ON r.company_id = c.id
        AND r.date = (
          SELECT MAX(r2.date)
          FROM recommendations_daily r2
          WHERE r2.company_id = c.id
        )
      WHERE 1=1
    `;

    // We need to build the full SQL string with conditions injected
    // Using $queryRawUnsafe because dynamic WHERE + ORDER BY
    const rawSql = `
      SELECT
        c.ticker,
        c.name,
        c.sector,
        c.exchange,
        m.fiscal_year        AS "fiscalYear",
        m.gross_margin        AS "grossMargin",
        m.operating_margin    AS "operatingMargin",
        m.net_margin          AS "netMargin",
        m.roe,
        m.roic,
        m.roa,
        m.pe_ratio            AS "peRatio",
        m.ev_to_ebitda        AS "evToEbitda",
        m.pb_ratio            AS "pbRatio",
        m.revenue_growth      AS "revenueGrowth",
        m.eps_growth          AS "epsGrowth",
        m.fcf_growth          AS "fcfGrowth",
        m.debt_to_equity      AS "debtToEquity",
        m.interest_coverage   AS "interestCoverage",
        m.market_cap          AS "marketCap",
        m.enterprise_value    AS "enterpriseValue",
        m.quality_score       AS "qualityScore",
        m.earnings_yield_mf   AS "earningsYieldMF",
        m.return_on_capital_mf AS "returnOnCapitalMF",
        m.data_completeness   AS "dataCompleteness",
        r.rating              AS "recommendation",
        r.confidence
      FROM companies c
      INNER JOIN metrics_annual m
        ON m.company_id = c.id
        AND m.fiscal_year = (
          SELECT MAX(m2.fiscal_year)
          FROM metrics_annual m2
          WHERE m2.company_id = c.id
        )
      LEFT JOIN recommendations_daily r
        ON r.company_id = c.id
        AND r.date = (
          SELECT MAX(r2.date)
          FROM recommendations_daily r2
          WHERE r2.company_id = c.id
        )
      WHERE 1=1
      ${whereClause}
      ORDER BY ${sortCol} ${direction} NULLS LAST
      LIMIT 100
    `;

    const rows = await prisma.$queryRawUnsafe(rawSql, ...params);

    // Convert Decimal/BigInt to plain numbers for JSON
    const data = (rows as Record<string, unknown>[]).map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (val === null || val === undefined) {
          out[key] = null;
        } else if (typeof val === 'bigint') {
          out[key] = Number(val);
        } else if (typeof val === 'object' && 'toNumber' in (val as object)) {
          out[key] = (val as { toNumber: () => number }).toNumber();
        } else if (typeof val === 'string' && key !== 'ticker' && key !== 'name' && key !== 'sector' && key !== 'exchange' && key !== 'recommendation') {
          const n = Number(val);
          out[key] = Number.isFinite(n) ? n : val;
        } else {
          out[key] = val;
        }
      }
      return out;
    });

    return NextResponse.json({ data, count: data.length });
  } catch (error) {
    console.error('Screener error:', error);
    return NextResponse.json(
      { error: 'Failed to run screener' },
      { status: 500 }
    );
  }
}
