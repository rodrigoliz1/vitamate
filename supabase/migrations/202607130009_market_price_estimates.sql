-- Official-market grocery estimates. All tables in this migration are written
-- by the backend service role; the PWA only consumes the normalized API.

alter table public.foods
  add column if not exists serving_unit text,
  add column if not exists serving_weight_grams numeric check (serving_weight_grams > 0);

alter table public.meal_entries
  add column if not exists quantity_grams numeric check (quantity_grams > 0);

create table if not exists public.food_ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  normalized_name text not null unique,
  category text not null,
  base_unit text not null check (base_unit in ('g', 'ml', 'pieza')),
  allowed_equivalences jsonb not null default '[]'::jsonb,
  excluded_equivalences jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.food_ingredients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  match_type text not null default 'exact' check (match_type in ('exact', 'contains', 'reviewed')),
  created_at timestamptz not null default now()
);

create table if not exists public.market_products (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'profeco_qqp' check (source in ('profeco_qqp')),
  source_product_id text not null,
  source_product_name text not null,
  brand text,
  category text,
  presentation text not null,
  canonical_ingredient_id uuid references public.food_ingredients(id) on delete set null,
  package_quantity numeric check (package_quantity > 0),
  package_unit text check (package_unit in ('g', 'ml', 'pieza')),
  normalized_quantity numeric check (normalized_quantity > 0),
  normalized_unit text check (normalized_unit in ('g', 'ml', 'pieza')),
  match_confidence numeric check (match_confidence between 0 and 1),
  match_method text,
  raw_source_data jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_product_id)
);

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  market_product_id uuid not null references public.market_products(id) on delete cascade,
  price_mxn numeric not null check (price_mxn > 0),
  observed_at date not null,
  city text not null,
  state text not null,
  establishment text,
  commercial_chain text,
  address text,
  latitude numeric,
  longitude numeric,
  source text not null default 'profeco_qqp',
  source_url text,
  source_row_hash text not null unique,
  raw_source_data jsonb not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.price_index_observations (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'inegi_inpc',
  indicator_id text not null,
  category text not null,
  geography_code text not null default '00',
  period text not null,
  index_value numeric not null check (index_value > 0),
  observed_at date not null,
  source_url text not null,
  raw_source_data jsonb not null,
  imported_at timestamptz not null default now(),
  unique (source, indicator_id, geography_code, period)
);

create table if not exists public.ingredient_price_estimates (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.food_ingredients(id) on delete cascade,
  city text not null default '',
  state text not null default '',
  base_unit text not null check (base_unit in ('g', 'ml', 'pieza')),
  minimum_price_per_base_unit numeric not null check (minimum_price_per_base_unit >= 0),
  median_price_per_base_unit numeric not null check (median_price_per_base_unit >= 0),
  maximum_price_per_base_unit numeric not null check (maximum_price_per_base_unit >= 0),
  sample_size integer not null check (sample_size > 0),
  latest_observed_at date not null,
  geographic_scope text not null check (geographic_scope in ('city', 'state', 'national')),
  used_inpc boolean not null default false,
  inpc_factor numeric,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  source text not null default 'profeco_qqp',
  calculated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (ingredient_id, city, state, base_unit)
);

create table if not exists public.grocery_estimates (
  id uuid primary key default gen_random_uuid(),
  request_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  city text not null,
  state text not null,
  period_days integer not null check (period_days between 1 and 31),
  people integer not null check (people between 1 and 20),
  request_data jsonb not null,
  response_data jsonb not null,
  calculated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.market_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_url text,
  source_filename text,
  status text not null default 'running' check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  processed_rows integer not null default 0,
  imported_products integer not null default 0,
  imported_prices integer not null default 0,
  skipped_rows integer not null default 0,
  error_rows integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

create table if not exists public.market_import_errors (
  id bigint generated always as identity primary key,
  import_run_id uuid not null references public.market_import_runs(id) on delete cascade,
  row_number integer,
  error_code text not null,
  error_message text not null,
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ingredient_aliases_ingredient_idx on public.ingredient_aliases(ingredient_id);
create index if not exists market_products_ingredient_idx on public.market_products(canonical_ingredient_id) where active;
create index if not exists market_prices_product_date_idx on public.market_prices(market_product_id, observed_at desc);
create index if not exists market_prices_city_state_date_idx on public.market_prices(city, state, observed_at desc);
create index if not exists market_prices_state_date_idx on public.market_prices(state, observed_at desc);
create index if not exists ingredient_price_estimates_lookup_idx on public.ingredient_price_estimates(ingredient_id, city, state, expires_at);
create index if not exists grocery_estimates_expiry_idx on public.grocery_estimates(expires_at);
create index if not exists price_index_category_date_idx on public.price_index_observations(category, observed_at desc);

alter table public.food_ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.market_products enable row level security;
alter table public.market_prices enable row level security;
alter table public.price_index_observations enable row level security;
alter table public.ingredient_price_estimates enable row level security;
alter table public.grocery_estimates enable row level security;
alter table public.market_import_runs enable row level security;
alter table public.market_import_errors enable row level security;

-- Seed only canonical semantics and aliases, never prices. Price observations
-- must always retain their official PROFECO source row.
insert into public.food_ingredients (canonical_name, normalized_name, category, base_unit, excluded_equivalences)
values
  ('Avena', 'avena', 'Cereales y leguminosas', 'g', '["granola"]'),
  ('Yogurt griego natural', 'yogurt griego natural', 'Lácteos', 'g', '["yogurt bebible", "helado"]'),
  ('Frutos rojos', 'frutos rojos', 'Frutas y verduras', 'g', '["mermelada", "jugo"]'),
  ('Nuez o almendra', 'nuez o almendra', 'Semillas y grasas', 'g', '[]'),
  ('Bebida de soya sin azúcar', 'bebida de soya sin azucar', 'Bebidas vegetales', 'ml', '["leche de vaca"]'),
  ('Crema de cacahuate', 'crema de cacahuate', 'Semillas y grasas', 'g', '[]'),
  ('Huevo', 'huevo', 'Proteínas', 'pieza', '["huevo de chocolate"]'),
  ('Claras de huevo', 'claras de huevo', 'Proteínas', 'g', '[]'),
  ('Frijoles', 'frijoles', 'Cereales y leguminosas', 'g', '[]'),
  ('Tortilla de maíz', 'tortilla de maiz', 'Cereales y leguminosas', 'pieza', '["tortilla de harina"]'),
  ('Aguacate', 'aguacate', 'Frutas y verduras', 'g', '["aceite de aguacate"]'),
  ('Pechuga de pollo', 'pechuga de pollo', 'Proteínas', 'g', '["pollo entero", "nuggets"]'),
  ('Arroz', 'arroz', 'Cereales y leguminosas', 'g', '["arroz preparado"]'),
  ('Verduras mixtas', 'verduras mixtas', 'Frutas y verduras', 'g', '["jugo de verduras"]'),
  ('Aceite de oliva', 'aceite de oliva', 'Semillas y grasas', 'ml', '[]'),
  ('Salmón', 'salmon', 'Proteínas', 'g', '["alimento para mascotas"]'),
  ('Papa', 'papa', 'Frutas y verduras', 'g', '["papas fritas"]'),
  ('Pasta integral', 'pasta integral', 'Cereales y leguminosas', 'g', '["pasta preparada"]'),
  ('Pavo molido', 'pavo molido', 'Proteínas', 'g', '["jamon de pavo"]'),
  ('Salsa de tomate', 'salsa de tomate', 'Frutas y verduras', 'g', '["catsup"]'),
  ('Calabacita y champiñón', 'calabacita y champinon', 'Frutas y verduras', 'g', '[]'),
  ('Queso parmesano', 'queso parmesano', 'Lácteos', 'g', '[]'),
  ('Tofu firme', 'tofu firme', 'Proteínas', 'g', '[]'),
  ('Quinoa', 'quinoa', 'Cereales y leguminosas', 'g', '[]'),
  ('Lentejas', 'lentejas', 'Cereales y leguminosas', 'g', '[]'),
  ('Fruta', 'fruta', 'Frutas y verduras', 'pieza', '["jugo", "mermelada"]'),
  ('Semillas', 'semillas', 'Semillas y grasas', 'g', '[]'),
  ('Miel', 'miel', 'Otros', 'g', '["jarabe sabor miel"]'),
  ('Pan integral', 'pan integral', 'Cereales y leguminosas', 'pieza', '[]'),
  ('Hummus', 'hummus', 'Cereales y leguminosas', 'g', '[]'),
  ('Atún en agua', 'atun en agua', 'Proteínas', 'g', '["atun en aceite", "alimento para mascotas"]'),
  ('Tostada horneada', 'tostada horneada', 'Cereales y leguminosas', 'pieza', '[]'),
  ('Garbanzo', 'garbanzo', 'Cereales y leguminosas', 'g', '[]'),
  ('Leche de coco ligera', 'leche de coco ligera', 'Bebidas vegetales', 'ml', '["crema de coco"]')
on conflict (normalized_name) do update set
  canonical_name = excluded.canonical_name,
  category = excluded.category,
  base_unit = excluded.base_unit,
  excluded_equivalences = excluded.excluded_equivalences,
  updated_at = now();

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, match_type)
select ingredient.id, alias.value, alias.value, 'reviewed'
from public.food_ingredients ingredient
cross join lateral jsonb_array_elements_text(
  case ingredient.normalized_name
    when 'avena' then '["avena", "hojuelas de avena"]'::jsonb
    when 'yogurt griego natural' then '["yogurt griego natural", "yoghurt griego natural"]'::jsonb
    when 'frutos rojos' then '["frutos rojos", "fresa", "frambuesa", "zarzamora"]'::jsonb
    when 'nuez o almendra' then '["nuez o almendra", "nuez", "almendra"]'::jsonb
    when 'bebida de soya sin azucar' then '["bebida de soya sin azucar", "leche de soya sin azucar"]'::jsonb
    when 'crema de cacahuate' then '["crema de cacahuate", "mantequilla de cacahuate"]'::jsonb
    when 'huevo' then '["huevo", "huevos"]'::jsonb
    when 'claras de huevo' then '["claras de huevo", "clara de huevo"]'::jsonb
    when 'frijoles' then '["frijoles", "frijol"]'::jsonb
    when 'tortilla de maiz' then '["tortilla de maiz", "tortillas de maiz"]'::jsonb
    when 'aguacate' then '["aguacate"]'::jsonb
    when 'pechuga de pollo' then '["pechuga de pollo", "filete de pechuga"]'::jsonb
    when 'arroz' then '["arroz", "arroz cocido"]'::jsonb
    when 'verduras mixtas' then '["verduras mixtas", "vegetales mixtos"]'::jsonb
    when 'aceite de oliva' then '["aceite de oliva"]'::jsonb
    when 'salmon' then '["salmon"]'::jsonb
    when 'papa' then '["papa", "papas"]'::jsonb
    when 'pasta integral' then '["pasta integral", "pasta integral seca"]'::jsonb
    when 'pavo molido' then '["pavo molido", "pavo molido magro"]'::jsonb
    when 'salsa de tomate' then '["salsa de tomate", "tomate triturado", "salsa de tomate natural"]'::jsonb
    when 'calabacita y champinon' then '["calabacita y champinon", "calabacita", "champinon"]'::jsonb
    when 'queso parmesano' then '["queso parmesano"]'::jsonb
    when 'tofu firme' then '["tofu firme", "tofu"]'::jsonb
    when 'quinoa' then '["quinoa", "quinoa cocida"]'::jsonb
    when 'lentejas' then '["lentejas", "lentejas cocidas"]'::jsonb
    when 'fruta' then '["fruta", "porcion de fruta"]'::jsonb
    when 'semillas' then '["semillas"]'::jsonb
    when 'miel' then '["miel", "miel opcional"]'::jsonb
    when 'pan integral' then '["pan integral", "rebanada de pan integral"]'::jsonb
    when 'hummus' then '["hummus"]'::jsonb
    when 'atun en agua' then '["atun en agua", "atun en agua drenado"]'::jsonb
    when 'tostada horneada' then '["tostada horneada", "tostadas horneadas"]'::jsonb
    when 'garbanzo' then '["garbanzo", "garbanzo cocido"]'::jsonb
    when 'leche de coco ligera' then '["leche de coco ligera"]'::jsonb
    else jsonb_build_array(ingredient.normalized_name)
  end
) alias(value)
on conflict (normalized_alias) do update set ingredient_id = excluded.ingredient_id, alias = excluded.alias, match_type = excluded.match_type;

comment on table public.market_prices is 'Immutable normalized observations imported from official PROFECO QQP CSV rows.';
comment on table public.price_index_observations is 'INEGI INPC observations used only to update stale official price observations.';
comment on table public.grocery_estimates is 'Short-lived backend cache keyed by normalized request, location, period and people.';
