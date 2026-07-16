import { FoodRepository } from '../repositories/foodRepository.js';
import type { CoachReply } from '../providers/openaiCoach.js';
import type { NormalizedFood } from '../types.js';

const foods = new FoodRepository();
const COMMON_PORTION_GRAMS: Record<string, number> = { apple: 180, banana: 118, egg: 50, 'corn-tortilla': 28, avocado: 150 };

export async function tryDeterministicCoachReply(message: string, currentDateTime: string, timezone: string, locale: 'es-MX' | 'en-US'): Promise<CoachReply | null> {
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
