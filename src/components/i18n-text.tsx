'use client';

import { useTranslation } from './language-provider';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * Translated text usable from Server Components.
 *
 * Pages that query the database stay on the server, but React context (and so
 * `useTranslation`) is client-only — this bridges the two: a leaf client
 * component that renders one translated string.
 */
export function T({
  k,
  vars,
}: {
  k: TranslationKey;
  vars?: Record<string, string | number>;
}) {
  const { t } = useTranslation();
  return <>{t(k, vars)}</>;
}

/** Standard page heading, translated. */
export function PageHeading({
  titleKey,
  subtitleKey,
}: {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-terminal-text">{t(titleKey)}</h1>
      {subtitleKey && (
        <p className="text-terminal-muted mt-1">{t(subtitleKey)}</p>
      )}
    </div>
  );
}
