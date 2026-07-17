import type { NormalizedFood } from '../types.js';

const food = (id: string, name: string, calories: number, protein: number, carbs: number, fat: number): NormalizedFood => ({
  id, name, brand: null, barcode: null, source: 'vitamate', externalId: id, servingSize: '100 g', servingQuantity: 100, servingUnit: 'g', servingWeightGrams: 100,
  caloriesPer100g: calories, proteinPer100g: protein, carbohydratesPer100g: carbs, fatPer100g: fat,
  fiberPer100g: null, sugarsPer100g: null, sodiumPer100g: null, imageUrl: null, ingredients: null, allergens: [],
  qualityStatus: 'complete', externalUpdatedAt: null,
});

export const curatedFoods: NormalizedFood[] = [
  food('egg', 'Huevo entero cocido', 155, 12.6, 1.1, 10.6),
  food('chicken-breast', 'Pechuga de pollo cocida', 165, 31, 0, 3.6),
  food('rice', 'Arroz blanco cocido', 130, 2.7, 28.2, 0.3),
  food('beans', 'Frijoles de la olla', 127, 8.7, 22.8, 0.5),
  food('corn-tortilla', 'Tortilla de maíz', 218, 5.7, 44.6, 2.9),
  food('flour-tortilla', 'Tortilla de harina', 312, 8.3, 52.1, 8.3),
  food('machaca', 'Machaca de res cocida', 220, 34, 1, 9),
  food('beef', 'Carne de res cocida', 250, 26, 0, 17),
  food('salsa-macha', 'Salsa macha', 600, 8, 12, 56),
  food('oats', 'Avena cocida', 71, 2.5, 12, 1.5),
  food('greek-yogurt', 'Yogurt griego natural', 73, 9.9, 3.9, 2),
  food('banana', 'Plátano', 89, 1.1, 22.8, 0.3),
  food('apple', 'Manzana con cáscara', 52, 0.3, 13.8, 0.2),
  food('avocado', 'Aguacate', 160, 2, 8.5, 14.7),
  food('salmon', 'Salmón cocido', 206, 22.1, 0, 12.4),
  food('tuna', 'Atún en agua escurrido', 116, 25.5, 0, 0.8),
];
