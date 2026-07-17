import { curatedFoods } from '../catalog/curatedFoods.js';
import { supabaseAdmin } from '../services/supabase.js';
import type { NormalizedFood } from '../types.js';

const fromRow = (row: Record<string, unknown>): NormalizedFood => ({
  id: String(row.id), name: String(row.name), brand: row.brand ? String(row.brand) : null, barcode: row.barcode ? String(row.barcode) : null,
  source: row.source as NormalizedFood['source'], externalId: row.external_id ? String(row.external_id) : null,
  servingSize: row.serving_size ? String(row.serving_size) : null, servingQuantity: row.serving_quantity === null ? null : Number(row.serving_quantity),
  servingUnit: row.serving_unit ? String(row.serving_unit) : null, servingWeightGrams: row.serving_weight_grams === null || row.serving_weight_grams === undefined ? null : Number(row.serving_weight_grams),
  caloriesPer100g: row.calories_per_100g === null ? null : Number(row.calories_per_100g), proteinPer100g: row.protein_per_100g === null ? null : Number(row.protein_per_100g),
  carbohydratesPer100g: row.carbohydrates_per_100g === null ? null : Number(row.carbohydrates_per_100g), fatPer100g: row.fat_per_100g === null ? null : Number(row.fat_per_100g),
  fiberPer100g: row.fiber_per_100g === null ? null : Number(row.fiber_per_100g), sugarsPer100g: row.sugars_per_100g === null ? null : Number(row.sugars_per_100g),
  sodiumPer100g: row.sodium_per_100g === null ? null : Number(row.sodium_per_100g), imageUrl: row.image_url ? String(row.image_url) : null,
  ingredients: row.ingredients ? String(row.ingredients) : null, allergens: Array.isArray(row.allergens) ? row.allergens.map(String) : [],
  qualityStatus: row.quality_status as NormalizedFood['qualityStatus'], externalUpdatedAt: row.external_updated_at ? String(row.external_updated_at) : null,
});

const toRow = (food: NormalizedFood) => ({
  name: food.name, brand: food.brand, barcode: food.barcode, source: food.source, external_id: food.externalId,
  serving_size: food.servingSize, serving_quantity: food.servingQuantity, calories_per_100g: food.caloriesPer100g,
  serving_unit: food.servingUnit, serving_weight_grams: food.servingWeightGrams,
  protein_per_100g: food.proteinPer100g, carbohydrates_per_100g: food.carbohydratesPer100g, fat_per_100g: food.fatPer100g,
  fiber_per_100g: food.fiberPer100g, sugars_per_100g: food.sugarsPer100g, sodium_per_100g: food.sodiumPer100g,
  image_url: food.imageUrl, ingredients: food.ingredients, allergens: food.allergens, quality_status: food.qualityStatus,
  external_updated_at: food.externalUpdatedAt, external_fetched_at: new Date().toISOString(), raw_external_data: food.rawExternalData ?? null,
});

export class FoodRepository {
  async search(query: string, limit = 30): Promise<NormalizedFood[]> {
    const normalized = normalizeSearch(query);
    const curated = curatedFoods.filter((food) => normalizeSearch(food.name).includes(normalized));
    if (!supabaseAdmin) return curated.slice(0, limit);
    const safe = normalized.replaceAll(',', ' ').replaceAll('%', '');
    const { data, error } = await supabaseAdmin.from('foods').select('*').neq('quality_status', 'rejected').ilike('search_text', `%${safe}%`).limit(limit * 2);
    if (error) throw error;
    const combined = [...curated, ...(data ?? []).map(fromRow)];
    const unique = combined.filter((food, index, all) => all.findIndex((candidate) =>
      candidate.source === food.source && (candidate.externalId ?? candidate.name) === (food.externalId ?? food.name)
    ) === index);
    return unique.sort((left, right) => foodSearchScore(right, normalized) - foodSearchScore(left, normalized)).slice(0, limit);
  }

  async findByBarcode(barcode: string): Promise<NormalizedFood | null> {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.from('foods').select('*').eq('barcode', barcode).neq('quality_status', 'rejected').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const fetched = new Date(String(data.external_fetched_at)).getTime();
    const ttl = data.quality_status === 'complete' ? 30 : 7;
    return Date.now() - fetched < ttl * 86_400_000 ? fromRow(data as Record<string, unknown>) : null;
  }

  async upsert(food: NormalizedFood): Promise<NormalizedFood> {
    if (!supabaseAdmin) return food;
    const conflict = food.barcode ? 'barcode' : 'source,external_id';
    const { data, error } = await supabaseAdmin.from('foods').upsert(toRow(food), { onConflict: conflict }).select('*').single();
    if (error) throw error;
    return fromRow(data as Record<string, unknown>);
  }
}

function foodSearchScore(food: NormalizedFood, query: string): number {
  const name = normalizeSearch(food.name);
  const hasUsefulNutrition = [food.caloriesPer100g, food.proteinPer100g, food.carbohydratesPer100g, food.fatPer100g]
    .some((value) => typeof value === 'number' && value > 0);
  return (food.source === 'vitamate' ? 50 : 0)
    + (name === query ? 30 : name.startsWith(query) ? 20 : 0)
    + (food.qualityStatus === 'complete' ? 10 : 0)
    + (hasUsefulNutrition ? 20 : 0);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
