import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Supabase-backed Personal Foods workflow", async () => {
  const [
    page,
    dashboard,
    onboarding,
    profileRoute,
    calculator,
    route,
    mealsRoute,
    analysisRoute,
    analysisService,
    serverClient,
    proxy,
    schema,
    storageSchema,
    mealLogsSchema,
    profilesSchema,
    globalStyles,
    envExample,
    packageJson,
  ] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/nutrition-dashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/onboarding/onboarding-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/nutrition/calculator.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/food-templates/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/meals/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/meals/analyze/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/ai/meal-analysis.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_personal_foods.sql", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_meal_images.sql", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_meal_logs.sql", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_profiles.sql", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(page, /getClaims/);
  assert.match(dashboard, /Save meal & template/);
  assert.match(route, /upsert_food_template/);
  assert.match(route, /log_food_template/);
  assert.match(dashboard, /\/api\/meals\/analyze/);
  assert.match(dashboard, /meal-images/);
  assert.match(analysisRoute, /detectImageMime/);
  assert.match(analysisRoute, /getClaims/);
  assert.match(analysisService, /gemini-2\.5-flash-lite/);
  assert.match(analysisService, /MealAnalysisSchema\.parse/);
  assert.match(route, /export async function DELETE/);
  assert.match(dashboard, /deleteTemplate/);
  assert.match(dashboard, /deleteMeal/);
  assert.match(dashboard, /totals\.calories/);
  assert.match(dashboard, /data-theme=\{dark/);
  assert.doesNotMatch(dashboard, /const meals =/);
  assert.match(mealsRoute, /export async function GET/);
  assert.match(mealsRoute, /export async function POST/);
  assert.match(mealsRoute, /export async function DELETE/);
  assert.match(serverClient, /createServerClient/);
  assert.match(proxy, /Cache-Control|cacheHeaders/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /security invoker/);
  assert.match(storageSchema, /storage\.foldername/);
  assert.match(storageSchema, /meal-images/);
  assert.match(mealLogsSchema, /create table if not exists public\.meal_logs/);
  assert.match(mealLogsSchema, /meal_logs_delete_own/);
  assert.match(onboarding, /Step \{step\} of 3/);
  assert.match(onboarding, /CALCULATION_METHOD_OPTIONS/);
  assert.match(profileRoute, /calculateNutritionTargets/);
  assert.match(calculator, /revised_harris_benedict/);
  assert.match(calculator, /katch_mcardle/);
  assert.match(profilesSchema, /create table if not exists public\.profiles/);
  assert.match(profilesSchema, /profiles_update_own/);
  assert.match(
    globalStyles,
    /\.app-shell\s*\{[^}]*background:\s*var\(--background\);[^}]*color:\s*var\(--foreground\);/s,
  );
  assert.match(
    globalStyles,
    /\.card\s*\{[^}]*background:\s*var\(--card\);[^}]*color:\s*var\(--card-foreground\);/s,
  );
  assert.match(globalStyles, /--primary-foreground:\s*#102218;/);
  assert.match(envExample, /GEMINI_API_KEY/);
  assert.match(envExample, /GEMINI_MODEL=gemini-2\.5-flash-lite/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_GEMINI/);
  assert.equal(JSON.parse(packageJson).scripts.build, "next build --webpack");
  await access(new URL("../.next/BUILD_ID", import.meta.url));
  await access(new URL("../app/icon.svg", import.meta.url));
});

test("contains no GPT Sites deployment configuration", async () => {
  await assert.rejects(
    access(new URL("../.openai/hosting.json", import.meta.url)),
  );
});
