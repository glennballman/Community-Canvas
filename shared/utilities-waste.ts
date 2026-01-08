export type WasteFacilityType = 
  | 'landfill'
  | 'transfer_station'
  | 'recycling_depot'
  | 'composting'
  | 'hazardous_waste'
  | 'wastewater_plant';

export interface WasteFacility {
  id: string;
  name: string;
  type: WasteFacilityType;
  municipality: string;
  region: string;
  latitude: number;
  longitude: number;
  operator?: string;
  capacity_tonnes_day?: number;
  accepts_public?: boolean;
  cc_services?: string[];
  phone?: string;
  notes?: string;
}

export const BC_WASTE_FACILITIES: WasteFacility[] = [
  // ==========================================
  // METRO VANCOUVER WASTE FACILITIES
  // ==========================================
  {
    id: "waste-vancouver-landfill",
    name: "Vancouver Landfill",
    type: "landfill",
    municipality: "Delta",
    region: "Metro Vancouver",
    latitude: 49.1167,
    longitude: -123.0833,
    operator: "City of Vancouver",
    capacity_tonnes_day: 2500,
    accepts_public: true,
    notes: "Largest active landfill in Metro Vancouver"
  },
  {
    id: "waste-cache-creek",
    name: "Cache Creek Landfill",
    type: "landfill",
    municipality: "Cache Creek",
    region: "Thompson-Nicola",
    latitude: 50.7833,
    longitude: -121.2833,
    operator: "Belkorp Environmental Services",
    capacity_tonnes_day: 3000,
    accepts_public: false,
    notes: "Receives waste from Metro Vancouver by rail"
  },
  {
    id: "waste-burnaby-eco",
    name: "Burnaby Eco-Centre",
    type: "recycling_depot",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2333,
    longitude: -122.9833,
    operator: "Metro Vancouver",
    accepts_public: true,
    cc_services: ["Recycling", "Household hazardous waste", "Electronics"]
  },
  {
    id: "waste-north-shore-transfer",
    name: "North Shore Transfer Station",
    type: "transfer_station",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3167,
    longitude: -123.0667,
    operator: "Metro Vancouver",
    accepts_public: true,
    cc_services: ["Garbage", "Recycling", "Yard waste", "Large items"]
  },
  {
    id: "waste-surrey-transfer",
    name: "Surrey Transfer Station",
    type: "transfer_station",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1333,
    longitude: -122.8167,
    operator: "Metro Vancouver",
    accepts_public: true,
    cc_services: ["Garbage", "Recycling", "Green waste"]
  },
  {
    id: "waste-coquitlam-transfer",
    name: "Coquitlam Transfer Station",
    type: "transfer_station",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    latitude: 49.2667,
    longitude: -122.7833,
    operator: "Metro Vancouver",
    accepts_public: true
  },
  {
    id: "waste-langley-transfer",
    name: "Langley Transfer Station",
    type: "transfer_station",
    municipality: "Langley",
    region: "Metro Vancouver",
    latitude: 49.0833,
    longitude: -122.6500,
    operator: "Metro Vancouver",
    accepts_public: true
  },
  {
    id: "waste-maple-ridge-transfer",
    name: "Maple Ridge Transfer Station",
    type: "transfer_station",
    municipality: "Maple Ridge",
    region: "Metro Vancouver",
    latitude: 49.2167,
    longitude: -122.6000,
    operator: "Metro Vancouver",
    accepts_public: true
  },
  {
    id: "waste-annacis-wastewater",
    name: "Annacis Island Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "Delta",
    region: "Metro Vancouver",
    latitude: 49.1833,
    longitude: -122.9333,
    operator: "Metro Vancouver",
    capacity_tonnes_day: 500000,
    notes: "Largest wastewater plant in BC - serves 1.4 million cc_people"
  },
  {
    id: "waste-lions-gate-wastewater",
    name: "Lions Gate Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3167,
    longitude: -123.1333,
    operator: "Metro Vancouver",
    notes: "Secondary treatment facility"
  },
  {
    id: "waste-lulu-wastewater",
    name: "Lulu Island Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1500,
    longitude: -123.1333,
    operator: "Metro Vancouver"
  },
  {
    id: "waste-iona-wastewater",
    name: "Iona Island Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.2167,
    longitude: -123.2167,
    operator: "Metro Vancouver",
    notes: "Primary treatment - being upgraded to secondary"
  },

  // ==========================================
  // FRASER VALLEY
  // ==========================================
  {
    id: "waste-abbotsford-mission",
    name: "Abbotsford-Mission Landfill",
    type: "landfill",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    latitude: 49.0167,
    longitude: -122.2667,
    operator: "Fraser Valley Regional District",
    accepts_public: true
  },
  {
    id: "waste-chilliwack-landfill",
    name: "Chilliwack Landfill",
    type: "landfill",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    latitude: 49.1500,
    longitude: -121.9667,
    operator: "Fraser Valley Regional District",
    accepts_public: true
  },
  {
    id: "waste-hope-transfer",
    name: "Hope Transfer Station",
    type: "transfer_station",
    municipality: "Hope",
    region: "Fraser Valley",
    latitude: 49.3833,
    longitude: -121.4500,
    operator: "Fraser Valley Regional District",
    accepts_public: true
  },

  // ==========================================
  // CAPITAL REGION (VICTORIA)
  // ==========================================
  {
    id: "waste-hartland-landfill",
    name: "Hartland Landfill",
    type: "landfill",
    municipality: "Saanich",
    region: "Capital",
    latitude: 48.5333,
    longitude: -123.4833,
    operator: "Capital Regional District",
    accepts_public: true,
    cc_services: ["Garbage", "Recycling", "Yard waste", "Hazardous waste"],
    notes: "Only landfill serving Greater Victoria"
  },
  {
    id: "waste-mcloughlin-wastewater",
    name: "McLoughlin Point Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "Esquimalt",
    region: "Capital",
    latitude: 48.4167,
    longitude: -123.4333,
    operator: "Capital Regional District",
    notes: "Tertiary treatment facility opened 2020"
  },
  {
    id: "waste-clover-wastewater",
    name: "Clover Point Outfall",
    type: "wastewater_plant",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4000,
    longitude: -123.3500,
    operator: "Capital Regional District",
    notes: "Screening facility - pumps to McLoughlin Point"
  },

  // ==========================================
  // VANCOUVER ISLAND
  // ==========================================
  {
    id: "waste-nanaimo-landfill",
    name: "Nanaimo Regional Landfill",
    type: "landfill",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1000,
    longitude: -124.0333,
    operator: "Regional District of Nanaimo",
    accepts_public: true
  },
  {
    id: "waste-campbell-river-landfill",
    name: "Campbell River Landfill",
    type: "landfill",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0000,
    longitude: -125.2833,
    operator: "City of Campbell River",
    accepts_public: true
  },
  {
    id: "waste-comox-valley-landfill",
    name: "Comox Valley Waste Management Centre",
    type: "landfill",
    municipality: "Cumberland",
    region: "Comox Valley",
    latitude: 49.6167,
    longitude: -125.0167,
    operator: "Comox Valley Regional District",
    accepts_public: true
  },
  {
    id: "waste-alberni-landfill",
    name: "Alberni Valley Landfill",
    type: "landfill",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2333,
    longitude: -124.8333,
    operator: "Alberni-Clayoquot Regional District",
    accepts_public: true
  },

  // ==========================================
  // OKANAGAN
  // ==========================================
  {
    id: "waste-kelowna-glenmore",
    name: "Glenmore Landfill",
    type: "landfill",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.9333,
    longitude: -119.4333,
    operator: "Regional District of Central Okanagan",
    accepts_public: true
  },
  {
    id: "waste-vernon-landfill",
    name: "Greater Vernon Landfill",
    type: "landfill",
    municipality: "Vernon",
    region: "North Okanagan",
    latitude: 50.2500,
    longitude: -119.3167,
    operator: "Regional District of North Okanagan",
    accepts_public: true
  },
  {
    id: "waste-penticton-landfill",
    name: "Campbell Mountain Landfill",
    type: "landfill",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    latitude: 49.5167,
    longitude: -119.5500,
    operator: "Regional District of Okanagan-Similkameen",
    accepts_public: true
  },
  {
    id: "waste-kelowna-wastewater",
    name: "Kelowna Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8833,
    longitude: -119.4667,
    operator: "City of Kelowna"
  },

  // ==========================================
  // THOMPSON-NICOLA
  // ==========================================
  {
    id: "waste-kamloops-landfill",
    name: "Kamloops Landfill",
    type: "landfill",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6833,
    longitude: -120.2667,
    operator: "City of Kamloops",
    accepts_public: true
  },
  {
    id: "waste-kamloops-wastewater",
    name: "Kamloops Wastewater Treatment Centre",
    type: "wastewater_plant",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6667,
    longitude: -120.3500,
    operator: "City of Kamloops"
  },

  // ==========================================
  // KOOTENAYS
  // ==========================================
  {
    id: "waste-nelson-landfill",
    name: "Nelson Area Landfill",
    type: "landfill",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.5000,
    longitude: -117.3000,
    operator: "Regional District of Central Kootenay",
    accepts_public: true
  },
  {
    id: "waste-cranbrook-landfill",
    name: "Cranbrook Regional Landfill",
    type: "landfill",
    municipality: "Cranbrook",
    region: "East Kootenay",
    latitude: 49.5333,
    longitude: -115.7500,
    operator: "Regional District of East Kootenay",
    accepts_public: true
  },
  {
    id: "waste-trail-wastewater",
    name: "Trail Wastewater Treatment Plant",
    type: "wastewater_plant",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0833,
    longitude: -117.7167,
    operator: "City of Trail"
  },

  // ==========================================
  // CARIBOO
  // ==========================================
  {
    id: "waste-williams-lake-landfill",
    name: "Williams Lake Landfill",
    type: "landfill",
    municipality: "Williams Lake",
    region: "Cariboo",
    latitude: 52.1333,
    longitude: -122.1333,
    operator: "Cariboo Regional District",
    accepts_public: true
  },
  {
    id: "waste-quesnel-landfill",
    name: "Quesnel Area Landfill",
    type: "landfill",
    municipality: "Quesnel",
    region: "Cariboo",
    latitude: 52.9667,
    longitude: -122.5000,
    operator: "Cariboo Regional District",
    accepts_public: true
  },

  // ==========================================
  // NORTHERN BC
  // ==========================================
  {
    id: "waste-prince-george-landfill",
    name: "Prince George Regional Landfill",
    type: "landfill",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.8833,
    longitude: -122.7833,
    operator: "Regional District of Fraser-Fort George",
    accepts_public: true,
    notes: "Largest landfill in Northern BC"
  },
  {
    id: "waste-prince-george-wastewater",
    name: "Prince George Wastewater Treatment",
    type: "wastewater_plant",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.9000,
    longitude: -122.7500,
    operator: "City of Prince George"
  },
  {
    id: "waste-prince-rupert-landfill",
    name: "Prince Rupert Landfill",
    type: "landfill",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3000,
    longitude: -130.3333,
    operator: "City of Prince Rupert",
    accepts_public: true
  },
  {
    id: "waste-terrace-landfill",
    name: "Terrace Regional Landfill",
    type: "landfill",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    latitude: 54.5333,
    longitude: -128.5833,
    operator: "Regional District of Kitimat-Stikine",
    accepts_public: true
  },
  {
    id: "waste-smithers-landfill",
    name: "Smithers Area Landfill",
    type: "landfill",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    latitude: 54.7667,
    longitude: -127.1833,
    operator: "Regional District of Bulkley-Nechako",
    accepts_public: true
  },

  // ==========================================
  // PEACE RIVER
  // ==========================================
  {
    id: "waste-fort-st-john-landfill",
    name: "Fort St. John Landfill",
    type: "landfill",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.2500,
    longitude: -120.8333,
    operator: "Peace River Regional District",
    accepts_public: true
  },
  {
    id: "waste-dawson-creek-landfill",
    name: "Dawson Creek Landfill",
    type: "landfill",
    municipality: "Dawson Creek",
    region: "Peace River",
    latitude: 55.7833,
    longitude: -120.2167,
    operator: "Peace River Regional District",
    accepts_public: true
  },

  // ==========================================
  // COMPOSTING FACILITIES
  // ==========================================
  {
    id: "waste-richmond-composting",
    name: "Richmond Organic Biofuel Facility",
    type: "composting",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1667,
    longitude: -123.0833,
    operator: "Harvest Power",
    cc_services: ["Food waste", "Yard waste", "Biogas generation"],
    notes: "Converts organic waste to renewable natural gas"
  },
  {
    id: "waste-surrey-biofuel",
    name: "Surrey Biofuel Facility",
    type: "composting",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1333,
    longitude: -122.8000,
    operator: "City of Surrey",
    cc_services: ["Food waste", "Biogas generation"],
    notes: "District energy from organic waste"
  },

  // ==========================================
  // HAZARDOUS WASTE
  // ==========================================
  {
    id: "waste-burnaby-hazmat",
    name: "Burnaby Household Hazardous Waste Depot",
    type: "hazardous_waste",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2500,
    longitude: -122.9667,
    operator: "Metro Vancouver",
    accepts_public: true,
    cc_services: ["Paint", "Solvents", "Pesticides", "Electronics", "Batteries"]
  },
  {
    id: "waste-surrey-hazmat",
    name: "Surrey Hazardous Waste Drop-Off",
    type: "hazardous_waste",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1333,
    longitude: -122.8000,
    operator: "City of Surrey",
    accepts_public: true,
    cc_services: ["Paint", "Chemicals", "Electronics"]
  }
];

export function getWasteFacilitiesByMunicipality(municipalityName: string): WasteFacility[] {
  const searchName = municipalityName.toLowerCase();
  return BC_WASTE_FACILITIES.filter(f => 
    f.municipality.toLowerCase() === searchName ||
    f.municipality.toLowerCase().includes(searchName) ||
    searchName.includes(f.municipality.toLowerCase())
  );
}

export function getWasteFacilitiesByRegion(regionName: string): WasteFacility[] {
  const searchName = regionName.toLowerCase();
  return BC_WASTE_FACILITIES.filter(f => 
    f.region.toLowerCase() === searchName ||
    f.region.toLowerCase().includes(searchName)
  );
}

export function getWasteFacilitiesByType(type: WasteFacilityType): WasteFacility[] {
  return BC_WASTE_FACILITIES.filter(f => f.type === type);
}
