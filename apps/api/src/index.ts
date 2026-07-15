import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import helmet from '@fastify/helmet';
import { config, isLocalDevelopmentOrigin } from './config.js';
import { exerciseMediaRoutes } from './routes/exerciseMedia.js';
import { foodRoutes } from './routes/foods.js';
import { coachRoutes } from './routes/coach.js';
import { nutritionRoutes } from './routes/nutrition.js';
import { marketPriceRoutes } from './routes/marketPrices.js';
import { billingRoutes } from './routes/billing.js';
import { authRoutes } from './routes/auth.js';
import { notificationRoutes } from './routes/notifications.js';

const app = Fastify({ logger: true, bodyLimit: 7_000_000, trustProxy: config.TRUST_PROXY });
const configuredOrigins = new Set(config.APP_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean));

await app.register(cors, {
  origin(origin, callback) {
    // Requests without Origin are server-to-server. During local development Vite
    // may move to another port, so accept loopback origins without opening CORS in production.
    const allowed = !origin
      || configuredOrigins.has(origin)
      || (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(origin));
    const error = allowed ? null : Object.assign(new Error('Origen CORS no permitido.'), { statusCode: 403, code: 'CORS_ORIGIN_DENIED' });
    callback(error, allowed);
  },
});
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rawBody, { field: 'rawBody', global: false, encoding: false, runFirst: true });
app.setErrorHandler((unknownError, request, reply) => {
  const error = unknownError instanceof Error ? unknownError : new Error('Error desconocido');
  const statusCode = (error as Error & { statusCode?: number }).statusCode;
  const status = typeof statusCode === 'number' ? statusCode : error.name === 'ZodError' ? 400 : 500;
  if (status >= 500) request.log.error({ err: error, status }, 'request failed');
  else request.log.warn({ code: (error as Error & { code?: string }).code, status }, 'request rejected');
  const code = (error as Error & { code?: string }).code ?? (status === 400 ? 'INVALID_REQUEST' : 'SERVER_ERROR');
  const exposeMessage = (error as Error & { exposeMessage?: boolean }).exposeMessage === true;
  reply.code(status).send({ code, message: status >= 500 && !exposeMessage ? 'No fue posible completar la solicitud.' : error.message });
});
app.get('/health', async () => ({ ok: true, service: 'vitamate-api' }));
await app.register(foodRoutes);
await app.register(exerciseMediaRoutes);
await app.register(coachRoutes);
await app.register(nutritionRoutes);
await app.register(marketPriceRoutes);
await app.register(billingRoutes);
await app.register(authRoutes);
await app.register(notificationRoutes);
await app.listen({ host: '0.0.0.0', port: config.PORT });
