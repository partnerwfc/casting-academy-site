import type { AppLocale } from '@community-safe/shared';

// Heure du jour, « Hier », jour de la semaine abrégé (moins de 7 jours) ou « 28 oct » : l'affichage des maquettes.
export function formatWhen(locale: AppLocale, iso: string, yesterday: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startToday) return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  if (d.getTime() >= startToday - 86400000) return yesterday;
  if (d.getTime() >= startToday - 6 * 86400000) return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).replace(/^(.)/, (m) => m.toUpperCase());
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d).replace('.', '');
}
