import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { createBillingPortal, createCheckout, createVoiceCheckout, verifyApplePurchase, verifyAppleVoicePurchase, type BillingOffer, type VoiceCreditBalance, type VoiceCreditOffer } from './api';

export const nativeBilling = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
export const APPLE_PRODUCT_IDS = {
  month: 'mx.vitamate.premium.monthly',
  year: 'mx.vitamate.premium.annual',
} as const;
export const APPLE_VOICE_PRODUCT_IDS = { voice_5: 'mx.vitamate.voice.5', voice_10: 'mx.vitamate.voice.10', voice_30: 'mx.vitamate.voice.30', voice_60: 'mx.vitamate.voice.60' } as const;

async function verify(transaction: Transaction) {
  if (!transaction.jwsRepresentation) throw new Error('Apple no devolvió una compra verificable. Intenta restaurar tus compras.');
  return verifyApplePurchase({ transactionId: transaction.transactionId, jwsRepresentation: transaction.jwsRepresentation });
}

export async function loadBillingOffers(webOffers: BillingOffer[]): Promise<BillingOffer[]> {
  if (!nativeBilling) return webOffers;
  try {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: Object.values(APPLE_PRODUCT_IDS), productType: PURCHASE_TYPE.SUBS });
    const nativeOffers = (['month', 'year'] as const).flatMap((interval) => {
      const product = products.find((item) => item.identifier === APPLE_PRODUCT_IDS[interval]);
      return product ? [{ interval, amount: Math.round(product.price * 100), currency: product.currencyCode, displayPrice: product.priceString, trialAvailable: Boolean(product.introductoryPrice) }] : [];
    });
    // En un simulador sin StoreKit Configuration mostramos los precios
    // públicos del servidor como referencia. El cobro nativo sigue exigiendo
    // que los productos existan en StoreKit/App Store Connect.
    return nativeOffers.length ? nativeOffers : webOffers;
  } catch {
    return webOffers;
  }
}

export async function loadVoiceOffers(webOffers: VoiceCreditOffer[]): Promise<VoiceCreditOffer[]> {
  if (!nativeBilling) return webOffers;
  try {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: Object.values(APPLE_VOICE_PRODUCT_IDS), productType: PURCHASE_TYPE.INAPP });
    return webOffers.map((offer) => {
      const product = products.find((item) => item.identifier === offer.appleProductId);
      return product ? { ...offer, amount: Math.round(product.price * 100), currency: product.currencyCode, displayPrice: product.priceString } : offer;
    });
  } catch { return webOffers; }
}

export async function purchaseVoiceTime(offer: VoiceCreditOffer, userId: string): Promise<{ native: boolean; voiceBalance?: VoiceCreditBalance }> {
  if (!nativeBilling) {
    window.location.assign((await createVoiceCheckout(offer.id, window.location.origin)).url);
    return { native: false };
  }
  let transaction: Transaction;
  try {
    transaction = await NativePurchases.purchaseProduct({ productIdentifier: offer.appleProductId, productType: PURCHASE_TYPE.INAPP, appAccountToken: userId, isConsumable: true });
  } catch (error) {
    throw new Error(`No fue posible abrir la compra de App Store. Verifica que ${offer.appleProductId} esté configurado como consumible. (${error instanceof Error ? error.message : 'producto no disponible'})`);
  }
  if (!transaction.jwsRepresentation) throw new Error('Apple no devolvió una compra verificable. Inténtalo nuevamente.');
  const result = await verifyAppleVoicePurchase({ transactionId: transaction.transactionId, jwsRepresentation: transaction.jwsRepresentation });
  return { native: true, voiceBalance: result.voiceBalance };
}

export async function startSubscription(interval: 'month' | 'year', userId: string): Promise<{ native: boolean; entitlement?: Awaited<ReturnType<typeof verify>>['entitlement'] }> {
  if (!nativeBilling) {
    const { url } = await createCheckout(interval, window.location.origin);
    window.location.assign(url);
    return { native: false };
  }
  let transaction: Transaction;
  try {
    transaction = await NativePurchases.purchaseProduct({ productIdentifier: APPLE_PRODUCT_IDS[interval], productType: PURCHASE_TYPE.SUBS, appAccountToken: userId });
  } catch (error) {
    throw new Error(`No fue posible abrir la compra de App Store. Verifica que ${APPLE_PRODUCT_IDS[interval]} esté disponible en StoreKit o App Store Connect. (${error instanceof Error ? error.message : 'producto no disponible'})`);
  }
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
