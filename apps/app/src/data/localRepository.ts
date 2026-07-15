import { generateStarterWorkoutPlan, generateWeeklyMealPlan, weeklyMealPlanForDate, type
  CoachChatMessage,
  CoachMemory,
  HealthDocumentSummary,
  MealEntry,
  NutritionTarget,
  PersonalFood,
  UserProfile,
  WeightEntry,
  WorkoutPlan,
  WorkoutSession,
  WeeklyMealPlan,
} from '@vitamate/domain';

export interface VitamateSnapshot {
  schemaVersion: 5;
  profile: UserProfile | null;
  nutritionTarget: NutritionTarget | null;
  meals: MealEntry[];
  personalFoods: PersonalFood[];
  workoutPlan: WorkoutPlan | null;
  workoutSessions: WorkoutSession[];
  weightEntries: WeightEntry[];
  coachMessages: CoachChatMessage[];
  coachMemories: CoachMemory[];
  healthDocuments: HealthDocumentSummary[];
  mealPlans: WeeklyMealPlan[];
  planSelectionCompleted: boolean;
  cloudUpdatedAt?: string;
}

const STORAGE_KEY = 'vitamate.snapshot.v5';
const LEGACY_STORAGE_KEYS = ['vitamate.snapshot.v4', 'vitamate.snapshot.v3', 'vitamate.snapshot.v2'];
const EMPTY: VitamateSnapshot = {
  schemaVersion: 5,
  profile: null,
  nutritionTarget: null,
  meals: [],
  personalFoods: [],
  workoutPlan: null,
  workoutSessions: [],
  weightEntries: [],
  coachMessages: [],
  coachMemories: [],
  healthDocuments: [],
  mealPlans: [],
  planSelectionCompleted: false,
};

function normalizeMealPlans(plans: WeeklyMealPlan[] | undefined): WeeklyMealPlan[] {
  return (plans ?? []).map((plan) => ({
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      plan: {
        ...day.plan,
        meals: day.plan.meals.map((slot) => ({ ...slot, selectedOptionIndex: slot.selectedOptionIndex ?? 0 })),
      },
    })),
  }));
}

export function normalizeVitamateSnapshot(value: Omit<Partial<VitamateSnapshot>, 'schemaVersion'> & { schemaVersion?: number }): VitamateSnapshot {
  const profile = value.profile ? {
    ...value.profile,
    locale: value.profile.locale ?? 'es-MX' as const,
    favoriteFoods: value.profile.favoriteFoods ?? [],
    dislikedFoods: value.profile.dislikedFoods ?? [],
    allergies: value.profile.allergies ?? [],
    preferredCuisines: value.profile.preferredCuisines ?? ['Mexicana'],
    availableCookingMinutes: value.profile.availableCookingMinutes ?? 30,
    foodBudget: value.profile.foodBudget ?? 'balanced' as const,
    weeklyFoodBudgetMxn: value.profile.weeklyFoodBudgetMxn ?? 1400,
    mealPreparationPreference: value.profile.mealPreparationPreference ?? 'cook_fresh' as const,
    mealPrepStructure: value.profile.mealPrepStructure ?? 'same_by_meal' as const,
    mealPrepRotationDays: value.profile.mealPrepRotationDays ?? 3,
    supplements: value.profile.supplements ?? [],
    trainingPreference: value.profile.trainingPreference ?? 'gym' as const,
    preferredSport: value.profile.preferredSport ?? '',
  } : null;
  const legacyPlan = !value.workoutPlan || value.workoutPlan.version !== 'progressive-1.2.0' || value.workoutPlan.days.some((day) => day.exercises.some((exercise) => !exercise.slug || !Array.isArray(exercise.instructions)));
  let mealPlans = normalizeMealPlans(value.mealPlans);
  if (profile && value.nutritionTarget && !weeklyMealPlanForDate(mealPlans)) {
    mealPlans = [...mealPlans, generateWeeklyMealPlan(profile, value.nutritionTarget)];
  }
  return {
    ...EMPTY,
    ...value,
    schemaVersion: 5,
    profile,
    meals: value.meals ?? [],
    personalFoods: value.personalFoods ?? [],
    workoutPlan: profile && legacyPlan ? generateStarterWorkoutPlan(profile) : value.workoutPlan ?? null,
    workoutSessions: value.workoutSessions ?? [],
    weightEntries: value.weightEntries ?? [],
    coachMessages: value.coachMessages ?? [],
    coachMemories: value.coachMemories ?? [],
    healthDocuments: value.healthDocuments ?? [],
    mealPlans: mealPlans.slice(-8),
    planSelectionCompleted: value.planSelectionCompleted ?? (Boolean(value.profile) && (value.schemaVersion ?? 0) < 5),
  };
}

export const browserLocalRepository = {
  empty(): VitamateSnapshot {
    return { ...EMPTY, meals: [], personalFoods: [], workoutSessions: [], weightEntries: [], coachMessages: [], coachMemories: [], healthDocuments: [], mealPlans: [] };
  },
  load(): VitamateSnapshot {
    if (typeof window === 'undefined') return EMPTY;
    try {
      const value = window.localStorage.getItem(STORAGE_KEY) ?? LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
      if (!value) return EMPTY;
      return normalizeVitamateSnapshot(JSON.parse(value) as Omit<Partial<VitamateSnapshot>, 'schemaVersion'> & { schemaVersion?: number });
    } catch {
      return EMPTY;
    }
  },
  save(snapshot: VitamateSnapshot): void {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  },
};
