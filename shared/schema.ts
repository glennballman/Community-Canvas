import { pgTable, text, serial, timestamp, jsonb, integer, uuid } from "drizzle-orm/pg-core";
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

export const cc_snapshots = pgTable("cc_snapshots", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  data: jsonb("data").$type<z.infer<typeof snapshotDataSchema>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSnapshotSchema = createInsertSchema(cc_snapshots).pick({
  location: true,
  data: true,
});

export type Snapshot = typeof cc_snapshots.$inferSelect;
export type InsertSnapshot = typeof cc_snapshots.$inferInsert;
export type SnapshotData = z.infer<typeof snapshotDataSchema>;
export type StatusEntry = z.infer<typeof statusEntrySchema>;

// Chamber member count overrides (Expected/Estimated manual edits)
export const chamberOverrides = pgTable("cc_chamber_overrides", {
  chamberId: text("chamber_id").primaryKey(),
  expectedMembers: integer("expected_members"),
  estimatedMembers: integer("estimated_members"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChamberOverrideSchema = createInsertSchema(chamberOverrides);
export type ChamberOverride = typeof chamberOverrides.$inferSelect;
export type InsertChamberOverride = z.infer<typeof insertChamberOverrideSchema>;

// ============================================================================
// MEDIA STORAGE SYSTEM
// ============================================================================

// Media type enums (matching database enums)
export const mediaTypeEnum = z.enum(['image', 'document', 'video']);
export const mediaPurposeEnum = z.enum(['hero', 'gallery', 'thumbnail', 'avatar', 'proof', 'document', 'before', 'after', 'logo', 'cover']);
export const mediaSourceEnum = z.enum(['upload', 'crawl', 'import', 'ai_generated']);
export const mediaProcessingStatusEnum = z.enum(['pending', 'processing', 'complete', 'failed']);
export const crawlMediaStatusEnum = z.enum(['pending', 'downloading', 'processing', 'complete', 'failed', 'skipped']);

// Media variants schema (thumbnails, etc.)
export const mediaVariantsSchema = z.object({
  thumbnail: z.string().optional(),
  medium: z.string().optional(),
  large: z.string().optional(),
}).passthrough();

// Media table
export const cc_media = pgTable("cc_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  storageKey: text("storage_key").notNull(),
  storageProvider: text("storage_provider").notNull().default('r2'),
  publicUrl: text("public_url").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  caption: text("caption"),
  title: text("title"),
  mediaType: text("media_type").notNull().default('image'),
  purpose: text("purpose"),
  tags: text("tags").array().default([]),
  source: text("source").notNull().default('upload'),
  sourceUrl: text("source_url"),
  crawlJobId: uuid("crawl_job_id"),
  processingStatus: text("processing_status").notNull().default('complete'),
  variants: jsonb("variants").$type<z.infer<typeof mediaVariantsSchema>>().default({}),
  uploadedBy: uuid("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMediaSchema = createInsertSchema(cc_media).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Media = typeof cc_media.$inferSelect;
export type InsertMedia = z.infer<typeof insertMediaSchema>;

// Entity Media (polymorphic links)
export const entityMedia = pgTable("cc_entity_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaId: uuid("media_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  role: text("role").notNull().default('gallery'),
  sortOrder: integer("sort_order").default(0),
  portalId: uuid("portal_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEntityMediaSchema = createInsertSchema(entityMedia).omit({
  id: true,
  createdAt: true,
});

export type EntityMedia = typeof entityMedia.$inferSelect;
export type InsertEntityMedia = z.infer<typeof insertEntityMediaSchema>;

// Crawl Media Queue
export const crawlMediaQueue = pgTable("cc_crawl_media_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourcePageUrl: text("source_page_url"),
  crawlJobId: uuid("crawl_job_id"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  suggestedRole: text("suggested_role").default('gallery'),
  status: text("status").notNull().default('pending'),
  errorMessage: text("error_message"),
  mediaId: uuid("media_id"),
  suggestedAltText: text("suggested_alt_text"),
  pageContext: text("page_context"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertCrawlMediaQueueSchema = createInsertSchema(crawlMediaQueue).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type CrawlMediaQueue = typeof crawlMediaQueue.$inferSelect;
export type InsertCrawlMediaQueue = z.infer<typeof insertCrawlMediaQueueSchema>;
