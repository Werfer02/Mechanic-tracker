import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const syncRooms = pgTable("sync_rooms", {
  code: text("code").primaryKey(),
  vehicles: jsonb("vehicles").notNull().default([]),
  jobs: jsonb("jobs").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
