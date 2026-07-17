import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCoachTask } from '../src/providers/coachContext.js';

test('clasifica una descripción consumida como registro de comida', () => {
  assert.equal(classifyCoachTask('Mi desayuno fue 2 huevos, machaca, tortillas y frijoles'), 'meal_log');
});

test('resuelve “regístralo” contra la última comida descrita por el usuario', () => {
  assert.equal(classifyCoachTask('¡Regístralo!', {}, [
    { role: 'user', content: 'Mi desayuno fue 2 huevos, 100 g de machaca, tortillas y frijoles' },
    { role: 'assistant', content: 'Puedo estimarlo en aproximadamente 700 kcal.' },
  ]), 'meal_log');
});
