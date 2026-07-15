import { config } from '../config.js';
import type { PhotoFoodAnalysis } from '../types.js';

const analysisSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      name: { type: 'string' }, estimatedPortionG: { type: 'number' }, calories: { type: 'number' }, proteinG: { type: 'number' }, carbohydratesG: { type: 'number' }, fatG: { type: 'number' }, confidence: { type: 'number' },
    }, required: ['name', 'estimatedPortionG', 'calories', 'proteinG', 'carbohydratesG', 'fatG', 'confidence'] } },
    totals: { type: 'object', additionalProperties: false, properties: { calories: { type: 'number' }, proteinG: { type: 'number' }, carbohydratesG: { type: 'number' }, fatG: { type: 'number' } }, required: ['calories', 'proteinG', 'carbohydratesG', 'fatG'] },
    overallConfidence: { type: 'number' }, notes: { type: 'array', items: { type: 'string' } }, requiresConfirmation: { type: 'boolean', const: true },
  }, required: ['items', 'totals', 'overallConfidence', 'notes', 'requiresConfirmation'],
};

export class OpenAiFoodVisionProvider {
  async analyze(imageDataUrl: string, locale: 'es-MX' | 'en-US'): Promise<PhotoFoodAnalysis> {
    if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no está configurada.');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) throw new Error('Formato de imagen no permitido.');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.OPENAI_VISION_MODEL,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Analyze this meal photo for a nutrition diary. Identify visible foods, estimate edible portions and macros conservatively. Reply in ${locale}. Flag uncertainty in notes. Never imply medical certainty.` },
          { type: 'input_image', image_url: imageDataUrl },
        ] }],
        text: { format: { type: 'json_schema', name: 'food_photo_analysis', strict: true, schema: analysisSchema } },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`OpenAI respondió ${response.status}`);
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = data.output?.flatMap((output) => output.content ?? []).find((content) => content.type === 'output_text')?.text;
    if (!text) throw new Error('La IA no devolvió un análisis utilizable.');
    const parsed = JSON.parse(text) as PhotoFoodAnalysis;
    parsed.requiresConfirmation = true;
    return parsed;
  }
}
