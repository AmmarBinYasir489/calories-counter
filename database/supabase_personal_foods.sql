-- Production PostgreSQL/Supabase shape for the Personal Food Database.
-- Run through the project's migration workflow after linking a Supabase project.

create table if not exists public.food_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  usage_count integer not null default 1 check (usage_count >= 0),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists food_templates_user_usage_idx
  on public.food_templates (user_id, usage_count desc, last_used_at desc);

alter table public.food_templates enable row level security;

create policy "food_templates_select_own"
  on public.food_templates for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "food_templates_insert_own"
  on public.food_templates for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "food_templates_update_own"
  on public.food_templates for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "food_templates_delete_own"
  on public.food_templates for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.food_templates to authenticated;

create or replace function public.upsert_food_template(
  p_name text,
  p_portion text,
  p_emoji text,
  p_calories integer,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric,
  p_sugar_g numeric,
  p_fiber_g numeric,
  p_sodium_mg numeric
)
returns public.food_templates
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.food_templates;
begin
  insert into public.food_templates (
    user_id, name, portion, emoji, calories, protein_g, carbs_g, fat_g,
    sugar_g, fiber_g, sodium_mg, usage_count, last_used_at, updated_at
  )
  values (
    (select auth.uid()), trim(p_name), trim(p_portion), p_emoji, p_calories,
    p_protein_g, p_carbs_g, p_fat_g, p_sugar_g, p_fiber_g, p_sodium_mg,
    1, now(), now()
  )
  on conflict (user_id, name) do update set
    portion = excluded.portion,
    emoji = excluded.emoji,
    calories = excluded.calories,
    protein_g = excluded.protein_g,
    carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g,
    sugar_g = excluded.sugar_g,
    fiber_g = excluded.fiber_g,
    sodium_mg = excluded.sodium_mg,
    usage_count = food_templates.usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

create or replace function public.log_food_template(p_template_id uuid)
returns public.food_templates
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.food_templates;
begin
  update public.food_templates
  set usage_count = usage_count + 1,
      last_used_at = now(),
      updated_at = now()
  where id = p_template_id
    and user_id = (select auth.uid())
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.upsert_food_template(
  text, text, text, integer, numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon;
revoke all on function public.log_food_template(uuid) from public, anon;

grant execute on function public.upsert_food_template(
  text, text, text, integer, numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;
grant execute on function public.log_food_template(uuid) to authenticated;
