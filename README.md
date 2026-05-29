# Investor Analyst Terminal

A personal investment research terminal built with Next.js, PostgreSQL, and Claude AI. Analyze stocks and ETFs using multiple investment frameworks including Warren Buffett, Philip Fisher, Joel Greenblatt, Peter Lynch, and Adam Seessel's BMP model.

![Dashboard](docs/screenshots/dashboard.png)

## What This Does

- **Stock Analysis** — Fetch 10+ years of financial data, run 5 investment models automatically, and generate AI-powered deep analysis reports
- **ETF Analysis** — Track ETFs with expense ratio, holdings, sector breakdown, and AI analysis using the 11-factor ETF framework
- **Dashboard** — Live market indices, sector ETF performance, top movers from your watchlist, and market news
- **Screener** — Filter stocks and ETFs by fundamental metrics
- **Earnings Calendar** — Track upcoming earnings for any company
- **Peer Comparison** — Compare companies in the same sector side by side

## Investment Models

| Model | Framework | Key Metrics |
|---|---|---|
| Warren Buffett | Quality Value | ROE, ROIC, Gross Margin, FCF, Debt/Equity |
| Philip Fisher | Growth | Revenue growth, consistency, gross margin |
| Joel Greenblatt | Magic Formula | Earnings Yield, Return on Capital |
| Peter Lynch | GARP | PEG ratio, EPS growth, debt |
| Adam Seessel | BMP (Value 3.0) | FCF Margin, R&D%, SBC%, asset-light, EV/FCF |

## Tech Stack

- **Frontend** — Next.js 16, TypeScript, Tailwind CSS, Recharts
- **Backend** — Next.js API Routes, Prisma ORM
- **Database** — PostgreSQL 15 (via Docker)
- **AI** — Claude API (Anthropic) with web search
- **Data Sources** — FMP, SEC EDGAR, Yahoo Finance, Alpha Vantage

---

## Prerequisites

Before you start, make sure you have these installed:

| Tool | Version | Install |
|---|---|---|
| Node.js | v18+ | https://nodejs.org |
| Docker Desktop | Latest | https://docker.com/products/docker-desktop |
| Git | Latest | https://git-scm.com |

You also need **Claude Code** installed:
```bash
npm install -g @anthropic/claude-code
```

---

## API Keys Required

You need to obtain these API keys before setup. All have free tiers.

### 1. Anthropic (Claude AI) — Required for Deep Analysis
1. Go to https://console.anthropic.com
2. Create an account
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-`)

### 2. FMP (Financial Modeling Prep) — Required for financial data
1. Go to https://financialmodelingprep.com
2. Create a free account
3. Go to Dashboard → API Key
4. Copy your key

### 3. Alpha Vantage — Required for ETF data
1. Go to https://www.alphavantage.co/support/#api-key
2. Enter your email → Get Free API Key
3. Copy the key

### 4. SEC EDGAR — Free, no account needed
You just need to provide a User Agent string in this format:
`YourName YourEmail@example.com`

---

## Installation

### Step 1 — Clone the repository
```bash
git clone https://github.com/pjuan97/investor-analyst-terminal.git
cd investor-analyst-terminal
```

### Step 2 — Install dependencies
```bash
npm install
```

### Step 3 — Set up environment variables
```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```env
# Database (leave as-is if using Docker)
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/investor_terminal"

# Authentication (generate a random string, e.g. run: openssl rand -base64 32)
AUTH_SECRET="your-random-secret-here"
SESSION_DURATION_DAYS=7

# SEC EDGAR (free — use your name and email)
SEC_USER_AGENT="Your Name your@email.com"

# Financial data
FMP_API_KEY="your-fmp-key"
ALPHA_VANTAGE_API_KEY="your-alpha-vantage-key"

# AI Analysis
ANTHROPIC_API_KEY="your-anthropic-key"

# Leave these as-is
PRICE_PROVIDER="yahoo"
NODE_ENV="development"
```

### Step 4 — Start the database
Make sure Docker Desktop is running, then:
```bash
docker-compose up -d
```

Verify it's running:
```bash
docker ps
```
You should see a container named `investor_terminal_db`.

### Step 5 — Set up the database schema
```bash
npx prisma db push
```

### Step 6 — Start the application
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Step 7 — Create your account
1. Go to http://localhost:3000
2. Click "Sign Up"
3. Create your account (stored locally, no external service)

---

## Adding Your First Stock

1. Go to **Watchlist** in the sidebar
2. Type a ticker in the input field (e.g. `AAPL`)
3. Click **Add Ticker**
4. Wait for the initial data fetch (~30 seconds)
5. Click the ticker to open the analysis page

To refresh data and run all investment models:
1. Check the box next to the ticker(s)
2. Click **Refresh Selected**
3. Wait for completion (~1-2 minutes per ticker)

---

## Adding Your First ETF

1. Go to **ETFs → Watchlist** in the sidebar
2. Type an ETF ticker (e.g. `VOO`, `QQQ`, `SPY`)
3. Click **Add ETF**
4. Data fetches automatically from Alpha Vantage and Yahoo Finance

---

## Features Overview

### Dashboard
Live market data that auto-refreshes every 60 seconds:
- S&P 500, Nasdaq, Dow Jones, Russell 2000 with 2-year sparklines
- Top Gainers and Losers from your watchlist
- Sector ETF performance table (Sectors, Regions, Assets, Factors tabs)
- Market news from Yahoo Finance RSS

### Stock Analysis Page
Each stock has 5 tabs:
- **Overview** — Price chart, key metrics, company description
- **Financials** — 10 years of income statement, balance sheet, cash flow
- **Metrics** — Visual charts for margins, returns, growth, R&D investment
- **Model Breakdown** — 5 investment model scores with BUY/HOLD/SELL
- **Peers** — Side-by-side comparison with same-sector companies in your watchlist

### Deep Analysis (AI-Powered)
In the Model Breakdown tab, scroll down to **Deep Analysis**:
1. Select one or more investment models
2. Enter your hurdle rate (e.g. 10%)
3. For Seessel model: optionally enter NRR % if available from IR materials
4. Click **Run Analysis**
5. Claude AI fetches additional data from the web and generates a complete report

Analysis is saved and persists between sessions.

### ETF Analysis Page
Each ETF has 4 tabs:
- **Overview** — Price chart, fund metrics with benchmarks, sector pie chart, holdings, news
- **Performance** — Period returns (1M to Max), risk metrics, volatility
- **ETF Score** — Cost Efficiency, Diversification, and Income scores
- **Deep Analysis** — Full 11-factor ETF analysis using the Seessel ETF framework

### ETF Overlap
Compare any two ETFs in your watchlist:
- Venn diagram showing overlap percentage
- Side-by-side metric comparison
- Sector drift chart
- Overlapping holdings table
- AI-powered comparison analysis

### Earnings Calendar
Track upcoming earnings reports:
- Toggle between All companies and Watchlist Only
- Color-coded EPS/Revenue actual vs estimated
- Surprise percentage calculation

---

## Data Sources & Limits

| Source | Used For | Free Tier Limit |
|---|---|---|
| FMP | Financial statements, earnings calendar | 250 requests/day |
| SEC EDGAR | Historical financials (10-K, 10-Q), MD&A | Unlimited (rate limited) |
| Yahoo Finance | Stock/ETF prices, market indices, news | Unlimited |
| Alpha Vantage | ETF profiles, holdings, sector breakdown | 25 requests/day |
| Anthropic Claude | Deep analysis, ETF analysis | Pay per use (~$0.10-0.30 per analysis) |

**Alpha Vantage limit note:** 25 requests/day means you can refresh ~25 ETFs per day. For a typical watchlist of 5-10 ETFs this is not a constraint.

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # All pages (dashboard, watchlist, screener, etc.)
│   └── api/                  # API endpoints
│       ├── company/[ticker]/ # Stock data, refresh, deep analysis
│       ├── etf/[ticker]/     # ETF data, refresh, analysis
│       ├── market/           # Dashboard indices + news
│       ├── screener/         # Stock screener
│       └── earnings-calendar/# Earnings calendar
├── components/
│   ├── company/tabs/         # Overview, Financials, Metrics, Models, Peers
│   ├── etf/                  # ETF tabs component
│   └── layout/               # Sidebar, Header
└── lib/
    ├── providers/            # FMP, SEC EDGAR, Yahoo Finance, Alpha Vantage
    ├── models/               # Investment model scoring (Buffett, Fisher, etc.)
    ├── analysis/prompts/     # System prompts for each investment model
    └── metrics.ts            # Financial metrics calculation
```

---

## Troubleshooting

**"Failed to add ticker"**
- Check that your FMP API key is correct in `.env`
- Verify Docker is running: `docker ps`
- Some tickers require FMP premium (e.g. use `GOOGL` not `GOOG`)

**"No data after Refresh"**
- FMP free tier has 250 requests/day limit
- SEC EDGAR rate limits requests — wait a few minutes and retry
- Check terminal logs for specific error messages

**Database connection error**
- Make sure Docker Desktop is running
- Run `docker-compose up -d` again
- Verify port 5434 is not in use: `lsof -i :5434`

**Deep Analysis not working**
- Verify `ANTHROPIC_API_KEY` is set in `.env`
- Check you have credits in your Anthropic account

---

## Recommended Starting Watchlist

If you're not sure where to start, these are good companies to analyze across different sectors:

**Tech:** AAPL, MSFT, GOOGL, NVDA, META
**Finance:** JPM, V, MA
**Healthcare:** JNJ, UNH
**Consumer:** PG, KO

**Recommended ETFs:** VOO (S&P 500), QQQ (Nasdaq 100), VTI (Total Market)

---

## License

MIT — feel free to use, modify, and share.

---

## Built With

- [Next.js](https://nextjs.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [Recharts](https://recharts.org)
- [Claude API](https://anthropic.com)
- [Financial Modeling Prep](https://financialmodelingprep.com)
