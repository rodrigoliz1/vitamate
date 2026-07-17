import assert from 'node:assert/strict';
import test from 'node:test';
import { tryDeterministicCoachReply } from '../src/services/coachDeterministic.js';

const now = '2026-07-16T07:00:00.000Z';

test('registra una sesión de tenis terminada sin depender del modelo', async () => {
  const reply = await tryDeterministicCoachReply(
    'Jugué una sesión de tennis de 2 horas, regístralo',
    now,
    'America/Mexico_City',
    'es-MX',
  );

  assert.equal(reply?.model, 'none');
  assert.equal(reply?.task, 'workout_log');
  assert.deepEqual(reply?.action, {
    type: 'log_workout',
    workout: {
      title: 'Tenis',
      activityType: 'sport',
      occurredAt: now,
      durationMinutes: 120,
      caloriesBurned: 840,
      perceivedEffort: 7,
    },
  });
});

test('convierte el sueño reportado en una acción persistible', async () => {
  const reply = await tryDeterministicCoachReply(
    'Dormí 7 horas y descansé bien, regístralo',
    now,
    'America/Mexico_City',
    'es-MX',
  );

  assert.equal(reply?.model, 'none');
  assert.equal(reply?.task, 'sleep_log');
  assert.deepEqual(reply?.action, {
    type: 'log_sleep',
    sleep: {
      startedAt: '2026-07-16T00:00:00.000Z',
      endedAt: now,
      durationMinutes: 420,
      quality: 4,
    },
  });
});

test('registra un desayuno compuesto desde una descripción natural sin usar IA', async () => {
  const reply = await tryDeterministicCoachReply(
    'Desayuné 2 huevos, 100 gramos de machaca, 2 tortillas de maíz y frijoles',
    now,
    'America/Mexico_City',
    'es-MX',
  );

  assert.equal(reply?.model, 'none');
  assert.equal(reply?.task, 'meal_log');
  assert.equal(reply?.action?.type, 'log_meal');
  if (reply?.action?.type !== 'log_meal') assert.fail('La descripción debe producir una acción de comida.');
  assert.equal(reply.action.meal.mealType, 'breakfast');
  assert.ok(reply.action.meal.calories >= 600);
  assert.ok(reply.action.meal.proteinG >= 50);
  assert.match(reply.action.meal.name, /machaca/i);
});

test('tolera errores ortográficos y cantidades mixtas en una comida compuesta', async () => {
  const reply = await tryDeterministicCoachReply(
    'Desayune 2 huevos, 100 gramos de carne, 1 tortilla de mais, 1 tortilla de harina, un poco de salsa macha y una guarnicion de frijoles',
    now,
    'America/Mexico_City',
    'es-MX',
  );

  assert.equal(reply?.model, 'none');
  assert.equal(reply?.action?.type, 'log_meal');
  if (reply?.action?.type !== 'log_meal') assert.fail('La descripción debe producir una acción de comida.');
  assert.ok(reply.action.meal.calories >= 750);
  assert.ok(reply.action.meal.carbohydratesG > 0);
  assert.ok(reply.action.meal.fatG > 0);
});
