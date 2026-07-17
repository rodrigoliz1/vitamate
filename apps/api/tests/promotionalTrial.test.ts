import assert from 'node:assert/strict';
import test from 'node:test';
import type { Entitlement } from '../src/repositories/billingRepository.js';
import { promotionalTrialOffer } from '../src/services/promotionalTrial.js';

function entitlement(changes: Partial<Entitlement> = {}): Entitlement {
  return {
    userId: '00000000-0000-4000-8000-000000000001',
    plan: 'free',
    status: 'free',
    billingInterval: null,
    currentPeriodEnd: null,
    trialEnd: null,
    trialUsed: false,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    source: 'none',
    appleProductId: null,
    promoTrialStatus: 'unclaimed',
    promoTrialClaimedAt: null,
    promoTrialEndsAt: null,
    ...changes,
  };
}

test('ofrece el regalo a una cuenta gratis elegible', () => {
  assert.equal(promotionalTrialOffer(entitlement(), true).state, 'available');
});

test('un regalo activo se conserva aunque la campaña se desactive', () => {
  const offer = promotionalTrialOffer(entitlement({
    plan: 'premium',
    status: 'trialing',
    trialUsed: true,
    promoTrialStatus: 'active',
    promoTrialEndsAt: '2026-07-21T12:00:00.000Z',
  }), false, Date.parse('2026-07-18T12:00:00.000Z'));
  assert.equal(offer.state, 'active');
});

test('no ofrece la promoción cuando el interruptor está apagado', () => {
  assert.equal(promotionalTrialOffer(entitlement(), false).state, 'unavailable');
});
