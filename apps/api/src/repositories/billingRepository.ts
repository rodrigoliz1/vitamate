import { requireSupabase } from '../services/supabase.js';

export type BillingStatus = 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';
export interface Entitlement {
  userId: string;
  plan: 'free' | 'premium';
  status: BillingStatus;
  billingInterval: 'month' | 'year' | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  trialUsed: boolean;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  source: 'none' | 'stripe' | 'apple';
  appleProductId: string | null;
}

const selectFields = 'user_id, plan, status, billing_interval, current_period_end, trial_end, trial_used, cancel_at_period_end, stripe_customer_id, source, apple_product_id';

function map(row: Record<string, unknown>): Entitlement {
  return {
    userId: String(row.user_id),
    plan: row.plan === 'premium' ? 'premium' : 'free',
    status: row.status as BillingStatus,
    billingInterval: row.billing_interval === 'month' || row.billing_interval === 'year' ? row.billing_interval : null,
    currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : null,
    trialEnd: typeof row.trial_end === 'string' ? row.trial_end : null,
    trialUsed: row.trial_used === true,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    stripeCustomerId: typeof row.stripe_customer_id === 'string' ? row.stripe_customer_id : null,
    source: row.source === 'stripe' || row.source === 'apple' ? row.source : 'none',
    appleProductId: typeof row.apple_product_id === 'string' ? row.apple_product_id : null,
  };
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const db = requireSupabase();
  const { data, error } = await db.from('subscription_entitlements').select(selectFields).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return map(data);
  const { data: created, error: createError } = await db.from('subscription_entitlements').insert({ user_id: userId }).select(selectFields).single();
  if (createError) throw createError;
  return map(created);
}

export async function isPremium(userId: string): Promise<boolean> {
  const entitlement = await getEntitlement(userId);
  if (entitlement.plan !== 'premium' || !['trialing', 'active'].includes(entitlement.status)) return false;
  return !entitlement.currentPeriodEnd || Date.parse(entitlement.currentPeriodEnd) > Date.now();
}

export async function requirePremium(userId: string): Promise<void> {
  if (!await isPremium(userId)) {
    throw Object.assign(new Error('Esta función requiere VITAMATE Premium.'), { statusCode: 402, code: 'PREMIUM_REQUIRED' });
  }
}

export async function customerIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await requireSupabase().from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.stripe_customer_id ?? null;
}

export async function saveCustomer(userId: string, stripeCustomerId: string): Promise<void> {
  const now = new Date().toISOString();
  const db = requireSupabase();
  const { error } = await db.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: stripeCustomerId, updated_at: now });
  if (error) throw error;
  const { error: entitlementError } = await db.from('subscription_entitlements').upsert({ user_id: userId, stripe_customer_id: stripeCustomerId, updated_at: now }, { onConflict: 'user_id' });
  if (entitlementError) throw entitlementError;
}

export async function userIdForCustomer(stripeCustomerId: string): Promise<string | null> {
  const { data, error } = await requireSupabase().from('billing_customers').select('user_id').eq('stripe_customer_id', stripeCustomerId).maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

export async function upsertSubscription(input: {
  userId: string; status: BillingStatus; stripeCustomerId: string; subscriptionId: string;
  priceId: string | null; billingInterval: 'month' | 'year' | null;
  currentPeriodEnd: string | null; trialEnd: string | null; cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const premium = ['trialing', 'active'].includes(input.status)
    && (!input.currentPeriodEnd || Date.parse(input.currentPeriodEnd) > Date.now());
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    plan: premium ? 'premium' : 'free',
    status: input.status,
    billing_interval: input.billingInterval,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.subscriptionId,
    stripe_price_id: input.priceId,
    current_period_end: input.currentPeriodEnd,
    trial_end: input.trialEnd,
    cancel_at_period_end: input.cancelAtPeriodEnd,
    source: 'stripe',
    updated_at: new Date().toISOString(),
  };
  // Nunca se revierte trial_used: una prueba utilizada sigue consumida aunque
  // la suscripción posterior ya no tenga trial_end.
  if (input.trialEnd !== null) payload.trial_used = true;
  const { error } = await requireSupabase().from('subscription_entitlements').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function upsertAppleSubscription(input: {
  userId: string;
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  environment: string;
  billingInterval: 'month' | 'year';
  currentPeriodEnd: string;
  active: boolean;
  trialUsed: boolean;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  const db = requireSupabase();
  const existingEntitlement = await getEntitlement(input.userId);
  const { data: owner, error: ownerError } = await db.from('apple_purchase_accounts').select('user_id').eq('original_transaction_id', input.originalTransactionId).maybeSingle();
  if (ownerError) throw ownerError;
  if (owner && owner.user_id !== input.userId) {
    throw Object.assign(new Error('Esta compra de App Store ya está vinculada a otra cuenta VITAMATE.'), { statusCode: 409, code: 'APPLE_PURCHASE_ALREADY_LINKED' });
  }
  const now = new Date().toISOString();
  const { error: mappingError } = await db.from('apple_purchase_accounts').upsert({
    original_transaction_id: input.originalTransactionId,
    user_id: input.userId,
    product_id: input.productId,
    environment: input.environment,
    updated_at: now,
  }, { onConflict: 'original_transaction_id' });
  if (mappingError) throw mappingError;
  const { error } = await db.from('subscription_entitlements').upsert({
    user_id: input.userId,
    plan: input.active ? 'premium' : 'free',
    status: input.active ? 'active' : 'canceled',
    billing_interval: input.billingInterval,
    current_period_end: input.currentPeriodEnd,
    trial_used: existingEntitlement.trialUsed || input.trialUsed,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    source: 'apple',
    apple_original_transaction_id: input.originalTransactionId,
    apple_transaction_id: input.transactionId,
    apple_product_id: input.productId,
    apple_environment: input.environment,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function userIdForAppleOriginalTransaction(originalTransactionId: string): Promise<string | null> {
  const { data, error } = await requireSupabase().from('apple_purchase_accounts').select('user_id').eq('original_transaction_id', originalTransactionId).maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

export async function claimAppleWebhookEvent(notificationUuid: string, notificationType: string): Promise<boolean> {
  const { error } = await requireSupabase().from('apple_webhook_events').insert({ notification_uuid: notificationUuid, notification_type: notificationType });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

export async function releaseAppleWebhookEvent(notificationUuid: string): Promise<void> {
  const { error } = await requireSupabase().from('apple_webhook_events').delete().eq('notification_uuid', notificationUuid);
  if (error) throw error;
}

export async function claimWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
  const { error } = await requireSupabase().from('stripe_webhook_events').insert({ event_id: eventId, event_type: eventType });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

export async function releaseWebhookEvent(eventId: string): Promise<void> {
  const { error } = await requireSupabase().from('stripe_webhook_events').delete().eq('event_id', eventId);
  if (error) throw error;
}
