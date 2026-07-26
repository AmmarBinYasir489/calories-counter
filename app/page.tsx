import type { Metadata } from "next";
import { NutritionDashboard } from "./nutrition-dashboard";

export const metadata: Metadata = {
  title: "Today | Nourish",
  description: "Your personal nutrition dashboard and reusable food library.",
};

export default function Home() {
  return <NutritionDashboard />;
}
