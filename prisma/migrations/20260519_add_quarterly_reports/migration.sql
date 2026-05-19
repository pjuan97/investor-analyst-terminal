-- CreateTable
CREATE TABLE "quarterly_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "filing_date" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "fiscal_quarter" INTEGER NOT NULL,
    "form_type" TEXT NOT NULL,
    "accession_number" TEXT NOT NULL,
    "revenue" DECIMAL(20,2),
    "gross_profit" DECIMAL(20,2),
    "operating_income" DECIMAL(20,2),
    "net_income" DECIMAL(20,2),
    "eps" DECIMAL(10,4),
    "operating_cash_flow" DECIMAL(20,2),
    "free_cash_flow" DECIMAL(20,2),
    "total_debt" DECIMAL(20,2),
    "cash" DECIMAL(20,2),
    "mda_text" TEXT,
    "mda_summary" TEXT,
    "segment_info" TEXT,
    "risk_factors" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "data_source" TEXT NOT NULL DEFAULT 'sec_edgar',

    CONSTRAINT "quarterly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quarterly_reports_company_id_fiscal_year_fiscal_quarter_idx" ON "quarterly_reports"("company_id", "fiscal_year", "fiscal_quarter");

-- CreateIndex
CREATE UNIQUE INDEX "quarterly_reports_company_id_accession_number_key" ON "quarterly_reports"("company_id", "accession_number");

-- AddForeignKey
ALTER TABLE "quarterly_reports" ADD CONSTRAINT "quarterly_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
