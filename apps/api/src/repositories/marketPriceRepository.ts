import { supabaseAdmin } from '../services/supabase.js';

export interface CanonicalIngredientRow {
  id: string;
  canonicalName: string;
  category: string;
  baseUnit: 'g' | 'ml' | 'pieza';
}

export interface MarketObservationRow {
  priceMxn: number;
  observedAt: string;
  city: string;
  state: string;
  establishment: string | null;
  productName: string;
  presentation: string;
  packageQuantity: number;
  packageUnit: 'g' | 'ml' | 'pieza';
  matchConfidence: number;
}

export interface ReferenceObservations {
  observations: MarketObservationRow[];
  categoryMatched: boolean;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g, ' ').trim();

export class MarketPriceRepository {
  async findIngredient(name: string): Promise<CanonicalIngredientRow | null> {
    if (!supabaseAdmin) return null;
    const normalized = normalize(name);
    const { data: exact, error } = await supabaseAdmin
      .from('ingredient_aliases')
      .select('ingredient_id,food_ingredients!inner(id,canonical_name,category,base_unit)')
      .eq('normalized_alias', normalized)
      .maybeSingle();
    if (error) throw error;
    const relation = exact?.food_ingredients as unknown as Record<string, unknown> | undefined;
    if (relation) return {
      id: String(relation.id), canonicalName: String(relation.canonical_name), category: String(relation.category), baseUnit: relation.base_unit as CanonicalIngredientRow['baseUnit'],
    };

    // Contains matching is restricted to reviewed aliases and chooses the
    // longest match. This avoids grouping commercially distinct products.
    const { data: candidates, error: aliasesError } = await supabaseAdmin
      .from('ingredient_aliases')
      .select('normalized_alias,ingredient_id,food_ingredients!inner(id,canonical_name,category,base_unit)')
      .in('match_type', ['contains', 'reviewed']);
    if (aliasesError) throw aliasesError;
    const candidate = (candidates ?? [])
      .filter((row) => normalized.includes(String(row.normalized_alias)) || String(row.normalized_alias).includes(normalized))
      .sort((a, b) => String(b.normalized_alias).length - String(a.normalized_alias).length)[0];
    const candidateRelation = candidate?.food_ingredients as unknown as Record<string, unknown> | undefined;
    return candidateRelation ? {
      id: String(candidateRelation.id), canonicalName: String(candidateRelation.canonical_name), category: String(candidateRelation.category), baseUnit: candidateRelation.base_unit as CanonicalIngredientRow['baseUnit'],
    } : null;
  }

  async observations(ingredientId: string, unit: CanonicalIngredientRow['baseUnit'], since: string): Promise<MarketObservationRow[]> {
    if (!supabaseAdmin) return [];
    const { data: products, error: productsError } = await supabaseAdmin
      .from('market_products')
      .select('id,source_product_name,presentation,normalized_quantity,normalized_unit,match_confidence')
      .eq('canonical_ingredient_id', ingredientId)
      .eq('normalized_unit', unit)
      .eq('active', true);
    if (productsError) throw productsError;
    if (!products?.length) return [];
    const productMap = new Map(products.map((product) => [String(product.id), product]));
    const { data: prices, error: pricesError } = await supabaseAdmin
      .from('market_prices')
      .select('market_product_id,price_mxn,observed_at,city,state,establishment')
      .in('market_product_id', [...productMap.keys()])
      .gte('observed_at', since)
      .order('observed_at', { ascending: false })
      .limit(5000);
    if (pricesError) throw pricesError;
    return (prices ?? []).flatMap((price) => {
      const product = productMap.get(String(price.market_product_id));
      const quantity = Number(product?.normalized_quantity);
      if (!product || !Number.isFinite(quantity) || quantity <= 0) return [];
      return [{
        priceMxn: Number(price.price_mxn), observedAt: String(price.observed_at), city: String(price.city), state: String(price.state),
        establishment: price.establishment ? String(price.establishment) : null,
        productName: String(product.source_product_name), presentation: String(product.presentation), packageQuantity: quantity,
        packageUnit: product.normalized_unit as MarketObservationRow['packageUnit'], matchConfidence: Number(product.match_confidence ?? 0.7),
      }];
    });
  }

  async referenceObservations(unit: CanonicalIngredientRow['baseUnit'], category: string, since: string): Promise<ReferenceObservations> {
    if (!supabaseAdmin) return { observations: [], categoryMatched: false };
    const { data: categoryIngredients, error: ingredientError } = await supabaseAdmin
      .from('food_ingredients')
      .select('id')
      .eq('category', category)
      .eq('base_unit', unit)
      .eq('active', true);
    if (ingredientError) throw ingredientError;

    const categoryIds = (categoryIngredients ?? []).map((row) => String(row.id));
    let productsQuery = supabaseAdmin
      .from('market_products')
      .select('id,source_product_name,presentation,normalized_quantity,normalized_unit,match_confidence')
      .eq('normalized_unit', unit)
      .eq('active', true);
    if (categoryIds.length) productsQuery = productsQuery.in('canonical_ingredient_id', categoryIds);
    const { data: categoryProducts, error: categoryProductsError } = await productsQuery.limit(1000);
    if (categoryProductsError) throw categoryProductsError;

    let products = categoryProducts ?? [];
    let categoryMatched = Boolean(categoryIds.length && products.length);
    if (!products.length) {
      const { data: unitProducts, error: unitProductsError } = await supabaseAdmin
        .from('market_products')
        .select('id,source_product_name,presentation,normalized_quantity,normalized_unit,match_confidence')
        .eq('normalized_unit', unit)
        .eq('active', true)
        .limit(1000);
      if (unitProductsError) throw unitProductsError;
      products = unitProducts ?? [];
      categoryMatched = false;
    }
    if (!products.length) return { observations: [], categoryMatched };

    const productMap = new Map(products.map((product) => [String(product.id), product]));
    const { data: prices, error: pricesError } = await supabaseAdmin
      .from('market_prices')
      .select('market_product_id,price_mxn,observed_at,city,state,establishment')
      .in('market_product_id', [...productMap.keys()])
      .gte('observed_at', since)
      .order('observed_at', { ascending: false })
      .limit(5000);
    if (pricesError) throw pricesError;
    const observations = (prices ?? []).flatMap((price) => {
      const product = productMap.get(String(price.market_product_id));
      const quantity = Number(product?.normalized_quantity);
      if (!product || !Number.isFinite(quantity) || quantity <= 0) return [];
      return [{
        priceMxn: Number(price.price_mxn), observedAt: String(price.observed_at), city: String(price.city), state: String(price.state),
        establishment: price.establishment ? String(price.establishment) : null,
        productName: String(product.source_product_name), presentation: String(product.presentation), packageQuantity: quantity,
        packageUnit: product.normalized_unit as MarketObservationRow['packageUnit'], matchConfidence: 0.45,
      }];
    });
    return { observations, categoryMatched };
  }

  async inpcFactor(category: string, observedAt: string): Promise<number | null> {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin
      .from('price_index_observations')
      .select('category,observed_at,index_value')
      .in('category', [category, 'General'])
      .order('observed_at', { ascending: true });
    if (error) throw error;
    if (!data || data.length < 2) return null;
    const categoryRows = data.filter((row) => row.category === category);
    const series = (categoryRows.length >= 2 ? categoryRows : data.filter((row) => row.category === 'General')).sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)));
    if (series.length < 2) return null;
    const baseTime = new Date(observedAt).getTime();
    const base = [...series].reverse().find((row) => new Date(String(row.observed_at)).getTime() <= baseTime) ?? series[0];
    const latest = series[series.length - 1];
    const factor = Number(latest.index_value) / Number(base.index_value);
    return Number.isFinite(factor) && factor > 0 ? factor : null;
  }

  async getCached(requestHash: string): Promise<Record<string, unknown> | null> {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.from('grocery_estimates').select('response_data').eq('request_hash', requestHash).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) throw error;
    return data?.response_data as Record<string, unknown> | null;
  }

  async setCached(requestHash: string, requestData: unknown, responseData: unknown, location: { city: string; state: string }, periodDays: number, people: number, expiresAt: string): Promise<void> {
    if (!supabaseAdmin) return;
    const { error } = await supabaseAdmin.from('grocery_estimates').upsert({
      request_hash: requestHash, city: location.city, state: location.state, period_days: periodDays, people,
      request_data: requestData, response_data: responseData, calculated_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: 'request_hash' });
    if (error) throw error;
  }
}
