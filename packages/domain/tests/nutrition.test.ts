import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyGroceryList, buildWeeklyNutritionBalance, calculateNutritionTarget, dailyMealPlanFromWeek, generateDailyMealPlan, generateStarterWorkoutPlan, generateWeeklyMealPlan, getProgressivePrescription, nutritionForGrams, replaceWeeklyMealPlanIngredient, replaceWeeklyMealPlanOption, selectWeeklyMealPlanOption, servingMassInGrams, weeklyMealPlanForDate, type MealEntry, type UserProfile, type WorkoutSession } from '../src/index.ts';

const profile: UserProfile = {
  preferredName: 'Prueba', dateOfBirth: '1995-05-10', biologicalSexForCalculation: 'female', heightCm: 165, weightKg: 65,
  primaryGoal: 'recomposition', activityLevel: 'moderate', weeklyTrainingDays: 4, trainingMinutes: 50, equipment: 'gimnasio',
  dietaryPattern: 'omnivore', mealsPerDay: 4, cookingLevel: 'basic', favoriteFoods: ['pollo', 'avena'], dislikedFoods: ['atún'],
  allergies: [], preferredCuisines: ['mexicana'], availableCookingMinutes: 20, foodBudget: 'balanced', coachStyle: 'direct', safetyFlags: [],
  weeklyFoodBudgetMxn: 1400, mealPreparationPreference: 'cook_fresh', mealPrepStructure: 'same_by_meal', mealPrepRotationDays: 3,
  supplements: [], trainingPreference: 'gym', preferredSport: '',
  consents: { terms: true, privacy: true, ai: true }, locale: 'es-MX', timezone: 'America/Mexico_City', units: 'metric', completedAt: '2026-07-13T00:00:00.000Z',
};

test('distribuye exactamente los objetivos entre el número de comidas elegido', () => {
  const target = calculateNutritionTarget(profile, new Date('2026-07-13T12:00:00-06:00'));
  const plan = generateDailyMealPlan(profile, target, new Date('2026-07-13T12:00:00-06:00'));
  assert.equal(plan.status, 'ready');
  assert.equal(plan.meals.length, 4);
  const total = plan.meals.reduce((sum, meal) => ({ calories: sum.calories + meal.target.calories, proteinG: sum.proteinG + meal.target.proteinG, carbohydratesG: sum.carbohydratesG + meal.target.carbohydratesG, fatG: sum.fatG + meal.target.fatG }), { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 });
  assert.deepEqual(total, plan.target);
});

test('respeta el tiempo de cocina y entrega dos opciones por comida', () => {
  const target = calculateNutritionTarget(profile, new Date('2026-07-13T12:00:00-06:00'));
  const plan = generateDailyMealPlan(profile, target, new Date('2026-07-13T12:00:00-06:00'));
  for (const meal of plan.meals) {
    assert.equal(meal.options.length, 2);
    assert.ok(meal.options.every((option) => option.prepMinutes <= profile.availableCookingMinutes));
    assert.ok(meal.options.every((option) => !option.name.toLocaleLowerCase('es-MX').includes('atún')));
  }
});

test('detiene la personalización cuando el perfil requiere revisión profesional', () => {
  const flagged: UserProfile = { ...profile, safetyFlags: ['eating_disorder'] };
  const plan = generateDailyMealPlan(flagged, calculateNutritionTarget(flagged), new Date('2026-07-13T12:00:00-06:00'));
  assert.equal(plan.status, 'needs_professional_review');
  assert.equal(plan.meals.length, 0);
});

test('crea siete días y consolida la lista sin inventar precios', () => {
  const target = calculateNutritionTarget(profile, new Date('2026-07-13T12:00:00-06:00'));
  const plan = generateWeeklyMealPlan(profile, target, new Date('2026-07-15T12:00:00-06:00'));
  const grocery = buildWeeklyGroceryList(plan);
  assert.equal(plan.days.length, 7);
  assert.equal(plan.days[0]?.label, 'Lunes');
  assert.ok(grocery.items.length > 5);
  assert.ok(grocery.items.every((item) => !('estimatedCostMxn' in item)));
});

test('nutrición y lista semanal leen exactamente el mismo plan persistido', () => {
  const date = new Date('2026-07-15T12:00:00-06:00');
  const target = calculateNutritionTarget(profile, date);
  const weekly = generateWeeklyMealPlan(profile, target, date);
  const selectedWeek = weeklyMealPlanForDate([weekly], date);
  const daily = dailyMealPlanFromWeek(selectedWeek, date);
  assert.equal(selectedWeek, weekly);
  assert.equal(daily, weekly.days[2].plan);
  assert.deepEqual(daily?.meals, weekly.days[2].plan.meals);
});

test('elecciones y cambios de VITACOACH permanecen ligados a la lista del súper', () => {
  const date = new Date('2026-07-15T12:00:00-06:00');
  const target = calculateNutritionTarget(profile, date);
  const weekly = generateWeeklyMealPlan(profile, target, date);
  const slot = weekly.days[2].plan.meals[0];
  const selected = selectWeeklyMealPlanOption(weekly, slot.id, 1);
  assert.equal(selected.days[2].plan.meals[0].selectedOptionIndex, 1);

  const replacement = { ...slot.options[1], id: 'vitacoach-replacement', name: 'Desayuno sustituido por VITACOACH', ingredients: ['200 g de ingrediente verificable'] };
  const changedMeal = replaceWeeklyMealPlanOption(selected, slot.id, replacement);
  assert.equal(changedMeal.days[2].plan.meals[0].options[1].name, replacement.name);
  assert.ok(buildWeeklyGroceryList(changedMeal).items.some((item) => item.name.toLocaleLowerCase('es-MX').includes('ingrediente verificable')));

  const changedIngredient = replaceWeeklyMealPlanIngredient(changedMeal, 'ingrediente verificable', '180 g de sustituto estable', slot.id);
  assert.ok(changedIngredient.days[2].plan.meals[0].options[1].ingredients.includes('180 g de sustituto estable'));
  assert.ok(buildWeeklyGroceryList(changedIngredient).items.some((item) => item.name.toLocaleLowerCase('es-MX').includes('sustituto estable')));
});

test('convierte porciones de masa y recalcula nutrientes por gramos', () => {
  assert.equal(servingMassInGrams('1.5 oz', null), 42.5);
  assert.equal(servingMassInGrams('0.25 kg', null), 250);
  assert.equal(servingMassInGrams('240 ml', 240), null);
  assert.deepEqual(nutritionForGrams({ caloriesPer100g: 200, proteinPer100g: 10, carbohydratesPer100g: 25, fatPer100g: 5 }, 75), {
    calories: 150, proteinG: 7.5, carbohydratesG: 18.8, fatG: 3.8,
  });
});

test('arrastra el consumo dentro del balance de lunes a domingo', () => {
  const target = calculateNutritionTarget(profile, new Date('2026-07-13T12:00:00-06:00'));
  const entry: MealEntry = { id: 'meal', occurredAt: '2026-07-14T08:00:00-06:00', mealType: 'breakfast', name: 'Prueba', calories: 500, proteinG: 30, carbohydratesG: 50, fatG: 18, source: 'manual', confirmed: true, createdAt: '2026-07-14T08:00:00-06:00' };
  const balance = buildWeeklyNutritionBalance([entry], target, new Date('2026-07-15T12:00:00-06:00'));
  assert.equal(balance?.consumed.calories, 500);
  assert.equal(balance?.balance.calories, target.calories! * 7 - 500);
});

test('meal prep repite cada tipo de comida para cocinar por lotes', () => {
  const mealPrepProfile: UserProfile = { ...profile, mealPreparationPreference: 'meal_prep', mealPrepStructure: 'same_by_meal' };
  const target = calculateNutritionTarget(mealPrepProfile, new Date('2026-07-13T12:00:00-06:00'));
  const plan = generateWeeklyMealPlan(mealPrepProfile, target, new Date('2026-07-15T12:00:00-06:00'));
  const mondayNames = plan.days[0].plan.meals.map((slot) => slot.options[0].name);
  assert.ok(plan.days.every((day) => day.plan.meals.map((slot) => slot.options[0].name).join('|') === mondayNames.join('|')));
});

test('sobrecarga progresiva aumenta repeticiones y después carga', () => {
  const exercise = generateStarterWorkoutPlan(profile).days[1].exercises[0];
  const first = getProgressivePrescription(exercise, []);
  assert.equal(first.targetRepsPerSet, 4);
  const session = (targetReps: number, loadKg: number): WorkoutSession => ({
    id: `s-${targetReps}`, workoutDayId: 'full-body-a', workoutTitle: 'Fuerza total A', completedAt: new Date().toISOString(), durationMinutes: 35, perceivedEffort: 7,
    exerciseResults: [{ exerciseId: exercise.id, exerciseSlug: exercise.slug, exerciseName: exercise.name, targetReps, completedReps: targetReps * 3, targetSeconds: null, completedSeconds: 0, difficulty: 3, sets: [1, 2, 3].map((setNumber) => ({ setNumber, targetReps, completedReps: targetReps, loadKg })) }],
  });
  assert.equal(getProgressivePrescription(exercise, [session(4, 100)]).targetRepsPerSet, 5);
  const afterSix = getProgressivePrescription(exercise, [session(6, 100)]);
  assert.equal(afterSix.targetRepsPerSet, 4);
  assert.equal(afterSix.suggestedLoadKg, 105);
});

test('genera alternativas reales de gimnasio y casa para la misma semana', () => {
  const gym = generateStarterWorkoutPlan(profile, new Date('2026-07-13T12:00:00-06:00'), 'gym');
  const home = generateStarterWorkoutPlan(profile, new Date('2026-07-13T12:00:00-06:00'), 'home');
  assert.equal(gym.days.length, profile.weeklyTrainingDays);
  assert.equal(home.days.length, profile.weeklyTrainingDays);
  assert.ok(gym.days.every((day) => day.id.startsWith('gym-')));
  assert.ok(home.days.every((day) => day.id.startsWith('home-')));
  assert.notDeepEqual(gym.days[0].exercises.map((item) => item.slug), home.days[0].exercises.map((item) => item.slug));
  assert.equal(home.days[0].exercises[0].progressionMinReps, 6);
  assert.equal(home.days[0].exercises[0].progressionMaxReps, 10);
});
