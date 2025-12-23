/**
 * BC Ground Transportation Infrastructure - People Carriers
 * Includes intercity bus services, public transit systems, and charter operators
 * All coordinates in WGS84 (lat/lng)
 */

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
    facility_type: "hub" | "depot" | "outlet" | "dropbox" | "locker";
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
  // Canada Post - Major Processing Plants and Depots
  {
    id: "canada-post",
    name: "Canada Post",
    type: "postal",
    facilities: [
      { name: "Vancouver Mail Processing Plant", facility_type: "hub", municipality: "Vancouver", address: "349 W Georgia St", lat: 49.2812, lng: -123.1151 },
      { name: "Richmond Processing Centre", facility_type: "hub", municipality: "Richmond", address: "4411 No. 3 Rd", lat: 49.1741, lng: -123.1369 },
      { name: "Victoria Letter Carrier Depot", facility_type: "depot", municipality: "Victoria", address: "714 Caledonia Ave", lat: 48.4344, lng: -123.3579 },
      { name: "Nanaimo Depot", facility_type: "depot", municipality: "Nanaimo", address: "35 Front St", lat: 49.1659, lng: -123.9401 },
      { name: "Kelowna Depot", facility_type: "depot", municipality: "Kelowna", address: "591 Bernard Ave", lat: 49.8863, lng: -119.4963 },
      { name: "Kamloops Depot", facility_type: "depot", municipality: "Kamloops", address: "301 Seymour St", lat: 50.6745, lng: -120.3273 },
      { name: "Prince George Depot", facility_type: "depot", municipality: "Prince George", address: "1323 5th Ave", lat: 53.9171, lng: -122.7497 },
      { name: "Surrey Processing Facility", facility_type: "hub", municipality: "Surrey", address: "9636 King George Blvd", lat: 49.1762, lng: -122.8475 },
      { name: "Burnaby Depot", facility_type: "depot", municipality: "Burnaby", address: "6360 Halifax St", lat: 49.2624, lng: -122.9636 },
      { name: "Coquitlam Depot", facility_type: "depot", municipality: "Coquitlam", address: "101-1015 Austin Ave", lat: 49.2744, lng: -122.7941 },
      { name: "Abbotsford Depot", facility_type: "depot", municipality: "Abbotsford", address: "2815 Clearbrook Rd", lat: 49.0504, lng: -122.3045 },
      { name: "Chilliwack Depot", facility_type: "depot", municipality: "Chilliwack", address: "45585 Airport Rd", lat: 49.1518, lng: -121.9378 },
      { name: "Courtenay Depot", facility_type: "depot", municipality: "Courtenay", address: "500 6th St", lat: 49.6874, lng: -124.9943 },
      { name: "Campbell River Depot", facility_type: "depot", municipality: "Campbell River", address: "1351 Shoppers Row", lat: 50.0265, lng: -125.2470 },
      { name: "Cranbrook Depot", facility_type: "depot", municipality: "Cranbrook", address: "102 11th Ave S", lat: 49.5097, lng: -115.7686 },
      { name: "Trail Depot", facility_type: "depot", municipality: "Trail", address: "1199 Bay Ave", lat: 49.0963, lng: -117.7111 },
      { name: "Nelson Depot", facility_type: "depot", municipality: "Nelson", address: "514 Vernon St", lat: 49.4928, lng: -117.2948 },
      { name: "Penticton Depot", facility_type: "depot", municipality: "Penticton", address: "56 Front St", lat: 49.4991, lng: -119.5937 },
      { name: "Vernon Depot", facility_type: "depot", municipality: "Vernon", address: "3101 32nd St", lat: 50.2671, lng: -119.2720 },
      { name: "Fort St John Depot", facility_type: "depot", municipality: "Fort St. John", address: "10631 100th St", lat: 56.2465, lng: -120.8476 },
      { name: "Dawson Creek Depot", facility_type: "depot", municipality: "Dawson Creek", address: "901 102nd Ave", lat: 55.7596, lng: -120.2377 },
      { name: "Terrace Depot", facility_type: "depot", municipality: "Terrace", address: "3232 Emerson St", lat: 54.5182, lng: -128.6033 },
      { name: "Prince Rupert Depot", facility_type: "depot", municipality: "Prince Rupert", address: "200 2nd Ave W", lat: 54.3150, lng: -130.3208 },
      { name: "Williams Lake Depot", facility_type: "depot", municipality: "Williams Lake", address: "42 2nd Ave S", lat: 52.1417, lng: -122.1417 },
      { name: "Quesnel Depot", facility_type: "depot", municipality: "Quesnel", address: "350 Reid St", lat: 52.9784, lng: -122.4927 }
    ],
    service_coverage: ["Province-wide", "All BC municipalities"],
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

// Helper function to get all ground transport by municipality
export function getGroundTransportByMunicipality(municipality: string): {
  intercityBus: IntercityBusService[];
  transitSystems: TransitSystem[];
  charterBus: CharterBusOperator[];
  courierServices: CourierService[];
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
    expressCouriers: BC_COURIER_SERVICES.filter(s => s.type === 'express').length
  };
}
