import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type TemplateInput = {
  name: string;
  portion: string;
  emoji?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG?: number;
  fiberG?: number;
  sodiumMg?: number;
};

function database() {
  if (!env.DB) throw new Error("Personal Foods database is unavailable");
  return env.DB;
}

async function ownerId() {
  const requestHeaders = await headers();
  return requestHeaders.get("oai-authenticated-user-email") ?? "local-demo-user";
}

async function ensureSchema() {
  const db = database();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS food_templates (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        portion TEXT NOT NULL,
        emoji TEXT NOT NULL DEFAULT 'meal',
        calories INTEGER NOT NULL,
        protein_g INTEGER NOT NULL,
        carbs_g INTEGER NOT NULL,
        fat_g INTEGER NOT NULL,
        sugar_g INTEGER NOT NULL DEFAULT 0,
        fiber_g INTEGER NOT NULL DEFAULT 0,
        sodium_mg INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 1,
        last_used_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS food_templates_owner_name_unique ON food_templates(owner_id, name)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS food_templates_owner_usage_idx ON food_templates(owner_id, usage_count DESC)"
    ),
  ]);
}

function mapTemplate(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    portion: row.portion,
    emoji: row.emoji,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    sugarG: row.sugar_g,
    fiberG: row.fiber_g,
    sodiumMg: row.sodium_mg,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
  };
}

function validInput(value: unknown): value is TemplateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    input.name.length <= 120 &&
    typeof input.portion === "string" &&
    input.portion.trim().length > 0 &&
    ["calories", "proteinG", "carbsG", "fatG"].every(
      (key) => typeof input[key] === "number" && Number.isFinite(input[key]) && Number(input[key]) >= 0
    )
  );
}

export async function GET() {
  try {
    await ensureSchema();
    const owner = await ownerId();
    const result = await database()
      .prepare(
        "SELECT * FROM food_templates WHERE owner_id = ? ORDER BY usage_count DESC, last_used_at DESC LIMIT 100"
      )
      .bind(owner)
      .all();
    return NextResponse.json({
      templates: result.results.map((row) => mapTemplate(row as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("food_templates.list_failed", error);
    return NextResponse.json({ error: "Unable to load personal foods" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!validInput(body)) {
      return NextResponse.json({ error: "Invalid food template" }, { status: 422 });
    }
    await ensureSchema();
    const owner = await ownerId();
    const now = new Date().toISOString();
    const input = body as TemplateInput;
    const id = crypto.randomUUID();
    await database()
      .prepare(`
        INSERT INTO food_templates (
          id, owner_id, name, portion, emoji, calories, protein_g, carbs_g, fat_g,
          sugar_g, fiber_g, sodium_mg, usage_count, last_used_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(owner_id, name) DO UPDATE SET
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
          last_used_at = excluded.last_used_at,
          updated_at = excluded.updated_at
      `)
      .bind(
        id, owner, input.name.trim(), input.portion.trim(), input.emoji ?? "🍽️",
        Math.round(input.calories), Math.round(input.proteinG), Math.round(input.carbsG),
        Math.round(input.fatG), Math.round(input.sugarG ?? 0), Math.round(input.fiberG ?? 0),
        Math.round(input.sodiumMg ?? 0), now, now, now,
      )
      .run();
    const result = await database()
      .prepare("SELECT * FROM food_templates WHERE owner_id = ? AND name = ? LIMIT 1")
      .bind(owner, input.name.trim())
      .first();
    return NextResponse.json({ template: mapTemplate(result as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    console.error("food_templates.create_failed", error);
    return NextResponse.json({ error: "Unable to save personal food" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; action?: string };
    if (!body.id || body.action !== "log") {
      return NextResponse.json({ error: "Invalid action" }, { status: 422 });
    }
    await ensureSchema();
    const owner = await ownerId();
    const now = new Date().toISOString();
    const result = await database()
      .prepare(
        "UPDATE food_templates SET usage_count = usage_count + 1, last_used_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .bind(now, now, body.id, owner)
      .run();
    if (!result.meta.changes) {
      return NextResponse.json({ error: "Food template not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("food_templates.quick_log_failed", error);
    return NextResponse.json({ error: "Unable to log personal food" }, { status: 503 });
  }
}
