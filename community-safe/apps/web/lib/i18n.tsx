'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { translate, type AppLocale, type MessageKey } from '@community-safe/shared';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const Ctx = createContext<{ locale: AppLocale; setLocale: (l: AppLocale) => void; t: T }>({
  locale: 'en', setLocale: () => {}, t: (k) => k,
});

export function LocaleProvider({ initial, children }: { initial: AppLocale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initial);
  const value = useMemo(() => ({
    locale,
    setLocale: (l: AppLocale) => {
      setLocaleState(l);
      document.cookie = `cs-locale=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
    },
    t: ((key, vars) => translate(locale, key, vars)) as T,
  }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
