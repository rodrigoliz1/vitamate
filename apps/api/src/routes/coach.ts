import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { OpenAiCoachProvider } from '../providers/openaiCoach.js';
import { compactCoachContext, selectRelevantMemories } from '../providers/coachContext.js';
import { listCoachMessages, loadCoachState, loadMessagesForCoachSummary, persistCoachCall, persistCoachExchange, persistCoachSummary, seedCoachMemories } from '../repositories/coachRepository.js';
import { allowPersistentRequest } from '../services/rateLimit.js';
import { tryDeterministicCoachReply } from '../services/coachDeterministic.js';
import { recordAiUsage } from '../services/openaiUsage.js';
import { config } from '../config.js';
import { verifySupabaseAccessToken } from '../services/supabase.js';
import { requirePremium } from '../repositories/billingRepository.js';

const provider = new OpenAiCoachProvider();

const finiteNumber = z.number().finite();
const bodySchema = z.object({
  locale: z.enum(['es-MX', 'en-US']).default('es-MX'),
  currentDateTime: z.string().datetime(),
  timezone: z.string().min(1).max(100),
  message: z.string().trim().min(1).max(1500),
  imageDataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(6_500_000).optional(),
  document: z.object({
    filename: z.string().trim().min(1).max(180),
    mimeType: z.literal('application/pdf'),
    dataUrl: z.string().regex(/^data:application\/pdf;base64,/).max(11_000_000),
  }).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(3000),
  })).max(12).default([]),
  clientMessage: z.object({
    id: z.string().uuid().optional(),
    content: z.string().trim().min(1).max(3000),
    createdAt: z.string().datetime().optional(),
  }).optional(),
  memory: z.array(z.object({
    key: z.string().min(3).max(120),
    category: z.enum(['identity', 'preference', 'goal', 'routine', 'motivation', 'constraint', 'relationship', 'health_context']),
    content: z.string().min(1).max(500),
    importance: z.number().int().min(1).max(5),
    confidence: z.number().min(0).max(1),
    expiresAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
  })).max(40).default([]),
  profile: z.object({
    preferredName: z.string().trim().min(1).max(80),
    primaryGoal: z.string().max(60),
    activityLevel: z.string().max(60),
    weeklyTrainingDays: z.number().int().min(0).max(7),
    trainingMinutes: z.number().int().min(0).max(300),
    equipment: z.string().max(300),
    dietaryPattern: z.string().max(60),
    coachStyle: z.string().max(60),
    favoriteFoods: z.array(z.string().max(100)).max(20).default([]),
    dislikedFoods: z.array(z.string().max(100)).max(20).default([]),
    allergies: z.array(z.string().max(100)).max(20).default([]),
    preferredCuisines: z.array(z.string().max(100)).max(20).default([]),
    mealsPerDay: z.number().int().min(2).max(8).default(3),
    cookingLevel: z.string().max(40).default('basic'),
    supplements: z.array(z.string().max(100)).max(20).default([]),
    trainingPreference: z.string().max(60).default('mixed'),
    preferredSport: z.string().max(120).default(''),
    mealPreparationPreference: z.string().max(60).default('cook_fresh'),
    mealPrepStructure: z.string().max(60).default('same_by_meal'),
    mealPrepRotationDays: z.number().int().min(1).max(7).default(3),
    weeklyFoodBudgetMxn: finiteNumber.min(0).max(100000).default(1400),
    safetyFlags: z.array(z.string().max(80)).max(10),
  }),
  nutritionTarget: z.object({
    status: z.string().max(80),
    calories: finiteNumber.nullable(),
    proteinG: finiteNumber.nullable(),
    carbohydratesG: finiteNumber.nullable(),
    fatG: finiteNumber.nullable(),
  }).optional(),
  recentWorkouts: z.array(z.object({
    title: z.string().max(160),
    durationMinutes: finiteNumber.min(0).max(1000),
    perceivedEffort: finiteNumber.min(1).max(10),
    completedAt: z.string().datetime(),
  })).max(5).default([]),
  availableWorkouts: z.array(z.object({
    title: z.string().max(160), focus: z.string().max(200), durationMinutes: finiteNumber.min(0).max(300),
    exercises: z.array(z.string().max(160)).max(12),
  })).max(7).default([]),
  todayNutrition: z.object({
    calories: finiteNumber.min(0), proteinG: finiteNumber.min(0), carbohydratesG: finiteNumber.min(0), fatG: finiteNumber.min(0),
  }).optional(),
  weeklyNutrition: z.object({
    consumed: z.object({ calories: finiteNumber, proteinG: finiteNumber, carbohydratesG: finiteNumber, fatG: finiteNumber }),
    target: z.object({ calories: finiteNumber, proteinG: finiteNumber, carbohydratesG: finiteNumber, fatG: finiteNumber }),
    balance: z.object({ calories: finiteNumber, proteinG: finiteNumber, carbohydratesG: finiteNumber, fatG: finiteNumber }),
  }).optional(),
  weeklyWorkout: z.object({
    sessions: finiteNumber, targetSessions: finiteNumber, minutes: finiteNumber, targetMinutes: finiteNumber,
    caloriesBurned: finiteNumber, targetCalories: finiteNumber, remainingMinutes: finiteNumber, remainingCalories: finiteNumber,
  }).optional(),
  weightTrend: z.object({ latestKg: finiteNumber.positive(), previousKg: finiteNumber.positive().nullable() }).optional(),
  healthDocuments: z.array(z.object({ filename: z.string().max(180), uploadedAt: z.string().datetime(), summary: z.string().max(5000) })).max(10).default([]),
  healthSummary: z.object({ stepsToday: finiteNumber.min(0).optional(), restingHeartRate: finiteNumber.min(0).optional(), activeCaloriesToday: finiteNumber.min(0).optional(), source: z.string().max(60) }).optional(),
  mealPlanContext: z.string().max(60_000).optional(),
  planChangeTarget: z.object({
    type: z.enum(['replace_meal', 'replace_ingredient']),
    slotId: z.string().max(160).optional(),
    ingredient: z.string().max(240).optional(),
  }).optional(),
});

const realtimeSchema = bodySchema.omit({ message: true, history: true, clientMessage: true, memory: true, imageDataUrl: true, document: true });
const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  before: z.string().datetime().optional(),
});
const callEventSchema = z.object({
  locale: z.enum(['es-MX', 'en-US']).default('es-MX'),
  durationSeconds: z.number().finite().int().min(0).max(86_400),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});

async function authenticatedIdentity(request: { headers: { authorization?: string }; ip: string }) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const userId = token ? await verifySupabaseAccessToken(token) : null;
  return { token, userId };
}

export async function coachRoutes(app: FastifyInstance) {
  app.get('/v1/coach/history', async (request, reply) => {
    const { token, userId } = await authenticatedIdentity(request);
    if (token && !userId) return reply.code(401).send({ code: 'INVALID_SESSION', message: 'Tu sesión venció. Vuelve a iniciar sesión.' });
    if (!userId) return reply.code(401).send({ code: 'AUTH_REQUIRED', message: 'Inicia sesión para recuperar tu conversación.' });
    await requirePremium(userId);
    const query = historyQuerySchema.parse(request.query);
    return { messages: await listCoachMessages(userId, query.limit, query.before) };
  });

  app.post('/v1/coach/chat', async (request, reply) => {
    const { token, userId } = await authenticatedIdentity(request);
    if (token && !userId) return reply.code(401).send({ code: 'INVALID_SESSION', message: 'Tu sesión venció. Vuelve a iniciar sesión.' });
    if (!userId) return reply.code(401).send({ code: 'AUTH_REQUIRED', message: 'Inicia sesión para hablar con VITACOACH.' });
    await requirePremium(userId);
    if (!await allowPersistentRequest(`coach:${userId}`, 20)) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un momento antes de enviar otro mensaje.' });
    const body = bodySchema.parse(request.body);
    const safetyIdentifier = createHash('sha256').update(`vitamate:${userId}`).digest('hex');
    let durableState = null;
    if (userId) {
      try {
        durableState = await loadCoachState(userId);
      } catch (error) {
        request.log.error({ error, userId }, 'No fue posible cargar el historial durable de VITACOACH; se usará el contexto local.');
      }
    }
    if (userId && durableState && !durableState.memories.length && body.memory.length) {
      await seedCoachMemories(userId, body.memory);
      durableState.memories = body.memory.map((memory) => ({ key: memory.key, category: memory.category, content: memory.content, importance: memory.importance, lastConfirmedAt: memory.updatedAt }));
    }
    const modelContext = {
      locale: body.locale,
      currentDateTime: body.currentDateTime,
      timezone: body.timezone,
      profile: body.profile,
      nutritionTarget: body.nutritionTarget,
      recentWorkouts: body.recentWorkouts,
      availableWorkouts: body.availableWorkouts,
      todayNutrition: body.todayNutrition,
      weeklyNutrition: body.weeklyNutrition,
      weeklyWorkout: body.weeklyWorkout,
      weightTrend: body.weightTrend,
      healthDocuments: body.healthDocuments,
      healthSummary: body.healthSummary,
      mealPlanContext: body.mealPlanContext,
      planChangeTarget: body.planChangeTarget,
    };
    const response = await tryDeterministicCoachReply(body.message, body.currentDateTime, body.timezone, body.locale) ?? await provider.reply(
      modelContext,
      durableState?.messages ?? body.history,
      body.message,
      { imageDataUrl: body.imageDataUrl, document: body.document },
      durableState?.memories ?? body.memory.map((memory) => ({ key: memory.key, category: memory.category, content: memory.content, importance: memory.importance, lastConfirmedAt: memory.updatedAt })),
      durableState?.conversationSummary ?? '',
      safetyIdentifier,
    );
    if (response.model !== 'none') {
      request.log.info({ userId, task: response.task, model: response.model, usage: response.usage }, 'Consumo de VITACOACH');
      await recordAiUsage({ userId, task: `coach_${response.task}`, model: response.model, usage: response.usage, metadata: { historyMessages: (durableState?.messages ?? body.history).length } })
        .catch((error) => request.log.warn({ error, userId }, 'No fue posible guardar la telemetría de tokens.'));
    }
    const fallbackAssistantMessage = { id: randomUUID(), role: 'assistant' as const, content: response.message, createdAt: new Date().toISOString() };
    let persisted = null;
    if (userId && durableState) {
      try {
        persisted = await persistCoachExchange({
          userId,
          threadId: durableState.threadId,
          clientMessage: body.clientMessage ?? { content: body.message },
          assistantContent: response.message,
          memoryUpdates: response.memoryUpdates,
        });
      } catch (error) {
        request.log.error({ error, userId }, 'OpenAI respondió, pero no fue posible persistir el intercambio de VITACOACH.');
      }
    }
    const nextMessageCount = (durableState?.totalMessageCount ?? 0) + (persisted ? 2 : 0);
    if (persisted && durableState && nextMessageCount - durableState.summarizedMessageCount >= 20) {
      try {
        const messages = await loadMessagesForCoachSummary(durableState.threadId, 24);
        const summary = await provider.summarize(durableState.conversationSummary, messages, safetyIdentifier);
        await Promise.all([
          persistCoachSummary({ userId, threadId: durableState.threadId, summary: summary.summary, summarizedMessageCount: nextMessageCount }),
          recordAiUsage({ userId, task: 'coach_summary', model: summary.model, usage: summary.usage, metadata: { messages: messages.length } }),
        ]);
      } catch (error) {
        request.log.warn({ error, userId }, 'No fue posible actualizar el resumen durable de VITACOACH.');
      }
    }
    return {
      response: response.message,
      action: response.action,
      assistantMessage: persisted?.assistantMessage ?? fallbackAssistantMessage,
      memoryUpdated: persisted?.memoryUpdated ?? false,
      memoryUpdates: response.memoryUpdates,
    };
  });

  app.post('/v1/coach/calls', async (request, reply) => {
    const { token, userId } = await authenticatedIdentity(request);
    if (token && !userId) return reply.code(401).send({ code: 'INVALID_SESSION', message: 'Tu sesión venció. Vuelve a iniciar sesión.' });
    if (!userId) return reply.code(401).send({ code: 'AUTH_REQUIRED', message: 'Inicia sesión para llamar a VITACOACH.' });
    await requirePremium(userId);
    const body = callEventSchema.parse(request.body);
    const duration = Math.max(0, body.durationSeconds);
    const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
    const seconds = (duration % 60).toString().padStart(2, '0');
    const fallbackMessage = {
      id: randomUUID(), role: 'assistant' as const,
      content: body.locale === 'en-US' ? `📞 Voice call with VITACOACH · ${minutes}:${seconds}` : `📞 Llamada con VITACOACH · ${minutes}:${seconds}`,
      createdAt: body.endedAt,
    };
    try {
      return { assistantMessage: await persistCoachCall({ userId, ...body }), persisted: true };
    } catch (error) {
      request.log.error({ error, userId }, 'No fue posible persistir el evento de llamada de VITACOACH.');
      return { assistantMessage: fallbackMessage, persisted: false };
    }
  });

  app.post('/v1/coach/realtime-token', async (request, reply) => {
    const { token, userId } = await authenticatedIdentity(request);
    if (token && !userId) return reply.code(401).send({ code: 'INVALID_SESSION', message: 'Tu sesión venció. Vuelve a iniciar sesión.' });
    if (!userId) return reply.code(401).send({ code: 'AUTH_REQUIRED', message: 'Inicia sesión para llamar a VITACOACH.' });
    await requirePremium(userId);
    if (!config.OPENAI_API_KEY) return reply.code(503).send({ code: 'REALTIME_NOT_CONFIGURED', message: 'La llamada Realtime todavía no está configurada.' });
    if (!await allowPersistentRequest(`realtime:${userId}`, 8)) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Espera un momento antes de iniciar otra llamada.' });
    const context = realtimeSchema.parse(request.body);
    const durableState = userId ? await loadCoachState(userId, 8) : null;
    const safetyIdentifier = createHash('sha256').update(`vitamate:${userId ?? request.ip}`).digest('hex');
    const realtimeContext = compactCoachContext(context, 'progress');
    const realtimeMemory = selectRelevantMemories('', 'progress', durableState?.memories ?? []);
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': safetyIdentifier,
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: config.OPENAI_REALTIME_MODEL,
          instructions: `Eres VITACOACH en una llamada de voz. Responde en ${context.locale}; sé cálido, natural y conciso. No afirmes ser profesional clínico ni diagnostiques o prescribas. Usa estos datos sólo cuando sean relevantes: ${JSON.stringify({ context: realtimeContext, conversationSummary: durableState?.conversationSummary ?? '', memory: realtimeMemory })}. Ante cansancio considera sueño, hidratación, alimentación, estrés, síntomas y carga. Si la persona afirma que ya comió, bebió o terminó una actividad, usa record_reported_update antes de confirmar el registro. Ante dolor de pecho, desmayo o dificultad respiratoria intensa indica suspender y buscar atención urgente.`,
          audio: { output: { voice: config.OPENAI_REALTIME_VOICE } },
          tools: [{
            type: 'function',
            name: 'record_reported_update',
            description: 'Registra una comida/bebida ya consumida o actividad ya realizada por la persona. Úsala sólo cuando lo afirme como hecho, no para planes o hipótesis.',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: { transcript: { type: 'string', description: 'La frase exacta y completa de la persona.' } },
              required: ['transcript'],
            },
          }],
          tool_choice: 'auto',
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return reply.code(502).send({ code: 'REALTIME_TOKEN_FAILED', message: `OpenAI Realtime respondió ${response.status}.` });
    return response.json();
  });
}
