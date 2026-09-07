import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { serialize } from '@/lib/utils/serialize';
import { EtfTabs } from '@/components/etf/etf-tabs';

interface EtfPageProps {
  params: Promise<{ ticker: string }>;
}

// EtfTabs' props describe the post-JSON shape (Date -> string, Decimal -> string),
// which serialize()'s `T -> T` signature does not express — hence the untyped alias.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toClientProps = (obj: unknown): any => serialize(obj);

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
        company={toClientProps(company)}
        etfDetails={toClientProps(company.etfDetails)}
        prices={toClientProps(company.prices)}
      />
    </div>
  );
}
