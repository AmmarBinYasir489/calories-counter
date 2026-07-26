-- Persistent, per-user meal history used by the Today dashboard.
-- Safe to run once from Supabase Dashboard -> SQL Editor.

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.food_templates(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  portion text not null check (char_length(portion) between 1 and 160),
  emoji text not null default '🍽️',
  calories integer not null check (calories >= 0),
  protein_g numeric(8,2) not null check (protein_g >= 0),
  carbs_g numeric(8,2) not null check (carbs_g >= 0),
  fat_g numeric(8,2) not null check (fat_g >= 0),
  sugar_g numeric(8,2) not null default 0 check (sugar_g >= 0),
  fiber_g numeric(8,2) not null default 0 check (fiber_g >= 0),
  sodium_mg numeric(10,2) not null default 0 check (sodium_mg >= 0),
  logged_on date not null,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_user_day_idx
  on public.meal_logs (user_id, logged_on desc, logged_at desc);

alter table public.meal_logs enable row level security;

drop policy if exists "meal_logs_select_own" on public.meal_logs;
create policy "meal_logs_select_own"
  on public.meal_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "meal_logs_insert_own" on public.meal_logs;
create policy "meal_logs_insert_own"
  on public.meal_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "meal_logs_update_own" on public.meal_logs;
create policy "meal_logs_update_own"
  on public.meal_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "meal_logs_delete_own" on public.meal_logs;
create policy "meal_logs_delete_own"
  on public.meal_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.meal_logs to authenticated;

-- Preserve meals confirmed today before this table existed. The NOT EXISTS
-- guard keeps this one-time backfill safe if the script is run again.
insert into public.meal_logs (
  user_id, template_id, name, portion, emoji, calories, protein_g, carbs_g,
  fat_g, sugar_g, fiber_g, sodium_mg, logged_on, logged_at
)
select
  template.user_id, template.id, template.name, template.portion, template.emoji,
  template.calories, template.protein_g, template.carbs_g, template.fat_g,
  template.sugar_g, template.fiber_g, template.sodium_mg,
  template.last_used_at::date, template.last_used_at
from public.food_templates as template
where template.last_used_at::date = current_date
  and not exists (
    select 1
    from public.meal_logs as meal
    where meal.template_id = template.id
  );
