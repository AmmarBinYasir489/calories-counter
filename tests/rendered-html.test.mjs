import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Supabase-backed Personal Foods workflow", async () => {
  const [
    page,
    dashboard,
    route,
    analysisRoute,
    analysisService,
    serverClient,
    proxy,
    schema,
    storageSchema,
    envExample,
    packageJson,
  ] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/nutrition-dashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/food-templates/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/meals/analyze/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/ai/meal-analysis.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_personal_foods.sql", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_meal_images.sql", import.meta.url), "utf8"),
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
  assert.match(analysisService, /gemini-3\.6-flash/);
  assert.match(analysisService, /MealAnalysisSchema\.parse/);
  assert.match(serverClient, /createServerClient/);
  assert.match(proxy, /Cache-Control|cacheHeaders/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /security invoker/);
  assert.match(storageSchema, /storage\.foldername/);
  assert.match(storageSchema, /meal-images/);
  assert.match(envExample, /GEMINI_API_KEY/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_GEMINI/);
  assert.equal(JSON.parse(packageJson).scripts.build, "next build --webpack");
  await access(new URL("../.next/BUILD_ID", import.meta.url));
});

test("contains no GPT Sites deployment configuration", async () => {
  await assert.rejects(
    access(new URL("../.openai/hosting.json", import.meta.url)),
  );
});
