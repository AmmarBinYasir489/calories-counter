import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

type FoodTemplateRow = {
  id: string;
  name: string;
  portion: string;
  emoji: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
  usage_count: number;
  last_used_at: string;
};

function mapTemplate(row: FoodTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    portion: row.portion,
    emoji: row.emoji,
    calories: row.calories,
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    sugarG: Number(row.sugar_g),
    fiberG: Number(row.fiber_g),
    sodiumMg: Number(row.sodium_mg),
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
    input.portion.length <= 160 &&
    ["calories", "proteinG", "carbsG", "fatG"].every(
      (key) =>
        typeof input[key] === "number" &&
        Number.isFinite(input[key]) &&
        Number(input[key]) >= 0,
    )
  );
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return supabase;
}

export async function GET() {
  const supabase = await authenticatedClient();
  if (!supabase) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("food_templates")
    .select(
      "id,name,portion,emoji,calories,protein_g,carbs_g,fat_g,sugar_g,fiber_g,sodium_mg,usage_count,last_used_at",
    )
    .order("usage_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("food_templates.list_failed", { code: error.code });
    return NextResponse.json({ error: "Unable to load personal foods" }, { status: 503 });
  }

  return NextResponse.json({
    templates: (data as FoodTemplateRow[]).map(mapTemplate),
  });
}

export async function POST(request: Request) {
  const supabase = await authenticatedClient();
  if (!supabase) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body: unknown = await request.json();
  if (!validInput(body)) {
    return NextResponse.json({ error: "Invalid food template" }, { status: 422 });
  }

  const input = body as TemplateInput;
  const { data, error } = await supabase.rpc("upsert_food_template", {
    p_name: input.name.trim(),
    p_portion: input.portion.trim(),
    p_emoji: input.emoji ?? "🍽️",
    p_calories: Math.round(input.calories),
    p_protein_g: input.proteinG,
    p_carbs_g: input.carbsG,
    p_fat_g: input.fatG,
    p_sugar_g: input.sugarG ?? 0,
    p_fiber_g: input.fiberG ?? 0,
    p_sodium_mg: input.sodiumMg ?? 0,
  });

  if (error || !data) {
    console.error("food_templates.create_failed", { code: error?.code });
    return NextResponse.json({ error: "Unable to save personal food" }, { status: 503 });
  }

  return NextResponse.json(
    { template: mapTemplate(data as FoodTemplateRow) },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const supabase = await authenticatedClient();
  if (!supabase) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; action?: string };
  if (!body.id || body.action !== "log") {
    return NextResponse.json({ error: "Invalid action" }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("log_food_template", {
    p_template_id: body.id,
  });
  if (error || !data) {
    console.error("food_templates.quick_log_failed", { code: error?.code });
    return NextResponse.json({ error: "Food template not found" }, { status: 404 });
  }

  return NextResponse.json({ template: mapTemplate(data as FoodTemplateRow) });
}
