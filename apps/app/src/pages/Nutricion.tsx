import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonRouterLink, IonSpinner, IonToast } from '@ionic/react';
import { addOutline, barcodeOutline, calendarOutline, cameraOutline, cartOutline, checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline, closeOutline, createOutline, lockClosedOutline, restaurantOutline, searchOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { dailyMealPlanFromWeek, localDateKey, nutritionForGrams, servingMassInGrams, weeklyMealPlanForDate, type DailyMealPlanSlot, type MealEntry, type MealType, type PersonalFood, type FoodCatalogItem } from '@vitamate/domain';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { BrandMark } from '../components/BrandMark';
import { resolveUiLocale } from '../config/appFeatures';
import { localFoodCatalog } from '../data/foodCatalog';
import type { VitamateSnapshot } from '../data/localRepository';
import { analyzeFoodPhoto, fetchMealImages, findFoodByBarcode, searchFoods } from '../services/api';
import { prepareFoodPhoto } from '../services/imageCompression';
import { pickNativePhoto } from '../services/nativeCamera';
import { isNativeIos } from '../services/nativePlatform';

interface Props {
  snapshot: VitamateSnapshot;
  isPremium: boolean;
  onRequestPremium(): void;
  onAddMeal(
    meal: Omit<MealEntry, 'id' | 'createdAt' | 'source' | 'confirmed'> & {
      source?: MealEntry['source'];
    },
  ): string;
  onUpdateMeal(id: string, changes: Pick<MealEntry, 'name' | 'mealType' | 'occurredAt' | 'calories' | 'proteinG' | 'carbohydratesG' | 'fatG'>): void;
  onDeleteMeal(id: string): void;
  onSavePersonalFood(
    food: Omit<PersonalFood, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
  ): void;
  onDeletePersonalFood(id: string): void;
  onSelectMealPlanOption(slotId: string, optionIndex: 0 | 1): void;
}
type Mode = 'chooser' | 'search' | 'barcode' | 'photo' | 'personal';
type PeriodMode = 'day' | 'week' | 'month';
interface PendingMeal {
  name: string;
  source: MealEntry['source'];
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  quantityGrams?: number;
  catalogFood?: FoodCatalogItem;
}
const TYPES: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Colación',
};
const EMPTY_PERSONAL = {
  name: '',
  servingLabel: '1 porción',
  calories: '',
  proteinG: '',
  carbohydratesG: '',
  fatG: '',
  fiberG: '',
};

const Nutricion = ({ snapshot, isPremium, onRequestPremium, onAddMeal, onUpdateMeal, onDeleteMeal, onSavePersonalFood, onDeletePersonalFood, onSelectMealPlanOption }: Props) => {
  const [mode, setMode] = useState<Mode | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodCatalogItem[]>(localFoodCatalog);
  const [loading, setLoading] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMeal | null>(null);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [portionG, setPortionG] = useState('100');
  const [personal, setPersonal] = useState(EMPTY_PERSONAL);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [mealImages, setMealImages] = useState<Record<string, string>>({});
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const period = useMemo(() => nutritionPeriod(anchorDate, periodMode), [anchorDate, periodMode]);
  const meals = useMemo(
    () =>
      snapshot.meals
        .filter((meal) => {
          const occurredAt = new Date(meal.occurredAt);
          return occurredAt >= period.start && occurredAt < period.end;
        })
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [snapshot.meals, period],
  );
  const totals = useMemo(
    () =>
      meals.reduce(
        (summary, meal) => ({
          calories: summary.calories + meal.calories,
          proteinG: summary.proteinG + meal.proteinG,
          carbohydratesG: summary.carbohydratesG + meal.carbohydratesG,
          fatG: summary.fatG + meal.fatG,
        }),
        { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 },
      ),
    [meals],
  );
  const currentPeriod = period.start <= new Date() && new Date() < period.end;
  const currentDay = periodMode === 'day' && localDateKey(anchorDate) === localDateKey();
  const dailyPlan = useMemo(() => (isPremium && currentDay ? dailyMealPlanFromWeek(weeklyMealPlanForDate(snapshot.mealPlans, anchorDate), anchorDate) : null), [isPremium, currentDay, snapshot.mealPlans, anchorDate]);

  useEffect(() => {
    if (isPremium)
      fetchMealImages()
        .then(setMealImages)
        .catch(() => undefined);
  }, [isPremium]);
  useEffect(() => {
    if (mode !== 'photo' || isPremium) return;
    setMode(null);
    onRequestPremium();
  }, [mode, isPremium, onRequestPremium]);

  useEffect(() => {
    const local = localFoodCatalog.filter((food) => food.name.toLocaleLowerCase('es-MX').includes(query.toLocaleLowerCase('es-MX')));
    setResults(local);
    if (query.trim().length < 2) return;
    const timer = window.setTimeout(async () => {
      try {
        setResults(await searchFoods(query.trim()));
      } catch {
        /* Offline catalog stays available. */
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [query]);

  const selectCatalogFood = (food: FoodCatalogItem) => {
    const grams = food.defaultPortionGrams ?? servingMassInGrams(food.servingSize, food.servingQuantity) ?? 100;
    setPortionG(String(grams));
    const nutrition = nutritionForGrams(food, grams);
    setPending({
      name: food.brand ? `${food.name} · ${food.brand}` : food.name,
      source: food.barcode ? 'barcode' : 'catalog',
      ...nutrition,
      quantityGrams: grams,
      catalogFood: food,
    });
  };

  const updateCatalogGrams = (value: string) => {
    setPortionG(value);
    if (!pending?.catalogFood) return;
    const grams = Number(value);
    if (!Number.isFinite(grams) || grams <= 0) return;
    setPending({
      ...pending,
      ...nutritionForGrams(pending.catalogFood, grams),
      quantityGrams: grams,
    });
  };

  const lookupBarcode = async (value = barcode) => {
    if (!/^\d{8,14}$/.test(value)) return setMessage('Ingresa un código de barras válido.');
    setBarcode(value);
    setLoading(true);
    try {
      selectCatalogFood(await findFoodByBarcode(value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No encontramos el producto.');
    } finally {
      setLoading(false);
    }
  };

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.currentTarget.value = '';
    if (file.size > 18_000_000) return setMessage('La imagen original debe pesar menos de 18 MB.');
    try {
      setPhoto(await prepareFoodPhoto(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos preparar la fotografía.');
    }
  };

  const chooseNativePhoto = async (source: 'camera' | 'photos') => {
    try {
      const selected = await pickNativePhoto(source);
      if (selected) setPhoto(selected);
    } catch (error) {
      if (!String(error).toLocaleLowerCase('es-MX').includes('cancel')) setMessage(error instanceof Error ? error.message : 'No pudimos abrir la fotografía.');
    }
  };

  const analyzePhoto = async () => {
    if (!photo) return;
    setLoading(true);
    try {
      const analysis = await analyzeFoodPhoto(photo, resolveUiLocale(snapshot.profile?.locale ?? 'es-MX'));
      const databaseMatches = analysis.items.filter((item) => item.dataSource !== 'vision');
      setPending({
        name: analysis.items.map((item) => (item.brand ? `${item.name} · ${item.brand}` : item.name)).join(', '),
        source: 'photo',
        ...analysis.totals,
      });
      setMessage(databaseMatches.length ? `La IA identificó la foto y ${databaseMatches.length} alimento${databaseMatches.length === 1 ? '' : 's'} se contrastaron con bases nutricionales. Confirma las porciones antes de guardar.` : `Estimación visual con ${Math.round(analysis.overallConfidence * 100)}% de confianza. No encontramos una coincidencia suficientemente segura en las bases; confirma antes de guardar.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos analizar la imagen.');
    } finally {
      setLoading(false);
    }
  };

  const savePending = () => {
    if (!pending || pending.name.trim().length < 2) return;
    const { catalogFood: _catalogFood, ...meal } = pending;
    if (meal.quantityGrams !== undefined && (!Number.isFinite(meal.quantityGrams) || meal.quantityGrams <= 0)) return setMessage('Ingresa una cantidad válida en gramos.');
    onAddMeal({ ...meal, occurredAt: new Date().toISOString(), mealType });
    setPending(null);
    setMode(null);
    setPhoto(null);
    setBarcode('');
    setMessage('Alimento agregado a tu día.');
  };

  const savePersonal = (event: FormEvent) => {
    event.preventDefault();
    const values = [personal.calories, personal.proteinG, personal.carbohydratesG, personal.fatG, personal.fiberG].map(Number);
    if (personal.name.trim().length < 2 || values.some((value) => !Number.isFinite(value) || value < 0)) return setMessage('Revisa los datos del alimento.');
    onSavePersonalFood({
      id: editingId,
      name: personal.name.trim(),
      servingLabel: personal.servingLabel.trim() || '1 porción',
      calories: values[0],
      proteinG: values[1],
      carbohydratesG: values[2],
      fatG: values[3],
      fiberG: values[4],
    });
    setPersonal(EMPTY_PERSONAL);
    setEditingId(undefined);
    setMessage('Alimento personal guardado.');
  };

  const editPersonal = (food: PersonalFood) => {
    setEditingId(food.id);
    setPersonal({
      name: food.name,
      servingLabel: food.servingLabel,
      calories: String(food.calories),
      proteinG: String(food.proteinG),
      carbohydratesG: String(food.carbohydratesG),
      fatG: String(food.fatG),
      fiberG: String(food.fiberG),
    });
  };
  const open = () => {
    setMode('chooser');
    setPending(null);
  };
  const title = useMemo(
    () =>
      ({
        chooser: '¿Cómo quieres registrar?',
        search: 'Buscar alimento',
        barcode: 'Código de barras',
        photo: 'Analizar una foto',
        personal: 'Mis alimentos',
      })[mode ?? 'chooser'],
    [mode],
  );

  return (
    <IonPage className="app-page">
      <IonContent fullscreen>
        <main className="page-shell">
          <header className="app-header">
            <BrandMark compact />
          </header>
          <section className="page-title page-title--action">
            <div>
              <p className="eyebrow">Nutrición</p>
              <h1>Tu registro diario</h1>
              <p>Busca, escanea, fotografía o crea tus propios alimentos.</p>
            </div>
            <IonButton className="primary-button" onClick={open}>
              <IonIcon slot="start" icon={addOutline} />
              Registrar alimento
            </IonButton>
          </section>
          <section className="nutrition-period-card" aria-label="Periodo del registro">
            <div className="nutrition-period-tabs" role="group" aria-label="Vista temporal">
              {(['day', 'week', 'month'] as PeriodMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={periodMode === value ? 'is-active' : ''}
                  aria-pressed={periodMode === value}
                  onClick={() => {
                    setPeriodMode(value);
                    setAnchorDate(new Date());
                  }}
                >
                  {value === 'day' ? 'Día' : value === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
            <div className="nutrition-period-navigation">
              <button type="button" aria-label="Periodo anterior" onClick={() => setAnchorDate((date) => shiftPeriod(date, periodMode, -1))}>
                <IonIcon icon={chevronBackOutline} />
              </button>
              <span>
                <IonIcon icon={calendarOutline} />
                <strong>{period.label}</strong>
                <small>
                  {meals.length} {meals.length === 1 ? 'registro' : 'registros'}
                </small>
              </span>
              <button type="button" aria-label="Periodo siguiente" disabled={currentPeriod} onClick={() => setAnchorDate((date) => shiftPeriod(date, periodMode, 1))}>
                <IonIcon icon={chevronForwardOutline} />
              </button>
            </div>
          </section>
          <section className="daily-strip">
            <div>
              <span>Energía</span>
              <strong>
                {totals.calories}
                <small> kcal</small>
              </strong>
            </div>
            <div>
              <span>Proteína</span>
              <strong>{totals.proteinG}g</strong>
            </div>
            <div>
              <span>Carbohidratos</span>
              <strong>{totals.carbohydratesG}g</strong>
            </div>
            <div>
              <span>Grasa</span>
              <strong>{totals.fatG}g</strong>
            </div>
          </section>
          {!isPremium && (
            <button className="nutrition-premium-preview" onClick={onRequestPremium}>
              <IonIcon icon={lockClosedOutline} />
              <span>
                <small>VITAMATE Premium</small>
                <strong>Desbloquea tu plan alimenticio personalizado</strong>
                <p>Dos opciones por comida, recetas, lista semanal del súper y análisis por foto.</p>
              </span>
              <IonIcon icon={chevronForwardOutline} />
            </button>
          )}
          {dailyPlan && (
            <section className="meal-plan-section">
              <header>
                <div>
                  <p className="eyebrow">Plan alimenticio personalizado</p>
                  <h2>Dos opciones para cada comida</h2>
                  <p>Este día pertenece al mismo plan que tu lista semanal del súper.</p>
                </div>
                <div className="meal-plan-header-actions">
                  <span>{snapshot.profile?.mealsPerDay} comidas</span>
                  <IonRouterLink routerLink="/plan-semanal">
                    <IonIcon icon={cartOutline} /> Lista semanal del súper
                  </IonRouterLink>
                </div>
              </header>
              {dailyPlan.status === 'needs_professional_review' ? (
                <div className="safety-notice">
                  <strong>Plan pendiente de revisión</strong>
                  <p>{dailyPlan.note}</p>
                </div>
              ) : (
                <div className="meal-plan-slots">
                  {dailyPlan.meals.map((slot) => (
                    <MealPlanSlotCard
                      key={slot.id}
                      slot={slot}
                      imageUrls={mealImages}
                      selected={meals.find((meal) => meal.planSlotId === slot.id)}
                      onChoose={(index) => {
                        const option = slot.options[index];
                        onSelectMealPlanOption(slot.id, index);
                        onAddMeal({
                          name: option.name,
                          mealType: slot.mealType,
                          occurredAt: new Date().toISOString(),
                          calories: option.calories,
                          proteinG: option.proteinG,
                          carbohydratesG: option.carbohydratesG,
                          fatG: option.fatG,
                          source: 'manual',
                          planSlotId: slot.id,
                          planOptionId: option.id,
                        });
                        setMessage(`${option.name} quedó elegido aquí y en tu semana, y se registró como comida realizada.`);
                      }}
                      onUndo={onDeleteMeal}
                    />
                  ))}
                </div>
              )}
              <p className="meal-plan-note">{dailyPlan.note}</p>
            </section>
          )}
          {meals.length === 0 ? (
            <section className="empty-state">
              <span>
                <IonIcon icon={restaurantOutline} />
              </span>
              <h2>Sin alimentos en este periodo</h2>
              <p>{currentDay ? 'Empieza con una búsqueda rápida, una foto o un producto escaneado.' : 'Cambia de día o periodo para consultar otros registros.'}</p>
              {currentDay && (
                <IonButton fill="outline" onClick={open}>
                  Registrar alimento
                </IonButton>
              )}
            </section>
          ) : (
            <section className="period-meal-history">
              <header>
                <div>
                  <p className="eyebrow">Historial</p>
                  <h2>Alimentos del {periodMode === 'day' ? 'día' : periodMode === 'week' ? 'periodo semanal' : 'mes'}</h2>
                </div>
                <span>{totals.calories.toLocaleString('es-MX')} kcal</span>
              </header>
              <div className="meal-list">
                {meals.map((meal) => (
                  <article className="meal-row" key={meal.id}>
                    <span className="meal-row__icon">
                      <IonIcon icon={restaurantOutline} />
                    </span>
                    <div>
                      <small>
                        {periodMode !== 'day' && `${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(meal.occurredAt))} · `}
                        {TYPES[meal.mealType]} · {meal.source}
                        {meal.quantityGrams ? ` · ${meal.quantityGrams} g` : ''}
                      </small>
                      <strong>{meal.name}</strong>
                      <span>
                        {meal.proteinG}g P · {meal.carbohydratesG}g C · {meal.fatG}g G
                      </span>
                    </div>
                    <strong>
                      {meal.calories}
                      <small> kcal</small>
                    </strong>
                    {!meal.planSlotId && (
                      <button className="icon-button" aria-label={`Editar ${meal.name}`} onClick={() => setEditingMeal(meal)}>
                        <IonIcon icon={createOutline} />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      </IonContent>
      <IonModal isOpen={Boolean(mode)} onDidDismiss={() => setMode(null)}>
        <div className="modal-card nutrition-modal">
          <header>
            <div>
              <p className="eyebrow">Nuevo registro</p>
              <h2>{title}</h2>
            </div>
            <button className="icon-button" onClick={() => setMode(null)}>
              <IonIcon icon={closeOutline} />
            </button>
          </header>
          {pending ? (
            <section className="confirm-food">
              <p>{pending.catalogFood ? 'Indica el peso que realmente consumirás. Calorías y macronutrientes se recalculan al instante con los valores por 100 g de la fuente.' : 'Revisa la estimación antes de agregarla.'}</p>
              <label className="field">
                <span>Nombre</span>
                <input value={pending.name} onChange={(e) => setPending({ ...pending, name: e.target.value })} />
              </label>
              {pending.catalogFood && (
                <div className="portion-calculator">
                  <label className="field">
                    <span>Cantidad a registrar (gramos)</span>
                    <input type="number" min="1" max="10000" step="1" inputMode="decimal" value={portionG} onChange={(e) => updateCatalogGrams(e.target.value)} />
                  </label>
                  <span>Referencia de la fuente: {pending.catalogFood.servingSize ?? 'sin porción declarada'} · información nutricional por 100 g</span>
                </div>
              )}
              <label className="field">
                <span>Momento</span>
                <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                  {Object.entries(TYPES).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <PendingNumber label="Calorías" value={pending.calories} onChange={(value) => setPending({ ...pending, calories: value })} />
                <PendingNumber label="Proteína (g)" value={pending.proteinG} onChange={(value) => setPending({ ...pending, proteinG: value })} />
                <PendingNumber label="Carbohidratos (g)" value={pending.carbohydratesG} onChange={(value) => setPending({ ...pending, carbohydratesG: value })} />
                <PendingNumber label="Grasa (g)" value={pending.fatG} onChange={(value) => setPending({ ...pending, fatG: value })} />
              </div>
              <IonButton expand="block" className="primary-button" disabled={Boolean(pending.catalogFood) && Number(portionG) <= 0} onClick={savePending}>
                Confirmar y registrar
              </IonButton>
              <button className="text-button" onClick={() => setPending(null)}>
                Volver
              </button>
            </section>
          ) : (
            <>
              {mode === 'chooser' && (
                <div className="food-method-grid">
                  <button
                    className={!isPremium ? 'is-premium-locked' : ''}
                    onClick={() => {
                      if (isPremium) setMode('photo');
                      else {
                        setMode(null);
                        onRequestPremium();
                      }
                    }}
                  >
                    <IonIcon icon={cameraOutline} />
                    <strong>Subir una foto {!isPremium && <IonIcon className="inline-premium-lock" icon={lockClosedOutline} />}</strong>
                    <span>{isPremium ? 'La IA identifica alimentos y estima porciones.' : 'Disponible con VITAMATE Premium.'}</span>
                  </button>
                  <button onClick={() => setMode('search')}>
                    <IonIcon icon={searchOutline} />
                    <strong>Buscar</strong>
                    <span>Catálogo VITAMATE y USDA.</span>
                  </button>
                  <button onClick={() => setMode('barcode')}>
                    <IonIcon icon={barcodeOutline} />
                    <strong>Escanear código</strong>
                    <span>Consulta rápida de productos empacados.</span>
                  </button>
                  <button onClick={() => setMode('personal')}>
                    <IonIcon icon={createOutline} />
                    <strong>Mis alimentos</strong>
                    <span>Crea, edita y reutiliza alimentos propios.</span>
                  </button>
                </div>
              )}
              {mode === 'search' && (
                <section className="food-search">
                  <label className="field">
                    <span>Nombre o marca</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej. pollo, tortilla, yogurt" />
                  </label>
                  <div className="food-results">
                    {results.map((food, index) => (
                      <button key={`${food.source}-${food.id ?? food.name}-${index}`} onClick={() => selectCatalogFood(food)}>
                        <span className="food-result-image">{food.imageUrl ? <img src={food.imageUrl} alt="" /> : <IonIcon icon={restaurantOutline} />}</span>
                        <span>
                          <strong>{food.name}</strong>
                          <small>
                            {food.brand ?? food.source.replaceAll('_', ' ')} · porción sugerida {food.defaultPortionGrams ?? servingMassInGrams(food.servingSize, food.servingQuantity) ?? 100} g
                          </small>
                        </span>
                        <b>
                          {food.caloriesPer100g ?? '—'} kcal<small>/100g</small>
                        </b>
                      </button>
                    ))}
                  </div>
                  {query.length >= 2 && (
                    <IonButton
                      fill="outline"
                      expand="block"
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        try {
                          setResults(await searchFoods(query, true));
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'No fue posible consultar USDA.');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      {loading ? <IonSpinner /> : 'Buscar también en USDA'}
                    </IonButton>
                  )}
                </section>
              )}
              {mode === 'barcode' && (
                <section className="barcode-flow">
                  <BarcodeScanner onDetected={lookupBarcode} />
                  <label className="field">
                    <span>Número del código</span>
                    <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))} placeholder="7501031311309" />
                  </label>
                  <IonButton expand="block" className="primary-button" disabled={loading} onClick={() => lookupBarcode()}>
                    {loading ? <IonSpinner /> : 'Buscar producto'}
                  </IonButton>
                  <p className="source-attribution">Datos de productos proporcionados en parte por Open Food Facts. Verifica siempre la etiqueta.</p>
                </section>
              )}
              {mode === 'photo' && (
                <section className="photo-flow">
                  {photo && (
                    <div className="photo-picker">
                      <img src={photo} alt="Vista previa del alimento" />
                    </div>
                  )}
                  {isNativeIos ? (
                    <div className="native-photo-actions">
                      <IonButton expand="block" className="primary-button" onClick={() => void chooseNativePhoto('camera')}>
                        <IonIcon slot="start" icon={cameraOutline} />
                        Tomar foto
                      </IonButton>
                      <IonButton expand="block" fill="outline" onClick={() => void chooseNativePhoto('photos')}>
                        Elegir del álbum
                      </IonButton>
                      <label className="text-button">
                        Elegir desde Archivos
                        <input className="sr-only" type="file" accept="image/*" onChange={choosePhoto} />
                      </label>
                    </div>
                  ) : (
                    <label className="photo-picker">
                      {photo ? (
                        <img src={photo} alt="Vista previa del alimento" />
                      ) : (
                        <>
                          <IonIcon icon={cameraOutline} />
                          <strong>Tomar o seleccionar foto</strong>
                          <span>JPG, PNG o WebP · se optimiza antes del análisis</span>
                        </>
                      )}
                      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choosePhoto} />
                    </label>
                  )}
                  <IonButton expand="block" className="primary-button" disabled={!photo || loading} onClick={analyzePhoto}>
                    {loading ? <IonSpinner /> : 'Analizar alimento'}
                  </IonButton>
                  <p className="source-attribution">La IA identifica el contenido una sola vez y después contrasta coincidencias con bases nutricionales. Confirma siempre la porción antes de guardar.</p>
                </section>
              )}
              {mode === 'personal' && (
                <section className="personal-foods">
                  <form onSubmit={savePersonal} className="meal-form">
                    <label className="field">
                      <span>Nombre</span>
                      <input value={personal.name} onChange={(e) => setPersonal({ ...personal, name: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>Porción</span>
                      <input
                        value={personal.servingLabel}
                        onChange={(e) =>
                          setPersonal({
                            ...personal,
                            servingLabel: e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="form-grid">
                      {(['calories', 'proteinG', 'carbohydratesG', 'fatG', 'fiberG'] as const).map((key) => (
                        <label className="field" key={key}>
                          <span>
                            {
                              {
                                calories: 'Calorías',
                                proteinG: 'Proteína (g)',
                                carbohydratesG: 'Carbohidratos (g)',
                                fatG: 'Grasa (g)',
                                fiberG: 'Fibra (g)',
                              }[key]
                            }
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={personal[key]}
                            onChange={(e) =>
                              setPersonal({
                                ...personal,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <IonButton type="submit" expand="block" className="primary-button">
                      {editingId ? 'Actualizar alimento' : 'Guardar alimento'}
                    </IonButton>
                  </form>
                  {snapshot.personalFoods.length > 0 && (
                    <div className="personal-food-list">
                      <h3>Tu preselección</h3>
                      {snapshot.personalFoods.map((food) => (
                        <article key={food.id}>
                          <button
                            onClick={() =>
                              setPending({
                                name: food.name,
                                source: 'personal',
                                calories: food.calories,
                                proteinG: food.proteinG,
                                carbohydratesG: food.carbohydratesG,
                                fatG: food.fatG,
                              })
                            }
                          >
                            <strong>{food.name}</strong>
                            <span>
                              {food.servingLabel} · {food.calories} kcal
                            </span>
                          </button>
                          <button className="icon-button" onClick={() => editPersonal(food)}>
                            <IonIcon icon={createOutline} />
                          </button>
                          <button className="icon-button" onClick={() => onDeletePersonalFood(food.id)}>
                            <IonIcon icon={trashOutline} />
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </IonModal>
      <IonModal isOpen={Boolean(editingMeal)} onDidDismiss={() => setEditingMeal(null)}>
        <div className="modal-card nutrition-modal">
          <header>
            <div>
              <p className="eyebrow">Registro manual</p>
              <h2>Editar alimento</h2>
            </div>
            <button className="icon-button" onClick={() => setEditingMeal(null)}>
              <IonIcon icon={closeOutline} />
            </button>
          </header>
          {editingMeal && (
            <form
              className="meal-form"
              onSubmit={(event) => {
                event.preventDefault();
                onUpdateMeal(editingMeal.id, editingMeal);
                setEditingMeal(null);
                setMessage('Registro actualizado.');
              }}
            >
              <label className="field">
                <span>Nombre</span>
                <input required value={editingMeal.name} onChange={(event) => setEditingMeal({ ...editingMeal, name: event.target.value })} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Momento</span>
                  <select
                    value={editingMeal.mealType}
                    onChange={(event) =>
                      setEditingMeal({
                        ...editingMeal,
                        mealType: event.target.value as MealType,
                      })
                    }
                  >
                    {Object.entries(TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={toLocalDateTime(editingMeal.occurredAt)}
                    onChange={(event) =>
                      setEditingMeal({
                        ...editingMeal,
                        occurredAt: new Date(event.target.value).toISOString(),
                      })
                    }
                  />
                </label>
                {(['calories', 'proteinG', 'carbohydratesG', 'fatG'] as const).map((key) => (
                  <label className="field" key={key}>
                    <span>
                      {
                        {
                          calories: 'Calorías',
                          proteinG: 'Proteína (g)',
                          carbohydratesG: 'Carbohidratos (g)',
                          fatG: 'Grasa (g)',
                        }[key]
                      }
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editingMeal[key]}
                      onChange={(event) =>
                        setEditingMeal({
                          ...editingMeal,
                          [key]: Math.max(0, Number(event.target.value)),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <IonButton type="submit" expand="block" className="primary-button">
                Guardar cambios
              </IonButton>
              <IonButton
                type="button"
                expand="block"
                fill="clear"
                color="danger"
                className="record-delete-button"
                onClick={() => {
                  onDeleteMeal(editingMeal.id);
                  setEditingMeal(null);
                  setMessage('Registro eliminado.');
                }}
              >
                <IonIcon slot="start" icon={trashOutline} />
                Eliminar
              </IonButton>
            </form>
          )}
        </div>
      </IonModal>
      <IonToast isOpen={Boolean(message)} message={message} duration={3000} onDidDismiss={() => setMessage('')} />
    </IonPage>
  );
};

function MealPlanSlotCard({ slot, selected, imageUrls, onChoose, onUndo }: { slot: DailyMealPlanSlot; selected?: MealEntry; imageUrls: Record<string, string>; onChoose(index: 0 | 1): void; onUndo(id: string): void }) {
  const selectedOption = selected ? slot.options.find((option) => option.id === selected.planOptionId) : undefined;
  const selectedImage = selectedOption ? (selectedOption.imageUrl ?? imageUrls[selectedOption.id]) : null;
  return (
    <article className={`meal-plan-slot${selected ? ' meal-plan-slot--completed' : ''}`}>
      <header>
        <div>
          <small>{slot.label}</small>
          <strong>{slot.target.calories} kcal</strong>
        </div>
        <span>
          {slot.target.proteinG}g P · {slot.target.carbohydratesG}g C · {slot.target.fatG}g G
        </span>
      </header>
      {selected ? (
        <div className="completed-meal-card">
          <span className="meal-option-image">{selectedImage ? <img src={selectedImage} alt={selected.name} /> : <IonIcon icon={checkmarkCircleOutline} />}</span>
          <div>
            <small>
              <IonIcon icon={checkmarkCircleOutline} /> Comida realizada
            </small>
            <strong>{selected.name}</strong>
            <span>
              {selected.calories} kcal · {selected.proteinG}g P
            </span>
          </div>
          <button onClick={() => onUndo(selected.id)}>Anular elección</button>
        </div>
      ) : (
        <div className="meal-option-grid">
          {slot.options.map((option, index) => {
            const imageUrl = option.imageUrl ?? imageUrls[option.id];
            return (
              <details className={`meal-option${slot.selectedOptionIndex === index ? ' is-selected' : ''}`} key={`${slot.id}-${option.id}-${index}`}>
                <summary>
                  <span className="meal-option-image">
                    {imageUrl ? (
                      <img src={imageUrl} alt={option.name} />
                    ) : (
                      <>
                        <IonIcon icon={restaurantOutline} />
                        <small>Imagen pendiente</small>
                      </>
                    )}
                  </span>
                  <span>
                    <b>
                      Opción {index + 1}
                      {slot.selectedOptionIndex === index ? ' · elegida para la semana' : ''}
                    </b>
                    <strong>{option.name}</strong>
                    <small>
                      <IonIcon icon={timeOutline} /> {option.prepMinutes} min · {option.difficulty}
                    </small>
                  </span>
                </summary>
                <div className="meal-option-details">
                  <div>
                    <h4>Ingredientes</h4>
                    <ul>
                      {option.ingredients.map((ingredient) => (
                        <li key={ingredient}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Preparación</h4>
                    <ol>
                      {option.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <IonButton fill="outline" expand="block" onClick={() => onChoose(index as 0 | 1)}>
                    <IonIcon slot="start" icon={checkmarkCircleOutline} />
                    Elegir y registrar
                  </IonButton>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </article>
  );
}

function PendingNumber({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min="0" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
function toLocalDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function nutritionPeriod(anchor: Date, mode: PeriodMode): { start: Date; end: Date; label: string } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (mode === 'day') {
    end.setDate(end.getDate() + 1);
    return {
      start,
      end,
      label: new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(start),
    };
  }
  if (mode === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
    const last = new Date(end);
    last.setDate(last.getDate() - 1);
    const firstLabel = new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
    }).format(start);
    const lastLabel = new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(last);
    return { start, end, label: `${firstLabel} – ${lastLabel}` };
  }
  start.setDate(1);
  end.setTime(start.getTime());
  end.setMonth(end.getMonth() + 1);
  return {
    start,
    end,
    label: new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(start),
  };
}

function shiftPeriod(anchor: Date, mode: PeriodMode, amount: number): Date {
  const next = new Date(anchor);
  if (mode === 'day') next.setDate(next.getDate() + amount);
  else if (mode === 'week') next.setDate(next.getDate() + amount * 7);
  else next.setMonth(next.getMonth() + amount);
  return next;
}
export default Nutricion;
