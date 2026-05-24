import { checkProvidersHealth } from '@/lib/providers';

export default async function SettingsPage() {
  const health = await checkProvidersHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-terminal-text">Settings</h1>
        <p className="text-terminal-muted mt-1">
          System configuration and data provider status
        </p>
      </div>

      {/* Provider Status */}
      <div className="card">
        <h2 className="card-header">Data Providers</h2>
        <div className="space-y-4">
          <ProviderStatus
            name="SEC EDGAR"
            description="Financial statements and company filings"
            status={health.sec ? 'active' : 'error'}
            details="Free, no API key required"
          />
          <ProviderStatus
            name="Stooq"
            description="Historical price data"
            status={health.prices ? 'active' : 'error'}
            details="Free, no API key required"
          />
          <ProviderStatus
            name="Financial Modeling Prep"
            description="Enhanced financial data"
            status={process.env.FMP_API_KEY ? 'active' : 'inactive'}
            details={
              process.env.FMP_API_KEY
                ? 'API key configured'
                : 'Optional - set FMP_API_KEY to enable'
            }
          />
        </div>
      </div>

      {/* Cron Status */}
      <div className="card">
        <h2 className="card-header">Automated Updates</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-terminal-text">Daily Update Job</p>
            <p className="text-sm text-terminal-muted">
              Updates prices, checks new filings, recalculates recommendations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-2 text-sm ${
                process.env.ENABLE_CRON === 'true'
                  ? 'text-success'
                  : 'text-terminal-muted'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  process.env.ENABLE_CRON === 'true'
                    ? 'bg-success-dot'
                    : 'bg-gray-500'
                }`}
              />
              {process.env.ENABLE_CRON === 'true' ? 'Enabled' : 'Disabled'}
            </span>
            <RunUpdateButton />
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="card">
        <h2 className="card-header">Environment</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-terminal-muted">Mode</dt>
            <dd className="text-terminal-text font-mono">
              {process.env.NODE_ENV}
            </dd>
          </div>
          <div>
            <dt className="text-terminal-muted">Database</dt>
            <dd className="text-terminal-text font-mono">PostgreSQL</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ProviderStatus({
  name,
  description,
  status,
  details,
}: {
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  details: string;
}) {
  const statusColors = {
    active: 'bg-success-dot',
    inactive: 'bg-gray-500',
    error: 'bg-danger-dot',
  };

  const statusText = {
    active: 'Active',
    inactive: 'Inactive',
    error: 'Error',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-terminal-bg rounded-md border border-terminal-border">
      <div>
        <p className="text-terminal-text font-medium">{name}</p>
        <p className="text-sm text-terminal-muted">{description}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-terminal-text">{statusText[status]}</span>
        </div>
        <p className="text-xs text-terminal-muted mt-1">{details}</p>
      </div>
    </div>
  );
}

function RunUpdateButton() {
  return (
    <form action="/api/cron/run" method="POST">
      <button type="submit" className="btn btn-secondary text-sm">
        Run Update Now
      </button>
    </form>
  );
}
