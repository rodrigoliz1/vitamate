import { z } from 'zod';

const optionalPositiveInteger = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  TRUST_PROXY: z.enum(['true', 'false']).default(process.env.NODE_ENV === 'production' ? 'true' : 'false').transform((value) => value === 'true'),
  APP_ORIGIN: z.string().default('http://127.0.0.1:4173,http://127.0.0.1:4174'),
  PUBLIC_APP_URL: z.string().url().default('http://127.0.0.1:4174'),
  OPEN_FOOD_FACTS_BASE_URL: z.string().url().default('https://world.openfoodfacts.org'),
  OPEN_FOOD_FACTS_USER_AGENT: z.string().min(12).default('VITAMATE/1.0 (https://vitamate.mx; contacto@vitamate.mx)'),
  USDA_FDC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_VISION_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_COACH_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime-2.1'),
  OPENAI_REALTIME_VOICE: z.string().default('marin'),
  FAL_KEY: z.string().optional(),
  FAL_IMAGE_MODEL: z.string().default('fal-ai/flux/dev'),
  FAL_MEAL_IMAGE_MODEL: z.string().default('fal-ai/flux/dev'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ADMIN_BOOTSTRAP_TOKEN: z.string().min(20).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  APPLE_BUNDLE_ID: z.string().default('mx.vitamate.app'),
  // Render represents environment variables configured without a value as an
  // empty string. Treat it as unset until App Store Connect assigns the app ID.
  APPLE_APP_ID: optionalPositiveInteger,
  APPLE_ROOT_CERTIFICATES_BASE64: z.string().optional(),
  APPLE_PRODUCT_MONTHLY: z.string().default('mx.vitamate.premium.monthly'),
  APPLE_PRODUCT_ANNUAL: z.string().default('mx.vitamate.premium.annual'),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SMTP_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().default('noreply@vitamate.mx'),
  BREVO_SENDER_NAME: z.string().default('VITAMATE'),
  PROFECO_QQP_SOURCE_URL: z.string().url().optional(),
  INEGI_API_TOKEN: z.string().optional(),
  INEGI_INPC_SOURCE: z.enum(['calculator', 'indicator_api']).optional(),
  INEGI_INPC_INDICATOR_ID: z.string().optional(),
  INEGI_INPC_CALCULATOR_URL: z.string().url().optional(),
  INEGI_INPC_CONFIG_URL: z.string().url().optional(),
  INEGI_INPC_DATA_BASE_URL: z.string().url().optional(),
  REQUIRE_COACH_AUTH: z.enum(['true', 'false']).default(process.env.NODE_ENV === 'production' ? 'true' : 'false').transform((value) => value === 'true'),
});

export const config = schema.parse(process.env);

// Sólo se usa durante desarrollo local. Producción conserva una lista exacta
// en APP_ORIGIN y nunca acepta una red privada de manera implícita.
export function isLocalDevelopmentOrigin(origin: string): boolean {
  return /^http:\/\/(?:127\.0\.0\.1|localhost|192\.168\.0\.9):\d{2,5}$/.test(origin);
}
