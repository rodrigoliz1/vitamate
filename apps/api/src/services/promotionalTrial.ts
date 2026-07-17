import type { Entitlement } from '../repositories/billingRepository.js';

export type PromotionalTrialState = 'available' | 'active' | 'expired' | 'unavailable';

export interface PromotionalTrialOffer {
  enabled: boolean;
  state: PromotionalTrialState;
  eligible: boolean;
  days: number;
  endsAt: string | null;
}

export function promotionalTrialOffer(entitlement: Entitlement, enabled: boolean, now = Date.now()): PromotionalTrialOffer {
  const active = entitlement.promoTrialStatus === 'active'
    && Boolean(entitlement.promoTrialEndsAt)
    && Date.parse(entitlement.promoTrialEndsAt!) > now;
  const expired = entitlement.promoTrialStatus === 'expired'
    || (entitlement.promoTrialStatus === 'active' && !active);
  const eligible = enabled
    && entitlement.promoTrialStatus === 'unclaimed'
    && !entitlement.trialUsed
    && entitlement.plan === 'free';

  return {
    enabled,
    state: active ? 'active' : expired ? 'expired' : eligible ? 'available' : 'unavailable',
    eligible,
    days: 5,
    endsAt: entitlement.promoTrialEndsAt,
  };
}
