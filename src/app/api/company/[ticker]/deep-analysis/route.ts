import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { callClaude, isClaudeConfigured } from '@/lib/analysis/claude-client';
import {
  getDeepPromptBuilder,
  buildCombinedSummaryPrompt,
  DEEP_MODEL_IDS,
  type DeepAnalysisModel,
  type FinancialSummary,
  type FinancialYearData,
} from '@/lib/analysis/prompts';

interface DeepAnalysisRecord {
  [key: string]: string | undefined;
  summary?: string;
  generatedAt?: string;
}

interface LLMAnalysis {
  deep?: DeepAnalysisRecord;
  [key: string]: unknown;
}

// GET — Retrieve existing deep analysis
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

    const llmAnalysis = recommendation.llmAnalysis as LLMAnalysis | null;

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      deepAnalysis: llmAnalysis?.deep || null,
      claudeConfigured: isClaudeConfigured(),
    });
  } catch (error) {
    console.error('Deep analysis fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deep analysis' },
      { status: 500 }
    );
  }
}

// POST — Run deep analysis for selected models
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'Claude API not configured. Set ANTHROPIC_API_KEY in your environment.' },
        { status: 400 }
      );
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    const body = await request.json();
    const requestedModels: string[] = body.models || [];
    const hurdleRate: number = body.hurdleRate ?? 0.10;
    const nrr: number | undefined = body.nrr;

    // Validate models
    const validModels = requestedModels.filter((m) =>
      DEEP_MODEL_IDS.includes(m as DeepAnalysisModel)
    ) as DeepAnalysisModel[];

    if (validModels.length === 0) {
      return NextResponse.json(
        { error: 'No valid models selected' },
        { status: 400 }
      );
    }

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

    // Fetch last 5 years of financial statements + metrics
    const statements = await prisma.financialStatementAnnual.findMany({
      where: { companyId: company.id },
      orderBy: { fiscalYear: 'desc' },
      take: 5,
    });

    const allMetrics = await prisma.metricsAnnual.findMany({
      where: { companyId: company.id },
      orderBy: { fiscalYear: 'desc' },
      take: 5,
    });

    // Build a map of metrics by fiscal year for joining
    const metricsMap = new Map(allMetrics.map((m) => [m.fiscalYear, m]));

    const toNum = (v: unknown): number | null =>
      v != null ? Number(v) : null;

    // Build FinancialYearData array by merging statements + metrics per year
    const yearData: FinancialYearData[] = statements
      .sort((a, b) => a.fiscalYear - b.fiscalYear)
      .map((s) => {
        const m = metricsMap.get(s.fiscalYear);
        return {
          fiscalYear: s.fiscalYear,
          dataSource: s.dataSource,
          revenue: toNum(s.revenue),
          grossProfit: toNum(s.grossProfit),
          operatingIncome: toNum(s.operatingIncome),
          netIncome: toNum(s.netIncome),
          eps: toNum(s.eps),
          epsDiluted: toNum(s.epsDiluted),
          grossMargin: toNum(m?.grossMargin),
          operatingMargin: toNum(m?.operatingMargin),
          netMargin: toNum(m?.netMargin),
          totalAssets: toNum(s.totalAssets),
          totalEquity: toNum(s.totalEquity),
          totalDebt: toNum(s.totalDebt),
          cash: toNum(s.cash),
          operatingCashFlow: toNum(s.operatingCashFlow),
          freeCashFlow: toNum(s.freeCashFlow),
          capitalExpenditure: toNum(s.capitalExpenditure),
          roe: toNum(m?.roe),
          roic: toNum(m?.roic),
          debtToEquity: toNum(m?.debtToEquity),
          currentRatio: toNum(m?.currentRatio),
          interestCoverage: toNum(m?.interestCoverage),
          peRatio: toNum(m?.peRatio),
          pbRatio: toNum(m?.pbRatio),
          evToEbitda: toNum(m?.evToEbitda),
          earningsYield: toNum(m?.earningsYield),
          marketCap: toNum(m?.marketCap),
          revenueGrowth: toNum(m?.revenueGrowth),
          epsGrowth: toNum(m?.epsGrowth),
          fcfGrowth: toNum(m?.fcfGrowth),
          earningsYieldMF: toNum(m?.earningsYieldMF),
          returnOnCapitalMF: toNum(m?.returnOnCapitalMF),
          researchAndDevelopment: toNum(s.researchAndDevelopment),
          sellingGeneralAdmin: toNum(s.sellingGeneralAdmin),
          stockBasedCompensation: toNum(s.stockBasedCompensation),
          shareRepurchases: toNum(s.shareRepurchases),
        };
      });

    const financials: FinancialSummary = {
      yearsAvailable: yearData.length,
      data: yearData,
    };

    // Fetch latest quarterly report for MD&A context
    const latestQuarterly = await prisma.quarterlyReport.findFirst({
      where: { companyId: company.id },
      orderBy: [{ fiscalYear: 'desc' }, { fiscalQuarter: 'desc' }],
    });

    let quarterlyContext = '';
    if (latestQuarterly?.mdaText) {
      const qNum = latestQuarterly.fiscalQuarter;
      const qYear = latestQuarterly.fiscalYear;
      const filedDate = new Date(latestQuarterly.filingDate).toISOString().split('T')[0];

      const numberLines: string[] = [];
      if (latestQuarterly.revenue) numberLines.push(`Revenue: ${Number(latestQuarterly.revenue).toLocaleString()}`);
      if (latestQuarterly.netIncome) numberLines.push(`Net Income: ${Number(latestQuarterly.netIncome).toLocaleString()}`);
      if (latestQuarterly.eps) numberLines.push(`EPS: ${Number(latestQuarterly.eps).toFixed(2)}`);
      if (latestQuarterly.freeCashFlow) numberLines.push(`FCF: ${Number(latestQuarterly.freeCashFlow).toLocaleString()}`);

      quarterlyContext = `\n\n=== LATEST QUARTERLY REPORT (10-Q) ===
Period: Q${qNum} FY${qYear}, Filed: ${filedDate}
${numberLines.length > 0 ? numberLines.join(' | ') + '\n' : ''}
=== MANAGEMENT DISCUSSION & ANALYSIS (MD&A) ===
${latestQuarterly.mdaText}`;
    }

    // Run each model SEQUENTIALLY
    const deepAnalysis: DeepAnalysisRecord = {};
    const errors: string[] = [];

    for (const modelId of validModels) {
      try {
        const promptBuilder = getDeepPromptBuilder(modelId);
        const promptParams = {
          companyName: company.name,
          ticker: upperTicker,
          exchange: company.exchange || 'Unknown',
          financials,
          hurdleRate,
          ...(modelId === 'seessel' && nrr != null ? { nrr } : {}),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { system, user } = (promptBuilder as (p: any) => { system: string; user: string })(promptParams);
        // Inject quarterly MD&A context before the analysis request
        const userWithQuarterly = quarterlyContext
          ? user.replace('=== ANALYSIS REQUEST ===', `${quarterlyContext}\n\n=== ANALYSIS REQUEST ===`)
          : user;
        const analysis = await callClaude(system, userWithQuarterly);
        deepAnalysis[modelId] = analysis;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${modelId}: ${errorMsg}`);
        console.error(`Deep analysis error for ${modelId}:`, err);
      }
    }

    // Generate combined summary if multiple models completed
    const completedModels = Object.keys(deepAnalysis).filter(
      (k) => k !== 'summary' && k !== 'generatedAt'
    );

    if (completedModels.length > 1) {
      try {
        const analysesForSummary: Record<string, string> = {};
        for (const key of completedModels) {
          analysesForSummary[key] = deepAnalysis[key]!;
        }
        const { system: summarySystem, user: summaryUser } = buildCombinedSummaryPrompt(
          company.name,
          upperTicker,
          analysesForSummary
        );
        deepAnalysis.summary = await callClaude(summarySystem, summaryUser);
      } catch (err) {
        errors.push(`summary: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    deepAnalysis.generatedAt = new Date().toISOString();

    // Store in DB — merge with existing llmAnalysis
    const existingLlm = (recommendation.llmAnalysis as LLMAnalysis) || {};
    const updatedLlm: LLMAnalysis = {
      ...existingLlm,
      deep: deepAnalysis,
    };

    await prisma.recommendationDaily.update({
      where: { id: recommendation.id },
      data: { llmAnalysis: updatedLlm as object },
    });

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      deepAnalysis,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Deep analysis generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate deep analysis' },
      { status: 500 }
    );
  }
}
