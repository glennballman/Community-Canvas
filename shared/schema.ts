import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Schema matching the Firecrawl data structure
export const snapshotDataSchema = z.object({
  location: z.string(),
  location_citation: z.string().optional(),
  real_time_status_updates: z.object({
    bc_hydro_outages: z.array(z.object({
      value: z.string(),
      value_citation: z.string().describe("Source URL for this value").optional()
    })),
    water_sewer_alerts: z.array(z.object({
      value: z.string(),
      value_citation: z.string().describe("Source URL for this value").optional()
    })),
    ferry_schedules: z.array(z.object({
      ferry_line: z.string(),
      ferry_line_citation: z.string().optional(),
      route: z.string(),
      route_citation: z.string().optional(),
      status: z.string(),
      status_citation: z.string().optional()
    })),
    road_conditions: z.array(z.object({
      road_name: z.string(),
      road_name_citation: z.string().optional(),
      status: z.string(),
      status_citation: z.string().optional()
    })),
    active_alerts: z.array(z.object({
      value: z.string(),
      value_citation: z.string().describe("Source URL for this value").optional()
    }))
  }),
  dashboard_html: z.string().optional(),
  dashboard_html_citation: z.string().optional()
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
