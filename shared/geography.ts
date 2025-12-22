// Geographic Hierarchy Model
// Levels: Earth → Country → Province → Region → Municipality → Community → Address

export type GeoLevel = 
  | "planet" 
  | "country" 
  | "province" 
  | "region" 
  | "municipality" 
  | "community" 
  | "address";

export interface GeoNode {
  id: string;
  name: string;
  shortName?: string;
  level: GeoLevel;
  parentId: string | null;
  children?: string[];
  metadata?: {
    population?: number;
    area_km2?: number;
    timezone?: string;
    coordinates?: { lat: number; lng: number };
  };
}

// The complete geographic hierarchy for BC
export const GEO_HIERARCHY: Record<string, GeoNode> = {
  // Level 0: Planet
  "earth": {
    id: "earth",
    name: "Earth",
    level: "planet",
    parentId: null,
    children: ["canada"]
  },

  // Level 1: Country
  "canada": {
    id: "canada",
    name: "Canada",
    level: "country",
    parentId: "earth",
    children: ["bc"]
  },

  // Level 2: Province
  "bc": {
    id: "bc",
    name: "British Columbia",
    shortName: "BC",
    level: "province",
    parentId: "canada",
    children: [
      "metro-vancouver",
      "fraser-valley",
      "capital",
      "vancouver-island-north",
      "sunshine-coast",
      "squamish-lillooet"
    ]
  },

  // Level 3: Regional Districts
  "metro-vancouver": {
    id: "metro-vancouver",
    name: "Metro Vancouver",
    shortName: "Metro Van",
    level: "region",
    parentId: "bc",
    children: [
      "muni-vancouver",
      "muni-burnaby",
      "muni-surrey",
      "muni-richmond",
      "muni-coquitlam",
      "muni-delta",
      "muni-north-vancouver-city",
      "muni-north-vancouver-district",
      "muni-west-vancouver",
      "muni-new-westminster",
      "muni-port-coquitlam",
      "muni-port-moody",
      "muni-maple-ridge",
      "muni-pitt-meadows",
      "muni-langley-city",
      "muni-langley-township",
      "muni-white-rock",
      "muni-bowen-island",
      "muni-lions-bay",
      "muni-anmore",
      "muni-belcarra"
    ]
  },

  "fraser-valley": {
    id: "fraser-valley",
    name: "Fraser Valley Regional District",
    shortName: "Fraser Valley",
    level: "region",
    parentId: "bc",
    children: [
      "muni-abbotsford",
      "muni-chilliwack",
      "muni-mission",
      "muni-hope",
      "muni-kent",
      "muni-harrison-hot-springs"
    ]
  },

  "capital": {
    id: "capital",
    name: "Capital Regional District",
    shortName: "CRD",
    level: "region",
    parentId: "bc",
    children: [
      "muni-victoria",
      "muni-saanich",
      "muni-esquimalt",
      "muni-oak-bay",
      "muni-view-royal",
      "muni-colwood",
      "muni-langford",
      "muni-sooke",
      "muni-metchosin",
      "muni-highlands",
      "muni-central-saanich",
      "muni-north-saanich",
      "muni-sidney"
    ]
  },

  "vancouver-island-north": {
    id: "vancouver-island-north",
    name: "Northern Vancouver Island",
    shortName: "North Island",
    level: "region",
    parentId: "bc",
    children: [
      "muni-nanaimo",
      "muni-parksville",
      "muni-qualicum-beach",
      "muni-courtenay",
      "muni-campbell-river",
      "muni-port-alberni"
    ]
  },

  "sunshine-coast": {
    id: "sunshine-coast",
    name: "Sunshine Coast Regional District",
    shortName: "Sunshine Coast",
    level: "region",
    parentId: "bc",
    children: [
      "muni-gibsons",
      "muni-sechelt"
    ]
  },

  "squamish-lillooet": {
    id: "squamish-lillooet",
    name: "Squamish-Lillooet Regional District",
    shortName: "Sea-to-Sky",
    level: "region",
    parentId: "bc",
    children: [
      "muni-squamish",
      "muni-whistler",
      "muni-pemberton",
      "muni-lillooet"
    ]
  },

  // Level 4: Municipalities - Metro Vancouver
  "muni-vancouver": {
    id: "muni-vancouver",
    name: "City of Vancouver",
    shortName: "Vancouver",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 662248 }
  },
  "muni-burnaby": {
    id: "muni-burnaby",
    name: "City of Burnaby",
    shortName: "Burnaby",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 249125 }
  },
  "muni-surrey": {
    id: "muni-surrey",
    name: "City of Surrey",
    shortName: "Surrey",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 568322 }
  },
  "muni-richmond": {
    id: "muni-richmond",
    name: "City of Richmond",
    shortName: "Richmond",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 209937 }
  },
  "muni-coquitlam": {
    id: "muni-coquitlam",
    name: "City of Coquitlam",
    shortName: "Coquitlam",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 148625 }
  },
  "muni-delta": {
    id: "muni-delta",
    name: "Corporation of Delta",
    shortName: "Delta",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 108455 }
  },
  "muni-north-vancouver-city": {
    id: "muni-north-vancouver-city",
    name: "City of North Vancouver",
    shortName: "N. Van City",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 58120 }
  },
  "muni-north-vancouver-district": {
    id: "muni-north-vancouver-district",
    name: "District of North Vancouver",
    shortName: "N. Van District",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 88168 }
  },
  "muni-west-vancouver": {
    id: "muni-west-vancouver",
    name: "District of West Vancouver",
    shortName: "West Van",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 44122 }
  },
  "muni-new-westminster": {
    id: "muni-new-westminster",
    name: "City of New Westminster",
    shortName: "New West",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 78916 }
  },
  "muni-port-coquitlam": {
    id: "muni-port-coquitlam",
    name: "City of Port Coquitlam",
    shortName: "PoCo",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 61498 }
  },
  "muni-port-moody": {
    id: "muni-port-moody",
    name: "City of Port Moody",
    shortName: "Port Moody",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 33535 }
  },
  "muni-maple-ridge": {
    id: "muni-maple-ridge",
    name: "City of Maple Ridge",
    shortName: "Maple Ridge",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 90990 }
  },
  "muni-pitt-meadows": {
    id: "muni-pitt-meadows",
    name: "City of Pitt Meadows",
    shortName: "Pitt Meadows",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 19146 }
  },
  "muni-langley-city": {
    id: "muni-langley-city",
    name: "City of Langley",
    shortName: "Langley City",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 28963 }
  },
  "muni-langley-township": {
    id: "muni-langley-township",
    name: "Township of Langley",
    shortName: "Langley Twp",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 132603 }
  },
  "muni-white-rock": {
    id: "muni-white-rock",
    name: "City of White Rock",
    shortName: "White Rock",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 21939 }
  },
  "muni-bowen-island": {
    id: "muni-bowen-island",
    name: "Bowen Island Municipality",
    shortName: "Bowen Island",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 4256 }
  },
  "muni-lions-bay": {
    id: "muni-lions-bay",
    name: "Village of Lions Bay",
    shortName: "Lions Bay",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 1390 }
  },
  "muni-anmore": {
    id: "muni-anmore",
    name: "Village of Anmore",
    shortName: "Anmore",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 2350 }
  },
  "muni-belcarra": {
    id: "muni-belcarra",
    name: "Village of Belcarra",
    shortName: "Belcarra",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 732 }
  },

  // Level 4: Municipalities - Fraser Valley
  "muni-abbotsford": {
    id: "muni-abbotsford",
    name: "City of Abbotsford",
    shortName: "Abbotsford",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 153524 }
  },
  "muni-chilliwack": {
    id: "muni-chilliwack",
    name: "City of Chilliwack",
    shortName: "Chilliwack",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 93203 }
  },
  "muni-mission": {
    id: "muni-mission",
    name: "District of Mission",
    shortName: "Mission",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 41200 }
  },
  "muni-hope": {
    id: "muni-hope",
    name: "District of Hope",
    shortName: "Hope",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 7095 }
  },
  "muni-kent": {
    id: "muni-kent",
    name: "District of Kent",
    shortName: "Kent",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 6879 }
  },
  "muni-harrison-hot-springs": {
    id: "muni-harrison-hot-springs",
    name: "Village of Harrison Hot Springs",
    shortName: "Harrison",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 1573 }
  },

  // Level 4: Municipalities - Capital Regional District
  "muni-victoria": {
    id: "muni-victoria",
    name: "City of Victoria",
    shortName: "Victoria",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 91867 }
  },
  "muni-saanich": {
    id: "muni-saanich",
    name: "District of Saanich",
    shortName: "Saanich",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 117735 }
  },
  "muni-esquimalt": {
    id: "muni-esquimalt",
    name: "Township of Esquimalt",
    shortName: "Esquimalt",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 17655 }
  },
  "muni-oak-bay": {
    id: "muni-oak-bay",
    name: "District of Oak Bay",
    shortName: "Oak Bay",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 18015 }
  },
  "muni-view-royal": {
    id: "muni-view-royal",
    name: "Town of View Royal",
    shortName: "View Royal",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 11575 }
  },
  "muni-colwood": {
    id: "muni-colwood",
    name: "City of Colwood",
    shortName: "Colwood",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 18961 }
  },
  "muni-langford": {
    id: "muni-langford",
    name: "City of Langford",
    shortName: "Langford",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 46584 }
  },
  "muni-sooke": {
    id: "muni-sooke",
    name: "District of Sooke",
    shortName: "Sooke",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 15054 }
  },
  "muni-metchosin": {
    id: "muni-metchosin",
    name: "District of Metchosin",
    shortName: "Metchosin",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 5118 }
  },
  "muni-highlands": {
    id: "muni-highlands",
    name: "District of Highlands",
    shortName: "Highlands",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 2481 }
  },
  "muni-central-saanich": {
    id: "muni-central-saanich",
    name: "District of Central Saanich",
    shortName: "Central Saanich",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 17385 }
  },
  "muni-north-saanich": {
    id: "muni-north-saanich",
    name: "District of North Saanich",
    shortName: "North Saanich",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 12055 }
  },
  "muni-sidney": {
    id: "muni-sidney",
    name: "Town of Sidney",
    shortName: "Sidney",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 12082 }
  },

  // Level 4: Municipalities - Northern Vancouver Island
  "muni-nanaimo": {
    id: "muni-nanaimo",
    name: "City of Nanaimo",
    shortName: "Nanaimo",
    level: "municipality",
    parentId: "vancouver-island-north",
    metadata: { population: 99863 }
  },
  "muni-parksville": {
    id: "muni-parksville",
    name: "City of Parksville",
    shortName: "Parksville",
    level: "municipality",
    parentId: "vancouver-island-north",
    metadata: { population: 13642 }
  },
  "muni-qualicum-beach": {
    id: "muni-qualicum-beach",
    name: "Town of Qualicum Beach",
    shortName: "Qualicum",
    level: "municipality",
    parentId: "vancouver-island-north",
    metadata: { population: 9367 }
  },
  "muni-courtenay": {
    id: "muni-courtenay",
    name: "City of Courtenay",
    shortName: "Courtenay",
    level: "municipality",
    parentId: "vancouver-island-north",
    metadata: { population: 28420 }
  },
  "muni-campbell-river": {
    id: "muni-campbell-river",
    name: "City of Campbell River",
    shortName: "Campbell River",
    level: "municipality",
    parentId: "vancouver-island-north",
    metadata: { population: 35519 }
  },
  "muni-port-alberni": {
    id: "muni-port-alberni",
    name: "City of Port Alberni",
    shortName: "Port Alberni",
    level: "municipality",
    parentId: "vancouver-island-north",
    metadata: { population: 18259 }
  },

  // Level 4: Municipalities - Sunshine Coast
  "muni-gibsons": {
    id: "muni-gibsons",
    name: "Town of Gibsons",
    shortName: "Gibsons",
    level: "municipality",
    parentId: "sunshine-coast",
    metadata: { population: 4758 }
  },
  "muni-sechelt": {
    id: "muni-sechelt",
    name: "District of Sechelt",
    shortName: "Sechelt",
    level: "municipality",
    parentId: "sunshine-coast",
    metadata: { population: 10800 }
  },

  // Level 4: Municipalities - Squamish-Lillooet
  "muni-squamish": {
    id: "muni-squamish",
    name: "District of Squamish",
    shortName: "Squamish",
    level: "municipality",
    parentId: "squamish-lillooet",
    metadata: { population: 23819 }
  },
  "muni-whistler": {
    id: "muni-whistler",
    name: "Resort Municipality of Whistler",
    shortName: "Whistler",
    level: "municipality",
    parentId: "squamish-lillooet",
    metadata: { population: 13982 }
  },
  "muni-pemberton": {
    id: "muni-pemberton",
    name: "Village of Pemberton",
    shortName: "Pemberton",
    level: "municipality",
    parentId: "squamish-lillooet",
    metadata: { population: 2574 }
  },
  "muni-lillooet": {
    id: "muni-lillooet",
    name: "District of Lillooet",
    shortName: "Lillooet",
    level: "municipality",
    parentId: "squamish-lillooet",
    metadata: { population: 2321 }
  }
};

// Helper functions
export function getNode(id: string): GeoNode | undefined {
  return GEO_HIERARCHY[id];
}

export function getChildren(nodeId: string): GeoNode[] {
  const node = GEO_HIERARCHY[nodeId];
  if (!node?.children) return [];
  return node.children.map(id => GEO_HIERARCHY[id]).filter(Boolean);
}

export function getParentChain(nodeId: string): GeoNode[] {
  const chain: GeoNode[] = [];
  let current = GEO_HIERARCHY[nodeId];
  
  while (current) {
    chain.unshift(current);
    if (current.parentId) {
      current = GEO_HIERARCHY[current.parentId];
    } else {
      break;
    }
  }
  
  return chain;
}

export function getAllMunicipalitiesInRegion(regionId: string): GeoNode[] {
  const region = GEO_HIERARCHY[regionId];
  if (!region?.children) return [];
  return region.children
    .map(id => GEO_HIERARCHY[id])
    .filter(node => node?.level === "municipality");
}

export function getNodesByLevel(level: GeoLevel): GeoNode[] {
  return Object.values(GEO_HIERARCHY).filter(node => node.level === level);
}

// Map old municipality names to new geo IDs
export const MUNICIPALITY_TO_GEO_ID: Record<string, string> = {
  "City of Abbotsford": "muni-abbotsford",
  "City of Burnaby": "muni-burnaby",
  "City of Chilliwack": "muni-chilliwack",
  "City of Coquitlam": "muni-coquitlam",
  "Corporation of Delta": "muni-delta",
  "City of Langley": "muni-langley-city",
  "Township of Langley": "muni-langley-township",
  "City of Maple Ridge": "muni-maple-ridge",
  "District of Mission": "muni-mission",
  "City of New Westminster": "muni-new-westminster",
  "City of North Vancouver": "muni-north-vancouver-city",
  "District of North Vancouver": "muni-north-vancouver-district",
  "City of Pitt Meadows": "muni-pitt-meadows",
  "City of Port Coquitlam": "muni-port-coquitlam",
  "City of Port Moody": "muni-port-moody",
  "City of Richmond": "muni-richmond",
  "City of Surrey": "muni-surrey",
  "City of Vancouver": "muni-vancouver",
  "District of West Vancouver": "muni-west-vancouver",
  "City of White Rock": "muni-white-rock",
  "City of Victoria": "muni-victoria",
  "District of Saanich": "muni-saanich",
  "City of Nanaimo": "muni-nanaimo",
  "District of Squamish": "muni-squamish",
  "Resort Municipality of Whistler": "muni-whistler",
  "Bowen Island Municipality": "muni-bowen-island",
  "Village of Lions Bay": "muni-lions-bay",
  "Village of Anmore": "muni-anmore",
  "Village of Belcarra": "muni-belcarra",
};

// Source coverage levels - which geo level does a source apply to
export type SourceCoverageLevel = "province" | "region" | "municipality";

export interface SourceGeoMapping {
  sourceCategory: string;
  sourceName: string;
  coverageLevel: SourceCoverageLevel;
  geoIds: string[]; // Which geo nodes this source covers
}
