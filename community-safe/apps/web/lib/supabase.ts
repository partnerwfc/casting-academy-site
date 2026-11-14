import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isConfigured = Boolean(url && anonKey);
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://savemycommunity.com').replace(/\/$/, '');

let browserClient: SupabaseClient | null = null;

// Client navigateur (session dans le navigateur, flux PKCE).
export function supabase(): SupabaseClient {
  browserClient ??= createClient(url || 'https://missing.supabase.co', anonKey || 'missing', {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}

// Client serveur anonyme : uniquement pour lire des données publiques (profil d'un créateur).
export function anonServerClient(): SupabaseClient | null {
  if (!isConfigured) return null;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
