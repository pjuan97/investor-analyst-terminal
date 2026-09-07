'use client';

import { useState } from 'react';
import type { QuarterlyReport } from '@prisma/client';
import { useTranslation } from '@/components/language-provider';

interface QuarterlyReportSectionProps {
  ticker: string;
  initialReport: QuarterlyReport | null;
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined) return '—';
  // Prisma Decimal fields serialize to strings via JSON — use parseFloat
  const num = parseFloat(String(value));
  if (isNaN(num)) return '—';
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function QuarterlyReportSection({
  ticker,
  initialReport,
}: QuarterlyReportSectionProps) {
  const { t } = useTranslation();
  const [report, setReport] = useState<QuarterlyReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segmentExpanded, setSegmentExpanded] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/company/${ticker}/quarterly`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch quarterly report');
        return;
      }

      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const hasNumbers =
    report &&
    (report.revenue !== null ||
      report.netIncome !== null ||
      report.eps !== null ||
      report.freeCashFlow !== null);

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-terminal-text">
          {t('quarterly.title')}
          {report && (
            <span className="ml-2 text-sm text-terminal-muted font-normal">
              Filed {formatDate(report.filingDate)}
            </span>
          )}
        </h3>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? t('quarterly.fetching') : t('quarterly.fetch')}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3 rounded-md alert-error text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-2 text-terminal-muted text-sm py-4">
          <div className="animate-spin h-4 w-4 border-2 border-terminal-muted border-t-terminal-accent rounded-full" />
          Downloading and parsing 10-Q from SEC EDGAR...
        </div>
      )}

      {/* No Report State */}
      {!report && !loading && !error && (
        <p className="text-terminal-muted text-sm py-4">
          {t('quarterly.empty')}
        </p>
      )}

      {/* Report Data */}
      {report && !loading && (
        <div className="space-y-4">
          {/* Period Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-terminal-accent/20 text-terminal-accent">
              Q{report.fiscalQuarter} FY{report.fiscalYear}
            </span>
            <span className="text-xs text-terminal-muted">
              Period ending {formatDate(report.periodEnd)}
            </span>
          </div>

          {/* Quarterly Numbers Table */}
          {hasNumbers && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="text-right">
                      Q{report.fiscalQuarter} FY{report.fiscalYear}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.revenue !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">Revenue</td>
                      <td className="text-right font-mono">
                        {formatCurrency(report.revenue)}
                      </td>
                    </tr>
                  )}
                  {report.netIncome !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">
                        Net Income
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(report.netIncome)}
                      </td>
                    </tr>
                  )}
                  {report.eps !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">EPS</td>
                      <td className="text-right font-mono">
                        ${Number(report.eps).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {report.freeCashFlow !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">
                        Free Cash Flow
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(report.freeCashFlow)}
                      </td>
                    </tr>
                  )}
                  {report.operatingCashFlow !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">
                        Operating Cash Flow
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(report.operatingCashFlow)}
                      </td>
                    </tr>
                  )}
                  {report.totalDebt !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">
                        Total Debt
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(report.totalDebt)}
                      </td>
                    </tr>
                  )}
                  {report.cash !== null && (
                    <tr>
                      <td className="text-terminal-text font-medium">Cash</td>
                      <td className="text-right font-mono">
                        {formatCurrency(report.cash)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* MD&A Section */}
          {typeof report.mdaText === 'string' && report.mdaText.trim().length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-terminal-text">
                Management Discussion &amp; Analysis (MD&amp;A)
              </h4>
              <div
                className="text-sm text-terminal-muted whitespace-pre-wrap leading-relaxed overflow-y-auto border border-terminal-border rounded-md p-4 bg-terminal-bg"
                style={{ maxHeight: '400px' }}
              >
                {report.mdaText}
              </div>
            </div>
          )}

          {/* Segment Information (Collapsible) */}
          {typeof report.segmentInfo === 'string' && report.segmentInfo.trim().length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setSegmentExpanded(!segmentExpanded)}
                className="flex items-center gap-2 text-sm font-semibold text-terminal-text hover:text-terminal-accent transition-colors"
              >
                <span
                  className="transition-transform"
                  style={{
                    display: 'inline-block',
                    transform: segmentExpanded
                      ? 'rotate(90deg)'
                      : 'rotate(0deg)',
                  }}
                >
                  ▸
                </span>
                Segment Information
              </button>
              {segmentExpanded && (
                <div
                  className="text-sm text-terminal-muted whitespace-pre-wrap leading-relaxed overflow-y-auto border border-terminal-border rounded-md p-4 bg-terminal-bg"
                  style={{ maxHeight: '300px' }}
                >
                  {report.segmentInfo}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
