export type MarineFacilityType = 
  | 'coast_guard'
  | 'marina'
  | 'fuel_dock'
  | 'public_wharf'
  | 'rescue_station'
  | 'harbour_authority'
  | 'ferry_terminal'
  | 'seaplane_dock'
  | 'private_ferry'
  | 'water_taxi';

export interface MarineFacility {
  id: string;
  name: string;
  type: MarineFacilityType;
  municipality: string;
  region: string;
  latitude: number;
  longitude: number;
  cc_services?: string[];
  vhf_channel?: string;
  phone?: string;
  has_fuel?: boolean;
  has_moorage?: boolean;
  has_launch?: boolean;
  emergency_services?: boolean;
  notes?: string;
}

export const BC_MARINE_FACILITIES: MarineFacility[] = [
  // COAST GUARD STATIONS
  {
    id: "ccg-victoria",
    name: "Canadian Coast Guard - Victoria",
    type: "coast_guard",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4284,
    longitude: -123.3656,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Marine Communications", "Environmental Response"]
  },
  {
    id: "ccg-vancouver",
    name: "Canadian Coast Guard - Sea Island Base",
    type: "coast_guard",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1967,
    longitude: -123.1815,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Hovercraft Operations", "Environmental Response"]
  },
  {
    id: "ccg-prince-rupert",
    name: "Canadian Coast Guard - Prince Rupert",
    type: "coast_guard",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3150,
    longitude: -130.3208,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Icebreaking", "Marine Communications"]
  },
  {
    id: "ccg-comox",
    name: "Canadian Coast Guard - Comox",
    type: "coast_guard",
    municipality: "Comox",
    region: "Comox Valley",
    latitude: 49.6730,
    longitude: -124.9020,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Lifeboat Station"]
  },
  {
    id: "ccg-tofino",
    name: "Canadian Coast Guard - Tofino Lifeboat Station",
    type: "coast_guard",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1530,
    longitude: -125.9066,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Lifeboat Operations"]
  },
  {
    id: "ccg-bamfield",
    name: "Canadian Coast Guard - Bamfield Lifeboat Station",
    type: "coast_guard",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    latitude: 48.8339,
    longitude: -125.1353,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Lifeboat Operations"]
  },
  {
    id: "ccg-ganges",
    name: "Canadian Coast Guard - Ganges",
    type: "coast_guard",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8548,
    longitude: -123.5090,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Inshore Rescue"]
  },
  {
    id: "ccg-kitsilano",
    name: "Canadian Coast Guard - Kitsilano",
    type: "coast_guard",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2750,
    longitude: -123.1500,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue", "Inshore Rescue"]
  },
  {
    id: "ccg-powell-river",
    name: "Canadian Coast Guard Auxiliary - Powell River",
    type: "rescue_station",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8353,
    longitude: -124.5247,
    vhf_channel: "16",
    emergency_services: true,
    cc_services: ["Search and Rescue Auxiliary"]
  },

  // MAJOR MARINAS - METRO VANCOUVER
  {
    id: "marina-coal-harbour",
    name: "Coal Harbour Marina",
    type: "marina",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2908,
    longitude: -123.1270,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Transient Moorage", "Power", "Water", "Pump-out"]
  },
  {
    id: "marina-granville-island",
    name: "Granville Island Marina",
    type: "marina",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2716,
    longitude: -123.1340,
    has_fuel: false,
    has_moorage: true,
    cc_services: ["Transient Moorage", "Power", "Water"]
  },
  {
    id: "marina-false-creek",
    name: "False Creek Yacht Club",
    type: "marina",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2680,
    longitude: -123.1180,
    has_moorage: true,
    cc_services: ["Member Moorage", "Reciprocal"]
  },
  {
    id: "marina-spruce-harbour",
    name: "Spruce Harbour Marina",
    type: "marina",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2650,
    longitude: -123.1820,
    has_moorage: true,
    cc_services: ["Transient Moorage", "Power", "Water"]
  },
  {
    id: "marina-heather-civic",
    name: "Heather Civic Marina",
    type: "marina",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2620,
    longitude: -123.1130,
    has_moorage: true,
    cc_services: ["Transient Moorage", "Launch"]
  },
  {
    id: "marina-horseshoe-bay",
    name: "Sewell's Marina Horseshoe Bay",
    type: "marina",
    municipality: "West Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3746,
    longitude: -123.2737,
    has_fuel: true,
    has_moorage: true,
    has_launch: true,
    cc_services: ["Fuel", "Moorage", "Boat Rentals", "Launch Ramp"]
  },
  {
    id: "marina-deep-cove",
    name: "Deep Cove Marina",
    type: "marina",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3290,
    longitude: -122.9460,
    has_moorage: true,
    has_launch: true,
    cc_services: ["Moorage", "Kayak Rentals"]
  },
  {
    id: "marina-reed-point",
    name: "Reed Point Marina",
    type: "marina",
    municipality: "Port Moody",
    region: "Metro Vancouver",
    latitude: 49.2830,
    longitude: -122.8580,
    has_moorage: true,
    has_launch: true,
    cc_services: ["Moorage", "Launch", "Boat Sales"]
  },
  {
    id: "marina-steveston",
    name: "Steveston Harbour Authority",
    type: "harbour_authority",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1247,
    longitude: -123.1830,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Commercial Moorage", "Transient", "Fuel", "Ice"]
  },
  {
    id: "marina-captain-cove",
    name: "Captain's Cove Marina",
    type: "marina",
    municipality: "Ladner",
    region: "Metro Vancouver",
    latitude: 49.0920,
    longitude: -123.0580,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Repairs"]
  },

  // VANCOUVER ISLAND - VICTORIA AREA
  {
    id: "marina-victoria-inner",
    name: "Victoria Inner Harbour",
    type: "harbour_authority",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4225,
    longitude: -123.3700,
    has_fuel: false,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Transient Moorage", "Power", "Water", "Pump-out"]
  },
  {
    id: "marina-oak-bay",
    name: "Oak Bay Marina",
    type: "marina",
    municipality: "Oak Bay",
    region: "Capital",
    latitude: 48.4267,
    longitude: -123.3050,
    has_fuel: true,
    has_moorage: true,
    has_launch: true,
    cc_services: ["Fuel", "Moorage", "Launch", "Boat Rentals", "Fishing Charters"]
  },
  {
    id: "marina-sidney",
    name: "Port Sidney Marina",
    type: "marina",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6483,
    longitude: -123.3950,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Fuel", "Transient Moorage", "Customs", "Provisioning"]
  },
  {
    id: "marina-van-isle",
    name: "Van Isle Marina",
    type: "marina",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6550,
    longitude: -123.4050,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Haul-out", "Repairs"]
  },
  {
    id: "marina-canoe-cove",
    name: "Canoe Cove Marina",
    type: "marina",
    municipality: "North Saanich",
    region: "Capital",
    latitude: 48.6880,
    longitude: -123.4100,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Haul-out", "Full Service Yard"]
  },
  {
    id: "marina-brentwood",
    name: "Brentwood Bay Marina",
    type: "marina",
    municipality: "Central Saanich",
    region: "Capital",
    latitude: 48.5700,
    longitude: -123.4650,
    has_moorage: true,
    has_launch: true,
    cc_services: ["Moorage", "Launch", "Kayak Rentals"]
  },
  {
    id: "marina-sooke",
    name: "Sooke Harbour Marina",
    type: "marina",
    municipality: "Sooke",
    region: "Capital",
    latitude: 48.3720,
    longitude: -123.7250,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Fishing Charters"]
  },

  // GULF ISLANDS
  {
    id: "marina-ganges",
    name: "Ganges Marina",
    type: "marina",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8548,
    longitude: -123.5040,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Fuel", "Transient Moorage", "Provisioning"]
  },
  {
    id: "marina-salt-spring",
    name: "Salt Spring Marina",
    type: "marina",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8580,
    longitude: -123.4960,
    has_moorage: true,
    cc_services: ["Moorage", "Water Taxi"]
  },
  {
    id: "marina-montague",
    name: "Montague Harbour Marina",
    type: "marina",
    municipality: "Galiano Island",
    region: "Capital",
    latitude: 48.8920,
    longitude: -123.3880,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Store"]
  },
  {
    id: "marina-poets-cove",
    name: "Poets Cove Resort Marina",
    type: "marina",
    municipality: "Pender Island",
    region: "Capital",
    latitude: 48.7520,
    longitude: -123.2320,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Resort Amenities", "Restaurant"]
  },
  {
    id: "marina-telegraph",
    name: "Telegraph Harbour Marina",
    type: "marina",
    municipality: "Thetis Island",
    region: "Cowichan Valley",
    latitude: 48.9770,
    longitude: -123.6650,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Store", "Laundry"]
  },

  // VANCOUVER ISLAND - CENTRAL/NORTH
  {
    id: "marina-nanaimo",
    name: "Nanaimo Harbour",
    type: "harbour_authority",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1666,
    longitude: -123.9360,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "67",
    cc_services: ["Transient Moorage", "Fuel", "Customs", "Provisioning"]
  },
  {
    id: "marina-stones",
    name: "Stones Marina Nanaimo",
    type: "marina",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1850,
    longitude: -123.9400,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Repairs", "Haul-out"]
  },
  {
    id: "marina-comox",
    name: "Comox Bay Marina",
    type: "marina",
    municipality: "Comox",
    region: "Comox Valley",
    latitude: 49.6730,
    longitude: -124.9280,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Launch"]
  },
  {
    id: "marina-campbell-river",
    name: "Discovery Harbour Marina",
    type: "marina",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0240,
    longitude: -125.2470,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Fuel", "Transient Moorage", "Fishing Resort"]
  },
  {
    id: "marina-port-hardy",
    name: "Port Hardy Harbour Authority",
    type: "harbour_authority",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    latitude: 50.7230,
    longitude: -127.4940,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Fuel", "Moorage", "Provisioning"]
  },
  {
    id: "marina-port-mcneill",
    name: "Port McNeill Harbour",
    type: "harbour_authority",
    municipality: "Port McNeill",
    region: "Mount Waddington",
    latitude: 50.5860,
    longitude: -127.0850,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Launch"]
  },
  {
    id: "marina-alert-bay",
    name: "Alert Bay Harbour",
    type: "harbour_authority",
    municipality: "Alert Bay",
    region: "Mount Waddington",
    latitude: 50.5850,
    longitude: -126.9300,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage"]
  },

  // WEST COAST VANCOUVER ISLAND
  {
    id: "marina-tofino",
    name: "Tofino Harbour Authority",
    type: "harbour_authority",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1530,
    longitude: -125.9110,
    has_fuel: true,
    has_moorage: true,
    vhf_channel: "66A",
    cc_services: ["Fuel", "Transient Moorage", "Water Taxi"]
  },
  {
    id: "marina-ucluelet",
    name: "Ucluelet Harbour",
    type: "harbour_authority",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    latitude: 48.9420,
    longitude: -125.5460,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Fishing Charters"]
  },
  {
    id: "marina-port-alberni",
    name: "Port Alberni Harbour",
    type: "harbour_authority",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2340,
    longitude: -124.8050,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Lady Rose Terminal"]
  },
  {
    id: "marina-bamfield",
    name: "Bamfield Harbour Authority",
    type: "harbour_authority",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    latitude: 48.8339,
    longitude: -125.1353,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Transient Moorage", "Water Taxi"]
  },

  // SUNSHINE COAST
  {
    id: "marina-gibsons",
    name: "Gibsons Marina",
    type: "marina",
    municipality: "Gibsons",
    region: "Sunshine Coast",
    latitude: 49.4010,
    longitude: -123.5050,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Haul-out"]
  },
  {
    id: "marina-secret-cove",
    name: "Secret Cove Marina",
    type: "marina",
    municipality: "Halfmoon Bay",
    region: "Sunshine Coast",
    latitude: 49.5320,
    longitude: -123.9580,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Store"]
  },
  {
    id: "marina-madeira-park",
    name: "Madeira Park Government Wharf",
    type: "public_wharf",
    municipality: "Madeira Park",
    region: "Sunshine Coast",
    latitude: 49.6280,
    longitude: -124.0250,
    has_moorage: true,
    cc_services: ["Transient Moorage"]
  },
  {
    id: "marina-pender-harbour",
    name: "Pender Harbour Resort Marina",
    type: "marina",
    municipality: "Madeira Park",
    region: "Sunshine Coast",
    latitude: 49.6320,
    longitude: -124.0280,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Resort"]
  },
  {
    id: "marina-egmont",
    name: "Egmont Marina",
    type: "marina",
    municipality: "Egmont",
    region: "Sunshine Coast",
    latitude: 49.7520,
    longitude: -123.9350,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Skookumchuck Tours"]
  },
  {
    id: "marina-powell-river",
    name: "Westview Harbour Authority",
    type: "harbour_authority",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8353,
    longitude: -124.5247,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Ferry Terminal"]
  },

  // DESOLATION SOUND / DISCOVERY ISLANDS
  {
    id: "marina-lund",
    name: "Lund Harbour Authority",
    type: "harbour_authority",
    municipality: "Lund",
    region: "Powell River",
    latitude: 49.9760,
    longitude: -124.7620,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Gateway to Desolation Sound"]
  },
  {
    id: "marina-refuge-cove",
    name: "Refuge Cove Store & Marina",
    type: "marina",
    municipality: "West Redonda Island",
    region: "Strathcona",
    latitude: 50.1230,
    longitude: -124.8420,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Provisions", "Liquor Store"]
  },
  {
    id: "marina-heriot-bay",
    name: "Heriot Bay Marina",
    type: "marina",
    municipality: "Quadra Island",
    region: "Strathcona",
    latitude: 50.0950,
    longitude: -125.2170,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Store"]
  },
  {
    id: "marina-quathiaski",
    name: "Quathiaski Cove Harbour",
    type: "harbour_authority",
    municipality: "Quadra Island",
    region: "Strathcona",
    latitude: 50.0350,
    longitude: -125.2150,
    has_moorage: true,
    cc_services: ["Ferry Terminal", "Moorage"]
  },

  // NORTH COAST
  {
    id: "marina-prince-rupert",
    name: "Prince Rupert Yacht Club",
    type: "marina",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3150,
    longitude: -130.3150,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Haul-out"]
  },
  {
    id: "marina-cow-bay",
    name: "Cow Bay Marina",
    type: "marina",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3130,
    longitude: -130.3050,
    has_moorage: true,
    cc_services: ["Moorage", "Tourism"]
  },
  {
    id: "marina-kitimat",
    name: "Kitimat Yacht Club",
    type: "marina",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 54.0530,
    longitude: -128.6560,
    has_moorage: true,
    has_launch: true,
    cc_services: ["Moorage", "Launch"]
  },
  {
    id: "marina-bella-bella",
    name: "Shearwater Marine",
    type: "marina",
    municipality: "Bella Bella",
    region: "Central Coast",
    latitude: 52.1550,
    longitude: -128.0920,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Repairs", "Provisioning"]
  },
  {
    id: "marina-bella-coola",
    name: "Bella Coola Harbour",
    type: "harbour_authority",
    municipality: "Bella Coola",
    region: "Central Coast",
    latitude: 52.3760,
    longitude: -126.7580,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Ferry Terminal"]
  },

  // HAIDA GWAII
  {
    id: "marina-queen-charlotte",
    name: "Queen Charlotte Harbour",
    type: "harbour_authority",
    municipality: "Queen Charlotte",
    region: "Skeena-Queen Charlotte",
    latitude: 53.2530,
    longitude: -132.0740,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage"]
  },
  {
    id: "marina-sandspit",
    name: "Sandspit Harbour",
    type: "harbour_authority",
    municipality: "Sandspit",
    region: "Skeena-Queen Charlotte",
    latitude: 53.2450,
    longitude: -131.8180,
    has_moorage: true,
    cc_services: ["Moorage", "Air Access"]
  },
  {
    id: "marina-masset",
    name: "Masset Harbour Authority",
    type: "harbour_authority",
    municipality: "Masset",
    region: "Skeena-Queen Charlotte",
    latitude: 54.0150,
    longitude: -132.1450,
    has_fuel: true,
    has_moorage: true,
    cc_services: ["Fuel", "Moorage", "Commercial Fishing"]
  },

  // FERRY TERMINALS
  {
    id: "ferry-horseshoe-bay",
    name: "BC Ferries - Horseshoe Bay",
    type: "ferry_terminal",
    municipality: "West Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3746,
    longitude: -123.2737,
    cc_services: ["Ferry to Nanaimo", "Ferry to Langdale", "Ferry to Bowen Island"]
  },
  {
    id: "ferry-tsawwassen",
    name: "BC Ferries - Tsawwassen",
    type: "ferry_terminal",
    municipality: "Delta",
    region: "Metro Vancouver",
    latitude: 49.0060,
    longitude: -123.1310,
    cc_services: ["Ferry to Swartz Bay", "Ferry to Gulf Islands", "Ferry to Duke Point"]
  },
  {
    id: "ferry-swartz-bay",
    name: "BC Ferries - Swartz Bay",
    type: "ferry_terminal",
    municipality: "North Saanich",
    region: "Capital",
    latitude: 48.6890,
    longitude: -123.4100,
    cc_services: ["Ferry to Tsawwassen", "Ferry to Gulf Islands"]
  },
  {
    id: "ferry-departure-bay",
    name: "BC Ferries - Departure Bay",
    type: "ferry_terminal",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.2090,
    longitude: -123.9580,
    cc_services: ["Ferry to Horseshoe Bay"]
  },
  {
    id: "ferry-duke-point",
    name: "BC Ferries - Duke Point",
    type: "ferry_terminal",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1600,
    longitude: -123.8900,
    cc_services: ["Ferry to Tsawwassen"]
  },
  {
    id: "ferry-langdale",
    name: "BC Ferries - Langdale",
    type: "ferry_terminal",
    municipality: "Gibsons",
    region: "Sunshine Coast",
    latitude: 49.4340,
    longitude: -123.4750,
    cc_services: ["Ferry to Horseshoe Bay"]
  },
  {
    id: "ferry-earls-cove",
    name: "BC Ferries - Earls Cove",
    type: "ferry_terminal",
    municipality: "Egmont",
    region: "Sunshine Coast",
    latitude: 49.7540,
    longitude: -124.0020,
    cc_services: ["Ferry to Saltery Bay"]
  },

  // FUEL DOCKS (Standalone)
  {
    id: "fuel-chevron-vancouver",
    name: "Chevron Marine Fuel - Coal Harbour",
    type: "fuel_dock",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2910,
    longitude: -123.1250,
    has_fuel: true,
    cc_services: ["Gas", "Diesel", "Propane"]
  },
  {
    id: "fuel-esso-nanaimo",
    name: "Esso Nanaimo Harbour Fuel",
    type: "fuel_dock",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1680,
    longitude: -123.9350,
    has_fuel: true,
    cc_services: ["Gas", "Diesel"]
  },
  {
    id: "fuel-petro-can-victoria",
    name: "Petro-Canada Marine - Victoria",
    type: "fuel_dock",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4290,
    longitude: -123.3680,
    has_fuel: true,
    cc_services: ["Gas", "Diesel"]
  },

  // SEAPLANE DOCKS
  {
    id: "seaplane-vancouver-harbour",
    name: "Vancouver Harbour Flight Centre",
    type: "seaplane_dock",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2939,
    longitude: -123.1128,
    cc_services: ["Harbour Air", "Seair", "Float Plane Departures"]
  },
  {
    id: "seaplane-victoria-inner",
    name: "Victoria Inner Harbour Seaplane Terminal",
    type: "seaplane_dock",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4185,
    longitude: -123.3890,
    cc_services: ["Harbour Air", "Float Plane Departures"]
  },
  {
    id: "seaplane-nanaimo",
    name: "Nanaimo Harbour Seaplane Terminal",
    type: "seaplane_dock",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1680,
    longitude: -123.9400,
    cc_services: ["Harbour Air", "Seair"]
  },
  {
    id: "seaplane-ganges",
    name: "Ganges Seaplane Dock",
    type: "seaplane_dock",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8550,
    longitude: -123.5000,
    cc_services: ["Harbour Air", "Salt Spring Air"]
  },
  {
    id: "seaplane-tofino",
    name: "Tofino Seaplane Dock",
    type: "seaplane_dock",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1535,
    longitude: -125.9100,
    cc_services: ["Float Plane Departures"]
  },

  // PRIVATE FERRY OPERATORS
  {
    id: "hullo-vancouver",
    name: "Hullo Ferries - Vancouver Terminal",
    type: "private_ferry",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2890,
    longitude: -123.1128,
    cc_services: ["Fast Ferry to Nanaimo", "Passenger Only", "70 min crossing"],
    notes: "Vancouver Convention Centre - 354 passenger catamarans"
  },
  {
    id: "hullo-nanaimo",
    name: "Hullo Ferries - Nanaimo Terminal",
    type: "private_ferry",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1690,
    longitude: -123.9350,
    cc_services: ["Fast Ferry to Vancouver", "Passenger Only", "70 min crossing"],
    notes: "Nanaimo Cruise Terminal - 354 passenger catamarans"
  },
  {
    id: "lady-rose-port-alberni",
    name: "Lady Rose Marine - MV Frances Barkley",
    type: "private_ferry",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2340,
    longitude: -124.8050,
    cc_services: ["Passenger Ferry", "Freight", "Bamfield Route", "Ucluelet Route", "Broken Group Islands"],
    notes: "Heritage freight/passenger ferry - 200 passenger capacity - serves remote communities"
  },
  {
    id: "lady-rose-bamfield",
    name: "Lady Rose Marine - Bamfield Dock",
    type: "private_ferry",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    latitude: 48.8339,
    longitude: -125.1353,
    cc_services: ["Passenger Ferry", "Freight", "Connection to Port Alberni"],
    notes: "MV Frances Barkley service - Tue/Thu/Sat year-round"
  },

  // WATER TAXI SERVICES - GULF ISLANDS
  {
    id: "water-taxi-island",
    name: "Island Water Taxi",
    type: "water_taxi",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6483,
    longitude: -123.3950,
    cc_services: ["Southern Gulf Islands", "24/7 Service", "Cargo Transport"],
    notes: "Serving Gulf Islands since 1999 - up to 11 passengers"
  },
  {
    id: "water-taxi-sidney",
    name: "Sidney Water Taxi",
    type: "water_taxi",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6500,
    longitude: -123.4000,
    cc_services: ["Gulf Islands", "Charter Service"],
    notes: "24ft Northwest Aluminum boat"
  },
  {
    id: "water-taxi-gulf-islands",
    name: "Gulf Islands Water Taxi",
    type: "water_taxi",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6880,
    longitude: -123.4100,
    cc_services: ["Launch Services", "Pilot Transfers", "Government Officials"],
    notes: "Canoe Cove base - 24/7 operations"
  },
  {
    id: "water-taxi-bay-to-bay",
    name: "Bay to Bay Charters",
    type: "water_taxi",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8548,
    longitude: -123.5090,
    cc_services: ["Salt Spring", "Mill Bay", "Pender Island", "Deep Cove"],
    notes: "Water taxi to Vancouver Island and Gulf Islands"
  },
  {
    id: "water-taxi-birds-feather",
    name: "Birds of a Feather Marine",
    type: "water_taxi",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8550,
    longitude: -123.5000,
    cc_services: ["Private Charters", "Southern Gulf Islands", "Bicycle Transport", "Pet Friendly"],
    notes: "Custom destinations including Galiano, Mayne, Saturna, Penders"
  },

  // WATER TAXI SERVICES - TOFINO/CLAYOQUOT
  {
    id: "water-taxi-tofino",
    name: "Tofino Water Taxi",
    type: "water_taxi",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1530,
    longitude: -125.9066,
    cc_services: ["Meares Island", "Hot Springs Cove", "Vargas Island", "Lone Cone"],
    notes: "First Street Dock - includes zero-emission electric charter boat"
  },
  {
    id: "water-taxi-meares",
    name: "Meares Island Water Taxi",
    type: "water_taxi",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1535,
    longitude: -125.9080,
    cc_services: ["Meares Island", "Vargas Island", "Opitsaht", "Bear Watching", "Kayak Pickup"],
    notes: "Personalized charters throughout Clayoquot Sound"
  },
  {
    id: "water-taxi-ahous",
    name: "Ahous Hakuum",
    type: "water_taxi",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1540,
    longitude: -125.9100,
    cc_services: ["Ahousaht Community Service", "Scheduled Trips", "Charter Bookings"],
    notes: "Maaqutusiis (Ahousaht) to Tofino route - community transportation"
  },

  // WATER TAXI SERVICES - SUNSHINE COAST
  {
    id: "water-taxi-pender-harbour",
    name: "Pender Harbour Water Taxi",
    type: "water_taxi",
    municipality: "Madeira Park",
    region: "Sunshine Coast",
    latitude: 49.6320,
    longitude: -124.0280,
    cc_services: ["Local Transport", "Garden Bay", "Irvines Landing"],
    notes: "Serving Pender Harbour communities"
  },

  // WATER TAXI SERVICES - PRINCE RUPERT/NORTH COAST
  {
    id: "water-taxi-prince-rupert",
    name: "Prince Rupert Water Taxi",
    type: "water_taxi",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3150,
    longitude: -130.3208,
    cc_services: ["Local Islands", "Charter Service", "Fishing Access"],
    notes: "North coast water taxi cc_services"
  },

  // INLAND FERRY SERVICES (BC Ministry contracted)
  {
    id: "inland-ferry-kootenay",
    name: "Kootenay Lake Ferry",
    type: "private_ferry",
    municipality: "Balfour",
    region: "Central Kootenay",
    latitude: 49.6310,
    longitude: -116.9580,
    cc_services: ["Free Vehicle Ferry", "Balfour to Kootenay Bay", "35 min crossing"],
    notes: "Ministry of Transportation contracted - longest free ferry in world"
  },
  {
    id: "inland-ferry-upper-arrow",
    name: "Upper Arrow Lake Ferry",
    type: "private_ferry",
    municipality: "Galena Bay",
    region: "Columbia-Shuswap",
    latitude: 50.7520,
    longitude: -117.8560,
    cc_services: ["Free Vehicle Ferry", "Galena Bay to Shelter Bay", "20 min crossing"],
    notes: "Ministry of Transportation contracted"
  },
  {
    id: "inland-ferry-adams-lake",
    name: "Adams Lake Ferry",
    type: "private_ferry",
    municipality: "Adams Lake",
    region: "Columbia-Shuswap",
    latitude: 51.0830,
    longitude: -119.6350,
    cc_services: ["Free Vehicle Ferry", "Cable Ferry"],
    notes: "Ministry of Transportation contracted - reaction ferry"
  },
  {
    id: "inland-ferry-francois-lake",
    name: "Francois Lake Ferry",
    type: "private_ferry",
    municipality: "Burns Lake",
    region: "Bulkley-Nechako",
    latitude: 54.0540,
    longitude: -125.7850,
    cc_services: ["Free Vehicle Ferry", "15 min crossing"],
    notes: "Ministry of Transportation contracted"
  },
  {
    id: "inland-ferry-lytton",
    name: "Lytton Reaction Ferry",
    type: "private_ferry",
    municipality: "Lytton",
    region: "Thompson-Nicola",
    latitude: 50.2330,
    longitude: -121.5680,
    cc_services: ["Free Vehicle Ferry", "Fraser River Crossing", "Cable Ferry"],
    notes: "Ministry of Transportation contracted - reaction ferry"
  }
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function getMarineFacilitiesByMunicipality(municipalityName: string): MarineFacility[] {
  const searchName = municipalityName.toLowerCase();
  return BC_MARINE_FACILITIES.filter(f => 
    f.municipality.toLowerCase() === searchName ||
    f.municipality.toLowerCase().includes(searchName) ||
    searchName.includes(f.municipality.toLowerCase())
  );
}

export function getNearestMarineFacilities(
  lat: number, 
  lon: number, 
  count: number = 5,
  typeFilter?: MarineFacilityType[]
): { facility: MarineFacility; distance_km: number }[] {
  let facilities = BC_MARINE_FACILITIES;
  
  if (typeFilter && typeFilter.length > 0) {
    facilities = facilities.filter(f => typeFilter.includes(f.type));
  }
  
  return facilities
    .map(f => ({
      facility: f,
      distance_km: Math.round(calculateDistance(lat, lon, f.latitude, f.longitude) * 10) / 10
    }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, count);
}

export function getCoastGuardStations(): MarineFacility[] {
  return BC_MARINE_FACILITIES.filter(f => 
    f.type === 'coast_guard' || f.type === 'rescue_station'
  );
}

export function getFuelDocks(): MarineFacility[] {
  return BC_MARINE_FACILITIES.filter(f => f.has_fuel === true);
}

export function getMarineFacilitiesByType(type: MarineFacilityType): MarineFacility[] {
  return BC_MARINE_FACILITIES.filter(f => f.type === type);
}

export function getMarineFacilitiesByRegion(region: string): MarineFacility[] {
  return BC_MARINE_FACILITIES.filter(f => 
    f.region.toLowerCase() === region.toLowerCase()
  );
}
