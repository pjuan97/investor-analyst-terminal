import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 12);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo User',
    },
  });

  console.log('Created demo user:', demoUser.email);

  // Create some sample companies
  const companies = [
    {
      ticker: 'AAPL',
      cik: '0000320193',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      sector: 'Technology',
    },
    {
      ticker: 'MSFT',
      cik: '0000789019',
      name: 'Microsoft Corporation',
      exchange: 'NASDAQ',
      sector: 'Technology',
    },
    {
      ticker: 'BRK-B',
      cik: '0001067983',
      name: 'Berkshire Hathaway Inc.',
      exchange: 'NYSE',
      sector: 'Financials',
    },
    {
      ticker: 'JNJ',
      cik: '0000200406',
      name: 'Johnson & Johnson',
      exchange: 'NYSE',
      sector: 'Healthcare',
    },
    {
      ticker: 'KO',
      cik: '0000021344',
      name: 'The Coca-Cola Company',
      exchange: 'NYSE',
      sector: 'Consumer Staples',
    },
  ];

  for (const companyData of companies) {
    const company = await prisma.company.upsert({
      where: { ticker: companyData.ticker },
      update: {},
      create: companyData,
    });

    console.log('Created company:', company.ticker);

    // Add to demo user's watchlist
    await prisma.watchlist.upsert({
      where: {
        userId_companyId: {
          userId: demoUser.id,
          companyId: company.id,
        },
      },
      update: {},
      create: {
        userId: demoUser.id,
        companyId: company.id,
      },
    });

    console.log(`Added ${company.ticker} to demo watchlist`);
  }

  console.log('Seeding complete!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email: demo@example.com');
  console.log('  Password: demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
