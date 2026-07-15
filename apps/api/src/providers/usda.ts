import { config } from '../config.js';
import { isPlausibleNutrition, type NormalizedFood } from '../types.js';

type Nutrient = { nutrientId?: number; nutrientNumber?: string; value?: number };
type UsdaFood = { fdcId: number; description?: string; brandOwner?: string; gtinUpc?: string; servingSize?: number; servingSizeUnit?: string; foodNutrients?: Nutrient[] };
const nutrient = (food: UsdaFood, id: number) => food.foodNutrients?.find((item) => item.nutrientId === id)?.value ?? null;

export class UsdaProvider {
  async search(query: string, pageSize = 20): Promise<NormalizedFood[]> {
    if (!config.USDA_FDC_API_KEY) throw new Error('USDA_FDC_API_KEY no está configurada.');
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', config.USDA_FDC_API_KEY);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', String(Math.min(25, pageSize)));
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`USDA respondió ${response.status}`);
    const data = await response.json() as { foods?: UsdaFood[] };
    return (data.foods ?? []).map((food) => {
      const item: NormalizedFood = {
        name: food.description || 'Alimento USDA', brand: food.brandOwner || null, barcode: food.gtinUpc || null,
        source: 'usda', externalId: String(food.fdcId),
        servingSize: food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? 'g'}` : null,
        servingQuantity: food.servingSize ?? null,
        servingUnit: food.servingSizeUnit ?? null,
        servingWeightGrams: food.servingSize && /^(g|gram|grams)$/i.test(food.servingSizeUnit ?? 'g') ? food.servingSize : null,
        caloriesPer100g: nutrient(food, 1008), proteinPer100g: nutrient(food, 1003), carbohydratesPer100g: nutrient(food, 1005), fatPer100g: nutrient(food, 1004),
        fiberPer100g: nutrient(food, 1079), sugarsPer100g: nutrient(food, 2000), sodiumPer100g: nutrient(food, 1093),
        imageUrl: null, ingredients: null, allergens: [], qualityStatus: 'partial', externalUpdatedAt: null, rawExternalData: food,
      };
      if (!isPlausibleNutrition(item)) item.qualityStatus = 'rejected';
      else if ([item.caloriesPer100g, item.proteinPer100g, item.carbohydratesPer100g, item.fatPer100g].every((value) => value !== null)) item.qualityStatus = 'complete';
      return item;
    }).filter((item) => item.qualityStatus !== 'rejected');
  }
}
