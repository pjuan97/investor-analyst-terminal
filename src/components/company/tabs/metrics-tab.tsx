'use client';

import { useState } from 'react';
import type { MetricsAnnual, PriceDaily, FinancialStatementAnnual } from '@prisma/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface MetricsTabProps {
  metrics: MetricsAnnual[];
  prices: PriceDaily[];
  financials?: FinancialStatementAnnual[];
}

type ChartType = 'profitability' | 'returns' | 'valuation' | 'growth' | 'cashflow' | 'leverage' | 'pershare' | 'magicformula' | 'rdAndSbc' | 'seesselMetrics' | 'price';
type PriceRange = '90d' | '1y' | '3y' | '5y' | 'max';

const CHART_EXPLANATIONS: Record<string, {
  what: string;
  variables: { name: string; description: string }[];
  howToRead: { positive: string; negative: string };
}> = {
  profitability: {
    what: "Shows how much of each dollar of revenue the company keeps at different stages of the business. Higher margins mean the company is more efficient at converting sales into profit.",
    variables: [
      { name: "Gross Margin", description: "Revenue minus cost of goods sold. Shows production efficiency." },
      { name: "Operating Margin", description: "Profit after operating expenses. Shows business efficiency before taxes and interest." },
      { name: "Net Margin", description: "Final profit after all expenses. The 'bottom line' as a % of revenue." },
    ],
    howToRead: {
      positive: "Margins trending upward over time. Gross margin above 40% is typically strong. Net margin above 15% is excellent for most industries.",
      negative: "Shrinking margins year over year. Large gap between gross and net margin may indicate high overhead or debt costs.",
    },
  },
  returns: {
    what: "Measures how efficiently the company generates profit from the capital invested in it. These are the metrics Warren Buffett uses most to evaluate business quality.",
    variables: [
      { name: "ROE", description: "Return on Equity — profit generated per dollar of shareholder equity. Above 15% is considered strong." },
      { name: "ROIC", description: "Return on Invested Capital — profit per dollar of total capital deployed. The most comprehensive return metric." },
      { name: "ROA", description: "Return on Assets — profit per dollar of total assets. Useful for asset-heavy businesses." },
    ],
    howToRead: {
      positive: "ROE consistently above 15%, ROIC above 10-12%. Stable or improving returns over time suggest a durable competitive advantage.",
      negative: "ROE high but ROIC low — may indicate excessive debt boosting returns artificially. Declining returns over time signal competitive pressure.",
    },
  },
  valuation: {
    what: "Shows how much the market is paying for each unit of earnings or assets. Lower values generally mean cheaper; higher values mean the market expects strong future growth.",
    variables: [
      { name: "P/E Ratio", description: "Price per dollar of earnings. Market average is ~15-20x. Growth companies often trade at 30x+." },
      { name: "P/B Ratio", description: "Price per dollar of book value (assets minus liabilities). Below 1x may indicate undervaluation." },
      { name: "EV/EBITDA", description: "Enterprise value relative to operating earnings. Below 10x is generally considered cheap; above 20x is expensive." },
    ],
    howToRead: {
      positive: "Ratios declining over time while earnings grow — means you're paying less for more. Low ratios relative to historical average may signal opportunity.",
      negative: "Ratios expanding faster than earnings growth. Very high P/E with slowing growth is a warning sign.",
    },
  },
  growth: {
    what: "Tracks how fast the company is growing its revenue, earnings per share, and free cash flow. Sustained growth is the primary driver of long-term stock returns.",
    variables: [
      { name: "Revenue Growth", description: "Year-over-year change in total sales. Shows if the business is expanding." },
      { name: "EPS Growth", description: "Year-over-year change in earnings per share. More important than revenue — shows if growth is profitable." },
      { name: "FCF Growth", description: "Year-over-year change in free cash flow. The most reliable growth metric — hard to manipulate." },
    ],
    howToRead: {
      positive: "Consistent double-digit growth across all three metrics. EPS and FCF growing faster than revenue indicates improving efficiency.",
      negative: "Revenue growing but EPS declining — profit is not keeping up. Negative FCF growth while revenue grows may signal cash burn issues.",
    },
  },
  cashflow: {
    what: "Shows the actual cash the business generates. Unlike accounting profit, cash flow is harder to manipulate and tells you if the company can fund its own growth.",
    variables: [
      { name: "FCF Margin", description: "Free cash flow as a percentage of revenue. Shows how much of each sales dollar becomes real cash." },
      { name: "FCF Yield", description: "Free cash flow relative to market cap. Higher yield means more cash generated per dollar of market value." },
      { name: "FCF/Share", description: "Free cash flow divided by shares outstanding. The per-share cash generation power." },
    ],
    howToRead: {
      positive: "Positive and growing FCF consistently. FCF margin above 15% is strong. FCF growing faster than net income indicates high earnings quality.",
      negative: "Negative FCF for multiple years is a red flag unless the company is in early growth stage. FCF well below net income may indicate aggressive accounting.",
    },
  },
  leverage: {
    what: "Measures the company's debt load and its ability to service that debt. High leverage amplifies both gains and losses and can be dangerous during downturns.",
    variables: [
      { name: "Debt/Equity", description: "Total debt relative to shareholder equity. Below 1x is conservative; above 2x deserves scrutiny." },
      { name: "Debt/EBITDA", description: "How many years of operating profit it would take to pay off all debt. Below 2x is healthy; above 4x is high." },
      { name: "Interest Coverage", description: "How many times operating profit covers interest payments. Below 3x is a warning sign." },
    ],
    howToRead: {
      positive: "Debt/Equity below 1x, Debt/EBITDA below 2x, Interest Coverage above 5x. Leverage declining over time as the company pays down debt.",
      negative: "Rising debt levels while earnings stagnate. Interest Coverage below 2x means a downturn could make debt servicing difficult.",
    },
  },
  pershare: {
    what: "Tracks value creation on a per-share basis. These metrics matter most because share dilution can mask real growth — a company can grow earnings while each share becomes worth less.",
    variables: [
      { name: "FCF/Share", description: "Free cash flow per share. Often considered more reliable than EPS as it reflects actual cash generation." },
    ],
    howToRead: {
      positive: "FCF/Share growing consistently over 5-10 years. Share count stable or declining (buybacks) means each share is worth more over time.",
      negative: "FCF/Share flat or declining while total FCF grows — indicates share dilution is eroding per-share value.",
    },
  },
  rdAndSbc: {
    what: "Shows R&D and Stock-Based Compensation as a percentage of revenue. Adam Seessel argues R&D should be capitalized (it's an investment), while SBC is a real cost that dilutes shareholders.",
    variables: [
      { name: "R&D % Revenue", description: "Research & Development spending relative to revenue. 10-30% is the sweet spot for moat maintenance in digital businesses." },
      { name: "SBC % Revenue", description: "Stock-Based Compensation as a percentage of revenue. Below 5% is acceptable; above 10% is a red flag for dilution." },
    ],
    howToRead: {
      positive: "Consistent R&D investment (10-30%) signals moat reinvestment. SBC declining as a percentage of revenue over time shows compensation discipline.",
      negative: "SBC consistently above 10% of revenue signals excessive dilution. R&D declining may indicate underinvestment in the business's competitive position.",
    },
  },
  seesselMetrics: {
    what: "Key metrics from Adam Seessel's BMP framework. Combines business quality indicators (Gross Margin, FCF Margin) with investment intensity (R&D). Ideal BMP candidates have high margins and meaningful R&D.",
    variables: [
      { name: "FCF Margin", description: "Free cash flow as a percentage of revenue. Above 20% is exceptional for asset-light businesses." },
      { name: "Gross Margin", description: "Revenue minus cost of goods sold. Above 60% signals a digital-era business with pricing power." },
      { name: "R&D % Revenue", description: "Investment in innovation relative to revenue. Shows commitment to maintaining competitive advantages." },
    ],
    howToRead: {
      positive: "FCF Margin above 20% with Gross Margin above 60% — a classic Seessel BMP business. R&D between 10-30% shows productive moat investment.",
      negative: "FCF Margin below 10% despite high Gross Margin suggests operational inefficiency. R&D above 30% may indicate unproductive spending.",
    },
  },
  magicformula: {
    what: "Joel Greenblatt's Magic Formula ranks companies on two factors: how cheap they are (Earnings Yield) and how good they are (Return on Capital). The goal is to buy good companies at cheap prices.",
    variables: [
      { name: "Earnings Yield", description: "EBIT divided by Enterprise Value. Higher = cheaper. Greenblatt prefers above 10%." },
      { name: "Return on Capital", description: "EBIT divided by (Net Working Capital + Net Fixed Assets). Higher = better business quality." },
    ],
    howToRead: {
      positive: "Both metrics high simultaneously — a good company at a cheap price. Earnings Yield above 10% with Return on Capital above 25% is a strong Magic Formula candidate.",
      negative: "High Earnings Yield but low Return on Capital — cheap but mediocre quality. High Return on Capital but low Earnings Yield — great business but expensive.",
    },
  },
};

export function MetricsTab({ metrics, prices, financials }: MetricsTabProps) {
  const [chartType, setChartType] = useState<ChartType>('profitability');
  const [priceRange, setPriceRange] = useState<PriceRange>('1y');

  if (metrics.length === 0 && prices.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-terminal-muted">No metrics data available yet.</p>
      </div>
    );
  }

  // Build a map of financial statements by fiscal year for R&D/SBC data
  const finByYear = new Map(
    (financials ?? []).map((f) => [f.fiscalYear, f])
  );

  // Prepare chart data
  const metricsData = [...metrics]
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map((m) => {
      const fin = finByYear.get(m.fiscalYear);
      const revenue = fin?.revenue ? Number(fin.revenue) : null;
      const rd = fin?.researchAndDevelopment ? Number(fin.researchAndDevelopment) : null;
      const sbc = fin?.stockBasedCompensation ? Number(fin.stockBasedCompensation) : null;

      return {
        year: m.fiscalYear,
        grossMargin: m.grossMargin ? Number(m.grossMargin) * 100 : null,
        operatingMargin: m.operatingMargin ? Number(m.operatingMargin) * 100 : null,
        netMargin: m.netMargin ? Number(m.netMargin) * 100 : null,
        roe: m.roe ? Number(m.roe) * 100 : null,
        roic: m.roic ? Number(m.roic) * 100 : null,
        roa: m.roa ? Number(m.roa) * 100 : null,
        peRatio: m.peRatio ? Number(m.peRatio) : null,
        pbRatio: m.pbRatio ? Number(m.pbRatio) : null,
        evToEbitda: m.evToEbitda ? Number(m.evToEbitda) : null,
        earningsYield: m.earningsYield ? Number(m.earningsYield) * 100 : null,
        revenueGrowth: m.revenueGrowth ? Number(m.revenueGrowth) * 100 : null,
        epsGrowth: m.epsGrowth ? Number(m.epsGrowth) * 100 : null,
        fcfGrowth: m.fcfGrowth ? Number(m.fcfGrowth) * 100 : null,
        // Cash Flow (percentages)
        fcfMarginValue: m.fcfMargin ? Number(m.fcfMargin) * 100 : null,
        fcfYieldValue: m.fcfYield ? Number(m.fcfYield) * 100 : null,
        fcfPerShareValue: m.fcfPerShare ? Number(m.fcfPerShare) : null,
        // Leverage (ratios)
        debtToEquityValue: m.debtToEquity ? Number(m.debtToEquity) : null,
        debtToEbitdaValue: m.debtToEbitda ? Number(m.debtToEbitda) : null,
        interestCoverageValue: m.interestCoverage ? Number(m.interestCoverage) : null,
        // Magic Formula (percentages)
        earningsYieldMFValue: m.earningsYieldMF ? Number(m.earningsYieldMF) * 100 : null,
        returnOnCapitalMFValue: m.returnOnCapitalMF ? Number(m.returnOnCapitalMF) * 100 : null,
        // R&D & SBC (percentages of revenue)
        rdPercentRevenue: rd !== null && revenue !== null && revenue > 0 ? (rd / revenue) * 100 : null,
        sbcPercentRevenue: sbc !== null && revenue !== null && revenue > 0 ? (sbc / revenue) * 100 : null,
      };
    });

  // Prepare price data based on selected range
  const getPriceSliceCount = (range: PriceRange): number => {
    switch (range) {
      case '90d': return 90;
      case '1y': return 252; // ~252 trading days per year
      case '3y': return 756;
      case '5y': return 1260;
      case 'max': return prices.length;
    }
  };

  const priceSliceCount = getPriceSliceCount(priceRange);
  const priceData = [...prices]
    .slice(0, priceSliceCount)
    .reverse()
    .map((p) => ({
      date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: priceRange === '90d' || priceRange === '1y' ? undefined : '2-digit' }),
      close: Number(p.close),
    }));

  const chartConfig: Record<ChartType, { title: string; lines: { key: string; color: string; name: string }[] }> = {
    profitability: {
      title: 'Profitability Margins',
      lines: [
        { key: 'grossMargin', color: '#3fb950', name: 'Gross Margin' },
        { key: 'operatingMargin', color: '#58a6ff', name: 'Operating Margin' },
        { key: 'netMargin', color: '#f85149', name: 'Net Margin' },
      ],
    },
    returns: {
      title: 'Return Metrics',
      lines: [
        { key: 'roe', color: '#3fb950', name: 'ROE' },
        { key: 'roic', color: '#58a6ff', name: 'ROIC' },
        { key: 'roa', color: '#d29922', name: 'ROA' },
      ],
    },
    valuation: {
      title: 'Valuation Ratios',
      lines: [
        { key: 'peRatio', color: '#58a6ff', name: 'P/E Ratio' },
        { key: 'pbRatio', color: '#3fb950', name: 'P/B Ratio' },
        { key: 'evToEbitda', color: '#d29922', name: 'EV/EBITDA' },
      ],
    },
    growth: {
      title: 'Growth Rates',
      lines: [
        { key: 'revenueGrowth', color: '#3fb950', name: 'Revenue Growth' },
        { key: 'epsGrowth', color: '#58a6ff', name: 'EPS Growth' },
        { key: 'fcfGrowth', color: '#d29922', name: 'FCF Growth' },
      ],
    },
    cashflow: {
      title: 'Cash Flow',
      lines: [
        { key: 'fcfMarginValue', color: '#22c55e', name: 'FCF Margin' },
        { key: 'fcfYieldValue', color: '#3b82f6', name: 'FCF Yield' },
        { key: 'fcfPerShareValue', color: '#f59e0b', name: 'FCF/Share' },
      ],
    },
    leverage: {
      title: 'Leverage & Coverage',
      lines: [
        { key: 'debtToEquityValue', color: '#ef4444', name: 'Debt/Equity' },
        { key: 'debtToEbitdaValue', color: '#f59e0b', name: 'Debt/EBITDA' },
        { key: 'interestCoverageValue', color: '#22c55e', name: 'Interest Coverage' },
      ],
    },
    pershare: {
      title: 'Per Share ($)',
      lines: [
        { key: 'fcfPerShareValue', color: '#3b82f6', name: 'FCF/Share' },
      ],
    },
    magicformula: {
      title: 'Magic Formula',
      lines: [
        { key: 'earningsYieldMFValue', color: '#22c55e', name: 'Earnings Yield' },
        { key: 'returnOnCapitalMFValue', color: '#3b82f6', name: 'Return on Capital' },
      ],
    },
    rdAndSbc: {
      title: 'R&D & SBC Investment (%)',
      lines: [
        { key: 'rdPercentRevenue', color: '#58a6ff', name: 'R&D % Revenue' },
        { key: 'sbcPercentRevenue', color: '#f59e0b', name: 'SBC % Revenue' },
      ],
    },
    seesselMetrics: {
      title: 'Seessel BMP Metrics',
      lines: [
        { key: 'fcfMarginValue', color: '#22c55e', name: 'FCF Margin %' },
        { key: 'grossMargin', color: '#3b82f6', name: 'Gross Margin %' },
        { key: 'rdPercentRevenue', color: '#f59e0b', name: 'R&D % Revenue' },
      ],
    },
    price: {
      title: 'Price History',
      lines: [{ key: 'close', color: '#58a6ff', name: 'Close Price' }],
    },
  };

  const currentConfig = chartConfig[chartType];
  const chartData = chartType === 'price' ? priceData : metricsData;
  const xKey = chartType === 'price' ? 'date' : 'year';

  return (
    <div className="space-y-4">
      {/* Chart Type Selection */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(chartConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setChartType(key as ChartType)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartType === key
                ? 'bg-terminal-accent text-white'
                : 'bg-terminal-card text-terminal-muted hover:text-terminal-text'
            }`}
          >
            {config.title}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">{currentConfig.title}</h3>
          {chartType === 'price' && (
            <div className="flex gap-1">
              {(['90d', '1y', '3y', '5y', 'max'] as PriceRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setPriceRange(range)}
                  className={`px-2 py-1 text-xs rounded ${
                    priceRange === range
                      ? 'bg-terminal-accent text-white'
                      : 'bg-terminal-bg text-terminal-muted hover:text-terminal-text'
                  }`}
                >
                  {range === 'max' ? 'Max' : range.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-80">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'growth' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey={xKey} stroke="#8b949e" fontSize={12} />
                  <YAxis stroke="#8b949e" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#c9d1d9' }}
                    formatter={(value: number) => [`${value?.toFixed(1)}%`, '']}
                  />
                  <Legend />
                  {currentConfig.lines.map((line) => (
                    <Bar
                      key={line.key}
                      dataKey={line.key}
                      name={line.name}
                      fill={line.color}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey={xKey} stroke="#8b949e" fontSize={12} />
                  <YAxis
                    stroke="#8b949e"
                    fontSize={12}
                    tickFormatter={(v) => {
                      if (chartType === 'price') return `$${v}`;
                      if (chartType === 'valuation') return `${v}x`;
                      if (chartType === 'leverage') return v.toFixed(1);
                      if (chartType === 'pershare') return `$${v.toFixed(2)}`;
                      return `${v}%`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#c9d1d9' }}
                    formatter={(value: number) => {
                      if (chartType === 'price') return [`$${value?.toFixed(2)}`, ''];
                      if (chartType === 'valuation') return [`${value?.toFixed(2)}x`, ''];
                      if (chartType === 'leverage') return [value?.toFixed(2), ''];
                      if (chartType === 'pershare') return [`$${value?.toFixed(2)}`, ''];
                      return [`${value?.toFixed(1)}%`, ''];
                    }}
                  />
                  <Legend />
                  {currentConfig.lines.map((line) => (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      stroke={line.color}
                      name={line.name}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-terminal-muted">
              No data available for this chart
            </div>
          )}
        </div>
      </div>

      {/* Chart Explanation */}
      {chartType !== 'price' && CHART_EXPLANATIONS[chartType] && (
        <div className="mt-4 p-4 border border-terminal-border rounded-lg bg-terminal-bg/50 space-y-3">
          <p className="text-sm text-terminal-muted leading-relaxed">
            {CHART_EXPLANATIONS[chartType].what}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {CHART_EXPLANATIONS[chartType].variables.map((v) => (
              <div key={v.name} className="flex gap-2 text-xs">
                <span className="text-terminal-text font-semibold whitespace-nowrap">{v.name}:</span>
                <span className="text-terminal-muted">{v.description}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-terminal-border">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-success">&#10003; Positive signals</p>
              <p className="text-xs text-terminal-muted leading-relaxed">
                {CHART_EXPLANATIONS[chartType].howToRead.positive}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-danger-semantic">&#10007; Warning signs</p>
              <p className="text-xs text-terminal-muted leading-relaxed">
                {CHART_EXPLANATIONS[chartType].howToRead.negative}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Table */}
      {metrics.length > 0 && chartType !== 'price' && (
        <div className="card">
          <h3 className="card-header">Historical Data</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  {currentConfig.lines.map((line) => (
                    <th key={line.key} className="text-right">
                      {line.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricsData.map((row) => (
                  <tr key={row.year}>
                    <td className="font-medium">{row.year}</td>
                    {currentConfig.lines.map((line) => {
                      const value = (row as Record<string, unknown>)[line.key] as number | null;
                      return (
                        <td key={line.key} className="text-right font-mono">
                          {value !== null
                            ? chartType === 'valuation'
                              ? `${value.toFixed(2)}x`
                              : chartType === 'leverage'
                              ? value.toFixed(2)
                              : chartType === 'pershare'
                              ? `$${value.toFixed(2)}`
                              : `${value.toFixed(1)}%`
                            : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
