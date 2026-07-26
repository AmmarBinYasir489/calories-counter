import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Nourish nutrition dashboard and personal-food workflow", async () => {
  const [page, dashboard, route, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/nutrition-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/food-templates/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /NutritionDashboard/);
  assert.match(dashboard, /Personal foods/);
  assert.match(dashboard, /Save meal & template/);
  assert.match(dashboard, /action: "log"/);
  assert.match(route, /ON CONFLICT\(owner_id, name\)/);
  assert.match(route, /oai-authenticated-user-email/);
  assert.match(hosting, /"d1": "DB"/);
  await access(new URL("../dist/server/index.js", import.meta.url));
});
