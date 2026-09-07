'use client';

import { useEffect, useState } from 'react';

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
        setError('Ingresa una API key válida.');
        return;
      }
      onConfirm({ provider, apiKey: apiKey.trim() });
    } else {
      if (!configured[provider]) {
        setError('Ese proveedor no tiene API key configurada en el servidor.');
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
            ¿Con qué API key quieres analizar?
          </h2>
          <p className="text-sm text-terminal-muted mt-1">
            Este análisis usa ~1.000 tokens de entrada, así que cabe de sobra en
            el plan gratuito de Gemini.
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
                  Usar una key ya configurada
                </span>
                <span className="block text-xs text-terminal-muted">
                  La que está en tu archivo .env
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
                <span className="block text-sm text-terminal-text">Usar otra API key</span>
                <span className="block text-xs text-terminal-muted">
                  Solo para esta corrida — no se guarda
                </span>
              </span>
            </label>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-terminal-muted uppercase tracking-wider">
              Proveedor
            </p>
            {providerRadio(
              'anthropic',
              'Anthropic (Claude)',
              mode === 'configured' && !configured.anthropic
                ? 'Sin key configurada'
                : 'Mejor calidad de razonamiento, tiene costo'
            )}
            {providerRadio(
              'gemini',
              'Google (Gemini)',
              mode === 'configured' && !configured.gemini
                ? 'Sin key configurada'
                : 'Tiene plan gratuito, suficiente para este análisis'
            )}
          </div>

          {/* Key input */}
          {mode === 'own' && (
            <div>
              <label htmlFor="explain-api-key" className="label">
                API key de {provider === 'anthropic' ? 'Anthropic' : 'Gemini'}
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
                Se envía solo para esta petición. No se guarda en el navegador ni
                en el servidor.
              </p>
            </div>
          )}

          {error && <div className="alert-error rounded p-2 text-sm">{error}</div>}
        </div>

        <div className="p-4 border-t border-terminal-border flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary text-sm">
            Cancelar
          </button>
          <button onClick={confirm} className="btn btn-primary text-sm">
            Aceptar y analizar
          </button>
        </div>
      </div>
    </div>
  );
}
