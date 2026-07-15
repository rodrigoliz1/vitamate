import dotenv from 'dotenv';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const sourcePath = process.argv.slice(2).find((argument) => argument !== '--') || process.env.PROFECO_CSV_PATH;
const sourceUrl = process.env.PROFECO_QQP_SOURCE_URL;
if (!sourcePath && !sourceUrl) throw new Error('Indica un CSV con `pnpm import:profeco -- /ruta/archivo.csv` o configura PROFECO_QQP_SOURCE_URL.');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g, ' ').trim();
const value = (row, ...names) => {
  const normalizedKeys = new Map(Object.keys(row).map((key) => [normalize(key).replaceAll(' ', ''), key]));
  for (const name of names) {
    const key = normalizedKeys.get(normalize(name).replaceAll(' ', ''));
    if (key && row[key] !== undefined && row[key] !== '') return String(row[key]).trim();
  }
  return '';
};
const numeric = (input) => {
  const parsed = Number(String(input).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const hash = (input) => createHash('sha256').update(input).digest('hex');

function packageFromPresentation(presentation) {
  const text = normalize(presentation).replace(/(\d),(\d)/g, '$1.$2');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kilogramos?|kg|gramos?|grs?|g|litros?|lts?|l|mililitros?|ml|piezas?|pzas?|unidades?|uds?)\b/);
  if (match) {
    const quantity = Number(match[1]);
    const unit = match[2];
    if (/^(kilogram|kg)/.test(unit)) return { packageQuantity: quantity, packageUnit: 'g', normalizedQuantity: quantity * 1000, normalizedUnit: 'g' };
    if (/^(gram|gr|g$)/.test(unit)) return { packageQuantity: quantity, packageUnit: 'g', normalizedQuantity: quantity, normalizedUnit: 'g' };
    if (/^(litro|lt|l$)/.test(unit)) return { packageQuantity: quantity, packageUnit: 'ml', normalizedQuantity: quantity * 1000, normalizedUnit: 'ml' };
    if (/^(mililitro|ml)/.test(unit)) return { packageQuantity: quantity, packageUnit: 'ml', normalizedQuantity: quantity, normalizedUnit: 'ml' };
    return { packageQuantity: quantity, packageUnit: 'pieza', normalizedQuantity: quantity, normalizedUnit: 'pieza' };
  }
  const count = text.match(/(?:con|c)\s*(\d+)\b/);
  return count ? { packageQuantity: Number(count[1]), packageUnit: 'pieza', normalizedQuantity: Number(count[1]), normalizedUnit: 'pieza' } : null;
}

function observedDate(input) {
  const trimmed = String(input).trim();
  const latin = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (latin) return `${latin[3]}-${latin[2].padStart(2, '0')}-${latin[1].padStart(2, '0')}`;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const { data: ingredients, error: ingredientError } = await db.from('food_ingredients').select('id,canonical_name,normalized_name,base_unit,excluded_equivalences');
if (ingredientError) throw ingredientError;
const { data: aliases, error: aliasError } = await db.from('ingredient_aliases').select('ingredient_id,normalized_alias');
if (aliasError) throw aliasError;
const ingredientMap = new Map((ingredients ?? []).map((item) => [item.id, item]));
const ingredientByName = new Map((ingredients ?? []).map((item) => [item.normalized_name, item]));
const matchers = (aliases ?? []).map((alias) => ({ ...alias, normalized_alias: normalize(alias.normalized_alias) })).sort((a, b) => b.normalized_alias.length - a.normalized_alias.length);

function matchIngredient(productText, packageUnit) {
  const normalized = normalize(productText);
  // QQP separa el nombre comercial ("Carne Pollo") de la presentación
  // ("Pechuga..."). Esta regla compuesta evita perder pechuga sin aceptar
  // pollo entero, caldo, sopa o productos preparados como equivalentes.
  const chickenBreast = ingredientByName.get('pechuga de pollo');
  if (chickenBreast?.base_unit === packageUnit
    && /\bpollo\b/.test(normalized)
    && /\bpechuga\b/.test(normalized)
    && !/\b(caldo|concentrado|sopa|rostizado|nugget|empanizado|preparado)\b/.test(normalized)) {
    return { ingredientId: chickenBreast.id, confidence: 0.96, method: 'reviewed_compound_rule' };
  }
  for (const matcher of matchers) {
    if (!normalized.includes(matcher.normalized_alias)) continue;
    const ingredient = ingredientMap.get(matcher.ingredient_id);
    if (!ingredient || ingredient.base_unit !== packageUnit) continue;
    const excluded = Array.isArray(ingredient.excluded_equivalences) ? ingredient.excluded_equivalences : [];
    if (excluded.some((term) => normalized.includes(normalize(term)))) continue;
    return { ingredientId: ingredient.id, confidence: normalized === matcher.normalized_alias ? 1 : 0.9, method: 'reviewed_alias' };
  }
  return null;
}

const { data: run, error: runError } = await db.from('market_import_runs').insert({ source: 'profeco_qqp', source_url: sourceUrl || null, source_filename: sourcePath || null }).select('id').single();
if (runError) throw runError;
const stats = { processed_rows: 0, imported_products: 0, imported_prices: 0, skipped_rows: 0, error_rows: 0 };
let rowNumber = 1;
let productBatch = [];
let priceBatch = [];
let errorBatch = [];

async function flush() {
  if (productBatch.length) {
    const deduped = [...new Map(productBatch.map((item) => [item.source_product_id, item])).values()];
    const { data, error } = await db.from('market_products').upsert(deduped, { onConflict: 'source,source_product_id' }).select('id,source_product_id');
    if (error) throw error;
    const ids = new Map(data.map((item) => [item.source_product_id, item.id]));
    const rows = priceBatch.flatMap((item) => ids.has(item.sourceProductId) ? [{ ...item.row, market_product_id: ids.get(item.sourceProductId) }] : []);
    if (rows.length) {
      const { error: priceError } = await db.from('market_prices').upsert(rows, { onConflict: 'source_row_hash', ignoreDuplicates: true });
      if (priceError) throw priceError;
    }
    stats.imported_products += deduped.length;
    stats.imported_prices += rows.length;
    productBatch = [];
    priceBatch = [];
  }
  if (errorBatch.length) {
    const { error } = await db.from('market_import_errors').insert(errorBatch);
    if (error) throw error;
    errorBatch = [];
  }
}

async function inputStream() {
  if (sourcePath) return createReadStream(sourcePath);
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`PROFECO respondió ${response.status}`);
  return Readable.fromWeb(response.body);
}

try {
  const parser = (await inputStream()).pipe(parse({ columns: true, bom: true, skip_empty_lines: true, relax_column_count: true, trim: true }));
  for await (const row of parser) {
    rowNumber += 1;
    stats.processed_rows += 1;
    try {
      const productName = value(row, 'PRODUCTO');
      const presentation = value(row, 'PRESENTACIÓN', 'PRESENTACION');
      const price = numeric(value(row, 'PRECIO'));
      const date = observedDate(value(row, 'FECHAREGISTRO', 'FECHA REGISTRO'));
      const city = value(row, 'MUNICIPIO', 'CIUDAD');
      const state = value(row, 'ESTADO');
      const packageInfo = packageFromPresentation(presentation);
      if (!productName || !presentation || !price || !date || !city || !state || !packageInfo) {
        stats.skipped_rows += 1;
        continue;
      }
      const brand = value(row, 'MARCA') || null;
      const category = value(row, 'CATEGORÍA', 'CATEGORIA') || null;
      const sourceProductId = hash([productName, brand, presentation, category].join('|'));
      const match = matchIngredient(`${productName} ${brand ?? ''} ${presentation} ${category ?? ''}`, packageInfo.normalizedUnit);
      // The pricing store is deliberately scoped to VITAMATE's reviewed food
      // ingredients. Unmatched household products remain in the official CSV
      // and are not copied into our database until an equivalence is approved.
      if (!match) { stats.skipped_rows += 1; continue; }
      productBatch.push({
        source: 'profeco_qqp', source_product_id: sourceProductId, source_product_name: productName, brand, category, presentation,
        canonical_ingredient_id: match.ingredientId, package_quantity: packageInfo.packageQuantity,
        package_unit: packageInfo.packageUnit, normalized_quantity: packageInfo.normalizedQuantity, normalized_unit: packageInfo.normalizedUnit,
        match_confidence: match.confidence, match_method: match.method, raw_source_data: row, updated_at: new Date().toISOString(),
      });
      const sourceRowHash = hash([sourceProductId, price, date, city, state, value(row, 'NOMBRECOMERCIAL'), value(row, 'DIRECCIÓN', 'DIRECCION')].join('|'));
      priceBatch.push({ sourceProductId, row: {
        price_mxn: price, observed_at: date, city, state, establishment: value(row, 'NOMBRECOMERCIAL') || null,
        commercial_chain: value(row, 'CADENACOMERCIAL') || null, address: value(row, 'DIRECCIÓN', 'DIRECCION') || null,
        latitude: numeric(value(row, 'LATITUD')), longitude: numeric(value(row, 'LONGITUD')), source: 'profeco_qqp',
        source_url: sourceUrl || null, source_row_hash: sourceRowHash, raw_source_data: row,
      } });
      if (productBatch.length >= 300) await flush();
    } catch (error) {
      stats.error_rows += 1;
      errorBatch.push({ import_run_id: run.id, row_number: rowNumber, error_code: 'ROW_ERROR', error_message: error instanceof Error ? error.message : String(error), raw_row: row });
      if (errorBatch.length >= 100) await flush();
    }
  }
  await flush();
  // Las listas de una semana ya calculadas permanecen fijas. Las nuevas
  // observaciones se usarán cuando cambie la lista o comience otra semana.
  const invalidatedAt = new Date().toISOString();
  const { error: ingredientCacheError } = await db.from('ingredient_price_estimates').delete().lt('calculated_at', invalidatedAt);
  if (ingredientCacheError) throw ingredientCacheError;
  await db.from('market_import_runs').update({ ...stats, status: stats.error_rows ? 'completed_with_errors' : 'completed', completed_at: new Date().toISOString() }).eq('id', run.id);
  console.log(JSON.stringify({ runId: run.id, ...stats }, null, 2));
} catch (error) {
  await db.from('market_import_runs').update({ ...stats, status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : String(error) }).eq('id', run.id);
  throw error;
}
