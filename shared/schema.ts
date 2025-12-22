import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Schema for a single data point with optional citation
export const dataPointSchema = z.object({
  value: z.string(),
  citation: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
});

// Category schema representing a group of data points
export const categorySchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  items: z.array(dataPointSchema).optional(),
  status: z.string().optional(),
  lastUpdated: z.string().optional(),
});

// Complete snapshot data structure
export const snapshotDataSchema = z.object({
  location: z.string(),
  timestamp: z.string(),
  categories: z.array(categorySchema),
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
export type Category = z.infer<typeof categorySchema>;
export type DataPoint = z.infer<typeof dataPointSchema>;
