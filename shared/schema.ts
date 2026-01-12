import { pgTable, text, serial, timestamp, jsonb, integer, uuid, pgEnum, boolean, numeric, date, time, varchar, primaryKey, char } from "drizzle-orm/pg-core";
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

// Portal Moments (bookable experiences)
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
  advanceBookingDays: integer('advance_booking_days').default(1),
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
  externalBookingUrl: text('external_booking_url'),
  
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
  transportBookingRef: varchar('transport_booking_ref'),
  
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

// Asset Group Members - many-to-many link
export const cc_asset_group_members = pgTable('cc_asset_group_members', {
  groupId: uuid('group_id').notNull(),
  assetId: uuid('asset_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.groupId, t.assetId] }),
}));

export type AssetGroupMember = typeof cc_asset_group_members.$inferSelect;

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
  allowBookingRequests: boolean('allow_booking_requests').default(true),
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

// Reservation Carts - shopping cart for multi-item bookings
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Portal = typeof ccPortals.$inferSelect;
export type InsertPortal = typeof ccPortals.$inferInsert;

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
  bookingSettingsJson: jsonb('booking_settings_json').default({}),
  
  settlementMethod: varchar('settlement_method', { length: 50 }).default('invoice'),
  settlementAccountJson: jsonb('settlement_account_json').default({}),
  commissionPercent: numeric('commission_percent', { precision: 5, scale: 2 }).default('0'),
  
  externalBookingUrl: text('external_booking_url'),
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

// Transport Requests - bookings for sailings
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

// Transport Confirmations - booking confirmations with QR codes
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
  
  bookingRulesJson: jsonb('booking_rules_json').default({}),
  
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
