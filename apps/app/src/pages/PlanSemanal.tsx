import { useEffect, useMemo, useState } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonRouterLink, IonSpinner } from '@ionic/react';
import { cartOutline, chatbubbleEllipsesOutline, chevronBack, chevronForward, closeOutline, locationOutline, refreshOutline, restaurantOutline } from 'ionicons/icons';
import { buildWeeklyGroceryList, weeklyMealPlanForDate, type GroceryEstimate, type GroceryIngredientEstimate, type UserProfile } from '@vitamate/domain';
import { BrandMark } from '../components/BrandMark';
import type { VitamateSnapshot } from '../data/localRepository';
import { estimateGroceryCost, fetchMealImages } from '../services/api';

const CHECKED_KEY = 'vitamate.weekly-grocery-checked.v1';
const MARKET_PREFS_KEY = 'vitamate.market-location.v1';
const PRICE_WARNING = 'Los precios son aproximados y pueden variar según la tienda, marca, presentación, disponibilidad, ciudad y fecha de compra.';
const LOCATIONS = [
  ['Ciudad de México', 'Ciudad de México'], ['Guadalajara', 'Jalisco'], ['Monterrey', 'Nuevo León'], ['Puebla', 'Puebla'],
  ['Querétaro', 'Querétaro'], ['Mérida', 'Yucatán'], ['Tijuana', 'Baja California'], ['León', 'Guanajuato'],
  ['Toluca', 'Estado de México'], ['San Luis Potosí', 'San Luis Potosí'], ['Aguascalientes', 'Aguascalientes'],
  ['Chihuahua', 'Chihuahua'], ['Hermosillo', 'Sonora'], ['Veracruz', 'Veracruz'], ['Cancún', 'Quintana Roo'],
] as const;

function stored<T>(key: string, fallback: T): T {
  try { return JSON.parse(window.localStorage.getItem(key) ?? '') as T; }
  catch { return fallback; }
}

const money = (value: number | null | undefined) => value === null || value === undefined ? 'Sin datos' : `$${Math.round(value).toLocaleString('es-MX')}`;
const unitLabel = (quantity: number, unit: 'g' | 'ml' | 'pieza') => unit === 'pieza' ? (quantity === 1 ? 'pieza' : 'piezas') : unit;
const confidenceLabel = (value: GroceryEstimate['confidence']) => ({ high: 'Alta', medium: 'Media', low: 'Baja', unavailable: 'Sin datos' }[value]);

const PlanSemanal = ({ snapshot, onUpdateProfile, onSelectMealPlanOption }: { snapshot: VitamateSnapshot; onUpdateProfile(profile: UserProfile): void; onSelectMealPlanOption(slotId: string, optionIndex: 0 | 1): void }) => {
  const [images, setImages] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>(() => stored(CHECKED_KEY, {}));
  const [activeDay, setActiveDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [marketPrefs, setMarketPrefs] = useState(() => stored(MARKET_PREFS_KEY, { city: 'Guadalajara', state: 'Jalisco', periodDays: 7, people: 1 }));
  const [estimate, setEstimate] = useState<GroceryEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const profile = snapshot.profile!;
  const [budgetDraft, setBudgetDraft] = useState(String(profile.weeklyFoodBudgetMxn));

  useEffect(() => { fetchMealImages().then(setImages).catch(() => undefined); }, []);
  useEffect(() => { window.localStorage.setItem(CHECKED_KEY, JSON.stringify(checked)); }, [checked]);
  useEffect(() => { window.localStorage.setItem(MARKET_PREFS_KEY, JSON.stringify(marketPrefs)); }, [marketPrefs]);

  const plan = useMemo(() => weeklyMealPlanForDate(snapshot.mealPlans), [snapshot.mealPlans]);
  const grocery = useMemo(() => plan ? buildWeeklyGroceryList(plan) : { items: [] }, [plan]);

  useEffect(() => {
    if (!plan) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setEstimateLoading(true); setEstimateError('');
      try {
        const result = await estimateGroceryCost({ ...marketPrefs, weekStart: plan.weekStart, weeklyBudgetMxn: profile.weeklyFoodBudgetMxn, items: grocery.items });
        if (active) setEstimate(result);
      } catch (error) {
        if (active) { setEstimate(null); setEstimateError(error instanceof Error ? error.message : 'No fue posible calcular con los datos oficiales.'); }
      } finally { if (active) setEstimateLoading(false); }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [grocery.items, marketPrefs, plan, profile.weeklyFoodBudgetMxn]);

  if (!plan) return <IonPage className="app-page"><IonContent fullscreen><main className="page-shell weekly-plan-shell"><header className="app-header"><BrandMark compact /></header><section className="empty-state"><h1>Tu plan semanal se está preparando</h1><p>Guarda nuevamente tus metas desde Progreso para crear el plan de esta semana.</p></section></main></IonContent></IonPage>;
  const day = plan.days[activeDay];

  const planCost = estimate?.medianTotalMxn ?? null;
  const displayItems = estimate?.items ?? grocery.items.map((item): GroceryIngredientEstimate => ({
    ...item, canonicalName: null, category: 'Sin clasificar', requiredQuantity: item.quantity, purchaseQuantity: null, purchaseUnit: null,
    packageDescription: null, packagesToBuy: null, leftoverQuantity: null, consumedCostMxn: null, economicCostMxn: null,
    medianCostMxn: null, highCostMxn: null, sampleSize: 0, latestObservedAt: null, geographicScope: null, source: null,
    usedInpc: false, confidence: 'unavailable', reasonUnavailable: 'Estimación oficial pendiente.',
  }));

  const updateCity = (city: string) => {
    const location = LOCATIONS.find(([name]) => name === city);
    if (location) setMarketPrefs((current) => ({ ...current, city: location[0], state: location[1] }));
  };

  return <>
    <IonPage className="app-page"><IonContent fullscreen><main className="page-shell weekly-plan-shell">
      <header className="app-header"><BrandMark compact /><IonRouterLink routerLink="/nutricion" className="back-link"><IonIcon icon={chevronBack} /> Nutrición</IonRouterLink></header>
      <section className="weekly-plan-hero"><div><p className="eyebrow">Lista semanal del súper</p><h1>Tu semana, resuelta</h1><p>Comidas de lunes a domingo y cantidades consolidadas según tus metas y preferencias.</p></div><button className="weekly-budget-button" onClick={() => { setBudgetDraft(String(profile.weeklyFoodBudgetMxn)); setBudgetOpen(true); }}><IonIcon icon={cartOutline} />{estimateLoading ? <IonSpinner /> : <strong>{money(planCost)}</strong>}<span>{estimate?.unpricedItems ? `estimado parcial · ${estimate.unpricedItems} sin referencia` : 'estimado semanal · presupuesto ' + profile.weeklyFoodBudgetMxn.toLocaleString('es-MX')}</span><small>Ajustar presupuesto <IonIcon icon={chevronForward} /></small></button></section>
      <nav className="week-day-tabs" aria-label="Días del plan">{plan.days.map((item, index) => <button key={item.dateKey} className={index === activeDay ? 'is-active' : ''} onClick={() => setActiveDay(index)}><span>{item.label.slice(0, 3)}</span><small>{new Date(`${item.dateKey}T12:00:00`).getDate()}</small></button>)}</nav>
      <section className="weekly-day-plan"><header><div><p className="eyebrow">{day.label}</p><h2>Plan del día</h2></div><span>{day.plan.target?.calories ?? '—'} kcal</span></header>{day.plan.meals.map((slot) => { const index = slot.selectedOptionIndex ?? 0; const option = slot.options[index]; const imageUrl = option.imageUrl ?? images[option.id]; return <article className="weekly-meal-card" key={slot.id}><span className="weekly-meal-image">{imageUrl ? <img src={imageUrl} alt={option.name} /> : <IonIcon icon={restaurantOutline} />}</span><div><small>{slot.label} · opción {index + 1}</small><strong>{option.name}</strong><span>{option.calories} kcal · {option.proteinG}g P · {option.prepMinutes} min</span><details><summary>Ver ingredientes y receta</summary><ul>{option.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul><ol>{option.steps.map((step) => <li key={step}>{step}</li>)}</ol></details></div><div className="weekly-meal-actions"><button onClick={() => onSelectMealPlanOption(slot.id, index === 0 ? 1 : 0)}><IonIcon icon={refreshOutline} /> Cambiar comida</button><IonRouterLink routerLink={`/coach?planAction=replace_meal&planSlotId=${encodeURIComponent(slot.id)}&draft=${encodeURIComponent(`Cambia ${option.name} del ${day.label} por otra comida compatible con aproximadamente ${option.calories} kcal y ${option.proteinG} g de proteína. Aplica el cambio a mi plan.`)}`}><IonIcon icon={chatbubbleEllipsesOutline} /> Pedir otra sugerencia</IonRouterLink></div></article>; })}</section>
      <button className="grocery-summary-card" onClick={() => setGroceryOpen(true)}><span><IonIcon icon={cartOutline} /></span><div><small>Lista semanal del súper</small><strong>{grocery.items.length} productos · {estimateLoading ? 'calculando…' : `${money(planCost)} estimados`}</strong><p>{Object.values(checked).filter(Boolean).length} marcados. El cálculo queda fijo esta semana mientras no cambies el plan, la ubicación o el presupuesto.</p></div><IonIcon icon={chevronForward} /></button>
    </main></IonContent></IonPage>

    <IonModal isOpen={groceryOpen} onDidDismiss={() => setGroceryOpen(false)} className="grocery-modal"><div className="grocery-modal-shell">
      <header><div><p className="eyebrow">Despensa y precios oficiales</p><h2>Qué comprar</h2></div><button onClick={() => setGroceryOpen(false)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></header>
      <section className="market-controls" aria-label="Parámetros del estimado"><label><span><IonIcon icon={locationOutline} /> Ciudad</span><select value={marketPrefs.city} onChange={(event) => updateCity(event.target.value)}>{LOCATIONS.map(([city, state]) => <option key={`${city}-${state}`} value={city}>{city}, {state}</option>)}</select></label><label><span>Periodo</span><select value={marketPrefs.periodDays} onChange={(event) => setMarketPrefs((current) => ({ ...current, periodDays: Number(event.target.value) }))}><option value={7}>1 semana</option><option value={14}>2 semanas</option><option value={28}>4 semanas</option></select></label><label><span>Personas</span><input type="number" min="1" max="20" value={marketPrefs.people} onChange={(event) => setMarketPrefs((current) => ({ ...current, people: Math.max(1, Math.min(20, Number(event.target.value) || 1)) }))} /></label></section>
      {estimateLoading && <div className="market-loading"><IonSpinner /><span>Consultando precios normalizados…</span></div>}
      {estimateError && <div className="market-error"><strong>No fue posible calcular el estimado</strong><span>{estimateError}</span></div>}
      {estimate && <><section className="market-totals"><article><small>Económico</small><strong>{money(estimate.economicTotalMxn)}</strong></article><article className="is-primary"><small>Costo promedio</small><strong>{money(estimate.medianTotalMxn)}</strong></article><article><small>Costo alto</small><strong>{money(estimate.highTotalMxn)}</strong></article></section>{estimate.unpricedItems > 0 && <p className="market-partial">Estimado de {estimate.pricedItems} ingredientes; {estimate.unpricedItems} no tienen aún una referencia compatible.</p>}<section className="market-meta"><span>Confianza: <b>{confidenceLabel(estimate.confidence)}</b></span><span>Calculado para esta semana: <b>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(estimate.calculatedAt))}</b></span><span>Último precio observado: <b>{estimate.latestObservedAt ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${estimate.latestObservedAt}T12:00:00`)) : 'No disponible'}</b></span><span>Fuente: <b>PROFECO · Quién es Quién en los Precios</b></span></section>{estimate.categories.length > 0 && <section className="market-categories"><h3>Desglose por categoría</h3>{estimate.categories.map((category) => <div key={category.category}><span>{category.category}</span><strong>{money(category.medianCostMxn)}</strong></div>)}</section>}</>}
      <p className="grocery-disclaimer">{PRICE_WARNING}</p>
      <div className="grocery-list market-grocery-list">{displayItems.map((item) => <article key={item.id} className={checked[item.id] ? 'is-checked' : ''}><span><input type="checkbox" checked={Boolean(checked[item.id])} onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))} aria-label={`Marcar ${item.name}`} /><span><strong>{item.canonicalName ?? item.name}</strong><small>Necesitas: {item.requiredQuantity} {unitLabel(item.requiredQuantity, item.unit)}</small>{item.packageDescription && <small>Compra estimada: {item.packageDescription}</small>}{item.leftoverQuantity !== null && <small>Sobrante: {item.leftoverQuantity} {unitLabel(item.leftoverQuantity, item.purchaseUnit ?? item.unit)}</small>}<small>{item.source ? `${item.source} · ${item.sampleSize} observaciones · confianza ${confidenceLabel(item.confidence).toLocaleLowerCase('es-MX')}${item.usedInpc ? ' · actualizado con INPC' : ''}${item.estimationBasis ? ` · ${item.estimationBasis}` : ''}` : item.reasonUnavailable}</small></span></span><b>{item.medianCostMxn === null ? 'Sin precio' : money(item.medianCostMxn)}{item.consumedCostMxn !== null && <small>Usado: {money(item.consumedCostMxn)}</small>}</b><IonRouterLink aria-label={`Cambiar ${item.name}`} routerLink={`/coach?planAction=replace_ingredient&ingredient=${encodeURIComponent(item.name)}&draft=${encodeURIComponent(`Sustituye ${item.name} por un ingrediente compatible en todas las comidas seleccionadas de mi plan semanal. Aplica el cambio al plan y a la lista del súper.`)}`} onClick={() => setGroceryOpen(false)}><IonIcon icon={refreshOutline} /></IonRouterLink></article>)}</div>
      {estimate && <details className="market-methodology"><summary>Cómo se calcula</summary><p>{estimate.methodology}</p></details>}
      <IonRouterLink className="grocery-chat-button" routerLink={`/coach?draft=${encodeURIComponent('Quiero hacer cambios a mi plan alimenticio y lista semanal del súper: ')}`} onClick={() => setGroceryOpen(false)}><IonIcon icon={chatbubbleEllipsesOutline} /> Ajustar con VITACOACH</IonRouterLink>
    </div></IonModal>

    <IonModal isOpen={budgetOpen} onDidDismiss={() => setBudgetOpen(false)} className="budget-modal"><div className="budget-modal-shell"><header><div><p className="eyebrow">Presupuesto alimenticio</p><h2>Ajusta tu semana</h2></div><button onClick={() => setBudgetOpen(false)} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button></header><p>VITAMATE usará este monto para priorizar ingredientes y sustituciones más prácticas.</p><label>Presupuesto semanal (MXN)<input type="number" min="300" step="50" inputMode="numeric" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} /></label><div className="budget-comparison"><span>Plan actual</span><strong>{money(planCost)}</strong><small>{planCost === null ? 'Primero importa observaciones de PROFECO para comparar el presupuesto sin inventar precios.' : planCost > Number(budgetDraft) ? `Hay que reducir aproximadamente $${Math.max(0, planCost - Number(budgetDraft)).toLocaleString('es-MX')}.` : 'El plan cabe dentro de este presupuesto estimado.'}</small></div><IonButton expand="block" className="primary-button" disabled={Number(budgetDraft) < 300} onClick={() => { onUpdateProfile({ ...profile, weeklyFoodBudgetMxn: Number(budgetDraft) }); setBudgetOpen(false); }}>Guardar presupuesto</IonButton><IonRouterLink className="budget-coach-link" routerLink={`/coach?draft=${encodeURIComponent(`Ajusta mi plan y lista semanal a un presupuesto máximo de $${budgetDraft} MXN, conservando mis metas de proteína y calorías.`)}`} onClick={() => setBudgetOpen(false)}>Pedir a VITACOACH que lo optimice</IonRouterLink></div></IonModal>
  </>;
};

export default PlanSemanal;
