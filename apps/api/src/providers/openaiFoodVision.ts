import { config } from '../config.js';
import type { PhotoFoodAnalysis } from '../types.js';
import { parseOpenAiUsage, type OpenAiTokenUsage } from '../services/openaiUsage.js';

const analysisSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    items: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, properties: {
      name: { type: 'string', minLength: 1, maxLength: 160 },
      brand: { type: ['string', 'null'], maxLength: 120 },
      barcode: { type: ['string', 'null'], pattern: '^\\d{8,14}$' },
      estimatedPortionG: { type: 'number', minimum: 1, maximum: 5000 },
      calories: { type: 'number', minimum: 0, maximum: 10000 },
      proteinG: { type: 'number', minimum: 0, maximum: 1000 },
      carbohydratesG: { type: 'number', minimum: 0, maximum: 1000 },
      fatG: { type: 'number', minimum: 0, maximum: 1000 },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    }, required: ['name', 'brand', 'barcode', 'estimatedPortionG', 'calories', 'proteinG', 'carbohydratesG', 'fatG', 'confidence'] } },
    totals: { type: 'object', additionalProperties: false, properties: {
      calories: { type: 'number', minimum: 0, maximum: 30000 },
      proteinG: { type: 'number', minimum: 0, maximum: 3000 },
      carbohydratesG: { type: 'number', minimum: 0, maximum: 3000 },
      fatG: { type: 'number', minimum: 0, maximum: 3000 },
    }, required: ['calories', 'proteinG', 'carbohydratesG', 'fatG'] },
    overallConfidence: { type: 'number', minimum: 0, maximum: 1 },
    notes: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 240 } },
    requiresConfirmation: { type: 'boolean', const: true },
  }, required: ['items', 'totals', 'overallConfidence', 'notes', 'requiresConfirmation'],
};

export class OpenAiFoodVisionProvider {
  async analyze(imageDataUrl: string, locale: 'es-MX' | 'en-US', safetyIdentifier?: string): Promise<{ analysis: PhotoFoodAnalysis; usage: OpenAiTokenUsage; model: string }> {
    if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no está configurada.');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) throw new Error('Formato de imagen no permitido.');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json', ...(safetyIdentifier ? { 'OpenAI-Safety-Identifier': safetyIdentifier } : {}) },
      body: JSON.stringify({
        model: config.OPENAI_VISION_MODEL,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Analyze this food or packaged-product photo for a nutrition diary. Identify visible foods, estimate edible portions and macros conservatively. Return a visible brand when clear and a barcode only when every digit is legible; otherwise use null and never guess. Reply in ${locale}. Flag uncertainty in notes. Never imply medical certainty.` },
          { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
        ] }],
        max_output_tokens: 650,
        store: false,
        text: { format: { type: 'json_schema', name: 'food_photo_analysis', strict: true, schema: analysisSchema } },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`OpenAI respondió ${response.status}`);
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; usage?: unknown };
    const text = data.output?.flatMap((output) => output.content ?? []).find((content) => content.type === 'output_text')?.text;
    if (!text) throw new Error('La IA no devolvió un análisis utilizable.');
    const parsed = JSON.parse(text) as PhotoFoodAnalysis;
    parsed.requiresConfirmation = true;
    return { analysis: parsed, usage: parseOpenAiUsage(data.usage), model: config.OPENAI_VISION_MODEL };
  }
}
