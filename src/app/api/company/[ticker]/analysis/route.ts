import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateModelAnalysis, isGeminiConfigured } from '@/lib/providers/gemini';
import { getPromptBuilder, MODEL_IDS, type PromptContext } from '@/lib/providers/gemini/prompts';
import type { ModelVotes } from '@/types';

interface LLMAnalysis {
  buffett?: string;
  greenblatt?: string;
  growth?: string;
  lynch?: string;
  generatedAt?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    // Find company and latest recommendation
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const recommendation = await prisma.recommendationDaily.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
    });

    if (!recommendation) {
      return NextResponse.json({ error: 'No recommendation found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      analysis: recommendation.llmAnalysis as LLMAnalysis | null,
      hasAnalysis: !!recommendation.llmAnalysis,
      geminiConfigured: isGeminiConfigured(),
    });
  } catch (error) {
    console.error('Analysis fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'Gemini API not configured. Set GEMINI_API_KEY in your environment.' },
        { status: 400 }
      );
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    // Find company
    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get latest recommendation
    const recommendation = await prisma.recommendationDaily.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: 'No recommendation found. Run a refresh first.' },
        { status: 404 }
      );
    }

    // Get latest metrics for context
    const metrics = await prisma.metricsAnnual.findFirst({
      where: { companyId: company.id },
      orderBy: { fiscalYear: 'desc' },
    });

    const modelVotes = recommendation.modelVotes as ModelVotes;
    const analysis: LLMAnalysis = {};
    const errors: string[] = [];

    // Build key metrics map
    const keyMetrics: Record<string, number | null> = {
      roe: metrics?.roe ? Number(metrics.roe) : null,
      roic: metrics?.roic ? Number(metrics.roic) : null,
      roa: metrics?.roa ? Number(metrics.roa) : null,
      debtToEquity: metrics?.debtToEquity ? Number(metrics.debtToEquity) : null,
      operatingMargin: metrics?.operatingMargin ? Number(metrics.operatingMargin) : null,
      netMargin: metrics?.netMargin ? Number(metrics.netMargin) : null,
      grossMargin: metrics?.grossMargin ? Number(metrics.grossMargin) : null,
      currentRatio: metrics?.currentRatio ? Number(metrics.currentRatio) : null,
      peRatio: metrics?.peRatio ? Number(metrics.peRatio) : null,
      pbRatio: metrics?.pbRatio ? Number(metrics.pbRatio) : null,
      evToEbitda: metrics?.evToEbitda ? Number(metrics.evToEbitda) : null,
      earningsYield: metrics?.earningsYield ? Number(metrics.earningsYield) : null,
      earningsYieldMF: metrics?.earningsYieldMF ? Number(metrics.earningsYieldMF) : null,
      returnOnCapitalMF: metrics?.returnOnCapitalMF ? Number(metrics.returnOnCapitalMF) : null,
      revenueGrowth: metrics?.revenueGrowth ? Number(metrics.revenueGrowth) : null,
      epsGrowth: metrics?.epsGrowth ? Number(metrics.epsGrowth) : null,
      fcfGrowth: metrics?.fcfGrowth ? Number(metrics.fcfGrowth) : null,
      fcfMargin: metrics?.fcfMargin ? Number(metrics.fcfMargin) : null,
    };

    // Generate analysis for each model sequentially (to avoid rate limits)
    for (const modelId of MODEL_IDS) {
      const vote = modelVotes[modelId];
      if (!vote) {
        continue;
      }

      const promptBuilder = getPromptBuilder(modelId);
      if (!promptBuilder) {
        continue;
      }

      const context: PromptContext = {
        companyName: company.name,
        ticker: upperTicker,
        vote,
        keyMetrics,
      };

      const prompt = promptBuilder(context);
      const result = await generateModelAnalysis(prompt);

      if (result.success && result.analysis) {
        analysis[modelId as keyof LLMAnalysis] = result.analysis;
      } else {
        errors.push(`${modelId}: ${result.error || 'Unknown error'}`);
      }

      // Small delay between requests to be respectful of rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    analysis.generatedAt = new Date().toISOString();

    // Store analysis in database
    await prisma.recommendationDaily.update({
      where: { id: recommendation.id },
      data: { llmAnalysis: analysis as object },
    });

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      analysis,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Analysis generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
