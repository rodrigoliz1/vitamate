import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { createBillingPortal, createCheckout, verifyApplePurchase, type BillingOffer } from './api';

export const nativeBilling = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
export const APPLE_PRODUCT_IDS = {
  month: 'mx.vitamate.premium.monthly',
  year: 'mx.vitamate.premium.annual',
} as const;

async function verify(transaction: Transaction) {
  if (!transaction.jwsRepresentation) throw new Error('Apple no devolvió una compra verificable. Intenta restaurar tus compras.');
  return verifyApplePurchase({ transactionId: transaction.transactionId, jwsRepresentation: transaction.jwsRepresentation });
}

export async function loadBillingOffers(webOffers: BillingOffer[]): Promise<BillingOffer[]> {
  if (!nativeBilling) return webOffers;
  const { products } = await NativePurchases.getProducts({ productIdentifiers: Object.values(APPLE_PRODUCT_IDS), productType: PURCHASE_TYPE.SUBS });
  return (['month', 'year'] as const).flatMap((interval) => {
    const product = products.find((item) => item.identifier === APPLE_PRODUCT_IDS[interval]);
    return product ? [{ interval, amount: Math.round(product.price * 100), currency: product.currencyCode, displayPrice: product.priceString, trialAvailable: Boolean(product.introductoryPrice) }] : [];
  });
}

export async function startSubscription(interval: 'month' | 'year', userId: string): Promise<{ native: boolean; entitlement?: Awaited<ReturnType<typeof verify>>['entitlement'] }> {
  if (!nativeBilling) {
    const { url } = await createCheckout(interval, window.location.origin);
    window.location.assign(url);
    return { native: false };
  }
  const transaction = await NativePurchases.purchaseProduct({ productIdentifier: APPLE_PRODUCT_IDS[interval], productType: PURCHASE_TYPE.SUBS, appAccountToken: userId });
  const result = await verify(transaction);
  return { native: true, entitlement: result.entitlement };
}

export async function restoreSubscriptions(userId: string) {
  if (!nativeBilling) throw new Error('La restauración de App Store sólo está disponible en iPhone.');
  await NativePurchases.restorePurchases();
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, appAccountToken: userId, onlyCurrentEntitlements: true });
  const relevant = purchases.filter((purchase) => Object.values(APPLE_PRODUCT_IDS).includes(purchase.productIdentifier as (typeof APPLE_PRODUCT_IDS)[keyof typeof APPLE_PRODUCT_IDS]));
  if (!relevant.length) throw new Error('No encontramos una suscripción vigente para esta cuenta de Apple.');
  let result;
  for (const purchase of relevant) result = await verify(purchase);
  return result!;
}

export async function manageSubscription(): Promise<void> {
  if (nativeBilling) return NativePurchases.manageSubscriptions();
  window.location.assign((await createBillingPortal(window.location.origin)).url);
}
