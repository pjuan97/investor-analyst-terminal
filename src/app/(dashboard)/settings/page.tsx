import { checkProvidersHealth } from '@/lib/providers';
import { T } from '@/components/i18n-text';
import { ProviderStatus } from '@/components/settings/provider-status';
import type { TranslationKey } from '@/lib/i18n/translations';

// Server Component: it awaits provider health and reads process.env, so
// translation happens through the <T /> leaf and the client ProviderStatus
// rather than the context hook, which is client-only.
export default async function SettingsPage() {
  const health = await checkProvidersHealth();
  const fmpConfigured = !!process.env.FMP_API_KEY;
  const cronEnabled = process.env.ENABLE_CRON === 'true';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-terminal-text">
          <T k="settings.title" />
        </h1>
        <p className="text-terminal-muted mt-1">
          <T k="settings.subtitle" />
        </p>
      </div>

      {/* Provider Status */}
      <div className="card">
        <h2 className="card-header">
          <T k="settings.dataProviders" />
        </h2>
        <div className="space-y-4">
          <ProviderStatus
            name="SEC EDGAR"
            descriptionKey="settings.provider.secDesc"
            status={health.sec ? 'active' : 'error'}
            detailsKey="settings.provider.free"
          />
          <ProviderStatus
            name="Stooq"
            descriptionKey="settings.provider.stooqDesc"
            status={health.prices ? 'active' : 'error'}
            detailsKey="settings.provider.free"
          />
          <ProviderStatus
            name="Financial Modeling Prep"
            descriptionKey="settings.provider.fmpDesc"
            status={fmpConfigured ? 'active' : 'inactive'}
            detailsKey={
              (fmpConfigured
                ? 'settings.apiKeyConfigured'
                : 'settings.fmpOptional') as TranslationKey
            }
          />
        </div>
      </div>

      {/* Cron Status */}
      <div className="card">
        <h2 className="card-header">
          <T k="settings.automatedUpdates" />
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-terminal-text">
              <T k="settings.dailyUpdateJob" />
            </p>
            <p className="text-sm text-terminal-muted">
              <T k="settings.cronDesc" />
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-2 text-sm ${
                cronEnabled ? 'text-success' : 'text-terminal-muted'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cronEnabled ? 'bg-success-dot' : 'bg-gray-500'
                }`}
              />
              <T k={cronEnabled ? 'settings.enabled' : 'settings.disabled'} />
            </span>
            <RunUpdateButton />
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="card">
        <h2 className="card-header">
          <T k="settings.environment" />
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-terminal-muted">
              <T k="settings.mode" />
            </dt>
            <dd className="text-terminal-text font-mono">{process.env.NODE_ENV}</dd>
          </div>
          <div>
            <dt className="text-terminal-muted">
              <T k="settings.database" />
            </dt>
            <dd className="text-terminal-text font-mono">PostgreSQL</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function RunUpdateButton() {
  return (
    <form action="/api/cron/run" method="POST">
      <button type="submit" className="btn btn-secondary text-sm">
        <T k="settings.runUpdateNow" />
      </button>
    </form>
  );
}
