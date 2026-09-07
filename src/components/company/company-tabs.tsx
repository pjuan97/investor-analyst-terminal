'use client';

import { useState } from 'react';
import type {
  Company,
  FinancialStatementAnnual,
  MetricsAnnual,
  PriceDaily,
  QuarterlyReport,
  RecommendationDaily,
} from '@prisma/client';
import { OverviewTab } from './tabs/overview-tab';
import { FinancialsTab } from './tabs/financials-tab';
import { MetricsTab } from './tabs/metrics-tab';
import { ModelsTab } from './tabs/models-tab';
import { PeersTab } from './tabs/peers-tab';
import { useTranslation } from '@/components/language-provider';
import type { TranslationKey } from '@/lib/i18n/translations';

type TabType = 'overview' | 'financials' | 'metrics' | 'models' | 'peers';

interface CompanyTabsProps {
  company: Company;
  financials: FinancialStatementAnnual[];
  metrics: MetricsAnnual[];
  prices: PriceDaily[];
  recommendations: RecommendationDaily[];
  latestQuarterly: QuarterlyReport | null;
}

const tabs: { id: TabType; labelKey: TranslationKey }[] = [
  { id: 'overview', labelKey: 'company.tab.overview' },
  { id: 'financials', labelKey: 'company.tab.financials' },
  { id: 'metrics', labelKey: 'company.tab.metrics' },
  { id: 'models', labelKey: 'company.tab.models' },
  { id: 'peers', labelKey: 'company.tab.peers' },
];

export function CompanyTabs({
  company,
  financials,
  metrics,
  prices,
  recommendations,
  latestQuarterly,
}: CompanyTabsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const latestRec = recommendations[0] || null;

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-terminal-border">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-terminal-accent text-terminal-accent'
                  : 'border-transparent text-terminal-muted hover:text-terminal-text'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <OverviewTab
            recommendation={latestRec}
            company={company}
            latestMetrics={metrics[0] || null}
            prices={prices}
            financials={financials}
          />
        )}
        {activeTab === 'financials' && (
          <FinancialsTab
            financials={financials}
            ticker={company.ticker}
            latestQuarterly={latestQuarterly}
            currency={company.currency}
          />
        )}
        {activeTab === 'metrics' && (
          <MetricsTab metrics={metrics} prices={prices} financials={financials} />
        )}
        {activeTab === 'models' && (
          <ModelsTab recommendation={latestRec} ticker={company.ticker} />
        )}
        {activeTab === 'peers' && (
          <PeersTab ticker={company.ticker} />
        )}
      </div>
    </div>
  );
}
