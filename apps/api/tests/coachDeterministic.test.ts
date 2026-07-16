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
