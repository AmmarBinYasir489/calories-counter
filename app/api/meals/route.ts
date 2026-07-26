import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DateSchema = z.iso.date();
const MealIdSchema = z.object({ id: z.string().uuid() });
const MealInputSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  portion: z.string().trim().min(1).max(160),
  emoji: z.string().trim().min(1).max(16).default("🍽️"),
  calories: z.number().finite().min(0).max(20_000),
  proteinG: z.number().finite().min(0).max(2_000),
  carbsG: z.number().finite().min(0).max(2_000),
  fatG: z.number().finite().min(0).max(2_000),
  sugarG: z.number().finite().min(0).max(2_000).default(0),
  fiberG: z.number().finite().min(0).max(2_000).default(0),
  sodiumMg: z.number().finite().min(0).max(100_000).default(0),
  loggedOn: DateSchema,
});

type MealRow = {
  id: string;
  template_id: string | null;
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
  logged_on: string;
  logged_at: string;
};

function mapMeal(row: MealRow) {
  return {
    id: row.id,
    templateId: row.template_id,
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
    loggedOn: row.logged_on,
    loggedAt: row.logged_at,
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { supabase, userId };
}

export async function GET(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = DateSchema.safeParse(url.searchParams.get("from"));
  const to = DateSchema.safeParse(url.searchParams.get("to"));
  if (!from.success || !to.success || from.data > to.data) {
    return NextResponse.json({ error: "Invalid meal date range" }, { status: 422 });
  }

  const { data, error } = await auth.supabase
    .from("meal_logs")
    .select(
      "id,template_id,name,portion,emoji,calories,protein_g,carbs_g,fat_g,sugar_g,fiber_g,sodium_mg,logged_on,logged_at",
    )
    .gte("logged_on", from.data)
    .lte("logged_on", to.data)
    .order("logged_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("meal_logs.list_failed", { code: error.code });
    const missingTable = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json(
      {
        error: missingTable
          ? "Meal history is not set up yet. Run database/supabase_meal_logs.sql in Supabase."
          : "Unable to load meals",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ meals: (data as MealRow[]).map(mapMeal) });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = MealInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meal values" }, { status: 422 });
  }

  const input = parsed.data;
  const { data, error } = await auth.supabase
    .from("meal_logs")
    .insert({
      user_id: auth.userId,
      template_id: input.templateId ?? null,
      name: input.name,
      portion: input.portion,
      emoji: input.emoji,
      calories: Math.round(input.calories),
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      sugar_g: input.sugarG,
      fiber_g: input.fiberG,
      sodium_mg: input.sodiumMg,
      logged_on: input.loggedOn,
    })
    .select(
      "id,template_id,name,portion,emoji,calories,protein_g,carbs_g,fat_g,sugar_g,fiber_g,sodium_mg,logged_on,logged_at",
    )
    .single();

  if (error || !data) {
    console.error("meal_logs.create_failed", { code: error?.code });
    const missingTable = error?.code === "42P01" || error?.code === "PGRST205";
    return NextResponse.json(
      {
        error: missingTable
          ? "Meal history is not set up yet. Run database/supabase_meal_logs.sql in Supabase."
          : "Unable to save meal",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ meal: mapMeal(data as MealRow) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = MealIdSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meal id" }, { status: 422 });
  }

  const { data, error } = await auth.supabase
    .from("meal_logs")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("meal_logs.delete_failed", { code: error.code });
    return NextResponse.json({ error: "Unable to delete meal" }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
