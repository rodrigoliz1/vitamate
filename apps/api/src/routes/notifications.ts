import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deactivateNotificationDevice, notificationDevicesForUser, upsertNotificationDevice } from '../repositories/notificationRepository.js';
import { apnsConfigured, sendApplePush } from '../services/apns.js';
import { requireUser } from '../services/auth.js';
import { allowPersistentRequest } from '../services/rateLimit.js';

const deviceSchema = z.object({
  token: z.string().trim().min(32).max(512),
  platform: z.enum(['ios', 'web']),
  environment: z.enum(['sandbox', 'production']).default('production'),
  locale: z.string().max(40).optional(),
  timezone: z.string().max(100).optional(),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.post('/v1/notifications/devices', async (request) => {
    const { userId } = await requireUser(request);
    const body = deviceSchema.parse(request.body);
    await upsertNotificationDevice({ userId, ...body });
    return { registered: true };
  });

  app.post('/v1/notifications/test', async (request, reply) => {
    const { userId } = await requireUser(request);
    if (!await allowPersistentRequest(`push-test:${userId}`, 3)) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un momento antes de enviar otra prueba.' });
    if (!apnsConfigured()) return reply.code(503).send({ code: 'APNS_NOT_CONFIGURED', message: 'Falta configurar la llave APNs en el servidor.' });
    const devices = await notificationDevicesForUser(userId);
    const results = await Promise.all(devices.map(async (device) => {
      const result = await sendApplePush({ token: device.token, environment: device.environment, title: 'VITAMATE está listo', body: 'Tus recordatorios y VITACOACH pueden acompañarte durante el día.', path: '/recordatorios' });
      if (result.status === 410 || result.reason === 'BadDeviceToken' || result.reason === 'Unregistered') await deactivateNotificationDevice(device.id);
      return result;
    }));
    return { sent: results.filter((result) => result.status === 200).length, attempted: results.length };
  });
}

