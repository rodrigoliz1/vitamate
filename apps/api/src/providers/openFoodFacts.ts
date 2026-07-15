import { config } from '../config.js';
import { isPlausibleNutrition, type NormalizedFood } from '../types.js';

const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export class OpenFoodFactsProvider {
  async getByBarcode(barcode: string): Promise<NormalizedFood | null> {
    if (!/^\d{8,14}$/.test(barcode)) throw new Error('Código de barras inválido');
    const fields = [
      'code', 'product_name', 'product_name_es', 'brands', 'serving_size', 'serving_quantity', 'serving_quantity_unit', 'nutriments',
      'ingredients_text_es', 'ingredients_text', 'allergens_tags', 'image_front_small_url', 'last_modified_t',
    ].join(',');
    const url = `${config.OPEN_FOOD_FACTS_BASE_URL}/api/v3/product/${encodeURIComponent(barcode)}?fields=${fields}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': config.OPEN_FOOD_FACTS_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Open Food Facts respondió ${response.status}`);
    const data = await response.json() as { status?: string | number; product?: Record<string, unknown> };
    if (!data.product || data.status === 'failure' || data.status === 0) return null;
    const product = data.product;
    const nutrients = (product.nutriments ?? {}) as Record<string, unknown>;
    const item: NormalizedFood = {
      name: String(product.product_name_es || product.product_name || 'Producto sin nombre'),
      brand: product.brands ? String(product.brands) : null,
      barcode,
      source: 'open_food_facts',
      externalId: barcode,
      servingSize: product.serving_size ? String(product.serving_size) : null,
      servingQuantity: numberOrNull(product.serving_quantity),
      servingUnit: product.serving_quantity_unit ? String(product.serving_quantity_unit) : null,
      servingWeightGrams: /^(g|gram|grams)$/i.test(String(product.serving_quantity_unit ?? '')) ? numberOrNull(product.serving_quantity) : null,
      caloriesPer100g: numberOrNull(nutrients['energy-kcal_100g']),
      proteinPer100g: numberOrNull(nutrients.proteins_100g),
      carbohydratesPer100g: numberOrNull(nutrients.carbohydrates_100g),
      fatPer100g: numberOrNull(nutrients.fat_100g),
      fiberPer100g: numberOrNull(nutrients.fiber_100g),
      sugarsPer100g: numberOrNull(nutrients.sugars_100g),
      sodiumPer100g: numberOrNull(nutrients.sodium_100g),
      imageUrl: product.image_front_small_url ? String(product.image_front_small_url) : null,
      ingredients: product.ingredients_text_es ? String(product.ingredients_text_es) : product.ingredients_text ? String(product.ingredients_text) : null,
      allergens: Array.isArray(product.allergens_tags) ? product.allergens_tags.map(String) : [],
      qualityStatus: 'partial',
      externalUpdatedAt: product.last_modified_t ? new Date(Number(product.last_modified_t) * 1000).toISOString() : null,
      rawExternalData: data,
    };
    if (!isPlausibleNutrition(item)) item.qualityStatus = 'rejected';
    else if (item.name !== 'Producto sin nombre' && item.caloriesPer100g !== null && item.proteinPer100g !== null && item.carbohydratesPer100g !== null && item.fatPer100g !== null) item.qualityStatus = 'complete';
    return item;
  }
}
