export type ElectricityFacilityType = 
  | 'hydroelectric_dam'
  | 'generating_station'
  | 'substation'
  | 'wind_farm'
  | 'solar_farm'
  | 'thermal_plant'
  | 'transmission_line';

export interface ElectricityFacility {
  id: string;
  name: string;
  type: ElectricityFacilityType;
  municipality: string;
  region: string;
  latitude: number;
  longitude: number;
  operator?: string;
  capacity_mw?: number;
  voltage_kv?: number;
  river_system?: string;
  commissioned?: number;
  phone?: string;
  notes?: string;
}

export const BC_ELECTRICITY_FACILITIES: ElectricityFacility[] = [
  // ==========================================
  // MAJOR HYDROELECTRIC DAMS - BC HYDRO
  // ==========================================
  {
    id: "elec-wac-bennett",
    name: "W.A.C. Bennett Dam",
    type: "hydroelectric_dam",
    municipality: "Hudson's Hope",
    region: "Peace River",
    latitude: 56.0167,
    longitude: -122.2000,
    operator: "BC Hydro",
    capacity_mw: 2730,
    river_system: "Peace River",
    commissioned: 1968,
    notes: "Largest dam in BC, impounds Williston Lake"
  },
  {
    id: "elec-peace-canyon",
    name: "Peace Canyon Dam",
    type: "hydroelectric_dam",
    municipality: "Hudson's Hope",
    region: "Peace River",
    latitude: 56.0333,
    longitude: -122.0333,
    operator: "BC Hydro",
    capacity_mw: 694,
    river_system: "Peace River",
    commissioned: 1980,
    notes: "Downstream of WAC Bennett Dam"
  },
  {
    id: "elec-site-c",
    name: "Site C Dam",
    type: "hydroelectric_dam",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.1833,
    longitude: -120.9333,
    operator: "BC Hydro",
    capacity_mw: 1100,
    river_system: "Peace River",
    commissioned: 2024,
    notes: "Third dam on Peace River - newest major facility"
  },
  {
    id: "elec-mica",
    name: "Mica Dam",
    type: "hydroelectric_dam",
    municipality: "Valemount",
    region: "Columbia-Shuswap",
    latitude: 52.0667,
    longitude: -118.5667,
    operator: "BC Hydro",
    capacity_mw: 2805,
    river_system: "Columbia River",
    commissioned: 1973,
    notes: "Tallest dam in BC at 244m"
  },
  {
    id: "elec-revelstoke",
    name: "Revelstoke Dam",
    type: "hydroelectric_dam",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    latitude: 51.0667,
    longitude: -118.1833,
    operator: "BC Hydro",
    capacity_mw: 2480,
    river_system: "Columbia River",
    commissioned: 1984
  },
  {
    id: "elec-kootenay-canal",
    name: "Kootenay Canal Generating Station",
    type: "generating_station",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4333,
    longitude: -117.3167,
    operator: "BC Hydro",
    capacity_mw: 583,
    river_system: "Kootenay River",
    commissioned: 1976
  },
  {
    id: "elec-seven-mile",
    name: "Seven Mile Dam",
    type: "hydroelectric_dam",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.2333,
    longitude: -117.6333,
    operator: "BC Hydro",
    capacity_mw: 805,
    river_system: "Pend d'Oreille River",
    commissioned: 1979
  },
  {
    id: "elec-gordon-shrum",
    name: "G.M. Shrum Generating Station",
    type: "generating_station",
    municipality: "Hudson's Hope",
    region: "Peace River",
    latitude: 56.0167,
    longitude: -122.2000,
    operator: "BC Hydro",
    capacity_mw: 2730,
    notes: "Located at WAC Bennett Dam - 10 generating units"
  },
  {
    id: "elec-bridge-river",
    name: "Bridge River Generating Stations",
    type: "generating_station",
    municipality: "Lillooet",
    region: "Squamish-Lillooet",
    latitude: 50.8167,
    longitude: -122.6667,
    operator: "BC Hydro",
    capacity_mw: 478,
    river_system: "Bridge River",
    notes: "Includes Seton Canal facility"
  },
  {
    id: "elec-john-hart",
    name: "John Hart Generating Station",
    type: "generating_station",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0500,
    longitude: -125.3500,
    operator: "BC Hydro",
    capacity_mw: 126,
    river_system: "Campbell River",
    commissioned: 2019,
    notes: "Recently replaced original 1947 facility"
  },
  {
    id: "elec-strathcona",
    name: "Strathcona Dam",
    type: "hydroelectric_dam",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 49.9833,
    longitude: -125.5667,
    operator: "BC Hydro",
    capacity_mw: 68,
    river_system: "Campbell River",
    commissioned: 1958
  },
  {
    id: "elec-ladore",
    name: "Ladore Dam",
    type: "hydroelectric_dam",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0167,
    longitude: -125.4333,
    operator: "BC Hydro",
    capacity_mw: 52,
    river_system: "Campbell River"
  },
  {
    id: "elec-ruskin",
    name: "Ruskin Dam",
    type: "hydroelectric_dam",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1500,
    longitude: -122.4000,
    operator: "BC Hydro",
    capacity_mw: 105,
    river_system: "Stave River",
    commissioned: 1930
  },
  {
    id: "elec-stave-falls",
    name: "Stave Falls Dam",
    type: "hydroelectric_dam",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1833,
    longitude: -122.3500,
    operator: "BC Hydro",
    capacity_mw: 55,
    river_system: "Stave River",
    commissioned: 1912,
    notes: "Historic facility - one of BC's oldest"
  },
  {
    id: "elec-alouette",
    name: "Alouette Dam",
    type: "hydroelectric_dam",
    municipality: "Maple Ridge",
    region: "Metro Vancouver",
    latitude: 49.3333,
    longitude: -122.4667,
    operator: "BC Hydro",
    river_system: "Alouette River",
    notes: "Water storage for Stave-Ruskin system"
  },
  {
    id: "elec-cheakamus",
    name: "Cheakamus Generating Station",
    type: "generating_station",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.7833,
    longitude: -123.1500,
    operator: "BC Hydro",
    capacity_mw: 157,
    river_system: "Cheakamus River"
  },
  {
    id: "elec-buntzen",
    name: "Buntzen Generating Station",
    type: "generating_station",
    municipality: "Port Moody",
    region: "Metro Vancouver",
    latitude: 49.3333,
    longitude: -122.8667,
    operator: "BC Hydro",
    capacity_mw: 73,
    commissioned: 1903,
    notes: "Historic powerhouse serving Vancouver since 1903"
  },

  // ==========================================
  // MAJOR SUBSTATIONS
  // ==========================================
  {
    id: "elec-ingledow-sub",
    name: "Ingledow Substation",
    type: "substation",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1333,
    longitude: -122.8667,
    operator: "BC Hydro",
    voltage_kv: 500,
    notes: "Major transmission hub for Lower Mainland"
  },
  {
    id: "elec-arnott-sub",
    name: "Arnott Substation",
    type: "substation",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2500,
    longitude: -122.9333,
    operator: "BC Hydro",
    voltage_kv: 230
  },
  {
    id: "elec-meridian-sub",
    name: "Meridian Substation",
    type: "substation",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    latitude: 49.2833,
    longitude: -122.7833,
    operator: "BC Hydro",
    voltage_kv: 230
  },
  {
    id: "elec-sperling-sub",
    name: "Sperling Substation",
    type: "substation",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2167,
    longitude: -122.9500,
    operator: "BC Hydro",
    voltage_kv: 230
  },
  {
    id: "elec-langley-sub",
    name: "Langley Substation",
    type: "substation",
    municipality: "Langley",
    region: "Metro Vancouver",
    latitude: 49.0833,
    longitude: -122.6500,
    operator: "BC Hydro",
    voltage_kv: 230
  },
  {
    id: "elec-dunsmuir-sub",
    name: "Dunsmuir Substation",
    type: "substation",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1167,
    longitude: -123.9500,
    operator: "BC Hydro",
    voltage_kv: 230,
    notes: "Major hub for Vancouver Island"
  },
  {
    id: "elec-downtown-sub",
    name: "Cathedral Square Substation",
    type: "substation",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2833,
    longitude: -123.1167,
    operator: "BC Hydro",
    voltage_kv: 230,
    notes: "Underground substation serving downtown Vancouver"
  },
  {
    id: "elec-kamloops-sub",
    name: "Kamloops Substation",
    type: "substation",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6833,
    longitude: -120.3333,
    operator: "BC Hydro",
    voltage_kv: 500
  },
  {
    id: "elec-kelowna-sub",
    name: "Kelowna Substation",
    type: "substation",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8667,
    longitude: -119.4833,
    operator: "BC Hydro",
    voltage_kv: 230
  },
  {
    id: "elec-selkirk-sub",
    name: "Selkirk Substation",
    type: "substation",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    latitude: 51.0000,
    longitude: -118.2000,
    operator: "BC Hydro",
    voltage_kv: 500,
    notes: "Key node on Interior-Coast transmission"
  },
  {
    id: "elec-prince-george-sub",
    name: "Williston Substation",
    type: "substation",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.9167,
    longitude: -122.7500,
    operator: "BC Hydro",
    voltage_kv: 500,
    notes: "Northern transmission hub"
  },

  // ==========================================
  // WIND FARMS
  // ==========================================
  {
    id: "elec-bear-mountain-wind",
    name: "Bear Mountain Wind Park",
    type: "wind_farm",
    municipality: "Dawson Creek",
    region: "Peace River",
    latitude: 55.7667,
    longitude: -120.1500,
    operator: "AltaGas",
    capacity_mw: 102,
    commissioned: 2009,
    notes: "34 wind turbines - BC's largest wind farm"
  },
  {
    id: "elec-dokie-wind",
    name: "Dokie Wind Energy Project",
    type: "wind_farm",
    municipality: "Chetwynd",
    region: "Peace River",
    latitude: 55.5000,
    longitude: -121.5000,
    operator: "Dokie General Partnership",
    capacity_mw: 144,
    commissioned: 2011
  },
  {
    id: "elec-quality-wind",
    name: "Quality Wind Project",
    type: "wind_farm",
    municipality: "Tumbler Ridge",
    region: "Peace River",
    latitude: 55.1000,
    longitude: -120.8333,
    operator: "Capital Power",
    capacity_mw: 142,
    commissioned: 2012
  },
  {
    id: "elec-cape-scott-wind",
    name: "Cape Scott Wind Farm",
    type: "wind_farm",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    latitude: 50.7833,
    longitude: -127.9500,
    operator: "GDF Suez",
    capacity_mw: 99,
    commissioned: 2013
  },
  {
    id: "elec-meikle-wind",
    name: "Meikle Wind Project",
    type: "wind_farm",
    municipality: "Tumbler Ridge",
    region: "Peace River",
    latitude: 55.0500,
    longitude: -120.7500,
    operator: "Pattern Energy",
    capacity_mw: 185,
    commissioned: 2016
  },

  // ==========================================
  // INDEPENDENT POWER PRODUCERS
  // ==========================================
  {
    id: "elec-alcan-kemano",
    name: "Kemano Generating Station",
    type: "generating_station",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 53.5500,
    longitude: -127.9500,
    operator: "Rio Tinto Alcan",
    capacity_mw: 896,
    river_system: "Nechako River",
    commissioned: 1954,
    notes: "Powers aluminum smelter - largest private generating station in BC"
  },
  {
    id: "elec-teck-waneta",
    name: "Waneta Dam",
    type: "hydroelectric_dam",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0167,
    longitude: -117.6167,
    operator: "BC Hydro/Teck Resources",
    capacity_mw: 450,
    river_system: "Pend d'Oreille River",
    commissioned: 1954
  },
  {
    id: "elec-waneta-expansion",
    name: "Waneta Expansion",
    type: "generating_station",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0167,
    longitude: -117.6000,
    operator: "BC Hydro/Fortis",
    capacity_mw: 335,
    river_system: "Pend d'Oreille River",
    commissioned: 2015
  },
  {
    id: "elec-falls-river",
    name: "Falls River Project",
    type: "generating_station",
    municipality: "Ocean Falls",
    region: "Central Coast",
    latitude: 52.3500,
    longitude: -127.6833,
    operator: "Boralex",
    capacity_mw: 23,
    river_system: "Link River"
  },
  {
    id: "elec-ashlu-creek",
    name: "Ashlu Creek Hydroelectric",
    type: "generating_station",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.8167,
    longitude: -123.4000,
    operator: "Innergex",
    capacity_mw: 49,
    river_system: "Ashlu Creek",
    commissioned: 2009
  },
  {
    id: "elec-upper-lillooet",
    name: "Upper Lillooet River Project",
    type: "generating_station",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    latitude: 50.5000,
    longitude: -122.7500,
    operator: "Innergex",
    capacity_mw: 81.4,
    river_system: "Lillooet River",
    commissioned: 2017
  },
  {
    id: "elec-boulder-creek",
    name: "Boulder Creek Project",
    type: "generating_station",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    latitude: 50.4833,
    longitude: -122.7333,
    operator: "Innergex",
    capacity_mw: 25,
    river_system: "Boulder Creek",
    commissioned: 2017
  },
  {
    id: "elec-forrest-kerr",
    name: "Forrest Kerr Hydroelectric",
    type: "generating_station",
    municipality: "Stewart",
    region: "Kitimat-Stikine",
    latitude: 56.3500,
    longitude: -130.3667,
    operator: "AltaGas",
    capacity_mw: 195,
    river_system: "Forrest Kerr Creek",
    commissioned: 2014
  },
  {
    id: "elec-volcano-creek",
    name: "Volcano Creek Hydroelectric",
    type: "generating_station",
    municipality: "Stewart",
    region: "Kitimat-Stikine",
    latitude: 56.3667,
    longitude: -130.4000,
    operator: "AltaGas",
    capacity_mw: 16,
    commissioned: 2015
  },
  {
    id: "elec-mclure-creek",
    name: "McLymont Creek Hydroelectric",
    type: "generating_station",
    municipality: "Stewart",
    region: "Kitimat-Stikine",
    latitude: 56.4167,
    longitude: -130.4500,
    operator: "AltaGas",
    capacity_mw: 66,
    commissioned: 2016
  },

  // ==========================================
  // FORTISBC SERVICE AREA
  // ==========================================
  {
    id: "elec-kootenay-river-dams",
    name: "Kootenay River Power Plants",
    type: "generating_station",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4833,
    longitude: -117.3000,
    operator: "FortisBC",
    capacity_mw: 205,
    river_system: "Kootenay River",
    notes: "Includes Corra Linn, Upper and Lower Bonnington"
  },
  {
    id: "elec-south-slocan",
    name: "South Slocan Dam",
    type: "hydroelectric_dam",
    municipality: "Castlegar",
    region: "Central Kootenay",
    latitude: 49.3667,
    longitude: -117.5333,
    operator: "FortisBC",
    capacity_mw: 56,
    river_system: "Kootenay River"
  },
  {
    id: "elec-okanagan-sub",
    name: "Okanagan Main Substation",
    type: "substation",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8833,
    longitude: -119.4833,
    operator: "FortisBC",
    voltage_kv: 138,
    notes: "Serves Okanagan interior region"
  },

  // ==========================================
  // THERMAL / GAS PLANTS
  // ==========================================
  {
    id: "elec-island-cogen",
    name: "Island Cogeneration Plant",
    type: "thermal_plant",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0167,
    longitude: -125.2500,
    operator: "Capital Power",
    capacity_mw: 275,
    commissioned: 2002,
    notes: "Natural gas combined cycle"
  },
  {
    id: "elec-burrard-thermal",
    name: "Burrard Thermal Generating Station",
    type: "thermal_plant",
    municipality: "Port Moody",
    region: "Metro Vancouver",
    latitude: 49.2833,
    longitude: -122.8833,
    operator: "BC Hydro",
    capacity_mw: 912,
    commissioned: 1961,
    notes: "Backup capacity only - natural gas"
  },
  {
    id: "elec-prince-rupert-gas",
    name: "Prince Rupert Gas Transmission",
    type: "generating_station",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.2833,
    longitude: -130.3000,
    operator: "BC Hydro",
    capacity_mw: 60,
    notes: "LNG export facility power supply"
  }
];

export function getElectricityFacilitiesByMunicipality(municipalityName: string): ElectricityFacility[] {
  const searchName = municipalityName.toLowerCase();
  return BC_ELECTRICITY_FACILITIES.filter(f => 
    f.municipality.toLowerCase() === searchName ||
    f.municipality.toLowerCase().includes(searchName) ||
    searchName.includes(f.municipality.toLowerCase())
  );
}

export function getElectricityFacilitiesByRegion(regionName: string): ElectricityFacility[] {
  const searchName = regionName.toLowerCase();
  return BC_ELECTRICITY_FACILITIES.filter(f => 
    f.region.toLowerCase() === searchName ||
    f.region.toLowerCase().includes(searchName)
  );
}

export function getElectricityFacilitiesByType(type: ElectricityFacilityType): ElectricityFacility[] {
  return BC_ELECTRICITY_FACILITIES.filter(f => f.type === type);
}

export function getTotalCapacity(): number {
  return BC_ELECTRICITY_FACILITIES
    .filter(f => f.capacity_mw)
    .reduce((sum, f) => sum + (f.capacity_mw || 0), 0);
}
