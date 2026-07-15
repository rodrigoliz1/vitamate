import 'dotenv/config';

const recipes = [
  ['oats-berries-yogurt', 'Avena cremosa con frutos rojos', ['avena', 'yogurt griego natural', 'frutos rojos', 'nuez', 'canela']],
  ['tofu-oats-berries', 'Avena proteica vegetal con frutos rojos', ['avena', 'bebida de soya', 'frutos rojos', 'crema de cacahuate', 'canela']],
  ['eggs-beans-tortilla', 'Huevos con frijoles y tortilla', ['huevos', 'frijoles de la olla', 'tortillas de maíz', 'pico de gallo', 'aguacate']],
  ['chicken-rice-bowl', 'Bowl de pollo, arroz y verduras', ['pechuga de pollo', 'arroz', 'calabacita', 'pimiento', 'brócoli']],
  ['salmon-potato-salad', 'Salmón con papa y ensalada fresca', ['salmón', 'papa', 'lechuga', 'jitomate', 'pepino']],
  ['turkey-pasta', 'Pasta integral con pavo y tomate', ['pasta integral', 'pavo molido', 'tomate', 'calabacita', 'queso parmesano']],
  ['tofu-quinoa-bowl', 'Bowl de tofu, quinoa y verduras', ['tofu dorado', 'quinoa', 'brócoli', 'zanahoria', 'pimiento']],
  ['lentil-tacos', 'Tacos de lenteja con aguacate', ['lentejas', 'tortillas de maíz', 'aguacate', 'col morada', 'pico de gallo']],
  ['greek-yogurt-fruit', 'Yogurt griego con fruta y semillas', ['yogurt griego natural', 'fresas', 'arándanos', 'semillas', 'miel']],
  ['hummus-toast', 'Tostadas de hummus y vegetales', ['pan integral', 'hummus', 'jitomate', 'pepino', 'paprika']],
  ['tuna-tostadas', 'Tostadas de atún con aguacate', ['atún', 'tostadas horneadas', 'aguacate', 'jitomate', 'cilantro']],
  ['chickpea-curry', 'Curry suave de garbanzo con arroz', ['garbanzo', 'arroz', 'tomate', 'espinaca', 'curry']],
];

if (!process.env.ADMIN_BOOTSTRAP_TOKEN) throw new Error('ADMIN_BOOTSTRAP_TOKEN no está configurado.');
const endpoint = process.env.VITAMATE_API_URL ?? "http://192.168.0.9:3001";

async function generate([recipeKey, name, ingredients]) {
  const response = await fetch(`${endpoint}/v1/admin/nutrition/generate-meal-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ADMIN_BOOTSTRAP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeKey, name, ingredients }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${recipeKey}: ${result.message ?? response.status}`);
  console.log(`${recipeKey}: ${result.generated ? 'generada' : 'ya existente'}`);
}

for (let index = 0; index < recipes.length; index += 3) {
  const results = await Promise.allSettled(recipes.slice(index, index + 3).map(generate));
  for (const result of results) if (result.status === 'rejected') console.error(result.reason instanceof Error ? result.reason.message : result.reason);
}
