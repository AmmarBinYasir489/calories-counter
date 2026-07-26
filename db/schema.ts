import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const foodTemplates = sqliteTable(
  "food_templates",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    portion: text("portion").notNull(),
    emoji: text("emoji").notNull().default("meal"),
    calories: integer("calories").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    sugarG: integer("sugar_g").notNull().default(0),
    fiberG: integer("fiber_g").notNull().default(0),
    sodiumMg: integer("sodium_mg").notNull().default(0),
    usageCount: integer("usage_count").notNull().default(1),
    lastUsedAt: text("last_used_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("food_templates_owner_name_unique").on(table.ownerId, table.name),
    index("food_templates_owner_usage_idx").on(table.ownerId, table.usageCount),
  ],
);

export type FoodTemplate = typeof foodTemplates.$inferSelect;
export type NewFoodTemplate = typeof foodTemplates.$inferInsert;
