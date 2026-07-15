import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GroceryEstimator } from '../services/groceryEstimator.js';
import { allowPersistentRequest } from '../services/rateLimit.js';
import { requireUser } from '../services/auth.js';
import { requirePremium } from '../repositories/billingRepository.js';

const estimator = new GroceryEstimator();

const unit = z.enum(['g', 'ml', 'pieza']);

export async function marketPriceRoutes(app: FastifyInstance) {
  app.post('/v1/nutrition/grocery-estimate', async (request, reply) => {
    const { userId } = await requireUser(request);
    await requirePremium(userId);
    if (!await allowPersistentRequest(`grocery:${userId}`, 20)) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un momento antes de recalcular la lista.' });
    const body = z.object({
      city: z.string().trim().min(2).max(120),
      state: z.string().trim().min(2).max(120),
      periodDays: z.number().int().min(1).max(31).default(7),
      people: z.number().int().min(1).max(20).default(1),
      weekStart: z.string().date().optional(),
      weeklyBudgetMxn: z.number().finite().min(0).max(100000).optional(),
      items: z.array(z.object({ id: z.string().min(1).max(240), name: z.string().trim().min(1).max(180), quantity: z.number().positive().max(1_000_000), unit })).min(1).max(200),
    }).parse(request.body);
    return { estimate: await estimator.estimate(body) };
  });
}
