import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NutritionDashboard } from "./nutrition-dashboard";
import { goalLabel, type NutritionGoal } from "@/lib/nutrition/calculator";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today | Nourish",
  description: "Your personal nutrition dashboard and reusable food library.",
};

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "name,goal,calorie_target,protein_target_g,carbs_target_g,fat_target_g",
    )
    .eq("id", claims.sub)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();

  if (!profileError && !profile) redirect("/onboarding");

  const displayName =
    profile?.name ||
    (typeof claims.user_metadata === "object" &&
      claims.user_metadata &&
      "full_name" in claims.user_metadata &&
      typeof claims.user_metadata.full_name === "string" &&
      claims.user_metadata.full_name) ||
    (typeof claims.email === "string" && claims.email.split("@")[0]) ||
    "there";

  return (
    <NutritionDashboard
      userName={displayName}
      goalName={
        profile?.goal
          ? goalLabel(profile.goal as NutritionGoal)
          : "Nutrition goal"
      }
      targets={{
        calories: profile?.calorie_target ?? 2_100,
        proteinG: profile?.protein_target_g ?? 135,
        carbsG: profile?.carbs_target_g ?? 235,
        fatG: profile?.fat_target_g ?? 58,
      }}
    />
  );
}
