import { NextResponse } from "next/server";
import {
  calculateNutritionTargets,
  ProfileInputSchema,
} from "@/lib/nutrition/calculator";
import { createClient } from "@/lib/supabase/server";

const profileColumns =
  "name,age,sex_for_equation,height_cm,weight_kg,activity_level,goal,calculation_method,body_fat_percentage,target_weight_kg,medical_conditions,bmi,bmr,tdee,calorie_target,protein_target_g,carbs_target_g,fat_target_g";

type ProfileRow = {
  name: string;
  age: number;
  sex_for_equation: "male" | "female";
  height_cm: number;
  weight_kg: number;
  activity_level:
    | "sedentary"
    | "light"
    | "moderate"
    | "very_active"
    | "extra_active";
  goal:
    | "lose_weight"
    | "maintain_weight"
    | "gain_weight"
    | "muscle_gain"
    | "body_recomposition";
  calculation_method:
    | "balanced"
    | "mifflin_st_jeor"
    | "revised_harris_benedict"
    | "katch_mcardle";
  body_fat_percentage: number | null;
  target_weight_kg: number | null;
  medical_conditions: string[];
  bmi: number;
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
};

function mapProfile(row: ProfileRow) {
  return {
    name: row.name,
    age: row.age,
    sexForEquation: row.sex_for_equation,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    activityLevel: row.activity_level,
    goal: row.goal,
    calculationMethod: row.calculation_method,
    bodyFatPercentage:
      row.body_fat_percentage === null
        ? null
        : Number(row.body_fat_percentage),
    targetWeightKg:
      row.target_weight_kg === null ? null : Number(row.target_weight_kg),
    medicalConditions: row.medical_conditions,
    bmi: Number(row.bmi),
    bmr: row.bmr,
    tdee: row.tdee,
    calorieTarget: row.calorie_target,
    proteinTargetG: row.protein_target_g,
    carbsTargetG: row.carbs_target_g,
    fatTargetG: row.fat_target_g,
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { supabase, userId };
}

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", auth.userId)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();

  if (error) {
    console.error("profile.read_failed", { code: error.code });
    return NextResponse.json({ error: "Unable to load profile" }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile: mapProfile(data as ProfileRow) });
}

export async function PUT(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = ProfileInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Check your profile information.",
      },
      { status: 422 },
    );
  }

  const profile = parsed.data;
  const targets = calculateNutritionTargets(profile);
  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert(
      {
        id: auth.userId,
        name: profile.name,
        age: profile.age,
        sex_for_equation: profile.sexForEquation,
        height_cm: profile.heightCm,
        weight_kg: profile.weightKg,
        activity_level: profile.activityLevel,
        goal: profile.goal,
        calculation_method: profile.calculationMethod,
        body_fat_percentage: profile.bodyFatPercentage ?? null,
        target_weight_kg: profile.targetWeightKg ?? null,
        medical_conditions: profile.medicalConditions,
        bmi: targets.bmi,
        bmr: targets.bmr,
        tdee: targets.tdee,
        calorie_target: targets.calorieTarget,
        protein_target_g: targets.proteinTargetG,
        carbs_target_g: targets.carbsTargetG,
        fat_target_g: targets.fatTargetG,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(profileColumns)
    .single();

  if (error || !data) {
    console.error("profile.save_failed", { code: error?.code });
    const missingTable = error?.code === "42P01" || error?.code === "PGRST205";
    return NextResponse.json(
      {
        error: missingTable
          ? "Profiles are not set up yet. Run database/supabase_profiles.sql in Supabase."
          : "Unable to save your nutrition plan",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ profile: mapProfile(data as ProfileRow) });
}
