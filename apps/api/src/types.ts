export type FoodSource = 'vitamate' | 'open_food_facts' | 'usda';

export interface NormalizedFood {
  id?: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: FoodSource;
  externalId: string | null;
  servingSize: string | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbohydratesPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
  sodiumPer100g: number | null;
  imageUrl: string | null;
  ingredients: string | null;
  allergens: string[];
  qualityStatus: 'complete' | 'partial' | 'rejected';
  externalUpdatedAt: string | null;
  rawExternalData?: unknown;
}

export interface PhotoFoodAnalysis {
  items: Array<{
    name: string;
    estimatedPortionG: number;
    calories: number;
    proteinG: number;
    carbohydratesG: number;
    fatG: number;
    confidence: number;
  }>;
  totals: { calories: number; proteinG: number; carbohydratesG: number; fatG: number };
  overallConfidence: number;
  notes: string[];
  requiresConfirmation: true;
}

export function isPlausibleNutrition(food: Pick<NormalizedFood, 'caloriesPer100g' | 'proteinPer100g' | 'carbohydratesPer100g' | 'fatPer100g'>): boolean {
  const values = [food.caloriesPer100g, food.proteinPer100g, food.carbohydratesPer100g, food.fatPer100g];
  if (values.some((value) => value !== null && (!Number.isFinite(value) || value < 0))) return false;
  if ([food.proteinPer100g, food.carbohydratesPer100g, food.fatPer100g].some((value) => value !== null && value > 100)) return false;
  return !(food.caloriesPer100g !== null && food.caloriesPer100g > 1000);
}

export function toPublicFood(food: NormalizedFood) {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    servingSize: food.servingSize,
    servingQuantity: food.servingQuantity,
    defaultPortionGrams: food.servingWeightGrams ?? massServingInGrams(food.servingSize, food.servingQuantity, food.servingUnit),
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    carbohydratesPer100g: food.carbohydratesPer100g,
    fatPer100g: food.fatPer100g,
    imageUrl: food.imageUrl,
    source: food.source,
    qualityStatus: food.qualityStatus,
  };
}

function massServingInGrams(label: string | null, quantity: number | null, explicitUnit: string | null): number | null {
  const match = label?.toLocaleLowerCase('es-MX').match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogramos?|g|gramos?|mg|miligramos?|oz|onzas?|lb|libras?)\b/i);
  const value = match ? Number(match[1].replace(',', '.')) : quantity;
  const unit = (match?.[2] ?? explicitUnit ?? '').toLocaleLowerCase('es-MX');
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  if (unit === 'kg' || unit.startsWith('kilogram')) return value * 1000;
  if (unit === 'mg' || unit.startsWith('miligram')) return value / 1000;
  if (unit === 'oz' || unit.startsWith('onza')) return value * 28.3495;
  if (unit === 'lb' || unit.startsWith('libra')) return value * 453.592;
  if (unit === 'g' || unit.startsWith('gram')) return value;
  return null;
}
