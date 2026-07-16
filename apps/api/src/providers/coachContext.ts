import type { CoachAttachment, CoachContext, CoachLongTermMemory } from './openaiCoach.js';

export type CoachTask = 'general' | 'nutrition' | 'meal_log' | 'training' | 'workout_log' | 'progress' | 'health' | 'plan_change';

const normalize = (value: string) => value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function classifyCoachTask(message: string, attachment: CoachAttachment = {}): CoachTask {
  const text = normalize(message);
  if (attachment.document || /laboratorio|analisis|estudio|documento|pdf|glucosa|colesterol|sangre|lesion|dolor|mareo|cansad|dormi|sueno|estres|enferm/.test(text)) return 'health';
  if (/cambia|reemplaza|sustituye|intercambia/.test(text) && /plan|menu|comida|ingrediente|desayuno|cena|colacion/.test(text)) return 'plan_change';
  if (/(registra|agrega|anade).*(entren|actividad|correr|camin|pesas|gym|ejercicio)|(?:hice|entrene|corri|camine|termine).*(minut|hora|km|rutina|ejercicio)/.test(text)) return 'workout_log';
  if (/^(?:registrame|registra|agregame|agrega|anade)\b/.test(text) || /\b(?:ya\s+)?(?:me\s+)?(?:comi|desayune|almorce|cene|tome|bebi)\b/.test(text)) return 'meal_log';
  if (/calori|proteina|carbohidr|grasa|macro|comida|alimento|receta|desayuno|cena|colacion|hambre|dieta|nutric|foto de alimento/.test(text)) return 'nutrition';
  if (/entren|ejercicio|rutina|serie|repeticion|sentadilla|press|correr|caminar|gym|fuerza|cardio|movilidad/.test(text)) return 'training';
  if (/progreso|avance|peso|meta|semana|adherencia|balance|como voy|planea mi dia|plan my day/.test(text)) return 'progress';
  return 'general';
}

export function compactCoachContext(context: CoachContext, task: CoachTask): Record<string, unknown> {
  const base: Record<string, unknown> = {
    locale: context.locale,
    currentDateTime: context.currentDateTime,
    timezone: context.timezone,
    user: {
      preferredName: context.profile.preferredName,
      primaryGoal: context.profile.primaryGoal,
      coachStyle: context.profile.coachStyle,
      safetyFlags: context.profile.safetyFlags,
    },
  };
  const nutritionProfile = {
    dietaryPattern: context.profile.dietaryPattern,
    allergies: context.profile.allergies,
    dislikedFoods: context.profile.dislikedFoods,
    favoriteFoods: context.profile.favoriteFoods,
    preferredCuisines: context.profile.preferredCuisines,
    mealsPerDay: context.profile.mealsPerDay,
    cookingLevel: context.profile.cookingLevel,
    availableBudgetMxnWeek: context.profile.weeklyFoodBudgetMxn,
    preparation: context.profile.mealPreparationPreference,
    supplements: context.profile.supplements,
  };
  const trainingProfile = {
    activityLevel: context.profile.activityLevel,
    weeklyTrainingDays: context.profile.weeklyTrainingDays,
    trainingMinutes: context.profile.trainingMinutes,
    equipment: context.profile.equipment,
    trainingPreference: context.profile.trainingPreference,
    preferredSport: context.profile.preferredSport,
  };

  if (task === 'nutrition' || task === 'meal_log' || task === 'plan_change' || task === 'progress' || task === 'health') {
    base.nutrition = {
      profile: nutritionProfile,
      target: context.nutritionTarget,
      today: context.todayNutrition,
      ...(task === 'progress' ? { week: context.weeklyNutrition, weightTrend: context.weightTrend } : {}),
    };
  }
  if (task === 'training' || task === 'workout_log' || task === 'progress' || task === 'health') {
    base.training = {
      profile: trainingProfile,
      recent: context.recentWorkouts.slice(0, 3),
      ...(task === 'training' ? { available: context.availableWorkouts.slice(0, 4) } : {}),
      week: context.weeklyWorkout,
    };
  }
  if (task === 'health') {
    base.health = {
      healthSummary: context.healthSummary,
      documents: context.healthDocuments.slice(0, 3).map((document) => ({ ...document, summary: document.summary.slice(0, 1200) })),
    };
  }
  if (task === 'plan_change' && context.mealPlanContext) {
    base.currentMealPlan = compactMealPlan(context.mealPlanContext, context.planChangeTarget);
    base.planChangeTarget = context.planChangeTarget;
  }
  return base;
}

export function compactRealtimeCoachContext(context: CoachContext): Record<string, unknown> {
  return {
    locale: context.locale,
    currentDateTime: context.currentDateTime,
    timezone: context.timezone,
    user: {
      preferredName: context.profile.preferredName,
      primaryGoal: context.profile.primaryGoal,
      coachStyle: context.profile.coachStyle,
      safetyFlags: context.profile.safetyFlags,
    },
    nutrition: {
      target: context.nutritionTarget,
      today: context.todayNutrition,
    },
    training: {
      week: context.weeklyWorkout,
      recent: context.recentWorkouts.slice(0, 2),
    },
    weightTrend: context.weightTrend,
    healthSummary: context.healthSummary,
    ...(context.mealPlanContext ? { currentMealPlan: compactMealPlan(context.mealPlanContext) } : {}),
  };
}

export function selectRelevantMemories(message: string, task: CoachTask, memories: CoachLongTermMemory[]): CoachLongTermMemory[] {
  const words = new Set(normalize(message).split(/[^a-z0-9]+/).filter((word) => word.length >= 4));
  const categoriesByTask: Record<CoachTask, Set<CoachLongTermMemory['category']>> = {
    general: new Set(['identity', 'relationship', 'motivation']),
    nutrition: new Set(['preference', 'goal', 'constraint', 'health_context']),
    meal_log: new Set(['preference', 'goal', 'constraint', 'health_context']),
    training: new Set(['goal', 'routine', 'constraint', 'health_context']),
    workout_log: new Set(['goal', 'routine', 'constraint', 'health_context']),
    progress: new Set(['goal', 'routine', 'motivation', 'constraint']),
    health: new Set(['health_context', 'constraint', 'routine']),
    plan_change: new Set(['preference', 'goal', 'constraint', 'health_context']),
  };
  return memories
    .map((memory) => {
      const overlap = normalize(memory.content).split(/[^a-z0-9]+/).filter((word) => words.has(word)).length;
      const categoryScore = categoriesByTask[task].has(memory.category) ? 4 : 0;
      const safetyScore = ['constraint', 'health_context'].includes(memory.category) ? 2 : 0;
      return { memory, score: memory.importance * 2 + categoryScore + safetyScore + overlap * 3 };
    })
    .filter(({ memory, score }) => score >= 8 || memory.importance >= 5)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map(({ memory }) => memory);
}

function compactMealPlan(value: string, target?: CoachContext['planChangeTarget']): unknown {
  try {
    const plan = JSON.parse(value) as {
      weekStart?: string;
      days?: Array<{ dateKey?: string; label?: string; plan?: { meals?: Array<{
        id?: string; label?: string; mealType?: string; selectedOptionIndex?: number;
        target?: unknown; options?: Array<Record<string, unknown>>;
      }> } }>;
    };
    const days = (plan.days ?? []).map((day) => ({
      dateKey: day.dateKey,
      label: day.label,
      meals: (day.plan?.meals ?? [])
        .filter((slot) => !target?.slotId || slot.id === target.slotId)
        .map((slot) => {
          const selected = slot.options?.[slot.selectedOptionIndex ?? 0] ?? {};
          return {
            slotId: slot.id,
            label: slot.label,
            mealType: slot.mealType,
            target: slot.target,
            selected: {
              id: selected.id, name: selected.name, calories: selected.calories,
              proteinG: selected.proteinG, carbohydratesG: selected.carbohydratesG, fatG: selected.fatG,
              ingredients: selected.ingredients, prepMinutes: selected.prepMinutes, difficulty: selected.difficulty,
            },
          };
        }),
    })).filter((day) => day.meals.length);
    return { weekStart: plan.weekStart, days };
  } catch {
    return { unavailable: true };
  }
}
