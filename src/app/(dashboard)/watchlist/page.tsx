import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { WatchlistTable } from '@/components/watchlist/watchlist-table';
import { AddTickerForm } from '@/components/watchlist/add-ticker-form';

export default async function WatchlistPage() {
  const session = await getSession();
  if (!session) return null;

  // Get user's watchlist with company data and latest recommendations
  const watchlistItems = await prisma.watchlist.findMany({
    where: { userId: session.userId },
    include: {
      company: {
        include: {
          recommendations: {
            orderBy: { date: 'desc' },
            take: 1,
          },
          prices: {
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  });

  // Transform data for the table
  const tableData = watchlistItems.map((item) => ({
    id: item.id,
    ticker: item.company.ticker,
    name: item.company.name,
    price: item.company.prices[0]?.close ? Number(item.company.prices[0].close) : null,
    priceDate: item.company.prices[0]?.date ?? null,
    recommendation: item.company.recommendations[0]?.rating ?? null,
    confidence: item.company.recommendations[0]?.confidence ? Number(item.company.recommendations[0].confidence) : null,
    lastUpdate: item.company.recommendations[0]?.createdAt ?? null,
    lastRefreshedAt: item.company.lastRefreshedAt ?? null,
    dataQuality: item.company.dataQualityScore ? Number(item.company.dataQualityScore) : null,
    currency: item.company.currency,
    // BVC-listed Colombian stocks use the `.CL` ticker suffix (see src/lib/providers/index.ts isBvcTicker)
    market: (item.company.ticker.endsWith('.CL') ? 'BVC' : 'WALL_STREET') as 'BVC' | 'WALL_STREET',
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-terminal-text">Watchlist</h1>
          <p className="text-terminal-muted mt-1">
            Track and analyze your investment opportunities
          </p>
        </div>
        <AddTickerForm userId={session.userId} />
      </div>

      {tableData.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-terminal-muted">
            Your watchlist is empty. Add a ticker to get started.
          </p>
        </div>
      ) : (
        <WatchlistTable data={tableData} />
      )}
    </div>
  );
}
