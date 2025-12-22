import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Comprehensive categories for city status
export const statusCategorySchema = z.object({
  value: z.string(),
  status: z.enum(["normal", "warning", "critical", "unknown"]).default("unknown"),
  value_citation: z.string().optional()
});

export const snapshotDataSchema = z.object({
  location: z.string(),
  categories: z.record(z.string(), z.array(statusCategorySchema)).default({}),
  real_time_status_updates: z.record(z.string(), z.any()).optional(), // Legacy support
});

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  data: jsonb("data").$type<z.infer<typeof snapshotDataSchema>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSnapshotSchema = createInsertSchema(snapshots).pick({
  location: true,
  data: true,
});

export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type SnapshotData = z.infer<typeof snapshotDataSchema>;
