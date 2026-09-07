'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Opportunity, OpportunityScan } from '@/lib/opportunities/types';
import {
  ExplainProviderDialog,
  type ExplainChoice,
} from './explain-provider-dialog';
import { useTranslation } from '@/components/language-provider';

// ============================================================================
// OPPORTUNITIES PANEL — deterministic triage, with optional AI narrative
// ============================================================================

const COLLAPSED_COUNT = 5;

function pct(v: number | null, digits = 1): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

function multiple(v: number | null): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}x`;
}

function toneClass(tone: 'positive' | 'neutral' | 'negative'): string {
  if (tone === 'positive') return 'badge-buy';
  if (tone === 'negative') return 'badge-sell';
  return 'badge-hold';
}

function scoreColor(score: number): string {
  if (score >= 60) return 'var(--color-success)';
  if (score >= 35) return 'var(--color-warning)';
  return 'rgb(var(--terminal-muted))';
}

function OpportunityRow({ opportunity, rank }: { opportunity: Opportunity; rank: number }) {
  const { t } = useTranslation();
  const o = opportunity;

  return (
    <div className="py-3 border-b border-terminal-border last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="text-sm font-mono text-terminal-muted w-5 shrink-0 pt-0.5">{rank}</div>

        <div className="min-w-0 flex-1">
          {/* Line 1 — identity + score */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/company/${o.ticker}`}
              className="font-medium text-terminal-accent hover:underline"
            >
              {o.ticker}
            </Link>
            <span className={`badge ${o.market === 'BVC' ? 'badge-market-bvc' : 'badge-market-us'}`}>
              {o.market === 'BVC' ? 'BVC' : 'Wall Street'}
            </span>
            <span className="text-sm text-terminal-muted truncate">{o.name}</span>

            <span className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-xs text-terminal-muted">{t('opp.score')}</span>
              <span
                className="text-sm font-mono font-semibold"
                style={{ color: scoreColor(o.score) }}
              >
                {o.score}
              </span>
            </span>
          </div>

          {/* Line 2 — what changed since last scan */}
          {o.deltas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {o.deltas.map((d) => (
                <span key={d.id} className={`badge ${toneClass(d.tone)}`} title={d.detail}>
                  {d.label}
                </span>
              ))}
            </div>
          )}

          {/* Line 3 — why it ranked here */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {o.signals.map((s) => (
              <span
                key={s.id}
                className={`badge ${toneClass(s.tone)}`}
                title={`${s.detail} (${s.points >= 0 ? '+' : ''}${s.points.toFixed(0)} pts)`}
              >
                {s.label}
              </span>
            ))}
          </div>

          {/* Line 4 — context. Ratios only: comparable across COP and USD. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-terminal-muted font-mono">
            <span>P/E {multiple(o.peRatio)}</span>
            <span>EV/FCF {multiple(o.evToFcf)}</span>
            <span>E.Yield {pct(o.earningsYield)}</span>
            <span>52s {pct(o.drawdownFromHigh)}</span>
            <span>30d {pct(o.priceChange30d)}</span>
            {o.rating && <span>{o.rating}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpportunitiesPanel() {
  const { t } = useTranslation();
  const [scan, setScan] = useState<OpportunityScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainedWith, setExplainedWith] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/opportunities', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('opp.scanError'));
        return;
      }
      setScan(data);
      // The narrative describes the previous ranking; drop it so the two are
      // never shown out of sync.
      setExplanation(null);
      setExplainedWith(null);
      setExplainError(null);
    } catch {
      setError(t('opp.scanError'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Runs on mount, so arriving at the dashboard after a batch refresh always
  // shows a scan of the freshly fetched data.
  useEffect(() => {
    runScan();
  }, [runScan]);

  const explain = async (choice: ExplainChoice) => {
    setExplaining(true);
    setExplainError(null);
    try {
      const res = await fetch('/api/opportunities/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          limit: 8,
          provider: choice.provider,
          // Present only when the user pasted one; it is not kept afterwards.
          ...(choice.apiKey ? { apiKey: choice.apiKey } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExplainError(data.error || t('opp.explainFailed'));
        return;
      }
      setExplanation(data.explanation);
      setExplainedWith(
        `${data.provider === 'gemini' ? 'Gemini' : 'Claude'}${
          data.usedOwnKey ? ` · ${t('opp.usedOwnKey')}` : ''
        }`
      );
    } catch {
      setExplainError(t('opp.explainFailed'));
    } finally {
      setExplaining(false);
    }
  };

  const opportunities = scan?.opportunities ?? [];
  const visible = expanded ? opportunities : opportunities.slice(0, COLLAPSED_COUNT);

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-baseline gap-3">
          <h3 className="card-header mb-0">{t('opp.title')}</h3>
          {scan && (
            <span className="text-xs text-terminal-muted">
              {t('opp.summary', {
                shown: opportunities.length,
                scanned: scan.scanned,
                hurdle: pct(scan.hurdleRate, 0),
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runScan}
            disabled={loading}
            className="btn btn-secondary text-sm py-1.5"
            title={t('opp.rescanTitle')}
          >
            {loading ? t('opp.rescanning') : t('opp.rescan')}
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            disabled={explaining || opportunities.length === 0}
            className="btn btn-primary text-sm py-1.5"
            title={t('opp.explainTitle')}
          >
            {explaining ? t('opp.explaining') : t('opp.explain')}
          </button>
        </div>
      </div>

      <p className="text-xs text-terminal-muted mb-3">
        {t('opp.subtitle')}
      </p>

      {error && <div className="alert-error rounded p-3 text-sm">{error}</div>}

      {!error && loading && !scan && (
        <div className="py-8 text-center text-terminal-muted text-sm">{t('opp.scanning')}</div>
      )}

      {!error && scan && opportunities.length === 0 && (
        <div className="py-8 text-center text-terminal-muted text-sm">
          {t('opp.noSignals', { n: scan.scanned })}
          {scan.skipped.length > 0 && (
            <div className="text-xs mt-2">
              {t('opp.needsRefresh', { n: scan.skipped.length })}
            </div>
          )}
        </div>
      )}

      {opportunities.length > 0 && (
        <>
          <div>
            {visible.map((o, i) => (
              <OpportunityRow key={o.companyId} opportunity={o} rank={i + 1} />
            ))}
          </div>

          {opportunities.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-3 text-sm text-terminal-accent hover:underline"
            >
              {expanded
                ? t('opp.showLess')
                : t('opp.showMore', { n: opportunities.length - COLLAPSED_COUNT })}
            </button>
          )}

          {scan && scan.skipped.length > 0 && (
            <p className="text-xs text-terminal-muted mt-3">
              {t('opp.excluded', {
                n: scan.skipped.length,
                tickers:
                  scan.skipped.slice(0, 4).map((s) => s.ticker).join(', ') +
                  (scan.skipped.length > 4 ? '…' : ''),
              })}
            </p>
          )}
        </>
      )}

      {explainError && (
        <div className="alert-error rounded p-3 text-sm mt-3">{explainError}</div>
      )}

      <ExplainProviderDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={explain}
      />

      {explanation && (
        <div className="mt-4 pt-4 border-t border-terminal-border">
          <div className="text-xs text-terminal-muted mb-2">
            {t('opp.explanationTitle')}
            {explainedWith ? ` · ${explainedWith}` : ''}
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-terminal-text [&_h2]:text-base [&_h3]:text-sm [&_table]:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
