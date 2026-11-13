import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALES, resolveLocale, translate, type AppLocale, type MessageKey } from '@community-safe/shared';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const Ctx = createContext<{ locale: AppLocale; setLocale: (l: AppLocale) => void; t: T }>({
  locale: 'en', setLocale: () => {}, t: (k) => k,
});
const KEY = 'cs-locale';

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Langue du téléphone par défaut ; le choix manuel est mémorisé.
  const [locale, setLocaleState] = useState<AppLocale>(() => resolveLocale(getLocales().map((l) => l.languageTag)));
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((saved) => {
      const match = LOCALES.find((l) => l === saved);
      if (match) setLocaleState(match);
    });
  }, []);
  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    AsyncStorage.setItem(KEY, l);
  }, []);
  const value = useMemo(
    () => ({ locale, setLocale, t: ((key, vars) => translate(locale, key, vars)) as T }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
