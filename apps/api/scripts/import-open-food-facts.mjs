import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';

const filePath = process.argv.slice(2).find((argument) => argument !== '--');
if (!filePath) throw new Error('Uso: pnpm --filter vitamate-api import:off -- /ruta/productos.csv.gz');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY con credenciales rotadas.');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const parser = createReadStream(filePath).pipe(createGunzip()).pipe(parse({
  columns: true,
  delimiter: '\t',
  relax_column_count: true,
  relax_quotes: true,
  skip_empty_lines: true,
  skip_records_with_error: true,
}));
let batch = [];
let scanned = 0;
let imported = 0;

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const nutrientNum = (value) => {
  const parsed = num(value);
  return parsed !== null && parsed <= 100 ? parsed : null;
};
const first = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== '') ?? null;

async function flush() {
  if (!batch.length) return;
  const { error } = await supabase.from('foods').upsert(batch, { onConflict: 'barcode' });
  if (error) throw error;
  imported += batch.length;
  batch = [];
  process.stdout.write(`\rRevisados: ${scanned.toLocaleString()} · importados: ${imported.toLocaleString()}`);
}

for await (const row of parser) {
  scanned += 1;
  const countries = String(first(row, 'countries_tags', 'countries_en', 'countries') ?? '').toLowerCase();
  if (!countries.includes('mexico') && !countries.includes('méxico')) continue;
  const barcode = String(first(row, 'code', 'barcode') ?? '').trim();
  const name = String(first(row, 'product_name_es', 'product_name') ?? '').trim();
  const calories = num(first(row, 'energy-kcal_100g', 'energy-kcal_100g_value'));
  const protein = num(first(row, 'proteins_100g'));
  const carbs = num(first(row, 'carbohydrates_100g'));
  const fat = num(first(row, 'fat_100g'));
  if (!/^\d{8,14}$/.test(barcode) || !name || [calories, protein, carbs, fat].some((value) => value === null)) continue;
  if (calories > 1000 || protein > 100 || carbs > 100 || fat > 100) continue;
  batch.push({
    name, brand: first(row, 'brands'), barcode, source: 'open_food_facts', external_id: barcode,
    serving_size: first(row, 'serving_size'), serving_quantity: num(first(row, 'serving_quantity')),
    calories_per_100g: calories, protein_per_100g: protein, carbohydrates_per_100g: carbs, fat_per_100g: fat,
    fiber_per_100g: nutrientNum(first(row, 'fiber_100g')), sugars_per_100g: nutrientNum(first(row, 'sugars_100g')), sodium_per_100g: nutrientNum(first(row, 'sodium_100g')),
    image_url: first(row, 'image_front_small_url', 'image_url'), ingredients: first(row, 'ingredients_text_es', 'ingredients_text'),
    allergens: String(first(row, 'allergens_tags') ?? '').split(',').filter(Boolean), quality_status: 'complete',
    external_fetched_at: new Date().toISOString(), raw_external_data: null,
  });
  if (batch.length >= 250) await flush();
}
await flush();
process.stdout.write(`\nImportación terminada. ${imported.toLocaleString()} productos mexicanos completos.\n`);
