import type { FastifyInstance, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { z } from 'zod';
import { config, isLocalDevelopmentOrigin } from '../config.js';
import {
  claimWebhookEvent,
  claimAppleWebhookEvent,
  customerIdForUser,
  getEntitlement,
  isPremium,
  releaseWebhookEvent,
  releaseAppleWebhookEvent,
  saveCustomer,
  upsertSubscription,
  upsertAppleSubscription,
  userIdForCustomer,
  userIdForAppleOriginalTransaction,
  type BillingStatus,
} from '../repositories/billingRepository.js';
import { appleInterval, verifyAppleNotification, verifyAppleRenewalInfo, verifyAppleTransaction } from '../services/appleStore.js';
import { requireUser } from '../services/auth.js';
import { requireSupabase } from '../services/supabase.js';

const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;
let offersCache: { expiresAt: number; offers: Array<{ interval: 'month' | 'year'; amount: number; currency: string }> } | null = null;

function requireStripe(): Stripe {
  if (!stripe || !config.STRIPE_PRICE_MONTHLY || !config.STRIPE_PRICE_ANNUAL) {
    throw Object.assign(new Error('Los pagos todavía no están configurados.'), { statusCode: 503, code: 'BILLING_NOT_CONFIGURED' });
  }
  return stripe;
}

function isoFromUnix(value: number | null | undefined): string | null {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

async function projectSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customer = customerId(subscription.customer);
  if (!customer) return;
  const userId = subscription.metadata.vitamate_user_id || await userIdForCustomer(customer);
  if (!userId) return;
  await saveCustomer(userId, customer);
  const item = subscription.items.data[0];
  const interval = item?.price.recurring?.interval;
  await upsertSubscription({
    userId,
    status: subscription.status as BillingStatus,
    stripeCustomerId: customer,
    subscriptionId: subscription.id,
    priceId: item?.price.id ?? null,
    billingInterval: interval === 'month' || interval === 'year' ? interval : null,
    currentPeriodEnd: isoFromUnix(item?.current_period_end),
    trialEnd: isoFromUnix(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function stripeCustomer(userId: string): Promise<string> {
  const current = await customerIdForUser(userId);
  if (current) return current;
  const { data, error } = await requireSupabase().auth.admin.getUserById(userId);
  if (error || !data.user) throw Object.assign(new Error('No encontramos tu cuenta.'), { statusCode: 404 });
  const customer = await requireStripe().customers.create({
    email: data.user.email,
    name: typeof data.user.user_metadata?.full_name === 'string' ? data.user.user_metadata.full_name : undefined,
    metadata: { vitamate_user_id: userId },
  });
  await saveCustomer(userId, customer.id);
  return customer.id;
}

async function activeStripeSubscriptionForCustomer(customer: string): Promise<Stripe.Subscription | null> {
  const subscriptions = await requireStripe().subscriptions.list({ customer, status: 'all', limit: 20 });
  return subscriptions.data
    .filter((subscription) => ['trialing', 'active'].includes(subscription.status))
    .sort((a, b) => b.created - a.created)[0] ?? null;
}

async function projectAppleTransaction(
  transaction: Awaited<ReturnType<typeof verifyAppleTransaction>>,
  expectedUserId?: string,
  renewal?: Awaited<ReturnType<typeof verifyAppleRenewalInfo>>,
): Promise<string> {
  const interval = appleInterval(transaction.productId);
  if (!interval || !transaction.originalTransactionId || !transaction.transactionId || !transaction.expiresDate) {
    throw Object.assign(new Error('La transacción no corresponde a un producto VITAMATE Premium.'), { statusCode: 400, code: 'INVALID_APPLE_PRODUCT' });
  }
  const mappedUserId = await userIdForAppleOriginalTransaction(transaction.originalTransactionId);
  const userId = expectedUserId ?? mappedUserId ?? transaction.appAccountToken;
  if (!userId) {
    throw Object.assign(new Error('La compra no corresponde a esta cuenta VITAMATE.'), { statusCode: 403, code: 'APPLE_ACCOUNT_MISMATCH' });
  }
  if (expectedUserId && transaction.appAccountToken && transaction.appAccountToken !== expectedUserId) {
    // Al borrar una cuenta Apple no cancela automáticamente su suscripción.
    // Permitimos restaurarla en una cuenta nueva sólo si el UUID original ya
    // no existe; una cuenta activa conserva la exclusividad de la compra.
    const { data: originalAccount } = await requireSupabase().auth.admin.getUserById(transaction.appAccountToken);
    if (originalAccount.user) {
      throw Object.assign(new Error('La compra no corresponde a esta cuenta VITAMATE.'), { statusCode: 403, code: 'APPLE_ACCOUNT_MISMATCH' });
    }
  }
  if (mappedUserId && mappedUserId !== userId) {
    throw Object.assign(new Error('Esta compra ya está vinculada a otra cuenta VITAMATE.'), { statusCode: 409, code: 'APPLE_PURCHASE_ALREADY_LINKED' });
  }
  const accessEnd = Math.max(transaction.expiresDate, renewal?.gracePeriodExpiresDate ?? 0);
  const active = !transaction.revocationDate && !transaction.isUpgraded && accessEnd > Date.now();
  await upsertAppleSubscription({
    userId,
    originalTransactionId: transaction.originalTransactionId,
    transactionId: transaction.transactionId,
    productId: transaction.productId!,
    environment: String(transaction.environment ?? 'Unknown'),
    billingInterval: interval,
    currentPeriodEnd: new Date(accessEnd).toISOString(),
    active,
    trialUsed: transaction.offerType === 1 || renewal?.offerType === 1,
    cancelAtPeriodEnd: renewal?.autoRenewStatus === 0,
  });
  return userId;
}

function checkoutReturnUrl(value: string | undefined): string {
  const fallback = new URL(config.PUBLIC_APP_URL);
  if (!value) return fallback.origin;
  let candidate: URL;
  try {
    candidate = new URL(value);
  } catch {
    throw Object.assign(new Error('La dirección de regreso no es válida.'), { statusCode: 400, code: 'INVALID_RETURN_URL' });
  }
  const configuredOrigins = new Set(config.APP_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean));
  const allowed = configuredOrigins.has(candidate.origin)
    || (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(candidate.origin));
  if (!allowed || candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
    throw Object.assign(new Error('La dirección de regreso no está autorizada.'), { statusCode: 400, code: 'RETURN_URL_NOT_ALLOWED' });
  }
  return candidate.origin;
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/v1/billing/status', async (request) => {
    const { userId } = await requireUser(request);
    const configured = Boolean(stripe && config.STRIPE_PRICE_MONTHLY && config.STRIPE_PRICE_ANNUAL);
    let entitlement = await getEntitlement(userId);
    // El webhook es la fuente principal para renovaciones, pero una vuelta de
    // Checkout o una entrega retrasada no debe dejar a una compra válida sin
    // acceso. Reconciliamos sólo estados no Premium con Stripe y guardamos el
    // resultado antes de responder.
    if (configured && entitlement.source !== 'apple' && !(entitlement.plan === 'premium' && ['trialing', 'active'].includes(entitlement.status))) {
      try {
        const customer = await customerIdForUser(userId);
        if (customer) {
          const subscription = await activeStripeSubscriptionForCustomer(customer);
          if (subscription) {
            await projectSubscription(subscription);
            entitlement = await getEntitlement(userId);
          }
        }
      } catch (error) {
        request.log.warn({ err: error, userId }, 'No fue posible reconciliar el estado de Stripe al consultar facturación');
      }
    }
    let offers: Array<{ interval: 'month' | 'year'; amount: number; currency: string }> = [];
    if (configured && offersCache && offersCache.expiresAt > Date.now()) {
      offers = offersCache.offers;
    } else if (configured) {
      const [monthly, annual] = await Promise.all([
        stripe!.prices.retrieve(config.STRIPE_PRICE_MONTHLY!),
        stripe!.prices.retrieve(config.STRIPE_PRICE_ANNUAL!),
      ]);
      offers = [
        { interval: 'month', amount: monthly.unit_amount ?? 0, currency: monthly.currency },
        { interval: 'year', amount: annual.unit_amount ?? 0, currency: annual.currency },
      ];
      offersCache = { offers, expiresAt: Date.now() + 15 * 60_000 };
    }
    return { entitlement, configured, offers };
  });

  app.post('/v1/billing/checkout', async (request) => {
    const { userId } = await requireUser(request);
    const { interval, returnUrl } = z.object({ interval: z.enum(['month', 'year']), returnUrl: z.string().url().optional() }).parse(request.body);
    if (await isPremium(userId)) {
      throw Object.assign(new Error('Ya tienes Premium. Administra tu plan desde el portal.'), { statusCode: 409, code: 'SUBSCRIPTION_ALREADY_ACTIVE' });
    }
    const stripeClient = requireStripe();
    const customer = await stripeCustomer(userId);
    const existingSubscription = await activeStripeSubscriptionForCustomer(customer);
    if (existingSubscription) {
      await projectSubscription(existingSubscription);
      throw Object.assign(new Error('Ya tienes una suscripción Premium vigente. Actualizamos tu acceso; no se creó otro cobro.'), { statusCode: 409, code: 'SUBSCRIPTION_ALREADY_ACTIVE' });
    }
    // La prueba sólo se marca como utilizada cuando Stripe crea realmente una
    // suscripción con trial_end. Abandonar Checkout no debe consumirla.
    const grantTrial = !(await getEntitlement(userId)).trialUsed;
    const appUrl = checkoutReturnUrl(returnUrl);
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: interval === 'month' ? config.STRIPE_PRICE_MONTHLY! : config.STRIPE_PRICE_ANNUAL!, quantity: 1 }],
      success_url: `${appUrl}/cuenta?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cuenta?checkout=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: userId,
      subscription_data: {
        metadata: { vitamate_user_id: userId },
        ...(grantTrial ? { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } : {}),
      },
      metadata: { vitamate_user_id: userId, trial_granted: String(grantTrial) },
    });
    if (!session.url) throw new Error('Stripe no devolvió una dirección de pago.');
    return { url: session.url, trialGranted: grantTrial };
  });

  app.post('/v1/billing/reconcile-checkout', async (request) => {
    const { userId } = await requireUser(request);
    const { sessionId } = z.object({ sessionId: z.string().regex(/^cs_(?:test_|live_)/) }).parse(request.body);
    const session = await requireStripe().checkout.sessions.retrieve(sessionId);
    const sessionUserId = session.client_reference_id ?? session.metadata?.vitamate_user_id;
    if (session.mode !== 'subscription' || sessionUserId !== userId) {
      throw Object.assign(new Error('La confirmación de pago no corresponde a tu cuenta.'), { statusCode: 403, code: 'CHECKOUT_OWNERSHIP_MISMATCH' });
    }
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (session.status !== 'complete' || !subscriptionId) {
      return { entitlement: await getEntitlement(userId), reconciled: false, pending: true };
    }
    await projectSubscription(await requireStripe().subscriptions.retrieve(subscriptionId));
    return { entitlement: await getEntitlement(userId), reconciled: true, pending: false };
  });

  app.post('/v1/billing/portal', async (request) => {
    const { userId } = await requireUser(request);
    const { returnUrl } = z.object({ returnUrl: z.string().url().optional() }).parse(request.body);
    const customer = await customerIdForUser(userId);
    if (!customer) throw Object.assign(new Error('Aún no tienes una cuenta de facturación.'), { statusCode: 404 });
    const session = await requireStripe().billingPortal.sessions.create({ customer, return_url: `${checkoutReturnUrl(returnUrl)}/cuenta` });
    return { url: session.url };
  });

  app.post('/v1/billing/apple/verify', async (request) => {
    const { userId } = await requireUser(request);
    const input = z.object({ transactionId: z.string().min(8).max(100), jwsRepresentation: z.string().min(100).max(100_000) }).parse(request.body);
    const transaction = await verifyAppleTransaction(input.jwsRepresentation);
    if (transaction.transactionId !== input.transactionId) {
      throw Object.assign(new Error('El identificador de compra no coincide con la transacción firmada.'), { statusCode: 400, code: 'APPLE_TRANSACTION_MISMATCH' });
    }
    await projectAppleTransaction(transaction, userId);
    return { entitlement: await getEntitlement(userId) };
  });

  app.post('/v1/billing/apple/notifications', async (request, reply) => {
    const { signedPayload } = z.object({ signedPayload: z.string().min(100).max(200_000) }).parse(request.body);
    const notification = await verifyAppleNotification(signedPayload);
    if (!notification.notificationUUID) return reply.code(400).send({ code: 'APPLE_NOTIFICATION_MISSING_ID' });
    if (!await claimAppleWebhookEvent(notification.notificationUUID, String(notification.notificationType ?? 'UNKNOWN'))) return { received: true, duplicate: true };
    try {
      if (notification.data?.signedTransactionInfo) {
        const transaction = await verifyAppleTransaction(notification.data.signedTransactionInfo);
        const renewal = notification.data.signedRenewalInfo
          ? await verifyAppleRenewalInfo(notification.data.signedRenewalInfo)
          : undefined;
        const owner = transaction.originalTransactionId ? await userIdForAppleOriginalTransaction(transaction.originalTransactionId) : null;
        if (owner || transaction.appAccountToken) await projectAppleTransaction(transaction, owner ?? transaction.appAccountToken, renewal);
      }
    } catch (error) {
      await releaseAppleWebhookEvent(notification.notificationUUID);
      throw error;
    }
    return { received: true };
  });

  app.post('/v1/billing/webhook', { config: { rawBody: true } }, async (request: FastifyRequest, reply) => {
    if (!stripe || !config.STRIPE_WEBHOOK_SECRET) return reply.code(503).send({ code: 'WEBHOOK_NOT_CONFIGURED' });
    const signature = request.headers['stripe-signature'];
    const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (typeof signature !== 'string' || !rawBody) return reply.code(400).send({ code: 'INVALID_WEBHOOK' });
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
    } catch {
      return reply.code(400).send({ code: 'INVALID_SIGNATURE' });
    }
    if (!await claimWebhookEvent(event.id, event.type)) return { received: true, duplicate: true };
    try {
      if (event.type.startsWith('customer.subscription.')) {
        await projectSubscription(event.data.object as Stripe.Subscription);
      } else if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subscriptionId) await projectSubscription(await stripe.subscriptions.retrieve(subscriptionId));
      } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
        const invoice = event.data.object as Stripe.Invoice;
        const parentSubscription = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof parentSubscription === 'string' ? parentSubscription : parentSubscription?.id;
        if (subscriptionId) await projectSubscription(await stripe.subscriptions.retrieve(subscriptionId));
      }
    } catch (error) {
      // Si la proyección falla, liberamos el evento para que Stripe pueda
      // reintentarlo; de otro modo quedaría marcado como atendido sin acceso.
      await releaseWebhookEvent(event.id);
      throw error;
    }
    return { received: true };
  });
}
