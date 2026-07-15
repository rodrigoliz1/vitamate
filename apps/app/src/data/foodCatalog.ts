import type { FoodCatalogItem } from '@vitamate/domain';

function item(name: string, calories: number, protein: number, carbs: number, fat: number): FoodCatalogItem {
  return { name, caloriesPer100g: calories, proteinPer100g: protein, carbohydratesPer100g: carbs, fatPer100g: fat, brand: null, barcode: null, servingSize: '100 g', servingQuantity: 100, defaultPortionGrams: 100, imageUrl: null, source: 'vitamate', qualityStatus: 'complete' };
}

export const localFoodCatalog: FoodCatalogItem[] = [
  item('Pechuga de pollo cocida', 165, 31, 0, 3.6), item('Huevo entero', 143, 12.6, 0.7, 9.5),
  item('Claras de huevo', 52, 10.9, 0.7, 0.2), item('Atún en agua', 116, 25.5, 0, 0.8),
  item('Salmón cocido', 206, 22, 0, 12), item('Carne de res magra', 217, 26, 0, 12),
  item('Frijoles de olla', 127, 8.7, 22.8, 0.5), item('Lentejas cocidas', 116, 9, 20, 0.4),
  item('Arroz blanco cocido', 130, 2.7, 28, 0.3), item('Tortilla de maíz', 218, 5.7, 44.6, 2.9),
  item('Avena cocida', 71, 2.5, 12, 1.5), item('Pan integral', 247, 13, 41, 4.2),
  item('Papa cocida', 87, 1.9, 20.1, 0.1), item('Camote cocido', 90, 2, 20.7, 0.2),
  item('Aguacate', 160, 2, 8.5, 14.7), item('Plátano', 89, 1.1, 22.8, 0.3),
  item('Manzana', 52, 0.3, 13.8, 0.2), item('Yogur griego natural', 73, 9.9, 3.9, 1.9),
  item('Queso panela', 200, 20, 3, 12), item('Almendras', 579, 21.2, 21.6, 49.9),
  item('Brócoli cocido', 35, 2.4, 7.2, 0.4), item('Jitomate', 18, 0.9, 3.9, 0.2),
];
