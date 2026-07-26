import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NutritionDashboard } from "./nutrition-dashboard";
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

  const displayName =
    (typeof claims.user_metadata === "object" &&
      claims.user_metadata &&
      "full_name" in claims.user_metadata &&
      typeof claims.user_metadata.full_name === "string" &&
      claims.user_metadata.full_name) ||
    (typeof claims.email === "string" && claims.email.split("@")[0]) ||
    "there";

  return <NutritionDashboard userName={displayName} />;
}
