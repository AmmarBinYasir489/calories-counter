import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Supabase-backed Personal Foods workflow", async () => {
  const [page, dashboard, route, serverClient, proxy, schema, packageJson] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/nutrition-dashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/food-templates/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8"),
      readFile(new URL("../database/supabase_personal_foods.sql", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(page, /getClaims/);
  assert.match(dashboard, /Save meal & template/);
  assert.match(route, /upsert_food_template/);
  assert.match(route, /log_food_template/);
  assert.match(serverClient, /createServerClient/);
  assert.match(proxy, /Cache-Control|cacheHeaders/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /security invoker/);
  assert.equal(JSON.parse(packageJson).scripts.build, "next build");
  await access(new URL("../.next/BUILD_ID", import.meta.url));
});

test("contains no GPT Sites deployment configuration", async () => {
  await assert.rejects(
    access(new URL("../.openai/hosting.json", import.meta.url)),
  );
});
