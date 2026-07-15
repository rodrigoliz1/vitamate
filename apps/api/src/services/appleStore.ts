import { Environment, SignedDataVerifier, type JWSRenewalInfoDecodedPayload, type JWSTransactionDecodedPayload, type ResponseBodyV2DecodedPayload } from '@apple/app-store-server-library';
import { config } from '../config.js';

const officialRootUrls = [
  'https://www.apple.com/appleca/AppleIncRootCertificate.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G2.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
];
let rootsPromise: Promise<Buffer[]> | null = null;

async function rootCertificates(): Promise<Buffer[]> {
  if (config.APPLE_ROOT_CERTIFICATES_BASE64) {
    return config.APPLE_ROOT_CERTIFICATES_BASE64.split(',').map((value) => Buffer.from(value.trim(), 'base64')).filter((value) => value.length > 0);
  }
  rootsPromise ??= Promise.all(officialRootUrls.map(async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Apple PKI respondió ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }));
  return rootsPromise;
}

async function verifiers(): Promise<SignedDataVerifier[]> {
  const roots = await rootCertificates();
  return [
    new SignedDataVerifier(roots, true, Environment.SANDBOX, config.APPLE_BUNDLE_ID),
    ...(config.APPLE_APP_ID ? [new SignedDataVerifier(roots, true, Environment.PRODUCTION, config.APPLE_BUNDLE_ID, config.APPLE_APP_ID)] : []),
    ...(process.env.NODE_ENV === 'production' ? [] : [new SignedDataVerifier(roots, false, Environment.XCODE, config.APPLE_BUNDLE_ID)]),
  ];
}

async function attempt<T>(operation: (verifier: SignedDataVerifier) => Promise<T>): Promise<T> {
  let cause: unknown;
  for (const verifier of await verifiers()) {
    try { return await operation(verifier); } catch (error) { cause = error; }
  }
  throw Object.assign(new Error('Apple no pudo verificar la compra.'), { statusCode: 400, code: 'INVALID_APPLE_TRANSACTION', cause });
}

export function verifyAppleTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  return attempt((verifier) => verifier.verifyAndDecodeTransaction(jws));
}

export function verifyAppleNotification(jws: string): Promise<ResponseBodyV2DecodedPayload> {
  return attempt((verifier) => verifier.verifyAndDecodeNotification(jws));
}

export function verifyAppleRenewalInfo(jws: string): Promise<JWSRenewalInfoDecodedPayload> {
  return attempt((verifier) => verifier.verifyAndDecodeRenewalInfo(jws));
}

export function appleInterval(productId: string | undefined): 'month' | 'year' | null {
  if (productId === config.APPLE_PRODUCT_MONTHLY) return 'month';
  if (productId === config.APPLE_PRODUCT_ANNUAL) return 'year';
  return null;
}
