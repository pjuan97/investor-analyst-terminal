import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSecQuarterlyFetcher } from '@/lib/providers/sec/quarterly-fetcher';
import crypto from 'crypto';

// POST — Fetch latest 10-Q from SEC EDGAR
export async function POST(
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

    // Fetch the latest 10-Q
    const fetcher = getSecQuarterlyFetcher();
    const report = await fetcher.fetchLatestQuarterlyReport(upperTicker);

    // Store raw HTML in raw_source_documents
    const rawUrl = `https://www.sec.gov/Archives/edgar/data/${report.accessionNumber}`;
    const urlHash = crypto
      .createHash('sha256')
      .update(rawUrl)
      .digest('hex')
      .slice(0, 64);

    await prisma.rawSourceDocument.upsert({
      where: {
        companyId_urlHash: {
          companyId: company.id,
          urlHash,
        },
      },
      update: {
        payload: {
          html: report.rawHtml,
          accessionNumber: report.accessionNumber,
        },
        fetchedAt: new Date(),
      },
      create: {
        companyId: company.id,
        provider: 'sec_edgar',
        documentType: '10-Q',
        url: rawUrl,
        urlHash,
        fetchedAt: new Date(),
        payload: {
          html: report.rawHtml,
          accessionNumber: report.accessionNumber,
        },
      },
    });

    // Upsert structured data in quarterly_reports
    const quarterlyReport = await prisma.quarterlyReport.upsert({
      where: {
        companyId_accessionNumber: {
          companyId: company.id,
          accessionNumber: report.accessionNumber,
        },
      },
      update: {
        filingDate: report.filingDate,
        periodEnd: report.periodEnd,
        fiscalYear: report.fiscalYear,
        fiscalQuarter: report.fiscalQuarter,
        formType: report.formType,
        revenue: report.revenue,
        grossProfit: report.grossProfit,
        operatingIncome: report.operatingIncome,
        netIncome: report.netIncome,
        eps: report.eps,
        operatingCashFlow: report.operatingCashFlow,
        freeCashFlow: report.freeCashFlow,
        totalDebt: report.totalDebt,
        cash: report.cash,
        mdaText: report.mdaText,
        segmentInfo: report.segmentInfo,
        riskFactors: report.riskFactors,
        fetchedAt: new Date(),
      },
      create: {
        companyId: company.id,
        accessionNumber: report.accessionNumber,
        filingDate: report.filingDate,
        periodEnd: report.periodEnd,
        fiscalYear: report.fiscalYear,
        fiscalQuarter: report.fiscalQuarter,
        formType: report.formType,
        revenue: report.revenue,
        grossProfit: report.grossProfit,
        operatingIncome: report.operatingIncome,
        netIncome: report.netIncome,
        eps: report.eps,
        operatingCashFlow: report.operatingCashFlow,
        freeCashFlow: report.freeCashFlow,
        totalDebt: report.totalDebt,
        cash: report.cash,
        mdaText: report.mdaText,
        segmentInfo: report.segmentInfo,
        riskFactors: report.riskFactors,
        fetchedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      report: quarterlyReport,
    });
  } catch (error) {
    console.error('Quarterly fetch error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to fetch quarterly report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — Return the latest quarterly report for the company
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

    const latestReport = await prisma.quarterlyReport.findFirst({
      where: { companyId: company.id },
      orderBy: [{ fiscalYear: 'desc' }, { fiscalQuarter: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      report: latestReport,
    });
  } catch (error) {
    console.error('Quarterly fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quarterly report' },
      { status: 500 }
    );
  }
}
