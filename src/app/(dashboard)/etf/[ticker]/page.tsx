import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EtfTabs } from '@/components/etf/etf-tabs';

interface EtfPageProps {
  params: Promise<{ ticker: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export default async function EtfDetailPage({ params }: EtfPageProps) {
  const session = await getSession();
  if (!session) return null;

  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  const company = await prisma.company.findUnique({
    where: { ticker: upperTicker },
    include: {
      etfDetails: true,
      prices: {
        orderBy: { date: 'desc' },
        take: 2520,
      },
    },
  });

  if (!company || !company.isEtf) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <EtfTabs
        company={serialize(company)}
        etfDetails={serialize(company.etfDetails)}
        prices={serialize(company.prices)}
      />
    </div>
  );
}
