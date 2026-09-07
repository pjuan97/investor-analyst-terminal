'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  dictionaries,
  type Language,
  type TranslationKey,
} from '@/lib/i18n/translations';

const STORAGE_KEY = 'language';

/** Values interpolated into placeholders like `{n}` or `{date}`. */
type Vars = Record<string, string | number>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: Vars) => string;
  /** BCP-47 tag for Intl date/number formatting. */
  locale: string;
}

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  es: 'es-CO',
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
  locale: LOCALES.en,
});

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: Language = saved === 'es' || saved === 'en' ? saved : 'en';
    setLanguageState(initial);
    document.documentElement.setAttribute('lang', initial);
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'es' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) =>
      interpolate(dictionaries[language][key] ?? key, vars),
    [language]
  );

  // Render nothing until the stored preference is known, so the first paint
  // never shows the wrong language and then swap under the user.
  if (!mounted) return null;

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        locale: LOCALES[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

/** Convenience hook for components that only need the translate function. */
export function useTranslation() {
  const { t, locale, language } = useContext(LanguageContext);
  return { t, locale, language };
}
