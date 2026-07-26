import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";
import type { ProfileInput } from "@/lib/nutrition/calculator";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Build your nutrition plan | Nourish",
  description: "Set your goal and calculate personalized nutrition targets.",
};

type ProfileRow = {
  name: string;
  age: number;
  sex_for_equation: "male" | "female";
  height_cm: number;
  weight_kg: number;
  activity_level: ProfileInput["activityLevel"];
  goal: ProfileInput["goal"];
  calculation_method: ProfileInput["calculationMethod"];
  body_fat_percentage: number | null;
  target_weight_kg: number | null;
  medical_conditions: ProfileInput["medicalConditions"];
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select(
      "name,age,sex_for_equation,height_cm,weight_kg,activity_level,goal,calculation_method,body_fat_percentage,target_weight_kg,medical_conditions",
    )
    .eq("id", claims.sub)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();

  const params = await searchParams;
  if (data && params.edit !== "1") redirect("/");

  const row = data as ProfileRow | null;
  const fallbackName =
    (typeof claims.user_metadata === "object" &&
      claims.user_metadata &&
      "full_name" in claims.user_metadata &&
      typeof claims.user_metadata.full_name === "string" &&
      claims.user_metadata.full_name) ||
    (typeof claims.email === "string" && claims.email.split("@")[0]) ||
    "";

  const initialProfile: ProfileInput = row
    ? {
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
          row.target_weight_kg === null
            ? null
            : Number(row.target_weight_kg),
        medicalConditions: row.medical_conditions ?? [],
      }
    : {
        name: fallbackName,
        age: 30,
        sexForEquation: "male",
        heightCm: 170,
        weightKg: 70,
        activityLevel: "moderate",
        goal: "maintain_weight",
        calculationMethod: "balanced",
        bodyFatPercentage: null,
        targetWeightKg: null,
        medicalConditions: [],
      };

  return (
    <OnboardingForm
      initialProfile={initialProfile}
      editing={Boolean(row)}
    />
  );
}
