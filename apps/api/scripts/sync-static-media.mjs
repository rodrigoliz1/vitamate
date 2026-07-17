import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const run = promisify(execFile);
const outputRoot = fileURLToPath(new URL('../../app/public/media/', import.meta.url));
const cwebp = process.env.CWEBP_BIN ?? '/opt/homebrew/bin/cwebp';
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const temporary = await mkdtemp(join(tmpdir(), 'vitamate-static-media-'));

async function downloadWebp(sourceUrl, destination) {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`No se pudo descargar ${sourceUrl}: ${response.status}`);
  const source = join(temporary, `${crypto.randomUUID()}.source`);
  await writeFile(source, new Uint8Array(await response.arrayBuffer()));
  await mkdir(dirname(destination), { recursive: true });
  await run(cwebp, [source, '-resize', '720', '0', '-q', '72', '-m', '6', '-metadata', 'none', '-o', destination]);
  const bytes = (await readFile(destination)).byteLength;
  process.stdout.write(`${destination.replace(`${outputRoot}/`, '')}: ${Math.round(bytes / 1024)} KB\n`);
}

try {
  const [{ data: meals, error: mealError }, { data: exerciseRows, error: exerciseError }] = await Promise.all([
    db.from('meal_media').select('recipe_key,public_url').eq('status', 'ready'),
    db.from('exercise_media').select('public_url,prompt_version,reviewed_at,exercises!inner(slug)').eq('review_status', 'approved'),
  ]);
  if (mealError) throw mealError;
  if (exerciseError) throw exerciseError;

  const ranked = [...(exerciseRows ?? [])].sort((left, right) => {
    const leftPhoto = left.prompt_version.startsWith('photo-') ? 1 : 0;
    const rightPhoto = right.prompt_version.startsWith('photo-') ? 1 : 0;
    if (leftPhoto !== rightPhoto) return rightPhoto - leftPhoto;
    return Date.parse(right.reviewed_at ?? '') - Date.parse(left.reviewed_at ?? '');
  });
  const exercises = new Map();
  for (const row of ranked) {
    const slug = row.exercises.slug;
    if (!exercises.has(slug) && row.public_url) exercises.set(slug, row.public_url);
  }

  await mkdir(join(outputRoot, 'meals'), { recursive: true });
  await mkdir(join(outputRoot, 'exercises'), { recursive: true });
  for (const meal of meals ?? []) {
    if (meal.public_url) await downloadWebp(meal.public_url, join(outputRoot, 'meals', `${meal.recipe_key}.webp`));
  }
  for (const [slug, publicUrl] of exercises) {
    await downloadWebp(publicUrl, join(outputRoot, 'exercises', `${slug}.webp`));
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
