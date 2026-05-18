import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CompanyHeader } from '@/components/company/company-header';
import { CompanyTabs } from '@/components/company/company-tabs';

interface CompanyPageProps {
  params: Promise<{ ticker: string }>;
}

// Helper to serialize Prisma objects (converts Decimal to number, BigInt to string)
function serialize<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const session = await getSession();
  if (!session) return null;

  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  // Fetch company with all related data
  const company = await prisma.company.findUnique({
    where: { ticker: upperTicker },
    include: {
      financialStatements: {
        orderBy: { fiscalYear: 'desc' },
        take: 15,
      },
      metrics: {
        orderBy: { fiscalYear: 'desc' },
        take: 15,
      },
      prices: {
        orderBy: { date: 'desc' },
        take: 2520, // ~10 years of trading days
      },
      recommendations: {
        orderBy: { date: 'desc' },
        take: 30,
      },
      watchlists: {
        where: { userId: session.userId },
        take: 1,
      },
    },
  });

  if (!company) {
    notFound();
  }

  // Check if in user's watchlist
  const isInWatchlist = company.watchlists.length > 0;

  // Get latest recommendation
  const latestRec = company.recommendations[0] || null;

  // Get latest price
  const latestPrice = company.prices[0] || null;

  return (
    <div className="space-y-6">
      <CompanyHeader
        company={{
          id: company.id,
          ticker: company.ticker,
          name: company.name,
          exchange: company.exchange,
          sector: company.sector,
          industry: company.industry,
        }}
        latestPrice={latestPrice ? Number(latestPrice.close) : null}
        priceDate={latestPrice?.date || null}
        recommendation={latestRec?.rating || null}
        confidence={latestRec ? Number(latestRec.confidence) : null}
        dataQuality={company.dataQualityScore ? Number(company.dataQualityScore) : null}
        isInWatchlist={isInWatchlist}
        userId={session.userId}
      />

      <CompanyTabs
        company={serialize(company)}
        financials={serialize(company.financialStatements)}
        metrics={serialize(company.metrics)}
        prices={serialize(company.prices)}
        recommendations={serialize(company.recommendations)}
      />
    </div>
  );
}
