'use client';

import { Fragment, useState } from 'react';
import type { FinancialStatementAnnual } from '@prisma/client';

interface FinancialsTabProps {
  financials: FinancialStatementAnnual[];
}

type Section = 'income' | 'balance' | 'cashflow';

export function FinancialsTab({ financials }: FinancialsTabProps) {
  const [section, setSection] = useState<Section>('income');

  if (financials.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-terminal-muted">No financial data available yet.</p>
        <p className="text-sm text-terminal-muted mt-2">
          Use the refresh button to fetch data from SEC EDGAR.
        </p>
      </div>
    );
  }

  // Sort by year descending
  const sortedData = [...financials].sort((a, b) => b.fiscalYear - a.fiscalYear);

  return (
    <div className="space-y-4">
      {/* Section Toggle */}
      <div className="flex gap-2">
        {[
          { id: 'income', label: 'Income Statement' },
          { id: 'balance', label: 'Balance Sheet' },
          { id: 'cashflow', label: 'Cash Flow' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id as Section)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              section === s.id
                ? 'bg-terminal-accent text-white'
                : 'bg-terminal-card text-terminal-muted hover:text-terminal-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="table-container">
        {section === 'income' && <IncomeStatementTable data={sortedData} />}
        {section === 'balance' && <BalanceSheetTable data={sortedData} />}
        {section === 'cashflow' && <CashFlowTable data={sortedData} />}
      </div>

      {/* Data Quality Notice */}
      <div className="text-xs text-terminal-muted">
        Data source: {sortedData[0]?.dataSource || 'Unknown'} |
        Quality: {sortedData[0]?.dataQuality || 'Unknown'}
      </div>
    </div>
  );
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'object' ? Number(value) : Number(value);
  if (isNaN(num)) return '—';

  // Format in millions/billions
  const abs = Math.abs(num);
  if (abs >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  } else if (abs >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  } else if (abs >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

function formatPerShare(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'object' ? Number(value) : Number(value);
  if (isNaN(num)) return '—';
  return `$${num.toFixed(2)}`;
}

function IncomeStatementTable({ data }: { data: FinancialStatementAnnual[] }) {
  const rows: RowConfig[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'costOfRevenue', label: 'Cost of Revenue' },
    { key: 'grossProfit', label: 'Gross Profit' },
    { key: 'operatingExpenses', label: 'Operating Expenses' },
    { key: 'operatingIncome', label: 'Operating Income' },
    { key: 'interestExpense', label: 'Interest Expense' },
    { key: 'netIncome', label: 'Net Income' },
    { key: 'eps', label: 'EPS (Basic)', format: 'perShare' },
    { key: 'epsDiluted', label: 'EPS (Diluted)', format: 'perShare' },
  ];

  return <FinancialTable data={data} rows={rows} />;
}

interface RowConfig {
  key: string;
  label: string;
  section?: string;
  format?: 'perShare' | 'number';
}

function BalanceSheetTable({ data }: { data: FinancialStatementAnnual[] }) {
  const rows: RowConfig[] = [
    { key: 'totalAssets', label: 'Total Assets', section: 'Assets' },
    { key: 'currentAssets', label: 'Current Assets' },
    { key: 'cash', label: 'Cash & Equivalents' },
    { key: 'receivables', label: 'Receivables' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'propertyPlantEquipment', label: 'PP&E' },
    { key: 'goodwill', label: 'Goodwill' },
    { key: 'totalLiabilities', label: 'Total Liabilities', section: 'Liabilities' },
    { key: 'currentLiabilities', label: 'Current Liabilities' },
    { key: 'shortTermDebt', label: 'Short-Term Debt' },
    { key: 'longTermDebt', label: 'Long-Term Debt' },
    { key: 'totalDebt', label: 'Total Debt' },
    { key: 'totalEquity', label: 'Shareholders\' Equity', section: 'Equity' },
    { key: 'retainedEarnings', label: 'Retained Earnings' },
  ];

  return <FinancialTable data={data} rows={rows} />;
}

function CashFlowTable({ data }: { data: FinancialStatementAnnual[] }) {
  const rows: RowConfig[] = [
    { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
    { key: 'capitalExpenditure', label: 'Capital Expenditure' },
    { key: 'freeCashFlow', label: 'Free Cash Flow' },
    { key: 'dividendsPaid', label: 'Dividends Paid' },
    { key: 'shareRepurchases', label: 'Share Repurchases' },
  ];

  return <FinancialTable data={data} rows={rows} />;
}

function FinancialTable({
  data,
  rows,
}: {
  data: FinancialStatementAnnual[];
  rows: RowConfig[];
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th className="sticky left-0 bg-terminal-card z-10">Metric</th>
          {data.map((year) => (
            <th key={year.fiscalYear} className="text-right">
              {year.fiscalYear}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Fragment key={row.key}>
            {row.section && (
              <tr>
                <td
                  colSpan={data.length + 1}
                  className="bg-terminal-bg text-terminal-muted font-medium text-xs uppercase tracking-wide pt-4"
                >
                  {row.section}
                </td>
              </tr>
            )}
            <tr>
              <td className="sticky left-0 bg-terminal-card text-terminal-text font-medium">
                {row.label}
              </td>
              {data.map((year) => {
                const value = (year as Record<string, unknown>)[row.key];
                const formatted =
                  row.format === 'perShare'
                    ? formatPerShare(value)
                    : formatNumber(value);

                return (
                  <td key={year.fiscalYear} className="text-right font-mono">
                    {formatted}
                  </td>
                );
              })}
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
