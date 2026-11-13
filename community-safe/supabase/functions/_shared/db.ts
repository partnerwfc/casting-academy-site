// Accès base et authentification pour les Edge Functions, en HTTP direct (aucune dépendance à charger).
const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const serviceHeaders = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

export const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');

export const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

export async function rpc<T>(name: string, args: Record<string, unknown> = {}, userToken?: string): Promise<T> {
  const headers = userToken ? { ...serviceHeaders, authorization: `Bearer ${userToken}` } : serviceHeaders;
  const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`rpc ${name}: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export async function select<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: serviceHeaders });
  if (!res.ok) throw new Error(`select ${table}: ${res.status}`);
  return (await res.json()) as T[];
}

export async function patch(table: string, query: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { method: 'PATCH', headers: serviceHeaders, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`patch ${table}: ${res.status}`);
}

// Le jeton est validé par le service d'authentification, jamais décodé localement.
export async function authUser(req: Request): Promise<{ id: string; email: string | null; token: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return null;
  const res = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  return user.id && /^[0-9a-f-]{36}$/.test(user.id) ? { id: user.id, email: user.email ?? null, token } : null;
}

export async function deleteAuthUser(id: string): Promise<void> {
  const res = await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: serviceHeaders });
  if (!res.ok) throw new Error(`delete user: ${res.status}`);
}

// Appel de l'API Stripe (clé secrète côté serveur uniquement).
export async function stripe<T>(path: string, method: 'GET' | 'POST' | 'DELETE', form?: string): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('billing_unavailable');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${body?.error?.message ?? res.status}`);
  return body as T;
}
