export type BiologicalSexForCalculation = 'female' | 'male' | 'not_provided';
export type PrimaryGoal =
  | 'fat_loss'
  | 'muscle_gain'
  | 'recomposition'
  | 'fitness'
  | 'maintain'
  | 'habits'
  | 'strength';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
export type DietaryPattern = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'other';
export type CoachStyle = 'motivating' | 'direct' | 'calm' | 'technical' | 'brief';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type AppLocale = 'es-MX' | 'en-US';
export type FoodBudget = 'economy' | 'balanced' | 'flexible';
export type MealPreparationPreference = 'cook_fresh' | 'meal_prep';
export type MealPrepStructure = 'same_by_meal' | 'full_day_blocks';
export type TrainingPreference = 'gym' | 'home' | 'sport' | 'outdoor' | 'mixed';
export type TrainingEnvironment = 'gym' | 'home';
export type BodyOutcome = 'lean' | 'defined' | 'muscular';
export type SafetyFlag =
  | 'pregnancy_or_breastfeeding'
  | 'eating_disorder'
  | 'recent_surgery'
  | 'chest_pain_or_fainting'
  | 'uncontrolled_condition'
  | 'medical_exercise_restriction';

export interface UserProfile {
  fullName?: string;
  preferredName: string;
  bodyOutcome?: BodyOutcome;
  dateOfBirth: string;
  biologicalSexForCalculation: BiologicalSexForCalculation;
  heightCm: number;
  weightKg: number;
  primaryGoal: PrimaryGoal;
  activityLevel: ActivityLevel;
  weeklyTrainingDays: number;
  trainingMinutes: number;
  equipment: string;
  dietaryPattern: DietaryPattern;
  mealsPerDay: number;
  cookingLevel: 'basic' | 'intermediate' | 'advanced';
  favoriteFoods: string[];
  dislikedFoods: string[];
  allergies: string[];
  preferredCuisines: string[];
  availableCookingMinutes: number;
  foodBudget: FoodBudget;
  weeklyFoodBudgetMxn: number;
  mealPreparationPreference: MealPreparationPreference;
  mealPrepStructure: MealPrepStructure;
  mealPrepRotationDays: number;
  supplements: string[];
  trainingPreference: TrainingPreference;
  preferredSport: string;
  coachStyle: CoachStyle;
  safetyFlags: SafetyFlag[];
  consents: { terms: boolean; privacy: boolean; ai: boolean };
  locale: AppLocale;
  timezone: string;
  units: 'metric';
  completedAt: string;
}

export interface NutritionTarget {
  status: 'calculated' | 'needs_professional_review' | 'needs_more_data';
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  fiberG: number | null;
  waterMl: number | null;
  calculationMethod: 'mifflin_st_jeor';
  calculationVersion: '1.0.0';
  assumptions: string[];
  calculatedAt: string;
}

export interface MealEntry {
  id: string;
  occurredAt: string;
  mealType: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  source: 'manual' | 'catalog' | 'barcode' | 'photo' | 'personal';
  confirmed: true;
  createdAt: string;
  quantityGrams?: number;
  planSlotId?: string;
  planOptionId?: string;
}

export interface PersonalFood {
  id: string;
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  fiberG: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoodCatalogItem {
  id?: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingSize: string | null;
  servingQuantity: number | null;
  defaultPortionGrams: number | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbohydratesPer100g: number | null;
  fatPer100g: number | null;
  imageUrl: string | null;
  source: 'vitamate' | 'open_food_facts' | 'usda';
  qualityStatus: 'complete' | 'partial' | 'rejected';
}

/** Converts an explicitly mass-based serving label to grams. Volume and pieces
 * are deliberately not guessed because doing so requires product density or a
 * verified unit weight. */
export function servingMassInGrams(servingSize: string | null, servingQuantity: number | null): number | null {
  const normalized = servingSize?.trim().toLocaleLowerCase('es-MX') ?? '';
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogramos?|g|gramos?|mg|miligramos?|oz|onzas?|lb|libras?)\b/i);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  const unit = match?.[2]?.toLocaleLowerCase('es-MX');
  if (unit === 'kg' || unit?.startsWith('kilogram')) return Math.round(value * 1000 * 10) / 10;
  if (unit === 'mg' || unit?.startsWith('miligram')) return Math.round((value / 1000) * 10) / 10;
  if (unit === 'oz' || unit?.startsWith('onza')) return Math.round(value * 28.3495 * 10) / 10;
  if (unit === 'lb' || unit?.startsWith('libra')) return Math.round(value * 453.592 * 10) / 10;
  if (unit === 'g' || unit?.startsWith('gram')) return Math.round(value * 10) / 10;
  return null;
}

export function nutritionForGrams(food: Pick<FoodCatalogItem, 'caloriesPer100g' | 'proteinPer100g' | 'carbohydratesPer100g' | 'fatPer100g'>, grams: number): DailyNutritionSummary {
  const safeGrams = Number.isFinite(grams) ? Math.max(0, grams) : 0;
  const factor = safeGrams / 100;
  return {
    calories: Math.round((food.caloriesPer100g ?? 0) * factor),
    proteinG: Math.round((food.proteinPer100g ?? 0) * factor * 10) / 10,
    carbohydratesG: Math.round((food.carbohydratesPer100g ?? 0) * factor * 10) / 10,
    fatG: Math.round((food.fatPer100g ?? 0) * factor * 10) / 10,
  };
}

export interface WorkoutExercise {
  id: string;
  slug: string;
  name: string;
  sets: number;
  repRange: string;
  targetReps: number | null;
  targetSeconds: number | null;
  restSeconds: number;
  progressionMinReps?: number;
  progressionMaxReps?: number;
  note: string;
  instructions: string[];
  mediaUrl: string | null;
}

export interface WorkoutDay {
  id: string;
  title: string;
  focus: string;
  durationMinutes: number;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  id: string;
  status: 'active' | 'needs_professional_review';
  name: string;
  goal: PrimaryGoal;
  createdAt: string;
  version: 'starter-1.0.0' | 'progressive-1.1.0' | 'progressive-1.2.0';
  days: WorkoutDay[];
  note: string;
}

export interface WorkoutSession {
  id: string;
  workoutDayId: string;
  workoutTitle: string;
  completedAt: string;
  durationMinutes: number;
  perceivedEffort: number;
  startedAt?: string;
  feedback?: string;
  exerciseResults?: WorkoutExerciseResult[];
  source?: 'guided' | 'manual';
  activityType?: 'strength' | 'cardio' | 'mobility' | 'sport' | 'other';
  caloriesBurned?: number;
  requirementCreditMinutes?: number;
}

export interface WorkoutExerciseResult {
  exerciseId: string;
  exerciseSlug: string;
  exerciseName: string;
  targetReps: number | null;
  completedReps: number;
  targetSeconds: number | null;
  completedSeconds: number;
  difficulty: number;
  repTimestamps?: string[];
  sets?: WorkoutSetResult[];
  prescribedLoadKg?: number | null;
}

export interface WorkoutSetResult {
  setNumber: number;
  targetReps: number;
  completedReps: number;
  loadKg: number | null;
}

export interface WeightEntry {
  id: string;
  weightKg: number;
  recordedAt: string;
}

export interface CoachChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type CoachMemoryCategory = 'identity' | 'preference' | 'goal' | 'routine' | 'motivation' | 'constraint' | 'relationship' | 'health_context';

export interface CoachMemory {
  key: string;
  category: CoachMemoryCategory;
  content: string;
  importance: number;
  confidence: number;
  expiresAt: string | null;
  updatedAt: string;
}

export interface CoachMemoryUpdate {
  operation: 'upsert' | 'delete';
  key: string;
  category: CoachMemoryCategory;
  content: string;
  importance: number;
  confidence: number;
  ttlDays: number | null;
}

export interface HealthDocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  summary: string;
}

export interface DailyNutritionSummary {
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
}

export interface MealPlanOption {
  id: string;
  name: string;
  mealType: MealType;
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  ingredients: string[];
  steps: string[];
  prepMinutes: number;
  difficulty: UserProfile['cookingLevel'];
  imageUrl: string | null;
}

export interface DailyMealPlanSlot {
  id: string;
  label: string;
  mealType: MealType;
  target: DailyNutritionSummary;
  options: [MealPlanOption, MealPlanOption];
  selectedOptionIndex: 0 | 1;
}

export interface DailyMealPlan {
  id: string;
  dateKey: string;
  status: 'ready' | 'needs_professional_review';
  target: DailyNutritionSummary | null;
  meals: DailyMealPlanSlot[];
  note: string;
}

export interface WeeklyMealPlanDay {
  dateKey: string;
  label: string;
  plan: DailyMealPlan;
}

export interface WeeklyMealPlan {
  id: string;
  weekStart: string;
  days: WeeklyMealPlanDay[];
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'g' | 'ml' | 'pieza';
}

export type GroceryEstimateConfidence = 'high' | 'medium' | 'low' | 'unavailable';

export interface GroceryIngredientEstimate extends GroceryItem {
  canonicalName: string | null;
  category: string;
  requiredQuantity: number;
  purchaseQuantity: number | null;
  purchaseUnit: GroceryItem['unit'] | null;
  packageDescription: string | null;
  packagesToBuy: number | null;
  leftoverQuantity: number | null;
  consumedCostMxn: number | null;
  economicCostMxn: number | null;
  medianCostMxn: number | null;
  highCostMxn: number | null;
  sampleSize: number;
  latestObservedAt: string | null;
  geographicScope: 'city' | 'state' | 'national' | null;
  source: 'PROFECO QQP' | 'Estimación VITAMATE · PROFECO' | null;
  usedInpc: boolean;
  confidence: GroceryEstimateConfidence;
  estimationBasis?: string;
  reasonUnavailable?: string;
}

export interface GroceryEstimate {
  city: string;
  state: string;
  periodDays: number;
  people: number;
  economicTotalMxn: number | null;
  medianTotalMxn: number | null;
  highTotalMxn: number | null;
  consumedTotalMxn: number | null;
  pricedItems: number;
  unpricedItems: number;
  categories: Array<{ category: string; medianCostMxn: number }>;
  items: GroceryIngredientEstimate[];
  calculatedAt: string;
  latestObservedAt: string | null;
  confidence: GroceryEstimateConfidence;
  cached: boolean;
  methodology: string;
  warning: string;
}

export interface GroceryEstimateRequest {
  city: string;
  state: string;
  periodDays: number;
  people: number;
  weekStart?: string;
  weeklyBudgetMxn?: number;
  items: GroceryItem[];
}

export interface WeeklyNutritionBalance {
  consumed: DailyNutritionSummary;
  target: DailyNutritionSummary;
  balance: DailyNutritionSummary;
  daysElapsed: number;
  daysRemaining: number;
  suggestedDailyRemainder: DailyNutritionSummary;
}

export interface WeeklyWorkoutBalance {
  sessions: number;
  targetSessions: number;
  minutes: number;
  targetMinutes: number;
  caloriesBurned: number;
  targetCalories: number;
  remainingMinutes: number;
  remainingCalories: number;
}

export interface ProgressivePrescription {
  targetRepsPerSet: number;
  suggestedLoadKg: number | null;
  previousLoadKg: number | null;
  previousRepsPerSet: number[];
  progressionNote: string;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

const GOAL_MULTIPLIERS: Record<PrimaryGoal, number> = {
  fat_loss: 0.85,
  muscle_gain: 1.08,
  recomposition: 0.95,
  fitness: 1,
  maintain: 1,
  habits: 1,
  strength: 1.05,
};

export function ageOnDate(dateOfBirth: string, referenceDate = new Date()): number {
  const birthDate = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return 0;
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

export function calculateNutritionTarget(profile: UserProfile, now = new Date()): NutritionTarget {
  const age = ageOnDate(profile.dateOfBirth, now);
  const base = {
    calculationMethod: 'mifflin_st_jeor' as const,
    calculationVersion: '1.0.0' as const,
    calculatedAt: now.toISOString(),
  };
  const waterMl = Math.round((profile.weightKg * 35) / 50) * 50;

  if (age < 18 || profile.safetyFlags.length > 0) {
    return {
      ...base,
      status: 'needs_professional_review',
      calories: null,
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
      fiberG: null,
      waterMl,
      assumptions: ['El cuestionario requiere revisión profesional antes de generar objetivos personalizados.'],
    };
  }

  if (profile.biologicalSexForCalculation === 'not_provided') {
    return {
      ...base,
      status: 'needs_more_data',
      calories: null,
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
      fiberG: null,
      waterMl,
      assumptions: ['Falta el dato requerido por la fórmula energética; no se asignó uno por defecto.'],
    };
  }

  const sexConstant = profile.biologicalSexForCalculation === 'male' ? 5 : -161;
  const restingEnergy = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age + sexConstant;
  const estimate = restingEnergy * ACTIVITY_MULTIPLIERS[profile.activityLevel] * GOAL_MULTIPLIERS[profile.primaryGoal];
  const safetyFloor = profile.biologicalSexForCalculation === 'male' ? 1500 : 1200;
  const calories = Math.round(Math.max(estimate, safetyFloor) / 10) * 10;
  const proteinPerKg = ['muscle_gain', 'recomposition', 'strength', 'fat_loss'].includes(profile.primaryGoal) ? 1.8 : 1.6;
  const proteinG = Math.round(profile.weightKg * proteinPerKg);
  const fatG = Math.round(profile.weightKg * 0.8);
  const carbohydratesG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    ...base,
    status: 'calculated',
    calories,
    proteinG,
    carbohydratesG,
    fatG,
    fiberG: Math.round(calories * 0.014),
    waterMl,
    assumptions: [
      'Estimación inicial con Mifflin-St Jeor y actividad declarada.',
      'Es una referencia educativa y debe ajustarse con tendencias semanales.',
    ],
  };
}

const EXERCISES = {
  squat: { slug: 'squat', name: 'Sentadilla con barra', note: 'Compuesto principal de pierna; prioriza profundidad controlada y estabilidad.', instructions: ['Barra estable sobre la parte alta de la espalda', 'Inhala y bloquea el torso antes de bajar', 'Rodillas siguen la dirección de los pies', 'Sube empujando el suelo sin perder postura'], targetReps: 4, targetSeconds: null },
  inclinePress: { slug: 'incline-barbell-press', name: 'Press inclinado con barra', note: 'Empuje principal para pecho superior con banco a inclinación moderada.', instructions: ['Banco entre 20° y 35°', 'Escápulas atrás y pies firmes', 'Baja la barra hacia la parte alta del pecho', 'Empuja manteniendo muñecas sobre codos'], targetReps: 4, targetSeconds: null },
  chestPress: { slug: 'chest-press', name: 'Press de pecho plano', note: 'Empuje horizontal pesado con barra, mancuernas o máquina.', instructions: ['Apoya espalda alta y pies', 'Baja con control sin rebotar', 'Antebrazos casi verticales', 'Empuja sin perder la posición del hombro'], targetReps: 4, targetSeconds: null },
  row: { slug: 'row', name: 'Remo con barra', note: 'Tracción horizontal con torso firme y recorrido controlado.', instructions: ['Bisagra de cadera y espalda neutra', 'Lleva la barra hacia el abdomen', 'Codos viajan atrás sin elevar hombros', 'Baja la carga con control'], targetReps: 4, targetSeconds: null },
  hinge: { slug: 'romanian-deadlift', name: 'Peso muerto rumano', note: 'Cadena posterior; la cadera se desplaza atrás mientras la carga permanece cerca.', instructions: ['Rodillas ligeramente flexionadas', 'Lleva la cadera hacia atrás', 'Barra cerca de muslos y piernas', 'Sube extendiendo la cadera, no la espalda'], targetReps: 4, targetSeconds: null },
  pulldown: { slug: 'lat-pulldown', name: 'Jalón al pecho', note: 'Tracción vertical para espalda sin balancear el torso.', instructions: ['Fija muslos y eleva el pecho', 'Inicia bajando los hombros', 'Lleva la barra hacia la parte alta del pecho', 'Regresa sin perder control'], targetReps: 6, targetSeconds: null },
  legPress: { slug: 'leg-press', name: 'Prensa de pierna', note: 'Usa el rango que te permita mantener pelvis y espalda apoyadas.', instructions: ['Pies firmes al ancho de caderas', 'Desbloquea y baja con control', 'Rodillas alineadas con los pies', 'Empuja sin bloquear bruscamente'], targetReps: 6, targetSeconds: null },
  shoulder: { slug: 'shoulder-press', name: 'Press militar', note: 'Empuje vertical sin compensar con la zona lumbar.', instructions: ['Aprieta abdomen y glúteos', 'Codos bajo las manos', 'Empuja la carga sobre la cabeza', 'Baja con control hasta una posición cómoda'], targetReps: 4, targetSeconds: null },
  reverseLunge: { slug: 'reverse-lunge', name: 'Zancada hacia atrás', note: 'Trabajo unilateral; reduce el rango si pierdes equilibrio.', instructions: ['Da un paso atrás suficientemente largo', 'Desciende ambas rodillas', 'Mantén el pie delantero completo apoyado', 'Regresa empujando con la pierna delantera'], targetReps: 6, targetSeconds: null },
  lateralRaise: { slug: 'lateral-raise', name: 'Elevación lateral', note: 'Accesorio de hombro con carga moderada y sin impulso.', instructions: ['Brazos ligeramente flexionados', 'Eleva en el plano de las escápulas', 'Detente cerca de la altura del hombro', 'Baja lentamente'], targetReps: 8, targetSeconds: null },
  curl: { slug: 'barbell-curl', name: 'Curl con barra', note: 'Mantén los codos quietos y evita balancear el cuerpo.', instructions: ['Torso alto y abdomen activo', 'Codos junto al cuerpo', 'Flexiona sin adelantar los hombros', 'Baja hasta extender con control'], targetReps: 6, targetSeconds: null },
  triceps: { slug: 'triceps-pressdown', name: 'Extensión de tríceps en polea', note: 'Extiende el codo sin mover el hombro.', instructions: ['Codos pegados al torso', 'Antebrazos inician flexionados', 'Empuja hacia abajo hasta extender', 'Regresa despacio sin abrir codos'], targetReps: 8, targetSeconds: null },
  calf: { slug: 'standing-calf-raise', name: 'Elevación de pantorrilla de pie', note: 'Pausa arriba y controla la posición baja.', instructions: ['Apoya el antepié con estabilidad', 'Desciende el talón en rango cómodo', 'Sube al máximo sin rebotar', 'Pausa y baja lentamente'], targetReps: 8, targetSeconds: null },
  cableCrunch: { slug: 'kneeling-cable-crunch', name: 'Crunch arrodillado en polea', note: 'Flexiona el tronco con el abdomen; no tires solo con los brazos.', instructions: ['Arrodíllate estable frente a la polea', 'Mantén manos cerca de la cabeza', 'Acerca costillas hacia pelvis', 'Regresa sin hiperextender la espalda'], targetReps: 8, targetSeconds: null },
  gobletSquat: { slug: 'goblet-squat', name: 'Sentadilla goblet', note: 'Usa mancuerna, kettlebell o mochila abrazada al pecho.', instructions: ['Sostén la carga cerca del pecho', 'Pies estables al ancho cómodo', 'Baja cadera entre las piernas', 'Sube conservando torso y rodillas alineados'], targetReps: 6, targetSeconds: null },
  pushup: { slug: 'push-up', name: 'Flexión de brazos', note: 'Elige pared, banco, suelo o pies elevados para ajustar la dificultad.', instructions: ['Manos ligeramente más anchas que hombros', 'Cuerpo firme de cabeza a talones', 'Baja pecho y cadera juntos', 'Empuja el suelo sin perder la línea corporal'], targetReps: 6, targetSeconds: null },
  oneArmRow: { slug: 'one-arm-row', name: 'Remo a una mano', note: 'Usa mancuerna, garrafón o mochila y apoya la mano libre.', instructions: ['Apoya mano y pies con estabilidad', 'Espalda larga y cadera quieta', 'Lleva el codo hacia la cadera', 'Baja la carga sin girar el torso'], targetReps: 6, targetSeconds: null },
  backpackRdl: { slug: 'backpack-romanian-deadlift', name: 'Peso muerto rumano con mochila', note: 'Aumenta gradualmente el contenido de la mochila cuando completes el rango.', instructions: ['Sujeta la mochila cerca de las piernas', 'Flexiona apenas las rodillas', 'Lleva la cadera hacia atrás', 'Aprieta glúteos para volver de pie'], targetReps: 6, targetSeconds: null },
  homeLunge: { slug: 'home-reverse-lunge', name: 'Zancada atrás en casa', note: 'Puede hacerse con peso corporal, mancuernas o mochila.', instructions: ['Da un paso atrás y encuentra equilibrio', 'Desciende ambas rodillas', 'Mantén el torso estable', 'Empuja el suelo con el pie delantero'], targetReps: 6, targetSeconds: null },
  pikePress: { slug: 'pike-push-up', name: 'Flexión pica', note: 'Empuje de hombro con cadera elevada; usa un rango que controles.', instructions: ['Forma una V invertida con el cuerpo', 'Manos firmes y codos orientados atrás', 'Acerca la cabeza entre las manos', 'Empuja para volver sin colapsar hombros'], targetReps: 6, targetSeconds: null },
  splitSquat: { slug: 'split-squat', name: 'Sentadilla dividida', note: 'Mantén los pies en dos rieles y carga principalmente la pierna delantera.', instructions: ['Coloca un pie adelante y otro atrás', 'Mantén el talón delantero apoyado', 'Desciende la rodilla trasera', 'Sube empujando con la pierna delantera'], targetReps: 6, targetSeconds: null },
  gluteBridge: { slug: 'glute-bridge', name: 'Puente de glúteo', note: 'Añade mochila sobre la cadera cuando el peso corporal sea fácil.', instructions: ['Acuéstate con pies cerca de la cadera', 'Mantén costillas controladas', 'Eleva la pelvis apretando glúteos', 'Baja sin arquear la espalda'], targetReps: 8, targetSeconds: null },
  deadBug: { slug: 'dead-bug', name: 'Dead bug', note: 'Control de core; conserva la espalda baja apoyada.', instructions: ['Cadera y rodillas a 90°', 'Presiona suavemente la espalda contra el suelo', 'Extiende brazo y pierna contrarios', 'Vuelve y alterna sin acelerar'], targetReps: 6, targetSeconds: null },
  plank: { slug: 'plank', name: 'Plancha', note: 'Respira y conserva una línea larga sin hundir la cadera.', instructions: ['Apoya antebrazos bajo hombros', 'Alinea cabeza, torso y piernas', 'Activa abdomen y glúteos', 'Respira continuamente'], targetReps: null, targetSeconds: 30 },
  backpackCurl: { slug: 'backpack-curl', name: 'Curl con mochila', note: 'Ajusta el contenido de la mochila y evita usar impulso.', instructions: ['Sujeta ambos extremos de la mochila', 'Codos junto al cuerpo', 'Flexiona hasta donde controles', 'Baja lentamente'], targetReps: 8, targetSeconds: null },
  chairDip: { slug: 'chair-triceps-dip', name: 'Fondo de tríceps en silla', note: 'Usa una silla totalmente estable y limita el descenso si molesta el hombro.', instructions: ['Asegura la silla contra una pared', 'Manos cerca de la cadera', 'Flexiona codos hacia atrás', 'Empuja hasta volver sin elevar hombros'], targetReps: 6, targetSeconds: null },
  homeCalf: { slug: 'single-leg-calf-raise', name: 'Pantorrilla a una pierna', note: 'Sujétate ligeramente y usa una mochila para progresar.', instructions: ['Apoya una mano para equilibrarte', 'Eleva un pie del suelo', 'Sube el talón sin girar el tobillo', 'Pausa arriba y baja lento'], targetReps: 8, targetSeconds: null },
};

type ExerciseOptions = { restSeconds?: number; targetSeconds?: number; minReps?: number; maxReps?: number };

function exercise(id: string, key: keyof typeof EXERCISES, sets: number, repRange: string, options: ExerciseOptions = {}): WorkoutExercise {
  const definition = EXERCISES[key];
  const progressionMinReps = definition.targetReps === null ? undefined : options.minReps ?? definition.targetReps;
  const progressionMaxReps = definition.targetReps === null ? undefined : options.maxReps ?? Math.max(progressionMinReps ?? 4, definition.targetReps + 2);
  return {
    id,
    ...definition,
    sets,
    repRange,
    restSeconds: options.restSeconds ?? (definition.targetReps !== null && definition.targetReps <= 6 ? 120 : 75),
    targetSeconds: options.targetSeconds ?? definition.targetSeconds,
    progressionMinReps,
    progressionMaxReps,
    mediaUrl: null,
  };
}

function gymTemplates(minutes: number) {
  const day = (id: string, title: string, focus: string, items: WorkoutExercise[]): WorkoutDay => ({ id: `gym-${id}`, title, focus, durationMinutes: minutes, exercises: items });
  const fullA = day('full-a', 'Cuerpo completo A', 'Sentadilla, empuje inclinado, espalda y abdomen', [exercise('ga1', 'squat', 3, '4–6'), exercise('ga2', 'inclinePress', 3, '4–6'), exercise('ga3', 'row', 3, '4–6'), exercise('ga4', 'cableCrunch', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  const fullB = day('full-b', 'Cuerpo completo B', 'Cadena posterior, pecho, tracción vertical y hombro', [exercise('gb1', 'hinge', 3, '4–6'), exercise('gb2', 'chestPress', 3, '4–6'), exercise('gb3', 'pulldown', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('gb4', 'shoulder', 3, '4–6')]);
  const fullC = day('full-c', 'Cuerpo completo C', 'Pierna, torso y accesorios controlados', [exercise('gc1', 'legPress', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('gc2', 'inclinePress', 3, '4–6'), exercise('gc3', 'row', 3, '4–6'), exercise('gc4', 'calf', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  const upperA = day('upper-a', 'Torso A', 'Pecho superior, espalda y hombro', [exercise('gua1', 'inclinePress', 3, '4–6'), exercise('gua2', 'row', 3, '4–6'), exercise('gua3', 'shoulder', 3, '4–6'), exercise('gua4', 'pulldown', 3, '6–8', { minReps: 6, maxReps: 8 })]);
  const lowerA = day('lower-a', 'Pierna A', 'Sentadilla, cadena posterior, unilateral y pantorrilla', [exercise('gla1', 'squat', 3, '4–6'), exercise('gla2', 'hinge', 3, '4–6'), exercise('gla3', 'reverseLunge', 3, '6–8 por lado', { minReps: 6, maxReps: 8 }), exercise('gla4', 'calf', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  const upperB = day('upper-b', 'Torso B', 'Pecho plano, tracción y brazos', [exercise('gub1', 'chestPress', 3, '4–6'), exercise('gub2', 'pulldown', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('gub3', 'curl', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('gub4', 'triceps', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  const lowerB = day('lower-b', 'Pierna B', 'Prensa, bisagra, estabilidad y abdomen', [exercise('glb1', 'legPress', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('glb2', 'hinge', 3, '4–6'), exercise('glb3', 'reverseLunge', 3, '6–8 por lado', { minReps: 6, maxReps: 8 }), exercise('glb4', 'cableCrunch', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  const push = day('push', 'Empuje', 'Pecho, hombro y tríceps', [exercise('gp1', 'inclinePress', 3, '4–6'), exercise('gp2', 'chestPress', 3, '4–6'), exercise('gp3', 'shoulder', 3, '4–6'), exercise('gp4', 'lateralRaise', 3, '8–10', { minReps: 8, maxReps: 10 }), exercise('gp5', 'triceps', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  const pull = day('pull', 'Tracción', 'Espalda, cadena posterior y bíceps', [exercise('gpl1', 'hinge', 3, '4–6'), exercise('gpl2', 'row', 3, '4–6'), exercise('gpl3', 'pulldown', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('gpl4', 'curl', 3, '6–8', { minReps: 6, maxReps: 8 })]);
  const legs = day('legs', 'Pierna', 'Cuádriceps, glúteo, femoral y pantorrilla', [exercise('gl1', 'squat', 3, '4–6'), exercise('gl2', 'legPress', 3, '6–8', { minReps: 6, maxReps: 8 }), exercise('gl3', 'hinge', 3, '4–6'), exercise('gl4', 'calf', 3, '8–10', { minReps: 8, maxReps: 10 })]);
  return { fullA, fullB, fullC, upperA, lowerA, upperB, lowerB, push, pull, legs };
}

function homeTemplates(minutes: number) {
  const day = (id: string, title: string, focus: string, items: WorkoutExercise[]): WorkoutDay => ({ id: `home-${id}`, title, focus, durationMinutes: minutes, exercises: items });
  const fullA = day('full-a', 'Casa: cuerpo completo A', 'Sentadilla, empuje, remo y core', [exercise('ha1', 'gobletSquat', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('ha2', 'pushup', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('ha3', 'oneArmRow', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('ha4', 'plank', 3, '30–45 s', { targetSeconds: 30 })]);
  const fullB = day('full-b', 'Casa: cuerpo completo B', 'Bisagra, hombro, unilateral y control abdominal', [exercise('hb1', 'backpackRdl', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hb2', 'pikePress', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hb3', 'homeLunge', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hb4', 'deadBug', 3, '6–10 por lado', { minReps: 6, maxReps: 10 })]);
  const fullC = day('full-c', 'Casa: cuerpo completo C', 'Pierna unilateral, torso y glúteo', [exercise('hc1', 'splitSquat', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hc2', 'pushup', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hc3', 'oneArmRow', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hc4', 'gluteBridge', 3, '8–12', { minReps: 8, maxReps: 12 })]);
  const upperA = day('upper-a', 'Casa: torso A', 'Empuje, espalda y hombro', [exercise('hua1', 'pushup', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hua2', 'oneArmRow', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hua3', 'pikePress', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hua4', 'backpackCurl', 3, '8–12', { minReps: 8, maxReps: 12 })]);
  const lowerA = day('lower-a', 'Casa: pierna A', 'Sentadilla, bisagra, unilateral y pantorrilla', [exercise('hla1', 'gobletSquat', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hla2', 'backpackRdl', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hla3', 'homeLunge', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hla4', 'homeCalf', 3, '8–12', { minReps: 8, maxReps: 12 })]);
  const upperB = day('upper-b', 'Casa: torso B', 'Empuje alterno, remo y brazos', [exercise('hub1', 'pikePress', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hub2', 'oneArmRow', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hub3', 'chairDip', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hub4', 'backpackCurl', 3, '8–12', { minReps: 8, maxReps: 12 })]);
  const lowerB = day('lower-b', 'Casa: pierna B', 'Unilateral, glúteo y core', [exercise('hlb1', 'splitSquat', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hlb2', 'gluteBridge', 3, '8–12', { minReps: 8, maxReps: 12 }), exercise('hlb3', 'gobletSquat', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hlb4', 'deadBug', 3, '6–10 por lado', { minReps: 6, maxReps: 10 })]);
  const push = day('push', 'Casa: empuje', 'Pecho, hombro y tríceps', [exercise('hp1', 'pushup', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hp2', 'pikePress', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hp3', 'chairDip', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hp4', 'plank', 3, '30–45 s', { targetSeconds: 30 })]);
  const pull = day('pull', 'Casa: tracción', 'Espalda, cadena posterior y bíceps', [exercise('hpl1', 'backpackRdl', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hpl2', 'oneArmRow', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hpl3', 'backpackCurl', 3, '8–12', { minReps: 8, maxReps: 12 }), exercise('hpl4', 'deadBug', 3, '6–10 por lado', { minReps: 6, maxReps: 10 })]);
  const legs = day('legs', 'Casa: pierna', 'Cuádriceps, glúteo, femoral y pantorrilla', [exercise('hl1', 'gobletSquat', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hl2', 'backpackRdl', 3, '6–10', { minReps: 6, maxReps: 10 }), exercise('hl3', 'splitSquat', 3, '6–10 por lado', { minReps: 6, maxReps: 10 }), exercise('hl4', 'homeCalf', 3, '8–12', { minReps: 8, maxReps: 12 })]);
  return { fullA, fullB, fullC, upperA, lowerA, upperB, lowerB, push, pull, legs };
}

export function generateStarterWorkoutPlan(profile: UserProfile, now = new Date(), environmentOverride?: TrainingEnvironment): WorkoutPlan {
  if (profile.safetyFlags.length > 0) {
    return {
      id: 'starter-review',
      status: 'needs_professional_review',
      name: 'Plan pendiente de revisión',
      goal: profile.primaryGoal,
      createdAt: now.toISOString(),
      version: 'starter-1.0.0',
      days: [],
      note: 'Consulta a un profesional antes de iniciar un plan de entrenamiento personalizado.',
    };
  }

  const minutes = Math.max(30, Math.min(60, profile.trainingMinutes));
  const dayCount = Math.max(1, Math.min(5, profile.weeklyTrainingDays));
  const environment: TrainingEnvironment = environmentOverride ?? (profile.trainingPreference === 'home' ? 'home' : 'gym');
  const templates = environment === 'gym' ? gymTemplates(minutes) : homeTemplates(minutes);
  const days = dayCount === 1 ? [templates.fullA]
    : dayCount === 2 ? [templates.fullA, templates.fullB]
      : dayCount === 3 ? [templates.fullA, templates.fullB, templates.fullC]
        : dayCount === 4 ? [templates.upperA, templates.lowerA, templates.upperB, templates.lowerB]
          : [templates.push, templates.pull, templates.legs, templates.upperA, templates.lowerB];
  return {
    id: `starter-${profile.primaryGoal}`,
    status: 'active',
    name: environment === 'gym' ? 'Tu rutina estable de gimnasio' : 'Tu rutina estable en casa',
    goal: profile.primaryGoal,
    createdAt: now.toISOString(),
    version: 'progressive-1.2.0',
    days,
    note: environment === 'gym'
      ? 'Rutina de fuerza breve y repetible. Completa el rango con 1–2 repeticiones en reserva; sube repeticiones antes de aumentar la carga.'
      : 'Rutina para casa con peso corporal, mochila o mancuernas. Progresa con repeticiones, carga de la mochila o una variante más difícil sin sacrificar técnica.',
  };
}

type RecipeTemplate = {
  id: string;
  name: string;
  mealTypes: MealType[];
  patterns: DietaryPattern[];
  tags: string[];
  baseCalories: number;
  prepMinutes: number;
  difficulty: UserProfile['cookingLevel'];
  ingredients: string[];
  steps: string[];
};

const RECIPE_TEMPLATES: RecipeTemplate[] = [
  { id: 'oats-berries-yogurt', name: 'Avena cremosa con frutos rojos', mealTypes: ['breakfast', 'snack'], patterns: ['omnivore', 'vegetarian', 'pescatarian', 'other'], tags: ['avena', 'yogurt', 'fruta', 'dulce'], baseCalories: 430, prepMinutes: 8, difficulty: 'basic', ingredients: ['60 g de avena', '200 g de yogurt griego natural', '120 g de frutos rojos', '15 g de nuez o almendra', 'Canela al gusto'], steps: ['Cocina la avena con agua hasta que quede cremosa.', 'Sirve con el yogurt, la fruta y las nueces.', 'Termina con canela; no requiere azúcar añadida.'] },
  { id: 'tofu-oats-berries', name: 'Avena proteica vegetal con frutos rojos', mealTypes: ['breakfast', 'snack'], patterns: ['vegan'], tags: ['avena', 'fruta', 'vegano', 'dulce'], baseCalories: 430, prepMinutes: 8, difficulty: 'basic', ingredients: ['60 g de avena', '220 ml de bebida de soya sin azúcar', '120 g de frutos rojos', '20 g de crema de cacahuate', 'Canela al gusto'], steps: ['Cocina la avena con la bebida de soya.', 'Agrega fruta y crema de cacahuate.', 'Mezcla y termina con canela.'] },
  { id: 'eggs-beans-tortilla', name: 'Huevos con frijoles y tortilla', mealTypes: ['breakfast', 'lunch'], patterns: ['omnivore', 'vegetarian', 'pescatarian', 'other'], tags: ['huevo', 'frijoles', 'mexicana', 'salado'], baseCalories: 510, prepMinutes: 15, difficulty: 'basic', ingredients: ['2 huevos y 150 g de claras', '120 g de frijoles de la olla', '3 tortillas de maíz', 'Pico de gallo', '30 g de aguacate'], steps: ['Cocina los huevos y claras en sartén antiadherente.', 'Calienta frijoles y tortillas.', 'Sirve con pico de gallo y aguacate.'] },
  { id: 'chicken-rice-bowl', name: 'Bowl de pollo, arroz y verduras', mealTypes: ['lunch', 'dinner'], patterns: ['omnivore', 'other'], tags: ['pollo', 'arroz', 'verduras', 'mexicana'], baseCalories: 650, prepMinutes: 25, difficulty: 'basic', ingredients: ['170 g de pechuga de pollo', '180 g de arroz cocido', '200 g de verduras mixtas', '10 ml de aceite de oliva', 'Limón, ajo y especias'], steps: ['Sazona y cocina el pollo hasta alcanzar cocción completa.', 'Saltea las verduras con la mitad del aceite.', 'Sirve sobre el arroz y termina con limón.'] },
  { id: 'salmon-potato-salad', name: 'Salmón con papa y ensalada fresca', mealTypes: ['lunch', 'dinner'], patterns: ['omnivore', 'pescatarian', 'other'], tags: ['salmón', 'pescado', 'papa', 'ensalada'], baseCalories: 640, prepMinutes: 30, difficulty: 'intermediate', ingredients: ['170 g de salmón', '280 g de papa', 'Ensalada de hojas, jitomate y pepino', '8 ml de aceite de oliva', 'Limón, pimienta y hierbas'], steps: ['Hornea o cocina el salmón hasta que esté bien cocido.', 'Cuece la papa y sazona con hierbas.', 'Mezcla la ensalada y sirve todo con limón.'] },
  { id: 'turkey-pasta', name: 'Pasta integral con pavo y tomate', mealTypes: ['lunch', 'dinner'], patterns: ['omnivore', 'other'], tags: ['pasta', 'pavo', 'italiana', 'tomate'], baseCalories: 680, prepMinutes: 28, difficulty: 'intermediate', ingredients: ['90 g de pasta integral seca', '170 g de pavo molido magro', '180 g de salsa de tomate natural', '150 g de calabacita y champiñón', '10 g de queso parmesano'], steps: ['Cuece la pasta al dente.', 'Cocina el pavo por completo y agrega verduras.', 'Incorpora tomate, mezcla con la pasta y termina con queso.'] },
  { id: 'tofu-quinoa-bowl', name: 'Bowl de tofu, quinoa y verduras', mealTypes: ['lunch', 'dinner'], patterns: ['vegan', 'vegetarian'], tags: ['tofu', 'quinoa', 'verduras', 'vegano'], baseCalories: 620, prepMinutes: 25, difficulty: 'basic', ingredients: ['200 g de tofu firme', '180 g de quinoa cocida', '220 g de verduras mixtas', '12 ml de aceite de oliva', 'Limón, paprika y salsa de soya baja en sodio'], steps: ['Dora el tofu con paprika.', 'Saltea las verduras manteniendo textura.', 'Sirve con quinoa y aderezo de limón.'] },
  { id: 'lentil-tacos', name: 'Tacos de lenteja con aguacate', mealTypes: ['lunch', 'dinner'], patterns: ['vegan', 'vegetarian'], tags: ['lentejas', 'tacos', 'mexicana', 'vegano'], baseCalories: 590, prepMinutes: 22, difficulty: 'basic', ingredients: ['220 g de lentejas cocidas', '4 tortillas de maíz', '60 g de aguacate', 'Col morada y pico de gallo', 'Limón, comino y paprika'], steps: ['Calienta las lentejas con comino y paprika.', 'Calienta las tortillas sin aceite.', 'Arma los tacos con col, pico de gallo y aguacate.'] },
  { id: 'greek-yogurt-fruit', name: 'Yogurt griego con fruta y semillas', mealTypes: ['snack', 'breakfast'], patterns: ['omnivore', 'vegetarian', 'pescatarian', 'other'], tags: ['yogurt', 'fruta', 'rápido'], baseCalories: 300, prepMinutes: 4, difficulty: 'basic', ingredients: ['220 g de yogurt griego natural', '1 porción de fruta', '15 g de semillas', '10 g de miel opcional'], steps: ['Sirve el yogurt en un tazón.', 'Agrega fruta y semillas.', 'Añade miel solo si forma parte de tu objetivo.'] },
  { id: 'hummus-toast', name: 'Tostadas de hummus y vegetales', mealTypes: ['snack', 'breakfast'], patterns: ['vegan', 'vegetarian', 'omnivore', 'pescatarian', 'other'], tags: ['hummus', 'pan', 'vegano', 'rápido'], baseCalories: 320, prepMinutes: 7, difficulty: 'basic', ingredients: ['2 rebanadas de pan integral', '80 g de hummus', 'Jitomate y pepino', 'Limón y paprika'], steps: ['Tuesta el pan.', 'Unta el hummus.', 'Agrega vegetales, limón y paprika.'] },
  { id: 'tuna-tostadas', name: 'Tostadas de atún con aguacate', mealTypes: ['lunch', 'dinner', 'snack'], patterns: ['omnivore', 'pescatarian', 'other'], tags: ['atún', 'tostadas', 'mexicana', 'rápido'], baseCalories: 500, prepMinutes: 12, difficulty: 'basic', ingredients: ['150 g de atún en agua drenado', '4 tostadas horneadas', '50 g de aguacate', 'Jitomate, cebolla y cilantro', 'Limón'], steps: ['Mezcla el atún con los vegetales y limón.', 'Distribuye sobre las tostadas.', 'Termina con aguacate.'] },
  { id: 'chickpea-curry', name: 'Curry suave de garbanzo con arroz', mealTypes: ['lunch', 'dinner'], patterns: ['vegan', 'vegetarian'], tags: ['garbanzo', 'arroz', 'india', 'vegano'], baseCalories: 640, prepMinutes: 30, difficulty: 'intermediate', ingredients: ['220 g de garbanzo cocido', '170 g de arroz cocido', '160 g de tomate triturado', '80 ml de leche de coco ligera', 'Espinaca, curry y ajo'], steps: ['Sofríe ajo y especias brevemente.', 'Agrega tomate, garbanzo y leche de coco; cocina 12 minutos.', 'Incorpora espinaca y sirve con arroz.'] },
];

const RECIPE_MACROS: Record<string, { proteinG: number; carbohydratesG: number; fatG: number }> = {
  'oats-berries-yogurt': { proteinG: 30, carbohydratesG: 55, fatG: 10 },
  'tofu-oats-berries': { proteinG: 22, carbohydratesG: 58, fatG: 12 },
  'eggs-beans-tortilla': { proteinG: 38, carbohydratesG: 55, fatG: 15 },
  'chicken-rice-bowl': { proteinG: 55, carbohydratesG: 75, fatG: 14 },
  'salmon-potato-salad': { proteinG: 42, carbohydratesG: 65, fatG: 23 },
  'turkey-pasta': { proteinG: 52, carbohydratesG: 80, fatG: 17 },
  'tofu-quinoa-bowl': { proteinG: 33, carbohydratesG: 70, fatG: 23 },
  'lentil-tacos': { proteinG: 27, carbohydratesG: 87, fatG: 15 },
  'greek-yogurt-fruit': { proteinG: 25, carbohydratesG: 35, fatG: 7 },
  'hummus-toast': { proteinG: 12, carbohydratesG: 45, fatG: 10 },
  'tuna-tostadas': { proteinG: 40, carbohydratesG: 50, fatG: 15 },
  'chickpea-curry': { proteinG: 23, carbohydratesG: 95, fatG: 18 },
};

const RECIPE_COST_TIER: Record<string, 1 | 2 | 3> = {
  'oats-berries-yogurt': 2, 'tofu-oats-berries': 2, 'eggs-beans-tortilla': 1,
  'chicken-rice-bowl': 2, 'salmon-potato-salad': 3, 'turkey-pasta': 2,
  'tofu-quinoa-bowl': 2, 'lentil-tacos': 1, 'greek-yogurt-fruit': 2,
  'hummus-toast': 1, 'tuna-tostadas': 2, 'chickpea-curry': 1,
};

const MEAL_DISTRIBUTIONS: Record<number, number[]> = {
  2: [0.45, 0.55], 3: [0.3, 0.4, 0.3], 4: [0.25, 0.35, 0.15, 0.25],
  5: [0.22, 0.28, 0.12, 0.25, 0.13], 6: [0.2, 0.22, 0.1, 0.22, 0.1, 0.16],
};

function mealTypesForCount(count: number): MealType[] {
  if (count === 2) return ['breakfast', 'dinner'];
  if (count === 3) return ['breakfast', 'lunch', 'dinner'];
  if (count === 4) return ['breakfast', 'lunch', 'snack', 'dinner'];
  if (count === 5) return ['breakfast', 'lunch', 'snack', 'dinner', 'snack'];
  return ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'snack'];
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  return Math.abs(result);
}

function scaleIngredient(value: string, factor: number): string {
  return value.replace(/^(\d+(?:\.\d+)?)\s*(g|ml)\b/, (_match, amount: string, unit: string) => `${Math.max(1, Math.round(Number(amount) * factor / 5) * 5)} ${unit}`);
}

function optionFromTemplate(template: RecipeTemplate, target: DailyNutritionSummary, profile: UserProfile): MealPlanOption {
  const factor = Math.max(0.65, Math.min(1.55, target.calories / template.baseCalories));
  const macros = RECIPE_MACROS[template.id];
  const maxDifficulty = profile.cookingLevel === 'basic' ? 'basic' : template.difficulty;
  return {
    id: template.id, name: template.name, mealType: template.mealTypes[0],
    calories: Math.round(template.baseCalories * factor), proteinG: Math.round(macros.proteinG * factor), carbohydratesG: Math.round(macros.carbohydratesG * factor), fatG: Math.round(macros.fatG * factor),
    ingredients: template.ingredients.map((item) => scaleIngredient(item, factor)), steps: template.steps,
    prepMinutes: Math.min(profile.availableCookingMinutes ?? 30, Math.max(4, Math.round(template.prepMinutes * factor))), difficulty: maxDifficulty, imageUrl: null,
  };
}

export function generateDailyMealPlan(profile: UserProfile, target: NutritionTarget | null, now = new Date(), imageUrls: Record<string, string> = {}): DailyMealPlan {
  const dateKey = localDateKey(now);
  if (!target || target.status !== 'calculated' || target.calories === null || target.proteinG === null || target.carbohydratesG === null || target.fatG === null) {
    return { id: `meal-plan-${dateKey}`, dateKey, status: 'needs_professional_review', target: null, meals: [], note: 'Se requiere completar o revisar profesionalmente el perfil antes de crear un plan alimenticio personalizado.' };
  }
  const count = Math.max(2, Math.min(6, profile.mealsPerDay));
  const distributions = MEAL_DISTRIBUTIONS[count];
  const mealTypes = mealTypesForCount(count);
  const dislikes = [...(profile.dislikedFoods ?? []), ...(profile.allergies ?? [])].map((item) => item.toLocaleLowerCase('es-MX'));
  const likes = [...(profile.favoriteFoods ?? []), ...(profile.preferredCuisines ?? [])].map((item) => item.toLocaleLowerCase('es-MX'));
  const meals = mealTypes.map((mealType, index): DailyMealPlanSlot => {
    const ratio = distributions[index];
    const slotTarget = {
      calories: Math.round(target.calories! * ratio), proteinG: Math.round(target.proteinG! * ratio),
      carbohydratesG: Math.round(target.carbohydratesG! * ratio), fatG: Math.round(target.fatG! * ratio),
    };
    const candidates = RECIPE_TEMPLATES.filter((recipe) => recipe.mealTypes.includes(mealType) && recipe.patterns.includes(profile.dietaryPattern) && recipe.prepMinutes <= Math.max(10, (profile.availableCookingMinutes ?? 30) + 10) && !recipe.tags.some((tag) => dislikes.some((item) => item && tag.includes(item))));
    const ranked = (candidates.length >= 2 ? candidates : RECIPE_TEMPLATES.filter((recipe) => recipe.mealTypes.includes(mealType) && recipe.patterns.includes(profile.dietaryPattern))).sort((a, b) => {
      const score = (recipe: RecipeTemplate) => {
        const macros = RECIPE_MACROS[recipe.id];
        const proteinFit = Math.abs((macros.proteinG * 4) / recipe.baseCalories - (slotTarget.proteinG * 4) / slotTarget.calories);
        const fatFit = Math.abs((macros.fatG * 9) / recipe.baseCalories - (slotTarget.fatG * 9) / slotTarget.calories);
        const budgetPressure = profile.foodBudget === 'economy' || profile.weeklyFoodBudgetMxn < 1100 ? 90 : profile.weeklyFoodBudgetMxn < 1600 ? 35 : 0;
        return recipe.tags.filter((tag) => likes.some((item) => item && tag.includes(item))).length * 100
          - (proteinFit + fatFit) * 120
          - Math.abs(recipe.prepMinutes - (profile.availableCookingMinutes ?? 30))
          - (RECIPE_COST_TIER[recipe.id] - 1) * budgetPressure;
      };
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
    const firstIndex = hash(`${dateKey}-${profile.preferredName}-${mealType}-${index}`) % Math.max(1, ranked.length);
    const first = ranked[firstIndex] ?? RECIPE_TEMPLATES[0];
    const second = ranked[(firstIndex + 1) % Math.max(1, ranked.length)] ?? RECIPE_TEMPLATES[1];
    const options = [first, second].map((recipe) => ({ ...optionFromTemplate(recipe, slotTarget, profile), mealType, imageUrl: imageUrls[recipe.id] ?? null })) as [MealPlanOption, MealPlanOption];
    const labels: Record<MealType, string> = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: index < 3 ? 'Colación' : 'Colación tarde' };
    return { id: `${dateKey}-${mealType}-${index}`, label: labels[mealType], mealType, target: slotTarget, options, selectedOptionIndex: 0 };
  });
  const summed = meals.reduce<DailyNutritionSummary>((total, meal) => ({ calories: total.calories + meal.target.calories, proteinG: total.proteinG + meal.target.proteinG, carbohydratesG: total.carbohydratesG + meal.target.carbohydratesG, fatG: total.fatG + meal.target.fatG }), { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 });
  const last = meals.at(-1);
  if (last) {
    const corrections = { calories: target.calories - summed.calories, proteinG: target.proteinG - summed.proteinG, carbohydratesG: target.carbohydratesG - summed.carbohydratesG, fatG: target.fatG - summed.fatG };
    last.target = { calories: last.target.calories + corrections.calories, proteinG: last.target.proteinG + corrections.proteinG, carbohydratesG: last.target.carbohydratesG + corrections.carbohydratesG, fatG: last.target.fatG + corrections.fatG };
  }
  return { id: `meal-plan-${dateKey}`, dateKey, status: 'ready', target: { calories: target.calories, proteinG: target.proteinG, carbohydratesG: target.carbohydratesG, fatG: target.fatG }, meals, note: 'Las cantidades son un punto de partida calculado. Ajusta por hambre, tolerancia y progreso; verifica etiquetas y alérgenos.' };
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function summarizeNutritionDay(entries: MealEntry[], dateKey = localDateKey()): DailyNutritionSummary {
  return entries
    .filter((entry) => localDateKey(new Date(entry.occurredAt)) === dateKey)
    .reduce<DailyNutritionSummary>((summary, entry) => ({
      calories: summary.calories + entry.calories,
      proteinG: summary.proteinG + entry.proteinG,
      carbohydratesG: summary.carbohydratesG + entry.carbohydratesG,
      fatG: summary.fatG + entry.fatG,
    }), { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 });
}

export function startOfLocalWeek(now = new Date()): Date {
  const start = new Date(now);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dayFromMonday);
  return start;
}

export function summarizeNutritionWeek(entries: MealEntry[], now = new Date()): DailyNutritionSummary {
  const start = startOfLocalWeek(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return entries.filter((entry) => {
    const occurredAt = new Date(entry.occurredAt);
    return occurredAt >= start && occurredAt < end;
  }).reduce<DailyNutritionSummary>((summary, entry) => ({
    calories: summary.calories + entry.calories,
    proteinG: summary.proteinG + entry.proteinG,
    carbohydratesG: summary.carbohydratesG + entry.carbohydratesG,
    fatG: summary.fatG + entry.fatG,
  }), { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 });
}

export function buildWeeklyNutritionBalance(entries: MealEntry[], target: NutritionTarget | null, now = new Date()): WeeklyNutritionBalance | null {
  if (!target || target.status !== 'calculated' || target.calories === null || target.proteinG === null || target.carbohydratesG === null || target.fatG === null) return null;
  const consumed = summarizeNutritionWeek(entries, now);
  const weeklyTarget = { calories: target.calories * 7, proteinG: target.proteinG * 7, carbohydratesG: target.carbohydratesG * 7, fatG: target.fatG * 7 };
  const balance = {
    calories: weeklyTarget.calories - consumed.calories,
    proteinG: weeklyTarget.proteinG - consumed.proteinG,
    carbohydratesG: weeklyTarget.carbohydratesG - consumed.carbohydratesG,
    fatG: weeklyTarget.fatG - consumed.fatG,
  };
  const daysElapsed = Math.min(7, Math.max(1, ((now.getDay() + 6) % 7) + 1));
  const daysRemaining = Math.max(1, 8 - daysElapsed);
  return {
    consumed,
    target: weeklyTarget,
    balance,
    daysElapsed,
    daysRemaining,
    suggestedDailyRemainder: {
      calories: Math.round(balance.calories / daysRemaining),
      proteinG: Math.round(balance.proteinG / daysRemaining),
      carbohydratesG: Math.round(balance.carbohydratesG / daysRemaining),
      fatG: Math.round(balance.fatG / daysRemaining),
    },
  };
}

export function buildWeeklyWorkoutBalance(profile: UserProfile, sessions: WorkoutSession[], now = new Date()): WeeklyWorkoutBalance {
  const weekly = sessionsThisWeek(sessions, now);
  const targetSessions = Math.max(1, profile.weeklyTrainingDays);
  const targetMinutes = targetSessions * Math.max(20, profile.trainingMinutes);
  const targetCalories = Math.round(targetMinutes * Math.max(4, profile.weightKg * 0.075));
  const minutes = weekly.reduce((sum, session) => sum + session.durationMinutes, 0);
  const caloriesBurned = weekly.reduce((sum, session) => sum + (session.caloriesBurned ?? Math.round(session.durationMinutes * Math.max(4, profile.weightKg * 0.075))), 0);
  return { sessions: weekly.length, targetSessions, minutes, targetMinutes, caloriesBurned, targetCalories, remainingMinutes: Math.max(0, targetMinutes - minutes), remainingCalories: Math.max(0, targetCalories - caloriesBurned) };
}

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function generateWeeklyMealPlan(profile: UserProfile, target: NutritionTarget | null, now = new Date(), imageUrls: Record<string, string> = {}): WeeklyMealPlan {
  const start = startOfLocalWeek(now);
  const days = WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const rotationDays = Math.max(1, Math.min(7, profile.mealPrepRotationDays ?? 3));
    const sourceDate = new Date(start);
    if (profile.mealPreparationPreference === 'meal_prep') {
      sourceDate.setDate(start.getDate() + (profile.mealPrepStructure === 'same_by_meal' ? 0 : Math.floor(index / rotationDays) * rotationDays));
    } else sourceDate.setDate(start.getDate() + index);
    const sourcePlan = generateDailyMealPlan(profile, target, sourceDate, imageUrls);
    const dateKey = localDateKey(date);
    const plan = profile.mealPreparationPreference === 'meal_prep' ? {
      ...sourcePlan,
      id: `meal-plan-${dateKey}`,
      dateKey,
      meals: sourcePlan.meals.map((slot, slotIndex) => ({ ...slot, id: `${dateKey}-${slot.mealType}-${slotIndex}` })),
      note: profile.mealPrepStructure === 'same_by_meal'
        ? 'Meal prep: cada tipo de comida se repite durante la semana para cocinar por lotes.'
        : `Meal prep: el menú completo rota cada ${rotationDays} días para reducir tiempo de cocina.`,
    } : sourcePlan;
    return { dateKey, label, plan };
  });
  return { id: `weekly-meal-plan-${localDateKey(start)}`, weekStart: localDateKey(start), days };
}

export function weeklyMealPlanForDate(plans: WeeklyMealPlan[], now = new Date()): WeeklyMealPlan | null {
  const weekStart = localDateKey(startOfLocalWeek(now));
  return plans.find((plan) => plan.weekStart === weekStart) ?? null;
}

export function dailyMealPlanFromWeek(plan: WeeklyMealPlan | null, date = new Date()): DailyMealPlan | null {
  if (!plan) return null;
  return plan.days.find((day) => day.dateKey === localDateKey(date))?.plan ?? null;
}

export function selectWeeklyMealPlanOption(plan: WeeklyMealPlan, slotId: string, optionIndex: 0 | 1): WeeklyMealPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      plan: {
        ...day.plan,
        meals: day.plan.meals.map((slot) => slot.id === slotId ? { ...slot, selectedOptionIndex: optionIndex } : slot),
      },
    })),
  };
}

export function replaceWeeklyMealPlanOption(plan: WeeklyMealPlan, slotId: string, replacement: MealPlanOption): WeeklyMealPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      plan: {
        ...day.plan,
        meals: day.plan.meals.map((slot) => {
          if (slot.id !== slotId) return slot;
          const optionIndex = slot.selectedOptionIndex ?? 0;
          const options = [...slot.options] as [MealPlanOption, MealPlanOption];
          options[optionIndex] = { ...replacement, mealType: slot.mealType };
          return { ...slot, options };
        }),
      },
    })),
  };
}

export function replaceWeeklyMealPlanIngredient(plan: WeeklyMealPlan, ingredientToReplace: string, replacementIngredient: string, slotId?: string): WeeklyMealPlan {
  const needle = ingredientToReplace.trim().toLocaleLowerCase('es-MX');
  if (!needle || !replacementIngredient.trim()) return plan;
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      plan: {
        ...day.plan,
        meals: day.plan.meals.map((slot) => {
          if (slotId && slot.id !== slotId) return slot;
          const optionIndex = slot.selectedOptionIndex ?? 0;
          const selected = slot.options[optionIndex];
          const ingredients = selected.ingredients.map((ingredient) => ingredient.toLocaleLowerCase('es-MX').includes(needle) ? replacementIngredient.trim() : ingredient);
          if (ingredients.every((ingredient, index) => ingredient === selected.ingredients[index])) return slot;
          const options = [...slot.options] as [MealPlanOption, MealPlanOption];
          options[optionIndex] = { ...selected, ingredients };
          return { ...slot, options };
        }),
      },
    })),
  };
}

function normalizeIngredientName(value: string): string {
  return value.trim().replace(/^(de|del)\s+/i, '').replace(/\s+/g, ' ');
}

export function buildWeeklyGroceryList(plan: WeeklyMealPlan, choices: Record<string, 0 | 1> = {}): { items: GroceryItem[] } {
  const aggregated = new Map<string, { name: string; quantity: number; unit: GroceryItem['unit'] }>();
  const add = (nameValue: string, quantity: number, unit: GroceryItem['unit']) => {
    const name = normalizeIngredientName(nameValue);
    const key = `${name.toLocaleLowerCase('es-MX')}|${unit}`;
    const current = aggregated.get(key);
    aggregated.set(key, { name, unit, quantity: (current?.quantity ?? 0) + quantity });
  };
  for (const day of plan.days) for (const slot of day.plan.meals) {
    const option = slot.options[choices[slot.id] ?? slot.selectedOptionIndex ?? 0];
    for (const ingredient of option.ingredients) {
      const match = ingredient.match(/^(\d+(?:\.\d+)?)\s*(g|ml)\s+(?:de\s+)?(.+)$/i);
      if (match) { add(match[3], Number(match[1]), match[2].toLowerCase() as 'g' | 'ml'); continue; }
      const composite = ingredient.match(/^(\d+(?:\.\d+)?)\s+(.+?)\s+y\s+(\d+(?:\.\d+)?)\s*(g|ml)\s+(?:de\s+)?(.+)$/i);
      if (composite) { add(composite[2], Number(composite[1]), 'pieza'); add(composite[5], Number(composite[3]), composite[4].toLowerCase() as 'g' | 'ml'); continue; }
      const pieces = ingredient.match(/^(\d+(?:\.\d+)?)\s+(?:porci[oó]n(?:es)?\s+de\s+|rebanadas?\s+de\s+)?(.+)$/i);
      if (pieces) { add(pieces[2], Number(pieces[1]), 'pieza'); continue; }
      add(ingredient, 1, 'pieza');
    }
  }
  const items = [...aggregated.entries()].map(([id, item]) => ({ ...item, id, quantity: Math.round(item.quantity * 10) / 10 })).sort((a, b) => a.name.localeCompare(b.name, 'es-MX'));
  return { items };
}

export function sessionsThisWeek(sessions: WorkoutSession[], now = new Date()): WorkoutSession[] {
  const start = startOfLocalWeek(now);
  return sessions.filter((session) => new Date(session.completedAt) >= start);
}

export function getProgressivePrescription(exercise: WorkoutExercise, sessions: WorkoutSession[]): ProgressivePrescription {
  const minimum = exercise.progressionMinReps ?? exercise.targetReps ?? 4;
  const maximum = Math.max(minimum, exercise.progressionMaxReps ?? minimum + 2);
  const previous = sessions
    .flatMap((session) => session.exerciseResults ?? [])
    .find((result) => result.exerciseSlug === exercise.slug && result.sets?.length);
  if (!previous?.sets?.length) return {
    targetRepsPerSet: exercise.targetReps ?? minimum,
    suggestedLoadKg: null,
    previousLoadKg: null,
    previousRepsPerSet: [],
    progressionNote: `Primera referencia: elige un peso con el que puedas completar ${minimum} repeticiones con técnica sólida y 1–2 repeticiones en reserva.`,
  };
  const previousLoadKg = previous.sets.find((set) => set.loadKg !== null)?.loadKg ?? null;
  const previousTarget = Math.max(minimum, Math.min(maximum, previous.targetReps ?? minimum));
  const completedRange = previous.sets.map((set) => set.completedReps);
  const completedTarget = completedRange.every((reps) => reps >= previousTarget);
  if (!completedTarget) return {
    targetRepsPerSet: previousTarget,
    suggestedLoadKg: previousLoadKg,
    previousLoadKg,
    previousRepsPerSet: completedRange,
    progressionNote: `Repite ${previousTarget} repeticiones con ${previousLoadKg ?? 'el mismo peso'} hasta completar todas las series con buena técnica.`,
  };
  if (previousTarget < maximum) return {
    targetRepsPerSet: previousTarget + 1,
    suggestedLoadKg: previousLoadKg,
    previousLoadKg,
    previousRepsPerSet: completedRange,
    progressionNote: `La sesión anterior completaste ${previousTarget} por serie. Mantén ${previousLoadKg ?? 'el peso'} e intenta ${previousTarget + 1} repeticiones por serie.`,
  };
  const lowerBody = ['squat', 'romanian-deadlift', 'reverse-lunge', 'leg-press', 'goblet-squat', 'backpack-romanian-deadlift', 'home-reverse-lunge', 'split-squat', 'glute-bridge'].includes(exercise.slug);
  const increment = lowerBody ? 5 : 2.5;
  const nextLoad = previousLoadKg === null ? null : Math.round((previousLoadKg + increment) * 2) / 2;
  return {
    targetRepsPerSet: minimum,
    suggestedLoadKg: nextLoad,
    previousLoadKg,
    previousRepsPerSet: completedRange,
    progressionNote: nextLoad === null ? `Completaste el rango de ${maximum}. Sube el peso ligeramente y vuelve a ${minimum} repeticiones.` : `Completaste ${maximum} por serie con ${previousLoadKg} kg. Prueba ${nextLoad} kg y vuelve a ${minimum} repeticiones por serie.`,
  };
}

export function buildWorkoutFeedback(profile: UserProfile, previousSessions: WorkoutSession[], results: WorkoutExerciseResult[], durationMinutes: number): string {
  const averageDifficulty = results.length ? results.reduce((sum, result) => sum + result.difficulty, 0) / results.length : 3;
  const recent = previousSessions.slice(0, 4);
  const previousDuration = recent.length ? recent.reduce((sum, session) => sum + session.durationMinutes, 0) / recent.length : null;
  const consistency = recent.length >= 3 ? 'Tu constancia reciente ya permite comparar tendencias.' : 'Estás construyendo una línea base para personalizar mejor tus próximas sesiones.';
  const difficulty = averageDifficulty >= 4.2
    ? 'La sesión se sintió exigente; conserva la técnica y considera reducir volumen o carga la próxima vez.'
    : averageDifficulty <= 2
      ? 'La sesión se sintió accesible; si la técnica fue sólida, el siguiente ajuste puede ser una pequeña progresión.'
      : 'La dificultad quedó en un rango productivo para seguir progresando con control.';
  const pace = previousDuration && durationMinutes < previousDuration * 0.8
    ? 'Terminaste bastante más rápido que tu promedio: confirma que no sacrificaste descansos ni rango de movimiento.'
    : 'El tiempo queda registrado para comparar tu ritmo sin convertirlo en una carrera.';
  const strengthSets = results.flatMap((result) => result.sets ?? []);
  const incompleteSets = strengthSets.filter((set) => set.completedReps < set.targetReps).length;
  const loadMessage = strengthSets.length
    ? incompleteSets
      ? `Registraste ${incompleteSets} ${incompleteSets === 1 ? 'serie por debajo' : 'series por debajo'} del objetivo; es información válida y la próxima sesión conservará la progresión hasta consolidarlas.`
      : 'Completaste las series de fuerza previstas; VITAMATE usará las cargas guardadas para proponer el siguiente paso de la doble progresión.'
    : '';
  return `${profile.preferredName}, completaste ${results.length} ejercicios en ${durationMinutes} minutos. ${difficulty} ${loadMessage} ${pace} ${consistency}`.replace(/\s+/g, ' ').trim();
}

export function percentage(value: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}
