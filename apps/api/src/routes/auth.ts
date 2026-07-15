import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { z } from 'zod';
import { config } from '../config.js';
import { BrevoAuthEmailProvider, BrevoDeliveryError } from '../providers/brevoAuthEmail.js';
import { allowPersistentRequest } from '../services/rateLimit.js';
import { requireUser } from '../services/auth.js';
import { requireSupabase } from '../services/supabase.js';

const emailProvider = new BrevoAuthEmailProvider();

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLocaleLowerCase('es-MX'));
const passwordSchema = z.string().min(10, 'Usa una contraseña de al menos 10 caracteres.').max(128);

function isExistingEmailError(error: unknown): boolean {
  return error instanceof Error && /already (?:been )?registered|already exists|email.*exist/i.test(error.message);
}

function isUnknownEmailError(error: unknown): boolean {
  return error instanceof Error && /not found|no user|not registered|invalid email/i.test(error.message);
}

export async function authRoutes(app: FastifyInstance) {
  app.delete('/v1/auth/account', async (request, reply) => {
    const { userId } = await requireUser(request);
    const db = requireSupabase();
    const { data: billingCustomer, error: billingError } = await db.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
    if (billingError) throw billingError;
    if (billingCustomer?.stripe_customer_id && config.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      const subscriptions = await stripe.subscriptions.list({ customer: billingCustomer.stripe_customer_id, status: 'all', limit: 100 });
      await Promise.all(subscriptions.data.filter((subscription) => !['canceled', 'incomplete_expired'].includes(subscription.status)).map((subscription) => stripe.subscriptions.cancel(subscription.id)));
    }
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
    return reply.code(200).send({ deleted: true });
  });

  app.post('/v1/auth/register', async (request, reply) => {
    const body = z.object({
      email: emailSchema,
      password: passwordSchema,
    }).parse(request.body);
    if (!await allowPersistentRequest(`auth-register:${request.ip}:${body.email}`, 4, 15 * 60_000)) {
      return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un momento antes de solicitar otro código.' });
    }
    const result = await requireSupabase().auth.admin.generateLink({
      type: 'signup',
      email: body.email,
      password: body.password,
      options: { redirectTo: config.PUBLIC_APP_URL, data: {} },
    });
    if (result.error) {
      if (isExistingEmailError(result.error)) {
        return reply.code(409).send({ code: 'EMAIL_ALREADY_REGISTERED', message: 'Este correo ya tiene una cuenta. Inicia sesión con tu contraseña.' });
      }
      throw result.error;
    }
    const otp = result.data.properties?.email_otp;
    if (!otp) throw new Error('Supabase no generó el código de verificación.');
    await emailProvider.sendOtp({ email: body.email, otp, preferredName: 'atleta' });
    return { sent: true, delivery: 'otp' as const, verificationType: 'signup' as const };
  });

  app.post('/v1/auth/request-password-reset', async (request, reply) => {
    const body = z.object({ email: emailSchema }).parse(request.body);
    if (!await allowPersistentRequest(`auth-recovery:${request.ip}:${body.email}`, 1, 45_000)) {
      return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera 45 segundos antes de solicitar otro código.' });
    }
    const result = await requireSupabase().auth.admin.generateLink({
      type: 'recovery',
      email: body.email,
      options: { redirectTo: config.PUBLIC_APP_URL },
    });
    // Respondemos igual aunque el correo no exista para no revelar qué cuentas
    // están registradas. Sólo una cuenta real recibe el código por Brevo.
    if (result.error) {
      if (isUnknownEmailError(result.error)) return { sent: true, delivery: 'otp' as const, verificationType: 'recovery' as const };
      throw result.error;
    }
    const otp = result.data.properties?.email_otp;
    if (!otp) throw new Error('Supabase no generó el código de recuperación.');
    await emailProvider.sendOtp({ email: body.email, otp, preferredName: 'atleta' });
    return { sent: true, delivery: 'otp' as const, verificationType: 'recovery' as const };
  });

  app.post('/v1/auth/resend-registration-code', async (request, reply) => {
    const body = z.object({ email: emailSchema }).parse(request.body);
    if (!await allowPersistentRequest(`auth-register-resend:${request.ip}:${body.email}`, 1, 45_000)) {
      return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera 45 segundos antes de solicitar otro código.' });
    }
    const result = await requireSupabase().auth.admin.generateLink({
      type: 'magiclink', email: body.email,
      options: { redirectTo: config.PUBLIC_APP_URL },
    });
    if (result.error || !result.data.properties?.email_otp) throw result.error ?? new Error('Supabase no generó el código de verificación.');
    await emailProvider.sendOtp({ email: body.email, otp: result.data.properties.email_otp, preferredName: 'atleta' });
    return {
      sent: true,
      delivery: 'otp' as const,
      verificationType: result.data.properties.verification_type === 'signup' ? 'signup' as const : 'email' as const,
    };
  });

  app.post('/v1/auth/request-otp', async (request, reply) => {
    const body = z.object({
      email: emailSchema,
      fullName: z.string().trim().min(3).max(160),
      preferredName: z.string().trim().min(2).max(80),
    }).parse(request.body);
    if (!await allowPersistentRequest(`auth-otp:${request.ip}:${body.email}`, 4, 15 * 60_000)) {
      return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un momento antes de solicitar otro código.' });
    }
    const db = requireSupabase();
    let result = await db.auth.admin.generateLink({
      type: 'magiclink', email: body.email,
      options: { redirectTo: config.PUBLIC_APP_URL, data: { full_name: body.fullName, preferred_name: body.preferredName } },
    });
    if (result.error) {
      result = await db.auth.admin.generateLink({
        type: 'signup', email: body.email, password: randomBytes(32).toString('base64url'),
        options: { redirectTo: config.PUBLIC_APP_URL, data: { full_name: body.fullName, preferred_name: body.preferredName } },
      });
    }
    if (result.error || !result.data.properties?.email_otp) throw result.error ?? new Error('Supabase no generó el código de acceso.');
    try {
      await emailProvider.sendOtp({ email: body.email, otp: result.data.properties.email_otp, preferredName: body.preferredName });
      return { sent: true, delivery: 'otp' as const, verificationType: result.data.properties.verification_type === 'signup' ? 'signup' : 'email' };
    } catch (error) {
      // Brevo puede restringir IPs de entornos locales. No bloqueamos el acceso:
      // Supabase entrega su enlace seguro desde su propia infraestructura como respaldo.
      if (!(error instanceof BrevoDeliveryError) || error.code !== 'BREVO_IP_NOT_AUTHORIZED') throw error;
      const fallback = await db.auth.signInWithOtp({
        email: body.email,
        options: {
          emailRedirectTo: config.PUBLIC_APP_URL,
          data: { full_name: body.fullName, preferred_name: body.preferredName },
        },
      });
      if (fallback.error) {
        if (fallback.error.code === 'over_email_send_rate_limit') {
          throw Object.assign(new Error('Por seguridad, espera unos minutos antes de pedir otro enlace de acceso.'), {
            statusCode: 429,
            code: 'AUTH_EMAIL_RATE_LIMITED',
          });
        }
        throw fallback.error;
      }
      return { sent: true, delivery: 'magic_link' as const, verificationType: 'email' as const };
    }
  });
}
