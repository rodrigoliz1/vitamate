import type { BillingEntitlement, BillingOffer } from '../services/api';
import { SubscriptionModal } from './SubscriptionModal';

export function PlanSelection({ entitlement, offers, native, onComplete, onPurchase, onManage, onRestore }: { entitlement: BillingEntitlement | null; offers: BillingOffer[]; native: boolean; onComplete(): void; onPurchase(interval: 'month' | 'year'): Promise<BillingEntitlement | null>; onManage(): Promise<void>; onRestore(): Promise<BillingEntitlement> }) {
  return <SubscriptionModal isOpen onDismiss={onComplete} entitlement={entitlement} offers={offers} native={native} onPurchase={onPurchase} onManage={onManage} onRestore={onRestore} onLeavingForCheckout={onComplete} />;
}
