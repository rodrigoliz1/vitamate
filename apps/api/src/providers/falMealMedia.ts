import { fal } from '@fal-ai/client';
import { config } from '../config.js';

export class FalMealMediaProvider {
  constructor() {
    if (config.FAL_KEY) fal.config({ credentials: config.FAL_KEY });
  }

  async generate(input: { name: string; ingredients: string[] }) {
    if (!config.FAL_KEY) throw new Error('FAL_KEY no está configurada.');
    const prompt = [
      `Premium editorial food photograph of ${input.name}.`,
      `Visible ingredients: ${input.ingredients.join(', ')}.`,
      'Single realistic serving on a matte ceramic plate, appetizing but credible portion, natural daylight, warm off-white stone table, subtle dark forest green napkin, top-front 45 degree camera angle.',
      'No people, no hands, no text, no typography, no logo, no watermark, no packaging, no duplicate plates, no unrealistic garnish.',
    ].join(' ');
    const result = await fal.subscribe(config.FAL_MEAL_IMAGE_MODEL, { input: { prompt, image_size: 'square_hd', num_images: 1, output_format: 'png' } });
    const data = result.data as { images?: Array<{ url?: string }> };
    const url = data.images?.[0]?.url;
    if (!url) throw new Error('fal.ai no devolvió una imagen de comida.');
    return { url, prompt, requestId: result.requestId };
  }
}
