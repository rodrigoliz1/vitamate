import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { FalExerciseMediaProvider } from '../providers/falExerciseMedia.js';
import { requireSupabase, supabaseAdmin } from '../services/supabase.js';
import { requireUser } from '../services/auth.js';
import { requirePremium } from '../repositories/billingRepository.js';

const fal = new FalExerciseMediaProvider();
function authorize(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!config.ADMIN_BOOTSTRAP_TOKEN || token !== config.ADMIN_BOOTSTRAP_TOKEN) throw Object.assign(new Error('No autorizado.'), { statusCode: 401 });
}

export async function exerciseMediaRoutes(app: FastifyInstance) {
  app.get('/v1/exercises/guides', async (request) => {
    const { userId } = await requireUser(request);
    await requirePremium(userId);
    if (!supabaseAdmin) return { guides: {} };
    const db = requireSupabase();
    const { data, error } = await db.from('exercise_media').select('public_url, prompt_version, reviewed_at, exercises!inner(slug)').eq('review_status', 'approved');
    if (error) throw error;
    const ranked = [...(data ?? [])].sort((left, right) => {
      const leftPhoto = left.prompt_version.startsWith('photo-') ? 1 : 0;
      const rightPhoto = right.prompt_version.startsWith('photo-') ? 1 : 0;
      if (leftPhoto !== rightPhoto) return rightPhoto - leftPhoto;
      return Date.parse(right.reviewed_at ?? '') - Date.parse(left.reviewed_at ?? '');
    });
    const guides: Record<string, string> = {};
    for (const row of ranked) {
      const exercise = row.exercises as unknown as { slug: string };
      if (!guides[exercise.slug]) guides[exercise.slug] = row.public_url;
    }
    return { guides };
  });

  app.post('/v1/admin/exercises/:slug/generate-guide', async (request, reply) => {
    authorize(request);
    const { slug } = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(request.params);
    const { promptVersion, viewKey } = z.object({ promptVersion: z.string().default('anatomy-v1'), viewKey: z.string().default('start-end') }).parse(request.body ?? {});
    const db = requireSupabase();
    const { data: exercise, error: exerciseError } = await db.from('exercises').select('*').eq('slug', slug).single();
    if (exerciseError || !exercise) return reply.code(404).send({ message: 'Ejercicio no encontrado.' });
    const { data: existing } = await db.from('exercise_media').select('*').eq('exercise_id', exercise.id).eq('prompt_version', promptVersion).eq('view_key', viewKey).maybeSingle();
    if (existing) return { media: existing, generated: false };

    const { data: job, error: jobError } = await db.from('exercise_media_generation_jobs').insert({ exercise_id: exercise.id, prompt_version: promptVersion, view_key: viewKey, status: 'generating' }).select('*').single();
    if (jobError) {
      const { data: current } = await db.from('exercise_media_generation_jobs').select('*').eq('exercise_id', exercise.id).eq('prompt_version', promptVersion).eq('view_key', viewKey).single();
      return reply.code(409).send({ message: 'La guía ya fue solicitada.', job: current });
    }
    try {
      const generated = await fal.generate({ slug, name: exercise.name_es, instructions: exercise.instructions_es as string[], safetyNotes: exercise.safety_notes_es as string[] });
      const response = await fetch(generated.url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error('No fue posible descargar la imagen generada.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
      const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const storagePath = `${slug}/${promptVersion}-${viewKey}.${extension}`;
      const { error: uploadError } = await db.storage.from('exercise-guides').upload(storagePath, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      const publicUrl = db.storage.from('exercise-guides').getPublicUrl(storagePath).data.publicUrl;
      const { data: media, error: mediaError } = await db.from('exercise_media').insert({ exercise_id: exercise.id, prompt_version: promptVersion, view_key: viewKey, storage_path: storagePath, public_url: publicUrl, provider: 'fal.ai', provider_request_id: generated.requestId, prompt: generated.prompt, review_status: 'pending_review' }).select('*').single();
      if (mediaError) throw mediaError;
      await db.from('exercise_media_generation_jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', job.id);
      return { media, generated: true, warning: 'Pendiente de revisión humana; aún no es visible para usuarios.' };
    } catch (error) {
      await db.from('exercise_media_generation_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Error desconocido', updated_at: new Date().toISOString() }).eq('id', job.id);
      throw error;
    }
  });

  app.post('/v1/admin/exercise-media/:id/review', async (request) => {
    authorize(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(['approved', 'rejected']), notes: z.string().max(1000).optional() }).parse(request.body);
    const { data, error } = await requireSupabase().from('exercise_media').update({ review_status: body.status, reviewer_notes: body.notes ?? null, reviewed_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    return { media: data };
  });
}
