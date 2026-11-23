import { en, type Dictionary, type MessageKey } from './en';
import { fr } from './fr';
import { pt } from './pt';
import { es } from './es';
import { LOCALES, type AppLocale } from '../constants';

export type { MessageKey, Dictionary };

export const dictionaries: Record<AppLocale, Dictionary> = { en, fr, pt, es };

// Choisit la première langue prise en charge parmi les préférences (ex. "pt-BR", "fr-FR").
export function resolveLocale(preferred: readonly (string | null | undefined)[]): AppLocale {
  for (const tag of preferred) {
    const lang = tag?.toLowerCase().split(/[-_]/)[0];
    const match = LOCALES.find((l) => l === lang);
    if (match) return match;
  }
  return 'en';
}

export function translate(locale: AppLocale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = dictionaries[locale][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

// Message lisible pour un code d'erreur renvoyé par le serveur (ex. "stepup_required").
export function errorMessage(locale: AppLocale, error: unknown): string {
  const raw = typeof error === 'string' ? error : ((error as { message?: string })?.message ?? '');
  const key = `errors.${raw}` as MessageKey;
  return key in en ? translate(locale, key) : translate(locale, 'common.error');
}

export function formatCount(locale: AppLocale, n: number): string {
  return new Intl.NumberFormat(locale).format(n);
}

// « 12,4 k » : forme compacte des maquettes pour les listes.
export function formatCompact(locale: AppLocale, n: number): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n).replace(/\u00a0/g, ' ').replace(/(\d)(K)$/i, '$1 k');
}

export function formatDate(locale: AppLocale, iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
