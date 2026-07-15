import type { BillingEntitlement, BillingOffer } from '../services/api';
import { SubscriptionModal } from './SubscriptionModal';

export function PlanSelection({ entitlement, offers, onComplete }: { entitlement: BillingEntitlement | null; offers: BillingOffer[]; onComplete(): void }) {
  return <SubscriptionModal isOpen onDismiss={onComplete} entitlement={entitlement} offers={offers} onLeavingForCheckout={onComplete} />;
}
