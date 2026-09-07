'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/language-provider';

// ============================================================================
// PROVIDER PICKER — choose who runs the explanation, and with which key
// ============================================================================

export type ExplainProvider = 'anthropic' | 'gemini';

export interface ExplainChoice {
  provider: ExplainProvider;
  /** Only set when the user chose to supply their own key. */
  apiKey?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (choice: ExplainChoice) => void;
}

type Mode = 'configured' | 'own';

export function ExplainProviderDialog({ isOpen, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [configured, setConfigured] = useState<Record<ExplainProvider, boolean>>({
    anthropic: false,
    gemini: false,
  });
  const [mode, setMode] = useState<Mode>('configured');
  const [provider, setProvider] = useState<ExplainProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset each time: the typed key is deliberately not remembered.
    setMode('configured');
    setApiKey('');
    setError(null);

    fetch('/api/opportunities/explain', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.configured) return;
        setConfigured(d.configured);
        setProvider(d.configured.anthropic ? 'anthropic' : 'gemini');
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const confirm = () => {
    if (mode === 'own') {
      if (apiKey.trim().length < 8) {
        setError(t('opp.dialog.invalidKey'));
        return;
      }
      onConfirm({ provider, apiKey: apiKey.trim() });
    } else {
      if (!configured[provider]) {
        setError(t('opp.dialog.providerUnavailable'));
        return;
      }
      onConfirm({ provider });
    }
    onClose();
  };

  const providerRadio = (value: ExplainProvider, label: string, note: string) => (
    <label
      key={value}
      className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
        provider === value
          ? 'border-terminal-accent bg-terminal-accent/10'
          : 'border-terminal-border hover:border-terminal-muted'
      }`}
    >
      <input
        type="radio"
        name="explain-provider"
        checked={provider === value}
        onChange={() => {
          setProvider(value);
          setError(null);
        }}
        className="mt-1"
      />
      <span>
        <span className="block text-sm text-terminal-text">{label}</span>
        <span className="block text-xs text-terminal-muted">{note}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-terminal-card border border-terminal-border rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-terminal-border">
          <h2 className="text-lg font-semibold text-terminal-text">
            {t('opp.dialog.title')}
          </h2>
          <p className="text-sm text-terminal-muted mt-1">
            {t('opp.dialog.subtitle')}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode */}
          <div className="space-y-2">
            <label
              className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                mode === 'configured'
                  ? 'border-terminal-accent bg-terminal-accent/10'
                  : 'border-terminal-border hover:border-terminal-muted'
              }`}
            >
              <input
                type="radio"
                name="explain-mode"
                checked={mode === 'configured'}
                onChange={() => {
                  setMode('configured');
                  setError(null);
                }}
                className="mt-1"
              />
              <span>
                <span className="block text-sm text-terminal-text">
                  {t('opp.dialog.useConfigured')}
                </span>
                <span className="block text-xs text-terminal-muted">
                  {t('opp.dialog.useConfiguredNote')}
                </span>
              </span>
            </label>

            <label
              className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                mode === 'own'
                  ? 'border-terminal-accent bg-terminal-accent/10'
                  : 'border-terminal-border hover:border-terminal-muted'
              }`}
            >
              <input
                type="radio"
                name="explain-mode"
                checked={mode === 'own'}
                onChange={() => {
                  setMode('own');
                  setError(null);
                }}
                className="mt-1"
              />
              <span>
                <span className="block text-sm text-terminal-text">{t('opp.dialog.useOwn')}</span>
                <span className="block text-xs text-terminal-muted">
                  {t('opp.dialog.useOwnNote')}
                </span>
              </span>
            </label>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-terminal-muted uppercase tracking-wider">
              {t('opp.dialog.provider')}
            </p>
            {providerRadio(
              'anthropic',
              t('opp.dialog.anthropic'),
              mode === 'configured' && !configured.anthropic
                ? t('opp.dialog.notConfigured')
                : t('opp.dialog.anthropicNote')
            )}
            {providerRadio(
              'gemini',
              t('opp.dialog.gemini'),
              mode === 'configured' && !configured.gemini
                ? t('opp.dialog.notConfigured')
                : t('opp.dialog.geminiNote')
            )}
          </div>

          {/* Key input */}
          {mode === 'own' && (
            <div>
              <label htmlFor="explain-api-key" className="label">
                {t('opp.dialog.keyLabel', {
                  provider: provider === 'anthropic' ? 'Anthropic' : 'Gemini',
                })}
              </label>
              <input
                id="explain-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError(null);
                }}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
                className="input font-mono text-sm"
              />
              <p className="text-xs text-terminal-muted mt-1">
                {t('opp.dialog.keyNote')}
              </p>
            </div>
          )}

          {error && <div className="alert-error rounded p-2 text-sm">{error}</div>}
        </div>

        <div className="p-4 border-t border-terminal-border flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary text-sm">
            {t('opp.dialog.cancel')}
          </button>
          <button onClick={confirm} className="btn btn-primary text-sm">
            {t('opp.dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
