/**
 * BC Ground Transportation Infrastructure
 * Organized by criticality tier for community resilience monitoring:
 * - Tier 1 LIFELINE: Fuel, food, medical supplies (critical to survival)
 * - Tier 2 SUPPLY CHAIN: General freight, intermodal (economic function)
 * - Tier 3 MOBILITY: Transit, buses, passenger rail (community movement)
 * - Tier 4 MESSAGING: Postal, courier, delivery (non-critical logistics)
 * All coordinates in WGS84 (lat/lng)
 */

// Criticality classification for ground transport
export type CriticalityTier = 1 | 2 | 3 | 4;
export type LifelineDomain = 'energy' | 'food' | 'health' | 'freight' | 'mobility' | 'messaging';

// Helper to determine trucking criticality tier
export function getTruckingTier(type: TruckingService['type']): CriticalityTier {
  switch (type) {
    case 'fuel':
    case 'food':
    case 'hazmat': // propane/heating fuel is lifeline
      return 1;
    case 'general_freight':
    case 'ltl':
    case 'refrigerated':
    case 'logging':
    case 'aggregate':
      return 2;
    default:
      return 2;
  }
}

// Helper to determine trucking lifeline domain
export function getTruckingDomain(type: TruckingService['type']): LifelineDomain {
  switch (type) {
    case 'fuel':
    case 'hazmat':
      return 'energy';
    case 'food':
    case 'refrigerated':
      return 'food';
    default:
      return 'freight';
  }
}

// Helper to determine rail criticality tier
export function getRailTier(type: RailServiceType): CriticalityTier {
  switch (type) {
    case 'class_1_freight':
    case 'shortline':
      return 2; // Supply chain
    case 'passenger':
    case 'commuter':
    case 'tourist':
      return 3; // Mobility
    default:
      return 2;
  }
}

// Helper to determine courier criticality tier (all are Tier 4 messaging)
export function getCourierTier(): CriticalityTier {
  return 4;
}

// Helper for people carrier criticality tier (all are Tier 3 mobility)
export function getPeopleCarrierTier(): CriticalityTier {
  return 3;
}

export type IntercityBusType = 
  | "scheduled"      // Regular scheduled service
  | "seasonal"       // Seasonal service (e.g., ski shuttles, trail access)
  | "cross_border"   // US-Canada cross-border service
  | "connector";     // Connects to ferries or other transit

export type TransitSystemType =
  | "bc_transit"     // BC Transit operated
  | "translink"      // TransLink (Metro Vancouver)
  | "municipal"      // Municipally operated
  | "handydart"      // Accessible transit service
  | "bc_bus_north";  // Northern intercity service

export type CharterBusType =
  | "charter"        // General charter service
  | "tour"           // Tour operator
  | "school"         // School bus contractor
  | "airport";       // Airport shuttle service

export type CourierServiceType =
  | "postal"         // Canada Post / national postal service
  | "express"        // Express courier (FedEx, UPS, Purolator, DHL)
  | "regional"       // Regional delivery provider
  | "freight"        // Freight/LTL carrier with parcel service
  | "same_day";      // Same-day delivery service

export type RailServiceType =
  | "class_1_freight"  // CN, CP - Class I freight railroads
  | "shortline"        // Regional/shortline freight railroads
  | "passenger"        // VIA Rail intercity passenger
  | "commuter"         // West Coast Express commuter rail
  | "tourist";         // Rocky Mountaineer, heritage railways

export interface RailService {
  id: string;
  name: string;
  type: RailServiceType;
  stations: {
    name: string;
    station_type: "major_yard" | "intermodal" | "passenger_station" | "freight_depot" | "heritage";
    municipality: string;
    subdivision?: string;  // Railway subdivision name
    lat: number;
    lng: number;
  }[];
  routes: string[];
  service_coverage: string[];
  website?: string;
  phone?: string;
  notes?: string;
}

export interface IntercityBusService {
  id: string;
  name: string;
  type: IntercityBusType;
  routes: string[];
  hubs: {
    name: string;
    municipality: string;
    lat: number;
    lng: number;
  }[];
  website?: string;
  phone?: string;
  notes?: string;
}

export interface TransitSystem {
  id: string;
  name: string;
  type: TransitSystemType;
  operator: string;
  municipalities_served: string[];
  hub_location?: {
    name: string;
    lat: number;
    lng: number;
  };
  website?: string;
  notes?: string;
}

export interface CharterBusOperator {
  id: string;
  name: string;
  type: CharterBusType;
  base_location: {
    municipality: string;
    address?: string;
    lat: number;
    lng: number;
  };
  service_area: string[];
  fleet_size?: string;
  website?: string;
  phone?: string;
  notes?: string;
}

export interface CourierService {
  id: string;
  name: string;
  type: CourierServiceType;
  facilities: {
    name: string;
    facility_type: "hub" | "depot" | "outlet" | "dropbox" | "locker" | "post_office" | "rural_po" | "franchise";
    municipality: string;
    address?: string;
    lat: number;
    lng: number;
  }[];
  service_coverage: string[];  // Municipalities/regions served
  website?: string;
  phone?: string;
  tracking_url?: string;
  notes?: string;
}

// ============================================================================
// INTERCITY BUS SERVICES
// ============================================================================

export const BC_INTERCITY_BUS: IntercityBusService[] = [
  // Major Scheduled Services
  {
    id: "ebus",
    name: "Ebus",
    type: "scheduled",
    routes: [
      "Vancouver - Kamloops - Calgary",
      "Vancouver - Kelowna - Calgary",
      "Vancouver - Chilliwack",
      "Kelowna - Edmonton"
    ],
    hubs: [
      { name: "Vancouver Pacific Central", municipality: "Vancouver", lat: 49.2735, lng: -123.0978 },
      { name: "Chilliwack", municipality: "Chilliwack", lat: 49.1579, lng: -121.9514 },
      { name: "Kamloops", municipality: "Kamloops", lat: 50.6745, lng: -120.3273 },
      { name: "Kelowna", municipality: "Kelowna", lat: 49.8863, lng: -119.4966 },
      { name: "Chase", municipality: "Chase", lat: 50.8190, lng: -119.6847 }
    ],
    website: "https://www.myebus.ca",
    phone: "1-877-769-3287",
    notes: "Launched 2021 after Greyhound exit; owned by Pacific Western Transportation"
  },
  {
    id: "rider-express",
    name: "Rider Express",
    type: "scheduled",
    routes: [
      "Vancouver - Calgary - Regina - Winnipeg",
      "Edmonton - Saskatoon - Regina"
    ],
    hubs: [
      { name: "Vancouver Pacific Central", municipality: "Vancouver", lat: 49.2735, lng: -123.0978 },
      { name: "Kamloops", municipality: "Kamloops", lat: 50.6745, lng: -120.3273 }
    ],
    website: "https://riderexpress.ca",
    phone: "1-833-583-3636",
    notes: "Saskatchewan-based; launched 2017; expanding across Western Canada"
  },
  {
    id: "flixbus",
    name: "FlixBus",
    type: "cross_border",
    routes: [
      "Vancouver - Seattle",
      "Expanding domestic BC service (2024+)"
    ],
    hubs: [
      { name: "Vancouver Pacific Central", municipality: "Vancouver", lat: 49.2735, lng: -123.0978 }
    ],
    website: "https://www.flixbus.ca",
    notes: "Low-cost carrier; bright green buses; expanding domestic BC service"
  },
  {
    id: "island-express",
    name: "Island Express Bus / Tofino Bus",
    type: "scheduled",
    routes: [
      "Victoria - Nanaimo - Campbell River",
      "Nanaimo - Tofino - Ucluelet",
      "Nanaimo - Port Alberni",
      "Victoria - Parksville"
    ],
    hubs: [
      { name: "Victoria Bus Depot", municipality: "Victoria", lat: 48.4284, lng: -123.3656 },
      { name: "Nanaimo", municipality: "Nanaimo", lat: 49.1659, lng: -123.9401 },
      { name: "Tofino", municipality: "Tofino", lat: 49.1530, lng: -125.9066 },
      { name: "Ucluelet", municipality: "Ucluelet", lat: 48.9424, lng: -125.5466 },
      { name: "Campbell River", municipality: "Campbell River", lat: 50.0244, lng: -125.2475 },
      { name: "Port Alberni", municipality: "Port Alberni", lat: 49.2339, lng: -124.8055 }
    ],
    website: "https://tofinobus.com",
    phone: "1-866-986-3466",
    notes: "Same company operates both brands; year-round daily service"
  },
  {
    id: "wilsons",
    name: "Wilson's Transportation",
    type: "connector",
    routes: [
      "Vancouver - Victoria via BC Ferries",
      "Vancouver - Nanaimo via BC Ferries"
    ],
    hubs: [
      { name: "Vancouver Station Street", municipality: "Vancouver", lat: 49.2795, lng: -123.0972 },
      { name: "Victoria Glanford", municipality: "Victoria", lat: 48.4646, lng: -123.3824 }
    ],
    website: "https://www.wilsonstransportation.com",
    phone: "1-800-567-3288",
    notes: "Motorcoach service integrated with BC Ferries"
  },
  {
    id: "west-coast-trail-express",
    name: "West Coast Trail Express",
    type: "seasonal",
    routes: [
      "Victoria - West Coast Trail (Pachena Bay)",
      "Victoria - Juan de Fuca Trail",
      "Nanaimo - West Coast Trail"
    ],
    hubs: [
      { name: "Victoria Departure", municipality: "Victoria", lat: 48.4284, lng: -123.3656 },
      { name: "Nanaimo Departure", municipality: "Nanaimo", lat: 49.1659, lng: -123.9401 },
      { name: "Pachena Bay Trailhead", municipality: "Bamfield", lat: 48.7847, lng: -125.1136 }
    ],
    website: "https://trailbus.com",
    phone: "250-477-8700",
    notes: "Seasonal shuttle May 1 - Sept 30; hiker-focused"
  },
  {
    id: "yvr-skylynx",
    name: "YVR Skylynx",
    type: "scheduled",
    routes: [
      "Vancouver Airport (YVR) - Whistler",
      "Vancouver Airport (YVR) - Squamish"
    ],
    hubs: [
      { name: "YVR Airport", municipality: "Richmond", lat: 49.1947, lng: -123.1792 },
      { name: "Whistler Village", municipality: "Whistler", lat: 50.1163, lng: -122.9574 },
      { name: "Squamish", municipality: "Squamish", lat: 49.7016, lng: -123.1558 }
    ],
    website: "https://yvrskylynx.com",
    notes: "Direct airport-to-resort shuttle service"
  },
  {
    id: "squamish-connector",
    name: "Squamish Connector",
    type: "scheduled",
    routes: [
      "Vancouver - Squamish"
    ],
    hubs: [
      { name: "Vancouver Downtown", municipality: "Vancouver", lat: 49.2827, lng: -123.1207 },
      { name: "Squamish Adventure Centre", municipality: "Squamish", lat: 49.7016, lng: -123.1558 }
    ],
    website: "https://squamishconnector.com",
    notes: "Commuter and recreational service"
  },
  {
    id: "quick-shuttle",
    name: "Quick Shuttle",
    type: "cross_border",
    routes: [
      "Vancouver - Bellingham Airport",
      "Vancouver - Seattle"
    ],
    hubs: [
      { name: "Vancouver Waterfront", municipality: "Vancouver", lat: 49.2856, lng: -123.1115 },
      { name: "Richmond Canada Line", municipality: "Richmond", lat: 49.1706, lng: -123.1360 }
    ],
    website: "https://quickcoach.com",
    phone: "1-800-665-2122",
    notes: "Cross-border US-Canada service"
  },
  {
    id: "bc-bus-north",
    name: "BC Bus North",
    type: "scheduled",
    routes: [
      "Prince George - Prince Rupert",
      "Prince George - Dawson Creek",
      "Prince George - Fort St. John",
      "Prince George - Fort Nelson",
      "Prince George - Valemount"
    ],
    hubs: [
      { name: "Prince George Transit Exchange", municipality: "Prince George", lat: 53.9171, lng: -122.7497 },
      { name: "Prince Rupert", municipality: "Prince Rupert", lat: 54.3150, lng: -130.3208 },
      { name: "Dawson Creek", municipality: "Dawson Creek", lat: 55.7596, lng: -120.2377 },
      { name: "Fort St. John", municipality: "Fort St. John", lat: 56.2465, lng: -120.8476 },
      { name: "Fort Nelson", municipality: "Fort Nelson", lat: 58.8050, lng: -122.7002 }
    ],
    website: "https://www.bctransit.com/bc-bus-north",
    notes: "Operated by BC Transit; launched 2018 to replace Greyhound in northern BC"
  },
  {
    id: "health-connections",
    name: "BC Transit Health Connections",
    type: "scheduled",
    routes: [
      "Cariboo regional medical transport",
      "Fraser Canyon medical transport",
      "South Okanagan medical transport",
      "Columbia Valley medical transport",
      "West Kootenay medical transport"
    ],
    hubs: [
      { name: "Williams Lake", municipality: "Williams Lake", lat: 52.1417, lng: -122.1417 },
      { name: "Penticton", municipality: "Penticton", lat: 49.4991, lng: -119.5937 },
      { name: "Nelson", municipality: "Nelson", lat: 49.4928, lng: -117.2948 }
    ],
    website: "https://www.bctransit.com",
    notes: "Rural medical transportation for healthcare appointments"
  }
];

// ============================================================================
// BC TRANSIT SYSTEMS (by region)
// ============================================================================

export const BC_TRANSIT_SYSTEMS: TransitSystem[] = [
  // Vancouver Island
  {
    id: "victoria-regional",
    name: "Victoria Regional Transit System",
    type: "bc_transit",
    operator: "BC Transit (directly operated)",
    municipalities_served: ["Victoria", "Saanich", "Oak Bay", "Esquimalt", "View Royal", "Colwood", "Langford", "Metchosin", "Sooke", "Highlands", "Sidney", "North Saanich", "Central Saanich"],
    hub_location: { name: "Victoria Downtown Exchange", lat: 48.4284, lng: -123.3656 },
    website: "https://www.bctransit.com/victoria"
  },
  {
    id: "nanaimo-regional",
    name: "Nanaimo Regional Transit System",
    type: "municipal",
    operator: "Regional District of Nanaimo",
    municipalities_served: ["Nanaimo", "Lantzville", "Parksville", "Qualicum Beach", "Nanoose Bay"],
    hub_location: { name: "Nanaimo Downtown Exchange", lat: 49.1659, lng: -123.9401 },
    website: "https://www.bctransit.com/nanaimo"
  },
  {
    id: "comox-valley",
    name: "Comox Valley Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Courtenay", "Comox", "Cumberland"],
    hub_location: { name: "Courtenay Exchange", lat: 49.6841, lng: -124.9936 },
    website: "https://www.bctransit.com/comox-valley"
  },
  {
    id: "campbell-river",
    name: "Campbell River Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Campbell River"],
    hub_location: { name: "Campbell River Exchange", lat: 50.0244, lng: -125.2475 },
    website: "https://www.bctransit.com/campbell-river"
  },
  {
    id: "cowichan-valley",
    name: "Cowichan Valley Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Duncan", "North Cowichan", "Lake Cowichan", "Ladysmith"],
    hub_location: { name: "Duncan Exchange", lat: 48.7787, lng: -123.7079 },
    website: "https://www.bctransit.com/cowichan-valley"
  },
  {
    id: "port-alberni",
    name: "Port Alberni Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Port Alberni"],
    hub_location: { name: "Port Alberni Exchange", lat: 49.2339, lng: -124.8055 },
    website: "https://www.bctransit.com/port-alberni"
  },
  {
    id: "tofino-ucluelet",
    name: "West Coast Transit",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Tofino", "Ucluelet"],
    hub_location: { name: "Tofino", lat: 49.1530, lng: -125.9066 },
    website: "https://www.bctransit.com"
  },
  {
    id: "salt-spring",
    name: "Salt Spring Island Transit",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Salt Spring Island"],
    hub_location: { name: "Ganges", lat: 48.8548, lng: -123.5089 },
    website: "https://www.bctransit.com/salt-spring-island"
  },

  // Metro Vancouver
  {
    id: "translink",
    name: "TransLink",
    type: "translink",
    operator: "TransLink (South Coast British Columbia Transportation Authority)",
    municipalities_served: [
      "Vancouver", "Burnaby", "Richmond", "Surrey", "Delta", "Langley", "Langley Township",
      "Coquitlam", "Port Coquitlam", "Port Moody", "New Westminster", "North Vancouver City",
      "North Vancouver District", "West Vancouver", "White Rock", "Maple Ridge", "Pitt Meadows",
      "Tsawwassen First Nation", "Bowen Island", "Anmore", "Belcarra", "Lions Bay"
    ],
    hub_location: { name: "Waterfront Station", lat: 49.2856, lng: -123.1115 },
    website: "https://www.translink.ca",
    notes: "Includes SkyTrain, SeaBus, West Coast Express, buses"
  },

  // Sea-to-Sky & Coastal
  {
    id: "whistler",
    name: "Whistler Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Whistler"],
    hub_location: { name: "Whistler Village Exchange", lat: 50.1163, lng: -122.9574 },
    website: "https://www.bctransit.com/whistler"
  },
  {
    id: "squamish",
    name: "Squamish Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Squamish"],
    hub_location: { name: "Squamish Adventure Centre", lat: 49.7016, lng: -123.1558 },
    website: "https://www.bctransit.com/squamish"
  },
  {
    id: "pemberton",
    name: "Pemberton Valley Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Pemberton"],
    hub_location: { name: "Pemberton", lat: 50.3165, lng: -122.8028 },
    website: "https://www.bctransit.com/pemberton-valley"
  },
  {
    id: "sunshine-coast",
    name: "Sunshine Coast Transit System",
    type: "municipal",
    operator: "Sunshine Coast Regional District",
    municipalities_served: ["Sechelt", "Gibsons", "Halfmoon Bay", "Pender Harbour"],
    hub_location: { name: "Sechelt", lat: 49.4742, lng: -123.7545 },
    website: "https://www.bctransit.com/sunshine-coast"
  },
  {
    id: "powell-river",
    name: "Powell River Transit System",
    type: "municipal",
    operator: "City of Powell River",
    municipalities_served: ["Powell River"],
    hub_location: { name: "Powell River Town Centre", lat: 49.8353, lng: -124.5247 },
    website: "https://www.bctransit.com/powell-river"
  },

  // Okanagan
  {
    id: "kelowna-regional",
    name: "Kelowna Regional Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Kelowna", "West Kelowna", "Peachland", "Lake Country"],
    hub_location: { name: "Queensway Exchange", lat: 49.8863, lng: -119.4966 },
    website: "https://www.bctransit.com/kelowna"
  },
  {
    id: "vernon-regional",
    name: "Vernon Regional Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Vernon", "Coldstream", "Armstrong", "Enderby", "Spallumcheen"],
    hub_location: { name: "Vernon Exchange", lat: 50.2671, lng: -119.2720 },
    website: "https://www.bctransit.com/vernon"
  },
  {
    id: "penticton",
    name: "South Okanagan-Similkameen Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Penticton", "Summerland", "Oliver", "Osoyoos", "Okanagan Falls"],
    hub_location: { name: "Penticton Exchange", lat: 49.4991, lng: -119.5937 },
    website: "https://www.bctransit.com/south-okanagan-similkameen"
  },

  // Thompson-Nicola
  {
    id: "kamloops",
    name: "Kamloops Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Kamloops"],
    hub_location: { name: "Kamloops Transit Exchange", lat: 50.6745, lng: -120.3273 },
    website: "https://www.bctransit.com/kamloops"
  },
  {
    id: "merritt",
    name: "Merritt Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Merritt"],
    hub_location: { name: "Merritt", lat: 50.1113, lng: -120.7862 },
    website: "https://www.bctransit.com/merritt"
  },
  {
    id: "clearwater",
    name: "Clearwater Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Clearwater"],
    hub_location: { name: "Clearwater", lat: 51.6500, lng: -120.0333 },
    website: "https://www.bctransit.com/clearwater"
  },

  // Kootenays
  {
    id: "west-kootenay",
    name: "West Kootenay Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Nelson", "Castlegar", "Trail", "Rossland", "Fruitvale", "Warfield"],
    hub_location: { name: "Nelson Exchange", lat: 49.4928, lng: -117.2948 },
    website: "https://www.bctransit.com/west-kootenay"
  },
  {
    id: "east-kootenay",
    name: "East Kootenay Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Cranbrook", "Kimberley", "Fernie", "Sparwood", "Elkford", "Invermere", "Radium Hot Springs"],
    hub_location: { name: "Cranbrook Exchange", lat: 49.5097, lng: -115.7693 },
    website: "https://www.bctransit.com/east-kootenay"
  },
  {
    id: "creston-valley",
    name: "Creston Valley Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Creston"],
    hub_location: { name: "Creston", lat: 49.0956, lng: -116.5133 },
    website: "https://www.bctransit.com/creston-valley"
  },
  {
    id: "revelstoke",
    name: "Revelstoke Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Revelstoke"],
    hub_location: { name: "Revelstoke", lat: 51.0000, lng: -118.1953 },
    website: "https://www.bctransit.com/revelstoke"
  },

  // Cariboo
  {
    id: "williams-lake",
    name: "Williams Lake Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Williams Lake"],
    hub_location: { name: "Williams Lake", lat: 52.1417, lng: -122.1417 },
    website: "https://www.bctransit.com/williams-lake"
  },
  {
    id: "quesnel",
    name: "Quesnel Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Quesnel"],
    hub_location: { name: "Quesnel", lat: 52.9784, lng: -122.4927 },
    website: "https://www.bctransit.com/quesnel"
  },
  {
    id: "100-mile-house",
    name: "100 Mile House Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["100 Mile House"],
    hub_location: { name: "100 Mile House", lat: 51.6418, lng: -121.2929 },
    website: "https://www.bctransit.com/100-mile-house"
  },

  // Northern BC
  {
    id: "prince-george",
    name: "Prince George Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Prince George"],
    hub_location: { name: "Prince George Downtown Exchange", lat: 53.9171, lng: -122.7497 },
    website: "https://www.bctransit.com/prince-george",
    notes: "Hub for BC Bus North intercity service"
  },
  {
    id: "prince-rupert",
    name: "Prince Rupert Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Prince Rupert"],
    hub_location: { name: "Prince Rupert", lat: 54.3150, lng: -130.3208 },
    website: "https://www.bctransit.com/prince-rupert"
  },
  {
    id: "terrace",
    name: "Terrace Regional Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Terrace", "Kitimat"],
    hub_location: { name: "Terrace", lat: 54.5164, lng: -128.5997 },
    website: "https://www.bctransit.com/terrace"
  },
  {
    id: "bulkley-nechako",
    name: "Bulkley-Nechako Regional Transit",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Burns Lake", "Houston", "Smithers", "Vanderhoof", "Fort St. James", "Fraser Lake"],
    hub_location: { name: "Smithers", lat: 54.7804, lng: -127.1743 },
    website: "https://www.bctransit.com/bulkley-nechako"
  },
  {
    id: "dawson-creek",
    name: "Dawson Creek Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Dawson Creek"],
    hub_location: { name: "Dawson Creek", lat: 55.7596, lng: -120.2377 },
    website: "https://www.bctransit.com/dawson-creek"
  },
  {
    id: "fort-st-john",
    name: "Fort St. John Transit System",
    type: "bc_transit",
    operator: "BC Transit",
    municipalities_served: ["Fort St. John"],
    hub_location: { name: "Fort St. John", lat: 56.2465, lng: -120.8476 },
    website: "https://www.bctransit.com/fort-st-john"
  }
];

// ============================================================================
// CHARTER/TOUR BUS OPERATORS
// ============================================================================

export const BC_CHARTER_BUS: CharterBusOperator[] = [
  {
    id: "traxx-coachlines",
    name: "Traxx Coachlines",
    type: "charter",
    base_location: {
      municipality: "Delta",
      address: "8730 River Road",
      lat: 49.1244,
      lng: -123.0867
    },
    service_area: ["Lower Mainland", "Vancouver Island", "BC Interior", "Alberta"],
    fleet_size: "60+ motorcoaches",
    website: "https://traxxcoachlines.com",
    phone: "1-877-872-9977",
    notes: "Merged with Quick Coachlines and Vancouver Tours & Transit in 2024"
  },
  {
    id: "international-stage-lines",
    name: "International Stage Lines",
    type: "tour",
    base_location: {
      municipality: "Richmond",
      lat: 49.1666,
      lng: -123.1336
    },
    service_area: ["Vancouver", "Victoria", "Whistler", "Rocky Mountains"],
    fleet_size: "40+ motorcoaches (20-56 seats)",
    website: "https://www.istagebc.com",
    phone: "604-270-6135",
    notes: "Cruise ship transfers, Rocky Mountain tours, city tours"
  },
  {
    id: "wilson-group",
    name: "Wilson's Group of Companies",
    type: "charter",
    base_location: {
      municipality: "Victoria",
      address: "4196 Glanford Avenue",
      lat: 48.4646,
      lng: -123.3824
    },
    service_area: ["Vancouver Island", "Vancouver", "BC"],
    website: "https://www.wilsonstransportation.com",
    phone: "1-800-567-3288",
    notes: "Also operates scheduled ferry connector service"
  },
  {
    id: "cvs-tours",
    name: "CVS Tours",
    type: "tour",
    base_location: {
      municipality: "Victoria",
      address: "330 Quebec Street",
      lat: 48.4207,
      lng: -123.3716
    },
    service_area: ["Vancouver Island", "Victoria"],
    website: "https://cvstours.com",
    phone: "1-877-578-5552"
  },
  {
    id: "bluestar-coachlines",
    name: "BlueStar Coachlines",
    type: "charter",
    base_location: {
      municipality: "Kelowna",
      address: "1482 Velocity Street",
      lat: 49.8579,
      lng: -119.4788
    },
    service_area: ["Okanagan", "BC Interior"],
    website: "https://bluestarcoachlines.com",
    phone: "778-478-3866"
  },
  {
    id: "first-student",
    name: "First Student Canada",
    type: "school",
    base_location: {
      municipality: "Vancouver",
      address: "1420 Venables Street",
      lat: 49.2768,
      lng: -123.0659
    },
    service_area: ["Metro Vancouver", "Fraser Valley", "Comox Valley", "Various BC School Districts"],
    website: "https://www.firstcharterbus.com",
    phone: "604-255-3555",
    notes: "Largest school bus contractor in BC; multiple locations"
  },
  {
    id: "lynch-bus-lines",
    name: "Lynch Bus Lines",
    type: "school",
    base_location: {
      municipality: "Burnaby",
      address: "4687 Byrne Road",
      lat: 49.2194,
      lng: -122.9847
    },
    service_area: ["Metro Vancouver"],
    website: "https://www.lynchbuslines.com",
    phone: "604-439-0842"
  },
  {
    id: "perimeter-transportation",
    name: "Perimeter Transportation",
    type: "airport",
    base_location: {
      municipality: "New Westminster",
      lat: 49.2057,
      lng: -122.9110
    },
    service_area: ["Metro Vancouver", "Fraser Valley"],
    website: "https://www.perimeterbus.com",
    phone: "604-717-6600"
  },
  {
    id: "squamish-coach-lines",
    name: "Squamish Coach Lines",
    type: "charter",
    base_location: {
      municipality: "Vancouver",
      address: "8383 Manitoba Street",
      lat: 49.2088,
      lng: -123.1030
    },
    service_area: ["Sea-to-Sky", "Metro Vancouver", "Whistler"],
    website: "https://squamishcoach.com",
    phone: "604-325-8252"
  },
  {
    id: "universal-coach-line",
    name: "Universal Coach Line",
    type: "charter",
    base_location: {
      municipality: "Richmond",
      address: "128-11560 Eburne Way",
      lat: 49.1848,
      lng: -123.1291
    },
    service_area: ["Metro Vancouver", "BC"],
    website: "https://universalcoach.ca",
    phone: "604-322-7799"
  },
  {
    id: "mccullough-coach-lines",
    name: "McCullough Coach Lines",
    type: "charter",
    base_location: {
      municipality: "Vancouver",
      lat: 49.2827,
      lng: -123.1207
    },
    service_area: ["Vancouver", "Victoria", "BC"],
    website: "https://mccullough.ca",
    phone: "1-800-668-3393"
  },
  {
    id: "all-points-bus",
    name: "All Points Bus Charters",
    type: "charter",
    base_location: {
      municipality: "Hope",
      address: "677 Old Hope Princeton Way",
      lat: 49.3860,
      lng: -121.4419
    },
    service_area: ["Fraser Valley", "BC Interior"],
    phone: "1-877-869-7306"
  },
  {
    id: "academia-bus",
    name: "Academia Bus Company",
    type: "school",
    base_location: {
      municipality: "Richmond",
      address: "9291 Glenbrook Drive",
      lat: 49.1642,
      lng: -123.1050
    },
    service_area: ["Metro Vancouver"],
    website: "https://academiabuscompany.com"
  }
];

// ============================================================================
// COURIER & POSTAL SERVICES
// ============================================================================

export const BC_COURIER_SERVICES: CourierService[] = [
  // Canada Post - Complete BC Post Office Network
  {
    id: "canada-post",
    name: "Canada Post",
    type: "postal",
    facilities: [
      // === METRO VANCOUVER - Processing Plants & Hubs ===
      { name: "Vancouver Mail Processing Plant", facility_type: "hub", municipality: "Vancouver", address: "349 W Georgia St", lat: 49.2812, lng: -123.1151 },
      { name: "Richmond Processing Centre", facility_type: "hub", municipality: "Richmond", address: "4411 No. 3 Rd", lat: 49.1741, lng: -123.1369 },
      { name: "Surrey Processing Facility", facility_type: "hub", municipality: "Surrey", address: "9636 King George Blvd", lat: 49.1762, lng: -122.8475 },
      
      // === VANCOUVER ===
      { name: "Vancouver Main Post Office", facility_type: "post_office", municipality: "Vancouver", address: "349 W Georgia St", lat: 49.2812, lng: -123.1151 },
      { name: "Vancouver Bentall Centre", facility_type: "post_office", municipality: "Vancouver", address: "595 Burrard St", lat: 49.2860, lng: -123.1187 },
      { name: "Vancouver Station A", facility_type: "post_office", municipality: "Vancouver", address: "757 W Hastings St", lat: 49.2862, lng: -123.1149 },
      { name: "Vancouver Robson Square", facility_type: "post_office", municipality: "Vancouver", address: "800 Robson St", lat: 49.2818, lng: -123.1215 },
      { name: "Vancouver Yaletown", facility_type: "post_office", municipality: "Vancouver", address: "1166 Pacific Blvd", lat: 49.2748, lng: -123.1218 },
      { name: "Vancouver Granville Island", facility_type: "post_office", municipality: "Vancouver", address: "1502 Duranleau St", lat: 49.2716, lng: -123.1345 },
      { name: "Vancouver Kitsilano", facility_type: "post_office", municipality: "Vancouver", address: "2095 W 4th Ave", lat: 49.2689, lng: -123.1584 },
      { name: "Vancouver Kerrisdale", facility_type: "post_office", municipality: "Vancouver", address: "2171 W 41st Ave", lat: 49.2341, lng: -123.1575 },
      { name: "Vancouver Marpole", facility_type: "post_office", municipality: "Vancouver", address: "8495 Granville St", lat: 49.2102, lng: -123.1391 },
      { name: "Vancouver Dunbar", facility_type: "post_office", municipality: "Vancouver", address: "4467 Dunbar St", lat: 49.2486, lng: -123.1862 },
      { name: "Vancouver Point Grey", facility_type: "post_office", municipality: "Vancouver", address: "4545 W 10th Ave", lat: 49.2630, lng: -123.2055 },
      { name: "Vancouver Commercial Drive", facility_type: "post_office", municipality: "Vancouver", address: "1659 Commercial Dr", lat: 49.2695, lng: -123.0693 },
      { name: "Vancouver Hastings-Sunrise", facility_type: "post_office", municipality: "Vancouver", address: "2706 E Hastings St", lat: 49.2812, lng: -123.0413 },
      { name: "Vancouver Kensington", facility_type: "post_office", municipality: "Vancouver", address: "2419 Kingsway", lat: 49.2399, lng: -123.0595 },
      { name: "Vancouver Renfrew", facility_type: "post_office", municipality: "Vancouver", address: "2988 E 22nd Ave", lat: 49.2519, lng: -123.0354 },
      { name: "Vancouver South", facility_type: "post_office", municipality: "Vancouver", address: "6305 Fraser St", lat: 49.2251, lng: -123.0907 },
      { name: "Vancouver Oakridge", facility_type: "post_office", municipality: "Vancouver", address: "650 W 41st Ave", lat: 49.2341, lng: -123.1175 },
      { name: "Vancouver Killarney", facility_type: "post_office", municipality: "Vancouver", address: "6560 Victoria Dr", lat: 49.2241, lng: -123.0657 },
      { name: "Vancouver Champlain Heights", facility_type: "post_office", municipality: "Vancouver", address: "3161 E 54th Ave", lat: 49.2157, lng: -123.0280 },
      
      // === BURNABY ===
      { name: "Burnaby Depot", facility_type: "depot", municipality: "Burnaby", address: "6360 Halifax St", lat: 49.2624, lng: -122.9636 },
      { name: "Burnaby Metrotown", facility_type: "post_office", municipality: "Burnaby", address: "4820 Kingsway", lat: 49.2265, lng: -123.0027 },
      { name: "Burnaby Brentwood", facility_type: "post_office", municipality: "Burnaby", address: "4567 Lougheed Hwy", lat: 49.2678, lng: -123.0000 },
      { name: "Burnaby Heights", facility_type: "post_office", municipality: "Burnaby", address: "4012 Hastings St", lat: 49.2812, lng: -122.9971 },
      { name: "Burnaby North", facility_type: "post_office", municipality: "Burnaby", address: "5680 Kingsway", lat: 49.2267, lng: -122.9636 },
      { name: "Burnaby Edmonds", facility_type: "post_office", municipality: "Burnaby", address: "7488 Edmonds St", lat: 49.2125, lng: -122.9589 },
      { name: "Burnaby Lougheed", facility_type: "post_office", municipality: "Burnaby", address: "9855 Austin Rd", lat: 49.2547, lng: -122.8941 },
      
      // === RICHMOND ===
      { name: "Richmond Main", facility_type: "post_office", municipality: "Richmond", address: "5671 No. 3 Rd", lat: 49.1650, lng: -123.1369 },
      { name: "Richmond Steveston", facility_type: "post_office", municipality: "Richmond", address: "3880 Moncton St", lat: 49.1274, lng: -123.1827 },
      { name: "Richmond Ironwood", facility_type: "post_office", municipality: "Richmond", address: "11180 Coppersmith Pl", lat: 49.1445, lng: -123.0836 },
      { name: "Richmond Lansdowne", facility_type: "post_office", municipality: "Richmond", address: "6060 Minoru Blvd", lat: 49.1695, lng: -123.1363 },
      { name: "Richmond Centre", facility_type: "post_office", municipality: "Richmond", address: "6551 No. 3 Rd", lat: 49.1663, lng: -123.1369 },
      
      // === SURREY ===
      { name: "Surrey Central", facility_type: "post_office", municipality: "Surrey", address: "10355 King George Blvd", lat: 49.1881, lng: -122.8484 },
      { name: "Surrey Guildford", facility_type: "post_office", municipality: "Surrey", address: "15355 104th Ave", lat: 49.1907, lng: -122.8132 },
      { name: "Surrey Newton", facility_type: "post_office", municipality: "Surrey", address: "7228 King George Blvd", lat: 49.1386, lng: -122.8475 },
      { name: "Surrey Fleetwood", facility_type: "post_office", municipality: "Surrey", address: "8393 160th St", lat: 49.1547, lng: -122.7741 },
      { name: "Surrey Cloverdale", facility_type: "post_office", municipality: "Surrey", address: "5710 176th St", lat: 49.1041, lng: -122.7536 },
      { name: "Surrey South", facility_type: "post_office", municipality: "Surrey", address: "2429 160th St", lat: 49.0514, lng: -122.7741 },
      { name: "Surrey Panorama", facility_type: "post_office", municipality: "Surrey", address: "15157 57th Ave", lat: 49.1141, lng: -122.8139 },
      
      // === NEW WESTMINSTER ===
      { name: "New Westminster Main", facility_type: "post_office", municipality: "New Westminster", address: "628 Carnarvon St", lat: 49.2015, lng: -122.9107 },
      { name: "New Westminster Sapperton", facility_type: "post_office", municipality: "New Westminster", address: "330 E Columbia St", lat: 49.2267, lng: -122.8889 },
      { name: "New Westminster Uptown", facility_type: "post_office", municipality: "New Westminster", address: "555 6th St", lat: 49.2140, lng: -122.9107 },
      
      // === COQUITLAM / TRI-CITIES ===
      { name: "Coquitlam Depot", facility_type: "depot", municipality: "Coquitlam", address: "101-1015 Austin Ave", lat: 49.2744, lng: -122.7941 },
      { name: "Coquitlam Centre", facility_type: "post_office", municipality: "Coquitlam", address: "1163 Pinetree Way", lat: 49.2786, lng: -122.7958 },
      { name: "Coquitlam Burke Mountain", facility_type: "post_office", municipality: "Coquitlam", address: "3025 Lougheed Hwy", lat: 49.2744, lng: -122.7891 },
      { name: "Port Coquitlam Main", facility_type: "post_office", municipality: "Port Coquitlam", address: "2540 Shaughnessy St", lat: 49.2633, lng: -122.7531 },
      { name: "Port Moody Main", facility_type: "post_office", municipality: "Port Moody", address: "2401 Clarke St", lat: 49.2839, lng: -122.8317 },
      { name: "Anmore", facility_type: "post_office", municipality: "Anmore", address: "2697 Sunnyside Rd", lat: 49.3135, lng: -122.8536 },
      { name: "Belcarra", facility_type: "post_office", municipality: "Belcarra", address: "4084 Bedwell Bay Rd", lat: 49.3180, lng: -122.9227 },
      
      // === NORTH SHORE ===
      { name: "North Vancouver Main", facility_type: "post_office", municipality: "North Vancouver", address: "132 E 2nd St", lat: 49.3117, lng: -123.0752 },
      { name: "North Vancouver Lonsdale", facility_type: "post_office", municipality: "North Vancouver", address: "1277 Marine Dr", lat: 49.3132, lng: -123.0712 },
      { name: "North Vancouver Lynn Valley", facility_type: "post_office", municipality: "North Vancouver", address: "1199 Lynn Valley Rd", lat: 49.3396, lng: -123.0435 },
      { name: "North Vancouver Capilano", facility_type: "post_office", municipality: "North Vancouver", address: "935 Marine Dr", lat: 49.3204, lng: -123.1098 },
      { name: "North Vancouver Edgemont", facility_type: "post_office", municipality: "North Vancouver", address: "3195 Edgemont Blvd", lat: 49.3553, lng: -123.0721 },
      { name: "West Vancouver Main", facility_type: "post_office", municipality: "West Vancouver", address: "1564 Marine Dr", lat: 49.3259, lng: -123.1513 },
      { name: "West Vancouver Dundarave", facility_type: "post_office", municipality: "West Vancouver", address: "2459 Marine Dr", lat: 49.3351, lng: -123.1892 },
      { name: "West Vancouver Park Royal", facility_type: "post_office", municipality: "West Vancouver", address: "800 Park Royal S", lat: 49.3259, lng: -123.1356 },
      { name: "Lions Bay", facility_type: "post_office", municipality: "Lions Bay", address: "55 Bayview Rd", lat: 49.4551, lng: -123.2391 },
      { name: "Bowen Island", facility_type: "post_office", municipality: "Bowen Island", address: "432 Cardena Rd", lat: 49.3842, lng: -123.3360 },
      
      // === DELTA / LADNER / TSAWWASSEN ===
      { name: "Delta Main", facility_type: "post_office", municipality: "Delta", address: "11140 84th Ave", lat: 49.1441, lng: -122.9177 },
      { name: "Ladner", facility_type: "post_office", municipality: "Delta", address: "4949 Delta St", lat: 49.0900, lng: -123.0823 },
      { name: "Tsawwassen", facility_type: "post_office", municipality: "Delta", address: "1208 56th St", lat: 49.0159, lng: -123.0855 },
      { name: "North Delta", facility_type: "post_office", municipality: "Delta", address: "7211 120th St", lat: 49.1548, lng: -122.9053 },
      
      // === WHITE ROCK / SOUTH SURREY ===
      { name: "White Rock", facility_type: "post_office", municipality: "White Rock", address: "1569 Johnston Rd", lat: 49.0234, lng: -122.8027 },
      { name: "Crescent Beach", facility_type: "post_office", municipality: "Surrey", address: "2624 128th St", lat: 49.0541, lng: -122.8676 },
      
      // === LANGLEY ===
      { name: "Langley City", facility_type: "post_office", municipality: "Langley", address: "20339 Fraser Hwy", lat: 49.1041, lng: -122.6586 },
      { name: "Langley Willowbrook", facility_type: "post_office", municipality: "Langley", address: "6380 200th St", lat: 49.1126, lng: -122.6658 },
      { name: "Langley Walnut Grove", facility_type: "post_office", municipality: "Langley", address: "20150 88th Ave", lat: 49.1641, lng: -122.6436 },
      { name: "Langley Aldergrove", facility_type: "post_office", municipality: "Langley", address: "27127 Fraser Hwy", lat: 49.0569, lng: -122.4711 },
      { name: "Langley Fort Langley", facility_type: "post_office", municipality: "Langley", address: "9119 Glover Rd", lat: 49.1726, lng: -122.5778 },
      { name: "Langley Brookswood", facility_type: "post_office", municipality: "Langley", address: "3855 200th St", lat: 49.0741, lng: -122.6658 },
      { name: "Langley Murrayville", facility_type: "post_office", municipality: "Langley", address: "21780 48th Ave", lat: 49.0864, lng: -122.6192 },
      
      // === MAPLE RIDGE / PITT MEADOWS ===
      { name: "Maple Ridge Main", facility_type: "post_office", municipality: "Maple Ridge", address: "22463 Dewdney Trunk Rd", lat: 49.2191, lng: -122.5984 },
      { name: "Maple Ridge West", facility_type: "post_office", municipality: "Maple Ridge", address: "20395 Lougheed Hwy", lat: 49.2171, lng: -122.6533 },
      { name: "Haney", facility_type: "post_office", municipality: "Maple Ridge", address: "11850 224th St", lat: 49.2191, lng: -122.5983 },
      { name: "Pitt Meadows", facility_type: "post_office", municipality: "Pitt Meadows", address: "19150 Ford Rd", lat: 49.2331, lng: -122.6889 },
      
      // === MISSION ===
      { name: "Mission Main", facility_type: "post_office", municipality: "Mission", address: "33038 1st Ave", lat: 49.1327, lng: -122.3017 },
      { name: "Mission Cedar Valley", facility_type: "post_office", municipality: "Mission", address: "32675 Logan Ave", lat: 49.1425, lng: -122.2941 },
      
      // === FRASER VALLEY - ABBOTSFORD ===
      { name: "Abbotsford Depot", facility_type: "depot", municipality: "Abbotsford", address: "2815 Clearbrook Rd", lat: 49.0504, lng: -122.3045 },
      { name: "Abbotsford Main", facility_type: "post_office", municipality: "Abbotsford", address: "2815 Clearbrook Rd", lat: 49.0504, lng: -122.3045 },
      { name: "Abbotsford Clearbrook", facility_type: "post_office", municipality: "Abbotsford", address: "32711 South Fraser Way", lat: 49.0541, lng: -122.3233 },
      { name: "Abbotsford McCallum", facility_type: "post_office", municipality: "Abbotsford", address: "33320 S Fraser Way", lat: 49.0504, lng: -122.3045 },
      { name: "Abbotsford Sumas", facility_type: "post_office", municipality: "Abbotsford", address: "36111 Sumas Way", lat: 49.0614, lng: -122.2632 },
      { name: "Abbotsford Matsqui", facility_type: "post_office", municipality: "Abbotsford", address: "2387 Ware St", lat: 49.1141, lng: -122.3377 },
      { name: "Mt Lehman", facility_type: "rural_po", municipality: "Abbotsford", address: "5656 Mt Lehman Rd", lat: 49.0717, lng: -122.4144 },
      
      // === FRASER VALLEY - CHILLIWACK ===
      { name: "Chilliwack Depot", facility_type: "depot", municipality: "Chilliwack", address: "45585 Airport Rd", lat: 49.1518, lng: -121.9378 },
      { name: "Chilliwack Main", facility_type: "post_office", municipality: "Chilliwack", address: "45855 Wellington Ave", lat: 49.1580, lng: -121.9514 },
      { name: "Chilliwack Sardis", facility_type: "post_office", municipality: "Chilliwack", address: "45752 Patten Ave", lat: 49.0937, lng: -121.9691 },
      { name: "Chilliwack Vedder", facility_type: "post_office", municipality: "Chilliwack", address: "5725 Vedder Rd", lat: 49.0754, lng: -121.9569 },
      { name: "Chilliwack Promontory", facility_type: "post_office", municipality: "Chilliwack", address: "6049 Tyson Rd", lat: 49.0887, lng: -121.9569 },
      { name: "Yarrow", facility_type: "rural_po", municipality: "Chilliwack", address: "42473 Yarrow Central Rd", lat: 49.0741, lng: -122.0508 },
      { name: "Rosedale", facility_type: "rural_po", municipality: "Chilliwack", address: "50435 Yale Rd E", lat: 49.1818, lng: -121.7767 },
      { name: "Cultus Lake", facility_type: "rural_po", municipality: "Chilliwack", address: "3840 Columbia Valley Rd", lat: 49.0547, lng: -121.9817 },
      { name: "Agassiz", facility_type: "post_office", municipality: "Kent", address: "7027 Pioneer Ave", lat: 49.2391, lng: -121.7614 },
      { name: "Harrison Hot Springs", facility_type: "post_office", municipality: "Harrison Hot Springs", address: "155 Lillooet Ave", lat: 49.2972, lng: -121.7823 },
      
      // === FRASER VALLEY - HOPE & EAST ===
      { name: "Hope", facility_type: "post_office", municipality: "Hope", address: "560 Wallace St", lat: 49.3817, lng: -121.4419 },
      { name: "Yale", facility_type: "rural_po", municipality: "Hope", address: "31128 Douglas St", lat: 49.5611, lng: -121.4311 },
      { name: "Boston Bar", facility_type: "rural_po", municipality: "Boston Bar", address: "47591 Trans-Canada Hwy", lat: 49.8667, lng: -121.4500 },
      { name: "Lytton", facility_type: "rural_po", municipality: "Lytton", address: "441 Main St", lat: 50.2311, lng: -121.5817 },
      
      // === SEA TO SKY ===
      { name: "Squamish", facility_type: "post_office", municipality: "Squamish", address: "38129 2nd Ave", lat: 49.7016, lng: -123.1557 },
      { name: "Whistler", facility_type: "post_office", municipality: "Whistler", address: "4360 Lorimer Rd", lat: 50.1163, lng: -122.9574 },
      { name: "Whistler Village", facility_type: "post_office", municipality: "Whistler", address: "106-4295 Blackcomb Way", lat: 50.1146, lng: -122.9574 },
      { name: "Pemberton", facility_type: "post_office", municipality: "Pemberton", address: "7434 Frontier St", lat: 50.3224, lng: -122.8032 },
      { name: "D'Arcy", facility_type: "rural_po", municipality: "Pemberton", address: "7221 Portage Rd", lat: 50.5533, lng: -122.6167 },
      { name: "Lillooet", facility_type: "post_office", municipality: "Lillooet", address: "689 Main St", lat: 50.6878, lng: -121.9356 },
      { name: "Gold Bridge", facility_type: "rural_po", municipality: "Gold Bridge", address: "103 Hagensborg Rd", lat: 50.8500, lng: -122.8167 },
      
      // === SUNSHINE COAST ===
      { name: "Gibsons", facility_type: "post_office", municipality: "Gibsons", address: "566 Marine Dr", lat: 49.3973, lng: -123.5056 },
      { name: "Sechelt", facility_type: "post_office", municipality: "Sechelt", address: "5540 Inlet Ave", lat: 49.4741, lng: -123.7555 },
      { name: "Halfmoon Bay", facility_type: "rural_po", municipality: "Halfmoon Bay", address: "8893 Redrooffs Rd", lat: 49.5141, lng: -123.9121 },
      { name: "Madeira Park", facility_type: "rural_po", municipality: "Pender Harbour", address: "12889 Madeira Park Rd", lat: 49.6247, lng: -124.0231 },
      { name: "Garden Bay", facility_type: "rural_po", municipality: "Pender Harbour", address: "4546 Garden Bay Rd", lat: 49.6417, lng: -124.0500 },
      { name: "Egmont", facility_type: "rural_po", municipality: "Egmont", address: "6781 Egmont Rd", lat: 49.7517, lng: -123.9333 },
      { name: "Powell River", facility_type: "post_office", municipality: "Powell River", address: "4814 Joyce Ave", lat: 49.8344, lng: -124.5226 },
      { name: "Powell River Townsite", facility_type: "post_office", municipality: "Powell River", address: "5885 Ash Ave", lat: 49.8700, lng: -124.5496 },
      { name: "Texada Island", facility_type: "rural_po", municipality: "Powell River", address: "2716 Gillies Bay Rd", lat: 49.6917, lng: -124.5333 },
      { name: "Lund", facility_type: "rural_po", municipality: "Powell River", address: "9785 Larson Rd", lat: 49.9811, lng: -124.7630 },
      
      // === VANCOUVER ISLAND - VICTORIA REGION ===
      { name: "Victoria Letter Carrier Depot", facility_type: "depot", municipality: "Victoria", address: "714 Caledonia Ave", lat: 48.4344, lng: -123.3579 },
      { name: "Victoria Main", facility_type: "post_office", municipality: "Victoria", address: "714 Yates St", lat: 48.4284, lng: -123.3675 },
      { name: "Victoria James Bay", facility_type: "post_office", municipality: "Victoria", address: "1230 Government St", lat: 48.4161, lng: -123.3671 },
      { name: "Victoria Fairfield", facility_type: "post_office", municipality: "Victoria", address: "1555 Fairfield Rd", lat: 48.4171, lng: -123.3479 },
      { name: "Victoria Hillside", facility_type: "post_office", municipality: "Victoria", address: "1583 Hillside Ave", lat: 48.4385, lng: -123.3407 },
      { name: "Victoria Mayfair", facility_type: "post_office", municipality: "Victoria", address: "3147 Douglas St", lat: 48.4415, lng: -123.3621 },
      { name: "Oak Bay", facility_type: "post_office", municipality: "Oak Bay", address: "2200 Oak Bay Ave", lat: 48.4286, lng: -123.3197 },
      { name: "Esquimalt", facility_type: "post_office", municipality: "Esquimalt", address: "1153 Esquimalt Rd", lat: 48.4322, lng: -123.4017 },
      { name: "View Royal", facility_type: "post_office", municipality: "View Royal", address: "94 Helmcken Rd", lat: 48.4474, lng: -123.4347 },
      { name: "Colwood", facility_type: "post_office", municipality: "Colwood", address: "1913 Sooke Rd", lat: 48.4308, lng: -123.4917 },
      { name: "Langford", facility_type: "post_office", municipality: "Langford", address: "721 Station Ave", lat: 48.4491, lng: -123.5015 },
      { name: "Langford Westshore", facility_type: "post_office", municipality: "Langford", address: "2945 Jacklin Rd", lat: 48.4617, lng: -123.5089 },
      { name: "Metchosin", facility_type: "rural_po", municipality: "Metchosin", address: "4401 William Head Rd", lat: 48.3717, lng: -123.5333 },
      { name: "Sooke", facility_type: "post_office", municipality: "Sooke", address: "6726 West Coast Rd", lat: 48.3761, lng: -123.7317 },
      { name: "Jordan River", facility_type: "rural_po", municipality: "Sooke", address: "6795 West Coast Rd", lat: 48.4281, lng: -124.0350 },
      { name: "Port Renfrew", facility_type: "rural_po", municipality: "Port Renfrew", address: "17317 Parkinson Rd", lat: 48.5553, lng: -124.4217 },
      
      // === SAANICH PENINSULA ===
      { name: "Saanich Main", facility_type: "post_office", municipality: "Saanich", address: "3997 Quadra St", lat: 48.4570, lng: -123.3659 },
      { name: "Saanich Tillicum", facility_type: "post_office", municipality: "Saanich", address: "3170 Tillicum Rd", lat: 48.4525, lng: -123.3825 },
      { name: "Saanich Royal Oak", facility_type: "post_office", municipality: "Saanich", address: "4460 W Saanich Rd", lat: 48.4725, lng: -123.3870 },
      { name: "Saanich Broadmead", facility_type: "post_office", municipality: "Saanich", address: "780 Royal Oak Dr", lat: 48.4836, lng: -123.3651 },
      { name: "Saanich Cordova Bay", facility_type: "post_office", municipality: "Saanich", address: "5134 Cordova Bay Rd", lat: 48.5075, lng: -123.3621 },
      { name: "Brentwood Bay", facility_type: "post_office", municipality: "Central Saanich", address: "7103 W Saanich Rd", lat: 48.5717, lng: -123.4617 },
      { name: "Saanichton", facility_type: "post_office", municipality: "Central Saanich", address: "7816 E Saanich Rd", lat: 48.5925, lng: -123.4017 },
      { name: "Sidney", facility_type: "post_office", municipality: "Sidney", address: "9803 Third St", lat: 48.6500, lng: -123.3989 },
      { name: "North Saanich", facility_type: "rural_po", municipality: "North Saanich", address: "1180 Wain Rd", lat: 48.6867, lng: -123.4133 },
      { name: "Sidney Anacortes", facility_type: "post_office", municipality: "Sidney", address: "2537 Beacon Ave", lat: 48.6500, lng: -123.3989 },
      
      // === COWICHAN VALLEY ===
      { name: "Duncan", facility_type: "post_office", municipality: "Duncan", address: "261 Craig St", lat: 48.7830, lng: -123.7076 },
      { name: "Duncan North", facility_type: "post_office", municipality: "Duncan", address: "2785 James St", lat: 48.7917, lng: -123.7100 },
      { name: "Lake Cowichan", facility_type: "post_office", municipality: "Lake Cowichan", address: "50 South Shore Rd", lat: 48.8247, lng: -124.0536 },
      { name: "Cobble Hill", facility_type: "rural_po", municipality: "Cobble Hill", address: "1400 Fisher Rd", lat: 48.6914, lng: -123.6189 },
      { name: "Shawnigan Lake", facility_type: "rural_po", municipality: "Shawnigan Lake", address: "2740 Shawnigan Lake Rd", lat: 48.6444, lng: -123.6317 },
      { name: "Mill Bay", facility_type: "post_office", municipality: "Mill Bay", address: "2720 Mill Bay Rd", lat: 48.6508, lng: -123.5475 },
      { name: "Cowichan Bay", facility_type: "rural_po", municipality: "Cowichan Bay", address: "1761 Cowichan Bay Rd", lat: 48.7403, lng: -123.6156 },
      { name: "Chemainus", facility_type: "post_office", municipality: "North Cowichan", address: "2963 Oak St", lat: 48.9267, lng: -123.7117 },
      { name: "Crofton", facility_type: "post_office", municipality: "North Cowichan", address: "8127 York St", lat: 48.8733, lng: -123.6333 },
      { name: "Ladysmith", facility_type: "post_office", municipality: "Ladysmith", address: "310 1st Ave", lat: 48.9956, lng: -123.8178 },
      { name: "Saltair", facility_type: "rural_po", municipality: "Ladysmith", address: "10900 Chemainus Rd", lat: 48.9500, lng: -123.7667 },
      { name: "Youbou", facility_type: "rural_po", municipality: "Lake Cowichan", address: "8635 Hemlock St", lat: 48.8617, lng: -124.1833 },
      { name: "Honeymoon Bay", facility_type: "rural_po", municipality: "Lake Cowichan", address: "9815 Youbou Rd", lat: 48.8333, lng: -124.1333 },
      { name: "Mesachie Lake", facility_type: "rural_po", municipality: "Lake Cowichan", address: "8625 Macdonald Rd", lat: 48.8000, lng: -124.1167 },
      
      // === NANAIMO REGION ===
      { name: "Nanaimo Depot", facility_type: "depot", municipality: "Nanaimo", address: "35 Front St", lat: 49.1659, lng: -123.9401 },
      { name: "Nanaimo Main", facility_type: "post_office", municipality: "Nanaimo", address: "35 Front St", lat: 49.1659, lng: -123.9401 },
      { name: "Nanaimo North", facility_type: "post_office", municipality: "Nanaimo", address: "4750 Rutherford Rd", lat: 49.2141, lng: -123.9778 },
      { name: "Nanaimo Harewood", facility_type: "post_office", municipality: "Nanaimo", address: "395 Bruce Ave", lat: 49.1433, lng: -123.9667 },
      { name: "Nanaimo Departure Bay", facility_type: "post_office", municipality: "Nanaimo", address: "2655 Departure Bay Rd", lat: 49.2017, lng: -123.9617 },
      { name: "Nanaimo Woodgrove", facility_type: "post_office", municipality: "Nanaimo", address: "6945 Dickinson Rd", lat: 49.2217, lng: -124.0050 },
      { name: "Lantzville", facility_type: "rural_po", municipality: "Lantzville", address: "7213 Lantzville Rd", lat: 49.2517, lng: -124.0617 },
      { name: "Cedar", facility_type: "rural_po", municipality: "Nanaimo", address: "2106 Yellow Point Rd", lat: 49.0983, lng: -123.8783 },
      { name: "Gabriola Island", facility_type: "rural_po", municipality: "Gabriola Island", address: "575 North Rd", lat: 49.1617, lng: -123.7833 },
      { name: "Nanoose Bay", facility_type: "rural_po", municipality: "Nanoose Bay", address: "2815 Northwest Bay Rd", lat: 49.2733, lng: -124.1917 },
      
      // === PARKSVILLE / QUALICUM ===
      { name: "Parksville", facility_type: "post_office", municipality: "Parksville", address: "154 E Island Hwy", lat: 49.3172, lng: -124.3117 },
      { name: "Qualicum Beach", facility_type: "post_office", municipality: "Qualicum Beach", address: "133 2nd Ave", lat: 49.3500, lng: -124.4417 },
      { name: "Coombs", facility_type: "rural_po", municipality: "Coombs", address: "2325 Alberni Hwy", lat: 49.3033, lng: -124.4167 },
      { name: "Errington", facility_type: "rural_po", municipality: "Errington", address: "1390 Errington Rd", lat: 49.2950, lng: -124.3617 },
      { name: "Hilliers", facility_type: "rural_po", municipality: "Hilliers", address: "2520 Alberni Hwy", lat: 49.2833, lng: -124.4667 },
      { name: "Bowser", facility_type: "rural_po", municipality: "Bowser", address: "6996 Island Hwy W", lat: 49.4417, lng: -124.6833 },
      { name: "Fanny Bay", facility_type: "rural_po", municipality: "Fanny Bay", address: "7861 Island Hwy S", lat: 49.4917, lng: -124.8167 },
      
      // === PORT ALBERNI ===
      { name: "Port Alberni Main", facility_type: "post_office", municipality: "Port Alberni", address: "3761 3rd Ave", lat: 49.2331, lng: -124.8039 },
      { name: "Port Alberni Redford", facility_type: "post_office", municipality: "Port Alberni", address: "4505 Victoria Quay", lat: 49.2441, lng: -124.8089 },
      { name: "Bamfield", facility_type: "rural_po", municipality: "Bamfield", address: "100 Bamfield Rd", lat: 48.8333, lng: -125.1333 },
      { name: "Ucluelet", facility_type: "post_office", municipality: "Ucluelet", address: "1636 Peninsula Rd", lat: 48.9414, lng: -125.5459 },
      { name: "Tofino", facility_type: "post_office", municipality: "Tofino", address: "461 Campbell St", lat: 49.1531, lng: -125.9067 },
      
      // === COMOX VALLEY ===
      { name: "Courtenay Depot", facility_type: "depot", municipality: "Courtenay", address: "500 6th St", lat: 49.6874, lng: -124.9943 },
      { name: "Courtenay Main", facility_type: "post_office", municipality: "Courtenay", address: "500 6th St", lat: 49.6874, lng: -124.9943 },
      { name: "Courtenay North", facility_type: "post_office", municipality: "Courtenay", address: "2755 Cliffe Ave", lat: 49.7033, lng: -124.9940 },
      { name: "Comox", facility_type: "post_office", municipality: "Comox", address: "1791 Comox Ave", lat: 49.6717, lng: -124.9317 },
      { name: "Cumberland", facility_type: "post_office", municipality: "Cumberland", address: "2700 Dunsmuir Ave", lat: 49.6183, lng: -125.0283 },
      { name: "Union Bay", facility_type: "rural_po", municipality: "Union Bay", address: "5595 Island Hwy S", lat: 49.5833, lng: -124.8833 },
      { name: "Denman Island", facility_type: "rural_po", municipality: "Denman Island", address: "1066 Northwest Rd", lat: 49.5417, lng: -124.8167 },
      { name: "Hornby Island", facility_type: "rural_po", municipality: "Hornby Island", address: "2115 Shingle Spit Rd", lat: 49.5167, lng: -124.6333 },
      { name: "Royston", facility_type: "rural_po", municipality: "Royston", address: "2913 Royston Rd", lat: 49.6500, lng: -124.9500 },
      { name: "Merville", facility_type: "rural_po", municipality: "Merville", address: "8085 Island Hwy N", lat: 49.7500, lng: -125.0000 },
      { name: "Black Creek", facility_type: "rural_po", municipality: "Black Creek", address: "8935 Island Hwy N", lat: 49.8000, lng: -125.1167 },
      
      // === CAMPBELL RIVER ===
      { name: "Campbell River Depot", facility_type: "depot", municipality: "Campbell River", address: "1351 Shoppers Row", lat: 50.0265, lng: -125.2470 },
      { name: "Campbell River Main", facility_type: "post_office", municipality: "Campbell River", address: "1351 Shoppers Row", lat: 50.0265, lng: -125.2470 },
      { name: "Campbell River Willow Point", facility_type: "post_office", municipality: "Campbell River", address: "2800 S Island Hwy", lat: 50.0017, lng: -125.2217 },
      { name: "Quadra Island", facility_type: "rural_po", municipality: "Quadra Island", address: "675 Harper Rd", lat: 50.1167, lng: -125.2167 },
      { name: "Cortes Island", facility_type: "rural_po", municipality: "Cortes Island", address: "957 Beasley Rd", lat: 50.0667, lng: -124.9667 },
      { name: "Sayward", facility_type: "rural_po", municipality: "Sayward", address: "471 Sayward Rd", lat: 50.3833, lng: -125.9500 },
      
      // === NORTH ISLAND ===
      { name: "Port Hardy", facility_type: "post_office", municipality: "Port Hardy", address: "7085 Market St", lat: 50.7217, lng: -127.4917 },
      { name: "Port McNeill", facility_type: "post_office", municipality: "Port McNeill", address: "2060 Broughton Blvd", lat: 50.5917, lng: -127.0833 },
      { name: "Alert Bay", facility_type: "rural_po", municipality: "Alert Bay", address: "19 Fir St", lat: 50.5833, lng: -126.9167 },
      { name: "Sointula", facility_type: "rural_po", municipality: "Sointula", address: "185 1st St", lat: 50.6333, lng: -127.0000 },
      { name: "Port Alice", facility_type: "rural_po", municipality: "Port Alice", address: "1061 Marine Dr", lat: 50.3833, lng: -127.4500 },
      { name: "Coal Harbour", facility_type: "rural_po", municipality: "Coal Harbour", address: "385 Coal Harbour Rd", lat: 50.6000, lng: -127.5833 },
      { name: "Woss", facility_type: "rural_po", municipality: "Woss", address: "106 Woss Lake Rd", lat: 50.2167, lng: -126.6000 },
      { name: "Zeballos", facility_type: "rural_po", municipality: "Zeballos", address: "161 Maquinna Ave", lat: 49.9833, lng: -126.8500 },
      { name: "Tahsis", facility_type: "rural_po", municipality: "Tahsis", address: "977 S Maquinna Dr", lat: 49.9167, lng: -126.6667 },
      { name: "Gold River", facility_type: "post_office", municipality: "Gold River", address: "499 Trumpeter Dr", lat: 49.7767, lng: -126.0517 },
      
      // === GULF ISLANDS ===
      { name: "Salt Spring Island Ganges", facility_type: "post_office", municipality: "Salt Spring Island", address: "106 Lower Ganges Rd", lat: 48.8553, lng: -123.5078 },
      { name: "Salt Spring Island Fulford Harbour", facility_type: "rural_po", municipality: "Salt Spring Island", address: "2810 Fulford Ganges Rd", lat: 48.7667, lng: -123.4500 },
      { name: "Galiano Island", facility_type: "rural_po", municipality: "Galiano Island", address: "50 Sturdies Bay Rd", lat: 48.8833, lng: -123.3500 },
      { name: "Mayne Island", facility_type: "rural_po", municipality: "Mayne Island", address: "494 Fernhill Rd", lat: 48.8333, lng: -123.2833 },
      { name: "Pender Island North", facility_type: "rural_po", municipality: "Pender Island", address: "4605 Bedwell Harbour Rd", lat: 48.7833, lng: -123.2667 },
      { name: "Saturna Island", facility_type: "rural_po", municipality: "Saturna Island", address: "105 Narvaez Bay Rd", lat: 48.7833, lng: -123.1167 },
      { name: "Thetis Island", facility_type: "rural_po", municipality: "Thetis Island", address: "430 Pilkey Point Rd", lat: 49.0000, lng: -123.6833 },
      
      // === OKANAGAN - KELOWNA ===
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "591 Bernard Ave", lat: 49.8863, lng: -119.4963 },
      { name: "Kelowna Main", facility_type: "post_office", municipality: "Kelowna", address: "591 Bernard Ave", lat: 49.8863, lng: -119.4963 },
      { name: "Kelowna Orchard Park", facility_type: "post_office", municipality: "Kelowna", address: "1875 Dilworth Dr", lat: 49.8741, lng: -119.4341 },
      { name: "Kelowna Rutland", facility_type: "post_office", municipality: "Kelowna", address: "620 Rutland Rd N", lat: 49.8908, lng: -119.4017 },
      { name: "Kelowna Glenmore", facility_type: "post_office", municipality: "Kelowna", address: "437 Glenmore Rd", lat: 49.9033, lng: -119.4633 },
      { name: "Kelowna Mission", facility_type: "post_office", municipality: "Kelowna", address: "3155 Lakeshore Rd", lat: 49.8417, lng: -119.4417 },
      { name: "West Kelowna", facility_type: "post_office", municipality: "West Kelowna", address: "2484 Main St", lat: 49.8617, lng: -119.5617 },
      { name: "West Kelowna Westbank", facility_type: "post_office", municipality: "West Kelowna", address: "3737 Old Okanagan Hwy", lat: 49.8617, lng: -119.5617 },
      { name: "Peachland", facility_type: "post_office", municipality: "Peachland", address: "5711 Beach Ave", lat: 49.7747, lng: -119.7286 },
      { name: "Lake Country", facility_type: "post_office", municipality: "Lake Country", address: "9967 Main St", lat: 50.0417, lng: -119.4167 },
      { name: "Winfield", facility_type: "post_office", municipality: "Lake Country", address: "10141 Bottom Wood Lake Rd", lat: 50.0417, lng: -119.4167 },
      { name: "Oyama", facility_type: "rural_po", municipality: "Lake Country", address: "14910 Oyama Rd", lat: 50.1167, lng: -119.3667 },
      
      // === OKANAGAN - VERNON ===
      { name: "Vernon Depot", facility_type: "depot", municipality: "Vernon", address: "3101 32nd St", lat: 50.2671, lng: -119.2720 },
      { name: "Vernon Main", facility_type: "post_office", municipality: "Vernon", address: "3101 32nd St", lat: 50.2671, lng: -119.2720 },
      { name: "Vernon North", facility_type: "post_office", municipality: "Vernon", address: "5203 48th Ave", lat: 50.2917, lng: -119.2700 },
      { name: "Coldstream", facility_type: "post_office", municipality: "Coldstream", address: "10027 Kalamalka Rd", lat: 50.2267, lng: -119.1833 },
      { name: "Lumby", facility_type: "post_office", municipality: "Lumby", address: "2101 Vernon St", lat: 50.2533, lng: -118.9633 },
      { name: "Cherryville", facility_type: "rural_po", municipality: "Cherryville", address: "4041 Hwy 6", lat: 50.2000, lng: -118.6333 },
      { name: "Lavington", facility_type: "rural_po", municipality: "Lavington", address: "10200 Tronson Rd", lat: 50.1833, lng: -119.0833 },
      { name: "Armstrong", facility_type: "post_office", municipality: "Armstrong", address: "3426 Okanagan St", lat: 50.4481, lng: -119.1972 },
      { name: "Spallumcheen", facility_type: "rural_po", municipality: "Spallumcheen", address: "4144 Spallumcheen Way", lat: 50.4333, lng: -119.1833 },
      { name: "Enderby", facility_type: "post_office", municipality: "Enderby", address: "701 Mill Ave", lat: 50.5500, lng: -119.1500 },
      { name: "Grindrod", facility_type: "rural_po", municipality: "Grindrod", address: "1721 Grindrod Rd", lat: 50.6167, lng: -119.1000 },
      { name: "Falkland", facility_type: "rural_po", municipality: "Falkland", address: "5591 97 Hwy", lat: 50.4833, lng: -119.5500 },
      
      // === OKANAGAN - PENTICTON ===
      { name: "Penticton Depot", facility_type: "depot", municipality: "Penticton", address: "56 Front St", lat: 49.4991, lng: -119.5937 },
      { name: "Penticton Main", facility_type: "post_office", municipality: "Penticton", address: "56 Front St", lat: 49.4991, lng: -119.5937 },
      { name: "Penticton West", facility_type: "post_office", municipality: "Penticton", address: "1301 Main St", lat: 49.4941, lng: -119.6017 },
      { name: "Summerland", facility_type: "post_office", municipality: "Summerland", address: "13211 Henry Ave", lat: 49.6008, lng: -119.6656 },
      { name: "Naramata", facility_type: "rural_po", municipality: "Naramata", address: "195 Robinson Ave", lat: 49.5667, lng: -119.5833 },
      { name: "Kaleden", facility_type: "rural_po", municipality: "Kaleden", address: "149 Ponderosa Ave", lat: 49.4000, lng: -119.6000 },
      { name: "Okanagan Falls", facility_type: "post_office", municipality: "Okanagan Falls", address: "5064 9th Ave", lat: 49.3433, lng: -119.5617 },
      { name: "Oliver", facility_type: "post_office", municipality: "Oliver", address: "36011 97 Hwy", lat: 49.1833, lng: -119.5500 },
      { name: "Osoyoos", facility_type: "post_office", municipality: "Osoyoos", address: "8523 Main St", lat: 49.0328, lng: -119.4672 },
      { name: "Keremeos", facility_type: "post_office", municipality: "Keremeos", address: "629 7th Ave", lat: 49.2017, lng: -119.8317 },
      { name: "Cawston", facility_type: "rural_po", municipality: "Cawston", address: "2211 Barcelo Rd", lat: 49.1667, lng: -119.7500 },
      { name: "Hedley", facility_type: "rural_po", municipality: "Hedley", address: "713 Scott Ave", lat: 49.3500, lng: -120.0833 },
      { name: "Princeton", facility_type: "post_office", municipality: "Princeton", address: "149 Bridge St", lat: 49.4589, lng: -120.5067 },
      { name: "Tulameen", facility_type: "rural_po", municipality: "Tulameen", address: "414 Coalmont Rd", lat: 49.4833, lng: -120.8000 },
      { name: "Coalmont", facility_type: "rural_po", municipality: "Coalmont", address: "4200 Coalmont Rd", lat: 49.5000, lng: -120.8667 },
      
      // === THOMPSON - KAMLOOPS ===
      { name: "Kamloops Depot", facility_type: "depot", municipality: "Kamloops", address: "301 Seymour St", lat: 50.6745, lng: -120.3273 },
      { name: "Kamloops Main", facility_type: "post_office", municipality: "Kamloops", address: "301 Seymour St", lat: 50.6745, lng: -120.3273 },
      { name: "Kamloops North Shore", facility_type: "post_office", municipality: "Kamloops", address: "700 Tranquille Rd", lat: 50.6941, lng: -120.3617 },
      { name: "Kamloops Sahali", facility_type: "post_office", municipality: "Kamloops", address: "945 Columbia St", lat: 50.6917, lng: -120.3417 },
      { name: "Kamloops Aberdeen", facility_type: "post_office", municipality: "Kamloops", address: "1800 Versatile Dr", lat: 50.7117, lng: -120.3617 },
      { name: "Kamloops Brocklehurst", facility_type: "post_office", municipality: "Kamloops", address: "1820 Versatile Dr", lat: 50.7117, lng: -120.3617 },
      { name: "Kamloops Valleyview", facility_type: "post_office", municipality: "Kamloops", address: "2121 E Trans Canada Hwy", lat: 50.6600, lng: -120.2817 },
      { name: "Barriere", facility_type: "post_office", municipality: "Barriere", address: "4536 Barriere Town Rd", lat: 51.1833, lng: -120.1333 },
      { name: "Clearwater", facility_type: "post_office", municipality: "Clearwater", address: "419 E Yellowhead Hwy 5", lat: 51.6500, lng: -120.0333 },
      { name: "Blue River", facility_type: "rural_po", municipality: "Blue River", address: "814 Herb Bilton Way", lat: 52.1167, lng: -119.2833 },
      { name: "Vavenby", facility_type: "rural_po", municipality: "Vavenby", address: "1250 Vavenby Bridge Rd", lat: 51.5667, lng: -119.7500 },
      { name: "Avola", facility_type: "rural_po", municipality: "Avola", address: "2015 Yellowhead Hwy S", lat: 51.7333, lng: -119.3667 },
      { name: "Chase", facility_type: "post_office", municipality: "Chase", address: "584 Shuswap Ave", lat: 50.8197, lng: -119.6856 },
      { name: "Sorrento", facility_type: "rural_po", municipality: "Sorrento", address: "1190 Trans Canada Hwy", lat: 50.8833, lng: -119.4833 },
      { name: "Blind Bay", facility_type: "rural_po", municipality: "Blind Bay", address: "2479 Blind Bay Rd", lat: 50.9167, lng: -119.3833 },
      { name: "Logan Lake", facility_type: "post_office", municipality: "Logan Lake", address: "1 Chartrand Ave", lat: 50.4917, lng: -120.8167 },
      { name: "Savona", facility_type: "rural_po", municipality: "Savona", address: "6654 Trans Canada Hwy", lat: 50.7533, lng: -120.8500 },
      { name: "Ashcroft", facility_type: "post_office", municipality: "Ashcroft", address: "320 Railway Ave", lat: 50.7261, lng: -121.2811 },
      { name: "Cache Creek", facility_type: "post_office", municipality: "Cache Creek", address: "1270 Stage Rd", lat: 50.8108, lng: -121.3256 },
      { name: "Clinton", facility_type: "post_office", municipality: "Clinton", address: "1418 Cariboo Hwy", lat: 51.0917, lng: -121.5833 },
      { name: "70 Mile House", facility_type: "rural_po", municipality: "70 Mile House", address: "1535 N Green Lake Rd", lat: 51.3000, lng: -121.4333 },
      { name: "100 Mile House", facility_type: "post_office", municipality: "100 Mile House", address: "177 Birch Ave", lat: 51.6417, lng: -121.2917 },
      { name: "108 Mile Ranch", facility_type: "rural_po", municipality: "108 Mile Ranch", address: "4816 Telqua Dr", lat: 51.7333, lng: -121.3500 },
      { name: "Lac La Hache", facility_type: "rural_po", municipality: "Lac La Hache", address: "4341 Cariboo Hwy", lat: 51.8333, lng: -121.5167 },
      { name: "150 Mile House", facility_type: "rural_po", municipality: "150 Mile House", address: "3054 Cariboo Hwy", lat: 52.0833, lng: -122.0333 },
      
      // === SHUSWAP ===
      { name: "Salmon Arm", facility_type: "post_office", municipality: "Salmon Arm", address: "301 Hudson Ave NE", lat: 50.7022, lng: -119.2722 },
      { name: "Salmon Arm West", facility_type: "post_office", municipality: "Salmon Arm", address: "1400 10th Ave SW", lat: 50.7022, lng: -119.2858 },
      { name: "Sicamous", facility_type: "post_office", municipality: "Sicamous", address: "446 Main St", lat: 50.8372, lng: -118.9744 },
      { name: "Malakwa", facility_type: "rural_po", municipality: "Malakwa", address: "3175 Trans Canada Hwy", lat: 50.9500, lng: -118.9000 },
      { name: "Revelstoke", facility_type: "post_office", municipality: "Revelstoke", address: "301 3rd St W", lat: 50.9981, lng: -118.1953 },
      { name: "Canoe", facility_type: "rural_po", municipality: "Salmon Arm", address: "2111 Trans Canada Hwy NE", lat: 50.7833, lng: -119.2167 },
      { name: "Tappen", facility_type: "rural_po", municipality: "Tappen", address: "5051 Tappen Main St", lat: 50.7667, lng: -119.4000 },
      { name: "Scotch Creek", facility_type: "rural_po", municipality: "Scotch Creek", address: "4016 Squilax Anglemont Rd", lat: 50.8833, lng: -119.5833 },
      { name: "Lee Creek", facility_type: "rural_po", municipality: "Lee Creek", address: "5581 Shuswap Rd", lat: 50.8667, lng: -119.6833 },
      { name: "Anglemont", facility_type: "rural_po", municipality: "Anglemont", address: "7621 Anglemont Dr", lat: 50.9500, lng: -119.1833 },
      
      // === KOOTENAY - NELSON / CASTLEGAR / TRAIL ===
      { name: "Nelson Depot", facility_type: "depot", municipality: "Nelson", address: "514 Vernon St", lat: 49.4928, lng: -117.2948 },
      { name: "Nelson Main", facility_type: "post_office", municipality: "Nelson", address: "514 Vernon St", lat: 49.4928, lng: -117.2948 },
      { name: "Nelson Fairview", facility_type: "post_office", municipality: "Nelson", address: "101 McDonald Dr", lat: 49.4928, lng: -117.2948 },
      { name: "Castlegar", facility_type: "post_office", municipality: "Castlegar", address: "695 18th St", lat: 49.3250, lng: -117.6617 },
      { name: "Trail Depot", facility_type: "depot", municipality: "Trail", address: "1199 Bay Ave", lat: 49.0963, lng: -117.7111 },
      { name: "Trail Main", facility_type: "post_office", municipality: "Trail", address: "1199 Bay Ave", lat: 49.0963, lng: -117.7111 },
      { name: "Rossland", facility_type: "post_office", municipality: "Rossland", address: "2081 Washington St", lat: 49.0789, lng: -117.8003 },
      { name: "Fruitvale", facility_type: "post_office", municipality: "Fruitvale", address: "1995 Columbia Ave", lat: 49.1158, lng: -117.5508 },
      { name: "Montrose", facility_type: "rural_po", municipality: "Montrose", address: "840 6th Ave", lat: 49.1167, lng: -117.6000 },
      { name: "Warfield", facility_type: "rural_po", municipality: "Warfield", address: "645 Schofield Hwy", lat: 49.1000, lng: -117.7333 },
      { name: "Salmo", facility_type: "post_office", municipality: "Salmo", address: "323 Railway Ave", lat: 49.1922, lng: -117.2750 },
      { name: "Ymir", facility_type: "rural_po", municipality: "Ymir", address: "217 Ymir Rd", lat: 49.2833, lng: -117.2000 },
      { name: "Creston", facility_type: "post_office", municipality: "Creston", address: "113 10th Ave N", lat: 49.0950, lng: -116.5133 },
      { name: "Wynndel", facility_type: "rural_po", municipality: "Wynndel", address: "3525 Wynndel Rd", lat: 49.1667, lng: -116.5667 },
      { name: "Crawford Bay", facility_type: "rural_po", municipality: "Crawford Bay", address: "16234 Crawford Creek Rd", lat: 49.6333, lng: -116.8167 },
      { name: "Riondel", facility_type: "rural_po", municipality: "Riondel", address: "1614 Park Ave", lat: 49.7333, lng: -116.8167 },
      { name: "Kaslo", facility_type: "post_office", municipality: "Kaslo", address: "413 4th St", lat: 49.9136, lng: -116.9139 },
      { name: "New Denver", facility_type: "post_office", municipality: "New Denver", address: "516 6th Ave", lat: 49.9933, lng: -117.3767 },
      { name: "Silverton", facility_type: "rural_po", municipality: "Silverton", address: "209 Lake Ave", lat: 49.9500, lng: -117.3833 },
      { name: "Nakusp", facility_type: "post_office", municipality: "Nakusp", address: "309 Broadway St", lat: 50.2417, lng: -117.8017 },
      { name: "Fauquier", facility_type: "rural_po", municipality: "Fauquier", address: "205 Fauquier St", lat: 49.9500, lng: -118.0667 },
      { name: "Edgewood", facility_type: "rural_po", municipality: "Edgewood", address: "306 Monashee Ave", lat: 49.8333, lng: -118.1500 },
      { name: "Slocan", facility_type: "rural_po", municipality: "Slocan", address: "503 Slocan St", lat: 49.7667, lng: -117.4667 },
      { name: "Slocan Park", facility_type: "rural_po", municipality: "Slocan Park", address: "3014 Slocan River Rd", lat: 49.6333, lng: -117.4333 },
      { name: "Winlaw", facility_type: "rural_po", municipality: "Winlaw", address: "5690 Hwy 6", lat: 49.6667, lng: -117.4667 },
      
      // === KOOTENAY - CRANBROOK / FERNIE ===
      { name: "Cranbrook Depot", facility_type: "depot", municipality: "Cranbrook", address: "102 11th Ave S", lat: 49.5097, lng: -115.7686 },
      { name: "Cranbrook Main", facility_type: "post_office", municipality: "Cranbrook", address: "102 11th Ave S", lat: 49.5097, lng: -115.7686 },
      { name: "Cranbrook Tamarack", facility_type: "post_office", municipality: "Cranbrook", address: "1500 2nd St N", lat: 49.5197, lng: -115.7686 },
      { name: "Kimberley", facility_type: "post_office", municipality: "Kimberley", address: "145 Spokane St", lat: 49.6697, lng: -115.9775 },
      { name: "Marysville", facility_type: "rural_po", municipality: "Kimberley", address: "1200 304th St", lat: 49.6500, lng: -115.9833 },
      { name: "Fernie", facility_type: "post_office", municipality: "Fernie", address: "491 3rd Ave", lat: 49.5039, lng: -115.0633 },
      { name: "Sparwood", facility_type: "post_office", municipality: "Sparwood", address: "103 Aspen Dr", lat: 49.7328, lng: -114.8856 },
      { name: "Elkford", facility_type: "post_office", municipality: "Elkford", address: "816 Michel Rd", lat: 50.0233, lng: -114.9217 },
      { name: "Jaffray", facility_type: "rural_po", municipality: "Jaffray", address: "7950 Jaffray Rd", lat: 49.3667, lng: -115.2500 },
      { name: "Fort Steele", facility_type: "rural_po", municipality: "Fort Steele", address: "9851 Fort Steele Rd", lat: 49.6167, lng: -115.6167 },
      { name: "Wasa", facility_type: "rural_po", municipality: "Wasa", address: "5435 Wasa Lake Park Dr", lat: 49.7833, lng: -115.7500 },
      { name: "Moyie", facility_type: "rural_po", municipality: "Moyie", address: "164 Munro Ave", lat: 49.2667, lng: -115.8167 },
      { name: "Yahk", facility_type: "rural_po", municipality: "Yahk", address: "8813 Hwy 3", lat: 49.0833, lng: -116.0833 },
      
      // === KOOTENAY - INVERMERE / GOLDEN ===
      { name: "Invermere", facility_type: "post_office", municipality: "Invermere", address: "507 7th Ave", lat: 50.5064, lng: -116.0319 },
      { name: "Radium Hot Springs", facility_type: "post_office", municipality: "Radium Hot Springs", address: "7549 Main St W", lat: 50.6197, lng: -116.0694 },
      { name: "Windermere", facility_type: "rural_po", municipality: "Windermere", address: "1696 Kootenay St N", lat: 50.4667, lng: -115.9833 },
      { name: "Fairmont Hot Springs", facility_type: "rural_po", municipality: "Fairmont Hot Springs", address: "5237 Fairmont Resort Rd", lat: 50.3500, lng: -115.8667 },
      { name: "Canal Flats", facility_type: "rural_po", municipality: "Canal Flats", address: "4920 Grainger Rd", lat: 50.1500, lng: -115.8167 },
      { name: "Golden", facility_type: "post_office", municipality: "Golden", address: "500 9th Ave N", lat: 51.2989, lng: -116.9631 },
      { name: "Field", facility_type: "rural_po", municipality: "Field", address: "100 Centre St", lat: 51.3983, lng: -116.4867 },
      { name: "Parson", facility_type: "rural_po", municipality: "Parson", address: "4780 Hwy 95", lat: 51.1500, lng: -116.6333 },
      { name: "Brisco", facility_type: "rural_po", municipality: "Brisco", address: "8025 Westside Rd", lat: 50.8333, lng: -116.2667 },
      { name: "Spillimacheen", facility_type: "rural_po", municipality: "Spillimacheen", address: "9001 Spillimacheen Forest Rd", lat: 50.9167, lng: -116.4167 },
      
      // === CARIBOO - WILLIAMS LAKE / QUESNEL ===
      { name: "Williams Lake Depot", facility_type: "depot", municipality: "Williams Lake", address: "42 2nd Ave S", lat: 52.1417, lng: -122.1417 },
      { name: "Williams Lake Main", facility_type: "post_office", municipality: "Williams Lake", address: "42 2nd Ave S", lat: 52.1417, lng: -122.1417 },
      { name: "Williams Lake Cariboo", facility_type: "post_office", municipality: "Williams Lake", address: "220 Oliver St", lat: 52.1417, lng: -122.1417 },
      { name: "Quesnel Depot", facility_type: "depot", municipality: "Quesnel", address: "350 Reid St", lat: 52.9784, lng: -122.4927 },
      { name: "Quesnel Main", facility_type: "post_office", municipality: "Quesnel", address: "350 Reid St", lat: 52.9784, lng: -122.4927 },
      { name: "Quesnel North", facility_type: "post_office", municipality: "Quesnel", address: "280 North Star Rd", lat: 53.0017, lng: -122.5017 },
      { name: "Alexis Creek", facility_type: "rural_po", municipality: "Alexis Creek", address: "6100 Chilcotin Rd", lat: 52.0667, lng: -123.2667 },
      { name: "Anahim Lake", facility_type: "rural_po", municipality: "Anahim Lake", address: "10001 Frontier St", lat: 52.4500, lng: -125.2833 },
      { name: "Bella Coola", facility_type: "post_office", municipality: "Bella Coola", address: "994 Mackenzie St", lat: 52.3742, lng: -126.7533 },
      { name: "Hagensborg", facility_type: "rural_po", municipality: "Hagensborg", address: "1675 Hwy 20", lat: 52.3833, lng: -126.5500 },
      { name: "Firvale", facility_type: "rural_po", municipality: "Firvale", address: "5200 Hwy 20", lat: 52.4000, lng: -126.3333 },
      { name: "Horsefly", facility_type: "rural_po", municipality: "Horsefly", address: "6025 Horsefly Rd", lat: 52.3500, lng: -121.4167 },
      { name: "Likely", facility_type: "rural_po", municipality: "Likely", address: "6052 Likely Rd", lat: 52.6000, lng: -121.5333 },
      { name: "Big Lake Ranch", facility_type: "rural_po", municipality: "Big Lake Ranch", address: "5520 Big Lake Rd", lat: 52.0167, lng: -122.5167 },
      { name: "Tatla Lake", facility_type: "rural_po", municipality: "Tatla Lake", address: "7320 Chilcotin Hwy", lat: 52.0667, lng: -124.4000 },
      { name: "Nimpo Lake", facility_type: "rural_po", municipality: "Nimpo Lake", address: "8010 Charlotte Lake Rd", lat: 52.4667, lng: -125.0500 },
      { name: "Riske Creek", facility_type: "rural_po", municipality: "Riske Creek", address: "5215 Chilcotin Rd", lat: 52.0333, lng: -122.5167 },
      { name: "Nazko", facility_type: "rural_po", municipality: "Nazko", address: "5055 Nazko Rd", lat: 52.8833, lng: -123.5833 },
      { name: "Wells", facility_type: "rural_po", municipality: "Wells", address: "11954 Barkerville Hwy", lat: 53.1167, lng: -121.5500 },
      { name: "Barkerville", facility_type: "rural_po", municipality: "Barkerville", address: "14101 Barkerville Hwy", lat: 53.0667, lng: -121.5167 },
      { name: "McLeese Lake", facility_type: "rural_po", municipality: "McLeese Lake", address: "5420 Hwy 97", lat: 52.4000, lng: -122.3167 },
      { name: "Soda Creek", facility_type: "rural_po", municipality: "Soda Creek", address: "5090 Soda Creek Rd", lat: 52.4333, lng: -122.2667 },
      
      // === PRINCE GEORGE REGION ===
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "1323 5th Ave", lat: 53.9171, lng: -122.7497 },
      { name: "Prince George Main", facility_type: "post_office", municipality: "Prince George", address: "1323 5th Ave", lat: 53.9171, lng: -122.7497 },
      { name: "Prince George Parkwood", facility_type: "post_office", municipality: "Prince George", address: "1600 15th Ave", lat: 53.9117, lng: -122.7617 },
      { name: "Prince George Hart Centre", facility_type: "post_office", municipality: "Prince George", address: "6834 Hwy 97 N", lat: 53.9517, lng: -122.7917 },
      { name: "Prince George College Heights", facility_type: "post_office", municipality: "Prince George", address: "6195 University Way", lat: 53.8933, lng: -122.8183 },
      { name: "Prince George Pine Centre", facility_type: "post_office", municipality: "Prince George", address: "3055 Massey Dr", lat: 53.8917, lng: -122.8083 },
      { name: "Vanderhoof", facility_type: "post_office", municipality: "Vanderhoof", address: "2580 Burrard Ave", lat: 54.0167, lng: -124.0000 },
      { name: "Fort St James", facility_type: "post_office", municipality: "Fort St. James", address: "287 Stuart Dr W", lat: 54.4431, lng: -124.2536 },
      { name: "Fraser Lake", facility_type: "post_office", municipality: "Fraser Lake", address: "146 Endako Ave", lat: 54.0500, lng: -124.8500 },
      { name: "Burns Lake", facility_type: "post_office", municipality: "Burns Lake", address: "142 3rd Ave", lat: 54.2306, lng: -125.7589 },
      { name: "Houston", facility_type: "post_office", municipality: "Houston", address: "3301 Pearson Place", lat: 54.3967, lng: -126.6483 },
      { name: "Smithers", facility_type: "post_office", municipality: "Smithers", address: "1150 Main St", lat: 54.7806, lng: -127.1750 },
      { name: "Telkwa", facility_type: "rural_po", municipality: "Telkwa", address: "1155 Riverside St", lat: 54.6833, lng: -127.0500 },
      { name: "Granisle", facility_type: "rural_po", municipality: "Granisle", address: "11 Centre St", lat: 54.8833, lng: -126.2167 },
      { name: "Topley", facility_type: "rural_po", municipality: "Topley", address: "3060 Topley Rd", lat: 54.5000, lng: -126.3333 },
      { name: "McBride", facility_type: "post_office", municipality: "McBride", address: "1035 5th Ave", lat: 53.3000, lng: -120.1667 },
      { name: "Valemount", facility_type: "post_office", municipality: "Valemount", address: "1225 5th Ave", lat: 52.8294, lng: -119.2631 },
      { name: "Mackenzie", facility_type: "post_office", municipality: "Mackenzie", address: "700 Mackenzie Blvd", lat: 55.3333, lng: -123.0833 },
      { name: "Bear Lake", facility_type: "rural_po", municipality: "Bear Lake", address: "4025 Hart Hwy", lat: 54.4833, lng: -122.5167 },
      { name: "Hixon", facility_type: "rural_po", municipality: "Hixon", address: "35235 Hwy 97 S", lat: 53.5000, lng: -122.5833 },
      
      // === PEACE RIVER ===
      { name: "Fort St John Depot", facility_type: "depot", municipality: "Fort St. John", address: "10631 100th St", lat: 56.2465, lng: -120.8476 },
      { name: "Fort St John Main", facility_type: "post_office", municipality: "Fort St. John", address: "10631 100th St", lat: 56.2465, lng: -120.8476 },
      { name: "Fort St John Southgate", facility_type: "post_office", municipality: "Fort St. John", address: "9820 100th Ave", lat: 56.2365, lng: -120.8476 },
      { name: "Dawson Creek Depot", facility_type: "depot", municipality: "Dawson Creek", address: "901 102nd Ave", lat: 55.7596, lng: -120.2377 },
      { name: "Dawson Creek Main", facility_type: "post_office", municipality: "Dawson Creek", address: "901 102nd Ave", lat: 55.7596, lng: -120.2377 },
      { name: "Chetwynd", facility_type: "post_office", municipality: "Chetwynd", address: "5020 53rd Ave", lat: 55.6983, lng: -121.6333 },
      { name: "Hudson's Hope", facility_type: "post_office", municipality: "Hudson's Hope", address: "10409 Dudley Dr", lat: 56.0306, lng: -121.9083 },
      { name: "Fort Nelson", facility_type: "post_office", municipality: "Fort Nelson", address: "5303 50th Ave S", lat: 58.8050, lng: -122.6972 },
      { name: "Tumbler Ridge", facility_type: "post_office", municipality: "Tumbler Ridge", address: "205 Founders St", lat: 55.1300, lng: -120.9950 },
      { name: "Pouce Coupe", facility_type: "rural_po", municipality: "Pouce Coupe", address: "5100 50th Ave", lat: 55.7167, lng: -120.1333 },
      { name: "Taylor", facility_type: "post_office", municipality: "Taylor", address: "10003 98th St", lat: 56.1567, lng: -120.6867 },
      { name: "Charlie Lake", facility_type: "rural_po", municipality: "Charlie Lake", address: "13420 Charlie Lake Cres", lat: 56.3000, lng: -120.9667 },
      { name: "Buick Creek", facility_type: "rural_po", municipality: "Buick Creek", address: "20785 Buick Creek Rd", lat: 55.6333, lng: -120.5333 },
      { name: "Tomslake", facility_type: "rural_po", municipality: "Tomslake", address: "13280 Tomslake Rd", lat: 55.4500, lng: -120.1000 },
      { name: "Groundbirch", facility_type: "rural_po", municipality: "Groundbirch", address: "7365 Jackpine Rd", lat: 55.3667, lng: -121.0500 },
      { name: "Farmington", facility_type: "rural_po", municipality: "Farmington", address: "7280 Farmington Rd", lat: 55.5833, lng: -119.9667 },
      { name: "Prespatou", facility_type: "rural_po", municipality: "Prespatou", address: "170 Prespatou Rd", lat: 57.0500, lng: -121.5333 },
      { name: "Pink Mountain", facility_type: "rural_po", municipality: "Pink Mountain", address: "Mile 147 Alaska Hwy", lat: 57.0333, lng: -122.4333 },
      { name: "Wonowon", facility_type: "rural_po", municipality: "Wonowon", address: "Mile 101 Alaska Hwy", lat: 56.7167, lng: -121.7833 },
      { name: "Toad River", facility_type: "rural_po", municipality: "Toad River", address: "Mile 422 Alaska Hwy", lat: 59.1833, lng: -126.1167 },
      { name: "Liard River", facility_type: "rural_po", municipality: "Liard River", address: "Mile 496 Alaska Hwy", lat: 59.4167, lng: -126.1000 },
      
      // === NORTHWEST BC - TERRACE / KITIMAT / PRINCE RUPERT ===
      { name: "Terrace Depot", facility_type: "depot", municipality: "Terrace", address: "3232 Emerson St", lat: 54.5182, lng: -128.6033 },
      { name: "Terrace Main", facility_type: "post_office", municipality: "Terrace", address: "3232 Emerson St", lat: 54.5182, lng: -128.6033 },
      { name: "Terrace Skeena", facility_type: "post_office", municipality: "Terrace", address: "4716 Lazelle Ave", lat: 54.5182, lng: -128.5917 },
      { name: "Kitimat", facility_type: "post_office", municipality: "Kitimat", address: "290 City Centre", lat: 54.0522, lng: -128.6536 },
      { name: "Prince Rupert Depot", facility_type: "depot", municipality: "Prince Rupert", address: "200 2nd Ave W", lat: 54.3150, lng: -130.3208 },
      { name: "Prince Rupert Main", facility_type: "post_office", municipality: "Prince Rupert", address: "200 2nd Ave W", lat: 54.3150, lng: -130.3208 },
      { name: "Hazelton", facility_type: "post_office", municipality: "Hazelton", address: "4305 Field St", lat: 55.2500, lng: -127.6667 },
      { name: "New Hazelton", facility_type: "post_office", municipality: "New Hazelton", address: "3319 Bowser St", lat: 55.2500, lng: -127.5833 },
      { name: "Moricetown", facility_type: "rural_po", municipality: "Moricetown", address: "3185 Hwy 16", lat: 55.1000, lng: -127.2333 },
      { name: "Cedarvale", facility_type: "rural_po", municipality: "Cedarvale", address: "4020 Cedarvale Rd", lat: 55.0167, lng: -128.2833 },
      { name: "Kitwanga", facility_type: "rural_po", municipality: "Kitwanga", address: "1395 Hwy 37", lat: 55.1000, lng: -128.0167 },
      { name: "Stewart", facility_type: "post_office", municipality: "Stewart", address: "603 5th Ave", lat: 55.9392, lng: -129.9900 },
      { name: "Queen Charlotte", facility_type: "post_office", municipality: "Queen Charlotte", address: "103 2nd Ave", lat: 53.2522, lng: -132.0739 },
      { name: "Masset", facility_type: "post_office", municipality: "Masset", address: "1609 Collison Ave", lat: 54.0167, lng: -132.1500 },
      { name: "Sandspit", facility_type: "rural_po", municipality: "Sandspit", address: "115 Airport Rd", lat: 53.2500, lng: -131.8167 },
      { name: "Tlell", facility_type: "rural_po", municipality: "Tlell", address: "385 Beitush Rd", lat: 53.5667, lng: -131.9333 },
      { name: "Port Edward", facility_type: "rural_po", municipality: "Port Edward", address: "770 Pacific Ave", lat: 54.2333, lng: -130.2833 },
      { name: "Atlin", facility_type: "rural_po", municipality: "Atlin", address: "105 1st St", lat: 59.5667, lng: -133.7000 },
      { name: "Telegraph Creek", facility_type: "rural_po", municipality: "Telegraph Creek", address: "Stikine Dr", lat: 57.9000, lng: -131.1500 },
      { name: "Dease Lake", facility_type: "rural_po", municipality: "Dease Lake", address: "37024 Hwy 37", lat: 58.4333, lng: -130.0333 },
      { name: "Iskut", facility_type: "rural_po", municipality: "Iskut", address: "Hwy 37", lat: 57.8333, lng: -129.9833 },
      { name: "Good Hope Lake", facility_type: "rural_po", municipality: "Good Hope Lake", address: "Cassiar Hwy", lat: 59.3500, lng: -129.1833 },
      
      // ============================================================================
      // FRANCHISE RETAIL OUTLETS (Canada Post counters in pharmacies & retailers)
      // ============================================================================
      
      // Metro Vancouver - Shoppers Drug Mart locations
      { name: "Shoppers Drug Mart - Granville & Broadway", facility_type: "franchise", municipality: "Vancouver", address: "2302 Granville St", lat: 49.2635, lng: -123.1384 },
      { name: "Shoppers Drug Mart - Commercial Drive", facility_type: "franchise", municipality: "Vancouver", address: "1650 Commercial Dr", lat: 49.2686, lng: -123.0695 },
      { name: "Shoppers Drug Mart - Kerrisdale", facility_type: "franchise", municipality: "Vancouver", address: "2188 W 41st Ave", lat: 49.2335, lng: -123.1577 },
      { name: "Shoppers Drug Mart - Dunbar", facility_type: "franchise", municipality: "Vancouver", address: "4326 Dunbar St", lat: 49.2445, lng: -123.1867 },
      { name: "Shoppers Drug Mart - Main Street", facility_type: "franchise", municipality: "Vancouver", address: "4088 Main St", lat: 49.2447, lng: -123.1008 },
      { name: "Shoppers Drug Mart - Cambie Village", facility_type: "franchise", municipality: "Vancouver", address: "3989 Cambie St", lat: 49.2461, lng: -123.1147 },
      { name: "Shoppers Drug Mart - Kitsilano", facility_type: "franchise", municipality: "Vancouver", address: "2560 W Broadway", lat: 49.2635, lng: -123.1654 },
      { name: "Shoppers Drug Mart - Marpole", facility_type: "franchise", municipality: "Vancouver", address: "8318 Granville St", lat: 49.2112, lng: -123.1384 },
      { name: "Shoppers Drug Mart - Joyce", facility_type: "franchise", municipality: "Vancouver", address: "5080 Joyce St", lat: 49.2382, lng: -123.0281 },
      { name: "Shoppers Drug Mart - Hastings Sunrise", facility_type: "franchise", municipality: "Vancouver", address: "2918 E Hastings St", lat: 49.2812, lng: -123.0389 },
      { name: "London Drugs - Broadway & Cambie", facility_type: "franchise", municipality: "Vancouver", address: "525 W Broadway", lat: 49.2634, lng: -123.1147 },
      { name: "London Drugs - Oakridge", facility_type: "franchise", municipality: "Vancouver", address: "650 W 41st Ave", lat: 49.2271, lng: -123.1166 },
      { name: "London Drugs - Park Royal", facility_type: "franchise", municipality: "West Vancouver", address: "910 Park Royal S", lat: 49.3259, lng: -123.1356 },
      
      // Burnaby franchises
      { name: "Shoppers Drug Mart - Metrotown", facility_type: "franchise", municipality: "Burnaby", address: "4820 Kingsway", lat: 49.2277, lng: -123.0025 },
      { name: "Shoppers Drug Mart - Brentwood", facility_type: "franchise", municipality: "Burnaby", address: "4567 Lougheed Hwy", lat: 49.2683, lng: -123.0002 },
      { name: "Shoppers Drug Mart - Edmonds", facility_type: "franchise", municipality: "Burnaby", address: "7155 Kingsway", lat: 49.2145, lng: -122.9567 },
      { name: "London Drugs - Lougheed", facility_type: "franchise", municipality: "Burnaby", address: "9855 Austin Ave", lat: 49.2533, lng: -122.8912 },
      { name: "Pharmasave - Burnaby Heights", facility_type: "franchise", municipality: "Burnaby", address: "4208 Hastings St", lat: 49.2812, lng: -123.0089 },
      
      // Surrey franchises
      { name: "Shoppers Drug Mart - Guildford", facility_type: "franchise", municipality: "Surrey", address: "10355 152nd St", lat: 49.1912, lng: -122.8012 },
      { name: "Shoppers Drug Mart - Newton", facility_type: "franchise", municipality: "Surrey", address: "7380 King George Blvd", lat: 49.1289, lng: -122.8475 },
      { name: "Shoppers Drug Mart - Fleetwood", facility_type: "franchise", municipality: "Surrey", address: "15910 Fraser Hwy", lat: 49.1534, lng: -122.7712 },
      { name: "Shoppers Drug Mart - South Surrey", facility_type: "franchise", municipality: "Surrey", address: "2080 152nd St", lat: 49.0434, lng: -122.8012 },
      { name: "London Drugs - Central City", facility_type: "franchise", municipality: "Surrey", address: "10153 King George Blvd", lat: 49.1891, lng: -122.8475 },
      { name: "Save-On-Foods - Cloverdale", facility_type: "franchise", municipality: "Surrey", address: "5778 176th St", lat: 49.1056, lng: -122.7345 },
      
      // Richmond franchises
      { name: "Shoppers Drug Mart - Richmond Centre", facility_type: "franchise", municipality: "Richmond", address: "6060 Minoru Blvd", lat: 49.1666, lng: -123.1369 },
      { name: "Shoppers Drug Mart - Steveston", facility_type: "franchise", municipality: "Richmond", address: "12051 2nd Ave", lat: 49.1289, lng: -123.1812 },
      { name: "London Drugs - Richmond Centre", facility_type: "franchise", municipality: "Richmond", address: "6551 No. 3 Rd", lat: 49.1666, lng: -123.1369 },
      { name: "Pharmasave - Broadmoor", facility_type: "franchise", municipality: "Richmond", address: "7771 Westminster Hwy", lat: 49.1645, lng: -123.1123 },
      
      // Coquitlam/Port Coquitlam/Port Moody franchises
      { name: "Shoppers Drug Mart - Coquitlam Centre", facility_type: "franchise", municipality: "Coquitlam", address: "2929 Barnet Hwy", lat: 49.2744, lng: -122.7941 },
      { name: "Shoppers Drug Mart - Westwood Mall", facility_type: "franchise", municipality: "Coquitlam", address: "3025 Lougheed Hwy", lat: 49.2744, lng: -122.7891 },
      { name: "London Drugs - Coquitlam", facility_type: "franchise", municipality: "Coquitlam", address: "1163 Pinetree Way", lat: 49.2786, lng: -122.7958 },
      { name: "Shoppers Drug Mart - Port Coquitlam", facility_type: "franchise", municipality: "Port Coquitlam", address: "1250 Dominion Ave", lat: 49.2633, lng: -122.7531 },
      { name: "Pharmasave - Port Moody", facility_type: "franchise", municipality: "Port Moody", address: "2701 Barnet Hwy", lat: 49.2839, lng: -122.8317 },
      
      // North Shore franchises
      { name: "Shoppers Drug Mart - Lonsdale", facility_type: "franchise", municipality: "North Vancouver", address: "1277 Marine Dr", lat: 49.3132, lng: -123.0752 },
      { name: "Shoppers Drug Mart - Lynn Valley", facility_type: "franchise", municipality: "North Vancouver", address: "1199 Lynn Valley Rd", lat: 49.3396, lng: -123.0435 },
      { name: "London Drugs - Marine Drive", facility_type: "franchise", municipality: "North Vancouver", address: "1403 Lonsdale Ave", lat: 49.3117, lng: -123.0752 },
      { name: "Shoppers Drug Mart - Dundarave", facility_type: "franchise", municipality: "West Vancouver", address: "2459 Marine Dr", lat: 49.3351, lng: -123.1892 },
      { name: "Pharmasave - Deep Cove", facility_type: "franchise", municipality: "North Vancouver", address: "4380 Gallant Ave", lat: 49.3289, lng: -122.9512 },
      
      // Langley/Maple Ridge franchises
      { name: "Shoppers Drug Mart - Langley", facility_type: "franchise", municipality: "Langley", address: "20159 88th Ave", lat: 49.1515, lng: -122.6586 },
      { name: "Shoppers Drug Mart - Willowbrook", facility_type: "franchise", municipality: "Langley", address: "19705 Fraser Hwy", lat: 49.1126, lng: -122.6658 },
      { name: "London Drugs - Langley", facility_type: "franchise", municipality: "Langley", address: "20202 66th Ave", lat: 49.1041, lng: -122.6586 },
      { name: "Shoppers Drug Mart - Maple Ridge", facility_type: "franchise", municipality: "Maple Ridge", address: "22709 Lougheed Hwy", lat: 49.2194, lng: -122.5978 },
      { name: "Pharmasave - Pitt Meadows", facility_type: "franchise", municipality: "Pitt Meadows", address: "19150 Lougheed Hwy", lat: 49.2289, lng: -122.6912 },
      
      // New Westminster/Delta franchises
      { name: "Shoppers Drug Mart - New West", facility_type: "franchise", municipality: "New Westminster", address: "800 Carnarvon St", lat: 49.2012, lng: -122.9107 },
      { name: "London Drugs - Queensborough", facility_type: "franchise", municipality: "New Westminster", address: "920 Ewen Ave", lat: 49.1945, lng: -122.9478 },
      { name: "Shoppers Drug Mart - Ladner", facility_type: "franchise", municipality: "Delta", address: "4949 Delta St", lat: 49.0900, lng: -123.0823 },
      { name: "Shoppers Drug Mart - Tsawwassen", facility_type: "franchise", municipality: "Delta", address: "1208 56th St", lat: 49.0159, lng: -123.0855 },
      { name: "London Drugs - Scottsdale", facility_type: "franchise", municipality: "Delta", address: "7211 120th St", lat: 49.1548, lng: -122.9053 },
      
      // Fraser Valley franchises
      { name: "Shoppers Drug Mart - Abbotsford", facility_type: "franchise", municipality: "Abbotsford", address: "3122 Mt Lehman Rd", lat: 49.0512, lng: -122.4012 },
      { name: "Shoppers Drug Mart - Sevenoaks", facility_type: "franchise", municipality: "Abbotsford", address: "32900 S Fraser Way", lat: 49.0512, lng: -122.3123 },
      { name: "London Drugs - Abbotsford", facility_type: "franchise", municipality: "Abbotsford", address: "32700 S Fraser Way", lat: 49.0512, lng: -122.3089 },
      { name: "Shoppers Drug Mart - Chilliwack", facility_type: "franchise", municipality: "Chilliwack", address: "45585 Luckakuck Way", lat: 49.1579, lng: -121.9712 },
      { name: "London Drugs - Chilliwack", facility_type: "franchise", municipality: "Chilliwack", address: "45610 Yale Rd", lat: 49.1634, lng: -121.9514 },
      { name: "Shoppers Drug Mart - Mission", facility_type: "franchise", municipality: "Mission", address: "32471 Lougheed Hwy", lat: 49.1334, lng: -122.3089 },
      { name: "Pharmasave - Hope", facility_type: "franchise", municipality: "Hope", address: "800 Fraser Ave", lat: 49.3850, lng: -121.4410 },
      { name: "Pharmasave - Harrison Hot Springs", facility_type: "franchise", municipality: "Harrison Hot Springs", address: "499 Hot Springs Rd", lat: 49.3012, lng: -121.7867 },
      { name: "Pharmasave - Agassiz", facility_type: "franchise", municipality: "Agassiz", address: "7188 Pioneer Ave", lat: 49.2389, lng: -121.7612 },
      
      // Vancouver Island - Victoria area franchises
      { name: "Shoppers Drug Mart - Oak Bay", facility_type: "franchise", municipality: "Victoria", address: "2227 Oak Bay Ave", lat: 48.4384, lng: -123.3156 },
      { name: "Shoppers Drug Mart - James Bay", facility_type: "franchise", municipality: "Victoria", address: "230 Menzies St", lat: 48.4218, lng: -123.3712 },
      { name: "London Drugs - Hillside", facility_type: "franchise", municipality: "Victoria", address: "1644 Hillside Ave", lat: 48.4384, lng: -123.3511 },
      { name: "London Drugs - Mayfair", facility_type: "franchise", municipality: "Victoria", address: "3147 Douglas St", lat: 48.4489, lng: -123.3712 },
      { name: "Shoppers Drug Mart - Sidney", facility_type: "franchise", municipality: "Sidney", address: "2353 Bevan Ave", lat: 48.6500, lng: -123.3989 },
      { name: "Pharmasave - Oak Bay", facility_type: "franchise", municipality: "Victoria", address: "2200 Oak Bay Ave", lat: 48.4384, lng: -123.3156 },
      { name: "Shoppers Drug Mart - Langford", facility_type: "franchise", municipality: "Langford", address: "2945 Jacklin Rd", lat: 48.4512, lng: -123.4956 },
      { name: "London Drugs - Westshore", facility_type: "franchise", municipality: "Langford", address: "845 Langford Pkwy", lat: 48.4512, lng: -123.4856 },
      { name: "Shoppers Drug Mart - Sooke", facility_type: "franchise", municipality: "Sooke", address: "6726 West Coast Rd", lat: 48.3756, lng: -123.7356 },
      
      // Vancouver Island - Central/North franchises
      { name: "Shoppers Drug Mart - Nanaimo Harbour Park", facility_type: "franchise", municipality: "Nanaimo", address: "1 Port Dr", lat: 49.1688, lng: -123.9389 },
      { name: "London Drugs - Nanaimo", facility_type: "franchise", municipality: "Nanaimo", address: "4750 Rutherford Rd", lat: 49.1747, lng: -123.9678 },
      { name: "Shoppers Drug Mart - Parksville", facility_type: "franchise", municipality: "Parksville", address: "280 E Island Hwy", lat: 49.3189, lng: -124.3112 },
      { name: "Pharmasave - Qualicum Beach", facility_type: "franchise", municipality: "Qualicum Beach", address: "180 W 2nd Ave", lat: 49.3489, lng: -124.4312 },
      { name: "Shoppers Drug Mart - Courtenay", facility_type: "franchise", municipality: "Courtenay", address: "2777 Cliffe Ave", lat: 49.6912, lng: -124.9912 },
      { name: "London Drugs - Courtenay", facility_type: "franchise", municipality: "Courtenay", address: "2801 Cliffe Ave", lat: 49.6912, lng: -124.9945 },
      { name: "Shoppers Drug Mart - Campbell River", facility_type: "franchise", municipality: "Campbell River", address: "1400 Island Hwy", lat: 50.0289, lng: -125.2478 },
      { name: "Pharmasave - Port Alberni", facility_type: "franchise", municipality: "Port Alberni", address: "4505 Gertrude St", lat: 49.2434, lng: -124.8089 },
      { name: "Pharmasave - Tofino", facility_type: "franchise", municipality: "Tofino", address: "430 Campbell St", lat: 49.1534, lng: -125.9067 },
      { name: "Pharmasave - Ucluelet", facility_type: "franchise", municipality: "Ucluelet", address: "1576 Peninsula Rd", lat: 48.9412, lng: -125.5489 },
      { name: "Pharmasave - Port Hardy", facility_type: "franchise", municipality: "Port Hardy", address: "8640 Granville St", lat: 50.7234, lng: -127.4923 },
      { name: "Pharmasave - Port McNeill", facility_type: "franchise", municipality: "Port McNeill", address: "2255 Mine Rd", lat: 50.5889, lng: -127.0856 },
      
      // Gulf Islands franchises
      { name: "Pharmasave - Salt Spring Island", facility_type: "franchise", municipality: "Salt Spring Island", address: "104 Lower Ganges Rd", lat: 48.8534, lng: -123.5089 },
      { name: "Pharmasave - Pender Island", facility_type: "franchise", municipality: "Pender Island", address: "4301 Bedwell Harbour Rd", lat: 48.7534, lng: -123.2789 },
      { name: "Pharmasave - Gabriola Island", facility_type: "franchise", municipality: "Gabriola Island", address: "575 North Rd", lat: 49.1634, lng: -123.7889 },
      
      // Okanagan franchises
      { name: "Shoppers Drug Mart - Kelowna Downtown", facility_type: "franchise", municipality: "Kelowna", address: "1876 Cooper Rd", lat: 49.8863, lng: -119.4966 },
      { name: "Shoppers Drug Mart - Kelowna Mission", facility_type: "franchise", municipality: "Kelowna", address: "3155 Lakeshore Rd", lat: 49.8512, lng: -119.4512 },
      { name: "London Drugs - Kelowna", facility_type: "franchise", municipality: "Kelowna", address: "1835 Harvey Ave", lat: 49.8838, lng: -119.4747 },
      { name: "Shoppers Drug Mart - West Kelowna", facility_type: "franchise", municipality: "West Kelowna", address: "525 Hwy 97 S", lat: 49.8534, lng: -119.5834 },
      { name: "Shoppers Drug Mart - Vernon", facility_type: "franchise", municipality: "Vernon", address: "4400 32nd St", lat: 50.2645, lng: -119.2723 },
      { name: "London Drugs - Vernon", facility_type: "franchise", municipality: "Vernon", address: "3100 30th Ave", lat: 50.2645, lng: -119.2656 },
      { name: "Shoppers Drug Mart - Penticton", facility_type: "franchise", municipality: "Penticton", address: "301 Main St", lat: 49.4912, lng: -119.5934 },
      { name: "London Drugs - Penticton", facility_type: "franchise", municipality: "Penticton", address: "2111 Main St", lat: 49.5012, lng: -119.5834 },
      { name: "Pharmasave - Summerland", facility_type: "franchise", municipality: "Summerland", address: "13211 N Victoria Rd", lat: 49.6012, lng: -119.6512 },
      { name: "Pharmasave - Osoyoos", facility_type: "franchise", municipality: "Osoyoos", address: "8523 Main St", lat: 49.0312, lng: -119.4656 },
      { name: "Pharmasave - Oliver", facility_type: "franchise", municipality: "Oliver", address: "6187 Main St", lat: 49.1834, lng: -119.5512 },
      { name: "Pharmasave - Keremeos", facility_type: "franchise", municipality: "Keremeos", address: "614 7th Ave", lat: 49.2034, lng: -119.8289 },
      { name: "Pharmasave - Peachland", facility_type: "franchise", municipality: "Peachland", address: "5500 Clements Crescent", lat: 49.7712, lng: -119.7389 },
      { name: "Pharmasave - Armstrong", facility_type: "franchise", municipality: "Armstrong", address: "3390 Okanagan St", lat: 50.4489, lng: -119.1989 },
      { name: "Pharmasave - Salmon Arm", facility_type: "franchise", municipality: "Salmon Arm", address: "350 Trans Canada Hwy SW", lat: 50.6989, lng: -119.2889 },
      { name: "Shoppers Drug Mart - Salmon Arm", facility_type: "franchise", municipality: "Salmon Arm", address: "1151 10th Ave SW", lat: 50.6989, lng: -119.2923 },
      
      // Kamloops area franchises
      { name: "Shoppers Drug Mart - Kamloops Aberdeen", facility_type: "franchise", municipality: "Kamloops", address: "1320 Trans Canada Hwy W", lat: 50.7012, lng: -120.3607 },
      { name: "Shoppers Drug Mart - Kamloops Sahali", facility_type: "franchise", municipality: "Kamloops", address: "945 Columbia St W", lat: 50.6712, lng: -120.3478 },
      { name: "London Drugs - Kamloops", facility_type: "franchise", municipality: "Kamloops", address: "1395 Hillside Dr", lat: 50.6897, lng: -120.3495 },
      { name: "Pharmasave - Merritt", facility_type: "franchise", municipality: "Merritt", address: "2099 Nicola Ave", lat: 50.1134, lng: -120.7912 },
      { name: "Pharmasave - Chase", facility_type: "franchise", municipality: "Chase", address: "520 Shuswap Ave", lat: 50.8190, lng: -119.6847 },
      { name: "Pharmasave - Clearwater", facility_type: "franchise", municipality: "Clearwater", address: "419 Eden Rd", lat: 51.6512, lng: -120.0389 },
      
      // Kootenays franchises
      { name: "Shoppers Drug Mart - Cranbrook", facility_type: "franchise", municipality: "Cranbrook", address: "1600 Cranbrook St N", lat: 49.5212, lng: -115.7656 },
      { name: "Pharmasave - Fernie", facility_type: "franchise", municipality: "Fernie", address: "501 2nd Ave", lat: 49.5034, lng: -115.0634 },
      { name: "Pharmasave - Kimberley", facility_type: "franchise", municipality: "Kimberley", address: "285 Spokane St", lat: 49.6712, lng: -115.9812 },
      { name: "Pharmasave - Invermere", facility_type: "franchise", municipality: "Invermere", address: "1305 7th Ave", lat: 50.5089, lng: -116.0312 },
      { name: "Pharmasave - Golden", facility_type: "franchise", municipality: "Golden", address: "416 9th Ave N", lat: 51.2989, lng: -116.9656 },
      { name: "Pharmasave - Revelstoke", facility_type: "franchise", municipality: "Revelstoke", address: "555 Victoria Rd", lat: 50.9989, lng: -118.1934 },
      { name: "Shoppers Drug Mart - Nelson", facility_type: "franchise", municipality: "Nelson", address: "590 Baker St", lat: 49.4934, lng: -117.2912 },
      { name: "Pharmasave - Castlegar", facility_type: "franchise", municipality: "Castlegar", address: "1989 Columbia Ave", lat: 49.3234, lng: -117.6656 },
      { name: "Pharmasave - Trail", facility_type: "franchise", municipality: "Trail", address: "1500 Bay Ave", lat: 49.0989, lng: -117.7089 },
      { name: "Pharmasave - Rossland", facility_type: "franchise", municipality: "Rossland", address: "2063 Washington St", lat: 49.0789, lng: -117.8012 },
      { name: "Pharmasave - Grand Forks", facility_type: "franchise", municipality: "Grand Forks", address: "7372 2nd St", lat: 49.0312, lng: -118.4412 },
      { name: "Pharmasave - Nakusp", facility_type: "franchise", municipality: "Nakusp", address: "92 Broadway St W", lat: 50.2434, lng: -117.8012 },
      { name: "Pharmasave - New Denver", facility_type: "franchise", municipality: "New Denver", address: "309 6th Ave", lat: 49.9934, lng: -117.3789 },
      
      // Northern BC franchises
      { name: "Shoppers Drug Mart - Prince George Downtown", facility_type: "franchise", municipality: "Prince George", address: "1600 15th Ave", lat: 53.9171, lng: -122.7497 },
      { name: "Shoppers Drug Mart - Prince George Pine Centre", facility_type: "franchise", municipality: "Prince George", address: "3055 Massey Dr", lat: 53.8934, lng: -122.8112 },
      { name: "London Drugs - Prince George", facility_type: "franchise", municipality: "Prince George", address: "2155 Ferry Ave", lat: 53.9033, lng: -122.7819 },
      { name: "Pharmasave - Vanderhoof", facility_type: "franchise", municipality: "Vanderhoof", address: "2681 Burrard Ave", lat: 54.0167, lng: -124.0000 },
      { name: "Pharmasave - Fort St James", facility_type: "franchise", municipality: "Fort St James", address: "320 Stuart Dr W", lat: 54.4434, lng: -124.2512 },
      { name: "Pharmasave - Mackenzie", facility_type: "franchise", municipality: "Mackenzie", address: "400 Centennial Dr", lat: 55.3389, lng: -123.0912 },
      { name: "Pharmasave - Houston", facility_type: "franchise", municipality: "Houston", address: "3383 Hwy 16", lat: 54.4012, lng: -126.6512 },
      { name: "Pharmasave - Burns Lake", facility_type: "franchise", municipality: "Burns Lake", address: "240 Hwy 16", lat: 54.2312, lng: -125.7612 },
      { name: "Shoppers Drug Mart - Quesnel", facility_type: "franchise", municipality: "Quesnel", address: "383 Reid St", lat: 52.9785, lng: -122.4945 },
      { name: "Pharmasave - Williams Lake", facility_type: "franchise", municipality: "Williams Lake", address: "83 S 1st Ave", lat: 52.1289, lng: -122.1534 },
      { name: "Pharmasave - 100 Mile House", facility_type: "franchise", municipality: "100 Mile House", address: "385 Birch Ave", lat: 51.6434, lng: -121.2912 },
      { name: "Pharmasave - Lillooet", facility_type: "franchise", municipality: "Lillooet", address: "655 Main St", lat: 50.6834, lng: -121.9412 },
      
      // Northwest BC franchises  
      { name: "Shoppers Drug Mart - Terrace", facility_type: "franchise", municipality: "Terrace", address: "4635 Lakelse Ave", lat: 54.5134, lng: -128.5989 },
      { name: "Pharmasave - Kitimat", facility_type: "franchise", municipality: "Kitimat", address: "252 City Centre", lat: 54.0534, lng: -128.6512 },
      { name: "Shoppers Drug Mart - Prince Rupert", facility_type: "franchise", municipality: "Prince Rupert", address: "500 2nd Ave W", lat: 54.3150, lng: -130.3208 },
      { name: "Pharmasave - Smithers", facility_type: "franchise", municipality: "Smithers", address: "3763 Alfred Ave", lat: 54.3834, lng: -127.1689 },
      
      // Peace Region franchises
      { name: "Shoppers Drug Mart - Fort St John", facility_type: "franchise", municipality: "Fort St John", address: "9600 93rd Ave", lat: 56.2434, lng: -120.8456 },
      { name: "London Drugs - Fort St John", facility_type: "franchise", municipality: "Fort St John", address: "9815 100th St", lat: 56.2434, lng: -120.8512 },
      { name: "Shoppers Drug Mart - Dawson Creek", facility_type: "franchise", municipality: "Dawson Creek", address: "10200 8th St", lat: 55.7634, lng: -120.2312 },
      { name: "Pharmasave - Chetwynd", facility_type: "franchise", municipality: "Chetwynd", address: "4727 51st Ave", lat: 55.6989, lng: -121.6312 },
      { name: "Pharmasave - Fort Nelson", facility_type: "franchise", municipality: "Fort Nelson", address: "5500 50th Ave S", lat: 58.8067, lng: -122.6989 },
      { name: "Pharmasave - Hudson's Hope", facility_type: "franchise", municipality: "Hudson's Hope", address: "10511 Beattie Dr", lat: 56.0312, lng: -121.9089 },
      { name: "Pharmasave - Tumbler Ridge", facility_type: "franchise", municipality: "Tumbler Ridge", address: "330 Southgate", lat: 55.1289, lng: -120.9989 },
      
      // Squamish/Whistler/Sea-to-Sky franchises
      { name: "Shoppers Drug Mart - Squamish", facility_type: "franchise", municipality: "Squamish", address: "1200 Hunter Pl", lat: 49.7012, lng: -123.1512 },
      { name: "Pharmasave - Whistler", facility_type: "franchise", municipality: "Whistler", address: "4295 Blackcomb Way", lat: 50.1163, lng: -122.9574 },
      { name: "Pharmasave - Pemberton", facility_type: "franchise", municipality: "Pemberton", address: "7355 Prospect St", lat: 50.3189, lng: -122.8034 },
      
      // Sunshine Coast franchises
      { name: "Pharmasave - Gibsons", facility_type: "franchise", municipality: "Gibsons", address: "900 Gibsons Way", lat: 49.4012, lng: -123.5089 },
      { name: "Pharmasave - Sechelt", facility_type: "franchise", municipality: "Sechelt", address: "5500 Shorncliffe Ave", lat: 49.4712, lng: -123.7534 },
      { name: "Pharmasave - Madeira Park", facility_type: "franchise", municipality: "Madeira Park", address: "12905 Madeira Park Rd", lat: 49.6234, lng: -124.0234 },
      { name: "Pharmasave - Powell River", facility_type: "franchise", municipality: "Powell River", address: "4794 Joyce Ave", lat: 49.8312, lng: -124.5234 }
    ],
    service_coverage: ["Province-wide", "All BC municipalities", "All remote communities"],
    website: "https://www.canadapost.ca",
    phone: "1-866-607-6301",
    tracking_url: "https://www.canadapost.ca/track-reperage/en",
    notes: "Crown corporation; universal service obligation to all addresses in Canada"
  },
  // Purolator
  {
    id: "purolator",
    name: "Purolator",
    type: "express",
    facilities: [
      { name: "Vancouver Hub", facility_type: "hub", municipality: "Richmond", address: "2340 Shell Rd", lat: 49.1841, lng: -123.1283 },
      { name: "Surrey Depot", facility_type: "depot", municipality: "Surrey", address: "7327 137th St", lat: 49.1288, lng: -122.8576 },
      { name: "Burnaby Depot", facility_type: "depot", municipality: "Burnaby", address: "3780 Jacombs Rd", lat: 49.1964, lng: -122.9636 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "3934 Quadra St", lat: 48.4584, lng: -123.3659 },
      { name: "Nanaimo Depot", facility_type: "depot", municipality: "Nanaimo", address: "6404 Applecross Rd", lat: 49.1547, lng: -123.9678 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "1470 Harvey Ave", lat: 49.8838, lng: -119.4747 },
      { name: "Kamloops Depot", facility_type: "depot", municipality: "Kamloops", address: "1250 Rogers Way", lat: 50.6897, lng: -120.3495 },
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "1991 Queensway", lat: 53.9033, lng: -122.7819 },
      { name: "Abbotsford Depot", facility_type: "depot", municipality: "Abbotsford", address: "31205 Wheel Ave", lat: 49.0566, lng: -122.3712 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Okanagan", "BC Interior", "Northern BC"],
    website: "https://www.purolator.com",
    phone: "1-888-744-7123",
    tracking_url: "https://www.purolator.com/en/ship-track/tracking-tool.page",
    notes: "Majority owned by Canada Post; largest Canadian courier"
  },
  // FedEx
  {
    id: "fedex",
    name: "FedEx",
    type: "express",
    facilities: [
      { name: "Vancouver Gateway Hub", facility_type: "hub", municipality: "Richmond", address: "5000 Miller Rd", lat: 49.1928, lng: -123.1812 },
      { name: "Surrey Ship Centre", facility_type: "depot", municipality: "Surrey", address: "12568 88th Ave", lat: 49.1585, lng: -122.8888 },
      { name: "Burnaby Depot", facility_type: "depot", municipality: "Burnaby", address: "4180 Still Creek Dr", lat: 49.2652, lng: -123.0089 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "752 Pembroke St", lat: 48.4323, lng: -123.3611 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "1980 Windsor Rd", lat: 49.8676, lng: -119.4508 },
      { name: "Kamloops Depot", facility_type: "depot", municipality: "Kamloops", address: "1395 Dalhousie Dr", lat: 50.6713, lng: -120.3607 },
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "1320 2nd Ave", lat: 53.9171, lng: -122.7497 },
      { name: "Nanaimo Depot", facility_type: "depot", municipality: "Nanaimo", address: "1925 Bowen Rd", lat: 49.1688, lng: -123.9456 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Okanagan", "BC Interior", "Northern BC"],
    website: "https://www.fedex.com/en-ca",
    phone: "1-800-463-3339",
    tracking_url: "https://www.fedex.com/fedextrack",
    notes: "International express; ground service through FedEx Ground"
  },
  // UPS
  {
    id: "ups",
    name: "UPS",
    type: "express",
    facilities: [
      { name: "Vancouver Hub", facility_type: "hub", municipality: "Richmond", address: "6911 No. 9 Rd", lat: 49.1483, lng: -123.0936 },
      { name: "Burnaby Customer Centre", facility_type: "depot", municipality: "Burnaby", address: "8571 River Rd", lat: 49.1875, lng: -122.9489 },
      { name: "Surrey Depot", facility_type: "depot", municipality: "Surrey", address: "8323 129th St", lat: 49.1573, lng: -122.8676 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "1004 North Park St", lat: 48.4344, lng: -123.3511 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "2070 Leckie Rd", lat: 49.8847, lng: -119.4236 },
      { name: "Kamloops Depot", facility_type: "depot", municipality: "Kamloops", address: "1000 Laval Crescent", lat: 50.6752, lng: -120.3495 },
      { name: "Nanaimo Depot", facility_type: "depot", municipality: "Nanaimo", address: "2100 Northfield Rd", lat: 49.1897, lng: -123.9678 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Okanagan", "BC Interior"],
    website: "https://www.ups.com/ca",
    phone: "1-800-742-5877",
    tracking_url: "https://www.ups.com/track",
    notes: "UPS Access Point network includes retail locations throughout BC"
  },
  // DHL
  {
    id: "dhl",
    name: "DHL Express",
    type: "express",
    facilities: [
      { name: "Vancouver Gateway", facility_type: "hub", municipality: "Richmond", address: "5711 Airport Rd S", lat: 49.1878, lng: -123.1756 },
      { name: "Vancouver Service Point", facility_type: "depot", municipality: "Vancouver", address: "1111 Melville St", lat: 49.2869, lng: -123.1223 },
      { name: "Victoria Service Point", facility_type: "depot", municipality: "Victoria", address: "2750 Quadra St", lat: 48.4384, lng: -123.3659 },
      { name: "Kelowna Service Point", facility_type: "depot", municipality: "Kelowna", address: "1634 Harvey Ave", lat: 49.8838, lng: -119.4690 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Okanagan"],
    website: "https://www.dhl.com/ca-en",
    phone: "1-800-225-5345",
    tracking_url: "https://www.dhl.com/en/express/tracking.html",
    notes: "Focus on international express; limited domestic network"
  },
  // Canpar
  {
    id: "canpar",
    name: "Canpar Express",
    type: "express",
    facilities: [
      { name: "Vancouver Terminal", facility_type: "hub", municipality: "Surrey", address: "19123 16th Ave", lat: 49.0327, lng: -122.7296 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "2945 Bridge St", lat: 48.4413, lng: -123.3889 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "730 McCurdy Rd", lat: 49.9012, lng: -119.3867 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Okanagan", "BC Interior"],
    website: "https://www.canpar.com",
    phone: "1-800-387-9335",
    tracking_url: "https://www.canpar.com/en/tracking/track.htm",
    notes: "TFI International subsidiary; regional strength in Western Canada"
  },
  // Loomis Express
  {
    id: "loomis",
    name: "Loomis Express",
    type: "express",
    facilities: [
      { name: "Vancouver Terminal", facility_type: "hub", municipality: "Richmond", address: "11091 Bridgeport Rd", lat: 49.1883, lng: -123.1433 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "2945 Bridge St", lat: 48.4413, lng: -123.3889 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "2475 Dobbin Rd", lat: 49.8897, lng: -119.3945 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Okanagan"],
    website: "https://www.loomis-express.com",
    phone: "1-855-256-6647",
    tracking_url: "https://www.loomis-express.com/track",
    notes: "Day-definite ground service across Canada"
  },
  // Puro Freight (Purolator Freight)
  {
    id: "puro-freight",
    name: "Purolator Freight",
    type: "freight",
    facilities: [
      { name: "Vancouver Terminal", facility_type: "hub", municipality: "Delta", address: "1155 56th St", lat: 49.1098, lng: -122.9167 },
      { name: "Kelowna Terminal", facility_type: "depot", municipality: "Kelowna", address: "730 McCurdy Rd", lat: 49.9012, lng: -119.3867 }
    ],
    service_coverage: ["Metro Vancouver", "BC Interior", "Okanagan"],
    website: "https://www.purolatorfreight.com",
    phone: "1-888-302-8819",
    notes: "LTL freight division of Purolator; palletized shipments"
  },
  // Day & Ross
  {
    id: "day-ross",
    name: "Day & Ross",
    type: "freight",
    facilities: [
      { name: "Vancouver Terminal", facility_type: "hub", municipality: "Surrey", address: "11451 Bridgeview Dr", lat: 49.1998, lng: -122.8967 },
      { name: "Victoria Terminal", facility_type: "depot", municipality: "Victoria", address: "531 David St", lat: 48.4369, lng: -123.3889 },
      { name: "Kelowna Terminal", facility_type: "depot", municipality: "Kelowna", address: "795 McCurdy Rd", lat: 49.9012, lng: -119.3867 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "BC Interior"],
    website: "https://www.dayross.com",
    phone: "1-800-387-8646",
    tracking_url: "https://www.dayross.com/ship/tracking",
    notes: "McCain Foods subsidiary; LTL and express freight"
  },
  // Bandstra Transportation
  {
    id: "bandstra",
    name: "Bandstra Transportation",
    type: "regional",
    facilities: [
      { name: "Smithers Terminal", facility_type: "hub", municipality: "Smithers", address: "3883 Railway Ave", lat: 54.7804, lng: -127.1756 },
      { name: "Prince George Terminal", facility_type: "depot", municipality: "Prince George", address: "2863 McCullough Rd", lat: 53.8873, lng: -122.8098 },
      { name: "Terrace Terminal", facility_type: "depot", municipality: "Terrace", address: "5120 Keith Ave", lat: 54.5182, lng: -128.5767 },
      { name: "Kitimat Depot", facility_type: "depot", municipality: "Kitimat", address: "1355 Lahakas Blvd", lat: 54.0534, lng: -128.6537 }
    ],
    service_coverage: ["Northern BC", "Skeena-Bulkley", "Prince George area"],
    website: "https://www.bandstra.com",
    phone: "1-800-663-8687",
    notes: "Northern BC specialist; freight and courier since 1955"
  },
  // Northern Freightways
  {
    id: "northern-freightways",
    name: "Northern Freightways",
    type: "regional",
    facilities: [
      { name: "Prince George Terminal", facility_type: "hub", municipality: "Prince George", address: "1986 Queensway", lat: 53.9033, lng: -122.7819 },
      { name: "Dawson Creek Depot", facility_type: "depot", municipality: "Dawson Creek", address: "1000 96th Ave", lat: 55.7596, lng: -120.2377 },
      { name: "Fort St John Depot", facility_type: "depot", municipality: "Fort St. John", address: "9504 Alaska Rd", lat: 56.2465, lng: -120.8476 }
    ],
    service_coverage: ["Northern BC", "Peace Region", "Alaska Highway corridor"],
    website: "https://www.northernfreightways.com",
    phone: "250-564-2228",
    notes: "Peace Region and Northern BC freight specialist"
  },
  // Coastal Courier
  {
    id: "coastal-courier",
    name: "Coastal Courier Services",
    type: "regional",
    facilities: [
      { name: "Nanaimo Hub", facility_type: "hub", municipality: "Nanaimo", address: "1925 Bowen Rd", lat: 49.1688, lng: -123.9456 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "3934 Quadra St", lat: 48.4584, lng: -123.3659 }
    ],
    service_coverage: ["Vancouver Island", "Gulf Islands"],
    phone: "250-753-3433",
    notes: "Vancouver Island same-day and next-day delivery"
  },
  // Novex Delivery Solutions
  {
    id: "novex",
    name: "Novex Delivery Solutions",
    type: "same_day",
    facilities: [
      { name: "Vancouver Hub", facility_type: "hub", municipality: "Burnaby", address: "4088 Lougheed Hwy", lat: 49.2652, lng: -123.0089 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "3934 Quadra St", lat: 48.4584, lng: -123.3659 }
    ],
    service_coverage: ["Metro Vancouver", "Victoria", "Lower Mainland"],
    website: "https://www.novex.ca",
    phone: "604-437-4477",
    notes: "Same-day courier and scheduled routes"
  },
  // Dynamex
  {
    id: "dynamex",
    name: "Dynamex",
    type: "same_day",
    facilities: [
      { name: "Vancouver Hub", facility_type: "hub", municipality: "Burnaby", address: "7575 Kingsway", lat: 49.2278, lng: -122.9784 }
    ],
    service_coverage: ["Metro Vancouver", "Fraser Valley"],
    website: "https://www.dynamex.com",
    phone: "604-420-9111",
    notes: "Same-day rush delivery; medical and legal courier specialist"
  },
  // Intelcom
  {
    id: "intelcom",
    name: "Intelcom",
    type: "express",
    facilities: [
      { name: "Vancouver Hub", facility_type: "hub", municipality: "Delta", address: "7900 River Rd", lat: 49.1098, lng: -123.0456 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "3934 Quadra St", lat: 48.4584, lng: -123.3659 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island", "Fraser Valley"],
    website: "https://www.intelcom.ca",
    phone: "1-855-355-3278",
    tracking_url: "https://www.intelcom.ca/track",
    notes: "Amazon delivery partner; last-mile e-commerce specialist"
  }
];

// Trucking Services - Critical Infrastructure
export interface TruckingService {
  id: string;
  name: string;
  type: 'fuel' | 'food' | 'general_freight' | 'ltl' | 'logging' | 'aggregate' | 'hazmat' | 'refrigerated';
  terminals: {
    name: string;
    facility_type: 'terminal' | 'depot' | 'yard' | 'bulk_plant';
    municipality: string;
    address?: string;
    lat: number;
    lng: number;
  }[];
  service_coverage: string[];
  fleet_size?: string;
  website?: string;
  phone?: string;
  notes?: string;
}

export const BC_TRUCKING_SERVICES: TruckingService[] = [
  // ===== FUEL DELIVERY (Critical Infrastructure) =====
  {
    id: "suncor-petro-canada",
    name: "Suncor/Petro-Canada Fuel Distribution",
    type: "fuel",
    terminals: [
      { name: "Burnaby Refinery Terminal", facility_type: "terminal", municipality: "Burnaby", address: "355 N Willingdon Ave", lat: 49.2823, lng: -123.0056 },
      { name: "Kamloops Bulk Plant", facility_type: "bulk_plant", municipality: "Kamloops", address: "1295 Lorne St", lat: 50.6745, lng: -120.3273 },
      { name: "Prince George Terminal", facility_type: "terminal", municipality: "Prince George", address: "3755 Opie Crescent", lat: 53.8873, lng: -122.8098 }
    ],
    service_coverage: ["Province-wide", "All major communities"],
    fleet_size: "50+ tankers",
    website: "https://www.suncor.com",
    notes: "Major fuel supplier; refinery in Burnaby"
  },
  {
    id: "imperial-oil-esso",
    name: "Imperial Oil/Esso",
    type: "fuel",
    terminals: [
      { name: "Vancouver Terminal", facility_type: "terminal", municipality: "Burnaby", address: "355 Shellmont St", lat: 49.2789, lng: -123.0167 },
      { name: "Nanaimo Terminal", facility_type: "terminal", municipality: "Nanaimo", address: "1600 Stewart Ave", lat: 49.1688, lng: -123.9401 },
      { name: "Kelowna Bulk Plant", facility_type: "bulk_plant", municipality: "Kelowna", address: "1090 Richter St", lat: 49.8838, lng: -119.4690 }
    ],
    service_coverage: ["Province-wide", "Vancouver Island", "Interior"],
    fleet_size: "40+ tankers",
    website: "https://www.imperialoil.ca",
    notes: "Major petroleum distributor"
  },
  {
    id: "parkland-fuel",
    name: "Parkland Fuel Corporation",
    type: "fuel",
    terminals: [
      { name: "Burnaby Terminal", facility_type: "terminal", municipality: "Burnaby", address: "4601 Still Creek Dr", lat: 49.2678, lng: -123.0234 },
      { name: "Victoria Terminal", facility_type: "terminal", municipality: "Victoria", address: "450 Esquimalt Rd", lat: 48.4284, lng: -123.3867 },
      { name: "Prince George Terminal", facility_type: "terminal", municipality: "Prince George", address: "2300 Queensway", lat: 53.9033, lng: -122.7819 }
    ],
    service_coverage: ["Province-wide", "Chevron/Fas Gas/Race Trac networks"],
    fleet_size: "60+ tankers",
    website: "https://www.parkland.ca",
    phone: "1-855-355-3001",
    notes: "Chevron brand fuel; largest independent fuel marketer in Canada"
  },
  {
    id: "husky-cenovus",
    name: "Cenovus Energy (Husky)",
    type: "fuel",
    terminals: [
      { name: "Prince George Refinery", facility_type: "terminal", municipality: "Prince George", address: "10th Ave & Lyon St", lat: 53.9133, lng: -122.7650 },
      { name: "Kamloops Terminal", facility_type: "bulk_plant", municipality: "Kamloops", address: "955 Lorne St", lat: 50.6723, lng: -120.3289 }
    ],
    service_coverage: ["Northern BC", "Interior", "Peace Region"],
    fleet_size: "30+ tankers",
    website: "https://www.cenovus.com",
    notes: "Prince George refinery serves Northern BC"
  },
  {
    id: "super-save-fuel",
    name: "Super Save Fuel",
    type: "fuel",
    terminals: [
      { name: "Surrey Terminal", facility_type: "terminal", municipality: "Surrey", address: "8875 Eastlake Dr", lat: 49.1234, lng: -122.8567 },
      { name: "Langley Bulk Plant", facility_type: "bulk_plant", municipality: "Langley", address: "5660 Production Way", lat: 49.0834, lng: -122.6567 }
    ],
    service_coverage: ["Metro Vancouver", "Fraser Valley"],
    fleet_size: "25+ tankers",
    website: "https://www.supersave.ca",
    phone: "604-576-6666",
    notes: "Independent fuel distributor; cardlock network"
  },

  // ===== FOOD/GROCERY DISTRIBUTION (Essential Supplies) =====
  {
    id: "sysco-vancouver",
    name: "Sysco Vancouver",
    type: "food",
    terminals: [
      { name: "Vancouver Distribution Centre", facility_type: "terminal", municipality: "Richmond", address: "5899 Minoru Blvd", lat: 49.1623, lng: -123.1456 },
      { name: "Victoria Distribution Centre", facility_type: "depot", municipality: "Victoria", address: "2807 Quesnel St", lat: 48.4323, lng: -123.3789 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "1875 Dilworth Dr", lat: 49.8789, lng: -119.4512 }
    ],
    service_coverage: ["Province-wide", "All major communities", "Remote communities"],
    fleet_size: "150+ trucks",
    website: "https://www.sysco.ca",
    phone: "604-270-6100",
    notes: "Largest foodservice distributor; restaurants, hospitals, schools"
  },
  {
    id: "gfs-canada",
    name: "Gordon Food Service",
    type: "food",
    terminals: [
      { name: "Vancouver Distribution Centre", facility_type: "terminal", municipality: "Burnaby", address: "3585 Grandview Hwy", lat: 49.2589, lng: -123.0278 },
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "2175 Lyon St", lat: 53.9134, lng: -122.7623 }
    ],
    service_coverage: ["Province-wide", "Northern BC"],
    fleet_size: "100+ trucks",
    website: "https://www.gfs.ca",
    phone: "604-294-3466",
    notes: "Major foodservice distributor; wholesale and retail"
  },
  {
    id: "sobeys-distribution",
    name: "Sobeys/IGA Distribution",
    type: "food",
    terminals: [
      { name: "Langley Distribution Centre", facility_type: "terminal", municipality: "Langley", address: "19638 56th Ave", lat: 49.1056, lng: -122.6789 },
      { name: "Kelowna Cross-Dock", facility_type: "depot", municipality: "Kelowna", address: "2475 Dobbin Rd", lat: 49.8897, lng: -119.3945 }
    ],
    service_coverage: ["Province-wide", "Safeway/FreshCo/IGA stores"],
    fleet_size: "80+ trucks",
    website: "https://www.sobeys.com",
    notes: "Safeway, FreshCo, IGA grocery distribution"
  },
  {
    id: "save-on-foods-distribution",
    name: "Save-On-Foods/Overwaitea",
    type: "food",
    terminals: [
      { name: "Langley Distribution Centre", facility_type: "terminal", municipality: "Langley", address: "19855 92A Ave", lat: 49.1789, lng: -122.6534 },
      { name: "Kelowna Regional Depot", facility_type: "depot", municipality: "Kelowna", address: "2650 Highway 97 N", lat: 49.9123, lng: -119.4256 },
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "3505 Opie Crescent", lat: 53.8856, lng: -122.8123 }
    ],
    service_coverage: ["Province-wide", "All Save-On/PriceSmart stores"],
    fleet_size: "120+ trucks",
    website: "https://www.saveonfoods.com",
    notes: "Jim Pattison Group; largest western Canadian grocer"
  },
  {
    id: "loblaw-westfair",
    name: "Loblaw/Westfair Foods",
    type: "food",
    terminals: [
      { name: "Surrey Distribution Centre", facility_type: "terminal", municipality: "Surrey", address: "19133 21st Ave", lat: 49.0456, lng: -122.7234 },
      { name: "Calgary Cross-Dock (serves BC)", facility_type: "depot", municipality: "Kamloops", address: "1650 Versatile Dr", lat: 50.6823, lng: -120.3489 }
    ],
    service_coverage: ["Province-wide", "Real Canadian Superstore/No Frills"],
    fleet_size: "60+ trucks in BC",
    website: "https://www.loblaw.ca",
    notes: "Real Canadian Superstore, No Frills, Shoppers Drug Mart"
  },

  // ===== GENERAL FREIGHT =====
  {
    id: "mullen-group",
    name: "Mullen Group",
    type: "general_freight",
    terminals: [
      { name: "Surrey Terminal", facility_type: "terminal", municipality: "Surrey", address: "12939 76th Ave", lat: 49.1334, lng: -122.8567 },
      { name: "Prince George Terminal", facility_type: "terminal", municipality: "Prince George", address: "2600 Queensway", lat: 53.9056, lng: -122.7756 },
      { name: "Fort St John Terminal", facility_type: "depot", municipality: "Fort St. John", address: "8607 100th St", lat: 56.2445, lng: -120.8456 }
    ],
    service_coverage: ["Province-wide", "Western Canada", "Alaska Highway"],
    fleet_size: "500+ units company-wide",
    website: "https://www.mullen-group.com",
    notes: "Major LTL and TL carrier; oilfield services"
  },
  {
    id: "day-ross",
    name: "Day & Ross Transportation",
    type: "ltl",
    terminals: [
      { name: "Surrey Terminal", facility_type: "terminal", municipality: "Surrey", address: "11451 Bridgeview Dr", lat: 49.1998, lng: -122.8967 },
      { name: "Victoria Depot", facility_type: "depot", municipality: "Victoria", address: "531 David St", lat: 48.4369, lng: -123.3889 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "795 McCurdy Rd", lat: 49.9012, lng: -119.3867 }
    ],
    service_coverage: ["Province-wide", "Cross-Canada LTL"],
    fleet_size: "300+ units in BC",
    website: "https://www.dayross.com",
    phone: "1-800-387-4063",
    notes: "LTL specialist; Purolator Freight partner"
  },
  {
    id: "manitoulin-transport",
    name: "Manitoulin Transport",
    type: "ltl",
    terminals: [
      { name: "Delta Terminal", facility_type: "terminal", municipality: "Delta", address: "7880 Vantage Way", lat: 49.1134, lng: -123.0234 },
      { name: "Nanaimo Depot", facility_type: "depot", municipality: "Nanaimo", address: "1925 Bowen Rd", lat: 49.1688, lng: -123.9456 }
    ],
    service_coverage: ["Province-wide", "Vancouver Island", "Cross-Canada"],
    fleet_size: "100+ units in BC",
    website: "https://www.manitoulintransport.com",
    phone: "1-800-265-0182",
    notes: "LTL and specialized freight; remote community service"
  },
  {
    id: "cp-intermodal",
    name: "CP Rail Intermodal Trucking",
    type: "general_freight",
    terminals: [
      { name: "Vancouver Intermodal Yard", facility_type: "yard", municipality: "Coquitlam", address: "2850 Shaughnessy St", lat: 49.2578, lng: -122.8834 },
      { name: "Kamloops Yard", facility_type: "yard", municipality: "Kamloops", address: "400 Lorne St", lat: 50.6712, lng: -120.3278 }
    ],
    service_coverage: ["Major rail corridors", "Container drayage"],
    fleet_size: "200+ drayage trucks",
    website: "https://www.cpr.ca",
    notes: "Rail intermodal container trucking"
  },
  {
    id: "cn-intermodal",
    name: "CN Rail Intermodal Trucking",
    type: "general_freight",
    terminals: [
      { name: "Vancouver Intermodal Terminal", facility_type: "yard", municipality: "Surrey", address: "10400 120th St", lat: 49.1456, lng: -122.8934 },
      { name: "Prince Rupert Yard", facility_type: "yard", municipality: "Prince Rupert", address: "200 1st Ave W", lat: 54.3150, lng: -130.3208 }
    ],
    service_coverage: ["Major rail corridors", "Port container drayage"],
    fleet_size: "150+ drayage trucks",
    website: "https://www.cn.ca",
    notes: "Rail intermodal; Prince Rupert port service"
  },

  // ===== REFRIGERATED/TEMPERATURE CONTROLLED =====
  {
    id: "vedder-transport",
    name: "Vedder Transport",
    type: "refrigerated",
    terminals: [
      { name: "Abbotsford Terminal", facility_type: "terminal", municipality: "Abbotsford", address: "34663 Vye Rd", lat: 49.0589, lng: -122.2534 },
      { name: "Surrey Depot", facility_type: "depot", municipality: "Surrey", address: "7535 134th St", lat: 49.1289, lng: -122.8534 }
    ],
    service_coverage: ["Western Canada", "US Pacific Northwest"],
    fleet_size: "200+ reefer units",
    website: "https://www.veddertransport.com",
    phone: "604-857-9000",
    notes: "Temperature-controlled freight specialist"
  },
  {
    id: "van-kam-freightways",
    name: "Van Kam Freightways",
    type: "refrigerated",
    terminals: [
      { name: "Delta Terminal", facility_type: "terminal", municipality: "Delta", address: "7525 Vantage Way", lat: 49.1123, lng: -123.0189 },
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "2175 Lyon St", lat: 53.9134, lng: -122.7623 }
    ],
    service_coverage: ["Province-wide", "Temperature-controlled LTL"],
    fleet_size: "150+ units",
    website: "https://www.vankam.com",
    phone: "604-940-1111",
    notes: "Refrigerated LTL; remote community delivery"
  },

  // ===== LOGGING/FORESTRY =====
  {
    id: "arrow-transportation",
    name: "Arrow Transportation Systems",
    type: "logging",
    terminals: [
      { name: "Kamloops Terminal", facility_type: "terminal", municipality: "Kamloops", address: "955 Dalhousie Dr", lat: 50.6623, lng: -120.3567 },
      { name: "Quesnel Terminal", facility_type: "depot", municipality: "Quesnel", address: "2450 Brownmiller Rd", lat: 52.9785, lng: -122.4945 },
      { name: "Williams Lake Depot", facility_type: "depot", municipality: "Williams Lake", address: "1800 Broadway Ave S", lat: 52.1289, lng: -122.1534 }
    ],
    service_coverage: ["Interior BC", "Cariboo", "Forestry regions"],
    fleet_size: "300+ log trucks",
    website: "https://www.arrow.ca",
    notes: "Major log hauler; chip trucks; forestry services"
  },
  {
    id: "teal-jones-trucking",
    name: "Teal-Jones Trucking",
    type: "logging",
    terminals: [
      { name: "Surrey Terminal", facility_type: "yard", municipality: "Surrey", address: "19899 28th Ave", lat: 49.0634, lng: -122.7234 }
    ],
    service_coverage: ["Coastal BC", "Fraser Valley", "Vancouver Island"],
    fleet_size: "75+ log trucks",
    website: "https://www.tealjones.com",
    notes: "Coastal log hauling; sawmill supply"
  },

  // ===== AGGREGATE/CONSTRUCTION =====
  {
    id: "jack-cewe-trucking",
    name: "Jack Cewe Trucking",
    type: "aggregate",
    terminals: [
      { name: "Port Coquitlam Yard", facility_type: "yard", municipality: "Port Coquitlam", address: "1515 Broadway St", lat: 49.2612, lng: -122.7612 },
      { name: "Surrey Pit", facility_type: "yard", municipality: "Surrey", address: "18600 96th Ave", lat: 49.1823, lng: -122.7234 }
    ],
    service_coverage: ["Metro Vancouver", "Fraser Valley"],
    fleet_size: "100+ dump trucks",
    website: "https://www.jackcewe.com",
    phone: "604-941-8166",
    notes: "Aggregate, gravel, construction materials"
  },
  {
    id: "ocean-concrete",
    name: "Ocean Concrete (Lehigh Hanson)",
    type: "aggregate",
    terminals: [
      { name: "Vancouver Island Terminal", facility_type: "terminal", municipality: "Victoria", address: "100 Dallas Rd", lat: 48.4112, lng: -123.3789 },
      { name: "Vancouver Terminal", facility_type: "terminal", municipality: "Vancouver", address: "950 SE Marine Dr", lat: 49.2012, lng: -123.0989 }
    ],
    service_coverage: ["Metro Vancouver", "Vancouver Island"],
    fleet_size: "80+ mixer trucks",
    website: "https://www.oceanconcretebc.com",
    notes: "Ready-mix concrete; aggregate delivery"
  },

  // ===== HAZMAT/SPECIALIZED =====
  {
    id: "trimac-transportation",
    name: "Trimac Transportation",
    type: "hazmat",
    terminals: [
      { name: "Burnaby Terminal", facility_type: "terminal", municipality: "Burnaby", address: "3850 Henning Dr", lat: 49.2489, lng: -122.9834 },
      { name: "Prince George Terminal", facility_type: "depot", municipality: "Prince George", address: "3755 Opie Crescent", lat: 53.8873, lng: -122.8098 }
    ],
    service_coverage: ["Province-wide", "Bulk liquids", "Industrial chemicals"],
    fleet_size: "100+ tankers in BC",
    website: "https://www.trimac.com",
    phone: "1-888-874-6221",
    notes: "Bulk liquid transport; industrial chemicals; propane"
  },
  {
    id: "superior-propane",
    name: "Superior Propane",
    type: "hazmat",
    terminals: [
      { name: "Surrey Depot", facility_type: "bulk_plant", municipality: "Surrey", address: "7920 Enterprise St", lat: 49.1234, lng: -122.8678 },
      { name: "Kamloops Depot", facility_type: "bulk_plant", municipality: "Kamloops", address: "1825 Tranquille Rd", lat: 50.6934, lng: -120.3567 },
      { name: "Prince George Depot", facility_type: "bulk_plant", municipality: "Prince George", address: "3120 Recycle Rd", lat: 53.9045, lng: -122.7934 },
      { name: "Vernon Depot", facility_type: "bulk_plant", municipality: "Vernon", address: "6191 Okanagan Ave", lat: 50.2634, lng: -119.2723 }
    ],
    service_coverage: ["Province-wide", "Propane heating fuel"],
    fleet_size: "50+ propane trucks",
    website: "https://www.superiorpropane.com",
    phone: "1-877-873-7467",
    notes: "Propane delivery; critical heating fuel for rural BC"
  }
];

// ============================================================================
// RAIL SERVICES - Freight, Passenger, and Tourist Railways
// ============================================================================

export const BC_RAIL_SERVICES: RailService[] = [
  // Class I Freight Railroads
  {
    id: "cn-rail",
    name: "Canadian National Railway",
    type: "class_1_freight",
    stations: [
      { name: "Thornton Yard", station_type: "major_yard", municipality: "Surrey", subdivision: "Yale", lat: 49.1234, lng: -122.8456 },
      { name: "Port of Vancouver - Centerm", station_type: "intermodal", municipality: "Vancouver", subdivision: "Burrard Inlet", lat: 49.2847, lng: -123.0714 },
      { name: "Prince Rupert Fairview Terminal", station_type: "intermodal", municipality: "Prince Rupert", subdivision: "Prince Rupert", lat: 54.3150, lng: -130.3210 },
      { name: "Kamloops Yard", station_type: "major_yard", municipality: "Kamloops", subdivision: "Clearwater", lat: 50.6745, lng: -120.3456 },
      { name: "Prince George Yard", station_type: "major_yard", municipality: "Prince George", subdivision: "Fraser", lat: 53.9045, lng: -122.7934 },
      { name: "Boston Bar", station_type: "freight_depot", municipality: "Boston Bar", subdivision: "Yale", lat: 49.8667, lng: -121.4500 },
      { name: "Burns Lake", station_type: "freight_depot", municipality: "Burns Lake", subdivision: "Bulkley", lat: 54.2300, lng: -125.7600 },
      { name: "Fort St James", station_type: "freight_depot", municipality: "Fort St James", subdivision: "Takla", lat: 54.4333, lng: -124.2500 }
    ],
    routes: [
      "Vancouver - Prince Rupert (Northern Mainline)",
      "Vancouver - Edmonton via Yellowhead Pass",
      "Vancouver - Kamloops - Calgary",
      "Prince George - Fort Nelson"
    ],
    service_coverage: ["Province-wide", "Gateway to Asia-Pacific via Prince Rupert"],
    website: "https://www.cn.ca",
    phone: "1-888-668-4626",
    notes: "Major freight carrier; operates former BC Rail network north of Prince George"
  },
  {
    id: "cp-rail",
    name: "Canadian Pacific Kansas City",
    type: "class_1_freight",
    stations: [
      { name: "Coquitlam Yard", station_type: "major_yard", municipality: "Coquitlam", subdivision: "Cascade", lat: 49.2456, lng: -122.8567 },
      { name: "Vancouver Intermodal", station_type: "intermodal", municipality: "Vancouver", subdivision: "Cascade", lat: 49.2678, lng: -123.0234 },
      { name: "Kamloops Yard", station_type: "major_yard", municipality: "Kamloops", subdivision: "Thompson", lat: 50.6734, lng: -120.3234 },
      { name: "Golden Yard", station_type: "freight_depot", municipality: "Golden", subdivision: "Mountain", lat: 51.2978, lng: -116.9634 },
      { name: "Revelstoke Yard", station_type: "freight_depot", municipality: "Revelstoke", subdivision: "Mountain", lat: 50.9981, lng: -118.1957 },
      { name: "Field", station_type: "freight_depot", municipality: "Field", subdivision: "Mountain", lat: 51.3978, lng: -116.4856 }
    ],
    routes: [
      "Vancouver - Calgary via Rogers Pass",
      "Vancouver - Kamloops - Calgary Mainline"
    ],
    service_coverage: ["Southern BC Mainline", "Trans-Canada Route"],
    website: "https://www.cpkcr.com",
    phone: "1-888-333-6370",
    notes: "Major transcontinental freight; merged with Kansas City Southern 2023"
  },
  // Shortline/Regional Railways
  {
    id: "southern-railway-bc",
    name: "Southern Railway of BC",
    type: "shortline",
    stations: [
      { name: "New Westminster Yard", station_type: "freight_depot", municipality: "New Westminster", lat: 49.2057, lng: -122.9110 },
      { name: "Huntingdon", station_type: "freight_depot", municipality: "Abbotsford", lat: 49.0020, lng: -122.2650 },
      { name: "Cloverdale Yard", station_type: "freight_depot", municipality: "Surrey", lat: 49.1015, lng: -122.7234 }
    ],
    routes: [
      "New Westminster - Huntingdon (BNSF interchange)",
      "Fraser Valley industrial switching"
    ],
    service_coverage: ["Fraser Valley", "New Westminster", "US Border interchange"],
    website: "https://www.gwrr.com",
    notes: "Genesee & Wyoming subsidiary; serves Fraser Valley industrial customers"
  },
  {
    id: "kelowna-pacific",
    name: "Kelowna Pacific Railway",
    type: "shortline",
    stations: [
      { name: "Kelowna Yard", station_type: "freight_depot", municipality: "Kelowna", lat: 49.8834, lng: -119.4956 },
      { name: "Vernon Yard", station_type: "freight_depot", municipality: "Vernon", lat: 50.2634, lng: -119.2723 },
      { name: "Armstrong", station_type: "freight_depot", municipality: "Armstrong", lat: 50.4489, lng: -119.1978 }
    ],
    routes: [
      "Kelowna - Kamloops (CN interchange)"
    ],
    service_coverage: ["Okanagan Valley", "North Okanagan"],
    website: "https://www.gwrr.com",
    notes: "Genesee & Wyoming subsidiary; serves Okanagan agricultural and industrial customers"
  },
  // Passenger Rail
  {
    id: "via-rail",
    name: "VIA Rail Canada",
    type: "passenger",
    stations: [
      { name: "Pacific Central Station", station_type: "passenger_station", municipality: "Vancouver", lat: 49.2735, lng: -123.0978 },
      { name: "Kamloops Station", station_type: "passenger_station", municipality: "Kamloops", lat: 50.6745, lng: -120.3273 },
      { name: "Jasper Station", station_type: "passenger_station", municipality: "Jasper", lat: 52.8737, lng: -118.0814 },
      { name: "Prince Rupert Station", station_type: "passenger_station", municipality: "Prince Rupert", lat: 54.3150, lng: -130.3256 },
      { name: "Prince George Station", station_type: "passenger_station", municipality: "Prince George", lat: 53.9045, lng: -122.7934 }
    ],
    routes: [
      "The Canadian: Vancouver - Toronto (via Jasper, Edmonton)",
      "Jasper - Prince Rupert (Skeena)"
    ],
    service_coverage: ["Vancouver", "Kamloops", "Jasper", "Prince George", "Prince Rupert"],
    website: "https://www.viarail.ca",
    phone: "1-888-842-7245",
    notes: "National passenger rail; scenic routes through Rockies and Northern BC"
  },
  // Commuter Rail
  {
    id: "west-coast-express",
    name: "West Coast Express",
    type: "commuter",
    stations: [
      { name: "Waterfront Station", station_type: "passenger_station", municipality: "Vancouver", lat: 49.2856, lng: -123.1115 },
      { name: "Port Moody Station", station_type: "passenger_station", municipality: "Port Moody", lat: 49.2789, lng: -122.8567 },
      { name: "Coquitlam Central", station_type: "passenger_station", municipality: "Coquitlam", lat: 49.2739, lng: -122.7932 },
      { name: "Port Coquitlam Station", station_type: "passenger_station", municipality: "Port Coquitlam", lat: 49.2620, lng: -122.7645 },
      { name: "Pitt Meadows Station", station_type: "passenger_station", municipality: "Pitt Meadows", lat: 49.2233, lng: -122.6890 },
      { name: "Maple Meadows Station", station_type: "passenger_station", municipality: "Maple Ridge", lat: 49.2156, lng: -122.6534 },
      { name: "Port Haney Station", station_type: "passenger_station", municipality: "Maple Ridge", lat: 49.2234, lng: -122.6178 },
      { name: "Mission City Station", station_type: "passenger_station", municipality: "Mission", lat: 49.1330, lng: -122.3089 }
    ],
    routes: [
      "Waterfront Vancouver - Mission City"
    ],
    service_coverage: ["Metro Vancouver", "Fraser Valley"],
    website: "https://www.translink.ca/wce",
    phone: "604-488-8906",
    notes: "Peak-hour commuter service; operated by TransLink; 68km route"
  },
  // Tourist Railways
  {
    id: "rocky-mountaineer",
    name: "Rocky Mountaineer",
    type: "tourist",
    stations: [
      { name: "Vancouver Terminal", station_type: "passenger_station", municipality: "Vancouver", lat: 49.2892, lng: -123.0456 },
      { name: "Kamloops Overnight", station_type: "passenger_station", municipality: "Kamloops", lat: 50.6745, lng: -120.3273 },
      { name: "Whistler Station", station_type: "passenger_station", municipality: "Whistler", lat: 50.1163, lng: -122.9574 },
      { name: "Quesnel Station", station_type: "passenger_station", municipality: "Quesnel", lat: 52.9784, lng: -122.4934 },
      { name: "Jasper Station", station_type: "passenger_station", municipality: "Jasper", lat: 52.8737, lng: -118.0814 }
    ],
    routes: [
      "First Passage to the West: Vancouver - Banff/Lake Louise",
      "Journey Through the Clouds: Vancouver - Jasper",
      "Rainforest to Gold Rush: Vancouver - Jasper via Whistler/Quesnel"
    ],
    service_coverage: ["Vancouver", "Kamloops", "Whistler", "Quesnel", "Jasper", "Banff"],
    website: "https://www.rockymountaineer.com",
    phone: "1-877-460-3200",
    notes: "Luxury daylight-only scenic rail; April-October season"
  },
  {
    id: "kettle-valley-steam",
    name: "Kettle Valley Steam Railway",
    type: "tourist",
    stations: [
      { name: "Prairie Valley Station", station_type: "heritage", municipality: "Summerland", lat: 49.6012, lng: -119.6678 }
    ],
    routes: [
      "Summerland - Prairie Valley (Heritage route)"
    ],
    service_coverage: ["Summerland", "South Okanagan"],
    website: "https://www.kettlevalleyrail.org",
    phone: "250-494-8422",
    notes: "Heritage railway; restored 1912 steam locomotive; seasonal operation"
  },
  {
    id: "alberni-pacific",
    name: "Alberni Pacific Railway",
    type: "tourist",
    stations: [
      { name: "Port Alberni Station", station_type: "heritage", municipality: "Port Alberni", lat: 49.2339, lng: -124.8053 },
      { name: "McLean Mill", station_type: "heritage", municipality: "Port Alberni", lat: 49.2456, lng: -124.8234 }
    ],
    routes: [
      "Port Alberni - McLean Mill (Heritage logging railway)"
    ],
    service_coverage: ["Port Alberni", "Alberni Valley"],
    website: "https://www.alberniheritage.com",
    phone: "250-723-2118",
    notes: "Historic logging railway; 1929 Baldwin steam locomotive"
  },
  {
    id: "kamloops-heritage",
    name: "Kamloops Heritage Railway",
    type: "tourist",
    stations: [
      { name: "Kamloops Station", station_type: "heritage", municipality: "Kamloops", lat: 50.6745, lng: -120.3273 }
    ],
    routes: [
      "Kamloops city excursions (Spirit of Kamloops)"
    ],
    service_coverage: ["Kamloops"],
    website: "https://www.kamloopsheritagerailway.com",
    notes: "2141 Steam locomotive excursions; seasonal"
  }
];

// Helper function to get all ground transport by municipality
export function getGroundTransportByMunicipality(municipality: string): {
  intercityBus: IntercityBusService[];
  transitSystems: TransitSystem[];
  charterBus: CharterBusOperator[];
  courierServices: CourierService[];
  truckingServices: TruckingService[];
  railServices: RailService[];
} {
  const normalizedMuni = municipality.toLowerCase();
  
  return {
    intercityBus: BC_INTERCITY_BUS.filter(service => 
      service.hubs.some(hub => hub.municipality.toLowerCase() === normalizedMuni)
    ),
    transitSystems: BC_TRANSIT_SYSTEMS.filter(system =>
      system.municipalities_served.some(m => m.toLowerCase() === normalizedMuni)
    ),
    charterBus: BC_CHARTER_BUS.filter(op =>
      op.base_location.municipality.toLowerCase() === normalizedMuni ||
      op.service_area.some(area => area.toLowerCase().includes(normalizedMuni))
    ),
    courierServices: BC_COURIER_SERVICES.filter(service =>
      service.facilities.some(f => f.municipality.toLowerCase() === normalizedMuni) ||
      service.service_coverage.some(area => area.toLowerCase().includes(normalizedMuni))
    ),
    truckingServices: BC_TRUCKING_SERVICES.filter(service =>
      service.terminals.some(t => t.municipality.toLowerCase() === normalizedMuni) ||
      service.service_coverage.some(area => area.toLowerCase().includes(normalizedMuni))
    ),
    railServices: BC_RAIL_SERVICES.filter(service =>
      service.stations.some(s => s.municipality.toLowerCase() === normalizedMuni) ||
      service.service_coverage.some(area => area.toLowerCase().includes(normalizedMuni))
    )
  };
}

// Statistics
export function getGroundTransportStats() {
  return {
    intercityBusServices: BC_INTERCITY_BUS.length,
    intercityHubs: BC_INTERCITY_BUS.reduce((sum, s) => sum + s.hubs.length, 0),
    transitSystems: BC_TRANSIT_SYSTEMS.length,
    municipalitiesWithTransit: Array.from(new Set(BC_TRANSIT_SYSTEMS.flatMap(s => s.municipalities_served))).length,
    charterOperators: BC_CHARTER_BUS.length,
    schoolBusOperators: BC_CHARTER_BUS.filter(o => o.type === 'school').length,
    courierServices: BC_COURIER_SERVICES.length,
    courierFacilities: BC_COURIER_SERVICES.reduce((sum, s) => sum + s.facilities.length, 0),
    postalFacilities: BC_COURIER_SERVICES.filter(s => s.type === 'postal').reduce((sum, s) => sum + s.facilities.length, 0),
    expressCouriers: BC_COURIER_SERVICES.filter(s => s.type === 'express').length,
    truckingServices: BC_TRUCKING_SERVICES.length,
    truckingTerminals: BC_TRUCKING_SERVICES.reduce((sum, s) => sum + s.terminals.length, 0),
    fuelDistributors: BC_TRUCKING_SERVICES.filter(s => s.type === 'fuel').length,
    foodDistributors: BC_TRUCKING_SERVICES.filter(s => s.type === 'food').length,
    railServices: BC_RAIL_SERVICES.length,
    railStations: BC_RAIL_SERVICES.reduce((sum, s) => sum + s.stations.length, 0),
    freightRailways: BC_RAIL_SERVICES.filter(s => s.type === 'class_1_freight' || s.type === 'shortline').length,
    passengerRailways: BC_RAIL_SERVICES.filter(s => s.type === 'passenger' || s.type === 'commuter').length,
    touristRailways: BC_RAIL_SERVICES.filter(s => s.type === 'tourist').length
  };
}
