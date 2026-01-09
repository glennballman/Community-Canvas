// =====================================================================
// SERVICE RUNS - TYPE DEFINITIONS
// =====================================================================

// Enums matching database
export type NoiseLevel = 'low' | 'medium' | 'high';
export type DisruptionLevel = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PricingModelType = 'flat' | 'per_hour' | 'per_sqft' | 'per_unit' | 'hybrid';
export type JobContext = 'residential' | 'commercial' | 'community';
export type DependencyType = 'requires' | 'blocks';

export type ServiceRunStatus = 
  | 'collecting'      // Accepting signups
  | 'bidding'         // Contractors bidding
  | 'bid_review'      // Reviewing cc_bids
  | 'confirmed'       // Bid accepted
  | 'scheduled'       // Dates locked
  | 'in_progress'     // Work underway
  | 'completed'       // Done
  | 'cancelled';      // Cancelled

export type SlotStatus =
  | 'pending'         // Awaiting run confirmation
  | 'confirmed'       // Run confirmed
  | 'scheduled'       // Date assigned
  | 'in_progress'     // Work being done
  | 'completed'       // Finished
  | 'cancelled'       // Customer cancelled
  | 'opted_out';      // Customer opted out after bid

export type BidStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

// =====================================================================
// CORE ENTITIES
// =====================================================================

export interface ServiceCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  
  typicalDurationMinHours: number;
  typicalDurationMaxHours: number;
  
  crewMin: number;
  crewTypical: number;
  crewMax: number;
  
  noise: NoiseLevel;
  disruption: DisruptionLevel;
  failureRiskIfDelayed: RiskLevel;
  
  canBeEmergency: boolean;
  requiresOwnerPresent: boolean;
  canBeDoneVacant: boolean;
  weatherDependent: boolean;
  
  defaultContext: JobContext;
  revisitCycle: string;
  
  isActive: boolean;
}

export interface ServiceWithDetails extends Service {
  category: ServiceCategory;
  seasonality: ServiceSeasonality[];
  pricing: ServicePricing | null;
  certifications: Certification[];
  accessRequirements: AccessRequirement[];
  mobilizationClass: MobilizationClass | null;
}

export interface ClimateRegion {
  id: string;
  name: string;
  koppenCodes: string[];
  description: string;
  typicalFreezeWeek: number | null;
  typicalThawWeek: number | null;
}

export interface ServiceSeasonality {
  serviceId: string;
  climateRegionId: string;
  climateRegionName?: string;
  earliestWeek: number;
  latestWeek: number;
  hardStop: boolean;
  rainSensitive: boolean;
  snowSensitive: boolean;
  windSensitive: boolean;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  notes: string;
}

export interface AccessRequirement {
  id: string;
  name: string;
  description: string;
  baseCostMultiplier: number;
}

export interface MobilizationClass {
  id: string;
  name: string;
  description: string;
  baseCost: number;
}

export interface Certification {
  id: string;
  name: string;
  authority: string;
  jurisdiction: string;
  tradeCode: string;
  description: string;
  isRequired?: boolean;
}

export interface ServicePricing {
  serviceId: string;
  pricingModelId: string;
  pricingModel?: PricingModelType;
  basePrice: number;
  unitDescriptor: string;
  remoteMultiplier: number;
  accessDifficultyMultiplier: number;
  seasonalMultiplier: number;
  mobilizationSurcharge: number;
  minimumCharge: number;
  notes: string;
}

// =====================================================================
// BUNDLES
// =====================================================================

export interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  context: JobContext;
  isSubscription: boolean;
  billingPeriod: string;
  isActive: boolean;
}

export interface BundleItem {
  bundleId: string;
  serviceId: string;
  service?: Service;
  quantity: number;
  sortOrder: number;
}

export interface BundlePricing {
  bundleId: string;
  basePrice: number;
  discountFactor: number;
  mobilizationSurcharge: number;
  remoteMultiplier: number;
  notes: string;
}

export interface BundleSeasonality {
  bundleId: string;
  climateRegionId: string;
  climateRegionName?: string;
  earliestWeek: number;
  latestWeek: number;
  hardStop: boolean;
  notes: string;
}

export interface BundleWithDetails extends Bundle {
  items: BundleItem[];
  pricing: BundlePricing | null;
  seasonality: BundleSeasonality[];
}

// =====================================================================
// COMMUNITIES
// =====================================================================

export interface Community {
  id: string;
  tenantId: string | null;
  name: string;
  region: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  climateRegionId: string;
  climateRegion?: ClimateRegion;
  defaultAccessRequirementId: string | null;
  remoteMultiplier: number;
  typicalFreezeWeek: number | null;
  typicalThawWeek: number | null;
  notes: string;
}

// =====================================================================
// SERVICE RUNS
// =====================================================================

export interface ServiceRun {
  id: string;
  title: string;
  slug: string;
  description: string;
  
  serviceCategoryId: string;
  
  communityName: string;
  regionName: string;
  serviceAreaDescription: string;
  
  initiatorType: 'platform' | 'resident' | 'contractor';
  initiatorUserId: string | null;
  initiatorTenantId: string | null;
  
  targetStartDate: string | null;
  targetEndDate: string | null;
  flexibleDates: boolean;
  
  minSlots: number;
  maxSlots: number;
  currentSlots: number;
  
  status: ServiceRunStatus;
  
  biddingOpensAt: string | null;
  biddingClosesAt: string | null;
  winningBidId: string | null;
  
  tripDetails: TripDetails | null;
  
  estimatedMobilizationCost: number | null;
  mobilizationCostPerSlot: number | null;
  
  allowResidentExclusions: boolean;
  requirePhotos: boolean;
  requireDeposit: boolean;
  depositAmount: number | null;
  cancellationPolicy: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface ServiceSlot {
  id: string;
  runId: string;
  
  customerUserId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  propertyAddress: string;
  propertyLat: number | null;
  propertyLng: number | null;
  propertyAccessNotes: string;
  
  serviceDescription: string;
  specialRequirements: string;
  
  photos: SlotPhoto[];
  measurements: Record<string, any>;
  
  excludedContractors: ContractorExclusion[];
  preferredContractors: ContractorPreference[];
  
  preferredDates: PreferredDate[];
  blackoutDates: string[];
  requiresOwnerPresent: boolean;
  
  status: SlotStatus;
  optOutReason: string | null;
  optOutAt: string | null;
  
  estimatedCost: number | null;
  finalCost: number | null;
  mobilizationShare: number | null;
  depositPaid: number | null;
  depositPaidAt: string | null;
  
  scheduledDate: string | null;
  scheduledTimeStart: string | null;
  scheduledTimeEnd: string | null;
  completedAt: string | null;
  completionNotes: string;
  customerRating: number | null;
  customerReview: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface SlotPhoto {
  url: string;
  description: string;
  uploadedAt: string;
}

export interface ContractorExclusion {
  contractorId: string;
  reason: string;
}

export interface ContractorPreference {
  contractorId: string;
  reason: string;
}

export interface PreferredDate {
  date: string;
  timeOfDay: 'morning' | 'afternoon' | 'anytime';
}

// =====================================================================
// CONTRACTORS & BIDS
// =====================================================================

export interface Contractor {
  id: string;
  tenantId: string | null;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  
  baseCity: string;
  baseProvince: string;
  serviceRadiusKm: number;
  
  servicesOffered: string[];
  certifications: ContractorCertification[];
  insuranceInfo: InsuranceInfo | null;
  wcbNumber: string;
  
  crewSize: number;
  vehiclesAvailable: number;
  
  totalJobsCompleted: number;
  averageRating: number;
  totalReviews: number;
  
  status: 'active' | 'suspended' | 'pending_verification';
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface ContractorCertification {
  name: string;
  number: string;
  expiry: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  coverage: string;
  expiry: string;
}

export interface ServiceRunBid {
  id: string;
  runId: string;
  contractorId: string;
  contractor?: Contractor;
  
  bidType: 'per_slot' | 'bundle' | 'hybrid';
  
  mobilizationCost: number;
  perSlotCostLow: number;
  perSlotCostHigh: number;
  bundleTotalCost: number | null;
  
  includesMaterials: boolean;
  materialsEstimate: number | null;
  includesDisposal: boolean;
  disposalEstimate: number | null;
  
  proposedStartDate: string | null;
  proposedEndDate: string | null;
  estimatedDaysOnSite: number;
  
  crewSize: number;
  crewNeedsAccommodation: boolean;
  accommodationPreferences: string;
  
  bidNotes: string;
  termsAndConditions: string;
  
  status: BidStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  decisionNotes: string;
}

// =====================================================================
// TRIP PLANNING (Magic Button Output)
// =====================================================================

export interface TripDetails {
  ferryOutbound: FerryBooking | null;
  ferryReturn: FerryBooking | null;
  ferryTotalCost: number;
  accommodations: AccommodationReservation[];
  accommodationTotalCost: number;
  dailySchedule: DailySchedule[];
  routeOptimizationNotes: string;
}

export interface FerryBooking {
  route: string;
  date: string;
  time: string;
  confirmation: string;
  cost: number;
  vehicleType: string;
  passengerCount: number;
}

export interface AccommodationReservation {
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  cost: number;
  confirmation: string;
  beds: number;
  crewCapacity: number;
}

export interface DailySchedule {
  date: string;
  slots: ScheduledSlot[];
  notes: string;
}

export interface ScheduledSlot {
  slotId: string;
  address: string;
  scheduledTime: string;
  estimatedDuration: number;
  notes: string;
}

// =====================================================================
// BUNDLING INTELLIGENCE
// =====================================================================

export interface ServiceCompatibility {
  serviceId: string;
  compatibleServiceId: string;
  compatibilityScore: number;
  rationale: string;
}

export interface CompatibilityWeights {
  mobilization: number;    // Same mobilization class bonus
  access: number;          // Shared access requirements bonus
  certification: number;   // Shared certifications bonus
  sameVisit: number;       // Same category / practical synergy bonus
}

export interface BundleEdgeScore {
  serviceASlug: string;
  serviceBSlug: string;
  score: number;
  reasons: string[];
}

export interface SuggestedBundle {
  services: string[];      // Service slugs
  totalScore: number;
  name: string;
  rationale: string;
}

// =====================================================================
// PRICING CALCULATION
// =====================================================================

export interface PriceCalculationInput {
  service: ServiceWithDetails;
  quantity: number;
  community: Community;
  accessDifficulty?: number;    // Override multiplier
  seasonalFactor?: number;      // Override multiplier
  isEmergency?: boolean;
}

export interface PriceCalculationResult {
  basePrice: number;
  quantityTotal: number;
  remoteMultiplier: number;
  accessMultiplier: number;
  seasonalMultiplier: number;
  emergencyMultiplier: number;
  mobilizationSurcharge: number;
  subtotal: number;
  minimumApplied: boolean;
  finalPrice: number;
  breakdown: PriceBreakdownItem[];
}

export interface PriceBreakdownItem {
  label: string;
  amount: number;
  type: 'base' | 'multiplier' | 'surcharge' | 'adjustment';
}

export interface BundlePriceCalculationInput {
  bundle: BundleWithDetails;
  community: Community;
  quantities?: Record<string, number>;  // Override quantities by service slug
}

export interface BundlePriceCalculationResult {
  serviceTotals: { serviceSlug: string; price: number }[];
  sumBeforeDiscount: number;
  discountFactor: number;
  discountAmount: number;
  mobilizationSurcharge: number;
  remoteMultiplier: number;
  finalPrice: number;
  savingsVsAlaCarte: number;
  breakdown: PriceBreakdownItem[];
}
