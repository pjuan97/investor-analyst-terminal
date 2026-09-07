'use client';

import { useTranslation } from '@/components/language-provider';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * Client half of the settings page: the provider names stay literal (they are
 * brand names) while the description and status text are translated.
 */
export function ProviderStatus({
  name,
  descriptionKey,
  status,
  detailsKey,
}: {
  name: string;
  descriptionKey: TranslationKey;
  status: 'active' | 'inactive' | 'error';
  detailsKey: TranslationKey;
}) {
  const { t } = useTranslation();

  const statusColors = {
    active: 'bg-success-dot',
    inactive: 'bg-gray-500',
    error: 'bg-danger-dot',
  };

  const statusKeys: Record<typeof status, TranslationKey> = {
    active: 'settings.status.active',
    inactive: 'settings.status.inactive',
    error: 'settings.status.error',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-terminal-bg rounded-md border border-terminal-border">
      <div>
        <p className="text-terminal-text font-medium">{name}</p>
        <p className="text-sm text-terminal-muted">{t(descriptionKey)}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-terminal-text">{t(statusKeys[status])}</span>
        </div>
        <p className="text-xs text-terminal-muted mt-1">{t(detailsKey)}</p>
      </div>
    </div>
  );
}
