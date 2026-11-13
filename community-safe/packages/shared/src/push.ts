// Construction et interprétation des envois Expo Push. Fichier autonome (aucun import) :
// copié tel quel dans supabase/functions/_shared par `pnpm sync:functions`.

export type AlertKind = 'sos' | 'announcement' | 'test';
export type Locale = 'en' | 'fr' | 'pt' | 'es';

export interface ClaimedRecipient {
  alert_id: string;
  user_id: string;
  kind: AlertKind;
  creator_name: string;
  creator_handle: string;
  message: string;
  locale: string;
  tokens: { id: string; token: string }[];
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: string;
  data: { alertId: string; kind: AlertKind };
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface DeliveryAttempt {
  push_token_id: string;
  accepted: boolean;
  ticket_id: string | null;
  error_code: string | null;
}

export interface DeliveryResult {
  alert_id: string;
  user_id: string;
  retryable: boolean;
  attempts: DeliveryAttempt[];
}

export const EXPO_CHUNK_SIZE = 100;

const TITLES: Record<AlertKind, Record<Locale, string>> = {
  sos: {
    en: '🚨 {name} sent an alert',
    fr: '🚨 {name} a envoyé une alerte',
    pt: '🚨 {name} enviou um alerta',
    es: '🚨 {name} ha enviado una alerta',
  },
  announcement: {
    en: '📣 {name} — important announcement',
    fr: '📣 {name} — annonce importante',
    pt: '📣 {name} — anúncio importante',
    es: '📣 {name} — anuncio importante',
  },
  test: {
    en: '✅ Test alert — {name}',
    fr: '✅ Alerte de test — {name}',
    pt: '✅ Alerta de teste — {name}',
    es: '✅ Alerta de prueba — {name}',
  },
};

export function notificationTitle(kind: AlertKind, creatorName: string, locale: string): string {
  const lang = (['en', 'fr', 'pt', 'es'] as const).find((l) => l === locale) ?? 'en';
  return TITLES[kind][lang].replace('{name}', creatorName);
}

// Canaux Android : les SOS et les annonces sont réglables séparément par l'utilisateur.
export function channelFor(kind: AlertKind): string {
  return kind === 'announcement' ? 'announcements' : 'sos';
}

export interface OutgoingMessage {
  recipientIndex: number;
  pushTokenId: string;
  message: ExpoMessage;
}

export function buildMessages(recipients: ClaimedRecipient[]): OutgoingMessage[] {
  const out: OutgoingMessage[] = [];
  recipients.forEach((r, recipientIndex) => {
    const seen = new Set<string>();
    for (const t of r.tokens) {
      if (seen.has(t.token)) continue; // jamais deux fois le même appareil pour une alerte
      seen.add(t.token);
      out.push({
        recipientIndex,
        pushTokenId: t.id,
        message: {
          to: t.token,
          title: notificationTitle(r.kind, r.creator_name, r.locale),
          body: r.message,
          sound: 'default',
          priority: 'high',
          channelId: channelFor(r.kind),
          data: { alertId: r.alert_id, kind: r.kind },
        },
      });
    }
  });
  return out;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Erreurs pour lesquelles un nouvel essai a un sens.
const RETRYABLE = new Set(['MessageRateExceeded', 'ProviderUnavailable', 'ExpoError']);

export function isRetryable(errorCode: string | null): boolean {
  return errorCode !== null && RETRYABLE.has(errorCode);
}

// `tickets[i]` répond à `sent[i]`. `null` = le lot entier a échoué (réseau, 429, 5xx).
export function toDeliveryResults(
  recipients: ClaimedRecipient[],
  sent: OutgoingMessage[],
  tickets: (ExpoTicket | null)[],
): DeliveryResult[] {
  const results: DeliveryResult[] = recipients.map((r) => ({
    alert_id: r.alert_id,
    user_id: r.user_id,
    retryable: false,
    attempts: [],
  }));
  sent.forEach((m, i) => {
    const ticket = tickets[i];
    const accepted = ticket?.status === 'ok';
    const errorCode = accepted ? null : ticket ? (ticket.details?.error ?? 'ExpoError') : 'ProviderUnavailable';
    results[m.recipientIndex].attempts.push({
      push_token_id: m.pushTokenId,
      accepted,
      ticket_id: accepted ? (ticket?.id ?? null) : null,
      error_code: errorCode,
    });
  });
  for (const r of results) {
    r.retryable = !r.attempts.some((a) => a.accepted) && r.attempts.some((a) => isRetryable(a.error_code));
  }
  return results;
}
