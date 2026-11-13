import { cookies, headers } from 'next/headers';
import { resolveLocale, type AppLocale } from '@community-safe/shared';

// Langue : choix explicite (cookie) puis préférences du navigateur.
export async function getLocale(): Promise<AppLocale> {
  const saved = (await cookies()).get('cs-locale')?.value;
  const accepted = ((await headers()).get('accept-language') ?? '').split(',').map((part) => part.split(';')[0].trim());
  return resolveLocale([saved, ...accepted]);
}
