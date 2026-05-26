import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;

    // Special handler: return distinct asset classes
    if (sp.get('assetClasses') === 'true') {
      const rows = await prisma.etfDetails.findMany({
        where: { assetClass: { not: null } },
        select: { assetClass: true },
        distinct: ['assetClass'],
        orderBy: { assetClass: 'asc' },
      });
      const assetClasses = rows
        .map((r) => r.assetClass)
        .filter(Boolean) as string[];
      return NextResponse.json({ assetClasses });
    }

    // ── Parse filter params ─────────────────────────────────
    const param = (key: string) => {
      const v = sp.get(key);
      if (v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const netAssetsMin = param('netAssetsMin');
    const netAssetsMax = param('netAssetsMax');
    const expenseRatioMin = param('expenseRatioMin');
    const expenseRatioMax = param('expenseRatioMax');
    const dividendYieldMin = param('dividendYieldMin');
    const dividendYieldMax = param('dividendYieldMax');
    const portfolioTurnoverMin = param('portfolioTurnoverMin');
    const portfolioTurnoverMax = param('portfolioTurnoverMax');
    const inceptionBefore = sp.get('inceptionBefore') || undefined;
    const inceptionAfter = sp.get('inceptionAfter') || undefined;
    const isLeveraged = sp.get('isLeveraged') || 'all';
    const assetClass = sp.get('assetClass') || undefined;
    const sortBy = sp.get('sortBy') || 'netAssets';
    const sortOrder = sp.get('sortDir') === 'asc' ? 'asc' : 'desc';

    // ── Build WHERE conditions ─────────────────────────────
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

    const addRange = (col: string, min?: number, max?: number, scale = 1) => {
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

    // Net assets: input in billions, stored as raw dollars
    addRange('e.net_assets', netAssetsMin, netAssetsMax, 1e9);

    // Expense ratio: input as %, stored as decimal
    addRange('e.expense_ratio', expenseRatioMin, expenseRatioMax, 0.01);

    // Dividend yield: input as %, stored as decimal
    addRange('e.dividend_yield', dividendYieldMin, dividendYieldMax, 0.01);

    // Portfolio turnover: input as %, stored as decimal
    addRange('e.portfolio_turnover', portfolioTurnoverMin, portfolioTurnoverMax, 0.01);

    // Inception date filters
    if (inceptionBefore) {
      conditions.push(`e.inception_date IS NOT NULL AND e.inception_date <= $${idx}`);
      params.push(inceptionBefore);
      idx++;
    }
    if (inceptionAfter) {
      conditions.push(`e.inception_date IS NOT NULL AND e.inception_date >= $${idx}`);
      params.push(inceptionAfter);
      idx++;
    }

    // Leveraged filter
    if (isLeveraged === 'yes') {
      conditions.push(`e.is_leveraged = true`);
    } else if (isLeveraged === 'no') {
      conditions.push(`e.is_leveraged = false`);
    }

    // Asset class
    if (assetClass && assetClass !== 'All') {
      conditions.push(`e.asset_class = $${idx}`);
      params.push(assetClass);
      idx++;
    }

    // ── Validate sortBy against allowed columns ──
    const sortColumnMap: Record<string, string> = {
      ticker: 'c.ticker',
      name: 'c.name',
      netAssets: 'e.net_assets',
      expenseRatio: 'e.expense_ratio',
      dividendYield: 'e.dividend_yield',
      portfolioTurnover: 'e.portfolio_turnover',
      inceptionDate: 'e.inception_date',
      isLeveraged: 'e.is_leveraged',
      assetClass: 'e.asset_class',
      category: 'e.category',
      numHoldings: '"numHoldings"',
    };

    const sortCol = sortColumnMap[sortBy] || 'e.net_assets';
    const direction = sortOrder.toUpperCase();

    const whereClause =
      conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    const rawSql = `
      SELECT
        c.ticker,
        c.name,
        c.sector,
        e.category,
        e.net_assets           AS "netAssets",
        e.expense_ratio        AS "expenseRatio",
        e.dividend_yield       AS "dividendYield",
        e.portfolio_turnover   AS "portfolioTurnover",
        e.inception_date       AS "inceptionDate",
        e.is_leveraged         AS "isLeveraged",
        e.asset_class          AS "assetClass",
        COALESCE(jsonb_array_length(e.top_holdings::jsonb), 0) AS "numHoldings"
      FROM companies c
      INNER JOIN etf_details e
        ON e.company_id = c.id
      WHERE c.is_etf = true
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
        } else if (val instanceof Date) {
          out[key] = val.toISOString();
        } else if (
          typeof val === 'string' &&
          key !== 'ticker' &&
          key !== 'name' &&
          key !== 'sector' &&
          key !== 'assetClass' &&
          key !== 'category' &&
          key !== 'inceptionDate'
        ) {
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
    console.error('ETF screener error:', error);
    return NextResponse.json(
      { error: 'Failed to run ETF screener' },
      { status: 500 }
    );
  }
}
