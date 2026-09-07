'use client';

import { Fragment, useState } from 'react';
import type { FinancialStatementAnnual, QuarterlyReport } from '@prisma/client';
import { QuarterlyReportSection } from '../QuarterlyReportSection';
import { useTranslation } from '@/components/language-provider';

interface FinancialsTabProps {
  financials: FinancialStatementAnnual[];
  ticker: string;
  latestQuarterly: QuarterlyReport | null;
  currency?: string;
}

type Section = 'income' | 'balance' | 'cashflow';

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Educational copy for each statement. Built from translation keys rather than
 * a module-level constant so it follows the selected language.
 */
function sectionExplanations(t: Translate): Record<
  Section,
  {
    title: string;
    what: string;
    keyMetrics: { name: string; description: string }[];
    tip: string;
  }
> {
  return {
    income: {
      title: t('fin.income.title'),
      what: t('fin.income.what'),
      keyMetrics: [
        { name: t('fin.income.m1'), description: t('fin.income.m1d') },
        { name: t('fin.income.m2'), description: t('fin.income.m2d') },
        { name: t('fin.income.m3'), description: t('fin.income.m3d') },
        { name: t('fin.income.m4'), description: t('fin.income.m4d') },
        { name: t('fin.income.m5'), description: t('fin.income.m5d') },
      ],
      tip: t('fin.income.tip'),
    },
    balance: {
      title: t('fin.balance.title'),
      what: t('fin.balance.what'),
      keyMetrics: [
        { name: t('fin.balance.m1'), description: t('fin.balance.m1d') },
        { name: t('fin.balance.m2'), description: t('fin.balance.m2d') },
        { name: t('fin.balance.m3'), description: t('fin.balance.m3d') },
        { name: t('fin.balance.m4'), description: t('fin.balance.m4d') },
        { name: t('fin.balance.m5'), description: t('fin.balance.m5d') },
      ],
      tip: t('fin.balance.tip'),
    },
    cashflow: {
      title: t('fin.cashflow.title'),
      what: t('fin.cashflow.what'),
      keyMetrics: [
        { name: t('fin.cashflow.m1'), description: t('fin.cashflow.m1d') },
        { name: t('fin.cashflow.m2'), description: t('fin.cashflow.m2d') },
        { name: t('fin.cashflow.m3'), description: t('fin.cashflow.m3d') },
      ],
      tip: t('fin.cashflow.tip'),
    },
  };
}

export function FinancialsTab({ financials, ticker, latestQuarterly, currency = 'USD' }: FinancialsTabProps) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('income');
  const SECTION_EXPLANATIONS = sectionExplanations(t);

  if (financials.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-terminal-muted">{t('financials.noData')}</p>
        <p className="text-sm text-terminal-muted mt-2">
          {t('financials.noDataHint')}
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
          { id: 'income', label: t('financials.incomeStatement') },
          { id: 'balance', label: t('financials.balanceSheet') },
          { id: 'cashflow', label: t('financials.cashFlow') },
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
          <p className="text-xs text-terminal-accent font-semibold mb-1">&#128161; {t('financials.whatToLookFor')}</p>
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
  const { t } = useTranslation();
  const rows: RowConfig[] = [
    { key: 'revenue', label: t('fin.row.revenue') },
    { key: 'costOfRevenue', label: t('fin.row.costOfRevenue') },
    { key: 'grossProfit', label: t('fin.row.grossProfit') },
    { key: 'operatingExpenses', label: t('fin.row.operatingExpenses') },
    { key: 'operatingIncome', label: t('fin.row.operatingIncome') },
    { key: 'interestExpense', label: t('fin.row.interestExpense') },
    { key: 'netIncome', label: t('fin.row.netIncome') },
    { key: 'eps', label: t('fin.row.epsBasic'), format: 'perShare' },
    { key: 'epsDiluted', label: t('fin.row.epsDiluted'), format: 'perShare' },
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
  const { t } = useTranslation();
  const rows: RowConfig[] = [
    { key: 'totalAssets', label: t('fin.row.totalAssets'), section: t('fin.section.assets') },
    { key: 'currentAssets', label: t('fin.row.currentAssets') },
    { key: 'cash', label: t('fin.row.cash') },
    { key: 'receivables', label: t('fin.row.receivables') },
    { key: 'inventory', label: t('fin.row.inventory') },
    { key: 'propertyPlantEquipment', label: t('fin.row.ppe') },
    { key: 'goodwill', label: t('fin.row.goodwill') },
    { key: 'totalLiabilities', label: t('fin.row.totalLiabilities'), section: t('fin.section.liabilities') },
    { key: 'currentLiabilities', label: t('fin.row.currentLiabilities') },
    { key: 'shortTermDebt', label: t('fin.row.shortTermDebt') },
    { key: 'longTermDebt', label: t('fin.row.longTermDebt') },
    { key: 'totalDebt', label: t('fin.row.totalDebt') },
    { key: 'totalEquity', label: t('fin.row.totalEquity'), section: t('fin.section.equity') },
    { key: 'retainedEarnings', label: t('fin.row.retainedEarnings') },
  ];

  return <FinancialTable data={data} rows={rows} currency={currency} />;
}

function CashFlowTable({ data, currency }: { data: FinancialStatementAnnual[]; currency: string }) {
  const { t } = useTranslation();
  const rows: RowConfig[] = [
    { key: 'operatingCashFlow', label: t('fin.row.operatingCashFlow') },
    { key: 'capitalExpenditure', label: t('fin.row.capex') },
    { key: 'freeCashFlow', label: t('fin.row.freeCashFlow') },
    { key: 'dividendsPaid', label: t('fin.row.dividendsPaid') },
    { key: 'shareRepurchases', label: t('fin.row.shareRepurchases') },
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
      {parts.join(' · ')}
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
  const { t } = useTranslation();

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th className="sticky left-0 bg-terminal-card z-10">{t('financials.metric')}</th>
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
