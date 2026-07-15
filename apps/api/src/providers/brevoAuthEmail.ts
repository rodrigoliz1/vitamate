import { config } from '../config.js';

export class BrevoDeliveryError extends Error {
  readonly statusCode = 503;
  readonly exposeMessage = true;

  constructor(readonly providerStatus: number, readonly code: 'BREVO_IP_NOT_AUTHORIZED' | 'BREVO_DELIVERY_FAILED') {
    super(providerStatus === 401
      ? 'El servidor de correo no autorizó este entorno. Usaremos un enlace de acceso seguro como respaldo.'
      : 'El servicio de correo no pudo entregar el acceso. Intenta de nuevo en unos minutos.');
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] ?? character);
}

export class BrevoAuthEmailProvider {
  async sendOtp(input: { email: string; otp: string; preferredName: string }): Promise<void> {
    if (!config.BREVO_API_KEY) throw Object.assign(new Error('El correo de acceso todavía no está configurado.'), { statusCode: 503 });
    const name = escapeHtml(input.preferredName || 'atleta');
    const htmlContent = `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;background:#f4f1e9;font-family:Arial,sans-serif;color:#1a2e3e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(47,82,51,.14)"><tr><td style="padding:30px 36px;background:#2f5233;color:#fff"><div style="font-size:26px;font-weight:800;letter-spacing:2px">VITAMATE</div><div style="font-size:12px;letter-spacing:1px;opacity:.85">TU ENTRENADOR PERSONAL</div></td></tr><tr><td style="padding:38px 36px"><p style="margin:0 0 8px;color:#5a7d5e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px">Acceso seguro</p><h1 style="font-size:28px;margin:0 0 14px">Hola, ${name}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#52605a">Usa este código para entrar a VITAMATE. Caduca pronto y sólo puede utilizarse una vez.</p><div style="padding:20px;border-radius:18px;background:#edf3ec;text-align:center;font-size:34px;font-weight:800;letter-spacing:9px;color:#2f5233">${escapeHtml(input.otp)}</div><p style="font-size:13px;line-height:1.5;color:#7a817c;margin:24px 0 0">Si no solicitaste este código, ignora el mensaje. VITAMATE nunca te pedirá que lo compartas.</p></td></tr></table></td></tr></table></body></html>`;
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: config.BREVO_SENDER_EMAIL, name: config.BREVO_SENDER_NAME },
        to: [{ email: input.email, name: input.preferredName || undefined }],
        subject: `${input.otp} es tu código de acceso a VITAMATE`,
        htmlContent,
        textContent: `Hola, ${input.preferredName || 'atleta'}. Tu código de acceso a VITAMATE es ${input.otp}. Si no lo solicitaste, ignora este mensaje.`,
        headers: { 'X-Mailin-trackclicks': '0', 'X-Mailin-trackopens': '0' },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new BrevoDeliveryError(
        response.status,
        response.status === 401 ? 'BREVO_IP_NOT_AUTHORIZED' : 'BREVO_DELIVERY_FAILED',
      );
    }
  }
}
