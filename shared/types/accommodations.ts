// Accommodation Property Types
export type PropertySource = 'airbnb' | 'reservation' | 'vrbo' | 'direct' | 'manual';
export type PropertyStatus = 'discovered' | 'contacted' | 'onboarded' | 'active' | 'inactive';
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type ContactStatus = 'not_contacted' | 'contacted' | 'responded' | 'interested' | 'onboarded' | 'declined' | 'no_response';
export type OutreachChannel = 'email' | 'airbnb_message' | 'phone' | 'sms';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'responded' | 'bounced' | 'failed';

export interface AccommodationProperty {
  id: number;
  airbnbId?: string;
  reservationId?: string;
  canvasId?: string;
  
  name: string;
  description?: string;
  propertyType?: string;
  
  municipalityId?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  
  maxGuests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  
  hasParking: boolean;
  hasKitchen: boolean;
  hasWifi: boolean;
  hasWasher: boolean;
  hasDryer: boolean;
  
  amenities?: string[];
  thumbnailUrl?: string;
  images?: string[];
  sourceUrl?: string;
  
  baseNightlyRate?: number;
  cleaningFee?: number;
  minNights?: number;
  
  overallRating?: number;
  reviewCount: number;
  crewScore: number;
  
  source: PropertySource;
  status: PropertyStatus;
  isVerified: boolean;
  isCrewFriendly: boolean;
  
  lastScrapedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccommodationHost {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  airbnbHostId?: string;
  airbnbHostUrl?: string;
  isSuperhost: boolean;
  contactStatus: ContactStatus;
  isInNetwork: boolean;
  offersDirectReservation: boolean;
  firstContactedAt?: string;
  lastContactedAt?: string;
  contactAttempts: number;
  lastResponseAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICalFeed {
  id: number;
  propertyId: number;
  hostId?: number;
  icalUrl: string;
  feedName?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  lastSyncStatus?: 'success' | 'failed' | 'timeout';
  lastSyncError?: string;
  syncFrequencyMinutes: number;
  totalSyncs: number;
  failedSyncs: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityBlock {
  id: number;
  propertyId: number;
  feedId?: number;
  startDate: string;
  endDate: string;
  blockType: 'reserved' | 'blocked' | 'maintenance';
  summary?: string;
  uid?: string;
  createdAt: string;
}

export interface OutreachCampaign {
  id: number;
  name: string;
  description?: string;
  targetRegion?: string;
  targetCities?: string[];
  targetMinCrewScore: number;
  templateId?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startedAt?: string;
  completedAt?: string;
  totalTargets: number;
  contacted: number;
  responded: number;
  converted: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: number;
  campaignId?: number;
  hostId?: number;
  propertyId?: number;
  channel: OutreachChannel;
  subject?: string;
  messageBody?: string;
  status: MessageStatus;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  respondedAt?: string;
  responseText?: string;
  responseSentiment?: 'positive' | 'neutral' | 'negative';
  createdAt: string;
  updatedAt: string;
}

export interface AccommodationReservation {
  id: number;
  reservationRef: string;
  propertyId?: number;
  hostId?: number;
  tripId?: number;
  tripName?: string;
  externalPlatform?: string;
  externalConfirmation?: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  numGuests: number;
  guestNames?: string;
  primaryGuestName?: string;
  primaryGuestPhone?: string;
  nightlyRate?: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  totalCost?: number;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  guestRating?: number;
  guestReview?: string;
  wouldBookAgain?: boolean;
  specialRequests?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  
  // Computed
  nights?: number;
  property?: AccommodationProperty;
}

// Apify Import Types
export interface ApifyListing {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  rating: {
    accuracy?: number;
    checking?: number;
    cleanliness?: number;
    communication?: number;
    location?: number;
    value?: number;
    guestSatisfaction?: number;
    reviewsCount?: number;
  };
  price: {
    label: string;
    price: string;
    breakDown?: {
      basePrice?: {
        price: string;
        description: string;
      };
    };
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Stats and Reports
export interface AccommodationStats {
  totalProperties: number;
  crewFriendly: number;
  inNetwork: number;
  withIcal: number;
  byRegion: Record<string, number>;
  byStatus: Record<string, number>;
  avgCrewScore: number;
  avgRating: number;
  avgNightlyRate: number;
}

export interface OutreachStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalContacted: number;
  totalResponded: number;
  totalConverted: number;
  responseRate: number;
  conversionRate: number;
}
