import { FoodRepository } from '../repositories/foodRepository.js';
import type { CoachReply } from '../providers/openaiCoach.js';
import type { NormalizedFood } from '../types.js';

const foods = new FoodRepository();
const COMMON_PORTION_GRAMS: Record<string, number> = {
  apple: 180,
  banana: 118,
  egg: 50,
  'corn-tortilla': 28,
  'flour-tortilla': 45,
  beans: 120,
  avocado: 150,
  machaca: 100,
  beef: 100,
  'salsa-macha': 15,
};

export async function tryDeterministicCoachReply(message: string, currentDateTime: string, timezone: string, locale: 'es-MX' | 'en-US'): Promise<CoachReply | null> {
  const sleep = extractSleepLog(message);
  if (sleep) {
    const endedAt = new Date(currentDateTime);
    const startedAt = new Date(endedAt.getTime() - sleep.durationMinutes * 60_000);
    const label = durationLabel(sleep.durationMinutes, locale);
    return {
      ...noModelReply(locale === 'en-US' ? `I registered ${label} of sleep.` : `Registré ${label} de sueño.`, 'sleep_log'),
      action: { type: 'log_sleep', sleep: { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), durationMinutes: sleep.durationMinutes, quality: sleep.quality } },
    };
  }

  const workout = extractWorkoutLog(message);
  if (workout) {
    const caloriesBurned = Math.round(workout.durationMinutes * workout.kcalPerMinute);
    const replyMessage = locale === 'en-US'
      ? `I registered ${workout.title}: ${durationLabel(workout.durationMinutes, locale)} and an estimated ${caloriesBurned} active kcal. You can undo it if needed.`
      : `Registré ${workout.title}: ${durationLabel(workout.durationMinutes, locale)} y aproximadamente ${caloriesBurned} kcal activas. Puedes deshacerlo si hace falta.`;
    return {
      ...noModelReply(replyMessage, 'workout_log'),
      action: { type: 'log_workout', workout: { title: workout.title, activityType: workout.activityType, occurredAt: new Date(currentDateTime).toISOString(), durationMinutes: workout.durationMinutes, caloriesBurned, perceivedEffort: workout.perceivedEffort } },
    };
  }

  const compositeMeal = await extractCompositeMealLog(message, currentDateTime, timezone, locale);
  if (compositeMeal) return compositeMeal;

  const lookup = extractLookup(message);
  if (lookup) {
    const food = await bestFood(lookup);
    if (!food) return null;
    const grams = COMMON_PORTION_GRAMS[food.externalId ?? ''] ?? food.servingWeightGrams ?? 100;
    const macros = macrosFor(food, grams);
    const replyMessage = locale === 'en-US'
      ? `${food.name}: an estimated ${grams} g serving provides ${macros.calories} kcal, ${macros.proteinG} g protein, ${macros.carbohydratesG} g carbohydrates and ${macros.fatG} g fat. Adjust the amount if your serving was different.`
      : `${food.name}: una porción estimada de ${grams} g aporta ${macros.calories} kcal, ${macros.proteinG} g de proteína, ${macros.carbohydratesG} g de carbohidratos y ${macros.fatG} g de grasa. Ajusta la cantidad si tu porción fue distinta.`;
    return noModelReply(replyMessage, 'nutrition');
  }

  const log = extractSimpleFoodLog(message);
  if (!log) return null;
  const food = await bestFood(log.food);
  if (!food) return null;
  const baseGrams = COMMON_PORTION_GRAMS[food.externalId ?? ''] ?? food.servingWeightGrams ?? 100;
  const grams = log.unit === 'g' ? log.quantity : log.unit === 'kg' ? log.quantity * 1000 : baseGrams * log.quantity;
  const macros = macrosFor(food, grams);
  const occurredAt = new Date(currentDateTime).toISOString();
  const mealType = inferMealType(new Date(currentDateTime), timezone);
  const replyMessage = locale === 'en-US'
    ? `I registered ${food.name} (${Math.round(grams)} g) as an estimate. You can undo it if the portion was different.`
    : `Registré ${food.name} (${Math.round(grams)} g) como estimación. Puedes deshacerlo si la porción fue distinta.`;
  return {
    ...noModelReply(replyMessage, 'meal_log'),
    action: { type: 'log_meal', meal: { name: `${food.name} · ${Math.round(grams)} g`, mealType, occurredAt, ...macros } },
  };
}

async function extractCompositeMealLog(message: string, currentDateTime: string, timezone: string, locale: 'es-MX' | 'en-US'): Promise<CoachReply | null> {
  const parsed = consumedMealDescription(message);
  if (!parsed) return null;
  const segments = parsed.description
    .replace(/\s+(?:y|e|con)\s+/gi, ',')
    .split(/[,;]+/)
    .map((item) => item.trim().replace(/^(?:y|e)\s+/i, ''))
    .filter(Boolean);
  if (!segments.length || segments.length > 12) return null;
  const ingredients = await Promise.all(segments.map(resolveMealIngredient));
  if (ingredients.some((ingredient) => !ingredient)) return null;
  const resolved = ingredients.filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient));
  const totals = resolved.reduce(
    (summary, ingredient) => ({
      calories: summary.calories + ingredient.macros.calories,
      proteinG: summary.proteinG + ingredient.macros.proteinG,
      carbohydratesG: summary.carbohydratesG + ingredient.macros.carbohydratesG,
      fatG: summary.fatG + ingredient.macros.fatG,
    }),
    { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 },
  );
  const mealType = parsed.mealType ?? inferMealType(new Date(currentDateTime), timezone);
  const mealName = segments.join(', ').slice(0, 180);
  const rounded = {
    calories: Math.round(totals.calories),
    proteinG: Math.round(totals.proteinG * 10) / 10,
    carbohydratesG: Math.round(totals.carbohydratesG * 10) / 10,
    fatG: Math.round(totals.fatG * 10) / 10,
  };
  const replyMessage = locale === 'en-US'
    ? `I registered ${mealName} as an estimate: ${rounded.calories} kcal and ${rounded.proteinG} g protein. You can edit or undo it.`
    : `Registré ${mealName} como estimación: ${rounded.calories} kcal y ${rounded.proteinG} g de proteína. Puedes editarlo o deshacerlo.`;
  return {
    ...noModelReply(replyMessage, 'meal_log'),
    action: {
      type: 'log_meal',
      meal: {
        name: mealName,
        mealType,
        occurredAt: new Date(currentDateTime).toISOString(),
        ...rounded,
      },
    },
  };
}

function consumedMealDescription(message: string): { description: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null } | null {
  const text = message.trim().replace(/[.!?]+$/, '');
  const consumed = text.match(/^(?:(?:hoy|ya)\s+)?(?:me\s+)?(desayun[eé]|almorc[eé]|com[ií]|cen[eé]|tom[eé]|beb[ií])\s+(.+)$/i);
  if (consumed?.[2]) {
    const verb = normalizeFoodText(consumed[1]);
    return {
      description: consumed[2],
      mealType: verb.startsWith('desayun') ? 'breakfast' : verb.startsWith('cen') ? 'dinner' : verb.startsWith('almorc') || verb === 'comi' ? 'lunch' : 'snack',
    };
  }
  const described = text.match(/^(?:mi\s+)?(desayuno|comida|almuerzo|cena|colaci[oó]n)\s+(?:fue|era|consisti[oó]|incluy[oó]|ten[ií]a)\s+(.+)$/i);
  if (described?.[2]) {
    const noun = normalizeFoodText(described[1]);
    return { description: described[2], mealType: noun === 'desayuno' ? 'breakfast' : noun === 'cena' ? 'dinner' : noun === 'colacion' ? 'snack' : 'lunch' };
  }
  const requested = text.match(/^(?:registra|reg[ií]strame|agrega|agr[eé]game|a[nñ]ade)\s+(?:(?:mi|el|la)\s+)?(?:(desayuno|comida|almuerzo|cena|colaci[oó]n)\s+)?(.+)$/i);
  if (!requested?.[2]) return null;
  const noun = normalizeFoodText(requested[1] ?? '');
  return { description: requested[2], mealType: noun === 'desayuno' ? 'breakfast' : noun === 'cena' ? 'dinner' : noun === 'colacion' ? 'snack' : noun ? 'lunch' : null };
}

async function resolveMealIngredient(segment: string): Promise<{ macros: ReturnType<typeof macrosFor> } | null> {
  const normalized = normalizeFoodText(segment);
  let quantity = 1;
  let unit: 'count' | 'g' = 'count';
  let query = normalized;
  if (/^(?:un|una)\s+poco\s+de\s+/.test(query)) {
    quantity = 15;
    unit = 'g';
    query = query.replace(/^(?:un|una)\s+poco\s+de\s+/, '');
  } else if (/^(?:una?\s+)?guarnicion\s+de\s+/.test(query)) {
    quantity = 120;
    unit = 'g';
    query = query.replace(/^(?:una?\s+)?guarnicion\s+de\s+/, '');
  } else {
    const amount = query.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?|ml|mililitros?)?\s*(?:de\s+)?(.+)$/);
    if (amount?.[3]) {
      quantity = Number(amount[1].replace(',', '.'));
      const rawUnit = amount[2] ?? '';
      unit = rawUnit ? 'g' : 'count';
      if (rawUnit.startsWith('k')) quantity *= 1_000;
      query = amount[3];
    } else {
      const wordAmount = query.match(/^(un|una|dos|tres|cuatro|cinco|seis)\s+(.+)$/);
      if (wordAmount?.[2]) {
        quantity = ({ un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 } as Record<string, number>)[wordAmount[1]];
        query = wordAmount[2];
      }
    }
  }
  const food = await bestFood(canonicalFoodQuery(query));
  if (!food) return null;
  const grams = unit === 'g' ? quantity : (COMMON_PORTION_GRAMS[food.externalId ?? ''] ?? food.servingWeightGrams ?? 100) * quantity;
  return { macros: macrosFor(food, grams) };
}

function canonicalFoodQuery(value: string): string {
  const query = normalizeFoodText(value).replace(/^(?:el|la|los|las|de)\s+/, '').trim();
  if (/tortilla.*(?:maiz|mais)/.test(query)) return 'tortilla de maiz';
  if (/tortilla.*harina/.test(query)) return 'tortilla de harina';
  if (/huevo/.test(query)) return 'huevo';
  if (/frijol/.test(query)) return 'frijoles';
  if (/machaca/.test(query)) return 'machaca';
  if (/salsa\s+macha/.test(query)) return 'salsa macha';
  if (/carne|res/.test(query)) return 'carne de res';
  return query.replace(/\b(cocid[ao]s?|cru[do]s?)\b/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeFoodText(value: string): string {
  return value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function extractDurationMinutes(message: string): number | null {
  const hourMatch = message.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hrs?|horas?)\b/i);
  const minuteMatch = message.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minutos?)\b/i);
  const hours = hourMatch ? Number(hourMatch[1].replace(',', '.')) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1].replace(',', '.')) : 0;
  const total = Math.round(hours + minutes);
  return Number.isFinite(total) && total > 0 ? Math.min(1_440, total) : null;
}

function extractSleepLog(message: string): { durationMinutes: number; quality?: 1 | 2 | 3 | 4 | 5 } | null {
  const normalized = message.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/(dormi|he dormido|descanse|sueno)/.test(normalized)) return null;
  const durationMinutes = extractDurationMinutes(normalized);
  if (!durationMinutes || durationMinutes < 30) return null;
  const quality = /muy bien|excelente|profundo/.test(normalized) ? 5 : /bien|descansad/.test(normalized) ? 4 : /muy mal|pesimo/.test(normalized) ? 1 : /mal|interrumpido/.test(normalized) ? 2 : undefined;
  return { durationMinutes, quality };
}

function extractWorkoutLog(message: string): { title: string; durationMinutes: number; activityType: 'strength' | 'cardio' | 'mobility' | 'sport' | 'other'; kcalPerMinute: number; perceivedEffort: number } | null {
  const normalized = message.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const completed = /(hice|entrene|corri|camine|termine|jugue|practique|nade|pedalee|registre|registrame|registralo|registra)/.test(normalized);
  const durationMinutes = extractDurationMinutes(normalized);
  if (!completed || !durationMinutes) return null;
  const activities = [
    { pattern: /tenis|tennis/, title: 'Tenis', activityType: 'sport' as const, kcalPerMinute: 7, perceivedEffort: 7 },
    { pattern: /padel/, title: 'Pádel', activityType: 'sport' as const, kcalPerMinute: 6.5, perceivedEffort: 7 },
    { pattern: /futbol/, title: 'Fútbol', activityType: 'sport' as const, kcalPerMinute: 8, perceivedEffort: 7 },
    { pattern: /natacion|nade|nadar/, title: 'Natación', activityType: 'sport' as const, kcalPerMinute: 8, perceivedEffort: 7 },
    { pattern: /correr|corri|carrera/, title: 'Carrera', activityType: 'cardio' as const, kcalPerMinute: 9, perceivedEffort: 7 },
    { pattern: /camine|caminar|caminata/, title: 'Caminata', activityType: 'cardio' as const, kcalPerMinute: 4, perceivedEffort: 5 },
    { pattern: /ciclismo|bici|pedalee/, title: 'Ciclismo', activityType: 'cardio' as const, kcalPerMinute: 7, perceivedEffort: 6 },
    { pattern: /yoga|movilidad|estiramiento/, title: 'Movilidad', activityType: 'mobility' as const, kcalPerMinute: 3, perceivedEffort: 4 },
    { pattern: /pesas|fuerza|gym|gimnasio|rutina|entrene/, title: 'Entrenamiento de fuerza', activityType: 'strength' as const, kcalPerMinute: 6, perceivedEffort: 6 },
  ];
  const match = activities.find((activity) => activity.pattern.test(normalized));
  return match ? { ...match, durationMinutes } : null;
}

function durationLabel(minutes: number, locale: 'es-MX' | 'en-US'): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return locale === 'en-US' ? `${minutes} minutes` : `${minutes} minutos`;
  const hourLabel = locale === 'en-US' ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return remainder ? `${hourLabel} ${remainder} min` : hourLabel;
}

function extractLookup(message: string): string | null {
  const text = message.trim().replace(/^[¿¡]+/, '').replace(/[?.!]+$/, '');
  const match = text.match(/^(?:cu[aá]ntas? calor[ií]as|cu[aá]nta prote[ií]na|qu[eé] macros|calor[ií]as y macros)\s+(?:tiene|hay en|aporta)?\s*(?:una?|la|el)?\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

function extractSimpleFoodLog(message: string): { food: string; quantity: number; unit: 'count' | 'g' | 'kg' } | null {
  const text = message.trim().replace(/[?.!]+$/, '');
  const match = text.match(/^(?:(?:agrega|agr[eé]game|a[nñ]ade|registra|reg[ií]strame)|(?:(?:hoy|ya)\s+)?(?:me\s+)?(?:com[ií]|desayun[eé]|almorc[eé]|cen[eé]|tom[eé]|beb[ií]))\s+(?:(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?)?\s*)?(?:una?|la|el)?\s*(.+)$/i);
  if (!match?.[3] || /\b(?:entrenamiento|actividad|ejercicio|rutina)\b/i.test(match[3])) return null;
  const quantity = Math.max(0.1, Number((match[1] ?? '1').replace(',', '.')));
  const rawUnit = (match[2] ?? '').toLocaleLowerCase('es-MX');
  return { food: match[3].trim(), quantity, unit: rawUnit.startsWith('k') ? 'kg' : rawUnit.startsWith('g') ? 'g' : 'count' };
}

async function bestFood(query: string): Promise<NormalizedFood | null> {
  const normalized = query.toLocaleLowerCase('es-MX').replace(/\b(cocid[ao]|cru[doa])\b/g, ' ').replace(/\s+/g, ' ').trim();
  const results = await foods.search(normalized, 5);
  return results.find((food) => food.caloriesPer100g !== null && food.proteinPer100g !== null && food.carbohydratesPer100g !== null && food.fatPer100g !== null) ?? null;
}

function macrosFor(food: NormalizedFood, grams: number) {
  const factor = grams / 100;
  return {
    calories: Math.max(0, Math.round((food.caloriesPer100g ?? 0) * factor)),
    proteinG: Math.max(0, Math.round((food.proteinPer100g ?? 0) * factor * 10) / 10),
    carbohydratesG: Math.max(0, Math.round((food.carbohydratesPer100g ?? 0) * factor * 10) / 10),
    fatG: Math.max(0, Math.round((food.fatPer100g ?? 0) * factor * 10) / 10),
  };
}

function inferMealType(date: Date, timezone: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  let hour = date.getUTCHours();
  try {
    const hourPart = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: timezone })
      .formatToParts(date).find((part) => part.type === 'hour')?.value;
    if (hourPart) hour = Number(hourPart) % 24;
  } catch { /* The request schema validates the timestamp; UTC is a safe fallback for an unknown zone. */ }
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 17) return 'lunch';
  if (hour >= 17 && hour < 23) return 'dinner';
  return 'snack';
}

function noModelReply(message: string, task: CoachReply['task']): CoachReply {
  return { message, action: null, memoryUpdates: [], task, model: 'none', usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0 } };
}
