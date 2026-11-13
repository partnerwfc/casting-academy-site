import { describe, expect, it } from 'vitest';
import { buildMessages, chunk, toDeliveryResults, notificationTitle, type ClaimedRecipient } from './push';

const recipient = (over: Partial<ClaimedRecipient> = {}): ClaimedRecipient => ({
  alert_id: 'a1', user_id: 'u1', kind: 'sos', creator_name: 'Julien', creator_handle: 'julien',
  message: 'Mon compte est piraté', locale: 'fr', tokens: [{ id: 't1', token: 'ExponentPushToken[x]' }], ...over,
});

describe('push', () => {
  it('localise le titre et retombe sur l’anglais', () => {
    expect(notificationTitle('sos', 'Julien', 'fr')).toBe('🚨 Julien a envoyé une alerte');
    expect(notificationTitle('sos', 'Julien', 'de')).toBe('🚨 Julien sent an alert');
  });

  it('un message par appareil, sans doublon de jeton', () => {
    const msgs = buildMessages([
      recipient({ tokens: [{ id: 't1', token: 'A' }, { id: 't2', token: 'A' }, { id: 't3', token: 'B' }] }),
      recipient({ user_id: 'u2', kind: 'announcement', tokens: [] }),
    ]);
    expect(msgs.map((m) => m.message.to)).toEqual(['A', 'B']);
    expect(msgs[0].message.channelId).toBe('sos');
    expect(msgs[0].message.data).toEqual({ alertId: 'a1', kind: 'sos' });
  });

  it('découpe en lots', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('interprète les tickets : accepté, jeton invalide, lot en échec, aucun appareil', () => {
    const recipients = [
      recipient({ user_id: 'ok' }),
      recipient({ user_id: 'gone', tokens: [{ id: 't2', token: 'B' }] }),
      recipient({ user_id: 'outage', tokens: [{ id: 't3', token: 'C' }] }),
      recipient({ user_id: 'nodevice', tokens: [] }),
    ];
    const sent = buildMessages(recipients);
    const results = toDeliveryResults(recipients, sent, [
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      null,
    ]);
    expect(results[0]).toMatchObject({ retryable: false, attempts: [{ accepted: true, ticket_id: 'ticket-1' }] });
    expect(results[1]).toMatchObject({ retryable: false, attempts: [{ accepted: false, error_code: 'DeviceNotRegistered' }] });
    expect(results[2]).toMatchObject({ retryable: true, attempts: [{ error_code: 'ProviderUnavailable' }] });
    expect(results[3]).toMatchObject({ retryable: false, attempts: [] });
  });
});
