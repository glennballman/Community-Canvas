export type WaterFacilityType = 
  | 'treatment_plant'
  | 'reservoir'
  | 'pump_station'
  | 'water_district'
  | 'dam'
  | 'intake';

export interface WaterFacility {
  id: string;
  name: string;
  type: WaterFacilityType;
  municipality: string;
  region: string;
  latitude: number;
  longitude: number;
  operator?: string;
  capacity_ml_day?: number;
  population_served?: number;
  source?: string;
  phone?: string;
  notes?: string;
}

export const BC_WATER_FACILITIES: WaterFacility[] = [
  // ==========================================
  // METRO VANCOUVER WATER FACILITIES
  // ==========================================
  {
    id: "water-seymour-capilano",
    name: "Seymour-Capilano Filtration Plant",
    type: "treatment_plant",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3567,
    longitude: -123.0123,
    operator: "Metro Vancouver",
    capacity_ml_day: 1800,
    population_served: 2500000,
    source: "Seymour and Capilano Reservoirs",
    notes: "Largest water treatment facility in Western Canada"
  },
  {
    id: "water-coquitlam-lake",
    name: "Coquitlam Lake Water Supply",
    type: "reservoir",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    latitude: 49.3667,
    longitude: -122.7833,
    operator: "Metro Vancouver",
    capacity_ml_day: 850,
    source: "Coquitlam Watershed",
    notes: "Protected watershed - no public access"
  },
  {
    id: "water-capilano-reservoir",
    name: "Capilano Reservoir",
    type: "reservoir",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3833,
    longitude: -123.1333,
    operator: "Metro Vancouver",
    source: "Capilano River Watershed",
    notes: "Cleveland Dam impounds this reservoir"
  },
  {
    id: "water-seymour-reservoir",
    name: "Seymour Falls Dam & Reservoir",
    type: "reservoir",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.4167,
    longitude: -122.9667,
    operator: "Metro Vancouver",
    source: "Seymour River Watershed"
  },
  {
    id: "water-annacis-pump",
    name: "Annacis Island Pump Station",
    type: "pump_station",
    municipality: "Delta",
    region: "Metro Vancouver",
    latitude: 49.1833,
    longitude: -122.9500,
    operator: "Metro Vancouver",
    notes: "Major distribution pump station"
  },
  {
    id: "water-surrey-newton",
    name: "Newton Pump Station",
    type: "pump_station",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1333,
    longitude: -122.8333,
    operator: "City of Surrey"
  },

  // ==========================================
  // FRASER VALLEY WATER FACILITIES
  // ==========================================
  {
    id: "water-abbotsford-plant",
    name: "Abbotsford Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    latitude: 49.0603,
    longitude: -122.3270,
    operator: "City of Abbotsford",
    source: "Norrish Creek",
    population_served: 180000,
    notes: "Gravity-fed system from Norrish Creek"
  },
  {
    id: "water-chilliwack-plant",
    name: "Chilliwack Water Treatment Facility",
    type: "treatment_plant",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    latitude: 49.1577,
    longitude: -121.9509,
    operator: "City of Chilliwack",
    source: "Groundwater wells",
    population_served: 100000
  },
  {
    id: "water-mission-plant",
    name: "Mission Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1330,
    longitude: -122.3100,
    operator: "District of Mission",
    source: "Cannell Lake",
    population_served: 40000
  },

  // ==========================================
  // CAPITAL REGION (VICTORIA)
  // ==========================================
  {
    id: "water-sooke-reservoir",
    name: "Sooke Lake Reservoir",
    type: "reservoir",
    municipality: "Sooke",
    region: "Capital",
    latitude: 48.5167,
    longitude: -123.7000,
    operator: "Capital Regional District",
    population_served: 400000,
    source: "Sooke Lake Watershed",
    notes: "Primary water source for Greater Victoria"
  },
  {
    id: "water-japan-gulch",
    name: "Japan Gulch Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Colwood",
    region: "Capital",
    latitude: 48.4333,
    longitude: -123.5167,
    operator: "Capital Regional District",
    source: "Sooke Lake Reservoir",
    population_served: 400000
  },
  {
    id: "water-goldstream",
    name: "Goldstream Pump Station",
    type: "pump_station",
    municipality: "Langford",
    region: "Capital",
    latitude: 48.4500,
    longitude: -123.5333,
    operator: "Capital Regional District"
  },

  // ==========================================
  // VANCOUVER ISLAND
  // ==========================================
  {
    id: "water-nanaimo-south-forks",
    name: "South Forks Dam & Reservoir",
    type: "reservoir",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1167,
    longitude: -124.0500,
    operator: "City of Nanaimo",
    population_served: 100000,
    source: "Nanaimo River watershed"
  },
  {
    id: "water-nanaimo-plant",
    name: "Nanaimo Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1333,
    longitude: -123.9667,
    operator: "City of Nanaimo",
    population_served: 100000
  },
  {
    id: "water-comox-valley",
    name: "Comox Valley Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Courtenay",
    region: "Comox Valley",
    latitude: 49.6833,
    longitude: -125.0333,
    operator: "Comox Valley Regional District",
    source: "Comox Lake",
    population_served: 70000
  },
  {
    id: "water-campbell-river",
    name: "Campbell River Water Treatment",
    type: "treatment_plant",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0167,
    longitude: -125.2500,
    operator: "City of Campbell River",
    source: "John Hart Lake",
    population_served: 35000
  },
  {
    id: "water-port-alberni",
    name: "Port Alberni Water System",
    type: "treatment_plant",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2333,
    longitude: -124.8000,
    operator: "City of Port Alberni",
    source: "China Creek Reservoir",
    population_served: 18000
  },
  {
    id: "water-parksville",
    name: "Parksville Water Treatment",
    type: "treatment_plant",
    municipality: "Parksville",
    region: "Nanaimo",
    latitude: 49.3167,
    longitude: -124.3167,
    operator: "City of Parksville",
    source: "Englishman River",
    population_served: 13000
  },

  // ==========================================
  // OKANAGAN
  // ==========================================
  {
    id: "water-kelowna-poplar-point",
    name: "Poplar Point Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8667,
    longitude: -119.4833,
    operator: "City of Kelowna",
    source: "Okanagan Lake",
    population_served: 150000,
    notes: "Major treatment facility for Central Okanagan"
  },
  {
    id: "water-kelowna-cedar-creek",
    name: "Cedar Creek Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8500,
    longitude: -119.5167,
    operator: "City of Kelowna",
    source: "Okanagan Lake"
  },
  {
    id: "water-vernon",
    name: "Vernon Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Vernon",
    region: "North Okanagan",
    latitude: 50.2500,
    longitude: -119.2833,
    operator: "City of Vernon",
    source: "Kalamalka Lake",
    population_served: 45000
  },
  {
    id: "water-penticton",
    name: "Penticton Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    latitude: 49.4833,
    longitude: -119.5833,
    operator: "City of Penticton",
    source: "Okanagan Lake",
    population_served: 35000
  },
  {
    id: "water-west-kelowna",
    name: "West Kelowna Water Treatment",
    type: "treatment_plant",
    municipality: "West Kelowna",
    region: "Central Okanagan",
    latitude: 49.8667,
    longitude: -119.5833,
    operator: "City of West Kelowna",
    source: "Okanagan Lake",
    population_served: 36000
  },

  // ==========================================
  // THOMPSON-NICOLA
  // ==========================================
  {
    id: "water-kamloops",
    name: "Kamloops Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6833,
    longitude: -120.3333,
    operator: "City of Kamloops",
    source: "South Thompson River",
    population_served: 100000
  },
  {
    id: "water-kamloops-rayleigh",
    name: "Rayleigh Water System",
    type: "pump_station",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.7500,
    longitude: -120.3000,
    operator: "Thompson-Nicola Regional District"
  },

  // ==========================================
  // KOOTENAYS
  // ==========================================
  {
    id: "water-nelson",
    name: "Nelson Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4833,
    longitude: -117.2833,
    operator: "City of Nelson",
    source: "Five Mile Creek",
    population_served: 11000
  },
  {
    id: "water-trail",
    name: "Trail Water System",
    type: "treatment_plant",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0833,
    longitude: -117.7000,
    operator: "City of Trail",
    source: "Cambridge Creek",
    population_served: 8000
  },
  {
    id: "water-castlegar",
    name: "Castlegar Water Treatment",
    type: "treatment_plant",
    municipality: "Castlegar",
    region: "Central Kootenay",
    latitude: 49.3167,
    longitude: -117.6667,
    operator: "City of Castlegar",
    source: "Kootenay River",
    population_served: 8000
  },
  {
    id: "water-cranbrook",
    name: "Cranbrook Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Cranbrook",
    region: "East Kootenay",
    latitude: 49.5000,
    longitude: -115.7667,
    operator: "City of Cranbrook",
    source: "Joseph Creek",
    population_served: 21000
  },
  {
    id: "water-fernie",
    name: "Fernie Water Treatment",
    type: "treatment_plant",
    municipality: "Fernie",
    region: "East Kootenay",
    latitude: 49.5000,
    longitude: -115.0667,
    operator: "City of Fernie",
    source: "Fairy Creek Reservoir",
    population_served: 6000
  },

  // ==========================================
  // CARIBOO
  // ==========================================
  {
    id: "water-quesnel",
    name: "Quesnel Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Quesnel",
    region: "Cariboo",
    latitude: 52.9833,
    longitude: -122.4833,
    operator: "City of Quesnel",
    source: "Quesnel River",
    population_served: 10000
  },
  {
    id: "water-williams-lake",
    name: "Williams Lake Water System",
    type: "treatment_plant",
    municipality: "Williams Lake",
    region: "Cariboo",
    latitude: 52.1167,
    longitude: -122.1500,
    operator: "City of Williams Lake",
    source: "Williams Lake",
    population_served: 11000
  },

  // ==========================================
  // NORTHERN BC
  // ==========================================
  {
    id: "water-prince-george",
    name: "Prince George Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.9167,
    longitude: -122.7500,
    operator: "City of Prince George",
    source: "Nechako River",
    population_served: 85000,
    notes: "Largest water system in Northern BC"
  },
  {
    id: "water-prince-rupert",
    name: "Prince Rupert Water System",
    type: "treatment_plant",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3167,
    longitude: -130.3167,
    operator: "City of Prince Rupert",
    source: "Woodworth Lake",
    population_served: 12000
  },
  {
    id: "water-terrace",
    name: "Terrace Water Treatment",
    type: "treatment_plant",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    latitude: 54.5167,
    longitude: -128.6000,
    operator: "City of Terrace",
    source: "Deep Creek",
    population_served: 12000
  },
  {
    id: "water-kitimat",
    name: "Kitimat Water System",
    type: "treatment_plant",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 54.0500,
    longitude: -128.6500,
    operator: "District of Kitimat",
    source: "Hirsch Creek",
    population_served: 8000
  },
  {
    id: "water-smithers",
    name: "Smithers Water Treatment",
    type: "treatment_plant",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    latitude: 54.7833,
    longitude: -127.1667,
    operator: "Town of Smithers",
    source: "Bulkley River",
    population_served: 5500
  },

  // ==========================================
  // PEACE RIVER
  // ==========================================
  {
    id: "water-fort-st-john",
    name: "Fort St. John Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.2333,
    longitude: -120.8500,
    operator: "City of Fort St. John",
    source: "Peace River",
    population_served: 22000
  },
  {
    id: "water-dawson-creek",
    name: "Dawson Creek Water Treatment",
    type: "treatment_plant",
    municipality: "Dawson Creek",
    region: "Peace River",
    latitude: 55.7667,
    longitude: -120.2333,
    operator: "City of Dawson Creek",
    source: "Kiskatinaw River",
    population_served: 12500
  },

  // ==========================================
  // SUNSHINE COAST / POWELL RIVER
  // ==========================================
  {
    id: "water-powell-river",
    name: "Powell River Water System",
    type: "treatment_plant",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8333,
    longitude: -124.5333,
    operator: "City of Powell River",
    source: "Powell Lake",
    population_served: 14000
  },
  {
    id: "water-sechelt",
    name: "Sechelt Water System",
    type: "treatment_plant",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    latitude: 49.4667,
    longitude: -123.7500,
    operator: "District of Sechelt",
    source: "Chapman Creek",
    population_served: 10000
  },

  // ==========================================
  // SQUAMISH-LILLOOET
  // ==========================================
  {
    id: "water-squamish",
    name: "Squamish Water Treatment Plant",
    type: "treatment_plant",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.7000,
    longitude: -123.1500,
    operator: "District of Squamish",
    source: "Stawamus River",
    population_served: 22000
  },
  {
    id: "water-whistler",
    name: "Whistler Water Treatment",
    type: "treatment_plant",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    latitude: 50.1167,
    longitude: -122.9500,
    operator: "Resort Municipality of Whistler",
    source: "21 Mile Creek",
    population_served: 13000,
    notes: "Serves permanent and seasonal population"
  },
  {
    id: "water-pemberton",
    name: "Pemberton Water System",
    type: "treatment_plant",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    latitude: 50.3167,
    longitude: -122.8000,
    operator: "Village of Pemberton",
    source: "Groundwater",
    population_served: 3000
  }
];

export function getWaterFacilitiesByMunicipality(municipalityName: string): WaterFacility[] {
  const searchName = municipalityName.toLowerCase();
  return BC_WATER_FACILITIES.filter(f => 
    f.municipality.toLowerCase() === searchName ||
    f.municipality.toLowerCase().includes(searchName) ||
    searchName.includes(f.municipality.toLowerCase())
  );
}

export function getWaterFacilitiesByRegion(regionName: string): WaterFacility[] {
  const searchName = regionName.toLowerCase();
  return BC_WATER_FACILITIES.filter(f => 
    f.region.toLowerCase() === searchName ||
    f.region.toLowerCase().includes(searchName)
  );
}

export function getWaterFacilitiesByType(type: WaterFacilityType): WaterFacility[] {
  return BC_WATER_FACILITIES.filter(f => f.type === type);
}
