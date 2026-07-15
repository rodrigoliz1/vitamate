import { createHash } from 'node:crypto';
import type { GroceryEstimate, GroceryEstimateRequest, GroceryIngredientEstimate, GroceryEstimateConfidence } from '@vitamate/domain';
import { MarketPriceRepository, type MarketObservationRow } from '../repositories/marketPriceRepository.js';

const WARNING = 'Los precios son aproximados y pueden variar según la tienda, marca, presentación, disponibilidad, ciudad y fecha de compra.';
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const normalizedText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const remainder = index - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + remainder * (sorted[lower + 1] - sorted[lower]);
};

function withoutOutliers(observations: MarketObservationRow[]): MarketObservationRow[] {
  if (observations.length < 4) return observations;
  const unitPrices = observations.map((item) => item.priceMxn / item.packageQuantity);
  const q1 = quantile(unitPrices, 0.25);
  const q3 = quantile(unitPrices, 0.75);
  const iqr = q3 - q1;
  const low = Math.max(0, q1 - 1.5 * iqr);
  const high = q3 + 1.5 * iqr;
  return observations.filter((item) => {
    const price = item.priceMxn / item.packageQuantity;
    return price >= low && price <= high;
  });
}

function confidenceFor(sampleSize: number, ageDays: number, scope: 'city' | 'state' | 'national', match: number, usedInpc: boolean): GroceryEstimateConfidence {
  if (sampleSize >= 10 && ageDays <= 30 && scope === 'city' && match >= 0.9 && !usedInpc) return 'high';
  if (sampleSize >= 3 && ageDays <= 90 && scope !== 'national' && match >= 0.75 && !usedInpc) return 'medium';
  return 'low';
}

function inferredCategory(name: string): string {
  const value = normalizedText(name);
  if (/pollo|pavo|salmon|atun|huevo|carne|pescado|tofu/.test(value)) return 'Proteínas';
  if (/yogurt|queso|leche|crema/.test(value)) return 'Lácteos';
  if (/arroz|avena|pasta|pan|tortilla|frijol|lenteja|garbanzo|quinoa|cereal/.test(value)) return 'Cereales y leguminosas';
  if (/aceite|nuez|almendra|semilla|cacahuate|aguacate/.test(value)) return 'Semillas y grasas';
  if (/soya|coco|almendra/.test(value) && /bebida|leche/.test(value)) return 'Bebidas vegetales';
  if (/fruta|verdura|papa|tomate|jitomate|pepino|limon|ensalada|espinaca|calabacita|champinon|pico de gallo/.test(value)) return 'Frutas y verduras';
  return 'Otros';
}

function selectGeography(observations: MarketObservationRow[], cityName: string, stateName: string) {
  const city = observations.filter((row) => normalizedText(row.city) === normalizedText(cityName) && normalizedText(row.state) === normalizedText(stateName));
  const state = observations.filter((row) => normalizedText(row.state) === normalizedText(stateName));
  return city.length >= 3 ? { scope: 'city' as const, observations: city }
    : state.length >= 3 ? { scope: 'state' as const, observations: state }
      : { scope: 'national' as const, observations };
}

function weeklyExpiry(weekStart?: string): string {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    const nextWeek = new Date(`${weekStart}T12:00:00Z`);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    if (nextWeek.getTime() > Date.now()) return nextWeek.toISOString();
  }
  const now = new Date();
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
  const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 12));
  return nextMonday.toISOString();
}

export class GroceryEstimator {
  constructor(private readonly repository = new MarketPriceRepository()) {}

  async estimate(input: GroceryEstimateRequest): Promise<GroceryEstimate> {
    const canonicalRequest = {
      estimatorVersion: 'grocery-v3',
      city: input.city.trim(), state: input.state.trim(), periodDays: input.periodDays, people: input.people,
      weekStart: input.weekStart ?? null, weeklyBudgetMxn: input.weeklyBudgetMxn ?? null,
      items: [...input.items].map((item) => ({ ...item, name: item.name.trim() })).sort((a, b) => a.id.localeCompare(b.id)),
    };
    const requestHash = createHash('sha256').update(JSON.stringify(canonicalRequest)).digest('hex');
    const cached = await this.repository.getCached(requestHash);
    if (cached) return { ...(cached as unknown as GroceryEstimate), cached: true };

    const scale = input.people * (input.periodDays / 7);
    const items: GroceryIngredientEstimate[] = [];
    for (const requested of canonicalRequest.items) {
      const requiredQuantity = Math.round(requested.quantity * scale * 10) / 10;
      const ingredient = await this.repository.findIngredient(requested.name);
      const category = ingredient?.category ?? inferredCategory(requested.name);
      const canonicalName = ingredient?.canonicalName ?? requested.name;
      const since = new Date(Date.now() - 370 * 86_400_000).toISOString().slice(0, 10);

      let observations = ingredient && ingredient.baseUnit === requested.unit
        ? await this.repository.observations(ingredient.id, ingredient.baseUnit, since)
        : [];
      let modeledFallback = false;
      let estimationBasis: string | undefined;
      if (!observations.length) {
        const reference = await this.repository.referenceObservations(requested.unit, category, since);
        observations = reference.observations;
        modeledFallback = true;
        estimationBasis = reference.categoryMatched
          ? `referencia de ${category} con la misma unidad`
          : `referencia nacional de productos con unidad ${requested.unit}`;
      }

      const geographic = selectGeography(observations, input.city, input.state);
      const filtered = withoutOutliers(geographic.observations);
      if (!filtered.length) {
        items.push(this.unavailable(requested, requiredQuantity, 'No hay observaciones PROFECO importadas con una unidad compatible.', canonicalName, category));
        continue;
      }

      const latestObservedAt = filtered.map((row) => row.observedAt).sort().at(-1)!;
      const ageDays = Math.max(0, Math.floor((Date.now() - new Date(`${latestObservedAt}T12:00:00Z`).getTime()) / 86_400_000));
      const inpcFactor = ageDays > 90 ? await this.repository.inpcFactor(category, latestObservedAt) : null;
      const factor = inpcFactor ?? 1;
      const adjusted = filtered.map((row) => ({ ...row, priceMxn: row.priceMxn * factor }));
      const unitPrices = adjusted.map((row) => row.priceMxn / row.packageQuantity);
      const medianUnitPrice = median(unitPrices);
      const representative = [...adjusted].sort((a, b) => Math.abs(a.priceMxn / a.packageQuantity - medianUnitPrice) - Math.abs(b.priceMxn / b.packageQuantity - medianUnitPrice))[0];
      const referencePackageQuantity = modeledFallback
        ? requested.unit === 'pieza'
          ? Math.max(1, Math.round(median(adjusted.map((row) => row.packageQuantity))))
          : Math.max(250, Math.min(1000, Math.round(median(adjusted.map((row) => row.packageQuantity)) / 50) * 50))
        : representative.packageQuantity;
      const packagesToBuy = Math.ceil(requiredQuantity / referencePackageQuantity);
      const purchaseQuantity = packagesToBuy * referencePackageQuantity;
      const purchaseCosts = adjusted.map((row) => Math.ceil(requiredQuantity / row.packageQuantity) * row.priceMxn);
      const economicCost = modeledFallback ? purchaseQuantity * quantile(unitPrices, 0.1) : Math.min(...purchaseCosts);
      const medianCost = modeledFallback ? purchaseQuantity * medianUnitPrice : median(purchaseCosts);
      const highCost = modeledFallback ? purchaseQuantity * quantile(unitPrices, 0.9) : Math.max(...purchaseCosts);
      const averageMatch = adjusted.reduce((sum, row) => sum + row.matchConfidence, 0) / adjusted.length;
      items.push({
        ...requested, canonicalName, category, requiredQuantity,
        purchaseQuantity: roundMoney(purchaseQuantity), purchaseUnit: requested.unit,
        packageDescription: modeledFallback
          ? `${packagesToBuy} presentación${packagesToBuy === 1 ? '' : 'es'} de referencia (≈ ${roundMoney(referencePackageQuantity)} ${requested.unit})`
          : `${packagesToBuy} × ${representative.presentation}`,
        packagesToBuy, leftoverQuantity: roundMoney(Math.max(0, purchaseQuantity - requiredQuantity)),
        consumedCostMxn: roundMoney(requiredQuantity * medianUnitPrice), economicCostMxn: roundMoney(economicCost),
        medianCostMxn: roundMoney(medianCost), highCostMxn: roundMoney(highCost), sampleSize: adjusted.length,
        latestObservedAt, geographicScope: geographic.scope,
        source: modeledFallback ? 'Estimación VITAMATE · PROFECO' : 'PROFECO QQP', usedInpc: Boolean(inpcFactor),
        confidence: modeledFallback ? 'low' : confidenceFor(adjusted.length, ageDays, geographic.scope, averageMatch, Boolean(inpcFactor)),
        estimationBasis,
      });
    }

    const priced = items.filter((item) => item.medianCostMxn !== null);
    const total = (key: 'economicCostMxn' | 'medianCostMxn' | 'highCostMxn' | 'consumedCostMxn') => priced.length ? roundMoney(priced.reduce((sum, item) => sum + (item[key] ?? 0), 0)) : null;
    const categories = new Map<string, number>();
    for (const item of priced) categories.set(item.category, (categories.get(item.category) ?? 0) + (item.medianCostMxn ?? 0));
    const weakest = items.some((item) => item.confidence === 'unavailable' || item.confidence === 'low') ? 'low' : items.some((item) => item.confidence === 'medium') ? 'medium' : priced.length ? 'high' : 'unavailable';
    const response: GroceryEstimate = {
      city: input.city, state: input.state, periodDays: input.periodDays, people: input.people,
      economicTotalMxn: total('economicCostMxn'), medianTotalMxn: total('medianCostMxn'), highTotalMxn: total('highCostMxn'), consumedTotalMxn: total('consumedCostMxn'),
      pricedItems: priced.length, unpricedItems: items.length - priced.length,
      categories: [...categories].map(([categoryName, medianCostMxn]) => ({ category: categoryName, medianCostMxn: roundMoney(medianCostMxn) })).sort((a, b) => b.medianCostMxn - a.medianCostMxn),
      items, calculatedAt: new Date().toISOString(), latestObservedAt: priced.map((item) => item.latestObservedAt!).sort().at(-1) ?? null,
      confidence: weakest, cached: false,
      methodology: 'Primero usa coincidencias directas de PROFECO. Si faltan, calcula una referencia fundada con productos PROFECO de la misma categoría y unidad, o de la misma unidad a nivel nacional; estas aproximaciones se marcan con confianza baja. Excluye atípicos con cercas de Tukey (1.5×IQR) e INPC sólo actualiza observaciones antiguas.',
      warning: WARNING,
    };
    await this.repository.setCached(requestHash, canonicalRequest, response, { city: input.city, state: input.state }, input.periodDays, input.people, weeklyExpiry(input.weekStart));
    return response;
  }

  private unavailable(requested: GroceryEstimateRequest['items'][number], requiredQuantity: number, reasonUnavailable: string, canonicalName: string | null = null, category = 'Sin clasificar'): GroceryIngredientEstimate {
    return { ...requested, canonicalName, category, requiredQuantity, purchaseQuantity: null, purchaseUnit: null, packageDescription: null, packagesToBuy: null, leftoverQuantity: null, consumedCostMxn: null, economicCostMxn: null, medianCostMxn: null, highCostMxn: null, sampleSize: 0, latestObservedAt: null, geographicScope: null, source: null, usedInpc: false, confidence: 'unavailable', reasonUnavailable };
  }
}
