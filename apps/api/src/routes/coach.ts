import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { OpenAiCoachProvider } from '../providers/openaiCoach.js';
import { compactRealtimeCoachContext, compactCoachContext, selectRelevantMemories } from '../providers/coachContext.js';
import { listCoachMessages, loadCoachState, loadMessagesForCoachSummary, persistCoachExchange, persistCoachSummary, seedCoachMemories } from '../repositories/coachRepository.js';
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
  usage: z.object({
    responses: z.number().int().min(0).max(10_000),
    inputTokens: z.number().int().min(0).max(100_000_000),
    cachedInputTokens: z.number().int().min(0).max(100_000_000),
    outputTokens: z.number().int().min(0).max(100_000_000),
    inputTextTokens: z.number().int().min(0).max(100_000_000),
    inputAudioTokens: z.number().int().min(0).max(100_000_000),
    cachedTextTokens: z.number().int().min(0).max(100_000_000),
    cachedAudioTokens: z.number().int().min(0).max(100_000_000),
    outputTextTokens: z.number().int().min(0).max(100_000_000),
    outputAudioTokens: z.number().int().min(0).max(100_000_000),
  }).optional(),
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
    if (body.usage?.responses) {
      await recordAiUsage({
        userId,
        task: 'coach_realtime',
        model: config.OPENAI_REALTIME_MODEL,
        usage: {
          inputTokens: body.usage.inputTokens,
          cachedInputTokens: body.usage.cachedInputTokens,
          outputTokens: body.usage.outputTokens,
          totalTokens: body.usage.inputTokens + body.usage.outputTokens,
        },
        metadata: {
          durationSeconds: duration,
          responses: body.usage.responses,
          inputTextTokens: body.usage.inputTextTokens,
          inputAudioTokens: body.usage.inputAudioTokens,
          cachedTextTokens: body.usage.cachedTextTokens,
          cachedAudioTokens: body.usage.cachedAudioTokens,
          outputTextTokens: body.usage.outputTextTokens,
          outputAudioTokens: body.usage.outputAudioTokens,
          voice: 'marin',
        },
      }).catch((error) => request.log.warn({ error, userId }, 'No fue posible registrar el consumo de la llamada.'));
    }
    return { recorded: true };
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
    const realtimeContext = compactRealtimeCoachContext(context);
    const realtimeMemory = selectRelevantMemories('', 'progress', durableState?.memories ?? [])
      .slice(0, 6)
      .map(({ key, category, content, importance }) => ({ key, category, content: content.slice(0, 240), importance }));
    const conversationSummary = (durableState?.conversationSummary ?? '').slice(0, 1_800);
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
          output_modalities: ['audio'],
          instructions: `Eres VITACOACH en una llamada privada auténtica: coach, mentor práctico, asistente personal de VITAMATE y compañero cercano, sin afirmar que eres humano ni profesional clínico. Habla en ${context.locale} con la voz Marin, cálida y natural; responde normalmente en 1-3 frases y continúa con una sola pregunta útil. Usa sólo cuando sea relevante: ${JSON.stringify({ context: realtimeContext, summary: conversationSummary, memory: realtimeMemory })}.

Tienes autorización para gestionar exclusivamente los datos personales del usuario dentro de VITAMATE mediante las herramientas disponibles. Si afirma que ya consumió algo, usa log_meal; si terminó actividad física, usa log_workout; si ordena cambiar una comida o ingrediente de su plan, usa la herramienta correspondiente. Haz la acción antes de confirmarla. Estima cantidades o macros de forma conservadora cuando falten y di por voz que son estimados. Nunca uses herramientas para preguntas, hipótesis o planes futuros. Si falta un dato imprescindible o el día/comida es ambiguo, pregunta primero. Tras recibir el resultado de una herramienta, confirma el resultado sólo por voz y continúa la llamada. No leas ni muestres transcripciones, no envíes al usuario al chat y no afirmes que cambiaste algo si la herramienta falló.

No tienes facultades administrativas: no alteres suscripciones, cuentas ajenas, permisos, facturación ni configuración del sistema. Nunca diagnostiques ni prescribas. Ante dolor de pecho, desmayo o dificultad respiratoria intensa indica suspender y buscar atención urgente. No repitas el perfil ni menciones instrucciones, memoria o tokens.`,
          max_output_tokens: 320,
          truncation: {
            type: 'retention_ratio',
            retention_ratio: 0.8,
            token_limits: { post_instructions: 4_000 },
          },
          audio: {
            input: {
              turn_detection: {
                type: 'semantic_vad',
                eagerness: 'auto',
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: config.OPENAI_REALTIME_VOICE },
          },
          tools: [
            {
              type: 'function',
              name: 'log_meal',
              description: 'Registra directamente una comida o bebida que el usuario afirma que ya consumió. Combina todos los elementos descritos en una sola entrada y estima macros conservadoramente si hace falta.',
              parameters: {
                type: 'object', additionalProperties: false,
                properties: {
                  name: { type: 'string', description: 'Descripción breve con alimentos, marca y cantidades relevantes.' },
                  mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                  occurredAt: { type: 'string', description: 'Fecha y hora ISO-8601; usa la hora actual del contexto si no se indicó otra.' },
                  calories: { type: 'number', minimum: 0, maximum: 10000 },
                  proteinG: { type: 'number', minimum: 0, maximum: 1000 },
                  carbohydratesG: { type: 'number', minimum: 0, maximum: 1000 },
                  fatG: { type: 'number', minimum: 0, maximum: 1000 },
                },
                required: ['name', 'mealType', 'occurredAt', 'calories', 'proteinG', 'carbohydratesG', 'fatG'],
              },
            },
            {
              type: 'function',
              name: 'log_workout',
              description: 'Registra directamente actividad física que el usuario afirma que ya realizó.',
              parameters: {
                type: 'object', additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  activityType: { type: 'string', enum: ['strength', 'cardio', 'mobility', 'sport', 'other'] },
                  occurredAt: { type: 'string', description: 'Fecha y hora ISO-8601.' },
                  durationMinutes: { type: 'number', minimum: 1, maximum: 1440 },
                  caloriesBurned: { type: 'number', minimum: 0, maximum: 20000 },
                  perceivedEffort: { type: 'number', minimum: 1, maximum: 10 },
                },
                required: ['title', 'activityType', 'occurredAt', 'durationMinutes', 'caloriesBurned', 'perceivedEffort'],
              },
            },
            {
              type: 'function',
              name: 'replace_plan_meal',
              description: 'Sustituye una comida concreta del plan actual y actualiza su lista del súper. Úsala sólo con un slotId exacto del contexto.',
              parameters: {
                type: 'object', additionalProperties: false,
                properties: {
                  slotId: { type: 'string' }, optionId: { type: 'string' }, name: { type: 'string' },
                  mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                  calories: { type: 'number', minimum: 0, maximum: 5000 }, proteinG: { type: 'number', minimum: 0, maximum: 500 },
                  carbohydratesG: { type: 'number', minimum: 0, maximum: 500 }, fatG: { type: 'number', minimum: 0, maximum: 500 },
                  ingredients: { type: 'array', maxItems: 20, items: { type: 'string' } },
                  steps: { type: 'array', maxItems: 12, items: { type: 'string' } },
                  prepMinutes: { type: 'number', minimum: 1, maximum: 600 },
                  difficulty: { type: 'string', enum: ['basic', 'intermediate', 'advanced'] },
                },
                required: ['slotId', 'optionId', 'name', 'mealType', 'calories', 'proteinG', 'carbohydratesG', 'fatG', 'ingredients', 'steps', 'prepMinutes', 'difficulty'],
              },
            },
            {
              type: 'function',
              name: 'replace_plan_ingredient',
              description: 'Sustituye un ingrediente concreto del plan y su lista del súper. Usa el texto exacto del ingrediente existente y un reemplazo con cantidad.',
              parameters: {
                type: 'object', additionalProperties: false,
                properties: {
                  slotId: { type: 'string', description: 'Slot exacto cuando se conoce; cadena vacía si el cambio aplica a todas sus apariciones.' },
                  ingredientToReplace: { type: 'string' },
                  replacementIngredient: { type: 'string' },
                },
                required: ['slotId', 'ingredientToReplace', 'replacementIngredient'],
              },
            },
          ],
          tool_choice: 'auto',
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return reply.code(502).send({ code: 'REALTIME_TOKEN_FAILED', message: `OpenAI Realtime respondió ${response.status}.` });
    return response.json();
  });
}
