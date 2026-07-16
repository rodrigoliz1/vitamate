import type { BillingEntitlement, BillingOffer } from '../services/api';
import { SubscriptionModal } from './SubscriptionModal';

export function PlanSelection({ entitlement, offers, configured, loading, statusMessage, native, onComplete, onRefresh, onPurchase, onManage, onRestore }: { entitlement: BillingEntitlement | null; offers: BillingOffer[]; configured: boolean | null; loading: boolean; statusMessage: string; native: boolean; onComplete(): void; onRefresh(): Promise<BillingEntitlement | null>; onPurchase(interval: 'month' | 'year'): Promise<BillingEntitlement | null>; onManage(): Promise<void>; onRestore(): Promise<BillingEntitlement> }) {
  return <SubscriptionModal isOpen onDismiss={onComplete} entitlement={entitlement} offers={offers} configured={configured} loading={loading} statusMessage={statusMessage} native={native} onRefresh={onRefresh} onPurchase={onPurchase} onManage={onManage} onRestore={onRestore} onLeavingForCheckout={onComplete} />;
}
