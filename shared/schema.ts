import { pgTable, text, serial, timestamp, jsonb, integer, uuid, pgEnum, boolean, numeric, date, time, varchar, primaryKey, char, index, uniqueIndex, bigint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  
  // Cart-first reservation fields (added 074)
  tripType: varchar('trip_type').default('leisure'),
  expectedAdults: integer('expected_adults').default(1),
  expectedChildren: integer('expected_children').default(0),
  expectedInfants: integer('expected_infants').default(0),
  intentJson: jsonb('intent_json').default({}),
  needsJson: jsonb('needs_json').default({}),
  budgetJson: jsonb('budget_json').default({}),
  viralJson: jsonb('viral_json').default({}),
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

// Portal Moments (reservable experiences)
export const ccPortalMoments = pgTable('cc_portal_moments', {
  id: uuid('id').primaryKey().defaultRandom(),
  portalId: uuid('portal_id').notNull(),
  tenantId: uuid('tenant_id'),
  
  slug: varchar('slug').notNull(),
  title: varchar('title').notNull(),
  subtitle: varchar('subtitle'),
  description: text('description'),
  momentType: varchar('moment_type').notNull(),
  
  category: varchar('category'),
  tags: text('tags').array(),
  
  imageUrl: text('image_url'),
  galleryUrls: text('gallery_urls').array(),
  videoUrl: text('video_url'),
  
  durationMinutes: integer('duration_minutes'),
  availableDays: integer('available_days').array(),
  availableStartTime: time('available_start_time'),
  availableEndTime: time('available_end_time'),
  advanceReservationDays: integer('advance_reservation_days').default(1),
  maxAdvanceDays: integer('max_advance_days').default(90),
  
  minParticipants: integer('min_participants').default(1),
  maxParticipants: integer('max_participants'),
  minAge: integer('min_age'),
  
  priceCents: integer('price_cents'),
  pricePer: varchar('price_per').default('person'),
  currency: varchar('currency').default('CAD'),
  depositPercent: integer('deposit_percent').default(25),
  
  reservationMode: varchar('reservation_mode').default('internal'),
  facilityId: uuid('facility_id'),
  offerId: uuid('offer_id'),
  
  providerName: varchar('provider_name'),
  providerEmail: varchar('provider_email'),
  providerPhone: varchar('provider_phone'),
  externalReservationUrl: text('external_reservation_url'),
  
  weatherJson: jsonb('weather_json').default({}),
  constraintsJson: jsonb('constraints_json').default({}),
  
  schemaType: varchar('schema_type').default('Event'),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  
  isFeatured: boolean('is_featured').default(false),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
  
  // Legacy fields
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
  icon: varchar('icon'),
  sortOrder: integer('sort_order').default(0),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertPortalMomentSchema = createInsertSchema(ccPortalMoments).omit({ id: true, createdAt: true, updatedAt: true });
export type PortalMoment = typeof ccPortalMoments.$inferSelect;
export type InsertPortalMoment = z.infer<typeof insertPortalMomentSchema>;

// Moment Availability (specific time slots)
export const ccMomentAvailability = pgTable('cc_moment_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  momentId: uuid('moment_id').notNull().references(() => ccPortalMoments.id, { onDelete: 'cascade' }),
  
  availableDate: date('available_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time'),
  
  spotsTotal: integer('spots_total').notNull(),
  spotsRemaining: integer('spots_remaining').notNull(),
  
  priceCentsOverride: integer('price_cents_override'),
  
  status: varchar('status').default('available'),
  notes: text('notes'),
  weatherNotes: text('weather_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertMomentAvailabilitySchema = createInsertSchema(ccMomentAvailability).omit({ id: true, createdAt: true });
export type MomentAvailability = typeof ccMomentAvailability.$inferSelect;
export type InsertMomentAvailability = z.infer<typeof insertMomentAvailabilitySchema>;

// Trip Party Profiles (individual members with needs)
export const ccTripPartyProfiles = pgTable('cc_trip_party_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => ccTrips.id, { onDelete: 'cascade' }),
  partyId: uuid('party_id'),
  
  displayName: varchar('display_name').notNull(),
  role: varchar('role').default('guest'),
  
  ageGroup: varchar('age_group'),
  birthDate: date('birth_date'),
  
  email: varchar('email'),
  phone: varchar('phone'),
  
  invitationId: uuid('invitation_id'),
  
  dietaryRestrictions: text('dietary_restrictions').array(),
  dietaryPreferences: text('dietary_preferences').array(),
  dietarySeverity: varchar('dietary_severity').default('preference'),
  dietaryNotes: text('dietary_notes'),
  
  accessibilityJson: jsonb('accessibility_json').default({}),
  medicalJson: jsonb('medical_json').default({}),
  needsJson: jsonb('needs_json').default({}),
  preferencesJson: jsonb('preferences_json').default({}),
  surprisesJson: jsonb('surprises_json').default({}),
  
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripPartyProfileSchema = createInsertSchema(ccTripPartyProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type TripPartyProfile = typeof ccTripPartyProfiles.$inferSelect;
export type InsertTripPartyProfile = z.infer<typeof insertTripPartyProfileSchema>;

// Dietary Lookup (common dietary terms for autocomplete)
export const ccDietaryLookup = pgTable('cc_dietary_lookup', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  term: varchar('term').notNull().unique(),
  category: varchar('category').notNull(),
  severityDefault: varchar('severity_default').default('preference'),
  description: text('description'),
  commonIn: text('common_in').array(),
  
  displayOrder: integer('display_order').default(0),
});

export const insertDietaryLookupSchema = createInsertSchema(ccDietaryLookup).omit({ id: true });
export type DietaryLookup = typeof ccDietaryLookup.$inferSelect;
export type InsertDietaryLookup = z.infer<typeof insertDietaryLookupSchema>;

// Trip Handoffs (passing guests between properties)
export const ccTripHandoffs = pgTable('cc_trip_handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => ccTrips.id, { onDelete: 'cascade' }),
  
  fromPortalId: uuid('from_portal_id'),
  fromTenantId: uuid('from_tenant_id'),
  
  nextDestinationName: varchar('next_destination_name').notNull(),
  nextDestinationAddress: text('next_destination_address'),
  nextDestinationPhone: varchar('next_destination_phone'),
  nextDestinationEmail: varchar('next_destination_email'),
  nextDestinationPortalId: uuid('next_destination_portal_id'),
  
  plannedDepartureDate: date('planned_departure_date'),
  plannedDepartureTime: time('planned_departure_time'),
  actualDepartureAt: timestamp('actual_departure_at', { withTimezone: true }),
  
  transportMode: varchar('transport_mode'),
  transportDetails: text('transport_details'),
  transportReservationRef: varchar('transport_reservation_ref'),
  
  consentShareDietary: boolean('consent_share_dietary').default(false),
  consentShareAccessibility: boolean('consent_share_accessibility').default(false),
  consentShareMedical: boolean('consent_share_medical').default(false),
  consentSharePreferences: boolean('consent_share_preferences').default(false),
  
  needsSnapshot: jsonb('needs_snapshot').default({}),
  
  notesForNext: text('notes_for_next'),
  specialArrangements: text('special_arrangements'),
  
  partnerInvitationId: uuid('partner_invitation_id'),
  partnerInvitationSent: boolean('partner_invitation_sent').default(false),
  partnerInvitationSentAt: timestamp('partner_invitation_sent_at', { withTimezone: true }),
  partnerAccepted: boolean('partner_accepted').default(false),
  partnerAcceptedAt: timestamp('partner_accepted_at', { withTimezone: true }),
  
  status: varchar('status').default('draft'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripHandoffSchema = createInsertSchema(ccTripHandoffs).omit({ id: true, createdAt: true, updatedAt: true });
export type TripHandoff = typeof ccTripHandoffs.$inferSelect;
export type InsertTripHandoff = z.infer<typeof insertTripHandoffSchema>;

// Trip Alerts (weather, travel, operational alerts)
export const ccTripAlerts = pgTable('cc_trip_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => ccTrips.id, { onDelete: 'cascade' }),
  
  alertType: varchar('alert_type').notNull(),
  severity: varchar('severity').notNull().default('info'),
  
  title: varchar('title').notNull(),
  message: text('message').notNull(),
  actionRequired: boolean('action_required').default(false),
  actionUrl: text('action_url'),
  actionLabel: varchar('action_label'),
  
  relatedItemId: uuid('related_item_id'),
  relatedItemType: varchar('related_item_type'),
  affectedDate: date('affected_date'),
  
  source: varchar('source').default('system'),
  sourceRef: varchar('source_ref'),
  
  status: varchar('status').default('active'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: varchar('acknowledged_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripAlertSchema = createInsertSchema(ccTripAlerts).omit({ id: true, createdAt: true });
export type TripAlert = typeof ccTripAlerts.$inferSelect;
export type InsertTripAlert = z.infer<typeof insertTripAlertSchema>;

// ============================================================================
// V3.3.1 TRUTH/DISCLOSURE LAYER - Visibility System
// ============================================================================

// Channel enum - who is viewing
export const ccChannelEnum = pgEnum('cc_channel', [
  'internal_ops',
  'chamber_desk',
  'partner',
  'public'
]);

// Visibility mode enum - how much to show
export const ccVisibilityModeEnum = pgEnum('cc_visibility_mode', [
  'show_all',
  'show_percentage',
  'show_cap',
  'show_by_rules',
  'hide_all'
]);

// Asset visibility rule mode
export const ccAssetVisibilityRuleModeEnum = pgEnum('cc_asset_visibility_rule_mode', [
  'always_show',
  'always_hide',
  'conditional'
]);

// Participation mode for assets
export const ccParticipationModeEnum = pgEnum('cc_participation_mode', [
  'inventory_hidden',
  'requests_only',
  'manual_confirm',
  'instant_confirm'
]);

// Visibility Profiles - named configurations
export const cc_visibility_profiles = pgTable('cc_visibility_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  name: text('name').notNull(),
  
  defaultMode: ccVisibilityModeEnum('default_mode').notNull().default('show_all'),
  percentage: integer('percentage'),
  capCount: integer('cap_count'),
  
  safetyNeverSayNo: boolean('safety_never_say_no').notNull().default(false),
  surfaceSetTtlMinutes: integer('surface_set_ttl_minutes').notNull().default(1440),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertVisibilityProfileSchema = createInsertSchema(cc_visibility_profiles).omit({ id: true, createdAt: true, updatedAt: true });
export type VisibilityProfile = typeof cc_visibility_profiles.$inferSelect;
export type InsertVisibilityProfile = z.infer<typeof insertVisibilityProfileSchema>;

// Visibility Profile Windows - time-bound channel assignments
export const cc_visibility_profile_windows = pgTable('cc_visibility_profile_windows', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  profileId: uuid('profile_id').notNull(),
  
  channel: ccChannelEnum('channel').notNull(),
  windowStart: date('window_start').notNull(),
  windowEnd: date('window_end').notNull(),
  
  assetType: varchar('asset_type', { length: 64 }),
  portalId: uuid('portal_id'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertVisibilityProfileWindowSchema = createInsertSchema(cc_visibility_profile_windows).omit({ id: true, createdAt: true });
export type VisibilityProfileWindow = typeof cc_visibility_profile_windows.$inferSelect;
export type InsertVisibilityProfileWindow = z.infer<typeof insertVisibilityProfileWindowSchema>;

// Asset Groups - logical groupings for bulk rules
export const cc_asset_groups = pgTable('cc_asset_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssetGroupSchema = createInsertSchema(cc_asset_groups).omit({ id: true, createdAt: true });
export type AssetGroup = typeof cc_asset_groups.$inferSelect;
export type InsertAssetGroup = z.infer<typeof insertAssetGroupSchema>;

// Asset Group Members - many-to-many link (polymorphic via member_type)
export const cc_asset_group_members = pgTable('cc_asset_group_members', {
  groupId: uuid('group_id').notNull(),
  assetId: uuid('asset_id').notNull(),
  memberType: text('member_type').notNull().default('asset'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.groupId, t.assetId, t.memberType] }),
}));

export type AssetGroupMember = typeof cc_asset_group_members.$inferSelect;
export const insertAssetGroupMemberSchema = createInsertSchema(cc_asset_group_members).omit({ createdAt: true });
export type InsertAssetGroupMember = z.infer<typeof insertAssetGroupMemberSchema>;

// Asset Visibility Rules - per-asset/group/type overrides
export const cc_asset_visibility_rules = pgTable('cc_asset_visibility_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  channel: ccChannelEnum('channel').notNull(),
  
  assetId: uuid('asset_id'),
  assetGroupId: uuid('asset_group_id'),
  assetType: varchar('asset_type', { length: 64 }),
  
  mode: ccAssetVisibilityRuleModeEnum('mode').notNull(),
  condition: jsonb('condition'),
  priority: integer('priority').notNull().default(100),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssetVisibilityRuleSchema = createInsertSchema(cc_asset_visibility_rules).omit({ id: true, createdAt: true });
export type AssetVisibilityRule = typeof cc_asset_visibility_rules.$inferSelect;
export type InsertAssetVisibilityRule = z.infer<typeof insertAssetVisibilityRuleSchema>;

// Disclosure Surface Sets - computed/cached visible assets
export const cc_disclosure_surface_sets = pgTable('cc_disclosure_surface_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  profileId: uuid('profile_id').notNull(),
  channel: ccChannelEnum('channel').notNull(),
  
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  assetType: varchar('asset_type', { length: 64 }),
  
  surfacedAssetIds: uuid('surfaced_asset_ids').array().notNull(),
  
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  reason: text('reason'),
});

export const insertDisclosureSurfaceSetSchema = createInsertSchema(cc_disclosure_surface_sets).omit({ id: true, computedAt: true });
export type DisclosureSurfaceSet = typeof cc_disclosure_surface_sets.$inferSelect;
export type InsertDisclosureSurfaceSet = z.infer<typeof insertDisclosureSurfaceSetSchema>;

// ============================================================================
// V3.3.1 BLOCK 02 - Payment Abstraction + Federation
// ============================================================================

// Payment References - external payment tracking (CC never processes payments)
export const cc_payment_references = pgTable('cc_payment_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  reservationId: uuid('reservation_id').notNull(),
  
  providerName: text('provider_name').notNull(),
  externalReference: text('external_reference'),
  
  amountCents: integer('amount_cents').notNull(),
  currency: char('currency', { length: 3 }).default('CAD'),
  
  status: text('status').notNull().default('recorded'),
  
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  recordedBy: uuid('recorded_by'),
  notes: text('notes'),
});

export const insertPaymentReferenceSchema = createInsertSchema(cc_payment_references).omit({ id: true, recordedAt: true });
export type PaymentReference = typeof cc_payment_references.$inferSelect;
export type InsertPaymentReference = z.infer<typeof insertPaymentReferenceSchema>;

// Federation Agreements - cross-tenant resource sharing
export const cc_federation_agreements = pgTable('cc_federation_agreements', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  providerTenantId: uuid('provider_tenant_id').notNull(),
  communityId: uuid('community_id').notNull(),
  consumerTenantId: uuid('consumer_tenant_id'),
  
  scopes: text('scopes').array().notNull().default([]),
  
  shareAvailability: boolean('share_availability').default(false),
  allowReservationRequests: boolean('allow_reservation_requests').default(true),
  allowIncidentOps: boolean('allow_incident_ops').default(false),
  anonymizePublic: boolean('anonymize_public').default(true),
  requiresProviderConfirmation: boolean('requires_provider_confirmation').default(true),
  
  status: text('status').notNull().default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertFederationAgreementSchema = createInsertSchema(cc_federation_agreements).omit({ id: true, createdAt: true, updatedAt: true });
export type FederationAgreement = typeof cc_federation_agreements.$inferSelect;
export type InsertFederationAgreement = z.infer<typeof insertFederationAgreementSchema>;

// Activity Ledger - audit trail for all significant actions
export const cc_activity_ledger = pgTable('cc_activity_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  tenantId: uuid('tenant_id'),
  communityId: uuid('community_id'),
  
  actorIdentityId: uuid('actor_identity_id'),
  actorTenantId: uuid('actor_tenant_id'),
  
  action: varchar('action', { length: 128 }).notNull(),
  
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  
  correlationId: uuid('correlation_id'),
  
  payload: jsonb('payload').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLedgerSchema = createInsertSchema(cc_activity_ledger).omit({ id: true, createdAt: true });
export type ActivityLedger = typeof cc_activity_ledger.$inferSelect;
export type InsertActivityLedger = z.infer<typeof insertActivityLedgerSchema>;

// ============================================================================
// V3.3.1 BLOCK 03 - Facilities + Inventory Units
// ============================================================================

// Facilities - physical locations with inventory
export const cc_facilities = pgTable('cc_facilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  communityId: uuid('community_id'),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  facilityType: varchar('facility_type', { length: 32 }).notNull(),
  
  addressJson: jsonb('address_json'),
  geoLat: numeric('geo_lat', { precision: 10, scale: 7 }),
  geoLon: numeric('geo_lon', { precision: 10, scale: 7 }),
  boundaryJson: jsonb('boundary_json'),
  
  allocationMode: varchar('allocation_mode', { length: 32 }).notNull(),
  capacityUnit: varchar('capacity_unit', { length: 32 }),
  capacityTotal: integer('capacity_total'),
  
  timezone: varchar('timezone', { length: 64 }).default('America/Vancouver'),
  openingHours: jsonb('opening_hours'),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertFacilitySchema = createInsertSchema(cc_facilities).omit({ id: true, createdAt: true, updatedAt: true });
export type Facility = typeof cc_facilities.$inferSelect;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;

// Inventory Units - individual bookable units within facilities
export const cc_inventory_units = pgTable('cc_inventory_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  facilityId: uuid('facility_id').notNull(),
  
  unitType: varchar('unit_type', { length: 32 }).notNull(),
  displayLabel: varchar('display_label', { length: 100 }).notNull(),
  
  parentUnitId: uuid('parent_unit_id'),
  sortOrder: integer('sort_order'),
  
  lengthFt: numeric('length_ft', { precision: 8, scale: 2 }),
  widthFt: numeric('width_ft', { precision: 8, scale: 2 }),
  depthFt: numeric('depth_ft', { precision: 8, scale: 2 }),
  
  capacityTotal: numeric('capacity_total', { precision: 10, scale: 2 }),
  capacityBuffer: numeric('capacity_buffer', { precision: 10, scale: 2 }).default('0'),
  
  constraints: jsonb('constraints').default({}),
  capabilities: jsonb('capabilities').default({}),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertInventoryUnitSchema = createInsertSchema(cc_inventory_units).omit({ id: true, createdAt: true, updatedAt: true });
export type InventoryUnit = typeof cc_inventory_units.$inferSelect;
export type InsertInventoryUnit = z.infer<typeof insertInventoryUnitSchema>;

// ============================================================================
// V3.3.1 BLOCK 04 - Offers + Rate Rules + Tax Integration
// ============================================================================

// Offers - pricing products for facilities
export const cc_offers = pgTable('cc_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  facilityId: uuid('facility_id').notNull(),
  
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  offerType: varchar('offer_type', { length: 32 }).notNull(),
  participationMode: ccParticipationModeEnum('participation_mode').notNull().default('requests_only'),
  
  priceCents: integer('price_cents').notNull(),
  currency: char('currency', { length: 3 }).default('CAD'),
  
  durationType: varchar('duration_type', { length: 16 }),
  durationValue: integer('duration_value').default(1),
  
  taxCategoryCode: varchar('tax_category_code', { length: 64 }).notNull(),
  
  appliesToUnitTypes: varchar('applies_to_unit_types', { length: 32 }).array(),
  constraints: jsonb('constraints').default({}),
  
  isAddon: boolean('is_addon').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertOfferSchema = createInsertSchema(cc_offers).omit({ id: true, createdAt: true, updatedAt: true });
export type Offer = typeof cc_offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;

// Rate Rules - dynamic pricing adjustments
export const cc_rate_rules = pgTable('cc_rate_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  offerId: uuid('offer_id').notNull(),
  
  ruleName: varchar('rule_name', { length: 100 }).notNull(),
  ruleType: varchar('rule_type', { length: 32 }).notNull(),
  
  conditions: jsonb('conditions').notNull().default({}),
  
  adjustmentType: varchar('adjustment_type', { length: 16 }).notNull(),
  adjustmentValue: numeric('adjustment_value', { precision: 10, scale: 4 }).notNull(),
  
  priority: integer('priority').notNull().default(100),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertRateRuleSchema = createInsertSchema(cc_rate_rules).omit({ id: true, createdAt: true });
export type RateRule = typeof cc_rate_rules.$inferSelect;
export type InsertRateRule = z.infer<typeof insertRateRuleSchema>;

// Tax Rules - tax configuration by category
export const cc_tax_rules = pgTable('cc_tax_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  taxCategoryCode: varchar('tax_category_code', { length: 64 }).notNull(),
  taxName: varchar('tax_name', { length: 32 }).notNull(),
  
  ratePercent: numeric('rate_percent', { precision: 6, scale: 4 }).notNull(),
  
  appliesAfter: timestamp('applies_after', { withTimezone: true }),
  minNights: integer('min_nights'),
  
  isCompound: boolean('is_compound').default(false),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertTaxRuleSchema = createInsertSchema(cc_tax_rules).omit({ id: true, createdAt: true });
export type TaxRule = typeof cc_tax_rules.$inferSelect;
export type InsertTaxRule = z.infer<typeof insertTaxRuleSchema>;

// ============================================================================
// V3.3.1 BLOCK 05 - Reservation Items + Allocations
// ============================================================================

// Reservation Items - line items within a reservation
export const cc_reservation_items = pgTable('cc_reservation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  reservationId: uuid('reservation_id').notNull(),
  
  offerId: uuid('offer_id').notNull(),
  facilityId: uuid('facility_id').notNull(),
  
  quantity: integer('quantity').notNull().default(1),
  unitId: uuid('unit_id'),
  
  basePriceCents: integer('base_price_cents').notNull(),
  adjustmentsJson: jsonb('adjustments_json').default([]),
  subtotalCents: integer('subtotal_cents').notNull(),
  taxesJson: jsonb('taxes_json').default([]),
  totalCents: integer('total_cents').notNull(),
  
  lengthFt: numeric('length_ft', { precision: 8, scale: 2 }),
  
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertReservationItemSchema = createInsertSchema(cc_reservation_items).omit({ id: true, createdAt: true, updatedAt: true });
export type ReservationItem = typeof cc_reservation_items.$inferSelect;
export type InsertReservationItem = z.infer<typeof insertReservationItemSchema>;

// Reservation Allocations - unit assignments with hold mechanics
export const cc_reservation_allocations = pgTable('cc_reservation_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  reservationItemId: uuid('reservation_item_id').notNull(),
  inventoryUnitId: uuid('inventory_unit_id').notNull(),
  
  allocatedLengthFt: numeric('allocated_length_ft', { precision: 8, scale: 2 }),
  positionStartFt: numeric('position_start_ft', { precision: 8, scale: 2 }),
  
  displayLabel: varchar('display_label', { length: 100 }).notNull(),
  
  holdType: varchar('hold_type', { length: 10 }).notNull(),
  holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
  
  // B1.2: Time window for availability
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  unitId: uuid('unit_id'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertReservationAllocationSchema = createInsertSchema(cc_reservation_allocations).omit({ id: true, createdAt: true });
export type ReservationAllocation = typeof cc_reservation_allocations.$inferSelect;
export type InsertReservationAllocation = z.infer<typeof insertReservationAllocationSchema>;

// Daily Sequences - for confirmation number generation
export const cc_daily_sequences = pgTable('cc_daily_sequences', {
  tenantId: uuid('tenant_id').notNull(),
  sequenceDate: date('sequence_date').notNull(),
  sequenceType: varchar('sequence_type', { length: 32 }).notNull().default('reservation'),
  currentValue: integer('current_value').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.sequenceDate, t.sequenceType] }),
}));

export type DailySequence = typeof cc_daily_sequences.$inferSelect;

// ============================================================================
// V3.3.1 BLOCK 11 - Access Credentials + Events
// ============================================================================

// Access Credentials - QR codes, short codes, gate codes for reservations
export const cc_access_credentials = pgTable('cc_access_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  reservationId: uuid('reservation_id').notNull(),
  reservationItemId: uuid('reservation_item_id'),
  
  credentialType: varchar('credential_type', { length: 30 }).notNull(),
  
  qrToken: varchar('qr_token', { length: 255 }),
  shortCode: varchar('short_code', { length: 10 }),
  gateCode: varchar('gate_code', { length: 20 }),
  
  scope: varchar('scope', { length: 30 }).notNull(),
  
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  
  isRevoked: boolean('is_revoked').default(false),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  revokedReason: varchar('revoked_reason', { length: 255 }),
  
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow(),
  issuedBy: uuid('issued_by'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertAccessCredentialSchema = createInsertSchema(cc_access_credentials).omit({ id: true, createdAt: true, issuedAt: true });
export type AccessCredential = typeof cc_access_credentials.$inferSelect;
export type InsertAccessCredential = z.infer<typeof insertAccessCredentialSchema>;

// Access Events - validation attempts, check-ins, gate operations
export const cc_access_events = pgTable('cc_access_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  credentialId: uuid('credential_id'),
  facilityId: uuid('facility_id'),
  inventoryUnitId: uuid('inventory_unit_id'),
  
  eventType: varchar('event_type', { length: 30 }).notNull(),
  result: varchar('result', { length: 30 }).notNull(),
  
  validationMethod: varchar('validation_method', { length: 30 }),
  actorId: uuid('actor_id'),
  deviceId: varchar('device_id', { length: 100 }),
  
  metadata: jsonb('metadata').default({}),
  
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow(),
});

export const insertAccessEventSchema = createInsertSchema(cc_access_events).omit({ id: true, recordedAt: true });
export type AccessEvent = typeof cc_access_events.$inferSelect;
export type InsertAccessEvent = z.infer<typeof insertAccessEventSchema>;

// ============================================================================
// 30-PROMPT PACK - PROMPT 01: Cart Foundation Tables
// ============================================================================

// Reservation Carts - shopping cart for multi-item reservations
export const cc_reservation_carts = pgTable('cc_reservation_carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  schemaType: varchar('schema_type', { length: 50 }).default('Order'),
  
  portalId: uuid('portal_id'),
  tenantId: uuid('tenant_id'),
  tripId: uuid('trip_id'),
  
  accessToken: varchar('access_token', { length: 255 }).notNull().unique(),
  
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  primaryGuestName: varchar('primary_guest_name', { length: 255 }),
  primaryGuestEmail: varchar('primary_guest_email', { length: 255 }),
  primaryGuestPhone: varchar('primary_guest_phone', { length: 50 }),
  guestLanguage: varchar('guest_language', { length: 10 }).default('en'),
  
  partyAdults: integer('party_adults').default(1),
  partyChildren: integer('party_children').default(0),
  partyInfants: integer('party_infants').default(0),
  
  intentJson: jsonb('intent_json').default({}),
  needsJson: jsonb('needs_json').default({}),
  paymentJson: jsonb('payment_json').default({}),
  travelJson: jsonb('travel_json').default({}),
  viralJson: jsonb('viral_json').default({}),
  quoteJson: jsonb('quote_json').default({}),
  
  source: varchar('source', { length: 50 }).default('public'),
  sourceRef: varchar('source_ref', { length: 255 }),
  entryPoint: varchar('entry_point', { length: 255 }),
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertReservationCartSchema = createInsertSchema(cc_reservation_carts).omit({ id: true, createdAt: true, updatedAt: true });
export type ReservationCart = typeof cc_reservation_carts.$inferSelect;
export type InsertReservationCart = z.infer<typeof insertReservationCartSchema>;

// Reservation Cart Items - individual items within a cart
export const cc_reservation_cart_items = pgTable('cc_reservation_cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').notNull(),
  
  schemaType: varchar('schema_type', { length: 50 }).default('Offer'),
  
  itemType: varchar('item_type', { length: 30 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  reservationMode: varchar('reservation_mode', { length: 20 }).notNull().default('internal'),
  
  facilityId: uuid('facility_id'),
  offerId: uuid('offer_id'),
  unitId: uuid('unit_id'),
  assetId: uuid('asset_id'),
  momentId: uuid('moment_id'),
  providerTenantId: uuid('provider_tenant_id'),
  portalId: uuid('portal_id'),
  
  externalUrl: text('external_url'),
  externalReservationRef: varchar('external_reservation_ref', { length: 255 }),
  providerName: varchar('provider_name', { length: 255 }),
  providerEmail: varchar('provider_email', { length: 255 }),
  providerPhone: varchar('provider_phone', { length: 50 }),
  
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  preferredTime: time('preferred_time'),
  flexibleWindowMinutes: integer('flexible_window_minutes'),
  
  quantity: integer('quantity').default(1),
  partySize: integer('party_size'),
  
  requiresApproval: boolean('requires_approval').notNull().default(false),
  approvalStatus: varchar('approval_status', { length: 20 }).notNull().default('not_required'),
  
  rateType: varchar('rate_type', { length: 50 }),
  rateAmount: numeric('rate_amount', { precision: 12, scale: 2 }),
  subtotalCents: integer('subtotal_cents'),
  taxesCents: integer('taxes_cents').default(0),
  totalCents: integer('total_cents'),
  depositRequiredCents: integer('deposit_required_cents').default(0),
  
  pricingSnapshot: jsonb('pricing_snapshot').default({}),
  holdJson: jsonb('hold_json').default({}),
  intentJson: jsonb('intent_json').default({}),
  needsJson: jsonb('needs_json').default({}),
  dietaryRequirements: text('dietary_requirements').array(),
  specialRequests: text('special_requests'),
  weatherJson: jsonb('weather_json').default({}),
  
  reservationId: uuid('reservation_id'),
  reservationItemId: uuid('reservation_item_id'),
  partnerRequestId: uuid('partner_request_id'),
  itineraryItemId: uuid('itinerary_item_id'),
  
  // Transport integration fields
  transportRequestId: uuid('transport_request_id'),
  transportType: varchar('transport_type', { length: 50 }),
  transportDetailsJson: jsonb('transport_details_json').default({}),
  
  status: varchar('status', { length: 30 }).default('pending'),
  
  requirementsSnapshot: jsonb('requirements_snapshot').default({}),
  detailsJson: jsonb('details_json').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertReservationCartItemSchema = createInsertSchema(cc_reservation_cart_items).omit({ id: true, createdAt: true, updatedAt: true });
export type ReservationCartItem = typeof cc_reservation_cart_items.$inferSelect;
export type InsertReservationCartItem = z.infer<typeof insertReservationCartItemSchema>;

// Reservation Cart Adjustments - discounts, fees, credits
export const cc_reservation_cart_adjustments = pgTable('cc_reservation_cart_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').notNull(),
  
  label: varchar('label', { length: 255 }).notNull(),
  adjustmentType: varchar('adjustment_type', { length: 30 }).notNull().default('discount'),
  
  amountCents: integer('amount_cents').notNull(),
  scope: varchar('scope', { length: 20 }).notNull().default('cart'),
  itemId: uuid('item_id'),
  
  ruleCode: varchar('rule_code', { length: 100 }),
  rulesSnapshot: jsonb('rules_snapshot').default({}),
  isTaxable: boolean('is_taxable').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertReservationCartAdjustmentSchema = createInsertSchema(cc_reservation_cart_adjustments).omit({ id: true, createdAt: true, updatedAt: true });
export type ReservationCartAdjustment = typeof cc_reservation_cart_adjustments.$inferSelect;
export type InsertReservationCartAdjustment = z.infer<typeof insertReservationCartAdjustmentSchema>;

// Partner Reservation Requests - external partner coordination
export const cc_partner_reservation_requests = pgTable('cc_partner_reservation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  cartId: uuid('cart_id'),
  cartItemId: uuid('cart_item_id'),
  tripId: uuid('trip_id'),
  portalId: uuid('portal_id'),
  
  providerTenantId: uuid('provider_tenant_id'),
  providerName: varchar('provider_name', { length: 255 }),
  providerEmail: varchar('provider_email', { length: 255 }),
  providerPhone: varchar('provider_phone', { length: 50 }),
  
  requestType: varchar('request_type', { length: 30 }).notNull().default('reservation'),
  status: varchar('status', { length: 30 }).notNull().default('requested'),
  
  itemType: varchar('item_type', { length: 30 }),
  title: varchar('title', { length: 255 }),
  requestedStart: timestamp('requested_start', { withTimezone: true }),
  requestedEnd: timestamp('requested_end', { withTimezone: true }),
  preferredTime: time('preferred_time'),
  partySize: integer('party_size'),
  
  contactName: varchar('contact_name', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  
  needsJson: jsonb('needs_json').default({}),
  dietaryRequirements: text('dietary_requirements').array(),
  specialAccommodations: text('special_accommodations'),
  notes: text('notes'),
  
  providerConfirmationRef: varchar('provider_confirmation_ref', { length: 255 }),
  providerNotes: text('provider_notes'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  confirmedStart: timestamp('confirmed_start', { withTimezone: true }),
  confirmedEnd: timestamp('confirmed_end', { withTimezone: true }),
  
  partnerInvitationSent: boolean('partner_invitation_sent').default(false),
  partnerInvitationSentAt: timestamp('partner_invitation_sent_at', { withTimezone: true }),
  partnerOnboarded: boolean('partner_onboarded').default(false),
  
  detailsJson: jsonb('details_json').default({}),
  
  requestSentAt: timestamp('request_sent_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertPartnerReservationRequestSchema = createInsertSchema(cc_partner_reservation_requests).omit({ id: true, createdAt: true, updatedAt: true });
export type PartnerReservationRequest = typeof cc_partner_reservation_requests.$inferSelect;
export type InsertPartnerReservationRequest = z.infer<typeof insertPartnerReservationRequestSchema>;

// Weather Trends - historical weather data for planning
export const cc_weather_trends = pgTable('cc_weather_trends', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  locationCode: varchar('location_code', { length: 50 }).notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  region: varchar('region', { length: 100 }),
  
  month: integer('month').notNull(),
  
  avgHighC: numeric('avg_high_c', { precision: 5, scale: 2 }),
  avgLowC: numeric('avg_low_c', { precision: 5, scale: 2 }),
  precipDays: integer('precip_days'),
  rainProbPercent: integer('rain_prob_percent'),
  fogProbPercent: integer('fog_prob_percent'),
  windAvgKph: numeric('wind_avg_kph', { precision: 5, scale: 2 }),
  daylightHours: numeric('daylight_hours', { precision: 5, scale: 2 }),
  
  planningNotes: text('planning_notes'),
  bestFor: text('best_for').array(),
  avoidFor: text('avoid_for').array(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertWeatherTrendSchema = createInsertSchema(cc_weather_trends).omit({ id: true, createdAt: true, updatedAt: true });
export type WeatherTrend = typeof cc_weather_trends.$inferSelect;
export type InsertWeatherTrend = z.infer<typeof insertWeatherTrendSchema>;

// Trip Invitations - invite party members, planners, or next destinations
export const cc_trip_invitations = pgTable('cc_trip_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => ccTrips.id, { onDelete: 'cascade' }),
  
  invitationType: varchar('invitation_type', { length: 50 }).notNull(),
  
  token: varchar('token', { length: 50 }).notNull().unique(),
  
  recipientName: varchar('recipient_name', { length: 255 }),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  recipientPhone: varchar('recipient_phone', { length: 50 }),
  
  handoffId: uuid('handoff_id'),
  nextDestinationName: varchar('next_destination_name', { length: 255 }),
  
  messageSubject: varchar('message_subject', { length: 255 }),
  messageBody: text('message_body'),
  senderName: varchar('sender_name', { length: 255 }),
  
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  resultJson: jsonb('result_json').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertTripInvitationSchema = createInsertSchema(cc_trip_invitations).omit({ id: true, createdAt: true });
export type TripInvitation = typeof cc_trip_invitations.$inferSelect;
export type InsertTripInvitation = z.infer<typeof insertTripInvitationSchema>;

// Portals - multi-brand support within tenants
export const ccPortals = pgTable('cc_portals', {
  id: uuid('id').primaryKey().defaultRandom(),
  owningTenantId: uuid('owning_tenant_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: varchar('status', { length: 50 }).default('active'),
  primaryAudience: varchar('primary_audience', { length: 50 }),
  tagline: text('tagline'),
  description: text('description'),
  defaultLocale: text('default_locale').default('en'),
  defaultCurrency: text('default_currency').default('CAD'),
  supportedLocales: text('supported_locales').array(),
  defaultRoute: text('default_route'),
  onboardingFlowKey: text('onboarding_flow_key'),
  termsUrl: text('terms_url'),
  privacyUrl: text('privacy_url'),
  settings: jsonb('settings').default({}),
  portalType: text('portal_type'),
  legalDbaName: text('legal_dba_name'),
  baseUrl: text('base_url'),
  siteConfig: jsonb('site_config').default({}),
  isActive: boolean('is_active').default(true),
  defaultZoneId: uuid('default_zone_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Portal = typeof ccPortals.$inferSelect;
export type InsertPortal = typeof ccPortals.$inferInsert;

// ============ ZONES ============
// First-class zones scoped to portals for organizing Work Requests and Properties
export const ccZones = pgTable('cc_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  portalId: uuid('portal_id').notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('neighborhood'),
  badgeLabelResident: text('badge_label_resident'),
  badgeLabelContractor: text('badge_label_contractor'),
  badgeLabelVisitor: text('badge_label_visitor'),
  pricingModifiers: jsonb('pricing_modifiers').notNull().default({}),
  theme: jsonb('theme').notNull().default({}),
  accessProfile: jsonb('access_profile').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  portalKeyUnique: uniqueIndex('cc_zones_portal_key_unique').on(table.portalId, table.key),
  tenantPortalIdx: index('cc_zones_tenant_portal_idx').on(table.tenantId, table.portalId),
}));

export const insertZoneSchema = createInsertSchema(ccZones).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Zone = typeof ccZones.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;

// Locations - canonical registry of docks, marinas, trailheads, and stops
export const ccLocations = pgTable('cc_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  portalId: uuid('portal_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  
  locationType: text('location_type').notNull(),
  
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  region: varchar('region', { length: 255 }).default('Barkley Sound'),
  timezone: varchar('timezone', { length: 100 }).default('America/Vancouver'),
  
  addressLine1: text('address_line1'),
  addressCity: text('address_city'),
  addressProvince: varchar('address_province', { length: 10 }).default('BC'),
  addressPostalCode: varchar('address_postal_code', { length: 20 }),
  
  authorityType: varchar('authority_type', { length: 50 }),
  authorityName: text('authority_name'),
  authorityRules: jsonb('authority_rules').default({}),
  
  stopCapabilities: jsonb('stop_capabilities').default({
    passenger_embark: true,
    passenger_disembark: true,
    freight_load: false,
    freight_unload: false,
    kayak_landing: false,
    overnight_moorage: false,
    fuel_available: false,
    power_available: false,
    water_available: false,
    boat_launch: false
  }),
  
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  
  operatingHoursJson: jsonb('operating_hours_json').default({}),
  
  connectedLocations: uuid('connected_locations').array(),
  travelTimeMinutesJson: jsonb('travel_time_minutes_json').default({}),
  
  civosLocationId: uuid('civos_location_id'),
  
  imageUrl: text('image_url'),
  
  status: varchar('status', { length: 50 }).default('active'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertLocationSchema = createInsertSchema(ccLocations).omit({ id: true, createdAt: true, updatedAt: true });
export type Location = typeof ccLocations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

// Transport Operators - companies providing transport services
export const ccTransportOperators = pgTable('cc_transport_operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  portalId: uuid('portal_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 10 }),
  
  operatorType: text('operator_type').notNull(),
  
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  websiteUrl: text('website_url'),
  
  businessLicense: text('business_license'),
  insurancePolicy: text('insurance_policy'),
  insuranceExpiry: date('insurance_expiry'),
  
  serviceAreaJson: jsonb('service_area_json').default({}),
  operatingHoursJson: jsonb('operating_hours_json').default({}),
  reservationSettingsJson: jsonb('reservation_settings_json').default({}),
  
  settlementMethod: varchar('settlement_method', { length: 50 }).default('invoice'),
  settlementAccountJson: jsonb('settlement_account_json').default({}),
  commissionPercent: numeric('commission_percent', { precision: 5, scale: 2 }).default('0'),
  
  externalReservationUrl: text('external_reservation_url'),
  apiEndpoint: text('api_endpoint'),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTransportOperatorSchema = createInsertSchema(ccTransportOperators).omit({ id: true, createdAt: true, updatedAt: true });
export type TransportOperator = typeof ccTransportOperators.$inferSelect;
export type InsertTransportOperator = z.infer<typeof insertTransportOperatorSchema>;

// Transport Assets - vessels, vehicles, etc.
export const ccTransportAssets = pgTable('cc_transport_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  operatorId: uuid('operator_id').notNull(),
  
  name: text('name').notNull(),
  assetType: text('asset_type').notNull(),
  
  registrationNumber: text('registration_number'),
  transportCanadaId: text('transport_canada_id'),
  hullNumber: text('hull_number'),
  
  specsJson: jsonb('specs_json').default({}),
  capacityJson: jsonb('capacity_json').default({}),
  capabilitiesJson: jsonb('capabilities_json').default({}),
  safetyJson: jsonb('safety_json').default({}),
  
  imageUrl: text('image_url'),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTransportAssetSchema = createInsertSchema(ccTransportAssets).omit({ id: true, createdAt: true, updatedAt: true });
export type TransportAsset = typeof ccTransportAssets.$inferSelect;
export type InsertTransportAsset = z.infer<typeof insertTransportAssetSchema>;

// Sailing Schedules - recurring patterns for scheduled services
export const ccSailingSchedules = pgTable('cc_sailing_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  operatorId: uuid('operator_id').notNull(),
  
  routeName: text('route_name').notNull(),
  routeCode: varchar('route_code', { length: 20 }),
  
  originLocationId: uuid('origin_location_id'),
  destinationLocationId: uuid('destination_location_id'),
  
  daysOfWeek: integer('days_of_week').array().notNull(),
  departureTime: time('departure_time').notNull(),
  
  seasonalJson: jsonb('seasonal_json').default({}),
  
  baseFareCad: numeric('base_fare_cad', { precision: 10, scale: 2 }),
  
  status: varchar('status', { length: 50 }).default('active'),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertSailingScheduleSchema = createInsertSchema(ccSailingSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export type SailingSchedule = typeof ccSailingSchedules.$inferSelect;
export type InsertSailingSchedule = z.infer<typeof insertSailingScheduleSchema>;

// Sailings - individual sailing instances
export const ccSailings = pgTable('cc_sailings', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  scheduleId: uuid('schedule_id'),
  operatorId: uuid('operator_id').notNull(),
  assetId: uuid('asset_id'),
  
  sailingNumber: varchar('sailing_number', { length: 30 }),
  
  sailingDate: date('sailing_date').notNull(),
  scheduledDeparture: time('scheduled_departure').notNull(),
  scheduledArrival: time('scheduled_arrival'),
  
  actualDepartureAt: timestamp('actual_departure_at', { withTimezone: true }),
  actualArrivalAt: timestamp('actual_arrival_at', { withTimezone: true }),
  
  originLocationId: uuid('origin_location_id'),
  destinationLocationId: uuid('destination_location_id'),
  
  capacityJson: jsonb('capacity_json').default({}),
  
  status: varchar('status', { length: 50 }).default('scheduled').notNull(),
  
  delayMinutes: integer('delay_minutes'),
  delayReason: text('delay_reason'),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  
  weatherJson: jsonb('weather_json').default({}),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertSailingSchema = createInsertSchema(ccSailings).omit({ id: true, createdAt: true, updatedAt: true });
export type Sailing = typeof ccSailings.$inferSelect;
export type InsertSailing = z.infer<typeof insertSailingSchema>;

// Port Calls - intermediate stops on a sailing
export const ccPortCalls = pgTable('cc_port_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  sailingId: uuid('sailing_id').notNull(),
  locationId: uuid('location_id').notNull(),
  
  stopSequence: integer('stop_sequence').notNull(),
  
  scheduledArrival: time('scheduled_arrival'),
  scheduledDeparture: time('scheduled_departure'),
  dwellMinutes: integer('dwell_minutes').default(15),
  
  actualArrivalAt: timestamp('actual_arrival_at', { withTimezone: true }),
  actualDepartureAt: timestamp('actual_departure_at', { withTimezone: true }),
  
  operationsJson: jsonb('operations_json').default({}),
  
  status: varchar('status', { length: 50 }).default('scheduled'),
  
  skipReason: text('skip_reason'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertPortCallSchema = createInsertSchema(ccPortCalls).omit({ id: true, createdAt: true });
export type PortCall = typeof ccPortCalls.$inferSelect;
export type InsertPortCall = z.infer<typeof insertPortCallSchema>;

// Transport Requests - reservations for sailings
export const ccTransportRequests = pgTable('cc_transport_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  portalId: uuid('portal_id'),
  operatorId: uuid('operator_id'),
  sailingId: uuid('sailing_id'),
  
  cartId: uuid('cart_id'),
  cartItemId: uuid('cart_item_id'),
  tripId: uuid('trip_id'),
  
  requestNumber: varchar('request_number', { length: 30 }).notNull().unique(),
  requestType: varchar('request_type', { length: 50 }).notNull(),
  
  originLocationId: uuid('origin_location_id'),
  destinationLocationId: uuid('destination_location_id'),
  
  requestedDate: date('requested_date').notNull(),
  requestedTime: time('requested_time'),
  flexibleWindowMinutes: integer('flexible_window_minutes').default(0),
  
  passengerCount: integer('passenger_count').default(0),
  passengerNames: text('passenger_names').array(),
  
  freightDescription: text('freight_description'),
  freightWeightLbs: integer('freight_weight_lbs').default(0),
  freightPieces: integer('freight_pieces').default(0),
  freightSpecialHandling: text('freight_special_handling').array(),
  
  kayakCount: integer('kayak_count').default(0),
  bikeCount: integer('bike_count').default(0),
  
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  
  needsJson: jsonb('needs_json').default({}),
  
  quotedFareCad: numeric('quoted_fare_cad', { precision: 10, scale: 2 }),
  freightFeeCad: numeric('freight_fee_cad', { precision: 10, scale: 2 }),
  kayakFeeCad: numeric('kayak_fee_cad', { precision: 10, scale: 2 }),
  totalCad: numeric('total_cad', { precision: 10, scale: 2 }),
  depositPaidCad: numeric('deposit_paid_cad', { precision: 10, scale: 2 }).default('0'),
  paymentStatus: varchar('payment_status', { length: 50 }).default('pending'),
  
  status: varchar('status', { length: 50 }).notNull().default('requested'),
  
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmedBy: varchar('confirmed_by', { length: 255 }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  boardedAt: timestamp('boarded_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  
  operatorNotes: text('operator_notes'),
  specialRequests: text('special_requests'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTransportRequestSchema = createInsertSchema(ccTransportRequests).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type TransportRequest = typeof ccTransportRequests.$inferSelect;
export type InsertTransportRequest = z.infer<typeof insertTransportRequestSchema>;

// Transport Alerts - delays, cancellations, weather holds, operational notices
export const ccTransportAlerts = pgTable('cc_transport_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  operatorId: uuid('operator_id'),
  sailingId: uuid('sailing_id'),
  locationId: uuid('location_id'),
  
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 50 }).notNull().default('info'),
  
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  
  affectedDate: date('affected_date'),
  affectedSailings: uuid('affected_sailings').array(),
  delayMinutes: integer('delay_minutes'),
  
  actionRequired: boolean('action_required').default(false),
  actionUrl: text('action_url'),
  actionLabel: varchar('action_label', { length: 255 }),
  
  source: varchar('source', { length: 50 }).default('operator'),
  sourceRef: varchar('source_ref', { length: 255 }),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  notificationsSent: boolean('notifications_sent').default(false),
  notificationsSentAt: timestamp('notifications_sent_at', { withTimezone: true }),
  affectedRequestCount: integer('affected_request_count').default(0),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTransportAlertSchema = createInsertSchema(ccTransportAlerts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type TransportAlert = typeof ccTransportAlerts.$inferSelect;
export type InsertTransportAlert = z.infer<typeof insertTransportAlertSchema>;

// Transport Confirmations - reservation confirmations with QR codes
export const ccTransportConfirmations = pgTable('cc_transport_confirmations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  transportRequestId: uuid('transport_request_id').notNull(),
  reservationId: uuid('reservation_id'),
  cartId: uuid('cart_id'),
  tripId: uuid('trip_id'),
  
  confirmationNumber: varchar('confirmation_number', { length: 20 }).notNull().unique(),
  qrCodeToken: varchar('qr_code_token', { length: 30 }).unique(),
  
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  
  sailingDate: date('sailing_date').notNull(),
  sailingTime: time('sailing_time').notNull(),
  operatorName: text('operator_name').notNull(),
  vesselName: text('vessel_name'),
  originName: text('origin_name').notNull(),
  destinationName: text('destination_name').notNull(),
  
  passengerCount: integer('passenger_count').default(1),
  passengerNames: text('passenger_names').array(),
  kayakCount: integer('kayak_count').default(0),
  bikeCount: integer('bike_count').default(0),
  freightDescription: text('freight_description'),
  
  totalCad: numeric('total_cad', { precision: 10, scale: 2 }),
  paymentStatus: varchar('payment_status', { length: 50 }).default('pending'),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  boardedAt: timestamp('boarded_at', { withTimezone: true }),
  
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTransportConfirmationSchema = createInsertSchema(ccTransportConfirmations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type TransportConfirmation = typeof ccTransportConfirmations.$inferSelect;
export type InsertTransportConfirmation = z.infer<typeof insertTransportConfirmationSchema>;

// ============ FREIGHT MANIFESTS ============
export const ccFreightManifests = pgTable('cc_freight_manifests', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  operatorId: uuid('operator_id').notNull(),
  sailingId: uuid('sailing_id'),
  
  manifestNumber: varchar('manifest_number', { length: 30 }).notNull().unique(),
  
  originLocationId: uuid('origin_location_id'),
  destinationLocationId: uuid('destination_location_id'),
  
  manifestDate: date('manifest_date').notNull(),
  scheduledDeparture: time('scheduled_departure'),
  
  totalItems: integer('total_items').default(0),
  totalWeightLbs: numeric('total_weight_lbs', { precision: 10, scale: 2 }).default('0'),
  totalValueCad: numeric('total_value_cad', { precision: 10, scale: 2 }).default('0'),
  
  status: varchar('status', { length: 50 }).default('draft'),
  
  loadedAt: timestamp('loaded_at', { withTimezone: true }),
  departedAt: timestamp('departed_at', { withTimezone: true }),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  
  shipperName: text('shipper_name'),
  shipperPhone: text('shipper_phone'),
  shipperEmail: text('shipper_email'),
  shipperBusiness: text('shipper_business'),
  
  consigneeName: text('consignee_name'),
  consigneePhone: text('consignee_phone'),
  consigneeEmail: text('consignee_email'),
  consigneeBusiness: text('consignee_business'),
  consigneeLocationId: uuid('consignee_location_id'),
  
  billingMethod: varchar('billing_method', { length: 50 }).default('prepaid'),
  billingAccountId: uuid('billing_account_id'),
  freightChargesCad: numeric('freight_charges_cad', { precision: 10, scale: 2 }).default('0'),
  paymentStatus: varchar('payment_status', { length: 50 }).default('pending'),
  
  specialInstructions: text('special_instructions'),
  internalNotes: text('internal_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertFreightManifestSchema = createInsertSchema(ccFreightManifests).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type FreightManifest = typeof ccFreightManifests.$inferSelect;
export type InsertFreightManifest = z.infer<typeof insertFreightManifestSchema>;

// ============ FREIGHT ITEMS ============
export const ccFreightItems = pgTable('cc_freight_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  manifestId: uuid('manifest_id').notNull(),
  
  itemNumber: integer('item_number').notNull(),
  trackingCode: varchar('tracking_code', { length: 20 }),
  
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).default('general'),
  
  quantity: integer('quantity').default(1),
  weightLbs: numeric('weight_lbs', { precision: 10, scale: 2 }),
  lengthIn: numeric('length_in', { precision: 10, scale: 2 }),
  widthIn: numeric('width_in', { precision: 10, scale: 2 }),
  heightIn: numeric('height_in', { precision: 10, scale: 2 }),
  
  declaredValueCad: numeric('declared_value_cad', { precision: 10, scale: 2 }),
  insured: boolean('insured').default(false),
  insuranceValueCad: numeric('insurance_value_cad', { precision: 10, scale: 2 }),
  
  specialHandling: text('special_handling').array(),
  handlingInstructions: text('handling_instructions'),
  
  status: varchar('status', { length: 50 }).default('pending'),
  
  loadedAt: timestamp('loaded_at', { withTimezone: true }),
  offloadedAt: timestamp('offloaded_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  
  receivedBy: text('received_by'),
  deliverySignature: text('delivery_signature'),
  deliveryNotes: text('delivery_notes'),
  
  itemChargeCad: numeric('item_charge_cad', { precision: 10, scale: 2 }).default('0'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertFreightItemSchema = createInsertSchema(ccFreightItems).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type FreightItem = typeof ccFreightItems.$inferSelect;
export type InsertFreightItem = z.infer<typeof insertFreightItemSchema>;

// ============ PROOF OF HANDLING ============
export const ccProofOfHandling = pgTable('cc_proof_of_handling', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  manifestId: uuid('manifest_id').notNull(),
  itemId: uuid('item_id'),
  locationId: uuid('location_id'),
  
  handlingType: varchar('handling_type', { length: 50 }).notNull(),
  
  handledAt: timestamp('handled_at', { withTimezone: true }).notNull().defaultNow(),
  locationName: text('location_name'),
  locationDescription: text('location_description'),
  
  handlerName: text('handler_name').notNull(),
  handlerRole: varchar('handler_role', { length: 50 }),
  handlerCompany: text('handler_company'),
  
  recipientName: text('recipient_name'),
  recipientSignature: text('recipient_signature'),
  recipientIdType: varchar('recipient_id_type', { length: 50 }),
  recipientIdNumber: varchar('recipient_id_number', { length: 100 }),
  
  condition: varchar('condition', { length: 50 }).default('good'),
  conditionNotes: text('condition_notes'),
  
  verifiedWeightLbs: numeric('verified_weight_lbs', { precision: 10, scale: 2 }),
  weightVarianceLbs: numeric('weight_variance_lbs', { precision: 10, scale: 2 }),
  
  photoUrls: text('photo_urls').array(),
  documentUrls: text('document_urls').array(),
  
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  
  deviceId: varchar('device_id', { length: 100 }),
  appVersion: varchar('app_version', { length: 50 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertProofOfHandlingSchema = createInsertSchema(ccProofOfHandling).omit({ 
  id: true, createdAt: true 
});
export type ProofOfHandling = typeof ccProofOfHandling.$inferSelect;
export type InsertProofOfHandling = z.infer<typeof insertProofOfHandlingSchema>;

// ============ HANDLING EXCEPTIONS ============
export const ccHandlingExceptions = pgTable('cc_handling_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  manifestId: uuid('manifest_id').notNull(),
  itemId: uuid('item_id'),
  proofOfHandlingId: uuid('proof_of_handling_id'),
  
  exceptionType: varchar('exception_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('medium'),
  
  description: text('description').notNull(),
  
  status: varchar('status', { length: 50 }).default('open'),
  
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: text('resolved_by'),
  
  claimedAmountCad: numeric('claimed_amount_cad', { precision: 10, scale: 2 }),
  approvedAmountCad: numeric('approved_amount_cad', { precision: 10, scale: 2 }),
  
  photoUrls: text('photo_urls').array(),
  
  shipperNotified: boolean('shipper_notified').default(false),
  consigneeNotified: boolean('consignee_notified').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertHandlingExceptionSchema = createInsertSchema(ccHandlingExceptions).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type HandlingException = typeof ccHandlingExceptions.$inferSelect;
export type InsertHandlingException = z.infer<typeof insertHandlingExceptionSchema>;

// ============ AUTHORITIES ============
// Governing bodies that issue permits (Parks Canada, First Nations, etc.)
export const ccAuthorities = pgTable('cc_authorities', {
  id: uuid('id').primaryKey().defaultRandom(),
  portalId: uuid('portal_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  authorityType: varchar('authority_type', { length: 50 }).notNull(),
  
  jurisdictionDescription: text('jurisdiction_description'),
  jurisdictionAreaJson: jsonb('jurisdiction_area_json').default({}),
  
  contactName: text('contact_name'),
  contactTitle: text('contact_title'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  websiteUrl: text('website_url'),
  officeAddress: text('office_address'),
  
  officeHoursJson: jsonb('office_hours_json').default({}),
  permitProcessingJson: jsonb('permit_processing_json').default({}),
  
  apiEndpoint: text('api_endpoint'),
  apiKeyEncrypted: text('api_key_encrypted'),
  integrationType: varchar('integration_type', { length: 50 }),
  
  culturalProtocolsJson: jsonb('cultural_protocols_json').default({}),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertAuthoritySchema = createInsertSchema(ccAuthorities).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Authority = typeof ccAuthorities.$inferSelect;
export type InsertAuthority = z.infer<typeof insertAuthoritySchema>;

// ============ PERMIT TYPES ============
// Types of permits each authority can issue
export const ccPermitTypes = pgTable('cc_permit_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorityId: uuid('authority_id').notNull(),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  description: text('description'),
  
  permitCategory: varchar('permit_category', { length: 50 }).notNull(),
  
  requirementsJson: jsonb('requirements_json').default({}),
  
  baseFeeCad: numeric('base_fee_cad', { precision: 10, scale: 2 }).default('0'),
  perPersonFeeCad: numeric('per_person_fee_cad', { precision: 10, scale: 2 }).default('0'),
  perDayFeeCad: numeric('per_day_fee_cad', { precision: 10, scale: 2 }).default('0'),
  perNightFeeCad: numeric('per_night_fee_cad', { precision: 10, scale: 2 }).default('0'),
  
  reservationRulesJson: jsonb('reservation_rules_json').default({}),
  
  validityType: varchar('validity_type', { length: 50 }).default('date_range'),
  defaultValidityDays: integer('default_validity_days').default(1),
  
  documentTemplateUrl: text('document_template_url'),
  termsAndConditions: text('terms_and_conditions'),
  
  seasonalJson: jsonb('seasonal_json').default({}),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertPermitTypeSchema = createInsertSchema(ccPermitTypes).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type PermitType = typeof ccPermitTypes.$inferSelect;
export type InsertPermitType = z.infer<typeof insertPermitTypeSchema>;

// ============ VISITOR PERMITS ============
// Individual permits issued to guests (not to be confused with cc_permits which is for work order compliance)
export const ccVisitorPermits = pgTable('cc_visitor_permits', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'), // nullable per migration (ON DELETE SET NULL)
  authorityId: uuid('authority_id').notNull(),
  permitTypeId: uuid('permit_type_id').notNull(),
  
  cartId: uuid('cart_id'),
  cartItemId: uuid('cart_item_id'),
  tripId: uuid('trip_id'),
  
  permitNumber: varchar('permit_number', { length: 30 }).notNull().unique(),
  
  applicantName: text('applicant_name').notNull(),
  applicantEmail: text('applicant_email'),
  applicantPhone: text('applicant_phone'),
  applicantAddress: text('applicant_address'),
  
  partySize: integer('party_size').default(1),
  partyMembers: text('party_members').array(),
  
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to').notNull(),
  
  locationId: uuid('location_id'),
  activityDescription: text('activity_description'),
  entryPoint: text('entry_point'),
  exitPoint: text('exit_point'),
  
  vesselName: text('vessel_name'),
  vesselRegistration: text('vessel_registration'),
  vesselLengthFt: numeric('vessel_length_ft', { precision: 6, scale: 2 }),
  
  baseFeeCad: numeric('base_fee_cad', { precision: 10, scale: 2 }).default('0'),
  personFeeCad: numeric('person_fee_cad', { precision: 10, scale: 2 }).default('0'),
  dayFeeCad: numeric('day_fee_cad', { precision: 10, scale: 2 }).default('0'),
  nightFeeCad: numeric('night_fee_cad', { precision: 10, scale: 2 }).default('0'),
  totalFeeCad: numeric('total_fee_cad', { precision: 10, scale: 2 }).default('0'),
  
  paymentStatus: varchar('payment_status', { length: 50 }).default('pending'),
  paymentReference: text('payment_reference'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  
  rejectionReason: text('rejection_reason'),
  revocationReason: text('revocation_reason'),
  
  qrCodeToken: varchar('qr_code_token', { length: 30 }).unique(),
  documentUrl: text('document_url'),
  
  specialConditions: text('special_conditions'),
  authorityNotes: text('authority_notes'),
  applicantNotes: text('applicant_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertVisitorPermitSchema = createInsertSchema(ccVisitorPermits).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type VisitorPermit = typeof ccVisitorPermits.$inferSelect;
export type InsertVisitorPermit = z.infer<typeof insertVisitorPermitSchema>;

// ============ TRIP PERMITS ============
// Links permits to trips and tracks permit requirements for trip itinerary
export const ccTripPermits = pgTable('cc_trip_permits', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  tripId: uuid('trip_id').notNull(),
  permitId: uuid('permit_id'),
  permitTypeId: uuid('permit_type_id').notNull(),
  authorityId: uuid('authority_id').notNull(),
  
  requirementSource: varchar('requirement_source', { length: 50 }).notNull(),
  sourceLocationId: uuid('source_location_id'),
  sourceDescription: text('source_description'),
  
  status: varchar('status', { length: 50 }).default('required'),
  
  requiredBy: date('required_by'),
  obtainedAt: timestamp('obtained_at', { withTimezone: true }),
  
  notes: text('notes'),
  waiverReason: text('waiver_reason'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTripPermitSchema = createInsertSchema(ccTripPermits).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type TripPermit = typeof ccTripPermits.$inferSelect;
export type InsertTripPermit = z.infer<typeof insertTripPermitSchema>;

// ============ TERRITORY NOTICES ============
// Acknowledgments and notices for First Nations territories
export const ccTerritoryNotices = pgTable('cc_territory_notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  authorityId: uuid('authority_id').notNull(),
  tripId: uuid('trip_id'),
  permitId: uuid('permit_id'),
  
  noticeNumber: varchar('notice_number', { length: 30 }).notNull().unique(),
  
  visitorName: text('visitor_name').notNull(),
  visitorEmail: text('visitor_email'),
  visitorPhone: text('visitor_phone'),
  partySize: integer('party_size').default(1),
  partyMembers: text('party_members').array(),
  
  visitPurpose: varchar('visit_purpose', { length: 50 }),
  visitDescription: text('visit_description'),
  
  entryDate: date('entry_date').notNull(),
  exitDate: date('exit_date'),
  
  entryPoint: text('entry_point'),
  plannedAreas: text('planned_areas').array(),
  
  acknowledgementsJson: jsonb('acknowledgments_json').default({}),
  
  orientationCompleted: boolean('orientation_completed').default(false),
  orientationDate: timestamp('orientation_date', { withTimezone: true }),
  culturalGuideRequested: boolean('cultural_guide_requested').default(false),
  
  status: varchar('status', { length: 50 }).default('pending'),
  
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  
  vesselName: text('vessel_name'),
  vesselType: text('vessel_type'),
  vesselRegistration: text('vessel_registration'),
  
  visitorNotes: text('visitor_notes'),
  authorityNotes: text('authority_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertTerritoryNoticeSchema = createInsertSchema(ccTerritoryNotices).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type TerritoryNotice = typeof ccTerritoryNotices.$inferSelect;
export type InsertTerritoryNotice = z.infer<typeof insertTerritoryNoticeSchema>;

// ============ CULTURAL SITES ============
// Sacred sites and areas with special protocols
export const ccCulturalSites = pgTable('cc_cultural_sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  authorityId: uuid('authority_id').notNull(),
  locationId: uuid('location_id'),
  
  name: text('name').notNull(),
  traditionalName: text('traditional_name'),
  
  siteType: varchar('site_type', { length: 50 }),
  
  description: text('description'),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  boundaryJson: jsonb('boundary_json').default({}),
  
  accessLevel: varchar('access_level', { length: 50 }).default('restricted'),
  
  restrictionsJson: jsonb('restrictions_json').default({}),
  
  protocolDescription: text('protocol_description'),
  requiredAcknowledgment: text('required_acknowledgment'),
  
  status: varchar('status', { length: 50 }).default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertCulturalSiteSchema = createInsertSchema(ccCulturalSites).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type CulturalSite = typeof ccCulturalSites.$inferSelect;
export type InsertCulturalSite = z.infer<typeof insertCulturalSiteSchema>;

// ============================================================================
// PMS - PROPERTY MANAGEMENT SYSTEM
// ============================================================================

// ============ PROPERTIES ============
export const ccProperties = pgTable('cc_properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  tenantId: uuid('tenant_id'),
  ownerId: uuid('owner_id'),
  locationId: uuid('location_id'),
  zoneId: uuid('zone_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  slug: varchar('slug', { length: 50 }),
  
  propertyType: varchar('property_type').notNull(),
  
  description: text('description'),
  tagline: varchar('tagline', { length: 200 }),
  
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }),
  province: varchar('province', { length: 50 }).default('BC'),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 50 }).default('Canada'),
  
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  websiteUrl: text('website_url'),
  
  totalUnits: integer('total_units').default(0),
  totalBeds: integer('total_beds').default(0),
  maxOccupancy: integer('max_occupancy').default(0),
  
  amenitiesJson: jsonb('amenities_json').default([]),
  policiesJson: jsonb('policies_json').default({}),
  
  baseRateCad: numeric('base_rate_cad', { precision: 10, scale: 2 }),
  cleaningFeeCad: numeric('cleaning_fee_cad', { precision: 10, scale: 2 }).default('0'),
  taxRatePercent: numeric('tax_rate_percent', { precision: 5, scale: 2 }).default('13.0'),
  
  externalPms: varchar('external_pms'),
  externalPmsId: text('external_pms_id'),
  icalImportUrl: text('ical_import_url'),
  icalExportUrl: text('ical_export_url'),
  
  photosJson: jsonb('photos_json').default([]),
  
  status: varchar('status').default('active'),
  
  acceptsInstantReserve: boolean('accepts_instant_reserve').default(false),
  requiresApproval: boolean('requires_approval').default(true),
  leadTimeHours: integer('lead_time_hours').default(24),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertPropertySchema = createInsertSchema(ccProperties).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Property = typeof ccProperties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

// ============ ACCESS CONSTRAINTS ============
export const ccAccessConstraints = pgTable('cc_access_constraints', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  access: jsonb('access').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantEntityUnique: uniqueIndex('cc_access_constraints_tenant_entity_unique').on(table.tenantId, table.entityType, table.entityId),
  tenantEntityIdx: index('cc_access_constraints_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
}));

export const insertAccessConstraintSchema = createInsertSchema(ccAccessConstraints).omit({
  id: true, createdAt: true, updatedAt: true
});
export type AccessConstraint = typeof ccAccessConstraints.$inferSelect;
export type InsertAccessConstraint = z.infer<typeof insertAccessConstraintSchema>;

// ============ WORK AREAS ============
export const ccWorkAreas = pgTable('cc_work_areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => ccProperties.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  tags: text('tags').array().notNull().default([]),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantPropertyIdx: index('cc_work_areas_tenant_property_idx').on(table.tenantId, table.propertyId),
}));

export const insertWorkAreaSchema = createInsertSchema(ccWorkAreas).omit({
  id: true, createdAt: true, updatedAt: true
});
export type WorkArea = typeof ccWorkAreas.$inferSelect;
export type InsertWorkArea = z.infer<typeof insertWorkAreaSchema>;

// ============ WORK MEDIA ============
export const ccWorkMedia = pgTable('cc_work_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id').references(() => ccProperties.id, { onDelete: 'cascade' }),
  workAreaId: uuid('work_area_id').references(() => ccWorkAreas.id, { onDelete: 'cascade' }),
  subsystemId: uuid('subsystem_id'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  mediaId: uuid('media_id').notNull(),
  title: text('title'),
  notes: text('notes'),
  tags: text('tags').array().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('cc_work_media_tenant_idx').on(table.tenantId),
  areaIdx: index('cc_work_media_area_idx').on(table.tenantId, table.workAreaId),
  portalIdx: index('cc_work_media_portal_idx').on(table.tenantId, table.portalId),
  subsystemIdx: index('cc_work_media_subsystem_idx').on(table.tenantId, table.subsystemId),
}));

export const insertWorkMediaSchema = createInsertSchema(ccWorkMedia).omit({
  id: true, createdAt: true, updatedAt: true
});
export type WorkMedia = typeof ccWorkMedia.$inferSelect;
export type InsertWorkMedia = z.infer<typeof insertWorkMediaSchema>;

// ============ WORK DISCLOSURES ============
export const ccWorkDisclosures = pgTable('cc_work_disclosures', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  workRequestId: uuid('work_request_id').notNull(),
  itemType: varchar('item_type', { length: 50 }).notNull(),
  itemId: uuid('item_id'),
  visibility: varchar('visibility', { length: 50 }).notNull().default('contractor'),
  specificContractorId: uuid('specific_contractor_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
}, (table) => ({
  tenantIdx: index('cc_work_disclosures_tenant_idx_drizzle').on(table.tenantId),
  workRequestIdx: index('cc_work_disclosures_work_request_idx_drizzle').on(table.tenantId, table.workRequestId),
}));

export const insertWorkDisclosureSchema = createInsertSchema(ccWorkDisclosures).omit({
  id: true, createdAt: true
});
export type WorkDisclosure = typeof ccWorkDisclosures.$inferSelect;
export type InsertWorkDisclosure = z.infer<typeof insertWorkDisclosureSchema>;

// ============ WORK DISCLOSURE AUDIT (append-only) ============
export const ccWorkDisclosureAudit = pgTable('cc_work_disclosure_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  workRequestId: uuid('work_request_id').notNull(),
  actorUserId: uuid('actor_user_id').notNull(),
  contractorPersonId: uuid('contractor_person_id'),
  action: varchar('action', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  workRequestIdx: index('cc_work_disclosure_audit_work_request_idx').on(table.tenantId, table.workRequestId, table.createdAt),
  contractorIdx: index('cc_work_disclosure_audit_contractor_idx').on(table.tenantId, table.contractorPersonId, table.createdAt),
}));

export const insertWorkDisclosureAuditSchema = createInsertSchema(ccWorkDisclosureAudit).omit({
  id: true, createdAt: true
});
export type WorkDisclosureAudit = typeof ccWorkDisclosureAudit.$inferSelect;
export type InsertWorkDisclosureAudit = z.infer<typeof insertWorkDisclosureAuditSchema>;

// ============ WORK DISCLOSURE PREVIEW TOKENS ============
// Note: Foreign key to cc_people is omitted as table is not in Drizzle schema
// Validation is done at API level via validateContractorPersonId()
export const ccWorkDisclosurePreviewTokens = pgTable('cc_work_disclosure_preview_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  workRequestId: uuid('work_request_id').notNull(),
  contractorPersonId: uuid('contractor_person_id').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantWorkRequestIdx: index('cc_work_disclosure_preview_tokens_tenant_work_request_idx').on(table.tenantId, table.workRequestId, table.contractorPersonId),
  tokenIdx: index('cc_work_disclosure_preview_tokens_token_idx').on(table.token),
}));

export const insertWorkDisclosurePreviewTokenSchema = createInsertSchema(ccWorkDisclosurePreviewTokens).omit({
  id: true, createdAt: true, usedAt: true
});
export type WorkDisclosurePreviewToken = typeof ccWorkDisclosurePreviewTokens.$inferSelect;
export type InsertWorkDisclosurePreviewToken = z.infer<typeof insertWorkDisclosurePreviewTokenSchema>;

// ============ SUBSYSTEM CATALOG (GLOBAL) ============
export const ccSubsystemCatalog = pgTable('cc_subsystem_catalog', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  tags: text('tags').array().notNull().default([]),
  isSensitive: boolean('is_sensitive').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tagsIdx: index('cc_subsystem_catalog_tags_idx').using('gin', table.tags),
}));

export const insertSubsystemCatalogSchema = createInsertSchema(ccSubsystemCatalog).omit({
  id: true, createdAt: true, updatedAt: true
});
export type SubsystemCatalog = typeof ccSubsystemCatalog.$inferSelect;
export type InsertSubsystemCatalog = z.infer<typeof insertSubsystemCatalogSchema>;

// ============ PROPERTY SUBSYSTEMS (TENANT SCOPED) ============
export const ccPropertySubsystems = pgTable('cc_property_subsystems', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => ccProperties.id, { onDelete: 'cascade' }),
  catalogKey: text('catalog_key').references(() => ccSubsystemCatalog.key, { onDelete: 'set null' }),
  customKey: text('custom_key'),
  title: text('title').notNull(),
  description: text('description'),
  tags: text('tags').array().notNull().default([]),
  visibility: text('visibility').notNull().default('private'),
  isSensitive: boolean('is_sensitive').notNull().default(false),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantPropertyIdx: index('cc_property_subsystems_tenant_property_idx').on(table.tenantId, table.propertyId),
  tagsIdx: index('cc_property_subsystems_tags_idx').using('gin', table.tags),
}));

export const insertPropertySubsystemSchema = createInsertSchema(ccPropertySubsystems).omit({
  id: true, createdAt: true, updatedAt: true
});
export type PropertySubsystem = typeof ccPropertySubsystems.$inferSelect;
export type InsertPropertySubsystem = z.infer<typeof insertPropertySubsystemSchema>;

// ============ ON-SITE RESOURCES (TENANT + PROPERTY SCOPED) ============
export const ccOnSiteResources = pgTable('cc_on_site_resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => ccProperties.id, { onDelete: 'cascade' }),
  resourceType: text('resource_type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  quantity: numeric('quantity', { precision: 10, scale: 2 }),
  unit: text('unit'),
  condition: text('condition'),
  tags: text('tags').array().notNull().default([]),
  unspscCode: text('unspsc_code'),
  storageLocation: text('storage_location'),
  sharePolicy: text('share_policy').notNull().default('private'),
  suggestedPriceAmount: numeric('suggested_price_amount', { precision: 10, scale: 2 }),
  suggestedPriceCurrency: text('suggested_price_currency').default('CAD'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantPropertyIdx: index('cc_on_site_resources_tenant_property_idx').on(table.tenantId, table.propertyId),
  tagsIdx: index('cc_on_site_resources_tags_idx').using('gin', table.tags),
}));

export const insertOnSiteResourceSchema = createInsertSchema(ccOnSiteResources).omit({
  id: true, createdAt: true, updatedAt: true
});
export type OnSiteResource = typeof ccOnSiteResources.$inferSelect;
export type InsertOnSiteResource = z.infer<typeof insertOnSiteResourceSchema>;

// ============ ON-SITE RESOURCE MEDIA ============
export const ccOnSiteResourceMedia = pgTable('cc_on_site_resource_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  resourceId: uuid('resource_id').notNull().references(() => ccOnSiteResources.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  mediaType: varchar('media_type', { length: 50 }).default('photo'),
  caption: text('caption'),
  tags: text('tags').array().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  resourceIdx: index('cc_on_site_resource_media_resource_idx').on(table.tenantId, table.resourceId),
}));

export const insertOnSiteResourceMediaSchema = createInsertSchema(ccOnSiteResourceMedia).omit({
  id: true, createdAt: true
});
export type OnSiteResourceMedia = typeof ccOnSiteResourceMedia.$inferSelect;
export type InsertOnSiteResourceMedia = z.infer<typeof insertOnSiteResourceMediaSchema>;

// ============ UNITS ============
export const ccUnits = pgTable('cc_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  propertyId: uuid('property_id').notNull(),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  unitNumber: varchar('unit_number', { length: 20 }),
  
  unitType: varchar('unit_type').notNull(),
  
  description: text('description'),
  
  maxOccupancy: integer('max_occupancy').default(2),
  bedrooms: integer('bedrooms').default(1),
  bedsJson: jsonb('beds_json').default([]),
  bathrooms: numeric('bathrooms', { precision: 3, scale: 1 }).default('1'),
  
  sizeSqft: integer('size_sqft'),
  floorLevel: integer('floor_level'),
  
  slipLengthFt: numeric('slip_length_ft', { precision: 6, scale: 2 }),
  slipWidthFt: numeric('slip_width_ft', { precision: 6, scale: 2 }),
  powerAmps: integer('power_amps'),
  waterAvailable: boolean('water_available').default(true),
  
  amenitiesJson: jsonb('amenities_json').default([]),
  
  baseRateCad: numeric('base_rate_cad', { precision: 10, scale: 2 }),
  weekendRateCad: numeric('weekend_rate_cad', { precision: 10, scale: 2 }),
  weeklyRateCad: numeric('weekly_rate_cad', { precision: 10, scale: 2 }),
  monthlyRateCad: numeric('monthly_rate_cad', { precision: 10, scale: 2 }),
  extraPersonFeeCad: numeric('extra_person_fee_cad', { precision: 10, scale: 2 }).default('0'),
  
  seasonalRatesJson: jsonb('seasonal_rates_json').default([]),
  
  status: varchar('status').default('available'),
  
  icalUrl: text('ical_url'),
  lastIcalSync: timestamp('last_ical_sync', { withTimezone: true }),
  
  photosJson: jsonb('photos_json').default([]),
  
  cleanStatus: varchar('clean_status').default('clean'),
  lastCleanedAt: timestamp('last_cleaned_at', { withTimezone: true }),
  nextInspectionAt: timestamp('next_inspection_at', { withTimezone: true }),
  
  sortOrder: integer('sort_order').default(0),
  featured: boolean('featured').default(false),
  
  // B1.1: Spatial/plan rendering fields
  layoutRef: text('layout_ref'),
  layoutX: numeric('layout_x'),
  layoutY: numeric('layout_y'),
  layoutRotation: numeric('layout_rotation'),
  layoutShape: jsonb('layout_shape'),
  layoutBounds: jsonb('layout_bounds'),
  isPublicSearchable: boolean('is_public_searchable').notNull().default(false),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertUnitSchema = createInsertSchema(ccUnits).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Unit = typeof ccUnits.$inferSelect;
export type InsertUnit = z.infer<typeof insertUnitSchema>;

// ============ B1.3 UNIT DETAIL TABLES ============

export const ccParkingUnitDetails = pgTable("cc_parking_unit_details", {
  unitId: uuid("unit_id").primaryKey(),
  zoneCode: text("zone_code"),
  sizeClass: text("size_class"),
  powerAvailable: boolean("power_available").notNull().default(false),
  covered: boolean("covered").notNull().default(false),
  accessible: boolean("accessible").notNull().default(false),
  evCharging: boolean("ev_charging").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ccMarinaUnitDetails = pgTable("cc_marina_unit_details", {
  unitId: uuid("unit_id").primaryKey(),
  dockCode: text("dock_code"),
  dockSide: text("dock_side"),
  minLengthFt: numeric("min_length_ft"),
  maxLengthFt: numeric("max_length_ft"),
  maxBeamFt: numeric("max_beam_ft"),
  maxDraftFt: numeric("max_draft_ft"),
  powerService: text("power_service"),
  hasWater: boolean("has_water").notNull().default(true),
  hasPumpOut: boolean("has_pump_out").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ccBedUnitDetails = pgTable("cc_bed_unit_details", {
  unitId: uuid("unit_id").primaryKey(),
  bedType: text("bed_type"),
  privacyLevel: text("privacy_level"),
  linensProvided: boolean("linens_provided").notNull().default(true),
  accessible: boolean("accessible").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ParkingUnitDetails = typeof ccParkingUnitDetails.$inferSelect;
export type MarinaUnitDetails = typeof ccMarinaUnitDetails.$inferSelect;
export type BedUnitDetails = typeof ccBedUnitDetails.$inferSelect;

// ============ PMS RESERVATIONS ============
export const ccPmsReservations = pgTable('cc_pms_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id').notNull(),
  unitId: uuid('unit_id').notNull(),
  
  cartId: uuid('cart_id'),
  cartItemId: uuid('cart_item_id'),
  tripId: uuid('trip_id'),
  
  confirmationNumber: varchar('confirmation_number', { length: 20 }).notNull().unique(),
  
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  guestCount: integer('guest_count').default(1),
  guestNotes: text('guest_notes'),
  
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  
  expectedArrivalTime: time('expected_arrival_time'),
  actualArrivalTime: time('actual_arrival_time'),
  expectedDepartureTime: time('expected_departure_time'),
  actualDepartureTime: time('actual_departure_time'),
  
  baseRateCad: numeric('base_rate_cad', { precision: 10, scale: 2 }).default('0'),
  cleaningFeeCad: numeric('cleaning_fee_cad', { precision: 10, scale: 2 }).default('0'),
  extraFeesCad: numeric('extra_fees_cad', { precision: 10, scale: 2 }).default('0'),
  taxCad: numeric('tax_cad', { precision: 10, scale: 2 }).default('0'),
  totalCad: numeric('total_cad', { precision: 10, scale: 2 }).default('0'),
  
  depositCad: numeric('deposit_cad', { precision: 10, scale: 2 }).default('0'),
  depositPaid: boolean('deposit_paid').default(false),
  balanceCad: numeric('balance_cad', { precision: 10, scale: 2 }).default('0'),
  
  paymentStatus: varchar('payment_status').default('pending'),
  paymentMethod: varchar('payment_method'),
  paymentReference: text('payment_reference'),
  
  status: varchar('status').default('pending'),
  
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  
  cancellationReason: text('cancellation_reason'),
  
  source: varchar('source').default('direct'),
  sourceReference: text('source_reference'),
  
  specialRequests: text('special_requests'),
  internalNotes: text('internal_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertPmsReservationSchema = createInsertSchema(ccPmsReservations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type PmsReservation = typeof ccPmsReservations.$inferSelect;
export type InsertPmsReservation = z.infer<typeof insertPmsReservationSchema>;

// ============ UNIT CALENDAR ============
export const ccUnitCalendar = pgTable('cc_unit_calendar', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').notNull(),
  
  calendarDate: date('calendar_date').notNull(),
  
  availability: varchar('availability').default('available'),
  
  rateCad: numeric('rate_cad', { precision: 10, scale: 2 }),
  minStayNights: integer('min_stay_nights'),
  
  source: varchar('source').default('manual'),
  sourceId: uuid('source_id'),
  sourceRef: text('source_ref'),
  
  blockReason: text('block_reason'),
  blockedBy: text('blocked_by'),
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertUnitCalendarSchema = createInsertSchema(ccUnitCalendar).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type UnitCalendar = typeof ccUnitCalendar.$inferSelect;
export type InsertUnitCalendar = z.infer<typeof insertUnitCalendarSchema>;

// ============ SEASONAL RULES ============
export const ccSeasonalRules = pgTable('cc_seasonal_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id'),
  unitId: uuid('unit_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  
  startDate: date('start_date'),
  endDate: date('end_date'),
  startMonth: integer('start_month'),
  startDay: integer('start_day'),
  endMonth: integer('end_month'),
  endDay: integer('end_day'),
  
  rateType: varchar('rate_type').default('fixed'),
  rateValue: numeric('rate_value', { precision: 10, scale: 2 }),
  
  minStayNights: integer('min_stay_nights'),
  maxStayNights: integer('max_stay_nights'),
  
  reservationWindowDays: integer('reservation_window_days'),
  noCheckInDays: integer('no_check_in_days').array(),
  noCheckOutDays: integer('no_check_out_days').array(),
  
  priority: integer('priority').default(0),
  
  status: varchar('status').default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertSeasonalRuleSchema = createInsertSchema(ccSeasonalRules).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type SeasonalRule = typeof ccSeasonalRules.$inferSelect;
export type InsertSeasonalRule = z.infer<typeof insertSeasonalRuleSchema>;

// ============ ICAL SYNC LOG ============
export const ccIcalSyncLog = pgTable('cc_ical_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').notNull(),
  
  syncDirection: varchar('sync_direction').notNull(),
  syncUrl: text('sync_url'),
  
  status: varchar('status').default('pending'),
  
  eventsFound: integer('events_found').default(0),
  eventsCreated: integer('events_created').default(0),
  eventsUpdated: integer('events_updated').default(0),
  eventsRemoved: integer('events_removed').default(0),
  
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const insertIcalSyncLogSchema = createInsertSchema(ccIcalSyncLog).omit({ 
  id: true, startedAt: true 
});
export type IcalSyncLog = typeof ccIcalSyncLog.$inferSelect;
export type InsertIcalSyncLog = z.infer<typeof insertIcalSyncLogSchema>;

// ============ HOUSEKEEPING TASKS ============
export const ccHousekeepingTasks = pgTable('cc_housekeeping_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id').notNull(),
  unitId: uuid('unit_id').notNull(),
  reservationId: uuid('reservation_id'),
  
  taskNumber: varchar('task_number', { length: 20 }).notNull().unique(),
  
  taskType: varchar('task_type').notNull(),
  priority: varchar('priority').default('normal'),
  
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: time('scheduled_time'),
  dueBy: timestamp('due_by', { withTimezone: true }),
  
  checkoutReservationId: uuid('checkout_reservation_id'),
  checkinReservationId: uuid('checkin_reservation_id'),
  guestArrivalTime: time('guest_arrival_time'),
  
  assignedTo: text('assigned_to'),
  assignedTeam: text('assigned_team'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  
  status: varchar('status').default('pending'),
  
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  estimatedMinutes: integer('estimated_minutes').default(60),
  actualMinutes: integer('actual_minutes'),
  
  checklistJson: jsonb('checklist_json').default([]),
  
  inspectedBy: text('inspected_by'),
  inspectedAt: timestamp('inspected_at', { withTimezone: true }),
  inspectionNotes: text('inspection_notes'),
  inspectionPhotos: jsonb('inspection_photos').default([]),
  
  issuesFound: text('issues_found'),
  maintenanceNeeded: boolean('maintenance_needed').default(false),
  maintenanceRequestId: uuid('maintenance_request_id'),
  
  suppliesUsed: jsonb('supplies_used').default([]),
  
  notes: text('notes'),
  specialInstructions: text('special_instructions'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertHousekeepingTaskSchema = createInsertSchema(ccHousekeepingTasks).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type HousekeepingTask = typeof ccHousekeepingTasks.$inferSelect;
export type InsertHousekeepingTask = z.infer<typeof insertHousekeepingTaskSchema>;

// ============ MAINTENANCE REQUESTS ============
export const ccMaintenanceRequests = pgTable('cc_maintenance_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id').notNull(),
  unitId: uuid('unit_id'),
  locationId: uuid('location_id'),
  zoneId: uuid('zone_id'),
  
  reportedByType: varchar('reported_by_type').default('staff'),
  reportedByName: text('reported_by_name'),
  reportedByContact: text('reported_by_contact'),
  reservationId: uuid('reservation_id'),
  housekeepingTaskId: uuid('housekeeping_task_id'),
  
  requestNumber: varchar('request_number', { length: 20 }).notNull().unique(),
  
  category: varchar('category').notNull(),
  priority: varchar('priority').default('normal'),
  
  title: text('title').notNull(),
  description: text('description'),
  locationDetail: text('location_detail'),
  
  photosJson: jsonb('photos_json').default([]),
  
  affectsHabitability: boolean('affects_habitability').default(false),
  unitBlocked: boolean('unit_blocked').default(false),
  blockedUntil: date('blocked_until'),
  
  assignedTo: text('assigned_to'),
  assignedVendor: text('assigned_vendor'),
  assignedContractorPersonId: uuid('assigned_contractor_person_id'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  
  scheduledDate: date('scheduled_date'),
  scheduledTimeStart: time('scheduled_time_start'),
  scheduledTimeEnd: time('scheduled_time_end'),
  
  status: varchar('status').default('reported'),
  
  triagedAt: timestamp('triaged_at', { withTimezone: true }),
  workStartedAt: timestamp('work_started_at', { withTimezone: true }),
  workCompletedAt: timestamp('work_completed_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  
  resolutionNotes: text('resolution_notes'),
  workPerformed: text('work_performed'),
  partsUsed: jsonb('parts_used').default([]),
  
  laborCostCad: numeric('labor_cost_cad', { precision: 10, scale: 2 }).default('0'),
  partsCostCad: numeric('parts_cost_cad', { precision: 10, scale: 2 }).default('0'),
  vendorCostCad: numeric('vendor_cost_cad', { precision: 10, scale: 2 }).default('0'),
  totalCostCad: numeric('total_cost_cad', { precision: 10, scale: 2 }).default('0'),
  
  billableTo: varchar('billable_to'),
  invoiceNumber: text('invoice_number'),
  
  isRecurring: boolean('is_recurring').default(false),
  recurrenceSchedule: text('recurrence_schedule'),
  parentRequestId: uuid('parent_request_id'),
  
  internalNotes: text('internal_notes'),
  guestVisibleNotes: text('guest_visible_notes'),
  
  detailsJson: jsonb('details_json').notNull().default({}),
  
  // Coordination opt-in fields (Prompt 28)
  coordinationOptIn: boolean('coordination_opt_in').notNull().default(false),
  coordinationOptInSetAt: timestamp('coordination_opt_in_set_at', { withTimezone: true }),
  coordinationOptInSetBy: uuid('coordination_opt_in_set_by'),
  coordinationOptInNote: text('coordination_opt_in_note'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_maint_coord_opt_in_portal_zone').on(table.portalId, table.zoneId),
]);

export const insertMaintenanceRequestSchema = createInsertSchema(ccMaintenanceRequests).omit({ 
  id: true, createdAt: true, updatedAt: true, coordinationOptInSetAt: true, coordinationOptInSetBy: true
});
export type MaintenanceRequest = typeof ccMaintenanceRequests.$inferSelect;
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;

// ============ N3 RUN MAINTENANCE REQUEST ATTACHMENTS (Prompt 28) ============
export const ccN3RunMaintenanceRequests = pgTable('cc_n3_run_maintenance_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  maintenanceRequestId: uuid('maintenance_request_id').notNull(),
  attachedAt: timestamp('attached_at', { withTimezone: true }).notNull().defaultNow(),
  attachedBy: uuid('attached_by'),
}, (table) => [
  uniqueIndex('uq_n3_run_maint_req').on(table.runId, table.maintenanceRequestId),
  index('idx_n3_run_maint_req_tenant_run').on(table.tenantId, table.runId),
  index('idx_n3_run_maint_req_tenant_req').on(table.tenantId, table.maintenanceRequestId),
]);

export type N3RunMaintenanceRequest = typeof ccN3RunMaintenanceRequests.$inferSelect;

// ============ N3 READINESS SNAPSHOTS (Pre-Execution Lock) ============
export const ccN3RunReadinessSnapshots = pgTable('cc_n3_run_readiness_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
  lockedBy: uuid('locked_by').notNull(),
  note: text('note'),
  snapshotPayload: jsonb('snapshot_payload').notNull(),
}, (table) => [
  uniqueIndex('uq_n3_run_readiness_snapshot_run').on(table.runId),
  index('idx_n3_run_readiness_snapshot_tenant_run').on(table.tenantId, table.runId),
]);

export type N3RunReadinessSnapshot = typeof ccN3RunReadinessSnapshots.$inferSelect;

// ============ N3 RUN EXECUTION HANDOFFS (Prompt 32) ============
// Immutable, read-only contract capturing planning intent for execution reference
export const ccN3RunExecutionHandoffs = pgTable('cc_n3_run_execution_handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  portalId: uuid('portal_id'),
  zoneId: uuid('zone_id'),
  handoffPayload: jsonb('handoff_payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  note: text('note'),
}, (table) => [
  uniqueIndex('uq_n3_run_execution_handoff_run').on(table.runId),
  index('idx_n3_run_execution_handoff_tenant_run').on(table.tenantId, table.runId),
]);

export type N3RunExecutionHandoff = typeof ccN3RunExecutionHandoffs.$inferSelect;

// ============ N3 EXECUTION CONTRACTS (Prompt 33) ============
// Zero-trust, cryptographically verifiable execution contract for external consumers
export const ccN3ExecutionContracts = pgTable('cc_n3_execution_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  portalId: uuid('portal_id'),
  zoneId: uuid('zone_id'),
  
  // Immutable execution contract
  contractPayload: jsonb('contract_payload').notNull(),
  
  // Integrity & verification
  payloadHash: text('payload_hash').notNull(),
  payloadVersion: varchar('payload_version', { length: 10 }).notNull().default('v1'),
  
  // Issuance metadata
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  issuedBy: uuid('issued_by').notNull(),
  
  note: text('note'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_n3_execution_contract_run').on(table.runId),
  index('idx_n3_execution_contract_tenant_run').on(table.tenantId, table.runId),
]);

export type N3ExecutionContract = typeof ccN3ExecutionContracts.$inferSelect;

// ============ N3 EXECUTION RECEIPTS ============
// Append-only evidence channel for execution engines to report outcomes
// No UPDATE/DELETE - immutable once written
// Counts-only payload - no PII, no IDs, no contractors
export const ccN3ExecutionReceipts = pgTable('cc_n3_execution_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  runId: uuid('run_id').notNull(),
  executionContractId: uuid('execution_contract_id').notNull(),
  
  // Must match the contract's payload_hash for cryptographic binding
  payloadHash: text('payload_hash').notNull(),
  receiptVersion: integer('receipt_version').notNull().default(1),
  
  // Counts-only evidence payload - no PII
  receiptPayload: jsonb('receipt_payload').notNull(),
  
  // Execution engine identifier (not a user ID)
  reportedBy: text('reported_by').notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uniq_execution_contract_receipt').on(table.executionContractId, table.reportedAt),
  index('idx_execution_receipts_run').on(table.runId),
]);

export type N3ExecutionReceipt = typeof ccN3ExecutionReceipts.$inferSelect;

// ============ N3 EXECUTION VERIFICATIONS ============
// Advisory confidence scoring for execution receipts
// One verification per run (re-evaluation overwrites prior record)
// Advisory only - does not affect run status, billing, or notifications
export const ccN3ExecutionVerifications = pgTable('cc_n3_execution_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  runId: uuid('run_id').notNull(),
  executionContractId: uuid('execution_contract_id').notNull(),
  
  // Confidence assessment (advisory only)
  confidenceScore: integer('confidence_score').notNull(), // 0-100
  confidenceBand: text('confidence_band').notNull(), // low | medium | high
  
  // Counts-only verification signals
  signals: jsonb('signals').notNull(),
  notes: text('notes'),
  
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
  evaluatedBy: uuid('evaluated_by'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uniq_verification_run').on(table.runId),
]);

export type N3ExecutionVerification = typeof ccN3ExecutionVerifications.$inferSelect;

// ============ N3 EXECUTION ATTESTATIONS ============
// Human-in-the-loop advisory assessment layer
// One attestation per run, immutable after creation
// Advisory only - does not approve execution, billing, or outcomes
export const ccN3ExecutionAttestations = pgTable('cc_n3_execution_attestations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  runId: uuid('run_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  portalId: uuid('portal_id'),
  zoneId: uuid('zone_id'),
  
  // Assessment: acceptable | questionable | requires_follow_up
  assessment: varchar('assessment').notNull(),
  
  // Optional human explanation (max 500 chars)
  rationale: text('rationale'),
  
  // References to verification and contract for audit trail
  basedOnVerificationId: uuid('based_on_verification_id'),
  basedOnContractId: uuid('based_on_contract_id'),
  
  attestedBy: uuid('attested_by').notNull(),
  attestedAt: timestamp('attested_at', { withTimezone: true }).defaultNow(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uniq_attestation_run').on(table.runId),
]);

export type N3ExecutionAttestation = typeof ccN3ExecutionAttestations.$inferSelect;

// ============ HOUSEKEEPING CHECKLISTS ============
export const ccHousekeepingChecklists = pgTable('cc_housekeeping_checklists', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 20 }),
  
  taskType: varchar('task_type').notNull(),
  unitType: varchar('unit_type'),
  
  itemsJson: jsonb('items_json').notNull().default([]),
  
  estimatedMinutes: integer('estimated_minutes').default(60),
  
  status: varchar('status').default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertHousekeepingChecklistSchema = createInsertSchema(ccHousekeepingChecklists).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type HousekeepingChecklist = typeof ccHousekeepingChecklists.$inferSelect;
export type InsertHousekeepingChecklist = z.infer<typeof insertHousekeepingChecklistSchema>;

// ============ COMPLIANCE RULES ============
export const ccComplianceRules = pgTable('cc_compliance_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id'),
  authorityId: uuid('authority_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 30 }),
  
  category: varchar('category').notNull(),
  
  description: text('description').notNull(),
  rationale: text('rationale'),
  
  appliesTo: text('applies_to').array().default(['guest']),
  
  enforcementLevel: varchar('enforcement_level').default('standard'),
  
  firstOffenseAction: varchar('first_offense_action').default('warning'),
  secondOffenseAction: varchar('second_offense_action').default('citation'),
  thirdOffenseAction: varchar('third_offense_action').default('eviction'),
  
  fineAmountCad: numeric('fine_amount_cad', { precision: 10, scale: 2 }),
  
  effectiveDate: date('effective_date'),
  expiryDate: date('expiry_date'),
  seasonalMonths: integer('seasonal_months').array(),
  
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  
  bylawReference: text('bylaw_reference'),
  externalUrl: text('external_url'),
  
  status: varchar('status').default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertComplianceRuleSchema = createInsertSchema(ccComplianceRules).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type ComplianceRule = typeof ccComplianceRules.$inferSelect;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;

// ============ COMPLIANCE CHECKS ============
export const ccComplianceChecks = pgTable('cc_compliance_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id'),
  unitId: uuid('unit_id'),
  reservationId: uuid('reservation_id'),
  
  checkNumber: varchar('check_number', { length: 20 }).notNull().unique(),
  
  checkType: varchar('check_type').notNull(),
  
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  scheduledBy: text('scheduled_by'),
  
  assignedTo: text('assigned_to'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  locationDescription: text('location_description'),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  
  status: varchar('status').default('scheduled'),
  
  overallResult: varchar('overall_result'),
  
  checklistJson: jsonb('checklist_json').default([]),
  
  findingsSummary: text('findings_summary'),
  photosJson: jsonb('photos_json').default([]),
  
  actionsTaken: text('actions_taken'),
  warningsIssued: integer('warnings_issued').default(0),
  citationsIssued: integer('citations_issued').default(0),
  
  requiresFollowup: boolean('requires_followup').default(false),
  followupDate: date('followup_date'),
  followupNotes: text('followup_notes'),
  
  inspectorNotes: text('inspector_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertComplianceCheckSchema = createInsertSchema(ccComplianceChecks).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type ComplianceCheck = typeof ccComplianceChecks.$inferSelect;
export type InsertComplianceCheck = z.infer<typeof insertComplianceCheckSchema>;

// ============ INCIDENT REPORTS ============
export const ccIncidentReports = pgTable('cc_incident_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id'),
  unitId: uuid('unit_id'),
  reservationId: uuid('reservation_id'),
  locationId: uuid('location_id'),
  
  reportNumber: varchar('report_number', { length: 20 }).notNull().unique(),
  
  incidentType: varchar('incident_type').notNull(),
  
  severity: varchar('severity').default('moderate'),
  
  incidentAt: timestamp('incident_at', { withTimezone: true }).notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow(),
  locationDescription: text('location_description'),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  
  reportedByType: varchar('reported_by_type').default('staff'),
  reportedByName: text('reported_by_name'),
  reportedByContact: text('reported_by_contact'),
  reporterReservationId: uuid('reporter_reservation_id'),
  
  involvedPartiesJson: jsonb('involved_parties_json').default([]),
  
  title: text('title').notNull(),
  description: text('description'),
  
  photosJson: jsonb('photos_json').default([]),
  witnessStatements: jsonb('witness_statements').default([]),
  
  status: varchar('status').default('reported'),
  
  respondedBy: text('responded_by'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  responseTimeMinutes: integer('response_time_minutes'),
  
  investigationNotes: text('investigation_notes'),
  investigatedBy: text('investigated_by'),
  
  resolutionType: varchar('resolution_type'),
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: text('resolved_by'),
  
  complianceCheckId: uuid('compliance_check_id'),
  maintenanceRequestId: uuid('maintenance_request_id'),
  
  damageEstimateCad: numeric('damage_estimate_cad', { precision: 10, scale: 2 }),
  repairCostCad: numeric('repair_cost_cad', { precision: 10, scale: 2 }),
  
  requiresFollowup: boolean('requires_followup').default(false),
  followupDate: date('followup_date'),
  
  guestVisible: boolean('guest_visible').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertIncidentReportSchema = createInsertSchema(ccIncidentReports).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type IncidentReport = typeof ccIncidentReports.$inferSelect;
export type InsertIncidentReport = z.infer<typeof insertIncidentReportSchema>;

// ============================================================================
// CITATIONS
// ============================================================================

export const ccCitations = pgTable('cc_citations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  propertyId: uuid('property_id'),
  unitId: uuid('unit_id'),
  reservationId: uuid('reservation_id'),
  
  complianceRuleId: uuid('compliance_rule_id'),
  complianceCheckId: uuid('compliance_check_id'),
  incidentReportId: uuid('incident_report_id'),
  
  citationNumber: varchar('citation_number', { length: 20 }).notNull().unique(),
  
  violatorType: varchar('violator_type').default('guest'),
  violatorName: text('violator_name').notNull(),
  violatorEmail: text('violator_email'),
  violatorPhone: text('violator_phone'),
  violatorAddress: text('violator_address'),
  
  guestReservationId: uuid('guest_reservation_id'),
  
  vesselName: text('vessel_name'),
  vesselRegistration: text('vessel_registration'),
  vehiclePlate: text('vehicle_plate'),
  vehicleDescription: text('vehicle_description'),
  
  violationDate: date('violation_date').notNull(),
  violationTime: time('violation_time'),
  violationLocation: text('violation_location'),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lon: numeric('lon', { precision: 9, scale: 6 }),
  
  ruleCode: varchar('rule_code', { length: 30 }),
  ruleName: text('rule_name').notNull(),
  violationDescription: text('violation_description').notNull(),
  
  evidenceDescription: text('evidence_description'),
  photosJson: jsonb('photos_json').default([]),
  witnessNames: text('witness_names').array(),
  
  offenseNumber: integer('offense_number').default(1),
  priorCitationsJson: jsonb('prior_citations_json').default([]),
  
  fineAmountCad: numeric('fine_amount_cad', { precision: 10, scale: 2 }).default('0'),
  fineDueDate: date('fine_due_date'),
  
  paymentStatus: varchar('payment_status').default('unpaid'),
  amountPaidCad: numeric('amount_paid_cad', { precision: 10, scale: 2 }).default('0'),
  paymentDate: date('payment_date'),
  paymentReference: text('payment_reference'),
  
  status: varchar('status').default('issued'),
  
  issuedBy: text('issued_by').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow(),
  servedMethod: varchar('served_method'),
  servedAt: timestamp('served_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  
  additionalAction: varchar('additional_action'),
  actionNotes: text('action_notes'),
  
  issuerNotes: text('issuer_notes'),
  violatorStatement: text('violator_statement'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertCitationSchema = createInsertSchema(ccCitations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Citation = typeof ccCitations.$inferSelect;
export type InsertCitation = z.infer<typeof insertCitationSchema>;

// ============================================================================
// CITATION APPEALS
// ============================================================================

export const ccCitationAppeals = pgTable('cc_citation_appeals', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  citationId: uuid('citation_id').notNull(),
  
  appealNumber: varchar('appeal_number', { length: 20 }).notNull().unique(),
  
  appellantName: text('appellant_name').notNull(),
  appellantEmail: text('appellant_email'),
  appellantPhone: text('appellant_phone'),
  
  filedAt: timestamp('filed_at', { withTimezone: true }).defaultNow(),
  grounds: text('grounds').notNull(),
  supportingEvidence: text('supporting_evidence'),
  documentsJson: jsonb('documents_json').default([]),
  
  status: varchar('status').default('filed'),
  
  assignedTo: text('assigned_to'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  
  hearingDate: date('hearing_date'),
  hearingTime: time('hearing_time'),
  hearingLocation: text('hearing_location'),
  hearingNotes: text('hearing_notes'),
  
  decision: varchar('decision'),
  decisionReason: text('decision_reason'),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  
  newFineAmountCad: numeric('new_fine_amount_cad', { precision: 10, scale: 2 }),
  newDueDate: date('new_due_date'),
  
  internalNotes: text('internal_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertCitationAppealSchema = createInsertSchema(ccCitationAppeals).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type CitationAppeal = typeof ccCitationAppeals.$inferSelect;
export type InsertCitationAppeal = z.infer<typeof insertCitationAppealSchema>;

// ============================================================================
// VIOLATION HISTORY
// ============================================================================

export const ccViolationHistory = pgTable('cc_violation_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  
  identifierType: varchar('identifier_type').notNull(),
  identifierValue: text('identifier_value').notNull(),
  
  totalCitations: integer('total_citations').default(0),
  totalWarnings: integer('total_warnings').default(0),
  totalFinesCad: numeric('total_fines_cad', { precision: 10, scale: 2 }).default('0'),
  unpaidFinesCad: numeric('unpaid_fines_cad', { precision: 10, scale: 2 }).default('0'),
  
  lastCitationId: uuid('last_citation_id'),
  lastCitationDate: date('last_citation_date'),
  lastViolationType: varchar('last_violation_type'),
  
  standing: varchar('standing').default('good'),
  
  banReason: text('ban_reason'),
  banUntil: date('ban_until'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertViolationHistorySchema = createInsertSchema(ccViolationHistory).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type ViolationHistory = typeof ccViolationHistory.$inferSelect;
export type InsertViolationHistory = z.infer<typeof insertViolationHistorySchema>;

// ============================================================================
// VERIFIED IDENTITIES
// ============================================================================

export const ccVerifiedIdentities = pgTable('cc_verified_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  contactId: uuid('contact_id'),
  userId: uuid('user_id'),
  
  identityType: varchar('identity_type').notNull(),
  
  legalName: text('legal_name').notNull(),
  preferredName: text('preferred_name'),
  email: text('email'),
  phone: text('phone'),
  
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }),
  province: varchar('province', { length: 50 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 50 }).default('Canada'),
  
  idType: varchar('id_type'),
  idNumberHash: text('id_number_hash'),
  idIssuingAuthority: text('id_issuing_authority'),
  idExpiryDate: date('id_expiry_date'),
  idVerified: boolean('id_verified').default(false),
  idVerifiedAt: timestamp('id_verified_at', { withTimezone: true }),
  idVerifiedBy: text('id_verified_by'),
  
  photoIdUrl: text('photo_id_url'),
  selfieUrl: text('selfie_url'),
  photoMatchScore: numeric('photo_match_score', { precision: 5, scale: 2 }),
  
  verificationStatus: varchar('verification_status').default('unverified'),
  verificationLevel: varchar('verification_level').default('none'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verificationExpiresAt: timestamp('verification_expires_at', { withTimezone: true }),
  
  trustScore: integer('trust_score').default(50),
  trustFactorsJson: jsonb('trust_factors_json').default({}),
  
  violationHistoryId: uuid('violation_history_id'),
  
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  emergencyContactRelation: text('emergency_contact_relation'),
  
  communicationPreference: varchar('communication_preference').default('email'),
  languagePreference: varchar('language_preference').default('en'),
  
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertVerifiedIdentitySchema = createInsertSchema(ccVerifiedIdentities).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type VerifiedIdentity = typeof ccVerifiedIdentities.$inferSelect;
export type InsertVerifiedIdentity = z.infer<typeof insertVerifiedIdentitySchema>;

// ============================================================================
// VESSEL REGISTRATIONS
// ============================================================================

export const ccVesselRegistrations = pgTable('cc_vessel_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  ownerIdentityId: uuid('owner_identity_id'),
  
  registrationNumber: varchar('registration_number', { length: 30 }).notNull().unique(),
  
  vesselName: text('vessel_name').notNull(),
  vesselType: varchar('vessel_type').notNull(),
  
  tcRegistration: text('tc_registration'),
  hullId: text('hull_id'),
  
  lengthFt: numeric('length_ft', { precision: 6, scale: 2 }),
  beamFt: numeric('beam_ft', { precision: 6, scale: 2 }),
  draftFt: numeric('draft_ft', { precision: 6, scale: 2 }),
  grossTonnage: numeric('gross_tonnage', { precision: 8, scale: 2 }),
  
  propulsionType: varchar('propulsion_type'),
  engineHp: integer('engine_hp'),
  fuelType: varchar('fuel_type'),
  
  maxPassengers: integer('max_passengers'),
  maxCrew: integer('max_crew'),
  
  safetyEquipmentJson: jsonb('safety_equipment_json').default([]),
  lastSafetyInspection: date('last_safety_inspection'),
  safetyCertificateUrl: text('safety_certificate_url'),
  
  insuranceProvider: text('insurance_provider'),
  insurancePolicyNumber: text('insurance_policy_number'),
  insuranceExpiry: date('insurance_expiry'),
  insuranceVerified: boolean('insurance_verified').default(false),
  
  photosJson: jsonb('photos_json').default([]),
  
  verificationStatus: varchar('verification_status').default('pending'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by'),
  
  status: varchar('status').default('active'),
  
  homePort: text('home_port'),
  homeSlip: text('home_slip'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertVesselRegistrationSchema = createInsertSchema(ccVesselRegistrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type VesselRegistration = typeof ccVesselRegistrations.$inferSelect;
export type InsertVesselRegistration = z.infer<typeof insertVesselRegistrationSchema>;

// ============================================================================
// VEHICLE REGISTRATIONS
// ============================================================================

export const ccVehicleRegistrations = pgTable('cc_vehicle_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  ownerIdentityId: uuid('owner_identity_id'),
  
  registrationNumber: varchar('registration_number', { length: 30 }).notNull().unique(),
  
  plateNumber: varchar('plate_number', { length: 20 }).notNull(),
  plateProvince: varchar('plate_province', { length: 20 }).default('BC'),
  
  vehicleType: varchar('vehicle_type').notNull(),
  
  make: varchar('make', { length: 50 }),
  model: varchar('model', { length: 50 }),
  year: integer('year'),
  color: varchar('color', { length: 30 }),
  
  hasTrailer: boolean('has_trailer').default(false),
  trailerPlate: varchar('trailer_plate', { length: 20 }),
  trailerType: varchar('trailer_type'),
  trailerLengthFt: numeric('trailer_length_ft', { precision: 5, scale: 2 }),
  
  verificationStatus: varchar('verification_status').default('pending'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  
  insuranceVerified: boolean('insurance_verified').default(false),
  insuranceExpiry: date('insurance_expiry'),
  
  parkingPermitNumber: text('parking_permit_number'),
  parkingPermitExpiry: date('parking_permit_expiry'),
  
  accessZones: text('access_zones').array(),
  
  photosJson: jsonb('photos_json').default([]),
  
  status: varchar('status').default('active'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertVehicleRegistrationSchema = createInsertSchema(ccVehicleRegistrations).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type VehicleRegistration = typeof ccVehicleRegistrations.$inferSelect;
export type InsertVehicleRegistration = z.infer<typeof insertVehicleRegistrationSchema>;

// ============================================================================
// VERIFICATION REQUESTS
// ============================================================================

export const ccVerificationRequests = pgTable('cc_verification_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  identityId: uuid('identity_id'),
  
  requestNumber: varchar('request_number', { length: 20 }).notNull().unique(),
  
  verificationType: varchar('verification_type').notNull(),
  
  status: varchar('status').default('pending'),
  
  verificationCode: varchar('verification_code', { length: 10 }),
  codeExpiresAt: timestamp('code_expires_at', { withTimezone: true }),
  codeAttempts: integer('code_attempts').default(0),
  
  documentUrl: text('document_url'),
  documentType: varchar('document_type'),
  
  result: varchar('result'),
  resultDetails: jsonb('result_details'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const insertVerificationRequestSchema = createInsertSchema(ccVerificationRequests).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type VerificationRequest = typeof ccVerificationRequests.$inferSelect;
export type InsertVerificationRequest = z.infer<typeof insertVerificationRequestSchema>;

// ============================================================================
// AUTH ACCOUNTS
// ============================================================================

export const ccAuthAccounts = pgTable('cc_auth_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  identityId: uuid('identity_id'),
  tenantId: uuid('tenant_id'),
  
  authProvider: varchar('auth_provider').default('email'),
  authProviderId: text('auth_provider_id'),
  
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  
  phone: text('phone'),
  phoneVerified: boolean('phone_verified').default(false),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  
  passwordHash: text('password_hash'),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  
  timezone: varchar('timezone', { length: 50 }).default('America/Vancouver'),
  locale: varchar('locale', { length: 10 }).default('en-CA'),
  
  preferencesJson: jsonb('preferences_json').default({}),
  notificationSettingsJson: jsonb('notification_settings_json').default({
    email_marketing: false,
    email_transactional: true,
    email_updates: true,
    sms_alerts: false,
    push_enabled: false
  }),
  
  status: varchar('status').default('active'),
  
  suspensionReason: text('suspension_reason'),
  suspendedUntil: timestamp('suspended_until', { withTimezone: true }),
  
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  loginCount: integer('login_count').default(0),
  
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  onboardingStep: varchar('onboarding_step').default('welcome'),
  
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }),
  termsVersion: varchar('terms_version'),
  
  signupSource: varchar('signup_source'),
  signupReferrerId: uuid('signup_referrer_id'),
  utmSource: varchar('utm_source'),
  utmMedium: varchar('utm_medium'),
  utmCampaign: varchar('utm_campaign'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const insertAuthAccountSchema = createInsertSchema(ccAuthAccounts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type AuthAccount = typeof ccAuthAccounts.$inferSelect;
export type InsertAuthAccount = z.infer<typeof insertAuthAccountSchema>;

// ============================================================================
// AUTH SESSIONS
// ============================================================================

export const ccAuthSessions = pgTable('cc_auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  userId: uuid('user_id').notNull(),
  
  tokenHash: text('token_hash').notNull().unique(),
  
  refreshTokenHash: text('refresh_token_hash').unique(),
  refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }),
  
  sessionType: varchar('session_type').default('web'),
  
  deviceName: text('device_name'),
  deviceType: varchar('device_type'),
  browser: varchar('browser'),
  os: varchar('os'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  city: varchar('city'),
  region: varchar('region'),
  country: varchar('country', { length: 2 }),
  
  status: varchar('status').default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: varchar('revoked_reason'),
  
  isSuspicious: boolean('is_suspicious').default(false),
  mfaVerified: boolean('mfa_verified').default(false),
});

export const insertAuthSessionSchema = createInsertSchema(ccAuthSessions).omit({ 
  id: true, createdAt: true, lastUsedAt: true 
});
export type AuthSession = typeof ccAuthSessions.$inferSelect;
export type InsertAuthSession = z.infer<typeof insertAuthSessionSchema>;

// ============================================================================
// PASSWORD RESETS
// ============================================================================

export const ccPasswordResets = pgTable('cc_password_resets', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  userId: uuid('user_id').notNull(),
  
  tokenHash: text('token_hash').notNull().unique(),
  
  status: varchar('status').default('pending'),
  
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const insertPasswordResetSchema = createInsertSchema(ccPasswordResets).omit({ 
  id: true, createdAt: true 
});
export type PasswordReset = typeof ccPasswordResets.$inferSelect;
export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;

// ============================================================================
// ROLES (RBAC)
// ============================================================================

export const ccRoles = pgTable('cc_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id'),
  
  name: text('name').notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  description: text('description'),
  
  roleType: varchar('role_type').default('custom'),
  
  hierarchyLevel: integer('hierarchy_level').default(0),
  
  permissions: text('permissions').array().default([]),
  
  color: varchar('color', { length: 20 }),
  icon: varchar('icon', { length: 50 }),
  
  status: varchar('status').default('active'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertRoleSchema = createInsertSchema(ccRoles).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Role = typeof ccRoles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

// ============================================================================
// USER ROLES (ASSIGNMENTS)
// ============================================================================

export const ccUserRoles = pgTable('cc_user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  userId: uuid('user_id').notNull(),
  roleId: uuid('role_id').notNull(),
  portalId: uuid('portal_id'),
  
  propertyId: uuid('property_id'),
  
  assignedBy: uuid('assigned_by'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  status: varchar('status').default('active'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertUserRoleSchema = createInsertSchema(ccUserRoles).omit({ 
  id: true, createdAt: true, updatedAt: true, assignedAt: true 
});
export type UserRole = typeof ccUserRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

// ============================================================================
// PERMISSIONS (CATALOG)
// ============================================================================

export const ccPermissions = pgTable('cc_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  
  category: varchar('category', { length: 30 }).notNull(),
  
  resourceType: varchar('resource_type', { length: 50 }),
  
  action: varchar('action', { length: 20 }).notNull(),
  
  isDangerous: boolean('is_dangerous').default(false),
  requiresMfa: boolean('requires_mfa').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const insertPermissionSchema = createInsertSchema(ccPermissions).omit({ 
  id: true, createdAt: true 
});
export type Permission = typeof ccPermissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

// ============================================================================
// OPERATOR APPLICATIONS
// ============================================================================

export const ccOperatorApplications = pgTable('cc_operator_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id').notNull().references(() => ccPortals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  
  applicationNumber: varchar('application_number', { length: 20 }).notNull().unique(),
  
  operatorType: varchar('operator_type').notNull(),
  
  businessName: text('business_name').notNull(),
  businessLegalName: text('business_legal_name'),
  businessNumber: text('business_number'),
  gstNumber: text('gst_number'),
  pstNumber: text('pst_number'),
  
  businessStructure: varchar('business_structure'),
  
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),
  
  businessAddressLine1: text('business_address_line1'),
  businessAddressLine2: text('business_address_line2'),
  businessCity: varchar('business_city', { length: 100 }),
  businessProvince: varchar('business_province', { length: 50 }).default('BC'),
  businessPostalCode: varchar('business_postal_code', { length: 20 }),
  
  businessDescription: text('business_description'),
  servicesOffered: text('services_offered').array(),
  serviceAreas: text('service_areas').array(),
  
  yearsInBusiness: integer('years_in_business'),
  employeeCount: integer('employee_count'),
  seasonalOperation: boolean('seasonal_operation').default(false),
  operatingMonths: integer('operating_months').array(),
  
  businessLicenseNumber: text('business_license_number'),
  businessLicenseExpiry: date('business_license_expiry'),
  insuranceProvider: text('insurance_provider'),
  insurancePolicyNumber: text('insurance_policy_number'),
  insuranceExpiry: date('insurance_expiry'),
  liabilityCoverageAmount: numeric('liability_coverage_amount', { precision: 12, scale: 2 }),
  
  transportLicense: text('transport_license'),
  foodSafeCertificate: text('food_safe_certificate'),
  guideCertification: text('guide_certification'),
  worksafeAccount: text('worksafe_account'),
  
  documentsJson: jsonb('documents_json').default([]),
  referencesJson: jsonb('references_json').default([]),
  
  status: varchar('status').default('draft'),
  
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  
  rejectionReason: text('rejection_reason'),
  
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  
  termsAccepted: boolean('terms_accepted').default(false),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  codeOfConductAccepted: boolean('code_of_conduct_accepted').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertOperatorApplicationSchema = createInsertSchema(ccOperatorApplications).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type OperatorApplication = typeof ccOperatorApplications.$inferSelect;
export type InsertOperatorApplication = z.infer<typeof insertOperatorApplicationSchema>;

// ============================================================================
// OPERATORS
// ============================================================================

export const ccOperators = pgTable('cc_operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  portalId: uuid('portal_id').notNull().references(() => ccPortals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  applicationId: uuid('application_id').references(() => ccOperatorApplications.id),
  identityId: uuid('identity_id').references(() => ccVerifiedIdentities.id),
  tenantId: uuid('tenant_id'),
  
  operatorNumber: varchar('operator_number', { length: 20 }).notNull().unique(),
  
  operatorType: varchar('operator_type').notNull(),
  operatorSubtypes: text('operator_subtypes').array(),
  
  businessName: text('business_name').notNull(),
  businessLegalName: text('business_legal_name'),
  businessNumber: text('business_number'),
  gstNumber: text('gst_number'),
  
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),
  websiteUrl: text('website_url'),
  
  businessAddressJson: jsonb('business_address_json'),
  
  description: text('description'),
  tagline: varchar('tagline', { length: 200 }),
  logoUrl: text('logo_url'),
  coverPhotoUrl: text('cover_photo_url'),
  photosJson: jsonb('photos_json').default([]),
  
  servicesOffered: text('services_offered').array(),
  serviceAreas: text('service_areas').array(),
  amenities: text('amenities').array(),
  
  seasonalOperation: boolean('seasonal_operation').default(false),
  operatingMonths: integer('operating_months').array(),
  operatingHoursJson: jsonb('operating_hours_json'),
  
  employeeCount: integer('employee_count'),
  
  businessLicenseNumber: text('business_license_number'),
  businessLicenseExpiry: date('business_license_expiry'),
  insuranceExpiry: date('insurance_expiry'),
  liabilityCoverageAmount: numeric('liability_coverage_amount', { precision: 12, scale: 2 }),
  
  verificationStatus: varchar('verification_status').default('pending'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verificationExpiresAt: timestamp('verification_expires_at', { withTimezone: true }),
  lastComplianceCheck: date('last_compliance_check'),
  
  ratingAverage: numeric('rating_average', { precision: 3, scale: 2 }).default('0'),
  ratingCount: integer('rating_count').default(0),
  
  status: varchar('status').default('active'),
  
  featured: boolean('featured').default(false),
  acceptsOnlineReservation: boolean('accepts_online_reservation').default(true),
  instantConfirmation: boolean('instant_confirmation').default(false),
  
  commissionRatePercent: numeric('commission_rate_percent', { precision: 5, scale: 2 }).default('10.00'),
  payoutMethod: varchar('payout_method').default('bank_transfer'),
  payoutDetailsJson: jsonb('payout_details_json'),
  
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  
  internalNotes: text('internal_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertOperatorSchema = createInsertSchema(ccOperators).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type Operator = typeof ccOperators.$inferSelect;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;

// ============================================================================
// OPERATOR DOCUMENTS
// ============================================================================

export const ccOperatorDocuments = pgTable('cc_operator_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  operatorId: uuid('operator_id').notNull().references(() => ccOperators.id, { onDelete: 'cascade' }),
  
  documentType: varchar('document_type').notNull(),
  
  documentName: text('document_name').notNull(),
  documentNumber: text('document_number'),
  
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 20 }),
  fileSizeBytes: integer('file_size_bytes'),
  
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  
  verificationStatus: varchar('verification_status').default('pending'),
  verifiedBy: uuid('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const insertOperatorDocumentSchema = createInsertSchema(ccOperatorDocuments).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type OperatorDocument = typeof ccOperatorDocuments.$inferSelect;
export type InsertOperatorDocument = z.infer<typeof insertOperatorDocumentSchema>;

// ============================================================================
// P2.18-B OPERATOR ROLES (Emergency/Legal/Insurance/Platform Operators)
// ============================================================================

export const operatorRoleKeyEnum = pgEnum('operator_role_key', [
  'emergency_operator',
  'legal_operator', 
  'insurance_operator',
  'platform_operator'
]);

export const operatorRoleAssignmentStatusEnum = pgEnum('operator_role_assignment_status', [
  'active',
  'revoked'
]);

export const ccOperatorRoles = pgTable('cc_operator_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  roleKey: operatorRoleKeyEnum('role_key').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantRoleKeyUnique: uniqueIndex('cc_operator_roles_tenant_role_key_unique').on(table.tenantId, table.roleKey),
  tenantIdx: index('idx_cc_operator_roles_tenant').on(table.tenantId),
}));

export const insertOperatorRoleSchema = createInsertSchema(ccOperatorRoles).omit({
  id: true, createdAt: true, updatedAt: true
});
export type OperatorRole = typeof ccOperatorRoles.$inferSelect;
export type InsertOperatorRole = z.infer<typeof insertOperatorRoleSchema>;

export const ccOperatorRoleAssignments = pgTable('cc_operator_role_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  circleId: uuid('circle_id'),
  individualId: uuid('individual_id').notNull(),
  roleId: uuid('role_id').notNull().references(() => ccOperatorRoles.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  assignedByIndividualId: uuid('assigned_by_individual_id'),
  status: operatorRoleAssignmentStatusEnum('status').notNull().default('active'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByIndividualId: uuid('revoked_by_individual_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIndividualStatusIdx: index('idx_cc_operator_role_assignments_tenant_individual_status').on(table.tenantId, table.individualId, table.status),
  roleIdx: index('idx_cc_operator_role_assignments_role').on(table.roleId),
  circleIdx: index('idx_cc_operator_role_assignments_circle').on(table.circleId),
}));

export const insertOperatorRoleAssignmentSchema = createInsertSchema(ccOperatorRoleAssignments).omit({
  id: true, createdAt: true
});
export type OperatorRoleAssignment = typeof ccOperatorRoleAssignments.$inferSelect;
export type InsertOperatorRoleAssignment = z.infer<typeof insertOperatorRoleAssignmentSchema>;

// ============================================================================
// P2.18-B OPERATOR EVENTS (Audit Log - Append-Only)
// ============================================================================

export const ccOperatorEvents = pgTable('cc_operator_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  circleId: uuid('circle_id'),
  operatorIndividualId: uuid('operator_individual_id').notNull(),
  actionKey: text('action_key').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload').notNull().default({}),
}, (table) => ({
  tenantIdx: index('idx_cc_operator_events_tenant').on(table.tenantId),
  circleIdx: index('idx_cc_operator_events_circle').on(table.circleId),
  operatorIdx: index('idx_cc_operator_events_operator').on(table.operatorIndividualId),
  actionIdx: index('idx_cc_operator_events_action').on(table.actionKey),
  subjectIdx: index('idx_cc_operator_events_subject').on(table.subjectType, table.subjectId),
  occurredIdx: index('idx_cc_operator_events_occurred').on(table.occurredAt),
}));

export const insertOperatorEventSchema = createInsertSchema(ccOperatorEvents).omit({
  id: true, createdAt: true
});
export type OperatorEvent = typeof ccOperatorEvents.$inferSelect;
export type InsertOperatorEvent = z.infer<typeof insertOperatorEventSchema>;

// ============================================================================
// CONVERSATION PARTICIPANTS (Bundle 099)
// ============================================================================

export const ccConversationParticipants = pgTable("cc_conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  
  partyId: uuid("party_id"),
  individualId: uuid("individual_id"),
  
  actorRole: text("actor_role"),
  
  canSend: boolean("can_send").notNull().default(true),
  canSeeHistory: boolean("can_see_history").notNull().default(true),
  
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationParticipantSchema = createInsertSchema(ccConversationParticipants).omit({
  id: true,
  createdAt: true,
});
export type ConversationParticipant = typeof ccConversationParticipants.$inferSelect;
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;

// ============================================================================
// ACTOR TYPES (Bundle 100)
// ============================================================================

export const ccActorTypes = pgTable("cc_actor_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  codeIdx: index("idx_cc_actor_types_code").on(table.code),
  activeIdx: index("idx_cc_actor_types_active").on(table.isActive),
}));

export const insertActorTypeSchema = createInsertSchema(ccActorTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ActorType = typeof ccActorTypes.$inferSelect;
export type InsertActorType = z.infer<typeof insertActorTypeSchema>;

// ============================================================================
// TENANT ACTOR ROLES (Bundle 100)
// ============================================================================

export const ccTenantActorRoles = pgTable("cc_tenant_actor_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  actorTypeId: uuid("actor_type_id").notNull().references(() => ccActorTypes.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_tenant_actor_roles_tenant").on(table.tenantId),
  actorIdx: index("idx_cc_tenant_actor_roles_actor").on(table.actorTypeId),
  uniqueTenantActor: uniqueIndex("cc_tenant_actor_roles_tenant_actor_unique").on(table.tenantId, table.actorTypeId),
}));

export const insertTenantActorRoleSchema = createInsertSchema(ccTenantActorRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TenantActorRole = typeof ccTenantActorRoles.$inferSelect;
export type InsertTenantActorRole = z.infer<typeof insertTenantActorRoleSchema>;

// ============================================================================
// PLANS (Bundle 100)
// ============================================================================

export const ccPlans = pgTable("cc_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorTypeId: uuid("actor_type_id").notNull().references(() => ccActorTypes.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  monthlyPrice: numeric("monthly_price").notNull().default("0"),
  annualPrice: numeric("annual_price"),
  seasonalPrice: numeric("seasonal_price"),
  billingInterval: text("billing_interval").notNull().default("monthly"),
  currency: text("currency").notNull().default("CAD"),
  tierLevel: integer("tier_level").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  actorIdx: index("idx_cc_plans_actor").on(table.actorTypeId),
  codeIdx: index("idx_cc_plans_code").on(table.code),
  tierIdx: index("idx_cc_plans_tier").on(table.actorTypeId, table.tierLevel),
}));

export const insertPlanSchema = createInsertSchema(ccPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Plan = typeof ccPlans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

// ============================================================================
// PLAN ENTITLEMENTS (Bundle 100)
// ============================================================================

export const ccPlanEntitlements = pgTable("cc_plan_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => ccPlans.id, { onDelete: "cascade" }),
  entitlementKey: text("entitlement_key").notNull(),
  valueType: text("value_type").notNull().default("boolean"),
  booleanValue: boolean("boolean_value"),
  numericValue: integer("numeric_value"),
  textValue: text("text_value"),
  displayName: text("display_name"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  planIdx: index("idx_cc_plan_entitlements_plan").on(table.planId),
  keyIdx: index("idx_cc_plan_entitlements_key").on(table.entitlementKey),
  uniquePlanKey: uniqueIndex("cc_plan_entitlements_plan_key_unique").on(table.planId, table.entitlementKey),
}));

export const insertPlanEntitlementSchema = createInsertSchema(ccPlanEntitlements).omit({
  id: true,
  createdAt: true,
});
export type PlanEntitlement = typeof ccPlanEntitlements.$inferSelect;
export type InsertPlanEntitlement = z.infer<typeof insertPlanEntitlementSchema>;

// ============================================================================
// SUBSCRIPTIONS (Bundle 100)
// V3+: Tenant-owned only (party/individual can be added later)
// ============================================================================

export const ccSubscriptions = pgTable("cc_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  planId: uuid("plan_id").notNull().references(() => ccPlans.id),
  actorTypeId: uuid("actor_type_id").notNull().references(() => ccActorTypes.id),
  status: text("status").notNull().default("active"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  billingMethod: text("billing_method").notNull().default("invoice"),
  billingEmail: text("billing_email"),
  externalCustomerId: text("external_customer_id"),
  externalSubscriptionId: text("external_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
}, (table) => ({
  tenantIdx: index("idx_cc_subscriptions_tenant").on(table.tenantId),
  planIdx: index("idx_cc_subscriptions_plan").on(table.planId),
  statusIdx: index("idx_cc_subscriptions_status").on(table.status),
  uniqueTenantActor: uniqueIndex("cc_subscriptions_tenant_actor_unique").on(table.tenantId, table.actorTypeId),
}));

export const insertSubscriptionSchema = createInsertSchema(ccSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Subscription = typeof ccSubscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// ============================================================================
// COMMUNITIES (Bundle 102)
// ============================================================================

export const ccCommunities = pgTable("cc_communities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  regionName: text("region_name"),
  province: text("province").default("BC"),
  country: text("country").default("Canada"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  timezone: text("timezone").default("America/Vancouver"),
  populationEstimate: integer("population_estimate"),
  isRemote: boolean("is_remote").default(false),
  accessNotes: text("access_notes"),
  portalId: uuid("portal_id").references(() => ccPortals.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("idx_cc_communities_slug").on(table.slug),
  portalIdx: index("idx_cc_communities_portal").on(table.portalId),
}));

export const insertCommunitySchema = createInsertSchema(ccCommunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Community = typeof ccCommunities.$inferSelect;
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;

// ============================================================================
// JOBS (Bundle 102) - Cold-Start Wedge
// ============================================================================

export const jobRoleCategoryEnum = pgEnum("job_role_category", [
  "housekeeping", "cook", "server", "bartender", "maintenance", 
  "landscaping", "marina", "dock_attendant", "driver", "guide", 
  "retail", "general_labour", "skilled_trade", "administrative", 
  "management", "security", "childcare", "healthcare", "other"
]);

export const jobEmploymentTypeEnum = pgEnum("job_employment_type", [
  "full_time", "part_time", "seasonal", "contract", "on_call", "temporary"
]);

export const jobUrgencyEnum = pgEnum("job_urgency", [
  "normal", "urgent", "emergency"
]);

export const jobVerificationStateEnum = pgEnum("job_verification_state", [
  "draft", "awaiting_employer", "verified", "rejected", "expired"
]);

export const jobStatusEnum = pgEnum("job_status", [
  "open", "paused", "filled", "expired", "cancelled"
]);

export const ccJobs = pgTable("cc_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug"),
  roleCategory: text("role_category").notNull(),
  employmentType: text("employment_type").notNull(),
  
  communityId: uuid("community_id").references(() => ccCommunities.id),
  locationText: text("location_text"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  
  description: text("description").notNull(),
  responsibilities: text("responsibilities"),
  requirements: text("requirements"),
  niceToHave: text("nice_to_have"),
  
  startDate: date("start_date"),
  endDate: date("end_date"),
  isFlexibleDates: boolean("is_flexible_dates").default(false),
  hoursPerWeek: integer("hours_per_week"),
  shiftDetails: text("shift_details"),
  
  urgency: text("urgency").notNull().default("normal"),
  
  housingProvided: boolean("housing_provided").default(false),
  housingType: text("housing_type"),
  housingDescription: text("housing_description"),
  rvFriendly: boolean("rv_friendly").default(false),
  mealsProvided: boolean("meals_provided").default(false),
  transportAssistance: boolean("transport_assistance").default(false),
  relocationAssistance: boolean("relocation_assistance").default(false),
  
  payType: text("pay_type"),
  payMin: numeric("pay_min"),
  payMax: numeric("pay_max"),
  currency: text("currency").default("CAD"),
  benefitsDescription: text("benefits_description"),
  
  disclosedPayMin: numeric("disclosed_pay_min"),
  disclosedPayMax: numeric("disclosed_pay_max"),
  showPay: boolean("show_pay").default(true),
  
  sourceType: text("source_type").notNull().default("manual"),
  sourceUrl: text("source_url"),
  verificationState: text("verification_state").notNull().default("draft"),
  disclaimerText: text("disclaimer_text"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedByUserId: uuid("verified_by_user_id"),
  
  tenantId: uuid("tenant_id"),
  operatorId: uuid("operator_id").references(() => ccOperators.id),
  partyId: uuid("party_id"),
  portalId: uuid("portal_id").references(() => ccPortals.id),
  createdByUserId: uuid("created_by_user_id"),
  
  status: text("status").notNull().default("open"),
  filledAt: timestamp("filled_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  viewCount: integer("view_count").default(0),
  applicationCount: integer("application_count").default(0),
  
  nocCode: varchar("noc_code", { length: 10 }),
  socCode: varchar("soc_code", { length: 10 }),
  occupationalCategory: text("occupational_category"),
  taxonomy: jsonb("taxonomy").default({}),
  
  brandTenantId: uuid("brand_tenant_id"),
  brandNameSnapshot: text("brand_name_snapshot"),
  legalPartyId: uuid("legal_party_id"),
  legalNameSnapshot: text("legal_name_snapshot"),
  legalTradeNameSnapshot: text("legal_trade_name_snapshot"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  communityIdx: index("idx_cc_jobs_community").on(table.communityId),
  statusIdx: index("idx_cc_jobs_status").on(table.status),
  roleIdx: index("idx_cc_jobs_role").on(table.roleCategory),
  nocCodeIdx: index("idx_jobs_noc_code").on(table.nocCode),
  brandTenantIdx: index("idx_jobs_brand_tenant").on(table.brandTenantId),
}));

export const insertJobSchema = createInsertSchema(ccJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  applicationCount: true,
});
export type Job = typeof ccJobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

// ============================================================================
// JOB POSTINGS (Bundle 102)
// ============================================================================

export const ccJobPostings = pgTable("cc_job_postings", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => ccJobs.id, { onDelete: "cascade" }),
  portalId: uuid("portal_id").notNull().references(() => ccPortals.id, { onDelete: "cascade" }),
  isFeatured: boolean("is_featured").default(false),
  isPinned: boolean("is_pinned").default(false),
  isHidden: boolean("is_hidden").default(false),
  pinRank: integer("pin_rank"),
  customTitle: text("custom_title"),
  customDescription: text("custom_description"),
  autoSyndicated: boolean("auto_syndicated").default(false),
  syndicationRuleId: uuid("syndication_rule_id"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  
  publishState: text("publish_state").notNull().default("draft"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByIdentityId: uuid("reviewed_by_identity_id"),
  rejectionReason: text("rejection_reason"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => ({
  uniqueJobPortal: uniqueIndex("idx_cc_job_postings_unique").on(table.jobId, table.portalId),
  portalIdx: index("idx_cc_job_postings_portal").on(table.portalId),
  publishStateIdx: index("idx_job_postings_publish_state").on(table.publishState),
}));

export const insertJobPostingSchema = createInsertSchema(ccJobPostings).omit({
  id: true,
  createdAt: true,
});
export type JobPosting = typeof ccJobPostings.$inferSelect;
export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;

// ============================================================================
// JOB APPLICANTS (Bundle 102)
// ============================================================================

export const ccJobApplicants = pgTable("cc_job_applicants", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => ccJobs.id, { onDelete: "cascade" }),
  individualId: uuid("individual_id"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  coverLetter: text("cover_letter"),
  resumeUrl: text("resume_url"),
  resumeMediaId: uuid("resume_media_id"),
  status: text("status").notNull().default("applied"),
  internalNotes: text("internal_notes"),
  routedToEmail: text("routed_to_email"),
  routedAt: timestamp("routed_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  responseType: text("response_type"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobIdx: index("idx_cc_job_applicants_job").on(table.jobId),
  individualIdx: index("idx_cc_job_applicants_individual").on(table.individualId),
  statusIdx: index("idx_cc_job_applicants_status").on(table.status),
}));

export const insertJobApplicantSchema = createInsertSchema(ccJobApplicants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  appliedAt: true,
});
export type JobApplicant = typeof ccJobApplicants.$inferSelect;
export type InsertJobApplicant = z.infer<typeof insertJobApplicantSchema>;

// ============================================================================
// VALUE EVENTS (Bundle 103)
// ============================================================================

export const valueEventTypeEnum = pgEnum("value_event_type", [
  "worker_placed", "run_filled", "emergency_replacement", "materials_routed",
  "occupancy_unlocked", "bundle_confirmed",
  "cross_tenant_reservation", "incident_resolved",
  "turnover_orchestrated", "workforce_cluster", "housing_bundle", "emergency_coverage",
  "subscription_charge", "usage_overage", "premium_feature", "custom"
]);

export const ccValueEvents = pgTable("cc_value_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  eventCode: text("event_code"),
  
  tenantId: uuid("tenant_id"),
  partyId: uuid("party_id"),
  individualId: uuid("individual_id"),
  actorTypeId: uuid("actor_type_id").references(() => ccActorTypes.id),
  
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  
  baseAmount: numeric("base_amount").notNull().default("0"),
  scarcityMultiplier: numeric("scarcity_multiplier").default("1.0"),
  urgencyMultiplier: numeric("urgency_multiplier").default("1.0"),
  finalAmount: numeric("final_amount").notNull().default("0"),
  currency: text("currency").default("CAD"),
  
  isBillable: boolean("is_billable").notNull().default(true),
  isBilled: boolean("is_billed").default(false),
  billedAt: timestamp("billed_at", { withTimezone: true }),
  ledgerEntryId: uuid("ledger_entry_id"),
  
  status: text("status").notNull().default("pending"),
  waived: boolean("waived").default(false),
  waivedReason: text("waived_reason"),
  waivedByUserId: uuid("waived_by_user_id"),
  
  metadata: jsonb("metadata").default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_value_events_tenant").on(table.tenantId),
  typeIdx: index("idx_cc_value_events_type").on(table.eventType),
  statusIdx: index("idx_cc_value_events_status").on(table.status),
}));

export const insertValueEventSchema = createInsertSchema(ccValueEvents).omit({
  id: true,
  createdAt: true,
});
export type ValueEvent = typeof ccValueEvents.$inferSelect;
export type InsertValueEvent = z.infer<typeof insertValueEventSchema>;

// ============================================================================
// LEDGER ENTRIES (Bundle 103)
// ============================================================================

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "charge", "payment", "credit", "adjustment", "refund", "writeoff"
]);

export const ccLedgerEntries = pgTable("cc_ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  tenantId: uuid("tenant_id"),
  partyId: uuid("party_id"),
  individualId: uuid("individual_id"),
  
  entryType: text("entry_type").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("CAD"),
  
  description: text("description").notNull(),
  lineItemCode: text("line_item_code"),
  
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  valueEventId: uuid("value_event_id").references(() => ccValueEvents.id),
  
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  
  invoiceNumber: text("invoice_number"),
  invoiceDate: date("invoice_date"),
  
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_ledger_entries_tenant").on(table.tenantId),
  typeIdx: index("idx_cc_ledger_entries_type").on(table.entryType),
  statusIdx: index("idx_cc_ledger_entries_status").on(table.status),
  valueEventIdx: index("idx_cc_ledger_entries_value_event").on(table.valueEventId),
}));

export const insertLedgerEntrySchema = createInsertSchema(ccLedgerEntries).omit({
  id: true,
  createdAt: true,
});
export type LedgerEntry = typeof ccLedgerEntries.$inferSelect;
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;

// ============================================================================
// INVITATIONS (Bundle 104)
// ============================================================================

export const invitationContextTypeEnum = pgEnum("invitation_context_type", [
  "job", "service_run", "property", "crew", "conversation", 
  "portal", "community", "tenant", "standby_pool"
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending", "sent", "viewed", "claimed", "expired", "revoked"
]);

export const inviteeRoleEnum = pgEnum("invitee_role", [
  "employer", "worker", "property_owner", "pic", "coordinator", "crew_member", "guest"
]);

export const ccInvitations = pgTable("cc_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  inviterTenantId: uuid("inviter_tenant_id"),
  inviterPartyId: uuid("inviter_party_id"),
  inviterIndividualId: uuid("inviter_individual_id"),
  
  contextType: invitationContextTypeEnum("context_type").notNull(),
  contextId: uuid("context_id").notNull(),
  contextName: text("context_name"),
  
  inviteeRole: inviteeRoleEnum("invitee_role").notNull(),
  inviteeEmail: text("invitee_email"),
  inviteePhone: text("invitee_phone"),
  inviteeName: text("invitee_name"),
  
  claimToken: text("claim_token").notNull().unique(),
  claimTokenExpiresAt: timestamp("claim_token_expires_at", { withTimezone: true }).notNull(),
  
  status: invitationStatusEnum("status").notNull().default("pending"),
  
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentVia: text("sent_via"),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedByTenantId: uuid("claimed_by_tenant_id"),
  claimedByPartyId: uuid("claimed_by_party_id"),
  claimedByIndividualId: uuid("claimed_by_individual_id"),
  
  grantedAccessType: text("granted_access_type"),
  grantedActorTypeId: uuid("granted_actor_type_id").references(() => ccActorTypes.id),
  
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: uuid("revoked_by_user_id"),
  revocationReason: text("revocation_reason"),
  isSilentRevocation: boolean("is_silent_revocation").default(true),
  
  message: text("message"),
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_cc_invitations_token").on(table.claimToken),
  contextIdx: index("idx_cc_invitations_context").on(table.contextType, table.contextId),
  inviterTenantIdx: index("idx_cc_invitations_inviter_tenant").on(table.inviterTenantId),
  inviteeEmailIdx: index("idx_cc_invitations_invitee_email").on(table.inviteeEmail),
  statusIdx: index("idx_cc_invitations_status").on(table.status),
}));

export const insertInvitationSchema = createInsertSchema(ccInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Invitation = typeof ccInvitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

// ============================================================================
// REFERRALS (Bundle 104)
// ============================================================================

export const ccReferrals = pgTable("cc_referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  invitationId: uuid("invitation_id").references(() => ccInvitations.id),
  
  referrerTenantId: uuid("referrer_tenant_id"),
  referrerPartyId: uuid("referrer_party_id"),
  referrerIndividualId: uuid("referrer_individual_id"),
  
  referredTenantId: uuid("referred_tenant_id"),
  referredPartyId: uuid("referred_party_id"),
  referredIndividualId: uuid("referred_individual_id"),
  
  referralType: text("referral_type").notNull(),
  contextType: invitationContextTypeEnum("context_type"),
  contextId: uuid("context_id"),
  
  attributedValue: numeric("attributed_value").default("0"),
  rewardEligible: boolean("reward_eligible").default(false),
  rewardPaid: boolean("reward_paid").default(false),
  rewardPaidAt: timestamp("reward_paid_at", { withTimezone: true }),
  rewardAmount: numeric("reward_amount"),
  
  referredAt: timestamp("referred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  referrerIdx: index("idx_cc_referrals_referrer").on(table.referrerTenantId),
  referredIdx: index("idx_cc_referrals_referred").on(table.referredTenantId),
  invitationIdx: index("idx_cc_referrals_invitation").on(table.invitationId),
  typeIdx: index("idx_cc_referrals_type").on(table.referralType),
}));

export const insertReferralSchema = createInsertSchema(ccReferrals).omit({
  id: true,
  createdAt: true,
});
export type Referral = typeof ccReferrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

// ============================================================================
// CLAIM LINKS (Bundle 104)
// ============================================================================

export const claimLinkTypeEnum = pgEnum("claim_link_type", [
  "job", "property", "business", "service_listing", "equipment"
]);

export const claimLinkStatusEnum = pgEnum("claim_link_status", [
  "active", "claimed", "expired", "revoked"
]);

export const ccClaimLinks = pgTable("cc_claim_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  claimType: claimLinkTypeEnum("claim_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  entityName: text("entity_name"),
  
  token: text("token").notNull().unique(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  
  allowedEmailDomain: text("allowed_email_domain"),
  allowedEmail: text("allowed_email"),
  
  verificationMethod: text("verification_method").default("email"),
  requiresDocument: boolean("requires_document").default(false),
  documentType: text("document_type"),
  
  status: claimLinkStatusEnum("status").notNull().default("active"),
  
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedByTenantId: uuid("claimed_by_tenant_id"),
  claimedByPartyId: uuid("claimed_by_party_id"),
  claimedByIndividualId: uuid("claimed_by_individual_id"),
  verificationCompletedAt: timestamp("verification_completed_at", { withTimezone: true }),
  
  autoCreateTenant: boolean("auto_create_tenant").default(false),
  autoCreateOperator: boolean("auto_create_operator").default(false),
  autoAssignRole: text("auto_assign_role"),
  
  createdByTenantId: uuid("created_by_tenant_id"),
  createdByUserId: uuid("created_by_user_id"),
  
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_cc_claim_links_token").on(table.token),
  entityIdx: index("idx_cc_claim_links_entity").on(table.claimType, table.entityId),
  statusIdx: index("idx_cc_claim_links_status").on(table.status),
}));

export const insertClaimLinkSchema = createInsertSchema(ccClaimLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ClaimLink = typeof ccClaimLinks.$inferSelect;
export type InsertClaimLink = z.infer<typeof insertClaimLinkSchema>;

// ============================================================================
// PORTAL GOVERNANCE (Bundle 105)
// ============================================================================

export const portalRoleTypeEnum = pgEnum("portal_role_type", [
  "owner", "admin", "moderator", "editor", "member", "guest"
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending", "approved", "rejected", "flagged", "auto_approved", "expired"
]);

export const moderationActionEnum = pgEnum("moderation_action", [
  "approve", "reject", "flag", "unflag", "escalate", "auto_approve", "auto_reject", "expire"
]);

export const moderableContentTypeEnum = pgEnum("moderable_content_type", [
  "job", "job_posting", "listing", "event", "review", "comment", "profile", "message"
]);

// ============================================================================
// PORTAL MEMBERS (Bundle 105)
// ============================================================================

export const ccPortalMembers = pgTable("cc_portal_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull().references(() => ccPortals.id, { onDelete: "cascade" }),
  
  tenantId: uuid("tenant_id"),
  partyId: uuid("party_id"),
  individualId: uuid("individual_id"),
  
  role: portalRoleTypeEnum("role").notNull().default("member"),
  
  canPostJobs: boolean("can_post_jobs").default(true),
  canPostListings: boolean("can_post_listings").default(true),
  canInviteMembers: boolean("can_invite_members").default(false),
  canModerate: boolean("can_moderate").default(false),
  canEditSettings: boolean("can_edit_settings").default(false),
  
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  
  invitedByMemberId: uuid("invited_by_member_id"),
  invitationId: uuid("invitation_id").references(() => ccInvitations.id),
  
  displayName: text("display_name"),
  bio: text("bio"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalIdx: index("idx_cc_portal_members_portal").on(table.portalId),
  tenantIdx: index("idx_cc_portal_members_tenant").on(table.tenantId),
  roleIdx: index("idx_cc_portal_members_role").on(table.portalId, table.role),
}));

export const insertPortalMemberSchema = createInsertSchema(ccPortalMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PortalMember = typeof ccPortalMembers.$inferSelect;
export type InsertPortalMember = z.infer<typeof insertPortalMemberSchema>;

// ============================================================================
// PORTAL SETTINGS (Bundle 105)
// ============================================================================

export const ccPortalSettings = pgTable("cc_portal_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull().references(() => ccPortals.id, { onDelete: "cascade" }).unique(),
  
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#3B82F6"),
  secondaryColor: text("secondary_color").default("#1E40AF"),
  customCss: text("custom_css"),
  
  autoApproveJobs: boolean("auto_approve_jobs").default(false),
  autoApproveListings: boolean("auto_approve_listings").default(false),
  requireVerificationForPosting: boolean("require_verification_for_posting").default(true),
  allowAnonymousApplications: boolean("allow_anonymous_applications").default(true),
  
  moderationEnabled: boolean("moderation_enabled").default(true),
  silentRejection: boolean("silent_rejection").default(true),
  rejectionNotificationEnabled: boolean("rejection_notification_enabled").default(false),
  autoExpireDays: integer("auto_expire_days").default(90),
  
  jobsEnabled: boolean("jobs_enabled").default(true),
  listingsEnabled: boolean("listings_enabled").default(true),
  eventsEnabled: boolean("events_enabled").default(false),
  messagingEnabled: boolean("messaging_enabled").default(true),
  reviewsEnabled: boolean("reviews_enabled").default(false),
  
  allowInboundSyndication: boolean("allow_inbound_syndication").default(true),
  allowOutboundSyndication: boolean("allow_outbound_syndication").default(true),
  syndicationRequiresApproval: boolean("syndication_requires_approval").default(true),
  
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ogImageUrl: text("og_image_url"),
  
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  
  termsUrl: text("terms_url"),
  privacyUrl: text("privacy_url"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortalSettingsSchema = createInsertSchema(ccPortalSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PortalSettings = typeof ccPortalSettings.$inferSelect;
export type InsertPortalSettings = z.infer<typeof insertPortalSettingsSchema>;

// ============================================================================
// MODERATION QUEUE (Bundle 105)
// ============================================================================

export const ccModerationQueue = pgTable("cc_moderation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull().references(() => ccPortals.id, { onDelete: "cascade" }),
  
  contentType: moderableContentTypeEnum("content_type").notNull(),
  contentId: uuid("content_id").notNull(),
  contentSnapshot: jsonb("content_snapshot"),
  
  submittedByTenantId: uuid("submitted_by_tenant_id"),
  submittedByPartyId: uuid("submitted_by_party_id"),
  submittedByIndividualId: uuid("submitted_by_individual_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  
  status: moderationStatusEnum("status").notNull().default("pending"),
  priority: integer("priority").default(0),
  
  autoModerationScore: numeric("auto_moderation_score"),
  autoModerationFlags: jsonb("auto_moderation_flags").default([]),
  autoModerationPassed: boolean("auto_moderation_passed"),
  
  reviewedByMemberId: uuid("reviewed_by_member_id").references(() => ccPortalMembers.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  
  rejectionReason: text("rejection_reason"),
  rejectionCategory: text("rejection_category"),
  isSilentRejection: boolean("is_silent_rejection").default(true),
  
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalIdx: index("idx_cc_moderation_queue_portal").on(table.portalId),
  statusIdx: index("idx_cc_moderation_queue_status").on(table.portalId, table.status),
  contentIdx: index("idx_cc_moderation_queue_content").on(table.contentType, table.contentId),
  uniqueContent: uniqueIndex("cc_moderation_queue_unique").on(table.portalId, table.contentType, table.contentId),
}));

export const insertModerationQueueSchema = createInsertSchema(ccModerationQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ModerationQueueItem = typeof ccModerationQueue.$inferSelect;
export type InsertModerationQueueItem = z.infer<typeof insertModerationQueueSchema>;

// ============================================================================
// MODERATION HISTORY (Bundle 105)
// ============================================================================

export const ccModerationHistory = pgTable("cc_moderation_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueItemId: uuid("queue_item_id").notNull().references(() => ccModerationQueue.id, { onDelete: "cascade" }),
  
  action: moderationActionEnum("action").notNull(),
  previousStatus: moderationStatusEnum("previous_status"),
  newStatus: moderationStatusEnum("new_status"),
  
  actorMemberId: uuid("actor_member_id").references(() => ccPortalMembers.id),
  actorSystem: boolean("actor_system").default(false),
  
  reason: text("reason"),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  queueIdx: index("idx_cc_moderation_history_queue").on(table.queueItemId),
  actorIdx: index("idx_cc_moderation_history_actor").on(table.actorMemberId),
}));

export const insertModerationHistorySchema = createInsertSchema(ccModerationHistory).omit({
  id: true,
  createdAt: true,
});
export type ModerationHistoryEntry = typeof ccModerationHistory.$inferSelect;
export type InsertModerationHistoryEntry = z.infer<typeof insertModerationHistorySchema>;

// ============================================================================
// ONBOARDING WIZARD (Bundle 106)
// ============================================================================

export const onboardingFlowTypeEnum = pgEnum("onboarding_flow_type", [
  "generic", "contractor", "property_owner", "pic", "worker", "coordinator",
  "job_claim", "property_claim", "invitation_accept", "portal_join"
]);

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "not_started", "in_progress", "completed", "skipped", "abandoned"
]);

export const stepStatusEnum = pgEnum("step_status", [
  "pending", "in_progress", "completed", "skipped", "blocked"
]);

// ============================================================================
// ONBOARDING FLOWS (Bundle 106)
// ============================================================================

export const ccOnboardingFlows = pgTable("cc_onboarding_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  flowType: onboardingFlowTypeEnum("flow_type").notNull(),
  actorTypeId: uuid("actor_type_id").references(() => ccActorTypes.id),
  steps: jsonb("steps").notNull().default([]),
  estimatedMinutes: integer("estimated_minutes").default(5),
  allowSkip: boolean("allow_skip").default(true),
  autoCompleteOnFirstAction: boolean("auto_complete_on_first_action").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeIdx: index("idx_cc_onboarding_flows_type").on(table.flowType),
  actorIdx: index("idx_cc_onboarding_flows_actor").on(table.actorTypeId),
}));

export const insertOnboardingFlowSchema = createInsertSchema(ccOnboardingFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OnboardingFlow = typeof ccOnboardingFlows.$inferSelect;
export type InsertOnboardingFlow = z.infer<typeof insertOnboardingFlowSchema>;

// ============================================================================
// ONBOARDING SESSIONS (Bundle 106)
// ============================================================================

export const ccOnboardingSessions = pgTable("cc_onboarding_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().unique(),
  flowId: uuid("flow_id").references(() => ccOnboardingFlows.id),
  flowType: onboardingFlowTypeEnum("flow_type").notNull().default("generic"),
  invitationId: uuid("invitation_id"),
  claimLinkId: uuid("claim_link_id"),
  portalId: uuid("portal_id"),
  referrerTenantId: uuid("referrer_tenant_id"),
  entryContext: jsonb("entry_context").default({}),
  status: onboardingStatusEnum("status").notNull().default("not_started"),
  currentStepIndex: integer("current_step_index").default(0),
  stepsCompleted: integer("steps_completed").default(0),
  totalSteps: integer("total_steps").default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  skippedAt: timestamp("skipped_at", { withTimezone: true }),
  abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
  firstActionType: text("first_action_type"),
  firstActionAt: timestamp("first_action_at", { withTimezone: true }),
  firstActionEntityId: uuid("first_action_entity_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_onboarding_sessions_tenant").on(table.tenantId),
  statusIdx: index("idx_cc_onboarding_sessions_status").on(table.status),
  flowIdx: index("idx_cc_onboarding_sessions_flow").on(table.flowId),
}));

export const insertOnboardingSessionSchema = createInsertSchema(ccOnboardingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OnboardingSession = typeof ccOnboardingSessions.$inferSelect;
export type InsertOnboardingSession = z.infer<typeof insertOnboardingSessionSchema>;

// ============================================================================
// ONBOARDING STEP PROGRESS (Bundle 106)
// ============================================================================

export const ccOnboardingStepProgress = pgTable("cc_onboarding_step_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => ccOnboardingSessions.id, { onDelete: "cascade" }),
  stepKey: text("step_key").notNull(),
  stepIndex: integer("step_index").notNull(),
  stepName: text("step_name"),
  status: stepStatusEnum("status").notNull().default("pending"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  skippedAt: timestamp("skipped_at", { withTimezone: true }),
  completionData: jsonb("completion_data").default({}),
  validationErrors: jsonb("validation_errors").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_cc_onboarding_step_progress_session").on(table.sessionId),
  uniqueStep: uniqueIndex("cc_onboarding_step_progress_unique").on(table.sessionId, table.stepKey),
}));

export const insertOnboardingStepProgressSchema = createInsertSchema(ccOnboardingStepProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OnboardingStepProgress = typeof ccOnboardingStepProgress.$inferSelect;
export type InsertOnboardingStepProgress = z.infer<typeof insertOnboardingStepProgressSchema>;

// ============================================================================
// ONBOARDING CHECKLIST ITEMS (Bundle 106)
// ============================================================================

export const ccOnboardingChecklistItems = pgTable("cc_onboarding_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("setup"),
  actorTypeId: uuid("actor_type_id").references(() => ccActorTypes.id),
  completionEvent: text("completion_event"),
  completionCheckSql: text("completion_check_sql"),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
  requiredForActivation: boolean("required_for_activation").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("idx_cc_onboarding_checklist_items_category").on(table.category),
  actorIdx: index("idx_cc_onboarding_checklist_items_actor").on(table.actorTypeId),
}));

export const insertOnboardingChecklistItemSchema = createInsertSchema(ccOnboardingChecklistItems).omit({
  id: true,
  createdAt: true,
});
export type OnboardingChecklistItem = typeof ccOnboardingChecklistItems.$inferSelect;
export type InsertOnboardingChecklistItem = z.infer<typeof insertOnboardingChecklistItemSchema>;

// ============================================================================
// TENANT CHECKLIST PROGRESS (Bundle 106)
// ============================================================================

export const ccTenantChecklistProgress = pgTable("cc_tenant_checklist_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  checklistItemId: uuid("checklist_item_id").notNull().references(() => ccOnboardingChecklistItems.id, { onDelete: "cascade" }),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedByUserId: uuid("completed_by_user_id"),
  completionEntityId: uuid("completion_entity_id"),
  completionData: jsonb("completion_data").default({}),
  isDismissed: boolean("is_dismissed").default(false),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_tenant_checklist_progress_tenant").on(table.tenantId),
  uniqueTenantItem: uniqueIndex("cc_tenant_checklist_progress_unique").on(table.tenantId, table.checklistItemId),
}));

export const insertTenantChecklistProgressSchema = createInsertSchema(ccTenantChecklistProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TenantChecklistProgress = typeof ccTenantChecklistProgress.$inferSelect;
export type InsertTenantChecklistProgress = z.infer<typeof insertTenantChecklistProgressSchema>;

// ============================================================================
// TENANT-INDIVIDUAL SCOPE (Bundle 107 - Foundational)
// ============================================================================

export const ccTenantIndividuals = pgTable("cc_tenant_individuals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  individualId: uuid("individual_id").notNull(),
  role: text("role"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_tenant_individuals_tenant").on(table.tenantId),
  individualIdx: index("idx_cc_tenant_individuals_individual").on(table.individualId),
  uniqueTenantIndividual: uniqueIndex("cc_tenant_individuals_unique").on(table.tenantId, table.individualId),
}));

export const insertTenantIndividualSchema = createInsertSchema(ccTenantIndividuals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TenantIndividual = typeof ccTenantIndividuals.$inferSelect;
export type InsertTenantIndividual = z.infer<typeof insertTenantIndividualSchema>;

// ============================================================================
// NOTIFICATION ENUMS (Bundle 107)
// ============================================================================

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app", "email", "sms", "push", "webhook"
]);

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low", "normal", "high", "urgent"
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending", "queued", "sent", "delivered", "read", "failed", "cancelled"
]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "system", "invitation", "job", "moderation", "onboarding", 
  "message", "reservation", "payment", "alert", "reminder", "marketing"
]);

export const digestFrequencyEnum = pgEnum("digest_frequency", [
  "immediate", "hourly", "daily", "weekly", "never"
]);

// ============================================================================
// NOTIFICATION TEMPLATES (Bundle 107)
// ============================================================================

export const ccNotificationTemplates = pgTable("cc_notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: notificationCategoryEnum("category").notNull(),
  subjectTemplate: text("subject_template"),
  bodyTemplate: text("body_template").notNull(),
  shortBodyTemplate: text("short_body_template"),
  emailTemplateId: text("email_template_id"),
  smsTemplateId: text("sms_template_id"),
  pushTemplate: jsonb("push_template"),
  defaultChannels: text("default_channels").array().default(["in_app"]),
  defaultPriority: notificationPriorityEnum("default_priority").default("normal"),
  isActionable: boolean("is_actionable").default(false),
  actionUrlTemplate: text("action_url_template"),
  actionLabel: text("action_label"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  codeIdx: index("idx_cc_notification_templates_code").on(table.code),
  categoryIdx: index("idx_cc_notification_templates_category").on(table.category),
}));

export const insertNotificationTemplateSchema = createInsertSchema(ccNotificationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type NotificationTemplate = typeof ccNotificationTemplates.$inferSelect;
export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;

// ============================================================================
// NOTIFICATION PREFERENCES (Bundle 107)
// ============================================================================

export const ccNotificationPreferences = pgTable("cc_notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").unique(),
  partyId: uuid("party_id").unique(),
  individualId: uuid("individual_id").unique(),
  emailEnabled: boolean("email_enabled").default(true),
  smsEnabled: boolean("sms_enabled").default(false),
  pushEnabled: boolean("push_enabled").default(true),
  inAppEnabled: boolean("in_app_enabled").default(true),
  emailAddress: text("email_address"),
  phoneNumber: text("phone_number"),
  pushToken: text("push_token"),
  digestFrequency: digestFrequencyEnum("digest_frequency").default("immediate"),
  digestHour: integer("digest_hour").default(9),
  digestDay: integer("digest_day").default(1),
  timezone: text("timezone").default("America/Vancouver"),
  enabledCategories: text("enabled_categories").array().default([
    "system", "invitation", "job", "moderation", "onboarding",
    "message", "reservation", "payment", "alert", "reminder"
  ]),
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: text("quiet_hours_start").default("22:00"),
  quietHoursEnd: text("quiet_hours_end").default("07:00"),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  unsubscribeReason: text("unsubscribe_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_notification_preferences_tenant").on(table.tenantId),
  partyIdx: index("idx_cc_notification_preferences_party").on(table.partyId),
  individualIdx: index("idx_cc_notification_preferences_individual").on(table.individualId),
}));

export const insertNotificationPreferencesSchema = createInsertSchema(ccNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type NotificationPreferences = typeof ccNotificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

// ============================================================================
// NOTIFICATIONS (Bundle 107)
// ============================================================================

export const ccNotifications = pgTable("cc_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(() => ccNotificationTemplates.id),
  templateCode: text("template_code"),
  recipientTenantId: uuid("recipient_tenant_id"),
  recipientPartyId: uuid("recipient_party_id"),
  recipientIndividualId: uuid("recipient_individual_id"),
  subject: text("subject"),
  body: text("body").notNull(),
  shortBody: text("short_body"),
  category: notificationCategoryEnum("category").notNull(),
  priority: notificationPriorityEnum("priority").notNull().default("normal"),
  channels: text("channels").array().notNull().default(["in_app"]),
  contextType: text("context_type"),
  contextId: uuid("context_id"),
  contextData: jsonb("context_data").default({}),
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  senderTenantId: uuid("sender_tenant_id"),
  senderName: text("sender_name"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  digestId: uuid("digest_id"),
  isDigestEligible: boolean("is_digest_eligible").default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  recipientTenantIdx: index("idx_cc_notifications_recipient_tenant").on(table.recipientTenantId),
  recipientPartyIdx: index("idx_cc_notifications_recipient_party").on(table.recipientPartyId),
  statusIdx: index("idx_cc_notifications_status").on(table.status),
  categoryIdx: index("idx_cc_notifications_category").on(table.category),
  contextIdx: index("idx_cc_notifications_context").on(table.contextType, table.contextId),
}));

export const insertNotificationSchema = createInsertSchema(ccNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Notification = typeof ccNotifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// ============================================================================
// NOTIFICATION DELIVERIES (Bundle 107)
// ============================================================================

export const ccNotificationDeliveries = pgTable("cc_notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id").notNull().references(() => ccNotifications.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull(),
  recipientAddress: text("recipient_address"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  providerName: text("provider_name"),
  providerMessageId: text("provider_message_id"),
  providerResponse: jsonb("provider_response"),
  failureReason: text("failure_reason"),
  failureCode: text("failure_code"),
  isPermanentFailure: boolean("is_permanent_failure").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  notificationIdx: index("idx_cc_notification_deliveries_notification").on(table.notificationId),
  statusIdx: index("idx_cc_notification_deliveries_status").on(table.status),
  providerIdx: index("idx_cc_notification_deliveries_provider").on(table.providerMessageId),
  uniqueChannelDelivery: uniqueIndex("cc_notification_deliveries_unique").on(table.notificationId, table.channel),
}));

export const insertNotificationDeliverySchema = createInsertSchema(ccNotificationDeliveries).omit({
  id: true,
  createdAt: true,
});
export type NotificationDelivery = typeof ccNotificationDeliveries.$inferSelect;
export type InsertNotificationDelivery = z.infer<typeof insertNotificationDeliverySchema>;

// ============================================================================
// NOTIFICATION DIGESTS (Bundle 107)
// ============================================================================

export const ccNotificationDigests = pgTable("cc_notification_digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientTenantId: uuid("recipient_tenant_id"),
  recipientPartyId: uuid("recipient_party_id"),
  recipientIndividualId: uuid("recipient_individual_id"),
  frequency: digestFrequencyEnum("frequency").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  notificationCount: integer("notification_count").default(0),
  status: notificationStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  subject: text("subject"),
  body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  recipientIdx: index("idx_cc_notification_digests_recipient").on(table.recipientTenantId),
}));

export const insertNotificationDigestSchema = createInsertSchema(ccNotificationDigests).omit({
  id: true,
  createdAt: true,
});
export type NotificationDigest = typeof ccNotificationDigests.$inferSelect;
export type InsertNotificationDigest = z.infer<typeof insertNotificationDigestSchema>;

// ============================================================================
// ACTIVITY FEED ENUMS (Bundle 109)
// ============================================================================

export const activityVerbEnum = pgEnum("activity_verb", [
  "created", "updated", "deleted", "scheduled", "confirmed",
  "cancelled", "completed", "claimed", "sent", "accepted",
  "rejected", "expired", "joined", "left", "approved",
  "started", "filled", "received", "changed", "milestone", "announcement"
]);

export const activityVisibilityEnum = pgEnum("activity_visibility", [
  "private", "tenant", "portal", "community", "public"
]);

export const activityPriorityEnum = pgEnum("activity_priority", [
  "low", "normal", "high", "featured"
]);

// ============================================================================
// ACTIVITY EVENTS (Bundle 109)
// Core event stream - immutable log of all activities
// ============================================================================

export const ccActivityEvents = pgTable("cc_activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Event classification
  verb: activityVerbEnum("verb").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  subtype: text("subtype"),
  
  // Actor (XOR identity)
  actorTenantId: uuid("actor_tenant_id"),
  actorPartyId: uuid("actor_party_id"),
  actorIndividualId: uuid("actor_individual_id"),
  actorName: text("actor_name"),
  
  // Context
  tenantId: uuid("tenant_id"),
  portalId: uuid("portal_id"),
  communityId: uuid("community_id"),
  
  // Content
  title: text("title").notNull(),
  description: text("description"),
  entityName: text("entity_name"),
  metadata: jsonb("metadata").default({}),
  
  // Visibility & Priority
  visibility: activityVisibilityEnum("visibility").notNull().default("tenant"),
  priority: activityPriorityEnum("priority").notNull().default("normal"),
  
  // Engagement
  isActionable: boolean("is_actionable").default(false),
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  aggregationKey: text("aggregation_key"),
  
  // Timestamps
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_activity_events_tenant").on(table.tenantId, table.occurredAt),
  portalIdx: index("idx_cc_activity_events_portal").on(table.portalId, table.occurredAt),
  verbIdx: index("idx_cc_activity_events_verb").on(table.verb, table.occurredAt),
  entityIdx: index("idx_cc_activity_events_entity").on(table.entityType, table.entityId),
}));

export const insertActivityEventSchema = createInsertSchema(ccActivityEvents).omit({
  id: true,
  createdAt: true,
});
export type ActivityEvent = typeof ccActivityEvents.$inferSelect;
export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;

// ============================================================================
// ACTIVITY FEED STATE (Bundle 109)
// Tracks what each recipient has seen - XOR identity
// ============================================================================

export const ccActivityFeedState = pgTable("cc_activity_feed_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Recipient (XOR - exactly one must be set)
  tenantId: uuid("tenant_id"),
  partyId: uuid("party_id"),
  individualId: uuid("individual_id"),
  
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
  lastSeenTenantAt: timestamp("last_seen_tenant_at", { withTimezone: true }),
  lastSeenPortalAt: timestamp("last_seen_portal_at", { withTimezone: true }),
  lastSeenCommunityAt: timestamp("last_seen_community_at", { withTimezone: true }),
  unreadCount: integer("unread_count").default(0),
  collapsedTypes: text("collapsed_types").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_activity_feed_state_tenant").on(table.tenantId),
  partyIdx: index("idx_cc_activity_feed_state_party").on(table.partyId),
  individualIdx: index("idx_cc_activity_feed_state_individual").on(table.individualId),
}));

export const insertActivityFeedStateSchema = createInsertSchema(ccActivityFeedState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ActivityFeedState = typeof ccActivityFeedState.$inferSelect;
export type InsertActivityFeedState = z.infer<typeof insertActivityFeedStateSchema>;

// ============================================================================
// ACTIVITY BOOKMARKS (Bundle 109)
// Users can bookmark important activities - XOR identity
// ============================================================================

export const ccActivityBookmarks = pgTable("cc_activity_bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Recipient (XOR - exactly one must be set)
  tenantId: uuid("tenant_id"),
  partyId: uuid("party_id"),
  individualId: uuid("individual_id"),
  
  activityId: uuid("activity_id").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_cc_activity_bookmarks_tenant").on(table.tenantId, table.createdAt),
  partyIdx: index("idx_cc_activity_bookmarks_party").on(table.partyId, table.createdAt),
  individualIdx: index("idx_cc_activity_bookmarks_individual").on(table.individualId, table.createdAt),
}));

export const insertActivityBookmarkSchema = createInsertSchema(ccActivityBookmarks).omit({
  id: true,
  createdAt: true,
});
export type ActivityBookmark = typeof ccActivityBookmarks.$inferSelect;
export type InsertActivityBookmark = z.infer<typeof insertActivityBookmarkSchema>;

// ============================================================================
// PMS SPINE - RATE PLANS (Migration 110)
// Pricing strategies for accommodation stays
// ============================================================================

export const ratePlanTypeEnum = pgEnum("rate_plan_type", [
  "standard", "seasonal", "length_stay", "member", "corporate", "promotional"
]);

export const ratePlanStatusEnum = pgEnum("rate_plan_status", [
  "draft", "active", "suspended", "archived"
]);

export const ccRatePlans = pgTable("cc_rate_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  
  planType: ratePlanTypeEnum("plan_type").notNull().default("standard"),
  status: ratePlanStatusEnum("status").notNull().default("draft"),
  
  assetTypeId: uuid("asset_type_id"),
  facilityId: uuid("facility_id"),
  offerId: uuid("offer_id"),
  
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  
  minNights: integer("min_nights").default(1),
  maxNights: integer("max_nights"),
  
  baseRateCents: integer("base_rate_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  
  weekendRateCents: integer("weekend_rate_cents"),
  weeklyDiscountPct: numeric("weekly_discount_pct", { precision: 5, scale: 2 }).default("0"),
  monthlyDiscountPct: numeric("monthly_discount_pct", { precision: 5, scale: 2 }).default("0"),
  
  requiresMembership: boolean("requires_membership").default(false),
  memberPlanId: uuid("member_plan_id"),
  
  priority: integer("priority").notNull().default(0),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => ({
  tenantStatusIdx: index("idx_rate_plans_tenant_status").on(table.tenantId, table.status),
}));

export const insertRatePlanSchema = createInsertSchema(ccRatePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type RatePlan = typeof ccRatePlans.$inferSelect;
export type InsertRatePlan = z.infer<typeof insertRatePlanSchema>;

// ============================================================================
// PMS SPINE - FOLIOS (Migration 110)
// Invoice pattern: aggregates charges for a stay
// ============================================================================

export const folioStatusEnum = pgEnum("folio_status", [
  "open", "checked_out", "settled", "disputed", "void"
]);

export const ccFolios = pgTable("cc_folios", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  folioNumber: text("folio_number").notNull(),
  status: folioStatusEnum("status").notNull().default("open"),
  
  guestPartyId: uuid("guest_party_id").notNull(),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  
  reservationId: uuid("reservation_id"),
  assetId: uuid("asset_id"),
  facilityId: uuid("facility_id"),
  
  ratePlanId: uuid("rate_plan_id"),
  nightlyRateCents: integer("nightly_rate_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  actualCheckIn: timestamp("actual_check_in", { withTimezone: true }),
  actualCheckOut: timestamp("actual_check_out", { withTimezone: true }),
  nightsStayed: integer("nights_stayed"),
  
  roomChargesCents: integer("room_charges_cents").notNull().default(0),
  serviceChargesCents: integer("service_charges_cents").notNull().default(0),
  taxChargesCents: integer("tax_charges_cents").notNull().default(0),
  paymentsReceivedCents: integer("payments_received_cents").notNull().default(0),
  adjustmentsCents: integer("adjustments_cents").notNull().default(0),
  balanceDueCents: integer("balance_due_cents"),
  
  depositRequiredCents: integer("deposit_required_cents").default(0),
  depositCollectedCents: integer("deposit_collected_cents").default(0),
  
  settledAt: timestamp("settled_at", { withTimezone: true }),
  settledBy: uuid("settled_by"),
  
  internalNotes: text("internal_notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => ({
  tenantStatusIdx: index("idx_folios_tenant_status").on(table.tenantId, table.status),
  guestIdx: index("idx_folios_guest").on(table.guestPartyId),
}));

export const insertFolioSchema = createInsertSchema(ccFolios).omit({
  id: true,
  nightsStayed: true,
  balanceDueCents: true,
  createdAt: true,
  updatedAt: true,
});
export type Folio = typeof ccFolios.$inferSelect;
export type InsertFolio = z.infer<typeof insertFolioSchema>;

// ============================================================================
// PMS SPINE - FOLIO LEDGER (Migration 110)
// IMMUTABLE ledger: never update or delete, only insert reversals
// ============================================================================

export const folioLedgerEntryTypeEnum = pgEnum("folio_ledger_entry_type", [
  "charge", "payment", "adjustment", "reversal", "tax", "deposit", "refund"
]);

export const ccFolioLedger = pgTable("cc_folio_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  folioId: uuid("folio_id").notNull(),
  
  entryType: folioLedgerEntryTypeEnum("entry_type").notNull(),
  
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  reversesEntryId: uuid("reverses_entry_id"),
  
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  
  taxRuleId: uuid("tax_rule_id"),
  taxRatePct: numeric("tax_rate_pct", { precision: 5, scale: 2 }),
  
  serviceDate: date("service_date"),
  
  postedBy: uuid("posted_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  
  entryHash: text("entry_hash"),
  sequenceNumber: integer("sequence_number").notNull(),
}, (table) => ({
  folioIdx: index("idx_folio_ledger_folio").on(table.folioId, table.sequenceNumber),
  tenantIdx: index("idx_folio_ledger_tenant").on(table.tenantId, table.postedAt),
}));

export const insertFolioLedgerEntrySchema = createInsertSchema(ccFolioLedger).omit({
  id: true,
  postedAt: true,
  entryHash: true,
});
export type FolioLedgerEntry = typeof ccFolioLedger.$inferSelect;
export type InsertFolioLedgerEntry = z.infer<typeof insertFolioLedgerEntrySchema>;

// ============================================================================
// REFUND INCIDENTS (Prompt 3 - Split Pay + Refunds + Incidents)
// Tracks illness refunds, staff damage, goodwill refunds, injuries for folio adjustments
// ============================================================================

export const refundIncidentTypeEnum = pgEnum("refund_incident_type", [
  "illness_refund", "staff_damage", "goodwill_refund", "injury", "other"
]);

export const refundIncidentStatusEnum = pgEnum("refund_incident_status", [
  "open", "resolved"
]);

export const ccRefundIncidents = pgTable("cc_refund_incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  
  incidentType: refundIncidentTypeEnum("incident_type").notNull(),
  status: refundIncidentStatusEnum("status").notNull().default("open"),
  
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  reportedByParticipantId: uuid("reported_by_participant_id"),
  affectedParticipantId: uuid("affected_participant_id"),
  
  relatedAsset: jsonb("related_asset").notNull().default({}), // bike info, serial, photos refs
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalTypeIdx: index("idx_refund_incidents_portal_type").on(table.portalId, table.incidentType),
  portalStatusIdx: index("idx_refund_incidents_portal_status").on(table.portalId, table.status),
}));

export const insertRefundIncidentSchema = createInsertSchema(ccRefundIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type RefundIncident = typeof ccRefundIncidents.$inferSelect;
export type InsertRefundIncident = z.infer<typeof insertRefundIncidentSchema>;

// ============================================================================
// FOLIO LEDGER LINKS (Prompt 3 - Split Pay + Refunds + Incidents)
// Links ledger entries to surfaces, claims, incidents without altering immutable ledger
// ============================================================================

export const ccFolioLedgerLinks = pgTable("cc_folio_ledger_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  
  folioLedgerId: uuid("folio_ledger_id").notNull().references(() => ccFolioLedger.id, { onDelete: "cascade" }),
  
  surfaceClaimId: uuid("surface_claim_id").references(() => ccSurfaceClaims.id),
  surfaceUnitId: uuid("surface_unit_id").references(() => ccSurfaceUnits.id),
  incidentId: uuid("incident_id").references(() => ccRefundIncidents.id),
  refFolioLedgerId: uuid("ref_folio_ledger_id").references(() => ccFolioLedger.id), // for reversals referencing originals
  
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalLedgerIdx: index("idx_folio_ledger_links_portal_ledger").on(table.portalId, table.folioLedgerId),
  portalClaimIdx: index("idx_folio_ledger_links_portal_claim").on(table.portalId, table.surfaceClaimId),
  portalIncidentIdx: index("idx_folio_ledger_links_portal_incident").on(table.portalId, table.incidentId),
  portalRefIdx: index("idx_folio_ledger_links_portal_ref").on(table.portalId, table.refFolioLedgerId),
}));

export const insertFolioLedgerLinkSchema = createInsertSchema(ccFolioLedgerLinks).omit({
  id: true,
  createdAt: true,
});
export type FolioLedgerLink = typeof ccFolioLedgerLinks.$inferSelect;
export type InsertFolioLedgerLink = z.infer<typeof insertFolioLedgerLinkSchema>;

// ============================================================================
// ENFORCEMENT ACTIONS (Migration 111)
// Parking/marina violation ticketing system
// ============================================================================

export const enforcementActionTypeEnum = pgEnum("enforcement_action_type", [
  "warning", "citation", "tow_order", "boot", "impound", "ban", "revocation"
]);

export const enforcementStatusEnum = pgEnum("enforcement_status", [
  "issued", "contested", "upheld", "dismissed", "paid", "escalated", "void"
]);

export const violationCategoryEnum = pgEnum("violation_category", [
  "parking_expired", "parking_unauthorized", "parking_wrong_space", "parking_fire_lane",
  "parking_accessible", "marina_overstay", "marina_unauthorized", "marina_safety",
  "facility_damage", "facility_rules", "noise", "other"
]);

export const ccEnforcementActions = pgTable("cc_enforcement_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  ticketNumber: text("ticket_number").notNull(),
  actionType: enforcementActionTypeEnum("action_type").notNull(),
  status: enforcementStatusEnum("status").notNull().default("issued"),
  
  violationCategory: violationCategoryEnum("violation_category").notNull(),
  violationDescription: text("violation_description").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  
  facilityId: uuid("facility_id"),
  assetId: uuid("asset_id"),
  locationDescription: text("location_description"),
  
  vehiclePlate: text("vehicle_plate"),
  vehicleDescription: text("vehicle_description"),
  vesselName: text("vessel_name"),
  vesselRegistration: text("vessel_registration"),
  
  offenderPartyId: uuid("offender_party_id"),
  offenderName: text("offender_name"),
  offenderContact: text("offender_contact"),
  
  reservationId: uuid("reservation_id"),
  wasExpired: boolean("was_expired").default(false),
  wasWrongSpace: boolean("was_wrong_space").default(false),
  
  fineAmountCents: integer("fine_amount_cents").default(0),
  currency: text("currency").notNull().default("CAD"),
  dueDate: date("due_date"),
  paidAmountCents: integer("paid_amount_cents").default(0),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  escalationReference: text("escalation_reference"),
  
  contestedAt: timestamp("contested_at", { withTimezone: true }),
  contestReason: text("contest_reason"),
  contestEvidenceUrls: text("contest_evidence_urls").array(),
  contestResolvedAt: timestamp("contest_resolved_at", { withTimezone: true }),
  contestResolvedBy: uuid("contest_resolved_by"),
  contestResolutionNotes: text("contest_resolution_notes"),
  
  evidencePhotoUrls: text("evidence_photo_urls").array(),
  evidenceNotes: text("evidence_notes"),
  
  towRequestId: uuid("tow_request_id"),
  previousActionId: uuid("previous_action_id"),
  
  credentialId: uuid("credential_id"),
  credentialRevoked: boolean("credential_revoked").default(false),
  
  issuedBy: uuid("issued_by"),
  issuedByName: text("issued_by_name"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: uuid("voided_by"),
  voidReason: text("void_reason"),
}, (table) => ({
  tenantStatusIdx: index("idx_enforcement_tenant_status").on(table.tenantId, table.status),
  facilityIdx: index("idx_enforcement_facility").on(table.facilityId),
}));

export const insertEnforcementActionSchema = createInsertSchema(ccEnforcementActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type EnforcementAction = typeof ccEnforcementActions.$inferSelect;
export type InsertEnforcementAction = z.infer<typeof insertEnforcementActionSchema>;

// ============================================================================
// ENFORCEMENT FINE SCHEDULE (Migration 111)
// Standard fines by violation type (tenant-configurable)
// ============================================================================

export const ccEnforcementFineSchedule = pgTable("cc_enforcement_fine_schedule", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  violationCategory: violationCategoryEnum("violation_category").notNull(),
  actionType: enforcementActionTypeEnum("action_type").notNull().default("citation"),
  
  firstOffenseCents: integer("first_offense_cents").notNull().default(0),
  secondOffenseCents: integer("second_offense_cents").notNull().default(0),
  thirdOffenseCents: integer("third_offense_cents").notNull().default(0),
  
  gracePeriodMinutes: integer("grace_period_minutes").default(0),
  dueInDays: integer("due_in_days").notNull().default(30),
  lateFeeCents: integer("late_fee_cents").default(0),
  lateAfterDays: integer("late_after_days").default(30),
  autoEscalateAfterDays: integer("auto_escalate_after_days"),
  
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_fine_schedule_tenant").on(table.tenantId),
}));

export const insertEnforcementFineScheduleSchema = createInsertSchema(ccEnforcementFineSchedule).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type EnforcementFineSchedule = typeof ccEnforcementFineSchedule.$inferSelect;
export type InsertEnforcementFineSchedule = z.infer<typeof insertEnforcementFineScheduleSchema>;

// ============================================================================
// JOBS WEDGE - JOB MATCHES (Migration 112)
// AI-suggested matches between workers and jobs
// ============================================================================

export const jobMatchSourceEnum = pgEnum("job_match_source", [
  "ai_suggestion", "manual", "self_match", "referral", "imported"
]);

export const jobMatchStatusEnum = pgEnum("job_match_status", [
  "suggested", "sent_to_worker", "sent_to_employer", "worker_interested",
  "employer_interested", "mutual_interest", "applied", "dismissed_worker",
  "dismissed_employer", "expired"
]);

export const ccJobMatches = pgTable("cc_job_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  jobId: uuid("job_id").notNull(),
  jobPostingId: uuid("job_posting_id"),
  workerPartyId: uuid("worker_party_id"),
  workerIndividualId: uuid("worker_individual_id").notNull(),
  
  source: jobMatchSourceEnum("source").notNull().default("ai_suggestion"),
  status: jobMatchStatusEnum("status").notNull().default("suggested"),
  
  matchScore: numeric("match_score", { precision: 5, scale: 2 }),
  scoreBreakdown: jsonb("score_breakdown"),
  matchReasons: text("match_reasons").array(),
  
  matchedSkills: text("matched_skills").array(),
  missingSkills: text("missing_skills").array(),
  bonusSkills: text("bonus_skills").array(),
  
  workerLocation: text("worker_location"),
  jobLocation: text("job_location"),
  distanceKm: numeric("distance_km", { precision: 10, scale: 2 }),
  travelFeasible: boolean("travel_feasible"),
  travelNotes: text("travel_notes"),
  
  workerAvailableFrom: date("worker_available_from"),
  workerAvailableTo: date("worker_available_to"),
  jobStartDate: date("job_start_date"),
  jobEndDate: date("job_end_date"),
  availabilityOverlapDays: integer("availability_overlap_days"),
  
  workerNeedsAccommodation: boolean("worker_needs_accommodation"),
  accommodationAvailable: boolean("accommodation_available"),
  accommodationMatchNotes: text("accommodation_match_notes"),
  
  workerExpectedWageCents: integer("worker_expected_wage_cents"),
  jobWageRangeMinCents: integer("job_wage_range_min_cents"),
  jobWageRangeMaxCents: integer("job_wage_range_max_cents"),
  wageAligned: boolean("wage_aligned"),
  
  sentToWorkerAt: timestamp("sent_to_worker_at", { withTimezone: true }),
  workerViewedAt: timestamp("worker_viewed_at", { withTimezone: true }),
  workerRespondedAt: timestamp("worker_responded_at", { withTimezone: true }),
  workerResponse: jobMatchStatusEnum("worker_response"),
  
  sentToEmployerAt: timestamp("sent_to_employer_at", { withTimezone: true }),
  employerViewedAt: timestamp("employer_viewed_at", { withTimezone: true }),
  employerRespondedAt: timestamp("employer_responded_at", { withTimezone: true }),
  employerResponse: jobMatchStatusEnum("employer_response"),
  
  convertedToApplicationId: uuid("converted_to_application_id"),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  dismissedReason: text("dismissed_reason"),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  
  referredByPartyId: uuid("referred_by_party_id"),
  referralId: uuid("referral_id"),
  createdBy: uuid("created_by"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantStatusIdx: index("idx_matches_tenant_status").on(table.tenantId, table.status),
  jobIdx: index("idx_matches_job").on(table.jobId),
  workerIdx: index("idx_matches_worker").on(table.workerIndividualId),
}));

export const insertJobMatchSchema = createInsertSchema(ccJobMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type JobMatch = typeof ccJobMatches.$inferSelect;
export type InsertJobMatch = z.infer<typeof insertJobMatchSchema>;

// ============================================================================
// JOBS WEDGE - JOB APPLICATIONS (Migration 112)
// Workers apply to specific job postings
// ============================================================================

export const jobApplicationStatusEnum = pgEnum("job_application_status", [
  "draft", "submitted", "under_review", "shortlisted", "interview_scheduled",
  "interviewed", "offer_extended", "offer_accepted", "offer_declined",
  "rejected", "withdrawn"
]);

export const ccJobApplications = pgTable("cc_job_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  jobId: uuid("job_id").notNull(),
  jobPostingId: uuid("job_posting_id").notNull(),
  
  applicantPartyId: uuid("applicant_party_id"),
  applicantIndividualId: uuid("applicant_individual_id").notNull(),
  
  applicationNumber: text("application_number").notNull(),
  status: jobApplicationStatusEnum("status").notNull().default("draft"),
  
  matchId: uuid("match_id"),
  referralId: uuid("referral_id"),
  sourceChannel: text("source_channel"),
  
  coverLetter: text("cover_letter"),
  resumeUrl: text("resume_url"),
  portfolioUrls: text("portfolio_urls").array(),
  
  screeningResponses: jsonb("screening_responses"),
  customFields: jsonb("custom_fields"),
  
  availableStartDate: date("available_start_date"),
  availableEndDate: date("available_end_date"),
  isFlexibleDates: boolean("is_flexible_dates").default(false),
  
  needsAccommodation: boolean("needs_accommodation").default(false),
  accommodationNotes: text("accommodation_notes"),
  hasOwnTransport: boolean("has_own_transport").default(false),
  transportNotes: text("transport_notes"),
  
  expectedWageCents: integer("expected_wage_cents"),
  wageCurrency: text("wage_currency").default("CAD"),
  isWageNegotiable: boolean("is_wage_negotiable").default(true),
  
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by"),
  shortlistedAt: timestamp("shortlisted_at", { withTimezone: true }),
  interviewScheduledAt: timestamp("interview_scheduled_at", { withTimezone: true }),
  interviewCompletedAt: timestamp("interview_completed_at", { withTimezone: true }),
  offerExtendedAt: timestamp("offer_extended_at", { withTimezone: true }),
  offerRespondedAt: timestamp("offer_responded_at", { withTimezone: true }),
  
  outcomeNotes: text("outcome_notes"),
  hiredAt: timestamp("hired_at", { withTimezone: true }),
  
  preferredContactMethod: text("preferred_contact_method").default("email"),
  preferredContactTime: text("preferred_contact_time"),
  
  internalNotes: text("internal_notes"),
  rating: integer("rating"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantStatusIdx: index("idx_applications_tenant_status").on(table.tenantId, table.status),
  jobIdx: index("idx_applications_job").on(table.jobId),
  applicantIdx: index("idx_applications_applicant").on(table.applicantIndividualId),
}));

export const insertJobApplicationSchema = createInsertSchema(ccJobApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type JobApplication = typeof ccJobApplications.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

// ============================================================================
// COMMUNITY IDENTITY - "Community Wallet" (Migration 113)
// Issued by accommodation providers to guests for charging at local merchants
// ============================================================================

export const communityIdentityStatusEnum = pgEnum("community_identity_status", [
  "active", "suspended", "expired", "revoked"
]);

export const communityChargeStatusEnum = pgEnum("community_charge_status", [
  "pending", "authorized", "settled", "disputed", "refunded", "void"
]);

export const settlementBatchStatusEnum = pgEnum("settlement_batch_status", [
  "open", "calculating", "pending_approval", "approved", "processing", "completed", "failed", "void"
]);

export const chargeCategoryEnum = pgEnum("charge_category", [
  "accommodation", "parking", "marina", "food_beverage", "retail", "service",
  "activity", "transport", "damage", "fee", "other"
]);

export const ccCommunityIdentities = pgTable("cc_community_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  issuingTenantId: uuid("issuing_tenant_id").notNull(),
  partyId: uuid("party_id").notNull(),
  individualId: uuid("individual_id"),
  displayName: text("display_name").notNull(),
  identityCode: text("identity_code").notNull(),
  pinHash: text("pin_hash"),
  qrCodeData: text("qr_code_data"),
  folioId: uuid("folio_id"),
  reservationId: uuid("reservation_id"),
  status: communityIdentityStatusEnum("status").notNull().default("active"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  spendingLimitCents: integer("spending_limit_cents"),
  dailyLimitCents: integer("daily_limit_cents"),
  singleChargeLimitCents: integer("single_charge_limit_cents"),
  allowedCategories: text("allowed_categories").array(),
  blockedTenantIds: text("blocked_tenant_ids").array(),
  totalChargesCents: integer("total_charges_cents").notNull().default(0),
  totalSettledCents: integer("total_settled_cents").notNull().default(0),
  pendingChargesCents: integer("pending_charges_cents").notNull().default(0),
  requirePin: boolean("require_pin").default(false),
  requirePinAboveCents: integer("require_pin_above_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by"),
  revokeReason: text("revoke_reason"),
}, (table) => ({
  codeIdx: uniqueIndex("uq_community_identity_code").on(table.identityCode),
  issuerIdx: index("idx_community_identities_issuer").on(table.issuingTenantId, table.status),
  partyIdx: index("idx_community_identities_party").on(table.partyId),
}));

export const insertCommunityIdentitySchema = createInsertSchema(ccCommunityIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CommunityIdentity = typeof ccCommunityIdentities.$inferSelect;
export type InsertCommunityIdentity = z.infer<typeof insertCommunityIdentitySchema>;

export const ccCommunityCharges = pgTable("cc_community_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  communityIdentityId: uuid("community_identity_id").notNull(),
  merchantTenantId: uuid("merchant_tenant_id").notNull(),
  chargeNumber: text("charge_number").notNull(),
  status: communityChargeStatusEnum("status").notNull().default("pending"),
  category: chargeCategoryEnum("category").notNull().default("other"),
  description: text("description").notNull(),
  lineItems: jsonb("line_items"),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").notNull().default(0),
  tipCents: integer("tip_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  taxBreakdown: jsonb("tax_breakdown"),
  pinVerified: boolean("pin_verified").default(false),
  verifiedByStaff: boolean("verified_by_staff").default(false),
  staffId: uuid("staff_id"),
  facilityId: uuid("facility_id"),
  assetId: uuid("asset_id"),
  locationDescription: text("location_description"),
  terminalId: text("terminal_id"),
  posReference: text("pos_reference"),
  settlementBatchId: uuid("settlement_batch_id"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  disputedAt: timestamp("disputed_at", { withTimezone: true }),
  disputeReason: text("dispute_reason"),
  disputeResolvedAt: timestamp("dispute_resolved_at", { withTimezone: true }),
  disputeResolution: text("dispute_resolution"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundAmountCents: integer("refund_amount_cents"),
  refundReason: text("refund_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: uuid("voided_by"),
  voidReason: text("void_reason"),
}, (table) => ({
  merchantNumberIdx: uniqueIndex("uq_charge_merchant_number").on(table.merchantTenantId, table.chargeNumber),
  identityIdx: index("idx_community_charges_identity").on(table.communityIdentityId),
  merchantIdx: index("idx_community_charges_merchant").on(table.merchantTenantId, table.status),
}));

export const insertCommunityChargeSchema = createInsertSchema(ccCommunityCharges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CommunityCharge = typeof ccCommunityCharges.$inferSelect;
export type InsertCommunityCharge = z.infer<typeof insertCommunityChargeSchema>;

export const ccSettlementBatches = pgTable("cc_settlement_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchNumber: text("batch_number").notNull(),
  status: settlementBatchStatusEnum("status").notNull().default("open"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  issuingTenantId: uuid("issuing_tenant_id").notNull(),
  merchantTenantId: uuid("merchant_tenant_id").notNull(),
  grossChargesCents: integer("gross_charges_cents").notNull().default(0),
  chargeCount: integer("charge_count").notNull().default(0),
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  platformFeePct: numeric("platform_fee_pct", { precision: 5, scale: 2 }).default("0"),
  interchangeFeeCents: integer("interchange_fee_cents").notNull().default(0),
  netSettlementCents: integer("net_settlement_cents").notNull().default(0),
  totalTaxCollectedCents: integer("total_tax_collected_cents").notNull().default(0),
  taxSummary: jsonb("tax_summary"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  paymentInitiatedAt: timestamp("payment_initiated_at", { withTimezone: true }),
  paymentCompletedAt: timestamp("payment_completed_at", { withTimezone: true }),
  paymentReference: text("payment_reference"),
  paymentMethod: text("payment_method"),
  issuerFolioLedgerEntryIds: text("issuer_folio_ledger_entry_ids").array(),
  issuerFolioEntries: jsonb("issuer_folio_entries"),
  merchantReceivedConfirmation: boolean("merchant_received_confirmation").default(false),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  batchNumberIdx: uniqueIndex("uq_settlement_batch_number").on(table.batchNumber),
  issuerIdx: index("idx_settlement_batches_issuer").on(table.issuingTenantId, table.status),
  merchantIdx: index("idx_settlement_batches_merchant").on(table.merchantTenantId, table.status),
}));

export const insertSettlementBatchSchema = createInsertSchema(ccSettlementBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SettlementBatch = typeof ccSettlementBatches.$inferSelect;
export type InsertSettlementBatch = z.infer<typeof insertSettlementBatchSchema>;

// ============================================================================
// P2.15 MONETIZATION EVENT LEDGER + PLAN GATING
// ============================================================================

// Plan status enum
export const monetizationPlanStatusEnum = pgEnum("cc_monetization_plan_status", [
  "active",
  "inactive",
  "deprecated",
]);

// Monetization event type enum
export const monetizationEventTypeEnum = pgEnum("cc_monetization_event_type", [
  "emergency_run_started",
  "emergency_playbook_exported",
  "evidence_bundle_sealed",
  "insurance_dossier_assembled",
  "insurance_dossier_exported",
  "defense_pack_assembled",
  "defense_pack_exported",
  "authority_share_issued",
  "interest_group_triggered",
  "record_capture_created",
  "offline_sync_batch",
]);

// Monetization subject type enum
export const monetizationSubjectTypeEnum = pgEnum("cc_monetization_subject_type", [
  "emergency_run",
  "evidence_bundle",
  "claim",
  "dossier",
  "defense_pack",
  "authority_grant",
  "interest_group",
  "record_capture",
  "offline_batch",
]);

// Monetization Plans - Defines plans and entitlements
export const ccMonetizationPlans = pgTable("cc_monetization_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"), // null = global/default plan template
  planKey: text("plan_key").notNull(), // e.g., free, pro, emergency_plus
  title: text("title").notNull(),
  description: text("description"),
  entitlements: jsonb("entitlements").notNull().$type<{
    events?: Record<string, { limit: number; period: string }>;
    features?: Record<string, boolean>;
    hard_gates?: Record<string, boolean>;
  }>(),
  status: monetizationPlanStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({}),
}, (table) => ({
  tenantPlanKeyIdx: uniqueIndex("uq_monetization_plan_tenant_key").on(table.tenantId, table.planKey).where(sql`tenant_id IS NOT NULL`),
  globalPlanKeyIdx: uniqueIndex("uq_monetization_plan_global_key").on(table.planKey).where(sql`tenant_id IS NULL`),
  statusIdx: index("idx_monetization_plans_status").on(table.status),
}));

export const insertMonetizationPlanSchema = createInsertSchema(ccMonetizationPlans).omit({
  id: true,
  createdAt: true,
});
export type MonetizationPlan = typeof ccMonetizationPlans.$inferSelect;
export type InsertMonetizationPlan = z.infer<typeof insertMonetizationPlanSchema>;

// Tenant Plan Assignments - Which plan a tenant is on (time-bounded)
export const ccMonetizationPlanAssignments = pgTable("cc_monetization_plan_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  planId: uuid("plan_id").notNull().references(() => ccMonetizationPlans.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  assignedByIndividualId: uuid("assigned_by_individual_id"),
  metadata: jsonb("metadata").notNull().default({}),
}, (table) => ({
  tenantStatusIdx: index("idx_monetization_assignments_tenant_status").on(table.tenantId, table.status),
  tenantEffectiveIdx: index("idx_monetization_assignments_tenant_effective").on(table.tenantId, table.effectiveFrom),
}));

export const insertMonetizationPlanAssignmentSchema = createInsertSchema(ccMonetizationPlanAssignments).omit({
  id: true,
  assignedAt: true,
});
export type MonetizationPlanAssignment = typeof ccMonetizationPlanAssignments.$inferSelect;
export type InsertMonetizationPlanAssignment = z.infer<typeof insertMonetizationPlanAssignmentSchema>;

// Monetization Events - The ledger. Append-only. This is the spine.
export const ccMonetizationEvents = pgTable("cc_monetization_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  portalId: uuid("portal_id"),
  circleId: uuid("circle_id"),
  eventType: text("event_type").notNull(), // matches monetizationEventTypeEnum values
  eventAt: timestamp("event_at", { withTimezone: true }).notNull().defaultNow(),
  actorIndividualId: uuid("actor_individual_id"),
  subjectType: text("subject_type"), // matches monetizationSubjectTypeEnum values
  subjectId: uuid("subject_id"),
  quantity: integer("quantity").notNull().default(1),
  planKey: text("plan_key"), // copied at event time
  periodKey: text("period_key").notNull(), // e.g., 2026-01 (for monthly aggregation)
  blocked: boolean("blocked").notNull().default(false),
  blockReason: text("block_reason"),
  clientRequestId: text("client_request_id"),
  metadata: jsonb("metadata").notNull().default({}),
}, (table) => ({
  tenantEventAtIdx: index("idx_monetization_events_tenant_type_at").on(table.tenantId, table.eventType, table.eventAt),
  tenantPeriodIdx: index("idx_monetization_events_tenant_period").on(table.tenantId, table.periodKey),
  clientRequestIdx: uniqueIndex("uq_monetization_events_client_request").on(table.tenantId, table.clientRequestId).where(sql`client_request_id IS NOT NULL`),
}));

export const insertMonetizationEventSchema = createInsertSchema(ccMonetizationEvents).omit({
  id: true,
});
export type MonetizationEvent = typeof ccMonetizationEvents.$inferSelect;
export type InsertMonetizationEvent = z.infer<typeof insertMonetizationEventSchema>;

// Plan Usage Snapshots - Pre-aggregated usage for fast gating
export const ccMonetizationUsageSnapshots = pgTable("cc_monetization_usage_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  planId: uuid("plan_id").notNull().references(() => ccMonetizationPlans.id),
  periodKey: text("period_key").notNull(), // e.g., 2026-01
  usage: jsonb("usage").notNull().$type<Record<string, number>>(), // e.g., { emergency_run_started: 2 }
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueTenantPlanPeriod: uniqueIndex("uq_monetization_usage_tenant_plan_period").on(table.tenantId, table.planId, table.periodKey),
}));

export const insertMonetizationUsageSnapshotSchema = createInsertSchema(ccMonetizationUsageSnapshots).omit({
  id: true,
  computedAt: true,
});
export type MonetizationUsageSnapshot = typeof ccMonetizationUsageSnapshots.$inferSelect;
export type InsertMonetizationUsageSnapshot = z.infer<typeof insertMonetizationUsageSnapshotSchema>;

// ============================================================================
// P2.16 SYSTEM COMPLETION MATRIX (SCM) - Certification Integration
// ============================================================================

// Certification policy schema
export const certificationPolicySchema = z.object({
  certifiable_when: z.object({
    qa_status_endpoint_ok: z.boolean().optional(),
    smoke_test_script_passed: z.boolean().optional(),
    rls_enabled: z.boolean().optional(),
    critical_triggers_present: z.boolean().optional(),
    docs_present: z.boolean().optional(),
  }).optional(),
  proof_artifacts: z.object({
    qa_status_endpoint: z.string().optional(),
    smoke_test_script: z.string().optional(),
    docs: z.array(z.string()).optional(),
    sql_queries_doc: z.string().optional(),
  }).optional(),
  default_strategy: z.enum(['hold_for_flex', 'certify_immediate', 'blocked']).optional(),
  allowed_states: z.array(z.enum(['built', 'certifiable', 'certified', 'held'])).optional(),
});
export type CertificationPolicy = z.infer<typeof certificationPolicySchema>;

// SCM Module Registry
export const scmModules = pgTable("scm_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleKey: text("module_key").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  owner: text("owner").notNull().default('platform'),
  certificationPolicy: jsonb("certification_policy").notNull().$type<CertificationPolicy>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScmModuleSchema = createInsertSchema(scmModules).omit({ id: true, createdAt: true });
export type ScmModule = typeof scmModules.$inferSelect;
export type InsertScmModule = z.infer<typeof insertScmModuleSchema>;

// SCM Proof Runs - stores proof run results
export const scmProofRunTypeEnum = z.enum(['qa_status', 'smoke_test', 'sql_verification']);
export type ScmProofRunType = z.infer<typeof scmProofRunTypeEnum>;

export const scmProofRuns = pgTable("scm_proof_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"), // null = platform-wide proof run
  moduleKey: text("module_key"), // optional: if run is for a specific module
  runType: text("run_type").notNull(), // qa_status | smoke_test | sql_verification
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  ok: boolean("ok").notNull(),
  details: jsonb("details").notNull().$type<Record<string, unknown>>().default({}),
  artifactRefs: jsonb("artifact_refs").notNull().$type<string[]>().default([]),
  createdByIndividualId: uuid("created_by_individual_id"),
}, (table) => ({
  runTypeAtIdx: index("idx_scm_proof_runs_type_at").on(table.runType, table.runAt),
}));

export const insertScmProofRunSchema = createInsertSchema(scmProofRuns).omit({ id: true });
export type ScmProofRun = typeof scmProofRuns.$inferSelect;
export type InsertScmProofRun = z.infer<typeof insertScmProofRunSchema>;

// SCM Module Overrides - manual state overrides
export const scmModuleStateEnum = z.enum(['built', 'held', 'certified']);
export type ScmModuleState = z.infer<typeof scmModuleStateEnum>;

export const scmModuleOverrides = pgTable("scm_module_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleKey: text("module_key").notNull(),
  overrideState: text("override_state").notNull(), // built | held | certified
  overrideReason: text("override_reason"),
  setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
  setByIndividualId: uuid("set_by_individual_id"),
}, (table) => ({
  moduleKeyIdx: index("idx_scm_module_overrides_key").on(table.moduleKey),
}));

export const insertScmModuleOverrideSchema = createInsertSchema(scmModuleOverrides).omit({ id: true, setAt: true });
export type ScmModuleOverride = typeof scmModuleOverrides.$inferSelect;
export type InsertScmModuleOverride = z.infer<typeof insertScmModuleOverrideSchema>;

// SCM Certification States - computed states for each module
export const scmCertificationStates = pgTable("scm_certification_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleKey: text("module_key").notNull().unique(),
  computedState: text("computed_state").notNull(), // built | certifiable
  effectiveState: text("effective_state").notNull(), // final state after override
  isBuilt: boolean("is_built").notNull().default(false),
  isCertifiable: boolean("is_certifiable").notNull().default(false),
  isCertified: boolean("is_certified").notNull().default(false),
  isHeld: boolean("is_held").notNull().default(false),
  lastQaStatusRunId: uuid("last_qa_status_run_id"),
  lastQaStatusOk: boolean("last_qa_status_ok"),
  lastSmokeTestRunId: uuid("last_smoke_test_run_id"),
  lastSmokeTestOk: boolean("last_smoke_test_ok"),
  docsPresent: boolean("docs_present").notNull().default(false),
  missingDocs: jsonb("missing_docs").notNull().$type<string[]>().default([]),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScmCertificationStateSchema = createInsertSchema(scmCertificationStates).omit({ id: true, computedAt: true });
export type ScmCertificationState = typeof scmCertificationStates.$inferSelect;
export type InsertScmCertificationState = z.infer<typeof insertScmCertificationStateSchema>;

// ============================================================================
// P2.17 Emergency Drill Mode + Synthetic Incident Generator
// ============================================================================

export const drillScenarioTypeEnum = z.enum([
  'tsunami', 'wildfire', 'power_outage', 'storm', 'evacuation', 'multi_hazard', 'other'
]);
export type DrillScenarioType = z.infer<typeof drillScenarioTypeEnum>;

export const drillStatusEnum = z.enum(['active', 'completed', 'cancelled']);
export type DrillStatus = z.infer<typeof drillStatusEnum>;

export const ccDrillSessions = pgTable("cc_drill_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  portalId: uuid("portal_id"),
  circleId: uuid("circle_id"),
  title: text("title").notNull(),
  scenarioType: text("scenario_type").notNull(),
  status: text("status").notNull().default('active'),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  startedByIndividualId: uuid("started_by_individual_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedByIndividualId: uuid("completed_by_individual_id"),
  notes: text("notes"),
  clientRequestId: text("client_request_id"),
  metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
}, (table) => ({
  tenantStartedIdx: index("idx_drill_sessions_tenant_started").on(table.tenantId, table.startedAt),
  clientRequestIdUnique: index("idx_drill_sessions_client_request_id").on(table.tenantId, table.clientRequestId),
}));

export const insertDrillSessionSchema = createInsertSchema(ccDrillSessions).omit({ id: true, startedAt: true });
export type DrillSession = typeof ccDrillSessions.$inferSelect;
export type InsertDrillSession = z.infer<typeof insertDrillSessionSchema>;

export const ccDrillScripts = pgTable("cc_drill_scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  title: text("title").notNull(),
  scenarioType: text("scenario_type").notNull(),
  scriptJson: jsonb("script_json").notNull().$type<Record<string, unknown>>(),
  scriptSha256: text("script_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByIndividualId: uuid("created_by_individual_id"),
  metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
}, (table) => ({
  tenantScenarioIdx: index("idx_drill_scripts_tenant_scenario").on(table.tenantId, table.scenarioType),
  tenantHashUnique: index("idx_drill_scripts_tenant_hash").on(table.tenantId, table.scriptSha256),
}));

export const insertDrillScriptSchema = createInsertSchema(ccDrillScripts).omit({ id: true, createdAt: true, scriptSha256: true });
export type DrillScript = typeof ccDrillScripts.$inferSelect;
export type InsertDrillScript = z.infer<typeof insertDrillScriptSchema>;

// ============================================================================
// JOBS BACKEND - Distribution, Moderation, Public Apply (Migration 140)
// ============================================================================

// Job Posting Publish State enum
export const jobPostingPublishStateEnum = pgEnum("job_posting_publish_state", [
  "draft", "pending_review", "published", "rejected", "paused", "archived"
]);

// Tenant → Legal Entity mapping
export const ccTenantLegalEntities = pgTable("cc_tenant_legal_entities", {
  tenantId: uuid("tenant_id").primaryKey(),
  legalPartyId: uuid("legal_party_id").notNull(),
  dbaNameSnapshot: text("dba_name_snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTenantLegalEntitySchema = createInsertSchema(ccTenantLegalEntities).omit({ createdAt: true, updatedAt: true });
export type TenantLegalEntity = typeof ccTenantLegalEntities.$inferSelect;
export type InsertTenantLegalEntity = z.infer<typeof insertTenantLegalEntitySchema>;

// Portal Distribution Policies
export const ccPortalDistributionPolicies = pgTable("cc_portal_distribution_policies", {
  portalId: uuid("portal_id").primaryKey(),
  isAcceptingJobPostings: boolean("is_accepting_job_postings").notNull().default(true),
  requiresModeration: boolean("requires_moderation").notNull().default(false),
  pricingModel: text("pricing_model").notNull().default("free"),
  priceHint: text("price_hint"),
  defaultSelected: boolean("default_selected").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortalDistributionPolicySchema = createInsertSchema(ccPortalDistributionPolicies).omit({ createdAt: true, updatedAt: true });
export type PortalDistributionPolicy = typeof ccPortalDistributionPolicies.$inferSelect;
export type InsertPortalDistributionPolicy = z.infer<typeof insertPortalDistributionPolicySchema>;

// Embed Surfaces
export const ccEmbedSurfaces = pgTable("cc_embed_surfaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  label: text("label").notNull(),
  embedKeyHash: text("embed_key_hash").notNull().unique(),
  allowedDomains: text("allowed_domains").array().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_embed_surfaces_tenant").on(table.tenantId),
}));

export const insertEmbedSurfaceSchema = createInsertSchema(ccEmbedSurfaces).omit({ id: true, createdAt: true, updatedAt: true });
export type EmbedSurface = typeof ccEmbedSurfaces.$inferSelect;
export type InsertEmbedSurface = z.infer<typeof insertEmbedSurfaceSchema>;

// Job Embed Publications
export const ccJobEmbedPublications = pgTable("cc_job_embed_publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull(),
  embedSurfaceId: uuid("embed_surface_id").notNull(),
  publishState: jobPostingPublishStateEnum("publish_state").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobIdx: index("idx_job_embed_pubs_job").on(table.jobId),
  surfaceIdx: index("idx_job_embed_pubs_surface").on(table.embedSurfaceId),
  uniqueJobSurface: uniqueIndex("uq_job_embed_pub").on(table.jobId, table.embedSurfaceId),
}));

export const insertJobEmbedPublicationSchema = createInsertSchema(ccJobEmbedPublications).omit({ id: true, createdAt: true, updatedAt: true });
export type JobEmbedPublication = typeof ccJobEmbedPublications.$inferSelect;
export type InsertJobEmbedPublication = z.infer<typeof insertJobEmbedPublicationSchema>;

// External Job Distribution Channels
export const ccJobDistributionChannels = pgTable("cc_job_distribution_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerKey: text("provider_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  pricingModel: text("pricing_model").notNull().default("paid"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobDistributionChannelSchema = createInsertSchema(ccJobDistributionChannels).omit({ id: true, createdAt: true, updatedAt: true });
export type JobDistributionChannel = typeof ccJobDistributionChannels.$inferSelect;
export type InsertJobDistributionChannel = z.infer<typeof insertJobDistributionChannelSchema>;

// Job Channel Publications (queued publications to external channels)
export const ccJobChannelPublications = pgTable("cc_job_channel_publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull(),
  channelId: uuid("channel_id").notNull(),
  publishState: text("publish_state").notNull().default("queued"),
  externalPostingId: text("external_posting_id"),
  externalPostingUrl: text("external_posting_url"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobIdx: index("idx_job_channel_pubs_job").on(table.jobId),
  uniqueJobChannel: uniqueIndex("uq_job_channel_pub").on(table.jobId, table.channelId),
}));

export const insertJobChannelPublicationSchema = createInsertSchema(ccJobChannelPublications).omit({ id: true, createdAt: true, updatedAt: true });
export type JobChannelPublication = typeof ccJobChannelPublications.$inferSelect;
export type InsertJobChannelPublication = z.infer<typeof insertJobChannelPublicationSchema>;

// Document Templates for employer hiring docs
export const ccDocumentTemplates = pgTable("cc_document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerLegalPartyId: uuid("owner_legal_party_id").notNull(),
  templateType: text("template_type").notNull(),
  name: text("name").notNull(),
  sourceMediaId: uuid("source_media_id"),
  templatePayload: jsonb("template_payload").notNull().default({}),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index("idx_doc_templates_owner").on(table.ownerLegalPartyId),
}));

export const insertDocumentTemplateSchema = createInsertSchema(ccDocumentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type DocumentTemplate = typeof ccDocumentTemplates.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;

// Public Upload Sessions for anonymous applicant uploads
export const ccPublicUploadSessions = pgTable("cc_public_upload_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  purpose: text("purpose").notNull(),
  portalId: uuid("portal_id"),
  jobId: uuid("job_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_public_upload_sessions_token").on(table.sessionTokenHash),
}));

export const insertPublicUploadSessionSchema = createInsertSchema(ccPublicUploadSessions).omit({ id: true, createdAt: true });
export type PublicUploadSession = typeof ccPublicUploadSessions.$inferSelect;
export type InsertPublicUploadSession = z.infer<typeof insertPublicUploadSessionSchema>;

// Public Upload Session Media
export const ccPublicUploadSessionMedia = pgTable("cc_public_upload_session_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  mediaId: uuid("media_id"),
  f2Key: text("f2_key"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_pub_upload_media_session").on(table.sessionId),
}));

export const insertPublicUploadSessionMediaSchema = createInsertSchema(ccPublicUploadSessionMedia).omit({ id: true, createdAt: true });
export type PublicUploadSessionMedia = typeof ccPublicUploadSessionMedia.$inferSelect;
export type InsertPublicUploadSessionMedia = z.infer<typeof insertPublicUploadSessionMediaSchema>;

// Job Ingestion Status enum
export const jobIngestionStatusEnum = pgEnum("job_ingestion_status", [
  "pending", "processing", "draft_ready", "approved", "failed", "cancelled"
]);

// Job Ingestion Tasks
export const ccJobIngestionTasks = pgTable("cc_job_ingestion_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  ingestionType: text("ingestion_type").notNull(),
  sourceUrl: text("source_url"),
  sourceMediaId: uuid("source_media_id"),
  aiPrompt: text("ai_prompt"),
  status: jobIngestionStatusEnum("status").notNull().default("pending"),
  extractedData: jsonb("extracted_data").default({}),
  draftJobData: jsonb("draft_job_data").default({}),
  errorMessage: text("error_message"),
  jobId: uuid("job_id"),
  createdByUserId: uuid("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_job_ingestion_tenant").on(table.tenantId),
  statusIdx: index("idx_job_ingestion_status").on(table.status),
}));

export const insertJobIngestionTaskSchema = createInsertSchema(ccJobIngestionTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type JobIngestionTask = typeof ccJobIngestionTasks.$inferSelect;
export type InsertJobIngestionTask = z.infer<typeof insertJobIngestionTaskSchema>;

// ============================================================================
// N3 SERVICE RUN MONITOR + REPLAN ENGINE
// PATENT CC-01 INVENTOR GLENN BALLMAN
// ============================================================================

// N3 Service Runs (Monitor/Replan)
export const ccN3Runs = pgTable("cc_n3_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("scheduled"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  portalId: uuid("portal_id"),
  zoneId: uuid("zone_id").references(() => ccZones.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_n3_runs_tenant").on(table.tenantId),
  statusIdx: index("idx_n3_runs_status").on(table.status),
  startsIdx: index("idx_n3_runs_starts").on(table.startsAt),
  portalIdx: index("idx_n3_runs_portal_id").on(table.portalId),
  zoneIdx: index("idx_n3_runs_zone_id").on(table.zoneId),
}));

export const insertN3RunSchema = createInsertSchema(ccN3Runs).omit({ id: true, createdAt: true, updatedAt: true });
export type N3Run = typeof ccN3Runs.$inferSelect;
export type InsertN3Run = z.infer<typeof insertN3RunSchema>;

// N3 Segment kinds: move | ride | work | stay | wait | load
export const ccN3Segments = pgTable("cc_n3_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  runId: uuid("run_id").notNull().references(() => ccN3Runs.id, { onDelete: "cascade" }),
  segmentKind: text("segment_kind").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  startWindow: jsonb("start_window"),
  endWindow: jsonb("end_window"),
  locationRef: text("location_ref"),
  dependsOnSegmentId: uuid("depends_on_segment_id"),
  constraints: jsonb("constraints"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdx: index("idx_n3_segments_run").on(table.runId),
  kindIdx: index("idx_n3_segments_kind").on(table.segmentKind),
}));

export const insertN3SegmentSchema = createInsertSchema(ccN3Segments).omit({ id: true, createdAt: true });
export type N3Segment = typeof ccN3Segments.$inferSelect;
export type InsertN3Segment = z.infer<typeof insertN3SegmentSchema>;

// Tide Predictions (deterministic signal)
export const ccTidePredictions = pgTable("cc_tide_predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationRef: text("location_ref").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  heightM: numeric("height_m", { precision: 6, scale: 3 }).notNull(),
}, (table) => ({
  locTsIdx: index("idx_tide_predictions_loc_ts").on(table.locationRef, table.ts),
}));

export const insertTidePredictionSchema = createInsertSchema(ccTidePredictions).omit({ id: true });
export type TidePrediction = typeof ccTidePredictions.$inferSelect;
export type InsertTidePrediction = z.infer<typeof insertTidePredictionSchema>;

// Weather Normals (probabilistic signal)
export const ccWeatherNormals = pgTable("cc_weather_normals", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationRef: text("location_ref").notNull(),
  dayOfYear: integer("day_of_year").notNull(),
  tempLowC: numeric("temp_low_c", { precision: 5, scale: 2 }),
  tempHighC: numeric("temp_high_c", { precision: 5, scale: 2 }),
  rainProb: numeric("rain_prob", { precision: 4, scale: 3 }),
  fogProb: numeric("fog_prob", { precision: 4, scale: 3 }),
  windProb: numeric("wind_prob", { precision: 4, scale: 3 }),
}, (table) => ({
  locDoyUnique: uniqueIndex("idx_weather_normals_loc_doy").on(table.locationRef, table.dayOfYear),
}));

export const insertWeatherNormalSchema = createInsertSchema(ccWeatherNormals).omit({ id: true });
export type WeatherNormal = typeof ccWeatherNormals.$inferSelect;
export type InsertWeatherNormal = z.infer<typeof insertWeatherNormalSchema>;

// Monitor Policies
export const ccMonitorPolicies = pgTable("cc_monitor_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  cadenceRules: jsonb("cadence_rules").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_monitor_policies_tenant").on(table.tenantId),
}));

export const insertMonitorPolicySchema = createInsertSchema(ccMonitorPolicies).omit({ id: true, createdAt: true });
export type MonitorPolicy = typeof ccMonitorPolicies.$inferSelect;
export type InsertMonitorPolicy = z.infer<typeof insertMonitorPolicySchema>;

// Monitor State
export const ccMonitorState = pgTable("cc_monitor_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  runId: uuid("run_id").notNull().unique().references(() => ccN3Runs.id, { onDelete: "cascade" }),
  policyId: uuid("policy_id").notNull().references(() => ccMonitorPolicies.id),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
  lastRiskScore: numeric("last_risk_score", { precision: 5, scale: 3 }),
  lastRiskFingerprint: text("last_risk_fingerprint"),
  lastBundleId: uuid("last_bundle_id"),
}, (table) => ({
  tenantIdx: index("idx_monitor_state_tenant").on(table.tenantId),
  nextCheckIdx: index("idx_monitor_state_next_check").on(table.nextCheckAt),
}));

export const insertMonitorStateSchema = createInsertSchema(ccMonitorState).omit({ id: true });
export type MonitorState = typeof ccMonitorState.$inferSelect;
export type InsertMonitorState = z.infer<typeof insertMonitorStateSchema>;

// Replan Bundle status: open | dismissed | actioned
export const ccReplanBundles = pgTable("cc_replan_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  runId: uuid("run_id").notNull().references(() => ccN3Runs.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("open"),
  reasonCodes: text("reason_codes").array().notNull().default([]),
  summary: text("summary").notNull(),
  riskDelta: numeric("risk_delta", { precision: 5, scale: 3 }).notNull().default("0"),
  bundle: jsonb("bundle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_replan_bundles_tenant").on(table.tenantId),
  runIdx: index("idx_replan_bundles_run").on(table.runId),
  statusIdx: index("idx_replan_bundles_status").on(table.status),
}));

export const insertReplanBundleSchema = createInsertSchema(ccReplanBundles).omit({ id: true, createdAt: true });
export type ReplanBundle = typeof ccReplanBundles.$inferSelect;
export type InsertReplanBundle = z.infer<typeof insertReplanBundleSchema>;

// Replan Options
export const ccReplanOptions = pgTable("cc_replan_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id").notNull().references(() => ccReplanBundles.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  label: text("label").notNull(),
  plan: jsonb("plan").notNull(),
  validation: jsonb("validation").notNull(),
  estimatedImpact: jsonb("estimated_impact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  bundleIdx: index("idx_replan_options_bundle").on(table.bundleId),
}));

export const insertReplanOptionSchema = createInsertSchema(ccReplanOptions).omit({ id: true, createdAt: true });
export type ReplanOption = typeof ccReplanOptions.$inferSelect;
export type InsertReplanOption = z.infer<typeof insertReplanOptionSchema>;

// Replan Actions - action_kind: suggest | request | dictate
export const ccReplanActions = pgTable("cc_replan_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  bundleId: uuid("bundle_id").notNull().references(() => ccReplanBundles.id),
  optionId: uuid("option_id").notNull().references(() => ccReplanOptions.id),
  actionKind: text("action_kind").notNull(),
  actorId: uuid("actor_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_replan_actions_tenant").on(table.tenantId),
  bundleIdx: index("idx_replan_actions_bundle").on(table.bundleId),
}));

export const insertReplanActionSchema = createInsertSchema(ccReplanActions).omit({ id: true, createdAt: true });
export type ReplanAction = typeof ccReplanActions.$inferSelect;
export type InsertReplanAction = z.infer<typeof insertReplanActionSchema>;

// N3 Surface Requirements - Bind segments to surfaces with actor profiles and constraints
export const ccN3SurfaceRequirements = pgTable("cc_n3_surface_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  runId: uuid("run_id").notNull().references(() => ccN3Runs.id, { onDelete: "cascade" }),
  segmentId: uuid("segment_id").notNull().references(() => ccN3Segments.id, { onDelete: "cascade" }),
  surfaceId: uuid("surface_id").notNull(),
  containerId: uuid("container_id"),
  requiredSurfaceType: varchar("required_surface_type").notNull(), // movement, sleep, sit, stand, utility
  actorProfile: jsonb("actor_profile").notNull().default({}), // { actor_type, mass_g, width_mm, footprint_mm2, traction }
  demand: jsonb("demand").notNull().default({}), // { watts_continuous, hours, sit_units_requested, rowing_required }
  requiredConstraints: jsonb("required_constraints").notNull().default({}), // { no_grates, min_clear_width_mm, max_slope_pct }
  riskTolerance: numeric("risk_tolerance", { precision: 4, scale: 3 }).notNull().default("0.5"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalRunIdx: index("idx_n3_surface_req_portal_run").on(table.portalId, table.runId),
  portalSegmentIdx: index("idx_n3_surface_req_portal_segment").on(table.portalId, table.segmentId),
  portalSurfaceIdx: index("idx_n3_surface_req_portal_surface").on(table.portalId, table.surfaceId),
}));

export const insertN3SurfaceRequirementSchema = createInsertSchema(ccN3SurfaceRequirements).omit({ id: true, createdAt: true });
export type N3SurfaceRequirement = typeof ccN3SurfaceRequirements.$inferSelect;
export type InsertN3SurfaceRequirement = z.infer<typeof insertN3SurfaceRequirementSchema>;

// N3 Effective Capacity Evaluations - Audit/replay of capacity evaluations
export const ccN3EffectiveCapacityEvaluations = pgTable("cc_n3_effective_capacity_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  runId: uuid("run_id").notNull(),
  segmentId: uuid("segment_id").notNull(),
  surfaceRequirementId: uuid("surface_requirement_id").notNull().references(() => ccN3SurfaceRequirements.id, { onDelete: "cascade" }),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  timeStart: timestamp("time_start", { withTimezone: true }).notNull(),
  timeEnd: timestamp("time_end", { withTimezone: true }).notNull(),
  result: jsonb("result").notNull(), // EffectiveCapacity payload
  riskScore: numeric("risk_score", { precision: 5, scale: 3 }).notNull(),
  riskFingerprint: varchar("risk_fingerprint").notNull(), // md5 of normalized result
}, (table) => ({
  portalRunSegmentIdx: index("idx_n3_eff_cap_portal_run_segment").on(table.portalId, table.runId, table.segmentId),
  portalRunEvaluatedIdx: index("idx_n3_eff_cap_portal_run_evaluated").on(table.portalId, table.runId, table.evaluatedAt),
}));

export const insertN3EffectiveCapacityEvaluationSchema = createInsertSchema(ccN3EffectiveCapacityEvaluations).omit({ id: true, evaluatedAt: true });
export type N3EffectiveCapacityEvaluation = typeof ccN3EffectiveCapacityEvaluations.$inferSelect;
export type InsertN3EffectiveCapacityEvaluation = z.infer<typeof insertN3EffectiveCapacityEvaluationSchema>;

// ============================================================================
// PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
// V3.5 Surface Spine: Containers, Surfaces, Atomic Units, Claims, Utility
// ============================================================================

// Surface Containers - hierarchy for cottages, rooms, docks, slips, etc.
export const ccSurfaceContainers = pgTable("cc_surface_containers", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  parentContainerId: uuid("parent_container_id"),
  containerType: varchar("container_type").notNull(),
  title: varchar("title").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  minDoorWidthMm: integer("min_door_width_mm"),
  hasSteps: boolean("has_steps").notNull().default(false),
  notesAccessibility: text("notes_accessibility"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalTypeIdx: index("idx_surface_containers_portal_type").on(table.portalId, table.containerType),
  parentIdx: index("idx_surface_containers_parent").on(table.parentContainerId),
}));

export const insertSurfaceContainerSchema = createInsertSchema(ccSurfaceContainers).omit({ id: true, createdAt: true, updatedAt: true });
export type SurfaceContainer = typeof ccSurfaceContainers.$inferSelect;
export type InsertSurfaceContainer = z.infer<typeof insertSurfaceContainerSchema>;

// Surfaces - physical surface anchors (bunks, seats, dock edges, outlets)
export const ccSurfaces = pgTable("cc_surfaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  surfaceType: varchar("surface_type").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  lengthMm: integer("length_mm"),
  widthMm: integer("width_mm"),
  areaSqmm: bigint("area_sqmm", { mode: "number" }),
  linearMm: integer("linear_mm"),
  minClearWidthMm: integer("min_clear_width_mm"),
  maxSlopePct: numeric("max_slope_pct"),
  hasGrates: boolean("has_grates").notNull().default(false),
  surfaceTags: text("surface_tags").array(),
  utilityType: varchar("utility_type"),
  utilityConnector: varchar("utility_connector"),
  metadata: jsonb("metadata").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalTypeActiveIdx: index("idx_surfaces_portal_type_active").on(table.portalId, table.surfaceType, table.isActive),
}));

export const insertSurfaceSchema = createInsertSchema(ccSurfaces).omit({ id: true, createdAt: true, updatedAt: true });
export type Surface = typeof ccSurfaces.$inferSelect;
export type InsertSurface = z.infer<typeof insertSurfaceSchema>;

// Surface Container Members - maps surfaces to containers
export const ccSurfaceContainerMembers = pgTable("cc_surface_container_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  containerId: uuid("container_id").notNull().references(() => ccSurfaceContainers.id, { onDelete: "cascade" }),
  surfaceId: uuid("surface_id").notNull().references(() => ccSurfaces.id, { onDelete: "cascade" }),
  role: varchar("role"),
  sortOrder: integer("sort_order").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  containerIdx: index("idx_surface_container_members_container").on(table.portalId, table.containerId),
  surfaceIdx: index("idx_surface_container_members_surface").on(table.portalId, table.surfaceId),
  unique: uniqueIndex("idx_surface_container_members_unique").on(table.containerId, table.surfaceId),
}));

export const insertSurfaceContainerMemberSchema = createInsertSchema(ccSurfaceContainerMembers).omit({ id: true, createdAt: true });
export type SurfaceContainerMember = typeof ccSurfaceContainerMembers.$inferSelect;
export type InsertSurfaceContainerMember = z.infer<typeof insertSurfaceContainerMemberSchema>;

// Surface Units - ATOMIC UNITS (each individually addressable for billing, refunds, incidents)
export const ccSurfaceUnits = pgTable("cc_surface_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  surfaceId: uuid("surface_id").notNull().references(() => ccSurfaces.id, { onDelete: "cascade" }),
  unitType: varchar("unit_type").notNull(),
  unitIndex: integer("unit_index").notNull(),
  label: varchar("label"),
  unitMaxLbs: integer("unit_max_lbs"),
  unitTags: text("unit_tags").array(),
  metadata: jsonb("metadata").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalTypeIdx: index("idx_surface_units_portal_type").on(table.portalId, table.unitType),
  surfaceIdx: index("idx_surface_units_surface").on(table.portalId, table.surfaceId),
  unique: uniqueIndex("idx_surface_units_unique").on(table.surfaceId, table.unitType, table.unitIndex),
}));

export const insertSurfaceUnitSchema = createInsertSchema(ccSurfaceUnits).omit({ id: true, createdAt: true, updatedAt: true });
export type SurfaceUnit = typeof ccSurfaceUnits.$inferSelect;
export type InsertSurfaceUnit = z.infer<typeof insertSurfaceUnitSchema>;

// Surface Claims - time-bound allocation of unit_ids
export const ccSurfaceClaims = pgTable("cc_surface_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  containerId: uuid("container_id").references(() => ccSurfaceContainers.id),
  reservationId: uuid("reservation_id"),
  holdToken: varchar("hold_token"),
  claimStatus: varchar("claim_status").notNull(),
  timeStart: timestamp("time_start", { withTimezone: true }).notNull(),
  timeEnd: timestamp("time_end", { withTimezone: true }).notNull(),
  unitIds: uuid("unit_ids").array().notNull(),
  assignedParticipantId: uuid("assigned_participant_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_surface_claims_token").on(table.portalId, table.holdToken),
  reservationIdx: index("idx_surface_claims_reservation").on(table.portalId, table.reservationId),
  statusIdx: index("idx_surface_claims_status").on(table.portalId, table.claimStatus),
  timeIdx: index("idx_surface_claims_time").on(table.portalId, table.timeStart, table.timeEnd),
}));

export const insertSurfaceClaimSchema = createInsertSchema(ccSurfaceClaims).omit({ id: true, createdAt: true, updatedAt: true });
export type SurfaceClaim = typeof ccSurfaceClaims.$inferSelect;
export type InsertSurfaceClaim = z.infer<typeof insertSurfaceClaimSchema>;

// Surface Tasks - housekeeping work orders (cleaning, setup, inspection)
export const ccSurfaceTasks = pgTable("cc_surface_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  surfaceUnitId: uuid("surface_unit_id").notNull().references(() => ccSurfaceUnits.id, { onDelete: 'cascade' }),
  taskType: varchar("task_type").notNull(), // clean, setup, inspect, repair
  status: varchar("status").notNull().default('open'), // open, in_progress, done, canceled
  assignedToUserId: uuid("assigned_to_user_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("idx_surface_tasks_status").on(table.portalId, table.status),
  unitIdx: index("idx_surface_tasks_unit").on(table.portalId, table.surfaceUnitId),
  assignedIdx: index("idx_surface_tasks_assigned").on(table.portalId, table.assignedToUserId),
}));

export const insertSurfaceTaskSchema = createInsertSchema(ccSurfaceTasks).omit({ id: true, createdAt: true });
export type SurfaceTask = typeof ccSurfaceTasks.$inferSelect;
export type InsertSurfaceTask = z.infer<typeof insertSurfaceTaskSchema>;

// Housekeeping Rates - pay model per unit completed
export const ccHousekeepingRates = pgTable("cc_housekeeping_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  unitType: varchar("unit_type").notNull().default('sleep'), // sleep, parking, marina, etc.
  payCentsPerUnit: integer("pay_cents_per_unit").notNull(),
  currency: varchar("currency").notNull().default('CAD'),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalTypeIdx: index("idx_housekeeping_rates_portal").on(table.portalId, table.unitType),
}));

export const insertHousekeepingRateSchema = createInsertSchema(ccHousekeepingRates).omit({ id: true, createdAt: true });
export type HousekeepingRate = typeof ccHousekeepingRates.$inferSelect;
export type InsertHousekeepingRate = z.infer<typeof insertHousekeepingRateSchema>;

// Media Assets - URL-based photo attachments for containers/surfaces/units
export const ccMediaAssets = pgTable("cc_media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  targetType: varchar("target_type").notNull(), // container, surface, unit
  targetId: uuid("target_id").notNull(),
  mediaType: varchar("media_type").notNull().default('photo'), // photo, document, video
  url: text("url").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  targetIdx: index("idx_media_assets_target").on(table.portalId, table.targetType, table.targetId),
}));

export const insertMediaAssetSchema = createInsertSchema(ccMediaAssets).omit({ id: true, createdAt: true });
export type MediaAsset = typeof ccMediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;

// Utility Nodes - shared power pools, panels, feeders
export const ccUtilityNodes = pgTable("cc_utility_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  nodeType: varchar("node_type").notNull(),
  utilityType: varchar("utility_type").notNull(),
  title: varchar("title").notNull(),
  capacity: jsonb("capacity").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalTypeIdx: index("idx_utility_nodes_portal_type").on(table.portalId, table.utilityType, table.nodeType),
}));

export const insertUtilityNodeSchema = createInsertSchema(ccUtilityNodes).omit({ id: true, createdAt: true, updatedAt: true });
export type UtilityNode = typeof ccUtilityNodes.$inferSelect;
export type InsertUtilityNode = z.infer<typeof insertUtilityNodeSchema>;

// Surface Utility Bindings - connects surfaces to utility nodes
export const ccSurfaceUtilityBindings = pgTable("cc_surface_utility_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  surfaceId: uuid("surface_id").notNull().references(() => ccSurfaces.id, { onDelete: "cascade" }),
  utilityNodeId: uuid("utility_node_id").notNull().references(() => ccUtilityNodes.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalIdx: index("idx_surface_utility_bindings_portal").on(table.portalId),
  nodeIdx: index("idx_surface_utility_bindings_node").on(table.utilityNodeId),
  unique: uniqueIndex("idx_surface_utility_bindings_unique").on(table.surfaceId, table.utilityNodeId),
}));

export const insertSurfaceUtilityBindingSchema = createInsertSchema(ccSurfaceUtilityBindings).omit({ id: true, createdAt: true });
export type SurfaceUtilityBinding = typeof ccSurfaceUtilityBindings.$inferSelect;
export type InsertSurfaceUtilityBinding = z.infer<typeof insertSurfaceUtilityBindingSchema>;

/**
 * PATENT CC-02 V3.5 Surface Spine (Inventor: Glenn Ballman)
 * Capacity Policies - Normal vs Emergency lens CAPS
 * 
 * Lens Definitions:
 * - NORMAL: Recommended operations, standard business capacity
 * - EMERGENCY: Shelter density + life-safety mode (may close high-risk activities)
 * 
 * Cap Semantics: offerable_units = min(physical_active_units, cap_if_set)
 * Caps limit how many units can be offered; they cannot create units beyond physical.
 * 
 * closedInEmergency: Safety override - asset is completely unavailable in emergency
 * (separate from capacity concept; used for high-risk activities like watercraft)
 * 
 * Invariant: normal_units_limit <= emergency_units_limit (if both set and not closed)
 */
export const ccCapacityPolicies = pgTable("cc_capacity_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  containerId: uuid("container_id").notNull().references(() => ccSurfaceContainers.id, { onDelete: "cascade" }),
  surfaceType: varchar("surface_type").notNull(), // 'sleep' | 'sit' | 'stand' | 'utility' | 'movement'
  normalUnitsLimit: integer("normal_units_limit"),     // Cap for normal operations (null = no cap, use physical)
  emergencyUnitsLimit: integer("emergency_units_limit"), // Cap for emergency operations (null = no cap, use physical)
  closedInEmergency: boolean("closed_in_emergency").notNull().default(false), // Safety override: asset unavailable in emergency
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  portalContainerIdx: index("idx_capacity_policies_portal_container").on(table.portalId, table.containerId),
  surfaceTypeIdx: index("idx_capacity_policies_surface_type").on(table.surfaceType),
  unique: uniqueIndex("idx_capacity_policies_unique").on(table.portalId, table.containerId, table.surfaceType),
}));

export const insertCapacityPolicySchema = createInsertSchema(ccCapacityPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type CapacityPolicy = typeof ccCapacityPolicies.$inferSelect;
export type InsertCapacityPolicy = z.infer<typeof insertCapacityPolicySchema>;

// ============================================================================
// CONTRACTOR PROFILES - Prompt A1: Contractor Onboarding Entry Point
// ============================================================================

/**
 * Contractor Profiles - tracks contractor onboarding state and profile data
 * 
 * Contractors are users with contractor_admin or contractor_worker roles
 * This table tracks their onboarding journey through camera-first experiences
 * 
 * Roles that can access:
 * - contractor_admin: Full contractor access
 * - contractor_worker: Worker-level contractor access
 * - Platform admins impersonating contractors
 */
export const ccContractorProfiles = pgTable("cc_contractor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  portalId: uuid("portal_id").notNull(),
  tenantId: uuid("tenant_id"),
  
  // Onboarding state
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  onboardingStartedAt: timestamp("onboarding_started_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  
  // Onboarding progress (frontend-tracked, backend-persisted)
  vehicleStarted: boolean("vehicle_started").notNull().default(false),
  toolsStarted: boolean("tools_started").notNull().default(false),
  stickyNoteStarted: boolean("sticky_note_started").notNull().default(false),
  
  // Contractor role: contractor_admin or contractor_worker
  contractorRole: varchar("contractor_role", { length: 30 }).notNull().default('contractor_worker'),
  
  // DM thread for operator communication
  onboardingThreadId: uuid("onboarding_thread_id"),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPortalIdx: uniqueIndex("idx_contractor_profiles_user_portal").on(table.userId, table.portalId),
  portalIdx: index("idx_contractor_profiles_portal").on(table.portalId),
}));

export const insertContractorProfileSchema = createInsertSchema(ccContractorProfiles).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type ContractorProfile = typeof ccContractorProfiles.$inferSelect;
export type InsertContractorProfile = z.infer<typeof insertContractorProfileSchema>;

// ============================================================================
// A2: AI Ingestion Pipeline - Contractor Media Capture & AI Proposal
// ============================================================================

export const ccAiIngestions = pgTable("cc_ai_ingestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractorProfileId: uuid("contractor_profile_id").notNull(),
  
  // Source type: vehicle_photo | tool_photo | sticky_note
  sourceType: varchar("source_type", { length: 30 }).notNull(),
  
  // Status: proposed | confirmed | discarded | error
  status: varchar("status", { length: 20 }).notNull().default('proposed'),
  
  // Media array: [{ url, mime, bytes, width?, height?, captured_at }]
  media: jsonb("media").notNull().default([]),
  
  // AI-generated proposal (stub until A3/B2/C1)
  aiProposedPayload: jsonb("ai_proposed_payload").notNull().default({}),
  
  // Human-confirmed payload (set on confirm action)
  humanConfirmedPayload: jsonb("human_confirmed_payload"),
  
  // Confidence score (0-100)
  confidenceScore: numeric("confidence_score"),
  
  // Error message if status = 'error'
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantProfileCreatedIdx: index("idx_ai_ingestions_tenant_profile_created").on(table.tenantId, table.contractorProfileId, table.createdAt),
  tenantSourceCreatedIdx: index("idx_ai_ingestions_tenant_source_created").on(table.tenantId, table.sourceType, table.createdAt),
}));

export const insertAiIngestionSchema = createInsertSchema(ccAiIngestions).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type AiIngestion = typeof ccAiIngestions.$inferSelect;
export type InsertAiIngestion = z.infer<typeof insertAiIngestionSchema>;
