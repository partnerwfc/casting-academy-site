import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type Provider = 'apple' | 'google';

export async function appleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

// Connexion native Apple (iOS). Refaite pour une reconfirmation d'identité : elle rafraîchit la session.
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('apple_no_token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw error;
}

// Flux OAuth dans le navigateur système : connexion, reconfirmation, ou liaison d'un compte anonyme (link = true).
export async function runOAuth(provider: Provider, link = false): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');
  const options = { redirectTo, skipBrowserRedirect: true };
  const { data, error } = link
    ? await supabase.auth.linkIdentity({ provider, options })
    : await supabase.auth.signInWithOAuth({ provider, options });
  if (error || !data?.url) throw error ?? new Error('oauth');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const code = Linking.parse(result.url).queryParams?.code;
  if (typeof code !== 'string') throw new Error('oauth');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

// Connexion complète avec le fournisseur choisi (Apple natif sur iOS, sinon OAuth).
export async function signInWith(provider: Provider): Promise<void> {
  if (provider === 'apple' && (await appleAvailable())) return signInWithApple();
  return runOAuth(provider);
}

export async function continueAnonymously(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  // Déclaration d'âge (16 ans) faite par l'affichage de la mention légale ; enregistrée sur le compte.
  await supabase.from('users').update({ age_confirmed_at: new Date().toISOString() }).not('id', 'is', null);
}
