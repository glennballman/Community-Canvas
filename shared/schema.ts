import { pgTable, text, serial, timestamp, jsonb, integer, uuid, pgEnum, boolean, numeric, date, time, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENTITY KIND ENUM - For polymorphic entity links
// ============================================================================
export const entityKindEnum = pgEnum('entity_kind', [
  'contractor',
  'dock',
  'project',
  'community',
  'moorage',
  'parking',
  'infrastructure',
  'organization',
  'asset',
  'equipment',
  'service',
  'person',
  'article',
  'presentation',
  'reservation',
  'trip',
  'accommodation',
  'place',
  'property',
  'vehicle',
  'trailer',
  'portal',
  'tenant',
  'user',
  'reservation',
  'work_request',
  'shared_run',
  'media',
]);

// TypeScript type for entity kind values
export type EntityKind = (typeof entityKindEnum.enumValues)[number];

// Zod schema for entity kind validation
export const entityKindSchema = z.enum(entityKindEnum.enumValues);

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
// Note: entityType is text in DB for flexibility, but validated via entityKindSchema
export const entityMedia = pgTable("cc_entity_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaId: uuid("media_id").notNull(),
  entityType: text("entity_type").notNull(), // Validated via entityKindSchema
  entityId: uuid("entity_id").notNull(),
  role: text("role").notNull().default('gallery'),
  sortOrder: integer("sort_order").default(0),
  portalId: uuid("portal_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEntityMediaSchema = createInsertSchema(entityMedia).omit({
  id: true,
  createdAt: true,
}).extend({
  entityType: entityKindSchema, // Type-safe validation
});

export type EntityMedia = typeof entityMedia.$inferSelect;
export type InsertEntityMedia = z.infer<typeof insertEntityMediaSchema>;

// Crawl Media Queue
// Note: entityType is text in DB for flexibility, but validated via entityKindSchema
export const crawlMediaQueue = pgTable("cc_crawl_media_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourcePageUrl: text("source_page_url"),
  crawlJobId: uuid("crawl_job_id"),
  entityType: text("entity_type"), // Validated via entityKindSchema (optional)
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
}).extend({
  entityType: entityKindSchema.optional(), // Type-safe validation (optional field)
});

export type CrawlMediaQueue = typeof crawlMediaQueue.$inferSelect;
export type InsertCrawlMediaQueue = z.infer<typeof insertCrawlMediaQueueSchema>;

// ============================================================================
// EXPEDITION ENGINE - TRIP SYSTEM
// ============================================================================

// Trips (main container)
export const ccTrips = pgTable('cc_trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: varchar('trip_id'),
  customTrip: boolean('custom_trip'),
  leadParticipantId: uuid('lead_participant_id'),
  groupName: varchar('group_name'),
  groupSize: integer('group_size'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  flexibleDates: boolean('flexible_dates'),
  budgetLevel: varchar('budget_level'),
  estimatedCost: numeric('estimated_cost'),
  status: varchar('status'),
  participantAssessmentComplete: boolean('participant_assessment_complete'),
  vehicleAssessmentComplete: boolean('vehicle_assessment_complete'),
  equipmentGapsIdentified: boolean('equipment_gaps_identified'),
  skillGapsIdentified: boolean('skill_gaps_identified'),
  allRequirementsMet: boolean('all_requirements_met'),
  monitoringActive: boolean('monitoring_active'),
  lastConditionsCheck: timestamp('last_conditions_check', { withTimezone: true }),
  currentAlertLevel: varchar('current_alert_level'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  
  // Expedition fields
  portalId: uuid('portal_id'),
  tenantId: uuid('tenant_id'),
  accessCode: varchar('access_code').unique(),
  
  primaryContactName: varchar('primary_contact_name'),
  primaryContactEmail: varchar('primary_contact_email'),
  primaryContactPhone: varchar('primary_contact_phone'),
  
  originName: varchar('origin_name'),
  originType: varchar('origin_type'),
  originLat: numeric('origin_lat', { precision: 10, scale: 7 }),
  originLng: numeric('origin_lng', { precision: 10, scale: 7 }),
  
  hasVehicle: boolean('has_vehicle').default(true),
  hasTrailer: boolean('has_trailer').default(false),
  trailerType: varchar('trailer_type'),
  boatLengthFt: integer('boat_length_ft'),
  trailerLengthFt: integer('trailer_length_ft'),
  
  nextDestinationName: varchar('next_destination_name'),
  nextDestinationLat: numeric('next_destination_lat', { precision: 10, scale: 7 }),
  nextDestinationLng: numeric('next_destination_lng', { precision: 10, scale: 7 }),
  nextDestinationEmail: varchar('next_destination_email'),
  nextDestinationPhone: varchar('next_destination_phone'),
  coordinateHandoff: boolean('coordinate_handoff').default(false),
});

export const insertTripSchema = createInsertSchema(ccTrips).omit({ id: true, createdAt: true, updatedAt: true });
export type Trip = typeof ccTrips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

// Trip Itinerary Items (calendar events)
export const ccTripItineraryItems = pgTable('cc_trip_itinerary_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => ccTrips.id, { onDelete: 'cascade' }),
  
  itemType: varchar('item_type').notNull(),
  title: varchar('title').notNull(),
  description: text('description'),
  
  isReserved: boolean('is_reserved').notNull().default(false),
  reservationId: uuid('reservation_id'),
  
  status: varchar('status').notNull().default('idea'),
  
  dayDate: date('day_date').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  allDay: boolean('all_day').default(false),
  
  everyone: boolean('everyone').default(true),
  assignedParticipantIds: uuid('assigned_participant_ids').array(),
  
  locationName: varchar('location_name'),
  locationLat: numeric('location_lat', { precision: 10, scale: 7 }),
  locationLng: numeric('location_lng', { precision: 10, scale: 7 }),
  
  weatherSensitive: boolean('weather_sensitive').default(false),
  indoorAlternative: text('indoor_alternative'),
  
  photoMoment: boolean('photo_moment').default(false),
  suggestedCaption: text('suggested_caption'),
  
  externalUrl: text('external_url'),
  externalReservationRef: varchar('external_reservation_ref'),
  
  icon: varchar('icon'),
  color: varchar('color'),
  sortOrder: integer('sort_order').default(0),
  
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripItineraryItemSchema = createInsertSchema(ccTripItineraryItems).omit({ id: true, createdAt: true, updatedAt: true });
export type TripItineraryItem = typeof ccTripItineraryItems.$inferSelect;
export type InsertTripItineraryItem = z.infer<typeof insertTripItineraryItemSchema>;

// Trip Timepoints (operational anchors)
export const ccTripTimepoints = pgTable('cc_trip_timepoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => ccTrips.id, { onDelete: 'cascade' }),
  
  kind: varchar('kind').notNull(),
  
  timeExact: timestamp('time_exact', { withTimezone: true }),
  timeWindowStart: timestamp('time_window_start', { withTimezone: true }),
  timeWindowEnd: timestamp('time_window_end', { withTimezone: true }),
  timeConfidence: varchar('time_confidence').notNull().default('window'),
  
  locationName: varchar('location_name'),
  locationLat: numeric('location_lat', { precision: 10, scale: 7 }),
  locationLng: numeric('location_lng', { precision: 10, scale: 7 }),
  
  staffAction: text('staff_action'),
  staffAssignedTo: uuid('staff_assigned_to'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by'),
  
  guestNotes: text('guest_notes'),
  internalNotes: text('internal_notes'),
  
  itineraryItemId: uuid('itinerary_item_id').references(() => ccTripItineraryItems.id, { onDelete: 'set null' }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripTimepointSchema = createInsertSchema(ccTripTimepoints).omit({ id: true, createdAt: true, updatedAt: true });
export type TripTimepoint = typeof ccTripTimepoints.$inferSelect;
export type InsertTripTimepoint = z.infer<typeof insertTripTimepointSchema>;

// Portal Moments (curated fun suggestions)
export const ccPortalMoments = pgTable('cc_portal_moments', {
  id: uuid('id').primaryKey().defaultRandom(),
  portalId: uuid('portal_id').notNull(),
  
  title: varchar('title').notNull(),
  description: text('description'),
  momentType: varchar('moment_type').notNull(),
  
  bestTimeOfDay: varchar('best_time_of_day'),
  bestWeather: varchar('best_weather'),
  
  locationName: varchar('location_name'),
  locationLat: numeric('location_lat', { precision: 10, scale: 7 }),
  locationLng: numeric('location_lng', { precision: 10, scale: 7 }),
  
  kidFriendly: boolean('kid_friendly').default(true),
  
  proTip: text('pro_tip'),
  safetyNote: text('safety_note'),
  
  photoMoment: boolean('photo_moment').default(true),
  suggestedCaption: text('suggested_caption'),
  
  imageUrl: text('image_url'),
  icon: varchar('icon'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortalMomentSchema = createInsertSchema(ccPortalMoments).omit({ id: true, createdAt: true });
export type PortalMoment = typeof ccPortalMoments.$inferSelect;
export type InsertPortalMoment = z.infer<typeof insertPortalMomentSchema>;
