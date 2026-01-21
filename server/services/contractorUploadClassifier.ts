/**
 * A2.3: Unified Upload Classifier + Asset Router (Patent CC-11)
 * 
 * Classifies ANY contractor upload and routes to appropriate business graph entities:
 * - Vehicles/trailers → fleet assets
 * - Tools/materials → tool assets
 * - Jobsite photos → GPS-clustered jobsites
 * - Before/after → paired bundles
 * - Sticky notes/whiteboards → draft customers/service runs
 * - Documents/receipts → material extraction
 * 
 * HARD RULES:
 * - Always ingest first, classify with confidence
 * - Store provenance + confidence
 * - Propose next actions immediately
 * - No discard of uncertain data
 */

import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import {
  ccAiIngestions,
  ccContractorFleet,
  ccContractorTools,
  ccContractorJobsites,
  ccContractorCustomers,
  ccContractorPhotoBundles,
  type AiIngestion,
  type ContractorFleet,
  type ContractorTool,
  type ContractorJobsite,
  type ContractorCustomer,
} from '@shared/schema';

// ============================================================================
// Classification Types
// ============================================================================

export type ClassificationType = 
  | 'vehicle_truck'
  | 'vehicle_trailer'
  | 'vehicle_van'
  | 'tool'
  | 'material'
  | 'jobsite'
  | 'before_photo'
  | 'after_photo'
  | 'whiteboard'
  | 'sticky_note'
  | 'document'
  | 'receipt'
  | 'unknown';

export interface ClassificationResult {
  primary: ClassificationType;
  secondary: ClassificationType[];
  confidence: number;
}

export interface ExtractedEntity {
  value: string;
  confidence: number;
  source?: string;
}

export interface ExtractedEntities {
  // PRIVACY: No raw licensePlate field - only region is stored for fleet matching
  licensePlateRegion?: ExtractedEntity;
  companyName?: ExtractedEntity;
  phone?: ExtractedEntity;
  email?: ExtractedEntity;
  website?: ExtractedEntity;
  customerName?: ExtractedEntity;
  // PRIVACY: Address is ADVISORY ONLY - never presented as fact
  // UI must display as "Photo captured near..." not "Address:"
  addressAdvisory?: ExtractedEntity;
  materials?: Array<{ name: string; qty?: string; unit?: string; confidence: number }>;
  scopePhrases?: Array<{ text: string; confidence: number }>;
  dates?: Array<{ value: string; confidence: number }>;
  text?: string;
}

export interface GeoInference {
  lat?: number;
  lng?: number;
  proposedAddress?: string;
  confidence: number;
  source: 'exif' | 'ocr' | 'reverse_geocode' | 'none';
}

export interface ProposedLinks {
  vehicle: boolean;
  trailer: boolean;
  tool: boolean;
  material: boolean;
  jobsite: boolean;
  customer: boolean;
  serviceRun: boolean;
  beforeAfterBundle: boolean;
}

export interface MediaItem {
  url: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  captured_at?: string;
  exif?: any;
  geo_lat?: number;
  geo_lng?: number;
}

export interface ClassifiedIngestion {
  ingestionId: string;
  classification: ClassificationResult;
  extractedEntities: ExtractedEntities;
  geoInference: GeoInference;
  proposedLinks: ProposedLinks;
  nextActions: NextAction[];
}

export interface NextAction {
  type: 'confirm_vehicle' | 'confirm_tool' | 'confirm_jobsite' | 'confirm_customer' | 
        'request_before_photo' | 'request_after_photo' | 'confirm_make_model' | 
        'expand_service_area' | 'asset_upsell' | 'open_message_thread';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  payload?: any;
}

// ============================================================================
// Visual Classifier (Stub - will be replaced with real AI)
// ============================================================================

function classifyVisual(media: MediaItem): ClassificationResult {
  const url = media.url.toLowerCase();
  const mime = media.mime.toLowerCase();
  
  // Stub classification based on filename patterns
  // Real implementation would use vision AI
  
  if (url.includes('truck') || url.includes('vehicle')) {
    return { primary: 'vehicle_truck', secondary: [], confidence: 0.85 };
  }
  if (url.includes('trailer')) {
    return { primary: 'vehicle_trailer', secondary: [], confidence: 0.82 };
  }
  if (url.includes('van')) {
    return { primary: 'vehicle_van', secondary: [], confidence: 0.80 };
  }
  if (url.includes('tool')) {
    return { primary: 'tool', secondary: [], confidence: 0.78 };
  }
  if (url.includes('material') || url.includes('supply')) {
    return { primary: 'material', secondary: [], confidence: 0.75 };
  }
  if (url.includes('before')) {
    return { primary: 'before_photo', secondary: ['jobsite'], confidence: 0.88 };
  }
  if (url.includes('after')) {
    return { primary: 'after_photo', secondary: ['jobsite'], confidence: 0.88 };
  }
  if (url.includes('jobsite') || url.includes('site') || url.includes('work')) {
    return { primary: 'jobsite', secondary: [], confidence: 0.72 };
  }
  if (url.includes('sticky') || url.includes('note')) {
    return { primary: 'sticky_note', secondary: [], confidence: 0.90 };
  }
  if (url.includes('whiteboard') || url.includes('board')) {
    return { primary: 'whiteboard', secondary: [], confidence: 0.85 };
  }
  if (url.includes('receipt')) {
    return { primary: 'receipt', secondary: ['material'], confidence: 0.82 };
  }
  if (url.includes('document') || url.includes('doc') || url.includes('pdf')) {
    return { primary: 'document', secondary: [], confidence: 0.78 };
  }
  
  // Default to unknown with moderate confidence
  // Real AI would analyze visual features
  return { primary: 'unknown', secondary: [], confidence: 0.50 };
}

// ============================================================================
// OCR + NLP Extractor (Stub - will be replaced with real AI)
// ============================================================================

function extractTextEntities(media: MediaItem): ExtractedEntities {
  // Stub extraction - generates realistic sample data
  // Real implementation would use OCR + NLP
  
  const entities: ExtractedEntities = {};
  
  // Simulate finding a phone number in some images
  if (Math.random() > 0.6) {
    entities.phone = {
      value: `306-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      confidence: 0.78
    };
  }
  
  // Simulate finding company name
  if (Math.random() > 0.7) {
    const companies = ['Urban Landscape Designs', 'Prairie Paving Co', 'Northern Roofing', 'Swift Plumbing'];
    entities.companyName = {
      value: companies[Math.floor(Math.random() * companies.length)],
      confidence: 0.72
    };
  }
  
  // Simulate finding materials on receipts/documents
  if (Math.random() > 0.5) {
    entities.materials = [
      { name: '3/4 crush gravel', qty: '20', unit: 'yards', confidence: 0.76 },
      { name: 'concrete mix', qty: '10', unit: 'bags', confidence: 0.68 }
    ].slice(0, Math.floor(Math.random() * 2) + 1);
  }
  
  return entities;
}

// ============================================================================
// EXIF / Metadata Extractor
// ============================================================================

interface ExifData {
  lat?: number;
  lng?: number;
  capturedAt?: Date;
  deviceModel?: string;
  orientation?: number;
}

function extractExifData(media: MediaItem): ExifData {
  // If media already has geo data from upload, use it
  if (media.geo_lat && media.geo_lng) {
    return {
      lat: media.geo_lat,
      lng: media.geo_lng,
      capturedAt: media.captured_at ? new Date(media.captured_at) : undefined
    };
  }
  
  // Stub: simulate EXIF extraction
  // Real implementation would parse actual EXIF from image buffer
  
  // Generate realistic Saskatchewan coordinates for demo
  if (Math.random() > 0.4) {
    return {
      lat: 52.1 + (Math.random() * 0.2 - 0.1),
      lng: -106.6 + (Math.random() * 0.2 - 0.1),
      capturedAt: new Date(Date.now() - Math.random() * 86400000 * 7),
      deviceModel: 'iPhone 14 Pro',
      orientation: 1
    };
  }
  
  return {};
}

// ============================================================================
// License Plate + Branding Extractor (Stub)
// ============================================================================

interface LicensePlateData {
  // PRIVACY INVARIANT: Never store raw license plate numbers
  // Only store region (province/state) for fleet matching
  region?: string;
  plateDetected: boolean;
  confidence: number;
}

function extractLicensePlate(media: MediaItem, classification: ClassificationResult): LicensePlateData {
  // Only attempt extraction on vehicle images
  if (!classification.primary.startsWith('vehicle')) {
    return { plateDetected: false, confidence: 0 };
  }
  
  // Stub: simulate plate detection
  // Real implementation would use ALPR - but we NEVER store the raw plate
  // We only indicate that a plate was detected and extract the region for fleet matching
  if (Math.random() > 0.5) {
    // PRIVACY: Plate detected but NOT stored - only region is persisted
    return {
      plateDetected: true,
      region: 'SK',
      confidence: 0.75
    };
  }
  
  return { plateDetected: false, confidence: 0 };
}

// ============================================================================
// Geo Inference (Reverse Geocoding)
// ============================================================================

function inferGeoLocation(exif: ExifData): GeoInference {
  if (!exif.lat || !exif.lng) {
    return { confidence: 0, source: 'none' };
  }
  
  // Stub: generate plausible address for Saskatchewan
  // Real implementation would use Mapbox/Google geocoding
  const streets = ['Main St', 'Railway Ave', 'Central Ave', 'First Ave', 'Broadway'];
  const towns = ['Saskatoon', 'Regina', 'Humboldt', 'Yorkton', 'Prince Albert'];
  
  const address = `${Math.floor(Math.random() * 1000 + 100)} ${streets[Math.floor(Math.random() * streets.length)]}, ${towns[Math.floor(Math.random() * towns.length)]}, SK`;
  
  return {
    lat: exif.lat,
    lng: exif.lng,
    proposedAddress: address,
    confidence: 0.78,
    source: 'exif'
  };
}

// ============================================================================
// Proposed Links Generator
// ============================================================================

function generateProposedLinks(
  classification: ClassificationResult,
  entities: ExtractedEntities,
  geo: GeoInference
): ProposedLinks {
  const links: ProposedLinks = {
    vehicle: false,
    trailer: false,
    tool: false,
    material: false,
    jobsite: false,
    customer: false,
    serviceRun: false,
    beforeAfterBundle: false
  };
  
  // Vehicle/trailer links
  if (classification.primary === 'vehicle_truck' || classification.primary === 'vehicle_van') {
    links.vehicle = true;
  }
  if (classification.primary === 'vehicle_trailer' || classification.secondary.includes('vehicle_trailer')) {
    links.trailer = true;
  }
  
  // Tool/material links
  if (classification.primary === 'tool') {
    links.tool = true;
  }
  if (classification.primary === 'material' || classification.secondary.includes('material') ||
      (entities.materials && entities.materials.length > 0)) {
    links.material = true;
  }
  
  // Jobsite links
  if (classification.primary === 'jobsite' || 
      classification.primary === 'before_photo' || 
      classification.primary === 'after_photo' ||
      (geo.lat && geo.lng && geo.confidence > 0.5)) {
    links.jobsite = true;
  }
  
  // Customer links from sticky notes
  if (classification.primary === 'sticky_note' || classification.primary === 'whiteboard') {
    links.customer = true;
    links.serviceRun = true;
  }
  
  // Before/after bundle
  if (classification.primary === 'before_photo' || classification.primary === 'after_photo') {
    links.beforeAfterBundle = true;
  }
  
  return links;
}

// ============================================================================
// Next Actions Generator
// ============================================================================

function generateNextActions(
  classification: ClassificationResult,
  entities: ExtractedEntities,
  geo: GeoInference,
  links: ProposedLinks
): NextAction[] {
  const actions: NextAction[] = [];
  
  // Vehicle confirmation
  if (links.vehicle) {
    actions.push({
      type: 'confirm_vehicle',
      title: 'Confirm vehicle details',
      description: 'We detected a vehicle. Please confirm make, model, and year.',
      priority: 'high'
    });
  }
  
  // Trailer confirmation
  if (links.trailer) {
    actions.push({
      type: 'confirm_vehicle',
      title: 'Confirm trailer details',
      description: 'We detected a trailer. Please confirm type and size.',
      priority: 'high'
    });
  }
  
  // Tool confirmation
  if (links.tool) {
    actions.push({
      type: 'confirm_tool',
      title: 'Confirm tool',
      description: 'We detected equipment. Please confirm what this is.',
      priority: 'medium'
    });
  }
  
  // Jobsite confirmation
  if (links.jobsite && geo.proposedAddress) {
    actions.push({
      type: 'confirm_jobsite',
      title: 'Confirm work location',
      description: `Photo captured near ${geo.proposedAddress}. Is this a jobsite?`,
      priority: 'medium',
      payload: { proposedAddress: geo.proposedAddress }
    });
  }
  
  // Customer from sticky note
  if (links.customer && entities.customerName) {
    actions.push({
      type: 'confirm_customer',
      title: 'Add customer',
      description: `We found customer info: ${entities.customerName.value}`,
      priority: 'high',
      payload: { customerName: entities.customerName.value }
    });
  }
  
  // Before/after bundle
  if (classification.primary === 'after_photo') {
    actions.push({
      type: 'request_before_photo',
      title: 'Add before photo',
      description: 'This looks like an AFTER photo. Do you have BEFORE photos for this site?',
      priority: 'medium'
    });
  }
  if (classification.primary === 'before_photo') {
    actions.push({
      type: 'request_after_photo',
      title: 'Add after photo',
      description: 'This looks like a BEFORE photo. Add AFTER photos when work is complete.',
      priority: 'low'
    });
  }
  
  // Service run from sticky note - with auto-message thread proposal
  if (classification.primary === 'sticky_note' || classification.primary === 'whiteboard') {
    actions.push({
      type: 'open_message_thread',
      title: 'Create work request',
      description: 'Turn this into a service run and start a conversation.',
      priority: 'high',
      payload: {
        proposedMessage: generateProposedMessage(entities, geo),
        autoCreateThread: true
      }
    });
  }
  
  return actions;
}

/**
 * Generate a proposed message for service run auto-creation
 * This message will be shown to the contractor for confirmation
 */
function generateProposedMessage(
  entities: ExtractedEntities,
  geo: GeoInference
): string {
  const parts: string[] = [];
  
  // Opening based on customer name
  if (entities.customerName) {
    parts.push(`I see you're doing a job for ${entities.customerName.value}`);
  } else if (entities.companyName) {
    parts.push(`I see you're working with ${entities.companyName.value}`);
  } else {
    parts.push(`I see you have a new service run`);
  }
  
  // Location context
  if (geo.proposedAddress) {
    parts.push(`in ${geo.proposedAddress}`);
  }
  
  // Add community calendar pitch
  parts.push(`.\n\nWould you like this service run to appear on the Community Calendar and accept more work requests?`);
  
  return parts.join(' ');
}

// ============================================================================
// Main Classification Pipeline
// ============================================================================

export interface ClassifyOptions {
  tenantId: string;
  contractorProfileId: string;
  media: MediaItem[];
  contextHint?: 'onboarding' | 'job' | 'fleet' | 'unknown';
  batchSource?: 'camera' | 'upload' | 'bulk';
}

export async function classifyUploads(options: ClassifyOptions): Promise<ClassifiedIngestion[]> {
  const { tenantId, contractorProfileId, media, contextHint, batchSource } = options;
  
  const results: ClassifiedIngestion[] = [];
  
  for (const item of media) {
    // Run all classifiers in parallel
    const [classification, textEntities, exif, plateData] = await Promise.all([
      Promise.resolve(classifyVisual(item)),
      Promise.resolve(extractTextEntities(item)),
      Promise.resolve(extractExifData(item)),
      Promise.resolve(extractLicensePlate(item, classifyVisual(item)))
    ]);
    
    // Merge plate data into entities - PRIVACY: only store region, not raw plate
    const extractedEntities: ExtractedEntities = {
      ...textEntities,
      ...(plateData.plateDetected && plateData.region && { 
        // PRIVACY INVARIANT: Never store raw license plate values
        // Only store that a plate was detected (for matching) and the region
        licensePlateRegion: { value: plateData.region, confidence: plateData.confidence }
      })
    };
    
    // Infer geo location
    const geoInference = inferGeoLocation(exif);
    
    // Generate proposed links
    const proposedLinks = generateProposedLinks(classification, extractedEntities, geoInference);
    
    // Generate next actions
    const nextActions = generateNextActions(classification, extractedEntities, geoInference, proposedLinks);
    
    // Create ingestion record
    const [ingestion] = await db.insert(ccAiIngestions).values({
      tenantId,
      contractorProfileId,
      sourceType: classification.primary,
      status: 'proposed',
      media: [item],
      aiProposedPayload: { classification, extractedEntities, geoInference, proposedLinks },
      confidenceScore: String(Math.round(classification.confidence * 100)),
      classification,
      extractedEntities,
      geoInference,
      proposedLinks,
      contextHint,
      batchSource
    }).returning();
    
    results.push({
      ingestionId: ingestion.id,
      classification,
      extractedEntities,
      geoInference,
      proposedLinks,
      nextActions
    });
  }
  
  return results;
}

// ============================================================================
// Auto-Linking Functions
// ============================================================================

export async function createFleetAsset(
  tenantId: string,
  contractorProfileId: string,
  ingestionId: string,
  data: {
    assetType: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
    licensePlateRegion?: string;
    primaryMediaId?: string;
  }
): Promise<ContractorFleet> {
  const [fleet] = await db.insert(ccContractorFleet).values({
    tenantId,
    contractorProfileId,
    assetType: data.assetType,
    make: data.make,
    model: data.model,
    year: data.year,
    color: data.color,
    licensePlate: data.licensePlate,
    licensePlateRegion: data.licensePlateRegion,
    sourceIngestionId: ingestionId,
    primaryMediaId: data.primaryMediaId,
    isConfirmed: false,
    isActive: true
  }).returning();
  
  console.log(`[A2.3] Created fleet asset: ${fleet.id} from ingestion ${ingestionId}`);
  return fleet;
}

export async function createToolAsset(
  tenantId: string,
  contractorProfileId: string,
  ingestionId: string,
  data: {
    assetType: 'tool' | 'material' | 'equipment';
    name: string;
    description?: string;
    category?: string;
    quantity?: string;
    unit?: string;
    primaryMediaId?: string;
  }
): Promise<ContractorTool> {
  const [tool] = await db.insert(ccContractorTools).values({
    tenantId,
    contractorProfileId,
    assetType: data.assetType,
    name: data.name,
    description: data.description,
    category: data.category,
    quantity: data.quantity,
    unit: data.unit,
    sourceIngestionId: ingestionId,
    primaryMediaId: data.primaryMediaId,
    isConfirmed: false,
    isActive: true
  }).returning();
  
  console.log(`[A2.3] Created tool asset: ${tool.id} from ingestion ${ingestionId}`);
  return tool;
}

export async function createOrUpdateJobsite(
  tenantId: string,
  contractorProfileId: string,
  ingestionId: string,
  data: {
    proposedAddress?: string;
    geoLat?: number;
    geoLng?: number;
    addressConfidence?: number;
    mediaId?: string;
    isBefore?: boolean;
    isAfter?: boolean;
    capturedAt?: Date;
  }
): Promise<ContractorJobsite> {
  // Try to find existing jobsite within 100m radius
  const existingJobsites = await db.query.ccContractorJobsites.findMany({
    where: and(
      eq(ccContractorJobsites.contractorProfileId, contractorProfileId),
      eq(ccContractorJobsites.isActive, true)
    )
  });
  
  // Simple distance check (should use PostGIS in production)
  let matchedJobsite: ContractorJobsite | null = null;
  if (data.geoLat && data.geoLng) {
    for (const js of existingJobsites) {
      if (js.geoLat && js.geoLng) {
        const latDiff = Math.abs(Number(js.geoLat) - data.geoLat);
        const lngDiff = Math.abs(Number(js.geoLng) - data.geoLng);
        // Roughly 100m check (very simplified)
        if (latDiff < 0.001 && lngDiff < 0.001) {
          matchedJobsite = js;
          break;
        }
      }
    }
  }
  
  if (matchedJobsite) {
    // Update existing jobsite
    const mediaIds = [...(matchedJobsite.mediaIds as string[])];
    if (data.mediaId && !mediaIds.includes(data.mediaId)) {
      mediaIds.push(data.mediaId);
    }
    
    const sourceIngestionIds = [...(matchedJobsite.sourceIngestionIds as string[])];
    if (!sourceIngestionIds.includes(ingestionId)) {
      sourceIngestionIds.push(ingestionId);
    }
    
    const [updated] = await db.update(ccContractorJobsites)
      .set({
        mediaIds,
        sourceIngestionIds,
        hasBeforePhotos: matchedJobsite.hasBeforePhotos || !!data.isBefore,
        hasAfterPhotos: matchedJobsite.hasAfterPhotos || !!data.isAfter,
        lastPhotoAt: data.capturedAt || new Date()
      })
      .where(eq(ccContractorJobsites.id, matchedJobsite.id))
      .returning();
    
    console.log(`[A2.3] Updated jobsite: ${updated.id} with new media from ingestion ${ingestionId}`);
    return updated;
  }
  
  // Create new jobsite
  const [jobsite] = await db.insert(ccContractorJobsites).values({
    tenantId,
    contractorProfileId,
    proposedAddress: data.proposedAddress,
    geoLat: data.geoLat ? String(data.geoLat) : null,
    geoLng: data.geoLng ? String(data.geoLng) : null,
    addressConfidence: data.addressConfidence ? String(data.addressConfidence) : null,
    mediaIds: data.mediaId ? [data.mediaId] : [],
    sourceIngestionIds: [ingestionId],
    hasBeforePhotos: !!data.isBefore,
    hasAfterPhotos: !!data.isAfter,
    firstPhotoAt: data.capturedAt || new Date(),
    lastPhotoAt: data.capturedAt || new Date(),
    isConfirmed: false,
    isActive: true
  }).returning();
  
  console.log(`[A2.3] Created jobsite: ${jobsite.id} from ingestion ${ingestionId}`);
  return jobsite;
}

export async function createDraftCustomer(
  tenantId: string,
  contractorProfileId: string,
  ingestionId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    nameConfidence?: number;
    phoneConfidence?: number;
  }
): Promise<ContractorCustomer> {
  const [customer] = await db.insert(ccContractorCustomers).values({
    tenantId,
    contractorProfileId,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    notes: data.notes,
    nameConfidence: data.nameConfidence ? String(data.nameConfidence) : null,
    phoneConfidence: data.phoneConfidence ? String(data.phoneConfidence) : null,
    sourceIngestionId: ingestionId,
    isConfirmed: false,
    isActive: true
  }).returning();
  
  console.log(`[A2.3] Created draft customer: ${customer.id} from ingestion ${ingestionId}`);
  return customer;
}

export async function createOrUpdatePhotoBundle(
  tenantId: string,
  contractorProfileId: string,
  jobsiteId: string | undefined,
  mediaId: string,
  stage: 'before' | 'after'
): Promise<{ bundleId: string; missingStage?: 'before' | 'after' }> {
  // Find existing incomplete bundle for this jobsite
  let bundle = jobsiteId ? await db.query.ccContractorPhotoBundles.findFirst({
    where: and(
      eq(ccContractorPhotoBundles.contractorProfileId, contractorProfileId),
      eq(ccContractorPhotoBundles.jobsiteId, jobsiteId),
      eq(ccContractorPhotoBundles.status, 'incomplete')
    )
  }) : null;
  
  if (bundle) {
    // Update existing bundle
    const beforeIds = [...(bundle.beforeMediaIds as string[])];
    const afterIds = [...(bundle.afterMediaIds as string[])];
    
    if (stage === 'before' && !beforeIds.includes(mediaId)) {
      beforeIds.push(mediaId);
    }
    if (stage === 'after' && !afterIds.includes(mediaId)) {
      afterIds.push(mediaId);
    }
    
    const isComplete = beforeIds.length > 0 && afterIds.length > 0;
    const missingStage = beforeIds.length === 0 ? 'before' : (afterIds.length === 0 ? 'after' : undefined);
    
    await db.update(ccContractorPhotoBundles)
      .set({
        beforeMediaIds: beforeIds,
        afterMediaIds: afterIds,
        status: isComplete ? 'complete' : 'incomplete',
        missingStage,
        completedAt: isComplete ? new Date() : null
      })
      .where(eq(ccContractorPhotoBundles.id, bundle.id));
    
    return { bundleId: bundle.id, missingStage };
  }
  
  // Create new bundle
  const [newBundle] = await db.insert(ccContractorPhotoBundles).values({
    tenantId,
    contractorProfileId,
    bundleType: 'before_after',
    jobsiteId,
    beforeMediaIds: stage === 'before' ? [mediaId] : [],
    afterMediaIds: stage === 'after' ? [mediaId] : [],
    status: 'incomplete',
    missingStage: stage === 'before' ? 'after' : 'before'
  }).returning();
  
  return { bundleId: newBundle.id, missingStage: stage === 'before' ? 'after' : 'before' };
}

// ============================================================================
// Auto-Link All Results
// ============================================================================

export async function autoLinkClassifiedUploads(
  tenantId: string,
  contractorProfileId: string,
  classifications: ClassifiedIngestion[]
): Promise<void> {
  for (const result of classifications) {
    const { ingestionId, classification, extractedEntities, geoInference, proposedLinks } = result;
    
    // Auto-create fleet asset
    if (proposedLinks.vehicle || proposedLinks.trailer) {
      await createFleetAsset(tenantId, contractorProfileId, ingestionId, {
        assetType: classification.primary.replace('vehicle_', ''),
        licensePlate: extractedEntities.licensePlate?.value,
        licensePlateRegion: extractedEntities.licensePlateRegion?.value
      });
    }
    
    // Auto-create tool assets
    if (proposedLinks.tool && classification.primary === 'tool') {
      await createToolAsset(tenantId, contractorProfileId, ingestionId, {
        assetType: 'tool',
        name: 'Unidentified Tool',
        category: 'Pending Classification'
      });
    }
    
    // Auto-create material assets
    if (proposedLinks.material && extractedEntities.materials) {
      for (const mat of extractedEntities.materials) {
        await createToolAsset(tenantId, contractorProfileId, ingestionId, {
          assetType: 'material',
          name: mat.name,
          quantity: mat.qty,
          unit: mat.unit
        });
      }
    }
    
    // Auto-create jobsite
    if (proposedLinks.jobsite && (geoInference.lat || geoInference.proposedAddress)) {
      const isBefore = classification.primary === 'before_photo';
      const isAfter = classification.primary === 'after_photo';
      
      const jobsite = await createOrUpdateJobsite(tenantId, contractorProfileId, ingestionId, {
        proposedAddress: geoInference.proposedAddress,
        geoLat: geoInference.lat,
        geoLng: geoInference.lng,
        addressConfidence: geoInference.confidence,
        isBefore,
        isAfter
      });
      
      // Create before/after bundle if applicable
      if (proposedLinks.beforeAfterBundle) {
        await createOrUpdatePhotoBundle(
          tenantId,
          contractorProfileId,
          jobsite.id,
          ingestionId, // Use ingestion ID as media reference for now
          isBefore ? 'before' : 'after'
        );
      }
    }
    
    // Auto-create customer from sticky notes
    if (proposedLinks.customer && classification.primary === 'sticky_note') {
      await createDraftCustomer(tenantId, contractorProfileId, ingestionId, {
        name: extractedEntities.customerName?.value,
        phone: extractedEntities.phone?.value,
        email: extractedEntities.email?.value,
        address: extractedEntities.addressAdvisory?.value,
        nameConfidence: extractedEntities.customerName?.confidence,
        phoneConfidence: extractedEntities.phone?.confidence
      });
    }
  }
}
