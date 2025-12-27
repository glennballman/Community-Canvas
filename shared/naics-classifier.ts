/**
 * NAICS Classification System
 * Layered approach: base category → subcategory overrides → business name patterns
 */

export interface NAICSClassification {
  code: string;
  subsector: string;
  sector: string;
  title: string;
}

// Base category mappings (fallback)
export const baseCategoryMap: Record<string, NAICSClassification> = {
  "fishing-marine": { code: "114111", subsector: "114", sector: "11", title: "Finfish Fishing" },
  "accommodation": { code: "721110", subsector: "721", sector: "72", title: "Hotels and Motels" },
  "accounting": { code: "541211", subsector: "541", sector: "54", title: "Offices of Certified Public Accountants" },
  "it-technology": { code: "541512", subsector: "541", sector: "54", title: "Computer Systems Design Services" },
  "retail": { code: "453998", subsector: "453", sector: "44-45", title: "All Other Miscellaneous Store Retailers" },
};

// Subcategory overrides (higher priority than base category)
export const subcategoryOverrides: Record<string, NAICSClassification> = {
  "Port operations": { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  "Harbour authority": { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  "Harbor authority": { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  "Ferry service": { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
  "Marine transportation": { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
  "Marina": { code: "713930", subsector: "713", sector: "71", title: "Marinas" },
  "Boat rental": { code: "532292", subsector: "532", sector: "53", title: "Recreational Goods Rental" },
  "Marine services": { code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" },
  "Seafood processing": { code: "311710", subsector: "311", sector: "31-33", title: "Seafood Product Preparation and Packaging" },
};

// Business name patterns (highest priority)
export interface NamePattern {
  pattern: RegExp;
  classification: NAICSClassification;
  description: string;
}

export const namePatterns: NamePattern[] = [
  // Port and Harbour Authorities
  { 
    pattern: /\bPort of\b/i, 
    classification: { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
    description: "Port authorities"
  },
  { 
    pattern: /\bPort Authority\b/i, 
    classification: { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
    description: "Port authorities"
  },
  { 
    pattern: /Harbour Authority/i, 
    classification: { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
    description: "Harbour authorities"
  },
  { 
    pattern: /Harbor Authority/i, 
    classification: { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
    description: "Harbor authorities"
  },
  // Ferry and Marine Transport
  { 
    pattern: /\bFerry\b/i, 
    classification: { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
    description: "Ferry services"
  },
  { 
    pattern: /\bSeabus\b/i, 
    classification: { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
    description: "Seabus services"
  },
  { 
    pattern: /Lady Rose Marine/i, 
    classification: { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
    description: "Lady Rose Marine Services"
  },
  { 
    pattern: /Water Taxi/i, 
    classification: { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
    description: "Water taxi services"
  },
  // Marinas
  { 
    pattern: /\bMarina\b/i, 
    classification: { code: "713930", subsector: "713", sector: "71", title: "Marinas" },
    description: "Marinas"
  },
  { 
    pattern: /Yacht Club/i, 
    classification: { code: "713930", subsector: "713", sector: "71", title: "Marinas" },
    description: "Yacht clubs"
  },
  // Marine Services and Repair
  { 
    pattern: /Marine.*Service/i, 
    classification: { code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" },
    description: "Marine services"
  },
  { 
    pattern: /Shipyard/i, 
    classification: { code: "336611", subsector: "336", sector: "31-33", title: "Ship Building and Repairing" },
    description: "Shipyards"
  },
  { 
    pattern: /Boat.*Repair/i, 
    classification: { code: "811490", subsector: "811", sector: "81", title: "Other Personal and Household Goods Repair" },
    description: "Boat repair"
  },
  // Seafood
  { 
    pattern: /Seafood/i, 
    classification: { code: "311710", subsector: "311", sector: "31-33", title: "Seafood Product Preparation and Packaging" },
    description: "Seafood businesses"
  },
  { 
    pattern: /Fish.*Market/i, 
    classification: { code: "445220", subsector: "445", sector: "44-45", title: "Fish and Seafood Markets" },
    description: "Fish markets"
  },
  // Landing/Wharf operations
  { 
    pattern: /Landing.*Authority/i, 
    classification: { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
    description: "Landing authorities"
  },
];

/**
 * Classify a business using the layered approach
 * Priority: namePatterns > subcategoryOverrides > baseCategoryMap
 */
export function classifyBusiness(
  businessName: string, 
  category: string, 
  subcategory?: string
): NAICSClassification {
  // 1. Check name patterns (highest priority)
  for (const { pattern, classification } of namePatterns) {
    if (pattern.test(businessName)) {
      return classification;
    }
  }
  
  // 2. Check subcategory overrides
  if (subcategory) {
    const normalizedSub = subcategory.toLowerCase();
    for (const [key, classification] of Object.entries(subcategoryOverrides)) {
      if (normalizedSub.includes(key.toLowerCase())) {
        return classification;
      }
    }
  }
  
  // 3. Fall back to base category mapping
  if (baseCategoryMap[category]) {
    return baseCategoryMap[category];
  }
  
  // 4. Default unclassified
  return { code: "999999", subsector: "999", sector: "99", title: "Unclassified" };
}

/**
 * Get all unique NAICS classifications used
 */
export function getUsedNAICSSubsectors(members: Array<{ naicsSubsector?: string }>): string[] {
  const subsectors = new Set<string>();
  for (const m of members) {
    if (m.naicsSubsector && m.naicsSubsector !== '999') {
      subsectors.add(m.naicsSubsector);
    }
  }
  return Array.from(subsectors).sort();
}
