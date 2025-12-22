import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Schema for a single status value with citation
const statusValueSchema = z.object({
  value: z.string(),
  value_citation: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info").optional(),
});

// Schema for a row-based status entry
const statusEntrySchema = z.object({
  label: z.string(),
  status: z.string(),
  status_citation: z.string().optional(),
  details: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info").optional(),
});

// Comprehensive city status categories
export const snapshotDataSchema = z.object({
  location: z.string(),
  timestamp: z.string(),
  categories: z.record(z.string(), z.array(statusEntrySchema)),
  emergency_alerts: z.array(statusValueSchema).optional(),
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
export type StatusEntry = z.infer<typeof statusEntrySchema>;
