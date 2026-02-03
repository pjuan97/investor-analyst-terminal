# Investor Analyst Terminal

A web application for tracking and analyzing stock investments with automated recommendations based on classic investment models (Buffett, Greenblatt, Fisher).

## Features

- **Watchlist Management**: Track multiple stocks with real-time prices and recommendations
- **SEC EDGAR Integration**: Automatic fetching of financial statements from SEC filings
- **Investment Models**: Analysis using Buffett, Greenblatt Magic Formula, and Growth models
- **Daily Recommendations**: Automated BUY/HOLD/SELL ratings with confidence scores
- **Data Quality Tracking**: Transparency on data completeness and reliability

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Charts**: Recharts
- **Validation**: Zod

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### 1. Clone and Install

```bash
cd investor-analyst-terminal
npm install
```

### 2. Start Database

```bash
npm run docker:up
```

This starts a PostgreSQL container on port 5432.

### 3. Configure Environment

```bash
# .env is already created with default values for local development
# Update SEC_USER_AGENT with your email for SEC API compliance
```

### 4. Initialize Database

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:seed      # Seed demo data
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

- Email: `demo@example.com`
- Password: `demo1234`

## Project Structure

```
investor-analyst-terminal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (dashboard)/       # Protected pages
│   │   │   ├── watchlist/     # Main watchlist view
│   │   │   ├── company/[ticker]/ # Company detail view
│   │   │   └── settings/      # System settings
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── layout/           # Sidebar, Header
│   │   ├── watchlist/        # Watchlist components
│   │   ├── charts/           # Recharts wrappers
│   │   └── ui/               # Shared UI components
│   ├── lib/
│   │   ├── auth/             # Authentication logic
│   │   ├── db/               # Prisma client
│   │   ├── providers/        # Data providers
│   │   │   ├── sec/          # SEC EDGAR provider
│   │   │   ├── fmp/          # FMP provider (optional)
│   │   │   └── prices/       # Price providers (Stooq)
│   │   ├── models/           # Investment models
│   │   │   ├── buffett/
│   │   │   ├── greenblatt/
│   │   │   └── growth/
│   │   ├── metrics/          # Financial metrics calculations
│   │   └── utils/            # Shared utilities
│   └── types/                # TypeScript types
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed script
├── docker/
│   └── docker-compose.yml    # PostgreSQL container
└── tests/                    # Test files
```

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   SEC EDGAR     │────>│  Raw Documents   │────>│  Normalized    │
│   (Financials)  │     │  (JSON stored)   │     │  Financials    │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                         │
┌─────────────────┐                                      │
│   Stooq/FMP     │────────────────────────────────────>│
│   (Prices)      │                                      │
└─────────────────┘                                      ▼
                                                 ┌────────────────┐
                                                 │   Calculated   │
                                                 │    Metrics     │
                                                 └────────────────┘
                                                         │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                      ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
                      │   Buffett    │           │  Greenblatt  │           │   Growth     │
                      │    Model     │           │    Model     │           │   Model      │
                      └──────────────┘           └──────────────┘           └──────────────┘
                              │                           │                           │
                              └───────────────────────────┼───────────────────────────┘
                                                          ▼
                                                 ┌────────────────┐
                                                 │  Aggregated    │
                                                 │ Recommendation │
                                                 └────────────────┘
```

## SEC EDGAR Limitations

The SEC XBRL data has some challenges:

1. **Tag Variability**: Companies use different XBRL tags for the same concepts
2. **Missing Data**: Not all companies report all fields
3. **Historical Depth**: Some companies have limited historical data

The app handles these by:
- Mapping multiple possible tags per field
- Tracking data quality scores
- Showing warnings when data is incomplete

For better data quality, consider adding the FMP provider (requires API key).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | JWT signing secret |
| `SEC_USER_AGENT` | Yes | Your email for SEC API |
| `PRICE_PROVIDER` | No | "stooq" (default), "fmp", or "alpha_vantage" |
| `FMP_API_KEY` | No | Financial Modeling Prep API key |
| `CRON_SECRET` | No | Secret for protected cron endpoints |
| `ENABLE_CRON` | No | "true" to enable daily cron job |

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed demo data

npm run docker:up    # Start PostgreSQL
npm run docker:down  # Stop PostgreSQL

npm run test         # Run tests
npm run lint         # Run ESLint
```

## Roadmap / TODO

### Phase 1 (MVP) ✅
- [x] Project setup
- [x] Database schema
- [x] Authentication
- [x] SEC EDGAR provider
- [x] Price provider (Stooq)
- [x] Basic UI (watchlist, settings)

### Phase 2 (In Progress)
- [ ] Company detail page with tabs
- [ ] Metrics calculation engine
- [ ] Investment models implementation
- [ ] Daily recommendation generation
- [ ] Charts and visualizations

### Phase 3 (Future)
- [ ] FMP provider integration
- [ ] Email notifications
- [ ] Portfolio tracking
- [ ] Backtesting

## License

MIT
