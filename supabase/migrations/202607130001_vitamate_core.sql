create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_name text not null check (char_length(preferred_name) between 1 and 80),
  locale text not null default 'es-MX' check (locale in ('es-MX', 'en-US')),
  timezone text not null default 'America/Mexico_City',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_es text not null,
  name_en text not null,
  instructions_es jsonb not null default '[]'::jsonb,
  instructions_en jsonb not null default '[]'::jsonb,
  safety_notes_es jsonb not null default '[]'::jsonb,
  safety_notes_en jsonb not null default '[]'::jsonb,
  movement_type text not null default 'repetitions' check (movement_type in ('repetitions', 'timed')),
  default_rep_target integer,
  default_hold_seconds integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  prompt_version text not null,
  view_key text not null default 'start-end',
  storage_path text not null unique,
  public_url text,
  provider text not null,
  provider_request_id text,
  prompt text not null,
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected')),
  reviewer_notes text,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (exercise_id, prompt_version, view_key)
);

create table if not exists public.exercise_media_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  prompt_version text not null,
  view_key text not null default 'start-end',
  status text not null default 'queued' check (status in ('queued', 'generating', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, prompt_version, view_key)
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  barcode text unique,
  source text not null check (source in ('vitamate', 'open_food_facts', 'usda')),
  external_id text,
  serving_size text,
  serving_quantity numeric,
  calories_per_100g numeric check (calories_per_100g between 0 and 1000),
  protein_per_100g numeric check (protein_per_100g between 0 and 100),
  carbohydrates_per_100g numeric check (carbohydrates_per_100g between 0 and 100),
  fat_per_100g numeric check (fat_per_100g between 0 and 100),
  fiber_per_100g numeric check (fiber_per_100g between 0 and 100),
  sugars_per_100g numeric check (sugars_per_100g between 0 and 100),
  sodium_per_100g numeric check (sodium_per_100g between 0 and 100),
  image_url text,
  ingredients text,
  allergens text[] not null default '{}',
  quality_status text not null default 'partial' check (quality_status in ('complete', 'partial', 'rejected')),
  external_updated_at timestamptz,
  external_fetched_at timestamptz not null default now(),
  raw_external_data jsonb,
  search_text text generated always as (lower(coalesce(name, '') || ' ' || coalesce(brand, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists foods_search_text_trgm_idx on public.foods using gin (search_text gin_trgm_ops);
create index if not exists foods_barcode_idx on public.foods (barcode) where barcode is not null;

create table if not exists public.personal_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  serving_label text not null default '1 porción',
  serving_quantity numeric not null default 1 check (serving_quantity > 0),
  calories numeric not null check (calories between 0 and 10000),
  protein_g numeric not null check (protein_g between 0 and 1000),
  carbohydrates_g numeric not null check (carbohydrates_g between 0 and 1000),
  fat_g numeric not null check (fat_g between 0 and 1000),
  fiber_g numeric check (fiber_g between 0 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  personal_food_id uuid references public.personal_foods(id) on delete set null,
  source text not null check (source in ('manual', 'catalog', 'barcode', 'photo', 'personal')),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name_snapshot text not null,
  quantity numeric not null default 1 check (quantity > 0),
  calories numeric not null check (calories >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbohydrates_g numeric not null check (carbohydrates_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  photo_storage_path text,
  ai_analysis jsonb,
  user_confirmed boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_day_id text not null,
  workout_title text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  perceived_effort integer check (perceived_effort between 1 and 10),
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_slug text not null,
  exercise_name text not null,
  order_index integer not null check (order_index >= 0),
  target_reps integer,
  completed_reps integer not null default 0 check (completed_reps >= 0),
  target_seconds integer,
  completed_seconds integer check (completed_seconds >= 0),
  difficulty integer check (difficulty between 1 and 5),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.workout_rep_events (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  rep_number integer not null check (rep_number > 0),
  occurred_at timestamptz not null default now(),
  unique (session_exercise_id, rep_number)
);

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_media enable row level security;
alter table public.exercise_media_generation_jobs enable row level security;
alter table public.foods enable row level security;
alter table public.personal_foods enable row level security;
alter table public.meal_entries enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_rep_events enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
drop policy if exists "exercises_read" on public.exercises;
drop policy if exists "exercise_media_approved_read" on public.exercise_media;
drop policy if exists "foods_read" on public.foods;
drop policy if exists "personal_foods_owner_all" on public.personal_foods;
drop policy if exists "meal_entries_owner_all" on public.meal_entries;
drop policy if exists "workout_sessions_owner_all" on public.workout_sessions;
drop policy if exists "workout_session_exercises_owner_all" on public.workout_session_exercises;
drop policy if exists "workout_rep_events_owner_all" on public.workout_rep_events;

create policy "profiles_owner_all" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "exercises_read" on public.exercises for select to anon, authenticated using (active);
create policy "exercise_media_approved_read" on public.exercise_media for select to anon, authenticated using (review_status = 'approved');
create policy "foods_read" on public.foods for select to anon, authenticated using (quality_status <> 'rejected');
create policy "personal_foods_owner_all" on public.personal_foods for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meal_entries_owner_all" on public.meal_entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_sessions_owner_all" on public.workout_sessions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_session_exercises_owner_all" on public.workout_session_exercises for all to authenticated using (exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = (select auth.uid()))) with check (exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = (select auth.uid())));
create policy "workout_rep_events_owner_all" on public.workout_rep_events for all to authenticated using (exists (select 1 from public.workout_session_exercises wse join public.workout_sessions ws on ws.id = wse.session_id where wse.id = session_exercise_id and ws.user_id = (select auth.uid()))) with check (exists (select 1 from public.workout_session_exercises wse join public.workout_sessions ws on ws.id = wse.session_id where wse.id = session_exercise_id and ws.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-guides', 'exercise-guides', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meal_photos_owner_read" on storage.objects;
drop policy if exists "meal_photos_owner_insert" on storage.objects;
drop policy if exists "meal_photos_owner_update" on storage.objects;
drop policy if exists "meal_photos_owner_delete" on storage.objects;

create policy "meal_photos_owner_read" on storage.objects for select to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal_photos_owner_insert" on storage.objects for insert to authenticated with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal_photos_owner_update" on storage.objects for update to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal_photos_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into public.exercises (slug, name_es, name_en, instructions_es, instructions_en, safety_notes_es, safety_notes_en, movement_type, default_rep_target, default_hold_seconds)
values
('squat', 'Sentadilla', 'Squat', '["Pies al ancho de hombros", "Lleva la cadera atrás y abajo", "Mantén rodillas alineadas con los pies", "Empuja el suelo para subir"]', '["Stand with feet shoulder-width apart", "Send hips back and down", "Keep knees aligned with toes", "Push the floor away to stand"]', '["Mantén el torso estable", "Detente ante dolor articular"]', '["Keep your torso braced", "Stop if you feel joint pain"]', 'repetitions', 10, null),
('romanian-deadlift', 'Peso muerto rumano', 'Romanian deadlift', '["Sujeta la carga cerca del cuerpo", "Lleva la cadera hacia atrás", "Desciende con espalda neutra", "Extiende la cadera para volver"]', '["Keep the load close", "Push hips back", "Lower with a neutral spine", "Extend hips to return"]', '["No redondees la espalda", "Usa un rango que controles"]', '["Do not round your back", "Use a range you can control"]', 'repetitions', 10, null),
('chest-press', 'Press de pecho', 'Chest press', '["Apoya espalda y pies", "Baja con control", "Mantén muñecas neutras", "Empuja sin bloquear bruscamente"]', '["Set your back and feet", "Lower under control", "Keep wrists neutral", "Press without forceful lockout"]', '["Hombros lejos de las orejas"]', '["Keep shoulders away from ears"]', 'repetitions', 10, null),
('row', 'Remo', 'Row', '["Estabiliza el torso", "Lleva los codos atrás", "Pausa al acercar la carga", "Regresa con control"]', '["Brace your torso", "Drive elbows back", "Pause near the body", "Return under control"]', '["No uses impulso excesivo"]', '["Avoid excessive momentum"]', 'repetitions', 12, null),
('reverse-lunge', 'Zancada alterna', 'Reverse lunge', '["Da un paso atrás", "Desciende ambas rodillas", "Mantén el pie delantero apoyado", "Regresa empujando el suelo"]', '["Step backward", "Bend both knees", "Keep the front foot planted", "Push the floor to return"]', '["Acorta el paso si pierdes equilibrio"]', '["Shorten the step if balance is lost"]', 'repetitions', 10, null),
('shoulder-press', 'Press de hombro', 'Shoulder press', '["Activa abdomen y glúteos", "Inicia con codos bajo las manos", "Empuja arriba", "Baja con control"]', '["Brace abs and glutes", "Start with elbows under hands", "Press overhead", "Lower under control"]', '["Evita arquear la zona lumbar"]', '["Avoid arching the low back"]', 'repetitions', 10, null),
('plank', 'Plancha', 'Plank', '["Apoya antebrazos", "Alinea cabeza, torso y piernas", "Aprieta abdomen y glúteos", "Respira de forma continua"]', '["Set forearms down", "Align head, torso and legs", "Brace abs and glutes", "Keep breathing"]', '["Detén si aparece dolor lumbar"]', '["Stop if low-back pain appears"]', 'timed', null, 30),
('moderate-cardio', 'Cardio moderado', 'Moderate cardio', '["Elige caminar, bicicleta o elíptica", "Mantén un ritmo conversacional", "Respira de forma regular", "Reduce el ritmo para finalizar"]', '["Choose walking, cycling or elliptical", "Keep a conversational pace", "Breathe steadily", "Slow down to finish"]', '["Detente ante dolor de pecho, mareo o falta de aire inusual"]', '["Stop for chest pain, dizziness or unusual breathlessness"]', 'timed', null, 1200)
on conflict (slug) do update set name_es = excluded.name_es, name_en = excluded.name_en, instructions_es = excluded.instructions_es, instructions_en = excluded.instructions_en, safety_notes_es = excluded.safety_notes_es, safety_notes_en = excluded.safety_notes_en, movement_type = excluded.movement_type, default_rep_target = excluded.default_rep_target, default_hold_seconds = excluded.default_hold_seconds, updated_at = now();
