import { Pool } from 'pg';
import type { ApifyListing, ImportResult, AccommodationProperty } from '../../shared/types/accommodations';

interface ProcessedProperty {
  airbnbId: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  latitude?: number;
  longitude?: number;
  overallRating?: number;
  reviewCount: number;
  baseNightlyRate?: number;
  crewScore: number;
  crewIndicators: string[];
  region: string;
  city?: string;
  source: 'airbnb';
  status: 'discovered';
  isVerified: boolean;
  isCrewFriendly: boolean;
  hasParking: boolean;
  hasKitchen: boolean;
  hasWifi: boolean;
  hasWasher: boolean;
  hasDryer: boolean;
}

interface CrewScoreResult {
  score: number;
  indicators: string[];
}

const CREW_SCORE_KEYWORDS = [
  { pattern: /parking|driveway|garage/i, points: 20, label: 'Parking' },
  { pattern: /truck|trailer|rv/i, points: 15, label: 'RV/Truck Friendly' },
  { pattern: /kitchen|cook|stove/i, points: 15, label: 'Kitchen' },
  { pattern: /wifi|internet/i, points: 10, label: 'WiFi' },
  { pattern: /washer|dryer|laundry/i, points: 10, label: 'Laundry' },
  { pattern: /workspace|desk|office/i, points: 8, label: 'Workspace' },
  { pattern: /bedrooms?|sleeps [4-9]|sleeps 1[0-9]/i, points: 10, label: 'Multiple Beds' },
  { pattern: /weekly|monthly|long.?term/i, points: 7, label: 'Long-term' },
  { pattern: /self.?check|keypad|lockbox/i, points: 5, label: 'Self Check-in' },
];

const BC_CITY_PATTERNS = [
  { pattern: /\bin\s+Victoria\b/i, city: 'Victoria' },
  { pattern: /\bin\s+Vancouver\b/i, city: 'Vancouver' },
  { pattern: /\bin\s+Nanaimo\b/i, city: 'Nanaimo' },
  { pattern: /\bin\s+Tofino\b/i, city: 'Tofino' },
  { pattern: /\bin\s+Ucluelet\b/i, city: 'Ucluelet' },
  { pattern: /\bin\s+Courtenay\b/i, city: 'Courtenay' },
  { pattern: /\bin\s+Comox\b/i, city: 'Comox' },
  { pattern: /\bin\s+Campbell\s+River\b/i, city: 'Campbell River' },
  { pattern: /\bin\s+Parksville\b/i, city: 'Parksville' },
  { pattern: /\bin\s+Qualicum\b/i, city: 'Qualicum Beach' },
  { pattern: /\bin\s+Port\s+Alberni\b/i, city: 'Port Alberni' },
  { pattern: /\bin\s+Duncan\b/i, city: 'Duncan' },
  { pattern: /\bin\s+Sooke\b/i, city: 'Sooke' },
  { pattern: /\bin\s+Whistler\b/i, city: 'Whistler' },
  { pattern: /\bin\s+Squamish\b/i, city: 'Squamish' },
  { pattern: /\bin\s+Kelowna\b/i, city: 'Kelowna' },
  { pattern: /\bin\s+Penticton\b/i, city: 'Penticton' },
  { pattern: /\bin\s+Vernon\b/i, city: 'Vernon' },
  { pattern: /\bin\s+Nelson\b/i, city: 'Nelson' },
  { pattern: /\bin\s+Gibsons\b/i, city: 'Gibsons' },
  { pattern: /\bin\s+Sechelt\b/i, city: 'Sechelt' },
  { pattern: /\bin\s+Powell\s+River\b/i, city: 'Powell River' },
  { pattern: /\bin\s+Sidney\b/i, city: 'Sidney' },
  { pattern: /\bin\s+Langford\b/i, city: 'Langford' },
  { pattern: /\bin\s+Bamfield\b/i, city: 'Bamfield' },
  { pattern: /downtown\s+(\w+(?:\s+\w+)?)/i, city: null },
  { pattern: /located\s+in\s+(\w+(?:\s+\w+)?)/i, city: null },
  { pattern: /minutes?\s+from\s+(\w+(?:\s+\w+)?)/i, city: null },
];

export class AccommodationImportService {
  constructor(private db: Pool) {}

  calculateCrewScore(description: string, title: string = ''): CrewScoreResult {
    const text = `${title} ${description}`.toLowerCase();
    let score = 0;
    const indicators: string[] = [];

    for (const keyword of CREW_SCORE_KEYWORDS) {
      if (keyword.pattern.test(text)) {
        score += keyword.points;
        indicators.push(keyword.label);
      }
    }

    return {
      score: Math.min(score, 100),
      indicators
    };
  }

  async detectRegion(lat: number, lng: number): Promise<string> {
    try {
      const result = await this.db.query(
        'SELECT get_region_from_coords($1, $2) as region',
        [lat, lng]
      );
      return result.rows[0]?.region || 'Other BC';
    } catch (error) {
      console.error('Error detecting region:', error);
      return 'Other BC';
    }
  }

  detectCity(lat: number, lng: number, description: string, title: string = ''): string | undefined {
    const text = `${title} ${description}`;

    for (const cityPattern of BC_CITY_PATTERNS) {
      if (cityPattern.city) {
        if (cityPattern.pattern.test(text)) {
          return cityPattern.city;
        }
      } else {
        const match = text.match(cityPattern.pattern);
        if (match && match[1]) {
          const potentialCity = match[1].trim();
          if (potentialCity.length >= 3 && potentialCity.length <= 30) {
            return potentialCity;
          }
        }
      }
    }

    return undefined;
  }

  parseNightlyRate(priceData: ApifyListing['price']): number | undefined {
    try {
      if (priceData?.breakDown?.basePrice?.description) {
        const desc = priceData.breakDown.basePrice.description;
        const match = desc.match(/\$[\d,]+(?:\.\d{2})?/);
        if (match) {
          return parseFloat(match[0].replace(/[$,]/g, ''));
        }
      }

      if (priceData?.price) {
        const match = priceData.price.match(/[\d,]+/);
        if (match) {
          return parseFloat(match[0].replace(',', ''));
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  cleanSourceUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.search = '';
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  async processApifyListings(listings: ApifyListing[]): Promise<ProcessedProperty[]> {
    const processed: ProcessedProperty[] = [];

    for (const listing of listings) {
      try {
        const { score, indicators } = this.calculateCrewScore(
          listing.description || '',
          listing.title || ''
        );

        const lat = listing.coordinates?.latitude;
        const lng = listing.coordinates?.longitude;

        const region = (lat && lng) 
          ? await this.detectRegion(lat, lng)
          : 'Other BC';

        const city = this.detectCity(
          lat || 0,
          lng || 0,
          listing.description || '',
          listing.title || ''
        );

        const property: ProcessedProperty = {
          airbnbId: listing.id,
          name: listing.title || 'Untitled Listing',
          description: listing.description,
          thumbnailUrl: listing.thumbnail,
          sourceUrl: listing.url ? this.cleanSourceUrl(listing.url) : undefined,
          latitude: lat,
          longitude: lng,
          overallRating: listing.rating?.guestSatisfaction,
          reviewCount: listing.rating?.reviewsCount || 0,
          baseNightlyRate: this.parseNightlyRate(listing.price),
          crewScore: score,
          crewIndicators: indicators,
          region,
          city,
          source: 'airbnb',
          status: 'discovered',
          isVerified: false,
          isCrewFriendly: score >= 50,
          hasParking: /parking|driveway|garage/i.test(listing.description || ''),
          hasKitchen: /kitchen|cook|stove/i.test(listing.description || ''),
          hasWifi: /wifi|internet/i.test(listing.description || ''),
          hasWasher: /washer|laundry/i.test(listing.description || ''),
          hasDryer: /dryer/i.test(listing.description || ''),
        };

        processed.push(property);
      } catch (error) {
        console.error(`Error processing listing ${listing.id}:`, error);
      }
    }

    return processed;
  }

  async importListings(listings: ApifyListing[]): Promise<ImportResult> {
    const result: ImportResult = {
      total: listings.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    if (listings.length === 0) {
      return result;
    }

    console.log(`Starting import of ${listings.length} listings...`);
    const startTime = Date.now();

    const processed = await this.processApifyListings(listings);

    for (let i = 0; i < processed.length; i++) {
      const property = processed[i];

      if ((i + 1) % 50 === 0) {
        console.log(`Processed ${i + 1}/${processed.length} listings...`);
      }

      try {
        const existing = await this.db.query(
          'SELECT id FROM cc_accommodation_properties WHERE airbnb_id = $1',
          [property.airbnbId]
        );

        if (existing.rows.length > 0) {
          await this.db.query(`
            UPDATE cc_accommodation_properties SET
              name = $1,
              description = $2,
              thumbnail_url = $3,
              source_url = $4,
              latitude = $5,
              longitude = $6,
              overall_rating = $7,
              review_count = $8,
              base_nightly_rate = $9,
              crew_score = $10,
              region = $11,
              city = $12,
              is_crew_friendly = $13,
              has_parking = $14,
              has_kitchen = $15,
              has_wifi = $16,
              has_washer = $17,
              has_dryer = $18,
              last_scraped_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE airbnb_id = $19
          `, [
            property.name,
            property.description,
            property.thumbnailUrl,
            property.sourceUrl,
            property.latitude,
            property.longitude,
            property.overallRating,
            property.reviewCount,
            property.baseNightlyRate,
            property.crewScore,
            property.region,
            property.city,
            property.isCrewFriendly,
            property.hasParking,
            property.hasKitchen,
            property.hasWifi,
            property.hasWasher,
            property.hasDryer,
            property.airbnbId
          ]);
          result.updated++;
        } else {
          await this.db.query(`
            INSERT INTO cc_accommodation_properties (
              airbnb_id, name, description, thumbnail_url, source_url,
              latitude, longitude, overall_rating, review_count, base_nightly_rate,
              crew_score, region, city, source, status, is_verified, is_crew_friendly,
              has_parking, has_kitchen, has_wifi, has_washer, has_dryer,
              last_scraped_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
            )
          `, [
            property.airbnbId,
            property.name,
            property.description,
            property.thumbnailUrl,
            property.sourceUrl,
            property.latitude,
            property.longitude,
            property.overallRating,
            property.reviewCount,
            property.baseNightlyRate,
            property.crewScore,
            property.region,
            property.city,
            property.source,
            property.status,
            property.isVerified,
            property.isCrewFriendly,
            property.hasParking,
            property.hasKitchen,
            property.hasWifi,
            property.hasWasher,
            property.hasDryer
          ]);
          result.imported++;
        }
      } catch (error) {
        result.skipped++;
        const errorMsg = `Failed to import ${property.airbnbId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Import complete in ${elapsed}s: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`);

    return result;
  }
}
