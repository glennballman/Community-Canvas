import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Comprehensive category schema for all city data
export const statusCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["online", "offline", "away", "busy", "unknown"]).default("unknown"),
  value: z.string().optional(),
  description: z.string().optional(),
  citation: z.string().optional(),
  lastUpdated: z.string().optional(),
});

export const snapshotDataSchema = z.object({
  location: z.string(),
  timestamp: z.string(),
  categories: z.array(statusCategorySchema),
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
export type StatusCategory = z.infer<typeof statusCategorySchema>;
