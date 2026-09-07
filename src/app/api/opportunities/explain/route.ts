import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { callClaude, isClaudeConfigured } from '@/lib/analysis/claude-client';
import {
  rankOpportunities,
  DEFAULT_HURDLE_RATE,
  type CompanyScanInput,
} from '@/lib/opportunities/score';
import type { Opportunity } from '@/lib/opportunities/types';

// ============================================================================
// POST /api/opportunities/explain — layer C: one LLM call for the whole list
// ============================================================================
//
// One request covers the entire shortlist rather than one per company, which
// is what keeps this cheap enough to sit behind a dashboard button.
//
// The ranking is recomputed server-side rather than accepted from the client:
// the prompt should only ever contain figures this app derived itself.

const SYSTEM_PROMPT = `Eres un analista de inversiones que ayuda a priorizar dónde investigar a fondo.

Recibes una tabla de empresas que un screener determinista ya marcó como interesantes, con sus señales activas y métricas. Tu trabajo NO es dar una recomendación de compra ni un análisis profundo — es ayudar a decidir CUÁL revisar primero.

Para cada empresa del top que te den:
- Explica en 2 o 3 frases por qué merece (o no) una mirada más detenida
- Señala explícitamente la principal razón para dudar o el riesgo más obvio
- Si las señales se contradicen entre sí, dilo

Al final, ordena las empresas por prioridad de revisión y justifica el primer lugar en una frase.

Reglas:
- Responde en español, en Markdown
- Sé concreto y apóyate en las cifras que te dieron; no inventes datos que no estén en la tabla
- Si la calidad de datos de una empresa es baja, adviértelo — sus métricas son menos confiables
- No des consejo financiero personalizado ni afirmes qué debe comprar el usuario
- Ojo con la moneda: las empresas marcadas BVC reportan en pesos colombianos (COP) y las de Wall Street en dólares. Los múltiplos (P/E, EV/FCF, earnings yield) son ratios y sí son comparables entre ambas; los precios absolutos no.`;

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatOpportunity(o: Opportunity, index: number): string {
  const pct = (v: number | null) => (v == null ? 'n/d' : `${(v * 100).toFixed(1)}%`);
  const x = (v: number | null) => (v == null ? 'n/d' : `${v.toFixed(1)}x`);

  const lines = [
    `### ${index + 1}. ${o.ticker} — ${o.name}`,
    `- Mercado: ${o.market === 'BVC' ? 'BVC (Colombia, reporta en COP)' : 'Wall Street (reporta en USD)'}`,
    `- Score del screener: ${o.score}/100`,
    `- Recomendación de los modelos: ${o.rating ?? 'n/d'} (confianza ${pct(o.confidence)})`,
    `- Año fiscal de las métricas: ${o.fiscalYear ?? 'n/d'}`,
    `- P/E: ${x(o.peRatio)} · EV/FCF: ${x(o.evToFcf)} · Earnings yield: ${pct(o.earningsYield)}`,
    `- Desde máximo 52s: ${pct(o.drawdownFromHigh)} · Cambio 30d: ${pct(o.priceChange30d)}`,
    `- Calidad de datos: ${pct(o.dataQuality)}`,
    `- Señales activas: ${o.signals.map((s) => `${s.label} (${s.detail})`).join('; ') || 'ninguna'}`,
  ];

  if (o.deltas.length > 0) {
    lines.push(`- Cambios desde el escaneo anterior: ${o.deltas.map((d) => d.detail).join('; ')}`);
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY no está configurada' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 15);
    const hurdleRate =
      Number.isFinite(Number(body.hurdleRate)) &&
      Number(body.hurdleRate) > 0 &&
      Number(body.hurdleRate) < 1
        ? Number(body.hurdleRate)
        : DEFAULT_HURDLE_RATE;

    const watchlist = await prisma.watchlist.findMany({
      where: { userId: session.userId },
      include: {
        company: {
          include: {
            metrics: { orderBy: { fiscalYear: 'desc' }, take: 10 },
            prices: { orderBy: { date: 'desc' }, take: 260 },
            recommendations: { orderBy: { date: 'desc' }, take: 2 },
          },
        },
      },
    });

    const inputs: CompanyScanInput[] = watchlist.map(({ company }) => {
      const [currentRec, previousRec] = company.recommendations;
      const toRec = (rec: (typeof company.recommendations)[number] | undefined) =>
        rec
          ? {
              rating: rec.rating as 'BUY' | 'HOLD' | 'SELL',
              confidence: num(rec.confidence) ?? 0,
              modelVotes: (rec.modelVotes ?? {}) as Record<
                string,
                { rating?: 'BUY' | 'HOLD' | 'SELL'; confidence?: number }
              >,
              fiscalYear: rec.metricsYear ?? null,
            }
          : null;

      return {
        companyId: company.id,
        ticker: company.ticker,
        name: company.name,
        currency: company.currency,
        dataQualityScore: num(company.dataQualityScore),
        metrics: company.metrics.map((m) => ({
          fiscalYear: m.fiscalYear,
          peRatio: num(m.peRatio),
          evToFcf: num(m.evToFcf),
          earningsYield: num(m.earningsYield),
          fcfMargin: num(m.fcfMargin),
          revenueGrowth: num(m.revenueGrowth),
          roic: num(m.roic),
        })),
        prices: company.prices.map((p) => ({ date: p.date, close: num(p.close) ?? 0 })),
        currentRec: toRec(currentRec),
        previousRec: toRec(previousRec),
      };
    });

    const scan = rankOpportunities(inputs, hurdleRate);
    const top = scan.opportunities.slice(0, limit);

    if (top.length === 0) {
      return NextResponse.json(
        { error: 'No hay oportunidades que explicar. Corre un refresh primero.' },
        { status: 400 }
      );
    }

    const userMessage = [
      `Hurdle rate del usuario: ${(hurdleRate * 100).toFixed(1)}%`,
      `Empresas analizadas en total: ${scan.scanned}`,
      '',
      `Top ${top.length} del screener:`,
      '',
      top.map(formatOpportunity).join('\n\n'),
    ].join('\n');

    const explanation = await callClaude(SYSTEM_PROMPT, userMessage, {
      webSearch: false,
      maxTokens: 4000,
    });

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      explained: top.map((o) => o.ticker),
      explanation,
    });
  } catch (error) {
    console.error('Opportunities explain error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to explain opportunities' },
      { status: 500 }
    );
  }
}
