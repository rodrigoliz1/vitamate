import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { FalMealMediaProvider } from '../providers/falMealMedia.js';
import { requireSupabase, supabaseAdmin } from '../services/supabase.js';
import { requireUser } from '../services/auth.js';
import { requirePremium } from '../repositories/billingRepository.js';

const fal = new FalMealMediaProvider();

function authorize(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!config.ADMIN_BOOTSTRAP_TOKEN || token !== config.ADMIN_BOOTSTRAP_TOKEN) throw Object.assign(new Error('No autorizado.'), { statusCode: 401 });
}

export async function nutritionRoutes(app: FastifyInstance) {
  app.get('/v1/nutrition/meal-images', async (request) => {
    const { userId } = await requireUser(request);
    await requirePremium(userId);
    if (!supabaseAdmin) return { images: {} };
    const { data, error } = await requireSupabase().from('meal_media').select('recipe_key,public_url').eq('status', 'ready');
    if (error) throw error;
    return { images: Object.fromEntries((data ?? []).filter((row) => row.public_url).map((row) => [row.recipe_key, row.public_url])) };
  });

  app.post('/v1/admin/nutrition/generate-meal-image', async (request) => {
    authorize(request);
    const body = z.object({ recipeKey: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(2).max(160), ingredients: z.array(z.string().min(1).max(160)).min(1).max(20), promptVersion: z.string().default('food-editorial-v1') }).parse(request.body);
    const db = requireSupabase();
    const { data: existing } = await db.from('meal_media').select('*').eq('recipe_key', body.recipeKey).eq('prompt_version', body.promptVersion).maybeSingle();
    if (existing) return { media: existing, generated: false };
    const generated = await fal.generate({ name: body.name, ingredients: body.ingredients });
    const response = await fetch(generated.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('No fue posible descargar la imagen generada.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const storagePath = `${body.recipeKey}/${body.promptVersion}.png`;
    const { error: uploadError } = await db.storage.from('meal-images').upload(storagePath, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) throw uploadError;
    const publicUrl = db.storage.from('meal-images').getPublicUrl(storagePath).data.publicUrl;
    const { data: media, error } = await db.from('meal_media').insert({ recipe_key: body.recipeKey, recipe_name: body.name, prompt_version: body.promptVersion, storage_path: storagePath, public_url: publicUrl, provider: 'fal.ai', provider_request_id: generated.requestId, prompt: generated.prompt, status: 'ready' }).select('*').single();
    if (error) throw error;
    return { media, generated: true };
  });
}
