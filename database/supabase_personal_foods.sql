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
