import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeStripeEvent, stripeForm, verifyStripeSignature } from './billing';

const sign = (body: string, secret: string, t: number) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

describe('verifyStripeSignature', () => {
  const body = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  it('accepte une signature valide', async () => {
    expect(await verifyStripeSignature(body, sign(body, 'whsec_x', now), 'whsec_x', now)).toBe(true);
  });
  it('refuse un mauvais secret, un corps modifié, un événement trop ancien et un en-tête absent', async () => {
    expect(await verifyStripeSignature(body, sign(body, 'autre', now), 'whsec_x', now)).toBe(false);
    expect(await verifyStripeSignature(body + ' ', sign(body, 'whsec_x', now), 'whsec_x', now)).toBe(false);
    expect(await verifyStripeSignature(body, sign(body, 'whsec_x', now - 3600), 'whsec_x', now)).toBe(false);
    expect(await verifyStripeSignature(body, null, 'whsec_x', now)).toBe(false);
    expect(await verifyStripeSignature(body, 'v1=abc', 'whsec_x', now)).toBe(false);
  });
});

describe('stripeForm', () => {
  it('encode les clés imbriquées et les tableaux', () => {
    expect(decodeURIComponent(stripeForm({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }], subscription_data: { metadata: { creator_id: 'c1' } } })))
      .toBe('mode=subscription&line_items[0][price]=price_1&line_items[0][quantity]=1&subscription_data[metadata][creator_id]=c1');
  });
});

describe('normalizeStripeEvent', () => {
  const plans = { price_creator: 'creator', price_pro: 'pro' };
  const sub = (over: object = {}, type = 'customer.subscription.updated') => ({
    type, data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, metadata: { creator_id: 'c1' },
      items: { data: [{ price: { id: 'price_creator' }, current_period_end: 1_800_000_000 }] }, ...over } },
  });
  it('active un forfait payant', () => {
    expect(normalizeStripeEvent(sub(), plans)).toMatchObject({ creator_id: 'c1', customer_id: 'cus_1', plan_id: 'creator', status: 'active', current_period_end: '2027-01-15T08:00:00.000Z', cancel_at_period_end: false });
  });
  it('signale une résiliation programmée sans retirer le forfait', () => {
    expect(normalizeStripeEvent(sub({ cancel_at_period_end: true }), plans)).toMatchObject({ status: 'active', cancel_at_period_end: true });
  });
  it('passe en impayé, puis en résilié', () => {
    expect(normalizeStripeEvent(sub({ status: 'past_due' }), plans)?.status).toBe('past_due');
    expect(normalizeStripeEvent(sub({}, 'customer.subscription.deleted'), plans)).toMatchObject({ status: 'canceled', plan_id: 'discovery' });
  });
  it('ignore un prix inconnu, un statut incomplet et les événements étrangers', () => {
    expect(normalizeStripeEvent(sub({ items: { data: [{ price: { id: 'price_x' } }] } }), plans)).toBeNull();
    expect(normalizeStripeEvent(sub({ status: 'incomplete' }), plans)).toBeNull();
    expect(normalizeStripeEvent({ type: 'charge.refunded', data: { object: {} } }, plans)).toBeNull();
  });
  it('enregistre un paiement avec sa taxe', () => {
    expect(normalizeStripeEvent({ type: 'invoice.paid', data: { object: { id: 'in_1', customer: 'cus_1', amount_paid: 2999, currency: 'eur', total_taxes: [{ amount: 500 }] } } }, plans))
      .toEqual({ customer_id: 'cus_1', payment: { id: 'in_1', amount_cents: 2999, tax_cents: 500, currency: 'eur', status: 'succeeded' } });
  });
});
