-- Authenticated user profile and calculated nutrition targets.
-- Run once from Supabase Dashboard -> SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  age integer not null check (age between 18 and 100),
  sex_for_equation text not null check (sex_for_equation in ('male', 'female')),
  height_cm numeric(6,2) not null check (height_cm between 120 and 230),
  weight_kg numeric(6,2) not null check (weight_kg between 35 and 350),
  activity_level text not null check (
    activity_level in ('sedentary', 'light', 'moderate', 'very_active', 'extra_active')
  ),
  goal text not null check (
    goal in (
      'lose_weight', 'maintain_weight', 'gain_weight',
      'muscle_gain', 'body_recomposition'
    )
  ),
  calculation_method text not null default 'balanced' check (
    calculation_method in (
      'balanced', 'mifflin_st_jeor', 'revised_harris_benedict', 'katch_mcardle'
    )
  ),
  body_fat_percentage numeric(4,1) check (body_fat_percentage between 3 and 70),
  target_weight_kg numeric(6,2) check (target_weight_kg between 35 and 350),
  medical_conditions text[] not null default '{}',
  bmi numeric(5,1) not null check (bmi > 0),
  bmr integer not null check (bmr > 0),
  tdee integer not null check (tdee > 0),
  calorie_target integer not null check (calorie_target > 0),
  protein_target_g integer not null check (protein_target_g >= 0),
  carbs_target_g integer not null check (carbs_target_g >= 0),
  fat_target_g integer not null check (fat_target_g >= 0),
  onboarding_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility for projects that already created a partial profiles table.
alter table public.profiles add column if not exists id uuid references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists sex_for_equation text;
alter table public.profiles add column if not exists height_cm numeric(6,2);
alter table public.profiles add column if not exists weight_kg numeric(6,2);
alter table public.profiles add column if not exists activity_level text;
alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists calculation_method text default 'balanced';
alter table public.profiles add column if not exists body_fat_percentage numeric(4,1);
alter table public.profiles add column if not exists target_weight_kg numeric(6,2);
alter table public.profiles add column if not exists medical_conditions text[] default '{}';
alter table public.profiles add column if not exists bmi numeric(5,1);
alter table public.profiles add column if not exists bmr integer;
alter table public.profiles add column if not exists tdee integer;
alter table public.profiles add column if not exists calorie_target integer;
alter table public.profiles add column if not exists protein_target_g integer;
alter table public.profiles add column if not exists carbs_target_g integer;
alter table public.profiles add column if not exists fat_target_g integer;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

create unique index if not exists profiles_auth_user_idx on public.profiles (id);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;
