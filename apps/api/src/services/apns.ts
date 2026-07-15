import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';
import { config } from '../config.js';

let cachedToken: { value: string; expiresAt: number } | null = null;

export function apnsConfigured(): boolean {
  return Boolean(config.APNS_KEY_ID && config.APNS_TEAM_ID && config.APNS_PRIVATE_KEY_BASE64);
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function providerToken(): string {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (!config.APNS_KEY_ID || !config.APNS_TEAM_ID || !config.APNS_PRIVATE_KEY_BASE64) throw new Error('APNs no está configurado.');
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: config.APNS_KEY_ID }));
  const payload = base64Url(JSON.stringify({ iss: config.APNS_TEAM_ID, iat: issuedAt }));
  const unsigned = `${header}.${payload}`;
  const pem = Buffer.from(config.APNS_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  const signature = sign('sha256', Buffer.from(unsigned), { key: createPrivateKey(pem), dsaEncoding: 'ieee-p1363' });
  const value = `${unsigned}.${base64Url(signature)}`;
  cachedToken = { value, expiresAt: Date.now() + 45 * 60_000 };
  return value;
}

export async function sendApplePush(input: {
  token: string;
  environment: 'sandbox' | 'production';
  title: string;
  body: string;
  path?: string;
}): Promise<{ status: number; reason?: string }> {
  const origin = input.environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const client = connect(origin);
  return new Promise((resolve, reject) => {
    const close = () => client.close();
    client.once('error', (error) => { close(); reject(error); });
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${input.token}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': config.APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let status = 0;
    let responseBody = '';
    request.setEncoding('utf8');
    request.on('response', (headers) => { status = Number(headers[':status'] ?? 0); });
    request.on('data', (chunk) => { responseBody += chunk; });
    request.on('end', () => {
      close();
      let parsed: { reason?: string } = {};
      if (responseBody) {
        try { parsed = JSON.parse(responseBody) as { reason?: string }; }
        catch { parsed = { reason: responseBody.slice(0, 160) }; }
      }
      resolve({ status, reason: parsed.reason });
    });
    request.on('error', (error) => { close(); reject(error); });
    request.end(JSON.stringify({ aps: { alert: { title: input.title, body: input.body }, sound: 'default', 'thread-id': 'vitamate.coach' }, path: input.path ?? '/hoy' }));
  });
}
