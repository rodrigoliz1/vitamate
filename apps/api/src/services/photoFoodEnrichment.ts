import { FoodRepository } from '../repositories/foodRepository.js';
import { OpenFoodFactsProvider } from '../providers/openFoodFacts.js';
import { UsdaProvider } from '../providers/usda.js';
import type { FoodSource, NormalizedFood, PhotoFoodAnalysis } from '../types.js';

const repository = new FoodRepository();
const openFoodFacts = new OpenFoodFactsProvider();
const usda = new UsdaProvider();

const STOP_WORDS = new Set(['a', 'al', 'and', 'con', 'cooked', 'cocida', 'cocido', 'de', 'del', 'en', 'la', 'las', 'los', 'of', 'the', 'un', 'una', 'with']);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g, ' ').trim();
}

function meaningfulTokens(value: string): string[] {
  return normalize(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function nameMatchScore(query: string, candidate: NormalizedFood): number {
  const queryName = normalize(query);
  const candidateName = normalize(`${candidate.name} ${candidate.brand ?? ''}`);
  if (!queryName || !candidateName) return 0;
  if (candidateName === queryName) return 1;
  const queryTokens = meaningfulTokens(queryName);
  const candidateTokens = new Set(meaningfulTokens(candidateName));
  if (!queryTokens.length) return 0;
  const overlap = queryTokens.filter((token) => candidateTokens.has(token)).length / queryTokens.length;
  const containment = candidateName.includes(queryName) || queryName.includes(normalize(candidate.name)) ? 0.18 : 0;
  return Math.min(1, overlap + containment);
}

function hasCompleteMacros(food: NormalizedFood): boolean {
  return [food.caloriesPer100g, food.proteinPer100g, food.carbohydratesPer100g, food.fatPer100g]
    .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function canonicalQuery(name: string): string | null {
  const value = normalize(name);
  const aliases: Array<[RegExp, string]> = [
    [/\b(pollo|chicken)\b/, 'pechuga de pollo'],
    [/\b(arroz|rice)\b/, 'arroz blanco'],
    [/\b(huevo|egg)\b/, 'huevo entero'],
    [/\b(frijol|frijoles|beans)\b/, 'frijoles'],
    [/\b(tortilla|tortillas)\b/, 'tortilla de maíz'],
    [/\b(avena|oats|oatmeal)\b/, 'avena'],
    [/\b(yogurt|yoghurt)\b/, 'yogurt griego'],
    [/\b(platano|banana)\b/, 'plátano'],
    [/\b(manzana|apple)\b/, 'manzana'],
    [/\b(aguacate|avocado)\b/, 'aguacate'],
    [/\b(salmon)\b/, 'salmón'],
    [/\b(atun|tuna)\b/, 'atún en agua'],
  ];
  return aliases.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function bestMatch(query: string, candidates: NormalizedFood[]): { food: NormalizedFood; score: number } | null {
  const ranked = candidates
    .filter(hasCompleteMacros)
    .map((food) => ({ food, score: nameMatchScore(query, food) }))
    .sort((left, right) => right.score - left.score);
  return ranked[0] && ranked[0].score >= 0.5 ? ranked[0] : null;
}

async function lookupBarcode(barcode: string): Promise<NormalizedFood | null> {
  const cached = await repository.findByBarcode(barcode).catch(() => null);
  if (cached && hasCompleteMacros(cached)) return cached;
  const external = await openFoodFacts.getByBarcode(barcode).catch(() => null);
  if (!external || external.qualityStatus === 'rejected' || !hasCompleteMacros(external)) return null;
  return repository.upsert(external).catch(() => external);
}

async function lookupByName(name: string, brand: string | null): Promise<{ food: NormalizedFood; score: number } | null> {
  const query = `${brand ?? ''} ${name}`.trim();
  const localCandidates: NormalizedFood[] = await repository.search(name, 10).catch(() => [] as NormalizedFood[]);
  const alias = canonicalQuery(name);
  if (alias && !localCandidates.length) localCandidates.push(...await repository.search(alias, 10).catch(() => []));
  const local = bestMatch(query, localCandidates) ?? (alias ? bestMatch(alias, localCandidates) : null);
  if (local && (local.score >= 0.72 || local.food.source === 'vitamate')) return local;

  const externalCandidates: NormalizedFood[] = await usda.search(query, 8).catch(() => [] as NormalizedFood[]);
  const external = bestMatch(query, externalCandidates) ?? (alias ? bestMatch(alias, externalCandidates) : null);
  const selected = external && (!local || external.score > local.score) ? external : local;
  if (!selected) return null;
  selected.food = await repository.upsert(selected.food).catch(() => selected.food);
  return selected;
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function nutritionFromDatabase(food: NormalizedFood, portionGrams: number) {
  const factor = Math.max(1, portionGrams) / 100;
  return {
    calories: Math.round((food.caloriesPer100g ?? 0) * factor),
    proteinG: roundMacro((food.proteinPer100g ?? 0) * factor),
    carbohydratesG: roundMacro((food.carbohydratesPer100g ?? 0) * factor),
    fatG: roundMacro((food.fatPer100g ?? 0) * factor),
  };
}

export async function enrichPhotoFoodAnalysis(analysis: PhotoFoodAnalysis, locale: 'es-MX' | 'en-US'): Promise<PhotoFoodAnalysis> {
  const enrichedItems = await Promise.all(analysis.items.slice(0, 8).map(async (item) => {
    const barcode = item.barcode ? item.barcode.replace(/\D/g, '') : '';
    const barcodeFood = /^\d{8,14}$/.test(barcode) ? await lookupBarcode(barcode) : null;
    const namedMatch = barcodeFood ? null : await lookupByName(item.name, item.brand);
    const match = barcodeFood ? { food: barcodeFood, score: 1 } : namedMatch;
    if (!match) return { ...item, dataSource: 'vision' as const, databaseMatchName: null, databaseMatchConfidence: null };
    return {
      ...item,
      ...nutritionFromDatabase(match.food, item.estimatedPortionG),
      dataSource: match.food.source as FoodSource,
      databaseMatchName: match.food.brand ? `${match.food.name} · ${match.food.brand}` : match.food.name,
      databaseMatchConfidence: Math.round(match.score * 100) / 100,
    };
  }));

  const totals = enrichedItems.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    proteinG: roundMacro(sum.proteinG + item.proteinG),
    carbohydratesG: roundMacro(sum.carbohydratesG + item.carbohydratesG),
    fatG: roundMacro(sum.fatG + item.fatG),
  }), { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 });
  const matched = enrichedItems.filter((item) => item.dataSource !== 'vision').length;
  const sourceNote = locale === 'en-US'
    ? `${matched} of ${enrichedItems.length} items were cross-checked against the VITAMATE, USDA, or Open Food Facts databases without another AI call.`
    : `${matched} de ${enrichedItems.length} alimentos se contrastaron con VITAMATE, USDA u Open Food Facts sin otra llamada a la IA.`;
  return { ...analysis, items: enrichedItems, totals, notes: [...analysis.notes, sourceNote], requiresConfirmation: true };
}
