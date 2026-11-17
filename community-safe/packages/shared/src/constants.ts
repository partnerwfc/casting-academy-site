export const LOCALES = ['en', 'fr', 'pt', 'es'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const CATEGORIES = [
  'creator', 'influencer', 'streamer', 'artist', 'musician', 'athlete', 'public_figure', 'entrepreneur',
  'coach', 'brand', 'restaurant', 'media', 'nonprofit', 'events', 'agency', 'company',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SOS_REASONS = ['hacked', 'suspended', 'deleted', 'platform_down', 'new_account', 'other'] as const;
export type SosReason = (typeof SOS_REASONS)[number];

export const SOCIAL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube', 'x', 'twitch', 'facebook', 'snapchat', 'telegram', 'whatsapp', 'discord', 'website', 'other',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const TRANSFER_SOURCES = ['instagram', 'tiktok', 'youtube', 'x', 'whatsapp', 'newsletter', 'qr'] as const;
export type TransferSource = (typeof TRANSFER_SOURCES)[number];

export const HANDLE_PATTERN = /^[a-z0-9_.]{3,30}$/;
export const CAMPAIGN_STEPS = ['day1', 'day3', 'day5', 'day7'] as const;

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}

// Lien universel d'un créateur : https://savemycommunity.app/@julien?s=instagram
export function creatorUrl(baseUrl: string, handle: string, source?: string): string {
  const url = `${baseUrl.replace(/\/$/, '')}/@${handle}`;
  return source ? `${url}?s=${encodeURIComponent(source)}` : url;
}
