export type BusinessCategory = 
  | 'accommodation'           // Hotels, motels, B&Bs, resorts, vacation rentals
  | 'accounting'              // CPAs, bookkeeping, tax services
  | 'agriculture'             // Farms, nurseries, agricultural suppliers
  | 'arts-culture'            // Galleries, museums, theatres, artists
  | 'automotive'              // Dealerships, repair shops, parts, detailing
  | 'aviation'                // Airlines, charter services, flight schools (cross-ref: aviation.ts)
  | 'banking-finance'         // Banks, credit unions, investment advisors, insurance
  | 'cannabis'                // Licensed cannabis retailers, producers
  | 'charity-nonprofit'       // Nonprofits, foundations, social services
  | 'childcare'               // Daycares, preschools, childcare services
  | 'cleaning-janitorial'     // Commercial cleaning, residential cleaning
  | 'construction'            // General contractors, trades, builders
  | 'consulting'              // Business consulting, management consulting
  | 'courier-delivery'        // Courier services, delivery (cross-ref: ground-transport.ts)
  | 'dental'                  // Dentists, orthodontists, dental clinics
  | 'education'               // Schools, tutoring, training (cross-ref: schools.ts)
  | 'electrical'              // Electricians, electrical contractors
  | 'engineering'             // Engineering firms, surveyors
  | 'entertainment'           // Event venues, entertainment companies
  | 'environmental'           // Environmental consulting, waste management
  | 'first-nations'           // First Nations businesses, Indigenous enterprises
  | 'fishing-marine'          // Commercial fishing, marine services (cross-ref: marine.ts)
  | 'fitness-wellness'        // Gyms, yoga studios, wellness centers
  | 'food-beverage'           // Restaurants, cafes, bakeries, catering
  | 'forestry-logging'        // Logging, sawmills, forestry services (cross-ref: ground-transport.ts)
  | 'funeral'                 // Funeral homes, memorial services
  | 'government'              // Government offices, agencies (cross-ref: municipal-offices.ts)
  | 'grocery'                 // Grocery stores, supermarkets, food distribution
  | 'hardware-supplies'       // Hardware stores, building supplies
  | 'healthcare'              // Clinics, health services (cross-ref: emergency-services.ts)
  | 'heating-cooling'         // HVAC contractors
  | 'home-services'           // Home improvement, renovations, handyman
  | 'hospitality'             // Tourism operators, tour guides
  | 'insurance'               // Insurance brokers, agencies
  | 'it-technology'           // IT services, software, web development
  | 'landscaping'             // Landscaping, lawn care, tree services
  | 'legal'                   // Law firms, notaries, legal services
  | 'manufacturing'           // Manufacturing, fabrication
  | 'marketing-advertising'   // Marketing agencies, advertising, PR
  | 'media'                   // Newspapers, radio, TV, online media
  | 'medical'                 // Physicians, specialists, medical clinics
  | 'mining'                  // Mining operations, mineral exploration
  | 'optometry'               // Optometrists, eyewear
  | 'pets'                    // Veterinarians, pet stores, grooming
  | 'pharmacy'                // Pharmacies (cross-ref: pharmacies.ts)
  | 'photography'             // Photographers, videographers
  | 'plumbing'                // Plumbers, plumbing contractors
  | 'printing'                // Print shops, signage
  | 'property-management'     // Property managers, strata management
  | 'real-estate'             // Realtors, property developers
  | 'recreation'              // Recreation facilities, sports (cross-ref: community-facilities.ts)
  | 'religious'               // Churches, religious organizations
  | 'restaurant'              // Restaurants, dining establishments
  | 'retail'                  // Retail stores, shops
  | 'roofing'                 // Roofing contractors
  | 'security'                // Security services, alarm companies
  | 'seniors'                 // Senior care, retirement homes
  | 'spa-beauty'              // Spas, salons, beauty services
  | 'storage'                 // Self-storage, warehousing
  | 'taxi-rideshare'          // Taxi companies, rideshare (cross-ref: taxi-services.ts)
  | 'telecommunications'      // Phone, internet, cable providers
  | 'towing'                  // Towing services
  | 'transit'                 // Transit services (cross-ref: ground-transport.ts)
  | 'trucking-freight'        // Trucking, freight (cross-ref: ground-transport.ts)
  | 'utilities'               // Utilities, energy providers
  | 'veterinary'              // Veterinary clinics
  | 'winery-brewery'          // Wineries, breweries, distilleries
  | 'other';

export interface ChamberMember {
  id: string;
  chamberId: string;                    // References ChamberOfCommerce.id
  businessName: string;
  website?: string;                     // URL if available, undefined if needs collection
  websiteNeedsCollection?: boolean;     // Flag for later website gathering
  phone?: string;
  email?: string;
  address?: string;
  category: BusinessCategory;
  subcategory?: string;                 // More specific classification
  description?: string;                 // Brief business description
  crossReference?: {                    // Links to existing infrastructure datasets
    dataset: 'aviation' | 'marine' | 'emergency-services' | 'ground-transport' | 'taxi-services' | 'pharmacies' | 'community-facilities' | 'schools' | 'municipal-offices' | 'search-rescue' | 'weather-stations';
    id: string;                         // ID in the referenced dataset
  };
  municipality: string;
  region: string;
  memberSince?: number;                 // Year joined chamber
  featured?: boolean;                   // Premium/featured member
}

// Chamber member directory - organized by chamber
export const chamberMembers: ChamberMember[] = [
  // ============================================================================
  // METRO VANCOUVER
  // ============================================================================

  // Greater Vancouver Board of Trade - Major businesses
  // Note: GVBOT has 5,000+ members - listing key/notable members
  {
    id: "gvbot-member-001",
    chamberId: "gvbot",
    businessName: "TELUS Corporation",
    website: "https://www.telus.com",
    category: "telecommunications",
    description: "National telecommunications company headquartered in Vancouver",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-002",
    chamberId: "gvbot",
    businessName: "Lululemon Athletica",
    website: "https://www.lululemon.com",
    category: "retail",
    subcategory: "Athletic apparel",
    description: "Athletic apparel retailer headquartered in Vancouver",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-003",
    chamberId: "gvbot",
    businessName: "Hootsuite Inc.",
    website: "https://www.hootsuite.com",
    category: "it-technology",
    subcategory: "Social media management",
    description: "Social media management platform",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-004",
    chamberId: "gvbot",
    businessName: "BC Hydro",
    website: "https://www.bchydro.com",
    category: "utilities",
    description: "Provincial electric utility",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-005",
    chamberId: "gvbot",
    businessName: "Port of Vancouver",
    website: "https://www.portvancouver.com",
    category: "fishing-marine",
    subcategory: "Port authority",
    description: "Canada's largest port",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-006",
    chamberId: "gvbot",
    businessName: "Vancouver International Airport",
    website: "https://www.yvr.ca",
    category: "aviation",
    description: "Canada's second busiest airport",
    municipality: "Richmond",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "aviation",
      id: "cyvr",
    },
  },
  {
    id: "gvbot-member-007",
    chamberId: "gvbot",
    businessName: "HSBC Bank Canada",
    website: "https://www.hsbc.ca",
    category: "banking-finance",
    description: "International bank with Canadian headquarters in Vancouver",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-008",
    chamberId: "gvbot",
    businessName: "Deloitte LLP",
    website: "https://www.deloitte.ca",
    category: "accounting",
    subcategory: "Professional services",
    description: "Global professional services firm",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-009",
    chamberId: "gvbot",
    businessName: "Fasken Martineau DuMoulin LLP",
    website: "https://www.fasken.com",
    category: "legal",
    description: "Major Canadian law firm",
    municipality: "Vancouver",
    region: "Metro Vancouver",
  },
  {
    id: "gvbot-member-010",
    chamberId: "gvbot",
    businessName: "Electronic Arts Canada",
    website: "https://www.ea.com",
    category: "it-technology",
    subcategory: "Video games",
    description: "Major video game developer and publisher",
    municipality: "Burnaby",
    region: "Metro Vancouver",
  },

  // Burnaby Board of Trade
  {
    id: "burnaby-bot-member-001",
    chamberId: "burnaby-bot",
    businessName: "Electronic Arts Canada",
    website: "https://www.ea.com",
    category: "it-technology",
    subcategory: "Video games",
    description: "Major video game studio at Burnaby campus",
    municipality: "Burnaby",
    region: "Metro Vancouver",
  },
  {
    id: "burnaby-bot-member-002",
    chamberId: "burnaby-bot",
    businessName: "Metropolis at Metrotown",
    website: "https://metropolisatmetrotown.com",
    category: "retail",
    subcategory: "Shopping centre",
    description: "BC's largest shopping centre",
    municipality: "Burnaby",
    region: "Metro Vancouver",
  },
  {
    id: "burnaby-bot-member-003",
    chamberId: "burnaby-bot",
    businessName: "BCIT - British Columbia Institute of Technology",
    website: "https://www.bcit.ca",
    category: "education",
    description: "Polytechnic institute",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "schools",
      id: "bcit-burnaby",
    },
  },
  {
    id: "burnaby-bot-member-004",
    chamberId: "burnaby-bot",
    businessName: "Simon Fraser University",
    website: "https://www.sfu.ca",
    category: "education",
    description: "Research university on Burnaby Mountain",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "schools",
      id: "sfu",
    },
  },
  {
    id: "burnaby-bot-member-005",
    chamberId: "burnaby-bot",
    businessName: "Burnaby Hospital",
    website: "https://www.fraserhealth.ca",
    category: "healthcare",
    description: "Major hospital serving Burnaby and area",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "emergency-services",
      id: "burnaby-hospital",
    },
  },

  // Surrey Board of Trade
  {
    id: "surrey-bot-member-001",
    chamberId: "surrey-bot",
    businessName: "Coast Capital Savings",
    website: "https://www.coastcapitalsavings.com",
    category: "banking-finance",
    subcategory: "Credit union",
    description: "Canada's largest credit union by membership",
    municipality: "Surrey",
    region: "Metro Vancouver",
  },
  {
    id: "surrey-bot-member-002",
    chamberId: "surrey-bot",
    businessName: "Simon Fraser University - Surrey Campus",
    website: "https://www.sfu.ca/surrey",
    category: "education",
    description: "SFU's Surrey campus in City Centre",
    municipality: "Surrey",
    region: "Metro Vancouver",
  },
  {
    id: "surrey-bot-member-003",
    chamberId: "surrey-bot",
    businessName: "Kwantlen Polytechnic University",
    website: "https://www.kpu.ca",
    category: "education",
    description: "Polytechnic university with Surrey campus",
    municipality: "Surrey",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "schools",
      id: "kpu-surrey",
    },
  },
  {
    id: "surrey-bot-member-004",
    chamberId: "surrey-bot",
    businessName: "Surrey Memorial Hospital",
    website: "https://www.fraserhealth.ca",
    category: "healthcare",
    description: "Major regional hospital",
    municipality: "Surrey",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "emergency-services",
      id: "surrey-memorial",
    },
  },
  {
    id: "surrey-bot-member-005",
    chamberId: "surrey-bot",
    businessName: "Nordel Crossing Shopping Centre",
    website: "https://www.nordelcrossing.com",
    category: "retail",
    subcategory: "Shopping centre",
    municipality: "Surrey",
    region: "Metro Vancouver",
  },

  // Richmond Chamber of Commerce
  {
    id: "richmond-coc-member-001",
    chamberId: "richmond-coc",
    businessName: "Vancouver International Airport (YVR)",
    website: "https://www.yvr.ca",
    category: "aviation",
    description: "Major international airport",
    municipality: "Richmond",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "aviation",
      id: "cyvr",
    },
  },
  {
    id: "richmond-coc-member-002",
    chamberId: "richmond-coc",
    businessName: "Aberdeen Centre",
    website: "https://www.aberdeencentre.com",
    category: "retail",
    subcategory: "Shopping centre",
    description: "Asian-themed shopping mall",
    municipality: "Richmond",
    region: "Metro Vancouver",
  },
  {
    id: "richmond-coc-member-003",
    chamberId: "richmond-coc",
    businessName: "Richmond Hospital",
    website: "https://www.vch.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Richmond",
    region: "Metro Vancouver",
    crossReference: {
      dataset: "emergency-services",
      id: "richmond-hospital",
    },
  },
  {
    id: "richmond-coc-member-004",
    chamberId: "richmond-coc",
    businessName: "London Drugs",
    website: "https://www.londondrugs.com",
    category: "pharmacy",
    subcategory: "Retail pharmacy chain",
    description: "Western Canadian retail chain headquartered in Richmond",
    municipality: "Richmond",
    region: "Metro Vancouver",
  },
  {
    id: "richmond-coc-member-005",
    chamberId: "richmond-coc",
    businessName: "Steveston Harbour Authority",
    website: "https://www.stevestonharbour.com",
    category: "fishing-marine",
    subcategory: "Harbour authority",
    description: "Historic fishing harbour",
    municipality: "Richmond",
    region: "Metro Vancouver",
  },

  // ============================================================================
  // FRASER VALLEY
  // ============================================================================

  // Abbotsford Chamber of Commerce
  {
    id: "abbotsford-coc-member-001",
    chamberId: "abbotsford-coc",
    businessName: "Abbotsford International Airport",
    website: "https://www.abbotsfordairport.ca",
    category: "aviation",
    description: "Regional airport serving Fraser Valley",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    crossReference: {
      dataset: "aviation",
      id: "cyxx",
    },
  },
  {
    id: "abbotsford-coc-member-002",
    chamberId: "abbotsford-coc",
    businessName: "University of the Fraser Valley",
    website: "https://www.ufv.ca",
    category: "education",
    description: "Regional university",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    crossReference: {
      dataset: "schools",
      id: "ufv-abbotsford",
    },
  },
  {
    id: "abbotsford-coc-member-003",
    chamberId: "abbotsford-coc",
    businessName: "Abbotsford Regional Hospital",
    website: "https://www.fraserhealth.ca",
    category: "healthcare",
    description: "Major regional hospital",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    crossReference: {
      dataset: "emergency-services",
      id: "abbotsford-regional",
    },
  },
  {
    id: "abbotsford-coc-member-004",
    chamberId: "abbotsford-coc",
    businessName: "Save-On-Foods",
    website: "https://www.saveonfoods.com",
    category: "grocery",
    description: "Western Canadian grocery chain - multiple locations",
    municipality: "Abbotsford",
    region: "Fraser Valley",
  },
  {
    id: "abbotsford-coc-member-005",
    chamberId: "abbotsford-coc",
    businessName: "Vedder Transport Ltd.",
    website: "https://www.vedder.ca",
    category: "trucking-freight",
    subcategory: "Refrigerated transport",
    description: "Temperature-controlled trucking",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    crossReference: {
      dataset: "ground-transport",
      id: "vedder-transport",
    },
  },

  // Chilliwack Chamber of Commerce
  {
    id: "chilliwack-coc-member-001",
    chamberId: "chilliwack-coc",
    businessName: "Chilliwack General Hospital",
    website: "https://www.fraserhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    crossReference: {
      dataset: "emergency-services",
      id: "chilliwack-general",
    },
  },
  {
    id: "chilliwack-coc-member-002",
    chamberId: "chilliwack-coc",
    businessName: "University of the Fraser Valley - Chilliwack",
    website: "https://www.ufv.ca",
    category: "education",
    description: "UFV Chilliwack campus",
    municipality: "Chilliwack",
    region: "Fraser Valley",
  },
  {
    id: "chilliwack-coc-member-003",
    chamberId: "chilliwack-coc",
    businessName: "Chilliwack Airport",
    website: "https://www.chilliwackairport.com",
    category: "aviation",
    description: "Regional airport",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    crossReference: {
      dataset: "aviation",
      id: "cycw",
    },
  },
  {
    id: "chilliwack-coc-member-004",
    chamberId: "chilliwack-coc",
    businessName: "Cottonwood Mall",
    website: "https://cottonwoodmall.ca",
    category: "retail",
    subcategory: "Shopping centre",
    municipality: "Chilliwack",
    region: "Fraser Valley",
  },

  // Hope & District Chamber of Commerce
  {
    id: "hope-coc-member-001",
    chamberId: "hope-coc",
    businessName: "Hope Airport",
    website: "https://www.hopebc.ca",
    category: "aviation",
    description: "Municipal airport",
    municipality: "Hope",
    region: "Fraser Valley",
    crossReference: {
      dataset: "aviation",
      id: "cyhe",
    },
  },
  {
    id: "hope-coc-member-002",
    chamberId: "hope-coc",
    businessName: "Kawkawa Lake Resort",
    category: "accommodation",
    subcategory: "Resort",
    municipality: "Hope",
    region: "Fraser Valley",
    websiteNeedsCollection: true,
  },
  {
    id: "hope-coc-member-003",
    chamberId: "hope-coc",
    businessName: "Othello Tunnels Adventure",
    website: "https://www.hopebc.ca",
    category: "hospitality",
    subcategory: "Tourism",
    description: "Historic railway tunnels tourism attraction",
    municipality: "Hope",
    region: "Fraser Valley",
  },

  // ============================================================================
  // CAPITAL REGION (VICTORIA)
  // ============================================================================

  // Greater Victoria Chamber of Commerce
  {
    id: "victoria-coc-member-001",
    chamberId: "victoria-coc",
    businessName: "Royal BC Museum",
    website: "https://www.royalbcmuseum.bc.ca",
    category: "arts-culture",
    subcategory: "Museum",
    description: "Provincial museum",
    municipality: "Victoria",
    region: "Capital",
  },
  {
    id: "victoria-coc-member-002",
    chamberId: "victoria-coc",
    businessName: "The Fairmont Empress",
    website: "https://www.fairmont.com/empress-victoria",
    category: "accommodation",
    subcategory: "Luxury hotel",
    description: "Historic landmark hotel",
    municipality: "Victoria",
    region: "Capital",
  },
  {
    id: "victoria-coc-member-003",
    chamberId: "victoria-coc",
    businessName: "BC Ferries",
    website: "https://www.bcferries.com",
    category: "transit",
    subcategory: "Ferry service",
    description: "Provincial ferry corporation",
    municipality: "Victoria",
    region: "Capital",
    crossReference: {
      dataset: "marine",
      id: "bc-ferries",
    },
  },
  {
    id: "victoria-coc-member-004",
    chamberId: "victoria-coc",
    businessName: "University of Victoria",
    website: "https://www.uvic.ca",
    category: "education",
    description: "Research university",
    municipality: "Victoria",
    region: "Capital",
    crossReference: {
      dataset: "schools",
      id: "uvic",
    },
  },
  {
    id: "victoria-coc-member-005",
    chamberId: "victoria-coc",
    businessName: "Victoria General Hospital",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "Major hospital",
    municipality: "Victoria",
    region: "Capital",
    crossReference: {
      dataset: "emergency-services",
      id: "victoria-general",
    },
  },
  {
    id: "victoria-coc-member-006",
    chamberId: "victoria-coc",
    businessName: "Bluebird Cabs",
    website: "https://www.bluebirdcabs.ca",
    category: "taxi-rideshare",
    description: "Victoria's largest taxi company",
    municipality: "Victoria",
    region: "Capital",
    crossReference: {
      dataset: "taxi-services",
      id: "bluebird-victoria",
    },
  },

  // WestShore Chamber of Commerce
  {
    id: "westshore-coc-member-001",
    chamberId: "westshore-coc",
    businessName: "Westshore Town Centre",
    website: "https://www.westshoretowncentre.com",
    category: "retail",
    subcategory: "Shopping centre",
    municipality: "Langford",
    region: "Capital",
  },
  {
    id: "westshore-coc-member-002",
    chamberId: "westshore-coc",
    businessName: "Royal Roads University",
    website: "https://www.royalroads.ca",
    category: "education",
    description: "University specializing in professional programs",
    municipality: "Colwood",
    region: "Capital",
    crossReference: {
      dataset: "schools",
      id: "royal-roads",
    },
  },

  // Sooke Region Chamber of Commerce
  {
    id: "sooke-coc-member-001",
    chamberId: "sooke-coc",
    businessName: "Sooke Harbour House",
    category: "accommodation",
    subcategory: "Boutique hotel",
    description: "Historic boutique hotel",
    municipality: "Sooke",
    region: "Capital",
    websiteNeedsCollection: true,
  },
  {
    id: "sooke-coc-member-002",
    chamberId: "sooke-coc",
    businessName: "Wild Coast Tofino",
    category: "hospitality",
    subcategory: "Adventure tourism",
    municipality: "Sooke",
    region: "Capital",
    websiteNeedsCollection: true,
  },

  // Salt Spring Island Chamber of Commerce
  {
    id: "saltspring-coc-member-001",
    chamberId: "saltspring-coc",
    businessName: "Salt Spring Island Cheese",
    website: "https://www.saltspringcheese.com",
    category: "agriculture",
    subcategory: "Artisan food producer",
    description: "Award-winning artisan cheese maker",
    municipality: "Salt Spring Island",
    region: "Capital",
  },
  {
    id: "saltspring-coc-member-002",
    chamberId: "saltspring-coc",
    businessName: "Harbour House Hotel",
    website: "https://www.saltspringharbourhouse.com",
    category: "accommodation",
    subcategory: "Hotel",
    municipality: "Salt Spring Island",
    region: "Capital",
  },
  {
    id: "saltspring-coc-member-003",
    chamberId: "saltspring-coc",
    businessName: "Salt Spring Taxi",
    category: "taxi-rideshare",
    municipality: "Salt Spring Island",
    region: "Capital",
    crossReference: {
      dataset: "taxi-services",
      id: "saltspring-taxi",
    },
    websiteNeedsCollection: true,
  },

  // Pender Island Chamber of Commerce  
  {
    id: "pender-coc-member-001",
    chamberId: "pender-coc",
    businessName: "Poets Cove Resort & Spa",
    website: "https://www.poetscove.com",
    category: "accommodation",
    subcategory: "Resort",
    description: "Luxury waterfront resort",
    municipality: "Pender Island",
    region: "Capital",
  },
  {
    id: "pender-coc-member-002",
    chamberId: "pender-coc",
    businessName: "Pender Island Kayak Adventures",
    category: "recreation",
    subcategory: "Kayaking",
    municipality: "Pender Island",
    region: "Capital",
    websiteNeedsCollection: true,
  },

  // Port Renfrew Chamber of Commerce
  {
    id: "portrenfrew-coc-member-001",
    chamberId: "portrenfrew-coc",
    businessName: "Wild Renfrew",
    website: "https://www.wildrenfrew.com",
    category: "accommodation",
    subcategory: "Wilderness resort",
    description: "Glamping and wilderness resort",
    municipality: "Port Renfrew",
    region: "Capital",
  },
  {
    id: "portrenfrew-coc-member-002",
    chamberId: "portrenfrew-coc",
    businessName: "West Coast Trail Lodge",
    category: "accommodation",
    subcategory: "Lodge",
    description: "Trail head accommodation",
    municipality: "Port Renfrew",
    region: "Capital",
    websiteNeedsCollection: true,
  },

  // ============================================================================
  // VANCOUVER ISLAND
  // ============================================================================

  // Nanaimo Chamber of Commerce
  {
    id: "nanaimo-coc-member-001",
    chamberId: "nanaimo-coc",
    businessName: "Vancouver Island University",
    website: "https://www.viu.ca",
    category: "education",
    description: "Regional university",
    municipality: "Nanaimo",
    region: "Cowichan Valley",
    crossReference: {
      dataset: "schools",
      id: "viu-nanaimo",
    },
  },
  {
    id: "nanaimo-coc-member-002",
    chamberId: "nanaimo-coc",
    businessName: "Nanaimo Regional General Hospital",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "Major regional hospital",
    municipality: "Nanaimo",
    region: "Cowichan Valley",
    crossReference: {
      dataset: "emergency-services",
      id: "nanaimo-regional",
    },
  },
  {
    id: "nanaimo-coc-member-003",
    chamberId: "nanaimo-coc",
    businessName: "Nanaimo Airport",
    website: "https://www.nanaimoairport.com",
    category: "aviation",
    description: "Regional airport",
    municipality: "Nanaimo",
    region: "Cowichan Valley",
    crossReference: {
      dataset: "aviation",
      id: "cycd",
    },
  },
  {
    id: "nanaimo-coc-member-004",
    chamberId: "nanaimo-coc",
    businessName: "A.C. Taxi",
    website: "https://www.actaxi.ca",
    category: "taxi-rideshare",
    description: "Nanaimo taxi service",
    municipality: "Nanaimo",
    region: "Cowichan Valley",
    crossReference: {
      dataset: "taxi-services",
      id: "ac-taxi-nanaimo",
    },
  },

  // Comox Valley Chamber of Commerce
  {
    id: "comox-coc-member-001",
    chamberId: "comox-coc",
    businessName: "CFB Comox",
    website: "https://www.canada.ca/en/department-national-defence",
    category: "government",
    subcategory: "Military base",
    description: "Canadian Forces Base",
    municipality: "Comox",
    region: "Comox Valley",
    crossReference: {
      dataset: "aviation",
      id: "cyqq",
    },
  },
  {
    id: "comox-coc-member-002",
    chamberId: "comox-coc",
    businessName: "Mount Washington Alpine Resort",
    website: "https://www.mountwashington.ca",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Vancouver Island's largest ski resort",
    municipality: "Comox Valley",
    region: "Comox Valley",
  },
  {
    id: "comox-coc-member-003",
    chamberId: "comox-coc",
    businessName: "North Island Hospital - Comox Valley",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Courtenay",
    region: "Comox Valley",
  },

  // Campbell River Chamber of Commerce
  {
    id: "campbell-coc-member-001",
    chamberId: "campbell-coc",
    businessName: "Campbell River Airport",
    website: "https://www.campbellriver.ca/airport",
    category: "aviation",
    description: "Regional airport",
    municipality: "Campbell River",
    region: "Strathcona",
    crossReference: {
      dataset: "aviation",
      id: "cybl",
    },
  },
  {
    id: "campbell-coc-member-002",
    chamberId: "campbell-coc",
    businessName: "Campbell River Hospital",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Campbell River",
    region: "Strathcona",
    crossReference: {
      dataset: "emergency-services",
      id: "campbell-river-hospital",
    },
  },
  {
    id: "campbell-coc-member-003",
    chamberId: "campbell-coc",
    businessName: "Discovery Passage Sea Kayaking",
    website: "https://www.discoveryseakayaking.com",
    category: "recreation",
    subcategory: "Kayaking",
    description: "Kayak tours and rentals",
    municipality: "Campbell River",
    region: "Strathcona",
  },

  // Port Hardy Chamber of Commerce
  {
    id: "porthardy-coc-member-001",
    chamberId: "porthardy-coc",
    businessName: "Port Hardy Airport",
    website: "https://www.porthardy.ca",
    category: "aviation",
    description: "Regional airport serving North Island",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    crossReference: {
      dataset: "aviation",
      id: "cyzt",
    },
  },
  {
    id: "porthardy-coc-member-002",
    chamberId: "porthardy-coc",
    businessName: "BC Ferries - Port Hardy Terminal",
    website: "https://www.bcferries.com",
    category: "transit",
    subcategory: "Ferry terminal",
    description: "Inside Passage ferry terminal",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    crossReference: {
      dataset: "marine",
      id: "bc-ferries-port-hardy",
    },
  },
  {
    id: "porthardy-coc-member-003",
    chamberId: "porthardy-coc",
    businessName: "Port Hardy Hospital",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "North Island hospital",
    municipality: "Port Hardy",
    region: "Mount Waddington",
  },

  // Alberni Valley Chamber of Commerce
  {
    id: "alberni-coc-member-001",
    chamberId: "alberni-coc",
    businessName: "Lady Rose Marine Services",
    website: "https://www.ladyrosemarine.com",
    category: "fishing-marine",
    subcategory: "Passenger ferry",
    description: "Historic freight and passenger service to Bamfield and Ucluelet",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    crossReference: {
      dataset: "marine",
      id: "lady-rose",
    },
  },
  {
    id: "alberni-coc-member-002",
    chamberId: "alberni-coc",
    businessName: "Alberni Pacific Railway",
    website: "https://www.alberniheritage.com",
    category: "hospitality",
    subcategory: "Heritage railway",
    description: "Historic steam train excursions",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    crossReference: {
      dataset: "ground-transport",
      id: "alberni-pacific-railway",
    },
  },
  {
    id: "alberni-coc-member-003",
    chamberId: "alberni-coc",
    businessName: "West Coast General Hospital",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
  },

  // Tofino-Long Beach Chamber of Commerce
  {
    id: "tofino-coc-member-001",
    chamberId: "tofino-coc",
    businessName: "Pacific Rim National Park Reserve",
    website: "https://www.pc.gc.ca/en/pn-np/bc/pacificrim",
    category: "government",
    subcategory: "National park",
    description: "National park on Vancouver Island's west coast",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
  },
  {
    id: "tofino-coc-member-002",
    chamberId: "tofino-coc",
    businessName: "Wickaninnish Inn",
    website: "https://www.wickinn.com",
    category: "accommodation",
    subcategory: "Luxury resort",
    description: "Award-winning oceanfront resort",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
  },
  {
    id: "tofino-coc-member-003",
    chamberId: "tofino-coc",
    businessName: "Tofino Air",
    website: "https://www.tofinoair.ca",
    category: "aviation",
    subcategory: "Floatplane service",
    description: "Floatplane and charter flights",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    crossReference: {
      dataset: "aviation",
      id: "tofino-harbour-sph",
    },
  },
  {
    id: "tofino-coc-member-004",
    chamberId: "tofino-coc",
    businessName: "Storm Watching",
    website: "https://www.tourismtofino.com",
    category: "hospitality",
    subcategory: "Tourism",
    description: "Storm watching tours",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
  },
  {
    id: "tofino-coc-member-005",
    chamberId: "tofino-coc",
    businessName: "Tofino Taxi",
    category: "taxi-rideshare",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    crossReference: {
      dataset: "taxi-services",
      id: "tofino-taxi",
    },
    websiteNeedsCollection: true,
  },

  // Ucluelet Chamber of Commerce
  {
    id: "ucluelet-coc-member-001",
    chamberId: "ucluelet-coc",
    businessName: "Black Rock Oceanfront Resort",
    website: "https://www.blackrockresort.com",
    category: "accommodation",
    subcategory: "Resort",
    description: "Oceanfront resort",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
  },
  {
    id: "ucluelet-coc-member-002",
    chamberId: "ucluelet-coc",
    businessName: "Wild Pacific Trail Society",
    website: "https://www.wildpacifictrail.com",
    category: "charity-nonprofit",
    subcategory: "Trail society",
    description: "Maintains the Wild Pacific Trail",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
  },
  {
    id: "ucluelet-coc-member-003",
    chamberId: "ucluelet-coc",
    businessName: "Ucluelet Taxi",
    category: "taxi-rideshare",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    crossReference: {
      dataset: "taxi-services",
      id: "ucluelet-taxi",
    },
    websiteNeedsCollection: true,
  },

  // Bamfield Chamber of Commerce
  {
    id: "bamfield-coc-member-001",
    chamberId: "bamfield-coc",
    businessName: "Bamfield Marine Sciences Centre",
    website: "https://www.bamfieldmsc.com",
    category: "education",
    subcategory: "Research station",
    description: "University consortium marine research station",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    crossReference: {
      dataset: "schools",
      id: "bamfield-marine-sciences",
    },
  },
  {
    id: "bamfield-coc-member-002",
    chamberId: "bamfield-coc",
    businessName: "West Coast Trail Express",
    website: "https://www.trailbus.com",
    category: "transit",
    subcategory: "Bus service",
    description: "Shuttle service for West Coast Trail hikers",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
  },
  {
    id: "bamfield-coc-member-003",
    chamberId: "bamfield-coc",
    businessName: "Bamfield Lodge",
    category: "accommodation",
    subcategory: "Lodge",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    websiteNeedsCollection: true,
  },
  {
    id: "bamfield-coc-member-004",
    chamberId: "bamfield-coc",
    businessName: "Broken Island Adventures",
    website: "https://www.brokenislandadventures.com",
    category: "recreation",
    subcategory: "Kayaking and tours",
    description: "Kayak tours to Broken Group Islands",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
  },

  // Duncan Cowichan Chamber of Commerce
  {
    id: "duncan-coc-member-001",
    chamberId: "duncan-coc",
    businessName: "Cowichan District Hospital",
    website: "https://www.islandhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Duncan",
    region: "Cowichan Valley",
  },
  {
    id: "duncan-coc-member-002",
    chamberId: "duncan-coc",
    businessName: "Cowichan Valley Museum",
    website: "https://www.cowichanvalleymuseum.bc.ca",
    category: "arts-culture",
    subcategory: "Museum",
    municipality: "Duncan",
    region: "Cowichan Valley",
  },
  {
    id: "duncan-coc-member-003",
    chamberId: "duncan-coc",
    businessName: "Cowichan Tribes",
    website: "https://www.cowichantribes.com",
    category: "first-nations",
    description: "Largest First Nation in BC by membership",
    municipality: "Duncan",
    region: "Cowichan Valley",
  },

  // ============================================================================
  // OKANAGAN
  // ============================================================================

  // Kelowna Chamber of Commerce
  {
    id: "kelowna-coc-member-001",
    chamberId: "kelowna-coc",
    businessName: "UBC Okanagan",
    website: "https://ok.ubc.ca",
    category: "education",
    description: "UBC's Okanagan campus",
    municipality: "Kelowna",
    region: "Central Okanagan",
    crossReference: {
      dataset: "schools",
      id: "ubc-okanagan",
    },
  },
  {
    id: "kelowna-coc-member-002",
    chamberId: "kelowna-coc",
    businessName: "Kelowna General Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Major regional hospital",
    municipality: "Kelowna",
    region: "Central Okanagan",
    crossReference: {
      dataset: "emergency-services",
      id: "kelowna-general",
    },
  },
  {
    id: "kelowna-coc-member-003",
    chamberId: "kelowna-coc",
    businessName: "Kelowna International Airport",
    website: "https://www.ylw.kelowna.ca",
    category: "aviation",
    description: "Interior BC's busiest airport",
    municipality: "Kelowna",
    region: "Central Okanagan",
    crossReference: {
      dataset: "aviation",
      id: "cylw",
    },
  },
  {
    id: "kelowna-coc-member-004",
    chamberId: "kelowna-coc",
    businessName: "Mission Hill Family Estate Winery",
    website: "https://www.missionhillwinery.com",
    category: "winery-brewery",
    subcategory: "Winery",
    description: "Award-winning winery",
    municipality: "West Kelowna",
    region: "Central Okanagan",
  },
  {
    id: "kelowna-coc-member-005",
    chamberId: "kelowna-coc",
    businessName: "Kelowna Cabs",
    website: "https://www.kelownacabs.ca",
    category: "taxi-rideshare",
    municipality: "Kelowna",
    region: "Central Okanagan",
    crossReference: {
      dataset: "taxi-services",
      id: "kelowna-cabs",
    },
  },

  // Vernon Chamber of Commerce
  {
    id: "vernon-coc-member-001",
    chamberId: "vernon-coc",
    businessName: "Vernon Jubilee Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Vernon",
    region: "North Okanagan",
  },
  {
    id: "vernon-coc-member-002",
    chamberId: "vernon-coc",
    businessName: "Silver Star Mountain Resort",
    website: "https://www.skisilverstar.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Major ski resort",
    municipality: "Vernon",
    region: "North Okanagan",
  },
  {
    id: "vernon-coc-member-003",
    chamberId: "vernon-coc",
    businessName: "Vernon Regional Airport",
    website: "https://www.vernonairport.ca",
    category: "aviation",
    municipality: "Vernon",
    region: "North Okanagan",
    crossReference: {
      dataset: "aviation",
      id: "cyvk",
    },
  },

  // Penticton Chamber of Commerce
  {
    id: "penticton-coc-member-001",
    chamberId: "penticton-coc",
    businessName: "Penticton Regional Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
  },
  {
    id: "penticton-coc-member-002",
    chamberId: "penticton-coc",
    businessName: "Penticton Airport",
    website: "https://www.pentictonairport.com",
    category: "aviation",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    crossReference: {
      dataset: "aviation",
      id: "cyyf",
    },
  },
  {
    id: "penticton-coc-member-003",
    chamberId: "penticton-coc",
    businessName: "Penticton Lakeside Resort",
    website: "https://www.pentictonlakesideresort.com",
    category: "accommodation",
    subcategory: "Resort",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
  },

  // ============================================================================
  // THOMPSON-NICOLA / SHUSWAP
  // ============================================================================

  // Kamloops Chamber of Commerce
  {
    id: "kamloops-coc-member-001",
    chamberId: "kamloops-coc",
    businessName: "Thompson Rivers University",
    website: "https://www.tru.ca",
    category: "education",
    description: "Regional university",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    crossReference: {
      dataset: "schools",
      id: "tru",
    },
  },
  {
    id: "kamloops-coc-member-002",
    chamberId: "kamloops-coc",
    businessName: "Royal Inland Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Major regional hospital with trauma centre",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    crossReference: {
      dataset: "emergency-services",
      id: "royal-inland",
    },
  },
  {
    id: "kamloops-coc-member-003",
    chamberId: "kamloops-coc",
    businessName: "Kamloops Airport",
    website: "https://www.kamloopsairport.com",
    category: "aviation",
    description: "Regional airport",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    crossReference: {
      dataset: "aviation",
      id: "cyka",
    },
  },
  {
    id: "kamloops-coc-member-004",
    chamberId: "kamloops-coc",
    businessName: "Sun Peaks Resort",
    website: "https://www.sunpeaksresort.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Second largest ski area in Canada",
    municipality: "Sun Peaks",
    region: "Thompson-Nicola",
  },

  // Salmon Arm Chamber of Commerce
  {
    id: "salmon-arm-coc-member-001",
    chamberId: "salmon-arm-coc",
    businessName: "Shuswap Lake General Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
  },
  {
    id: "salmon-arm-coc-member-002",
    chamberId: "salmon-arm-coc",
    businessName: "Salmon Arm Airport",
    website: "https://www.salmonarm.ca",
    category: "aviation",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    crossReference: {
      dataset: "aviation",
      id: "czam",
    },
  },

  // Revelstoke Chamber of Commerce
  {
    id: "revelstoke-coc-member-001",
    chamberId: "revelstoke-coc",
    businessName: "Revelstoke Mountain Resort",
    website: "https://www.revelstokemountainresort.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Ski resort with North America's greatest vertical",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
  },
  {
    id: "revelstoke-coc-member-002",
    chamberId: "revelstoke-coc",
    businessName: "Queen Victoria Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Community hospital",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
  },
  {
    id: "revelstoke-coc-member-003",
    chamberId: "revelstoke-coc",
    businessName: "Parks Canada - Rogers Pass",
    website: "https://www.pc.gc.ca",
    category: "government",
    subcategory: "National park",
    description: "Glacier National Park headquarters",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
  },

  // Golden Chamber of Commerce
  {
    id: "golden-coc-member-001",
    chamberId: "golden-coc",
    businessName: "Kicking Horse Mountain Resort",
    website: "https://www.kickinghorseresort.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Major ski resort",
    municipality: "Golden",
    region: "Columbia-Shuswap",
  },
  {
    id: "golden-coc-member-002",
    chamberId: "golden-coc",
    businessName: "Golden & District Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Community hospital",
    municipality: "Golden",
    region: "Columbia-Shuswap",
  },
  {
    id: "golden-coc-member-003",
    chamberId: "golden-coc",
    businessName: "Mount 7 Taxi",
    category: "taxi-rideshare",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    crossReference: {
      dataset: "taxi-services",
      id: "mount7-taxi-golden",
    },
    websiteNeedsCollection: true,
  },

  // ============================================================================
  // CARIBOO
  // ============================================================================

  // Williams Lake Chamber of Commerce
  {
    id: "williams-lake-coc-member-001",
    chamberId: "williams-lake-coc",
    businessName: "Cariboo Memorial Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Williams Lake",
    region: "Cariboo",
  },
  {
    id: "williams-lake-coc-member-002",
    chamberId: "williams-lake-coc",
    businessName: "Williams Lake Airport",
    website: "https://www.williamslake.ca",
    category: "aviation",
    municipality: "Williams Lake",
    region: "Cariboo",
    crossReference: {
      dataset: "aviation",
      id: "cywl",
    },
  },
  {
    id: "williams-lake-coc-member-003",
    chamberId: "williams-lake-coc",
    businessName: "Williams Lake Stampede",
    website: "https://www.williamslakestampede.com",
    category: "entertainment",
    subcategory: "Rodeo",
    description: "Major annual rodeo event",
    municipality: "Williams Lake",
    region: "Cariboo",
  },

  // Quesnel Chamber of Commerce
  {
    id: "quesnel-coc-member-001",
    chamberId: "quesnel-coc",
    businessName: "G.R. Baker Memorial Hospital",
    website: "https://www.northernhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Quesnel",
    region: "Cariboo",
  },
  {
    id: "quesnel-coc-member-002",
    chamberId: "quesnel-coc",
    businessName: "Quesnel Airport",
    website: "https://www.quesnel.ca",
    category: "aviation",
    municipality: "Quesnel",
    region: "Cariboo",
    crossReference: {
      dataset: "aviation",
      id: "cyqz",
    },
  },

  // ============================================================================
  // NORTHERN BC
  // ============================================================================

  // Prince George Chamber of Commerce
  {
    id: "pg-coc-member-001",
    chamberId: "pg-coc",
    businessName: "University of Northern British Columbia",
    website: "https://www.unbc.ca",
    category: "education",
    description: "Northern BC's university",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    crossReference: {
      dataset: "schools",
      id: "unbc",
    },
  },
  {
    id: "pg-coc-member-002",
    chamberId: "pg-coc",
    businessName: "University Hospital of Northern BC",
    website: "https://www.northernhealth.ca",
    category: "healthcare",
    description: "Major regional hospital with trauma centre",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    crossReference: {
      dataset: "emergency-services",
      id: "uhnbc",
    },
  },
  {
    id: "pg-coc-member-003",
    chamberId: "pg-coc",
    businessName: "Prince George Airport",
    website: "https://www.pgairport.ca",
    category: "aviation",
    description: "Northern BC's main airport",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    crossReference: {
      dataset: "aviation",
      id: "cyxs",
    },
  },
  {
    id: "pg-coc-member-004",
    chamberId: "pg-coc",
    businessName: "Canfor Corporation",
    website: "https://www.canfor.com",
    category: "forestry-logging",
    description: "Major forest products company",
    municipality: "Prince George",
    region: "Fraser-Fort George",
  },
  {
    id: "pg-coc-member-005",
    chamberId: "pg-coc",
    businessName: "CN Rail - Prince George Yard",
    website: "https://www.cn.ca",
    category: "trucking-freight",
    subcategory: "Rail freight",
    description: "Major railway hub",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    crossReference: {
      dataset: "ground-transport",
      id: "cn-prince-george",
    },
  },

  // Fort St. John Chamber of Commerce
  {
    id: "fsj-coc-member-001",
    chamberId: "fsj-coc",
    businessName: "Northern Lights College",
    website: "https://www.nlc.bc.ca",
    category: "education",
    description: "Regional college serving northeast BC",
    municipality: "Fort St. John",
    region: "Peace River",
    crossReference: {
      dataset: "schools",
      id: "nlc-fsj",
    },
  },
  {
    id: "fsj-coc-member-002",
    chamberId: "fsj-coc",
    businessName: "Fort St. John Hospital",
    website: "https://www.northernhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Fort St. John",
    region: "Peace River",
  },
  {
    id: "fsj-coc-member-003",
    chamberId: "fsj-coc",
    businessName: "Fort St. John Airport",
    website: "https://www.fsjairport.com",
    category: "aviation",
    description: "Regional airport serving Peace River region",
    municipality: "Fort St. John",
    region: "Peace River",
    crossReference: {
      dataset: "aviation",
      id: "cyxj",
    },
  },

  // Terrace Chamber of Commerce
  {
    id: "terrace-coc-member-001",
    chamberId: "terrace-coc",
    businessName: "Mills Memorial Hospital",
    website: "https://www.northernhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
  },
  {
    id: "terrace-coc-member-002",
    chamberId: "terrace-coc",
    businessName: "Northwest Regional Airport (Terrace)",
    website: "https://www.yxt.ca",
    category: "aviation",
    description: "Regional airport",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    crossReference: {
      dataset: "aviation",
      id: "cyxt",
    },
  },
  {
    id: "terrace-coc-member-003",
    chamberId: "terrace-coc",
    businessName: "Coast Mountain College - Terrace",
    website: "https://www.coastmountaincollege.ca",
    category: "education",
    description: "Regional college campus",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    crossReference: {
      dataset: "schools",
      id: "cmc-terrace",
    },
  },

  // Kitimat Chamber of Commerce
  {
    id: "kitimat-coc-member-001",
    chamberId: "kitimat-coc",
    businessName: "Rio Tinto Alcan - Kitimat Smelter",
    website: "https://www.riotinto.com",
    category: "manufacturing",
    subcategory: "Aluminum smelter",
    description: "Major aluminum smelter",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
  },
  {
    id: "kitimat-coc-member-002",
    chamberId: "kitimat-coc",
    businessName: "LNG Canada",
    website: "https://www.lngcanada.ca",
    category: "utilities",
    subcategory: "LNG export terminal",
    description: "Major LNG export facility under construction",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
  },
  {
    id: "kitimat-coc-member-003",
    chamberId: "kitimat-coc",
    businessName: "Kitimat General Hospital",
    website: "https://www.northernhealth.ca",
    category: "healthcare",
    description: "Community hospital",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
  },

  // Prince Rupert Chamber of Commerce
  {
    id: "prupert-coc-member-001",
    chamberId: "prupert-coc",
    businessName: "Port of Prince Rupert",
    website: "https://www.rupertport.com",
    category: "fishing-marine",
    subcategory: "Port authority",
    description: "Deep water port - closest North American port to Asia",
    municipality: "Prince Rupert",
    region: "North Coast",
    crossReference: {
      dataset: "marine",
      id: "port-prince-rupert",
    },
  },
  {
    id: "prupert-coc-member-002",
    chamberId: "prupert-coc",
    businessName: "BC Ferries - Prince Rupert Terminal",
    website: "https://www.bcferries.com",
    category: "transit",
    subcategory: "Ferry terminal",
    description: "Inside Passage and Haida Gwaii ferry terminal",
    municipality: "Prince Rupert",
    region: "North Coast",
    crossReference: {
      dataset: "marine",
      id: "bc-ferries-prince-rupert",
    },
  },
  {
    id: "prupert-coc-member-003",
    chamberId: "prupert-coc",
    businessName: "Prince Rupert Regional Hospital",
    website: "https://www.northernhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Prince Rupert",
    region: "North Coast",
  },

  // ============================================================================
  // KOOTENAYS
  // ============================================================================

  // Nelson Chamber of Commerce
  {
    id: "nelson-coc-member-001",
    chamberId: "nelson-coc",
    businessName: "Kootenay Lake Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Nelson",
    region: "Central Kootenay",
  },
  {
    id: "nelson-coc-member-002",
    chamberId: "nelson-coc",
    businessName: "Selkirk College",
    website: "https://www.selkirk.ca",
    category: "education",
    description: "Regional college",
    municipality: "Nelson",
    region: "Central Kootenay",
    crossReference: {
      dataset: "schools",
      id: "selkirk-nelson",
    },
  },
  {
    id: "nelson-coc-member-003",
    chamberId: "nelson-coc",
    businessName: "Whitewater Ski Resort",
    website: "https://www.skiwhitewater.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Powder skiing destination",
    municipality: "Nelson",
    region: "Central Kootenay",
  },
  {
    id: "nelson-coc-member-004",
    chamberId: "nelson-coc",
    businessName: "Glacier Cabs Nelson",
    category: "taxi-rideshare",
    municipality: "Nelson",
    region: "Central Kootenay",
    crossReference: {
      dataset: "taxi-services",
      id: "glacier-cabs-nelson",
    },
    websiteNeedsCollection: true,
  },

  // Cranbrook Chamber of Commerce
  {
    id: "cranbrook-coc-member-001",
    chamberId: "cranbrook-coc",
    businessName: "East Kootenay Regional Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Major regional hospital",
    municipality: "Cranbrook",
    region: "East Kootenay",
    crossReference: {
      dataset: "emergency-services",
      id: "east-kootenay-regional",
    },
  },
  {
    id: "cranbrook-coc-member-002",
    chamberId: "cranbrook-coc",
    businessName: "Canadian Rockies International Airport",
    website: "https://www.cranbrookairport.com",
    category: "aviation",
    description: "Regional airport",
    municipality: "Cranbrook",
    region: "East Kootenay",
    crossReference: {
      dataset: "aviation",
      id: "cyxc",
    },
  },
  {
    id: "cranbrook-coc-member-003",
    chamberId: "cranbrook-coc",
    businessName: "College of the Rockies",
    website: "https://www.cotr.bc.ca",
    category: "education",
    description: "Regional college",
    municipality: "Cranbrook",
    region: "East Kootenay",
    crossReference: {
      dataset: "schools",
      id: "cotr-cranbrook",
    },
  },

  // Fernie Chamber of Commerce
  {
    id: "fernie-coc-member-001",
    chamberId: "fernie-coc",
    businessName: "Fernie Alpine Resort",
    website: "https://www.skifernie.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Major ski destination",
    municipality: "Fernie",
    region: "East Kootenay",
  },
  {
    id: "fernie-coc-member-002",
    chamberId: "fernie-coc",
    businessName: "Elk Valley Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Community hospital",
    municipality: "Fernie",
    region: "East Kootenay",
  },
  {
    id: "fernie-coc-member-003",
    chamberId: "fernie-coc",
    businessName: "Teck Resources - Coal Mountain",
    website: "https://www.teck.com",
    category: "mining",
    subcategory: "Coal mining",
    description: "Metallurgical coal mining operations",
    municipality: "Fernie",
    region: "East Kootenay",
  },

  // Trail Chamber of Commerce
  {
    id: "trail-coc-member-001",
    chamberId: "trail-coc",
    businessName: "Teck Trail Operations",
    website: "https://www.teck.com",
    category: "manufacturing",
    subcategory: "Smelter",
    description: "World's largest fully integrated zinc and lead smelting operation",
    municipality: "Trail",
    region: "Kootenay Boundary",
  },
  {
    id: "trail-coc-member-002",
    chamberId: "trail-coc",
    businessName: "Kootenay Boundary Regional Hospital",
    website: "https://www.interiorhealth.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Trail",
    region: "Kootenay Boundary",
  },
  {
    id: "trail-coc-member-003",
    chamberId: "trail-coc",
    businessName: "Rossland Red Mountain Resort",
    website: "https://www.redresort.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "Historic ski resort near Trail",
    municipality: "Rossland",
    region: "Kootenay Boundary",
  },

  // ============================================================================
  // SEA-TO-SKY
  // ============================================================================

  // Whistler Chamber of Commerce
  {
    id: "whistler-coc-member-001",
    chamberId: "whistler-coc",
    businessName: "Whistler Blackcomb",
    website: "https://www.whistlerblackcomb.com",
    category: "recreation",
    subcategory: "Ski resort",
    description: "North America's largest ski resort",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
  },
  {
    id: "whistler-coc-member-002",
    chamberId: "whistler-coc",
    businessName: "Tourism Whistler",
    website: "https://www.whistler.com",
    category: "hospitality",
    subcategory: "Tourism bureau",
    description: "Destination marketing organization",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
  },
  {
    id: "whistler-coc-member-003",
    chamberId: "whistler-coc",
    businessName: "Fairmont Chateau Whistler",
    website: "https://www.fairmont.com/whistler",
    category: "accommodation",
    subcategory: "Luxury hotel",
    description: "Luxury ski-in/ski-out hotel",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
  },
  {
    id: "whistler-coc-member-004",
    chamberId: "whistler-coc",
    businessName: "Whistler Health Care Centre",
    website: "https://www.vch.ca",
    category: "healthcare",
    description: "Community health centre",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
  },
  {
    id: "whistler-coc-member-005",
    chamberId: "whistler-coc",
    businessName: "Whistler Taxis",
    category: "taxi-rideshare",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    crossReference: {
      dataset: "taxi-services",
      id: "whistler-taxis",
    },
    websiteNeedsCollection: true,
  },

  // Squamish Chamber of Commerce
  {
    id: "squamish-coc-member-001",
    chamberId: "squamish-coc",
    businessName: "Sea to Sky Gondola",
    website: "https://www.seatoskygondola.com",
    category: "hospitality",
    subcategory: "Tourism attraction",
    description: "Scenic gondola ride",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
  },
  {
    id: "squamish-coc-member-002",
    chamberId: "squamish-coc",
    businessName: "Quest University Canada",
    website: "https://www.questu.ca",
    category: "education",
    description: "Private liberal arts university",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
  },
  {
    id: "squamish-coc-member-003",
    chamberId: "squamish-coc",
    businessName: "Squamish General Hospital",
    website: "https://www.vch.ca",
    category: "healthcare",
    description: "Community hospital",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
  },
  {
    id: "squamish-coc-member-004",
    chamberId: "squamish-coc",
    businessName: "Squamish Airport",
    website: "https://www.squamish.ca",
    category: "aviation",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    crossReference: {
      dataset: "aviation",
      id: "cyse",
    },
  },

  // ============================================================================
  // SUNSHINE COAST
  // ============================================================================

  // Sechelt Chamber of Commerce
  {
    id: "sechelt-coc-member-001",
    chamberId: "sechelt-coc",
    businessName: "Sechelt Hospital (St. Mary's)",
    website: "https://www.vch.ca",
    category: "healthcare",
    description: "Community hospital",
    municipality: "Sechelt",
    region: "Sunshine Coast",
  },
  {
    id: "sechelt-coc-member-002",
    chamberId: "sechelt-coc",
    businessName: "Sechelt Airport",
    website: "https://www.sechelt.ca",
    category: "aviation",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    crossReference: {
      dataset: "aviation",
      id: "caa7",
    },
  },
  {
    id: "sechelt-coc-member-003",
    chamberId: "sechelt-coc",
    businessName: "Sechelt Taxi",
    category: "taxi-rideshare",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    crossReference: {
      dataset: "taxi-services",
      id: "sechelt-taxi",
    },
    websiteNeedsCollection: true,
  },

  // Powell River Chamber of Commerce
  {
    id: "powell-river-coc-member-001",
    chamberId: "powell-river-coc",
    businessName: "Powell River General Hospital",
    website: "https://www.vch.ca",
    category: "healthcare",
    description: "Regional hospital",
    municipality: "Powell River",
    region: "Powell River",
  },
  {
    id: "powell-river-coc-member-002",
    chamberId: "powell-river-coc",
    businessName: "Powell River Airport",
    website: "https://www.powellriverairport.ca",
    category: "aviation",
    municipality: "Powell River",
    region: "Powell River",
    crossReference: {
      dataset: "aviation",
      id: "cypw",
    },
  },
  {
    id: "powell-river-coc-member-003",
    chamberId: "powell-river-coc",
    businessName: "BC Ferries - Powell River Terminal",
    website: "https://www.bcferries.com",
    category: "transit",
    subcategory: "Ferry terminal",
    municipality: "Powell River",
    region: "Powell River",
    crossReference: {
      dataset: "marine",
      id: "bc-ferries-powell-river",
    },
  },
];

// Helper function to get members by chamber
export function getMembersByChamber(chamberId: string): ChamberMember[] {
  return chamberMembers.filter(member => member.chamberId === chamberId);
}

// Helper function to get members by category
export function getMembersByCategory(category: BusinessCategory): ChamberMember[] {
  return chamberMembers.filter(member => member.category === category);
}

// Helper function to get members with cross-references
export function getMembersWithCrossReferences(): ChamberMember[] {
  return chamberMembers.filter(member => member.crossReference !== undefined);
}

// Helper function to get members needing website collection
export function getMembersNeedingWebsites(): ChamberMember[] {
  return chamberMembers.filter(member => member.websiteNeedsCollection === true);
}

// Helper function to get member count by chamber
export function getMemberCountByChamber(chamberId: string): number {
  return chamberMembers.filter(member => member.chamberId === chamberId).length;
}

// Helper function to get all business categories in use
export function getUsedCategories(): BusinessCategory[] {
  const categories = new Set<BusinessCategory>();
  chamberMembers.forEach(member => categories.add(member.category));
  return Array.from(categories).sort();
}
