'use client';

import { useState } from 'react';
import type { MetricsAnnual, PriceDaily } from '@prisma/client';
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
}

type ChartType = 'profitability' | 'returns' | 'valuation' | 'growth' | 'price';
type PriceRange = '90d' | '1y' | '3y' | '5y' | 'max';

export function MetricsTab({ metrics, prices }: MetricsTabProps) {
  const [chartType, setChartType] = useState<ChartType>('profitability');
  const [priceRange, setPriceRange] = useState<PriceRange>('1y');

  if (metrics.length === 0 && prices.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-terminal-muted">No metrics data available yet.</p>
      </div>
    );
  }

  // Prepare chart data
  const metricsData = [...metrics]
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map((m) => ({
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
    }));

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
                    tickFormatter={(v) =>
                      chartType === 'price'
                        ? `$${v}`
                        : chartType === 'valuation'
                        ? `${v}x`
                        : `${v}%`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#c9d1d9' }}
                    formatter={(value: number) => [
                      chartType === 'price'
                        ? `$${value?.toFixed(2)}`
                        : chartType === 'valuation'
                        ? `${value?.toFixed(2)}x`
                        : `${value?.toFixed(1)}%`,
                      '',
                    ]}
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
