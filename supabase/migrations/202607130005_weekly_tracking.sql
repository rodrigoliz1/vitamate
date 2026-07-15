alter table public.meal_entries
  add column if not exists plan_slot_id text,
  add column if not exists plan_option_id text;

alter table public.workout_sessions
  add column if not exists source text not null default 'guided' check (source in ('guided', 'manual')),
  add column if not exists activity_type text check (activity_type in ('strength', 'cardio', 'mobility', 'sport', 'other')),
  add column if not exists calories_burned integer check (calories_burned >= 0),
  add column if not exists requirement_credit_minutes integer check (requirement_credit_minutes >= 0);

create index if not exists meal_entries_user_plan_slot_idx on public.meal_entries(user_id, plan_slot_id) where plan_slot_id is not null;
create index if not exists workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc);
