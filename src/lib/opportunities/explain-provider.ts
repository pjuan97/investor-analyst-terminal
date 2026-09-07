import { GoogleGenerativeAI } from '@google/generative-ai';
import { callClaude } from '@/lib/analysis/claude-client';

// ============================================================================
// EXPLANATION PROVIDERS — Anthropic or Gemini, with an optional key override
// ============================================================================
//
// The opportunity explanation is portable across providers because it uses no
// server-side tools: it only reasons over the table we build. (The per-investor
// deep analysis is NOT portable — it depends on Anthropic's `web_search`
// server tool, so it stays on Claude regardless of token budget.)
//
// Measured size: ~1k input tokens for a shortlist of 7-8 companies, output
// capped at 4k. That fits comfortably in Gemini's free tier.

export type ExplainProvider = 'anthropic' | 'gemini';

const GEMINI_MODEL = 'gemini-2.5-flash';

export interface ExplainOptions {
  provider: ExplainProvider;
  /**
   * Key supplied by the user for this request only. When absent the
   * server-configured key for the chosen provider is used.
   *
   * Never logged, never persisted — it lives only for the duration of the call.
   */
  apiKey?: string;
  maxTokens?: number;
}

/** Which providers can run without the user supplying a key. */
export function configuredProviders(): Record<ExplainProvider, boolean> {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  maxTokens: number
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens },
  });

  const result = await model.generateContent(userMessage);
  const text = result.response.text();

  if (!text) {
    throw new Error('Gemini devolvió una respuesta vacía');
  }

  return text;
}

/**
 * Runs the explanation against the chosen provider.
 *
 * Errors are rewritten to avoid echoing the request body back to the client —
 * provider errors can quote the payload, and the payload may contain the key.
 */
export async function explainWith(
  systemPrompt: string,
  userMessage: string,
  { provider, apiKey, maxTokens = 4000 }: ExplainOptions
): Promise<string> {
  const envKey =
    provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.GEMINI_API_KEY;

  const key = apiKey?.trim() || envKey;

  if (!key) {
    throw new Error(
      provider === 'anthropic'
        ? 'No hay API key de Anthropic configurada. Ingresa una para continuar.'
        : 'No hay API key de Gemini configurada. Ingresa una para continuar.'
    );
  }

  try {
    if (provider === 'gemini') {
      return await callGemini(systemPrompt, userMessage, key, maxTokens);
    }
    return await callClaude(systemPrompt, userMessage, {
      webSearch: false,
      maxTokens,
      apiKey: key,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    // Strip anything that looks like a key before the message reaches the UI.
    const safe = raw.replace(/(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,})/g, '***');
    const label = provider === 'anthropic' ? 'Anthropic' : 'Gemini';

    if (/401|403|API key|API_KEY_INVALID|unauthor/i.test(safe)) {
      throw new Error(`La API key de ${label} fue rechazada. Revísala e intenta de nuevo.`);
    }
    if (/429|quota|rate/i.test(safe)) {
      throw new Error(`${label} rechazó la petición por límite de uso. Intenta más tarde.`);
    }
    throw new Error(`Error de ${label}: ${safe.slice(0, 200)}`);
  }
}
