'use client';

import { useLanguage } from './language-provider';

/**
 * Sits next to the theme toggle. Shows the code of the language you would
 * switch *to*, which reads more clearly as an action than showing the current
 * one — matching how the theme toggle shows the icon of the mode it switches to.
 */
export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();
  const next = language === 'en' ? 'ES' : 'EN';

  return (
    <button
      onClick={toggleLanguage}
      className="px-2.5 py-2 rounded-lg border border-terminal-border bg-terminal-card hover:bg-terminal-border transition-colors flex items-center gap-1.5"
      title={t('lang.toggleTitle')}
      aria-label={t('lang.toggleTitle')}
    >
      <svg
        className="w-4 h-4 text-terminal-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M3.6 9h16.8 M3.6 15h16.8 M12 3a15 15 0 010 18 M12 3a15 15 0 000 18"
        />
      </svg>
      <span className="text-xs font-medium text-terminal-muted leading-none">{next}</span>
    </button>
  );
}
