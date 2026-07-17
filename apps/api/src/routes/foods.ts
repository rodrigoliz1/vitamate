import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FoodRepository } from '../repositories/foodRepository.js';
import { OpenAiFoodVisionProvider } from '../providers/openaiFoodVision.js';
import { OpenFoodFactsProvider } from '../providers/openFoodFacts.js';
import { UsdaProvider } from '../providers/usda.js';
import { allowPersistentRequest } from '../services/rateLimit.js';
import { toPublicFood } from '../types.js';
import { requireUser } from '../services/auth.js';
import { requirePremium } from '../repositories/billingRepository.js';
import { recordAiUsage } from '../services/openaiUsage.js';
import { enrichPhotoFoodAnalysis } from '../services/photoFoodEnrichment.js';

const repository = new FoodRepository();
const off = new OpenFoodFactsProvider();
const usda = new UsdaProvider();
const vision = new OpenAiFoodVisionProvider();

export async function foodRoutes(app: FastifyInstance) {
  app.get('/v1/foods/search', async (request, reply) => {
    const { q, external } = z.object({ q: z.string().trim().min(2).max(100), external: z.enum(['true', 'false']).default('true') }).parse(request.query);
    const internal = await repository.search(q);
    if (external !== 'true') return { items: internal.map(toPublicFood), source: 'internal' };
    // El catálogo local siempre es la respuesta base. USDA lo complementa de forma
    // transparente cuando está disponible, sin convertir una caída externa en un error de UI.
    if (!usda.isConfigured) {
      request.log.warn('USDA no está configurado; se respondió sólo con el catálogo VITAMATE.');
      return { items: internal.map(toPublicFood), source: 'internal', externalStatus: 'unavailable' };
    }
    if (!await allowPersistentRequest(`usda:${request.ip}`, 20)) {
      return { items: internal.map(toPublicFood), source: 'internal', externalStatus: 'rate_limited' };
    }

    try {
      const items = await usda.search(q);
      const stored = await Promise.allSettled(items.slice(0, 20).map((item) => repository.upsert(item)));
      const saved = stored.map((result, index) => result.status === 'fulfilled' ? result.value : items[index]);
      const combined = [...internal, ...saved].filter((item, index, all) => all.findIndex((candidate) => candidate.source === item.source && candidate.externalId === item.externalId) === index);
      return { items: combined.map(toPublicFood), source: 'internal+usda', externalStatus: 'ok' };
    } catch (error) {
      request.log.warn({ error, query: q }, 'No fue posible complementar la búsqueda con USDA.');
      return { items: internal.map(toPublicFood), source: 'internal', externalStatus: 'unavailable' };
    }
  });

  app.get('/v1/foods/barcode/:barcode', async (request, reply) => {
    const { barcode } = z.object({ barcode: z.string().regex(/^\d{8,14}$/) }).parse(request.params);
    const cached = await repository.findByBarcode(barcode);
    if (cached) return { item: toPublicFood(cached), cached: true };
    if (!await allowPersistentRequest(`off:${request.ip}`, 12)) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un minuto antes de escanear otro producto.' });
    const external = await off.getByBarcode(barcode);
    if (!external || external.qualityStatus === 'rejected') return reply.code(404).send({ code: 'FOOD_NOT_FOUND', message: 'No encontramos datos nutricionales confiables para este producto.' });
    return { item: toPublicFood(await repository.upsert(external)), cached: false };
  });

  app.post('/v1/foods/analyze-photo', { bodyLimit: 7_000_000 }, async (request, reply) => {
    const { userId } = await requireUser(request);
    await requirePremium(userId);
    if (!await allowPersistentRequest(`photo:${userId}`, 6)) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera antes de analizar otra fotografía.' });
    const body = z.object({
      imageDataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(7_000_000),
      locale: z.enum(['es-MX', 'en-US']).default('es-MX'),
    }).parse(request.body);
    const result = await vision.analyze(body.imageDataUrl, body.locale, createHash('sha256').update(`vitamate:${userId}`).digest('hex'));
    const analysis = await enrichPhotoFoodAnalysis(result.analysis, body.locale);
    request.log.info({ userId, model: result.model, usage: result.usage }, 'Consumo de análisis de alimento');
    await recordAiUsage({ userId, task: 'food_photo', model: result.model, usage: result.usage, metadata: { imageBytesApprox: Math.round(body.imageDataUrl.length * 0.75) } })
      .catch((error) => request.log.warn({ error, userId }, 'No fue posible guardar la telemetría de la fotografía.'));
    return { analysis };
  });
}
