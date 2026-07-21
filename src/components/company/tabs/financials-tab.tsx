'use client';

import { Fragment, useState } from 'react';
import type { FinancialStatementAnnual, QuarterlyReport } from '@prisma/client';
import { QuarterlyReportSection } from '../QuarterlyReportSection';

interface FinancialsTabProps {
  financials: FinancialStatementAnnual[];
  ticker: string;
  latestQuarterly: QuarterlyReport | null;
  currency?: string;
}

type Section = 'income' | 'balance' | 'cashflow';

const SECTION_EXPLANATIONS: Record<Section, {
  title: string;
  what: string;
  keyMetrics: { name: string; description: string }[];
  tip: string;
}> = {
  income: {
    title: "Income Statement",
    what: "Shows revenue, expenses, and profit over a fiscal year. Think of it as a scorecard of how much money the company made and spent during the period.",
    keyMetrics: [
      { name: "Revenue", description: "Total sales — the starting point of the income statement." },
      { name: "Gross Profit", description: "Revenue minus cost of goods sold. What's left after paying to produce the product." },
      { name: "Operating Income", description: "Gross profit minus operating expenses (salaries, rent, marketing). The profit from core business operations." },
      { name: "Net Income", description: "The final 'bottom line' after all expenses, taxes, and interest. What the company actually earned." },
      { name: "EPS", description: "Net income divided by shares outstanding. How much each share earned." },
    ],
    tip: "Focus on the trend over multiple years. A company with growing revenue but shrinking net income is losing efficiency. EPS growth is more important than revenue growth for shareholders.",
  },
  balance: {
    title: "Balance Sheet",
    what: "A snapshot of what the company owns (assets), what it owes (liabilities), and what belongs to shareholders (equity) at a specific point in time. The fundamental equation: Assets = Liabilities + Equity.",
    keyMetrics: [
      { name: "Total Assets", description: "Everything the company owns — cash, inventory, equipment, intellectual property." },
      { name: "Total Liabilities", description: "Everything the company owes — debt, accounts payable, deferred revenue." },
      { name: "Total Equity", description: "Assets minus liabilities. The net worth belonging to shareholders." },
      { name: "Cash", description: "Liquid assets available immediately. High cash gives flexibility during downturns." },
      { name: "Total Debt", description: "Short and long-term borrowings. Compare to equity and EBITDA to assess leverage." },
    ],
    tip: "Compare total debt to total equity (Debt/Equity ratio). A company with more equity than debt has a conservative balance sheet. Watch for growing goodwill — it may indicate overpaid acquisitions.",
  },
  cashflow: {
    title: "Cash Flow Statement",
    what: "Shows how cash actually moved in and out of the business. Unlike the income statement, cash flow is much harder to manipulate with accounting choices. Many analysts consider this the most reliable financial statement.",
    keyMetrics: [
      { name: "Operating Cash Flow", description: "Cash generated from core business operations. Should consistently exceed net income for a healthy business." },
      { name: "Capital Expenditure", description: "Cash spent on physical assets (equipment, facilities). High capex businesses require constant reinvestment." },
      { name: "Free Cash Flow", description: "Operating cash flow minus capex. The real cash available to return to shareholders or fund growth." },
    ],
    tip: "If net income is consistently higher than operating cash flow, investigate why — it may indicate aggressive revenue recognition. Free cash flow is what Warren Buffett calls 'owner earnings.'",
  },
};

export function FinancialsTab({ financials, ticker, latestQuarterly, currency = 'USD' }: FinancialsTabProps) {
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

      {/* Section Explanation */}
      <div className="p-4 border border-terminal-border rounded-lg bg-terminal-bg/50 space-y-3 mb-4">
        <div>
          <h4 className="text-sm font-semibold text-terminal-text mb-1">
            {SECTION_EXPLANATIONS[section].title}
          </h4>
          <p className="text-xs text-terminal-muted leading-relaxed">
            {SECTION_EXPLANATIONS[section].what}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {SECTION_EXPLANATIONS[section].keyMetrics.map((m) => (
            <div key={m.name} className="flex gap-2 text-xs">
              <span className="text-terminal-text font-semibold whitespace-nowrap">{m.name}:</span>
              <span className="text-terminal-muted">{m.description}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-terminal-border">
          <p className="text-xs text-terminal-accent font-semibold mb-1">&#128161; What to look for</p>
          <p className="text-xs text-terminal-muted leading-relaxed">
            {SECTION_EXPLANATIONS[section].tip}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        {section === 'income' && <IncomeStatementTable data={sortedData} currency={currency} />}
        {section === 'balance' && <BalanceSheetTable data={sortedData} currency={currency} />}
        {section === 'cashflow' && <CashFlowTable data={sortedData} currency={currency} />}
      </div>

      {/* Data Quality Notice */}
      <DataSourceSummary financials={sortedData} />

      {/* Divider */}
      <div className="border-t border-terminal-border my-6" />

      {/* Quarterly 10-Q Section */}
      <QuarterlyReportSection ticker={ticker} initialReport={latestQuarterly} />
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

function formatPerShare(value: unknown, currency = 'USD'): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'object' ? Number(value) : Number(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
}

function IncomeStatementTable({ data, currency }: { data: FinancialStatementAnnual[]; currency: string }) {
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

  return <FinancialTable data={data} rows={rows} currency={currency} />;
}

interface RowConfig {
  key: string;
  label: string;
  section?: string;
  format?: 'perShare' | 'number';
}

function BalanceSheetTable({ data, currency }: { data: FinancialStatementAnnual[]; currency: string }) {
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

  return <FinancialTable data={data} rows={rows} currency={currency} />;
}

function CashFlowTable({ data, currency }: { data: FinancialStatementAnnual[]; currency: string }) {
  const rows: RowConfig[] = [
    { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
    { key: 'capitalExpenditure', label: 'Capital Expenditure' },
    { key: 'freeCashFlow', label: 'Free Cash Flow' },
    { key: 'dividendsPaid', label: 'Dividends Paid' },
    { key: 'shareRepurchases', label: 'Share Repurchases' },
  ];

  return <FinancialTable data={data} rows={rows} currency={currency} />;
}

function DataSourceSummary({ financials }: { financials: FinancialStatementAnnual[] }) {
  if (financials.length === 0) return null;

  const groups = new Map<string, { count: number; qualities: string[] }>();

  for (const f of financials) {
    const source = f.dataSource || 'unknown';
    const existing = groups.get(source) || { count: 0, qualities: [] };
    existing.count++;
    if (f.dataQuality) existing.qualities.push(f.dataQuality);
    groups.set(source, existing);
  }

  const sourceLabels: Record<string, string> = {
    fmp: 'FMP',
    sec_xbrl: 'SEC EDGAR',
  };

  const parts: string[] = [];
  for (const [source, { count, qualities }] of groups) {
    const label = sourceLabels[source] || source;
    // Find predominant quality
    const qualityCounts = new Map<string, number>();
    for (const q of qualities) {
      qualityCounts.set(q, (qualityCounts.get(q) || 0) + 1);
    }
    let predominant = 'unknown';
    let maxCount = 0;
    for (const [q, c] of qualityCounts) {
      if (c > maxCount) {
        predominant = q;
        maxCount = c;
      }
    }
    const yearLabel = count === 1 ? 'year' : 'years';
    parts.push(`${label} (${count} ${yearLabel}, ${predominant})`);
  }

  return (
    <div className="text-xs text-terminal-muted">
      Sources: {parts.join(' · ')}
    </div>
  );
}

function FinancialTable({
  data,
  rows,
  currency,
}: {
  data: FinancialStatementAnnual[];
  rows: RowConfig[];
  currency: string;
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
                    ? formatPerShare(value, currency)
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
