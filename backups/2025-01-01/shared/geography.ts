export type GeoLevel = "planet" | "country" | "province" | "region" | "municipality" | "community" | "address";

export interface GeoNode {
  id: string;
  name: string;
  shortName?: string;
  level: GeoLevel;
  parentId: string | null;
  children?: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  metadata?: {
    population?: number;
    area?: number;
  };
}

export const GEO_HIERARCHY: Record<string, GeoNode> = {
  "bc": {
    id: "bc",
    name: "British Columbia",
    shortName: "BC",
    level: "province",
    parentId: null,
    children: [
      "metro-vancouver",
      "fraser-valley",
      "capital",
      "cowichan-valley",
      "nanaimo",
      "alberni-clayoquot",
      "comox-valley",
      "strathcona",
      "mount-waddington",
      "powell-river",
      "sunshine-coast",
      "squamish-lillooet",
      "thompson-nicola",
      "central-okanagan",
      "north-okanagan",
      "okanagan-similkameen",
      "columbia-shuswap",
      "east-kootenay",
      "central-kootenay",
      "kootenay-boundary",
      "cariboo",
      "fraser-fort-george",
      "bulkley-nechako",
      "kitimat-stikine",
      "north-coast",
      "peace-river",
      "central-coast",
      "northern-rockies"
    ]
  },

  // Metro Vancouver Regional District (21 municipalities)
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
      "muni-belcarra",
      "muni-tsawwassen"
    ]
  },

  // Fraser Valley Regional District (6 municipalities)
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

  // Capital Regional District (13 municipalities)
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

  // Cowichan Valley Regional District
  "cowichan-valley": {
    id: "cowichan-valley",
    name: "Cowichan Valley Regional District",
    shortName: "Cowichan",
    level: "region",
    parentId: "bc",
    children: [
      "muni-duncan",
      "muni-north-cowichan",
      "muni-lake-cowichan",
      "muni-ladysmith"
    ]
  },

  // Nanaimo Regional District
  "nanaimo": {
    id: "nanaimo",
    name: "Nanaimo Regional District",
    shortName: "Nanaimo RD",
    level: "region",
    parentId: "bc",
    children: [
      "muni-nanaimo",
      "muni-parksville",
      "muni-qualicum-beach",
      "muni-lantzville"
    ]
  },

  // Alberni-Clayoquot Regional District
  "alberni-clayoquot": {
    id: "alberni-clayoquot",
    name: "Alberni-Clayoquot Regional District",
    shortName: "Alberni-Clayoquot",
    level: "region",
    parentId: "bc",
    children: [
      "muni-port-alberni",
      "muni-tofino",
      "muni-ucluelet",
      "muni-bamfield"
    ]
  },

  // Comox Valley Regional District
  "comox-valley": {
    id: "comox-valley",
    name: "Comox Valley Regional District",
    shortName: "Comox Valley",
    level: "region",
    parentId: "bc",
    children: [
      "muni-courtenay",
      "muni-comox",
      "muni-cumberland"
    ]
  },

  // Strathcona Regional District
  "strathcona": {
    id: "strathcona",
    name: "Strathcona Regional District",
    shortName: "Strathcona",
    level: "region",
    parentId: "bc",
    children: [
      "muni-campbell-river",
      "muni-gold-river",
      "muni-tahsis",
      "muni-zeballos",
      "muni-sayward"
    ]
  },

  // Mount Waddington Regional District
  "mount-waddington": {
    id: "mount-waddington",
    name: "Mount Waddington Regional District",
    shortName: "Mt Waddington",
    level: "region",
    parentId: "bc",
    children: [
      "muni-port-hardy",
      "muni-port-mcneill",
      "muni-alert-bay",
      "muni-port-alice"
    ]
  },

  // Powell River Regional District
  "powell-river": {
    id: "powell-river",
    name: "Powell River Regional District",
    shortName: "Powell River",
    level: "region",
    parentId: "bc",
    children: [
      "muni-powell-river"
    ]
  },

  // Sunshine Coast Regional District
  "sunshine-coast": {
    id: "sunshine-coast",
    name: "Sunshine Coast Regional District",
    shortName: "Sunshine Coast",
    level: "region",
    parentId: "bc",
    children: [
      "muni-sechelt",
      "muni-gibsons"
    ]
  },

  // Squamish-Lillooet Regional District
  "squamish-lillooet": {
    id: "squamish-lillooet",
    name: "Squamish-Lillooet Regional District",
    shortName: "SLRD",
    level: "region",
    parentId: "bc",
    children: [
      "muni-squamish",
      "muni-whistler",
      "muni-pemberton",
      "muni-lillooet"
    ]
  },

  // Thompson-Nicola Regional District
  "thompson-nicola": {
    id: "thompson-nicola",
    name: "Thompson-Nicola Regional District",
    shortName: "TNRD",
    level: "region",
    parentId: "bc",
    children: [
      "muni-kamloops",
      "muni-merritt",
      "muni-sun-peaks",
      "muni-ashcroft",
      "muni-cache-creek",
      "muni-chase",
      "muni-clearwater",
      "muni-barriere",
      "muni-clinton",
      "muni-logan-lake",
      "muni-lytton"
    ]
  },

  // Central Okanagan Regional District
  "central-okanagan": {
    id: "central-okanagan",
    name: "Central Okanagan Regional District",
    shortName: "Central Okanagan",
    level: "region",
    parentId: "bc",
    children: [
      "muni-kelowna",
      "muni-west-kelowna",
      "muni-peachland",
      "muni-lake-country"
    ]
  },

  // North Okanagan Regional District
  "north-okanagan": {
    id: "north-okanagan",
    name: "North Okanagan Regional District",
    shortName: "North Okanagan",
    level: "region",
    parentId: "bc",
    children: [
      "muni-vernon",
      "muni-coldstream",
      "muni-armstrong",
      "muni-spallumcheen",
      "muni-enderby",
      "muni-lumby"
    ]
  },

  // Okanagan-Similkameen Regional District
  "okanagan-similkameen": {
    id: "okanagan-similkameen",
    name: "Okanagan-Similkameen Regional District",
    shortName: "Okanagan-Sim",
    level: "region",
    parentId: "bc",
    children: [
      "muni-penticton",
      "muni-summerland",
      "muni-oliver",
      "muni-osoyoos",
      "muni-princeton",
      "muni-keremeos"
    ]
  },

  // Columbia-Shuswap Regional District
  "columbia-shuswap": {
    id: "columbia-shuswap",
    name: "Columbia-Shuswap Regional District",
    shortName: "Columbia-Shuswap",
    level: "region",
    parentId: "bc",
    children: [
      "muni-revelstoke",
      "muni-salmon-arm",
      "muni-golden",
      "muni-sicamous"
    ]
  },

  // Regional District of East Kootenay
  "east-kootenay": {
    id: "east-kootenay",
    name: "Regional District of East Kootenay",
    shortName: "East Kootenay",
    level: "region",
    parentId: "bc",
    children: [
      "muni-cranbrook",
      "muni-kimberley",
      "muni-fernie",
      "muni-invermere",
      "muni-sparwood",
      "muni-elkford",
      "muni-radium-hot-springs",
      "muni-canal-flats"
    ]
  },

  // Regional District of Central Kootenay
  "central-kootenay": {
    id: "central-kootenay",
    name: "Regional District of Central Kootenay",
    shortName: "Central Kootenay",
    level: "region",
    parentId: "bc",
    children: [
      "muni-nelson",
      "muni-castlegar",
      "muni-trail",
      "muni-creston",
      "muni-kaslo",
      "muni-nakusp",
      "muni-new-denver",
      "muni-silverton",
      "muni-salmo",
      "muni-slocan"
    ]
  },

  // Regional District of Kootenay Boundary
  "kootenay-boundary": {
    id: "kootenay-boundary",
    name: "Regional District of Kootenay Boundary",
    shortName: "Kootenay Boundary",
    level: "region",
    parentId: "bc",
    children: [
      "muni-rossland",
      "muni-fruitvale",
      "muni-montrose",
      "muni-warfield",
      "muni-greenwood",
      "muni-midway",
      "muni-grand-forks"
    ]
  },

  // Cariboo Regional District
  "cariboo": {
    id: "cariboo",
    name: "Cariboo Regional District",
    shortName: "Cariboo",
    level: "region",
    parentId: "bc",
    children: [
      "muni-quesnel",
      "muni-williams-lake",
      "muni-100-mile-house",
      "muni-wells"
    ]
  },

  // Fraser-Fort George Regional District
  "fraser-fort-george": {
    id: "fraser-fort-george",
    name: "Fraser-Fort George Regional District",
    shortName: "FFG",
    level: "region",
    parentId: "bc",
    children: [
      "muni-prince-george",
      "muni-valemount",
      "muni-mcbride"
    ]
  },

  // Regional District of Bulkley-Nechako
  "bulkley-nechako": {
    id: "bulkley-nechako",
    name: "Regional District of Bulkley-Nechako",
    shortName: "Bulkley-Nechako",
    level: "region",
    parentId: "bc",
    children: [
      "muni-vanderhoof",
      "muni-fort-st-james",
      "muni-burns-lake",
      "muni-houston",
      "muni-smithers",
      "muni-granisle",
      "muni-fraser-lake"
    ]
  },

  // Kitimat-Stikine Regional District
  "kitimat-stikine": {
    id: "kitimat-stikine",
    name: "Kitimat-Stikine Regional District",
    shortName: "Kitimat-Stikine",
    level: "region",
    parentId: "bc",
    children: [
      "muni-terrace",
      "muni-kitimat",
      "muni-stewart",
      "muni-hazelton",
      "muni-new-hazelton"
    ]
  },

  // North Coast Regional District
  "north-coast": {
    id: "north-coast",
    name: "North Coast Regional District",
    shortName: "North Coast",
    level: "region",
    parentId: "bc",
    children: [
      "muni-prince-rupert",
      "muni-port-edward",
      "muni-masset",
      "muni-queen-charlotte"
    ]
  },

  // Peace River Regional District
  "peace-river": {
    id: "peace-river",
    name: "Peace River Regional District",
    shortName: "Peace River",
    level: "region",
    parentId: "bc",
    children: [
      "muni-dawson-creek",
      "muni-fort-st-john",
      "muni-chetwynd",
      "muni-hudson-hope",
      "muni-pouce-coupe",
      "muni-taylor"
    ]
  },

  // Central Coast Regional District
  "central-coast": {
    id: "central-coast",
    name: "Central Coast Regional District",
    shortName: "Central Coast",
    level: "region",
    parentId: "bc",
    children: [
      "muni-bella-coola",
      "muni-ocean-falls"
    ]
  },

  // Northern Rockies Regional Municipality
  "northern-rockies": {
    id: "northern-rockies",
    name: "Northern Rockies Regional Municipality",
    shortName: "Northern Rockies",
    level: "region",
    parentId: "bc",
    children: [
      "muni-fort-nelson"
    ]
  },

  // ===============================================
  // METRO VANCOUVER MUNICIPALITIES
  // ===============================================
  "muni-vancouver": {
    id: "muni-vancouver",
    name: "City of Vancouver",
    shortName: "Vancouver",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2827, longitude: -123.1207 },
    metadata: { population: 662248 }
  },
  "muni-burnaby": {
    id: "muni-burnaby",
    name: "City of Burnaby",
    shortName: "Burnaby",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2488, longitude: -122.9805 },
    metadata: { population: 249125 }
  },
  "muni-surrey": {
    id: "muni-surrey",
    name: "City of Surrey",
    shortName: "Surrey",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.1044, longitude: -122.8011 },
    metadata: { population: 568322 }
  },
  "muni-richmond": {
    id: "muni-richmond",
    name: "City of Richmond",
    shortName: "Richmond",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.1666, longitude: -123.1336 },
    metadata: { population: 209937 }
  },
  "muni-coquitlam": {
    id: "muni-coquitlam",
    name: "City of Coquitlam",
    shortName: "Coquitlam",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2838, longitude: -122.7932 },
    metadata: { population: 148625 }
  },
  "muni-delta": {
    id: "muni-delta",
    name: "Corporation of Delta",
    shortName: "Delta",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.0847, longitude: -123.0587 },
    metadata: { population: 108455 }
  },
  "muni-north-vancouver-city": {
    id: "muni-north-vancouver-city",
    name: "City of North Vancouver",
    shortName: "N Van City",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.3165, longitude: -123.0688 },
    metadata: { population: 58120 }
  },
  "muni-north-vancouver-district": {
    id: "muni-north-vancouver-district",
    name: "District of North Vancouver",
    shortName: "N Van District",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.3500, longitude: -123.0600 },
    metadata: { population: 88168 }
  },
  "muni-west-vancouver": {
    id: "muni-west-vancouver",
    name: "District of West Vancouver",
    shortName: "West Van",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.3272, longitude: -123.1663 },
    metadata: { population: 44122 }
  },
  "muni-new-westminster": {
    id: "muni-new-westminster",
    name: "City of New Westminster",
    shortName: "New West",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2069, longitude: -122.9110 },
    metadata: { population: 78916 }
  },
  "muni-port-coquitlam": {
    id: "muni-port-coquitlam",
    name: "City of Port Coquitlam",
    shortName: "PoCo",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2628, longitude: -122.7811 },
    metadata: { population: 61498 }
  },
  "muni-port-moody": {
    id: "muni-port-moody",
    name: "City of Port Moody",
    shortName: "Port Moody",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2783, longitude: -122.8312 },
    metadata: { population: 33551 }
  },
  "muni-maple-ridge": {
    id: "muni-maple-ridge",
    name: "City of Maple Ridge",
    shortName: "Maple Ridge",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2193, longitude: -122.5984 },
    metadata: { population: 90990 }
  },
  "muni-pitt-meadows": {
    id: "muni-pitt-meadows",
    name: "City of Pitt Meadows",
    shortName: "Pitt Meadows",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.2211, longitude: -122.6897 },
    metadata: { population: 19146 }
  },
  "muni-langley-city": {
    id: "muni-langley-city",
    name: "City of Langley",
    shortName: "Langley City",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.1044, longitude: -122.6600 },
    metadata: { population: 28963 }
  },
  "muni-langley-township": {
    id: "muni-langley-township",
    name: "Township of Langley",
    shortName: "Langley Twp",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.1044, longitude: -122.5600 },
    metadata: { population: 145860 }
  },
  "muni-white-rock": {
    id: "muni-white-rock",
    name: "City of White Rock",
    shortName: "White Rock",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.0254, longitude: -122.8030 },
    metadata: { population: 21939 }
  },
  "muni-bowen-island": {
    id: "muni-bowen-island",
    name: "Bowen Island Municipality",
    shortName: "Bowen Island",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.3848, longitude: -123.3361 },
    metadata: { population: 4256 }
  },
  "muni-lions-bay": {
    id: "muni-lions-bay",
    name: "Village of Lions Bay",
    shortName: "Lions Bay",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.4548, longitude: -123.2378 },
    metadata: { population: 1334 }
  },
  "muni-anmore": {
    id: "muni-anmore",
    name: "Village of Anmore",
    shortName: "Anmore",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.3137, longitude: -122.8513 },
    metadata: { population: 2350 }
  },
  "muni-belcarra": {
    id: "muni-belcarra",
    name: "Village of Belcarra",
    shortName: "Belcarra",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.3167, longitude: -122.8333 },
    metadata: { population: 732 }
  },
  "muni-tsawwassen": {
    id: "muni-tsawwassen",
    name: "Tsawwassen First Nation",
    shortName: "Tsawwassen FN",
    level: "municipality",
    parentId: "metro-vancouver",
    coordinates: { latitude: 49.0200, longitude: -123.0800 },
    metadata: { population: 490 }
  },

  // ===============================================
  // FRASER VALLEY MUNICIPALITIES
  // ===============================================
  "muni-abbotsford": {
    id: "muni-abbotsford",
    name: "City of Abbotsford",
    shortName: "Abbotsford",
    level: "municipality",
    parentId: "fraser-valley",
    coordinates: { latitude: 49.0504, longitude: -122.3045 },
    metadata: { population: 153524 }
  },
  "muni-chilliwack": {
    id: "muni-chilliwack",
    name: "City of Chilliwack",
    shortName: "Chilliwack",
    level: "municipality",
    parentId: "fraser-valley",
    coordinates: { latitude: 49.1579, longitude: -121.9514 },
    metadata: { population: 93203 }
  },
  "muni-mission": {
    id: "muni-mission",
    name: "District of Mission",
    shortName: "Mission",
    level: "municipality",
    parentId: "fraser-valley",
    coordinates: { latitude: 49.1327, longitude: -122.3112 },
    metadata: { population: 41519 }
  },
  "muni-hope": {
    id: "muni-hope",
    name: "District of Hope",
    shortName: "Hope",
    level: "municipality",
    parentId: "fraser-valley",
    coordinates: { latitude: 49.3800, longitude: -121.4400 },
    metadata: { population: 7090 }
  },
  "muni-kent": {
    id: "muni-kent",
    name: "District of Kent",
    shortName: "Kent",
    level: "municipality",
    parentId: "fraser-valley",
    coordinates: { latitude: 49.2167, longitude: -121.7500 },
    metadata: { population: 6879 }
  },
  "muni-harrison-hot-springs": {
    id: "muni-harrison-hot-springs",
    name: "Village of Harrison Hot Springs",
    shortName: "Harrison",
    level: "municipality",
    parentId: "fraser-valley",
    coordinates: { latitude: 49.3000, longitude: -121.7833 },
    metadata: { population: 1573 }
  },

  // ===============================================
  // CAPITAL REGIONAL DISTRICT MUNICIPALITIES
  // ===============================================
  "muni-victoria": {
    id: "muni-victoria",
    name: "City of Victoria",
    shortName: "Victoria",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4284, longitude: -123.3656 },
    metadata: { population: 91867 }
  },
  "muni-saanich": {
    id: "muni-saanich",
    name: "District of Saanich",
    shortName: "Saanich",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4847, longitude: -123.3936 },
    metadata: { population: 117735 }
  },
  "muni-esquimalt": {
    id: "muni-esquimalt",
    name: "Township of Esquimalt",
    shortName: "Esquimalt",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4322, longitude: -123.4141 },
    metadata: { population: 18613 }
  },
  "muni-oak-bay": {
    id: "muni-oak-bay",
    name: "District of Oak Bay",
    shortName: "Oak Bay",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4264, longitude: -123.3171 },
    metadata: { population: 18094 }
  },
  "muni-view-royal": {
    id: "muni-view-royal",
    name: "Town of View Royal",
    shortName: "View Royal",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4517, longitude: -123.4333 },
    metadata: { population: 11575 }
  },
  "muni-colwood": {
    id: "muni-colwood",
    name: "City of Colwood",
    shortName: "Colwood",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4236, longitude: -123.4958 },
    metadata: { population: 18961 }
  },
  "muni-langford": {
    id: "muni-langford",
    name: "City of Langford",
    shortName: "Langford",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4500, longitude: -123.5056 },
    metadata: { population: 46584 }
  },
  "muni-sooke": {
    id: "muni-sooke",
    name: "District of Sooke",
    shortName: "Sooke",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.3742, longitude: -123.7356 },
    metadata: { population: 15054 }
  },
  "muni-metchosin": {
    id: "muni-metchosin",
    name: "District of Metchosin",
    shortName: "Metchosin",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.3833, longitude: -123.5333 },
    metadata: { population: 5120 }
  },
  "muni-highlands": {
    id: "muni-highlands",
    name: "District of Highlands",
    shortName: "Highlands",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.4833, longitude: -123.5000 },
    metadata: { population: 2491 }
  },
  "muni-central-saanich": {
    id: "muni-central-saanich",
    name: "District of Central Saanich",
    shortName: "Central Saanich",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.5167, longitude: -123.4000 },
    metadata: { population: 17385 }
  },
  "muni-north-saanich": {
    id: "muni-north-saanich",
    name: "District of North Saanich",
    shortName: "North Saanich",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.6167, longitude: -123.4167 },
    metadata: { population: 12554 }
  },
  "muni-sidney": {
    id: "muni-sidney",
    name: "Town of Sidney",
    shortName: "Sidney",
    level: "municipality",
    parentId: "capital",
    coordinates: { latitude: 48.6500, longitude: -123.4000 },
    metadata: { population: 12196 }
  },

  // ===============================================
  // COWICHAN VALLEY MUNICIPALITIES
  // ===============================================
  "muni-duncan": {
    id: "muni-duncan",
    name: "City of Duncan",
    shortName: "Duncan",
    level: "municipality",
    parentId: "cowichan-valley",
    coordinates: { latitude: 48.7787, longitude: -123.7079 },
    metadata: { population: 5104 }
  },
  "muni-north-cowichan": {
    id: "muni-north-cowichan",
    name: "District of North Cowichan",
    shortName: "North Cowichan",
    level: "municipality",
    parentId: "cowichan-valley",
    coordinates: { latitude: 48.8333, longitude: -123.7333 },
    metadata: { population: 31990 }
  },
  "muni-lake-cowichan": {
    id: "muni-lake-cowichan",
    name: "Town of Lake Cowichan",
    shortName: "Lake Cowichan",
    level: "municipality",
    parentId: "cowichan-valley",
    coordinates: { latitude: 48.8300, longitude: -124.0500 },
    metadata: { population: 3467 }
  },
  "muni-ladysmith": {
    id: "muni-ladysmith",
    name: "Town of Ladysmith",
    shortName: "Ladysmith",
    level: "municipality",
    parentId: "cowichan-valley",
    coordinates: { latitude: 48.9975, longitude: -123.8178 },
    metadata: { population: 9328 }
  },

  // ===============================================
  // NANAIMO REGIONAL DISTRICT MUNICIPALITIES
  // ===============================================
  "muni-nanaimo": {
    id: "muni-nanaimo",
    name: "City of Nanaimo",
    shortName: "Nanaimo",
    level: "municipality",
    parentId: "nanaimo",
    coordinates: { latitude: 49.1659, longitude: -123.9401 },
    metadata: { population: 99863 }
  },
  "muni-parksville": {
    id: "muni-parksville",
    name: "City of Parksville",
    shortName: "Parksville",
    level: "municipality",
    parentId: "nanaimo",
    coordinates: { latitude: 49.3150, longitude: -124.3122 },
    metadata: { population: 13642 }
  },
  "muni-qualicum-beach": {
    id: "muni-qualicum-beach",
    name: "Town of Qualicum Beach",
    shortName: "Qualicum Beach",
    level: "municipality",
    parentId: "nanaimo",
    coordinates: { latitude: 49.3481, longitude: -124.4350 },
    metadata: { population: 9416 }
  },
  "muni-lantzville": {
    id: "muni-lantzville",
    name: "District of Lantzville",
    shortName: "Lantzville",
    level: "municipality",
    parentId: "nanaimo",
    coordinates: { latitude: 49.2500, longitude: -124.0667 },
    metadata: { population: 4124 }
  },

  // ===============================================
  // ALBERNI-CLAYOQUOT MUNICIPALITIES
  // ===============================================
  "muni-port-alberni": {
    id: "muni-port-alberni",
    name: "City of Port Alberni",
    shortName: "Port Alberni",
    level: "municipality",
    parentId: "alberni-clayoquot",
    coordinates: { latitude: 49.2339, longitude: -124.8055 },
    metadata: { population: 18867 }
  },
  "muni-tofino": {
    id: "muni-tofino",
    name: "District of Tofino",
    shortName: "Tofino",
    level: "municipality",
    parentId: "alberni-clayoquot",
    coordinates: { latitude: 49.1530, longitude: -125.9066 },
    metadata: { population: 2304 }
  },
  "muni-ucluelet": {
    id: "muni-ucluelet",
    name: "District of Ucluelet",
    shortName: "Ucluelet",
    level: "municipality",
    parentId: "alberni-clayoquot",
    coordinates: { latitude: 48.9422, longitude: -125.5461 },
    metadata: { population: 1922 }
  },
  "muni-bamfield": {
    id: "muni-bamfield",
    name: "Bamfield",
    shortName: "Bamfield",
    level: "municipality",
    parentId: "alberni-clayoquot",
    coordinates: { latitude: 48.8333, longitude: -125.1350 },
    metadata: { population: 200 }
  },

  // ===============================================
  // COMOX VALLEY MUNICIPALITIES
  // ===============================================
  "muni-courtenay": {
    id: "muni-courtenay",
    name: "City of Courtenay",
    shortName: "Courtenay",
    level: "municipality",
    parentId: "comox-valley",
    coordinates: { latitude: 49.6879, longitude: -125.0032 },
    metadata: { population: 28420 }
  },
  "muni-comox": {
    id: "muni-comox",
    name: "Town of Comox",
    shortName: "Comox",
    level: "municipality",
    parentId: "comox-valley",
    coordinates: { latitude: 49.6733, longitude: -124.9022 },
    metadata: { population: 15277 }
  },
  "muni-cumberland": {
    id: "muni-cumberland",
    name: "Village of Cumberland",
    shortName: "Cumberland",
    level: "municipality",
    parentId: "comox-valley",
    coordinates: { latitude: 49.6167, longitude: -125.0333 },
    metadata: { population: 4240 }
  },

  // ===============================================
  // STRATHCONA MUNICIPALITIES
  // ===============================================
  "muni-campbell-river": {
    id: "muni-campbell-river",
    name: "City of Campbell River",
    shortName: "Campbell River",
    level: "municipality",
    parentId: "strathcona",
    coordinates: { latitude: 50.0244, longitude: -125.2475 },
    metadata: { population: 35519 }
  },
  "muni-gold-river": {
    id: "muni-gold-river",
    name: "Village of Gold River",
    shortName: "Gold River",
    level: "municipality",
    parentId: "strathcona",
    coordinates: { latitude: 49.7833, longitude: -126.0500 },
    metadata: { population: 1212 }
  },
  "muni-tahsis": {
    id: "muni-tahsis",
    name: "Village of Tahsis",
    shortName: "Tahsis",
    level: "municipality",
    parentId: "strathcona",
    coordinates: { latitude: 49.9167, longitude: -126.6667 },
    metadata: { population: 293 }
  },
  "muni-zeballos": {
    id: "muni-zeballos",
    name: "Village of Zeballos",
    shortName: "Zeballos",
    level: "municipality",
    parentId: "strathcona",
    coordinates: { latitude: 49.9833, longitude: -126.8500 },
    metadata: { population: 107 }
  },
  "muni-sayward": {
    id: "muni-sayward",
    name: "Village of Sayward",
    shortName: "Sayward",
    level: "municipality",
    parentId: "strathcona",
    coordinates: { latitude: 50.3833, longitude: -125.9667 },
    metadata: { population: 311 }
  },

  // ===============================================
  // MOUNT WADDINGTON MUNICIPALITIES
  // ===============================================
  "muni-port-hardy": {
    id: "muni-port-hardy",
    name: "District of Port Hardy",
    shortName: "Port Hardy",
    level: "municipality",
    parentId: "mount-waddington",
    coordinates: { latitude: 50.7256, longitude: -127.4969 },
    metadata: { population: 4132 }
  },
  "muni-port-mcneill": {
    id: "muni-port-mcneill",
    name: "Town of Port McNeill",
    shortName: "Port McNeill",
    level: "municipality",
    parentId: "mount-waddington",
    coordinates: { latitude: 50.5906, longitude: -127.0844 },
    metadata: { population: 2623 }
  },
  "muni-alert-bay": {
    id: "muni-alert-bay",
    name: "Village of Alert Bay",
    shortName: "Alert Bay",
    level: "municipality",
    parentId: "mount-waddington",
    coordinates: { latitude: 50.5833, longitude: -126.9333 },
    metadata: { population: 489 }
  },
  "muni-port-alice": {
    id: "muni-port-alice",
    name: "Village of Port Alice",
    shortName: "Port Alice",
    level: "municipality",
    parentId: "mount-waddington",
    coordinates: { latitude: 50.3833, longitude: -127.4500 },
    metadata: { population: 664 }
  },

  // ===============================================
  // POWELL RIVER MUNICIPALITIES
  // ===============================================
  "muni-powell-river": {
    id: "muni-powell-river",
    name: "City of Powell River",
    shortName: "Powell River",
    level: "municipality",
    parentId: "powell-river",
    coordinates: { latitude: 49.8353, longitude: -124.5247 },
    metadata: { population: 13831 }
  },

  // ===============================================
  // SUNSHINE COAST MUNICIPALITIES
  // ===============================================
  "muni-sechelt": {
    id: "muni-sechelt",
    name: "District of Sechelt",
    shortName: "Sechelt",
    level: "municipality",
    parentId: "sunshine-coast",
    coordinates: { latitude: 49.4742, longitude: -123.7544 },
    metadata: { population: 10871 }
  },
  "muni-gibsons": {
    id: "muni-gibsons",
    name: "Town of Gibsons",
    shortName: "Gibsons",
    level: "municipality",
    parentId: "sunshine-coast",
    coordinates: { latitude: 49.3967, longitude: -123.5044 },
    metadata: { population: 4758 }
  },

  // ===============================================
  // SQUAMISH-LILLOOET MUNICIPALITIES
  // ===============================================
  "muni-squamish": {
    id: "muni-squamish",
    name: "District of Squamish",
    shortName: "Squamish",
    level: "municipality",
    parentId: "squamish-lillooet",
    coordinates: { latitude: 49.7016, longitude: -123.1558 },
    metadata: { population: 23819 }
  },
  "muni-whistler": {
    id: "muni-whistler",
    name: "Resort Municipality of Whistler",
    shortName: "Whistler",
    level: "municipality",
    parentId: "squamish-lillooet",
    coordinates: { latitude: 50.1163, longitude: -122.9574 },
    metadata: { population: 13982 }
  },
  "muni-pemberton": {
    id: "muni-pemberton",
    name: "Village of Pemberton",
    shortName: "Pemberton",
    level: "municipality",
    parentId: "squamish-lillooet",
    coordinates: { latitude: 50.3167, longitude: -122.8000 },
    metadata: { population: 2574 }
  },
  "muni-lillooet": {
    id: "muni-lillooet",
    name: "District of Lillooet",
    shortName: "Lillooet",
    level: "municipality",
    parentId: "squamish-lillooet",
    coordinates: { latitude: 50.6833, longitude: -121.9333 },
    metadata: { population: 2321 }
  },

  // ===============================================
  // THOMPSON-NICOLA MUNICIPALITIES
  // ===============================================
  "muni-kamloops": {
    id: "muni-kamloops",
    name: "City of Kamloops",
    shortName: "Kamloops",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.6745, longitude: -120.3273 },
    metadata: { population: 100046 }
  },
  "muni-merritt": {
    id: "muni-merritt",
    name: "City of Merritt",
    shortName: "Merritt",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.1108, longitude: -120.7930 },
    metadata: { population: 7051 }
  },
  "muni-sun-peaks": {
    id: "muni-sun-peaks",
    name: "Sun Peaks Mountain Resort Municipality",
    shortName: "Sun Peaks",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.8833, longitude: -119.9000 },
    metadata: { population: 616 }
  },
  "muni-ashcroft": {
    id: "muni-ashcroft",
    name: "Village of Ashcroft",
    shortName: "Ashcroft",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.7200, longitude: -121.2833 },
    metadata: { population: 1558 }
  },
  "muni-cache-creek": {
    id: "muni-cache-creek",
    name: "Village of Cache Creek",
    shortName: "Cache Creek",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.8106, longitude: -121.3253 },
    metadata: { population: 947 }
  },
  "muni-chase": {
    id: "muni-chase",
    name: "Village of Chase",
    shortName: "Chase",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.8167, longitude: -119.6833 },
    metadata: { population: 2419 }
  },
  "muni-clearwater": {
    id: "muni-clearwater",
    name: "District of Clearwater",
    shortName: "Clearwater",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 51.6500, longitude: -120.0333 },
    metadata: { population: 2331 }
  },
  "muni-barriere": {
    id: "muni-barriere",
    name: "District of Barriere",
    shortName: "Barriere",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 51.1833, longitude: -120.1167 },
    metadata: { population: 1713 }
  },
  "muni-clinton": {
    id: "muni-clinton",
    name: "Village of Clinton",
    shortName: "Clinton",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 51.0833, longitude: -121.5833 },
    metadata: { population: 580 }
  },
  "muni-logan-lake": {
    id: "muni-logan-lake",
    name: "District of Logan Lake",
    shortName: "Logan Lake",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.4833, longitude: -120.8167 },
    metadata: { population: 1993 }
  },
  "muni-lytton": {
    id: "muni-lytton",
    name: "Village of Lytton",
    shortName: "Lytton",
    level: "municipality",
    parentId: "thompson-nicola",
    coordinates: { latitude: 50.2333, longitude: -121.5833 },
    metadata: { population: 228 }
  },

  // ===============================================
  // CENTRAL OKANAGAN MUNICIPALITIES
  // ===============================================
  "muni-kelowna": {
    id: "muni-kelowna",
    name: "City of Kelowna",
    shortName: "Kelowna",
    level: "municipality",
    parentId: "central-okanagan",
    coordinates: { latitude: 49.8880, longitude: -119.4960 },
    metadata: { population: 144576 }
  },
  "muni-west-kelowna": {
    id: "muni-west-kelowna",
    name: "City of West Kelowna",
    shortName: "West Kelowna",
    level: "municipality",
    parentId: "central-okanagan",
    coordinates: { latitude: 49.8625, longitude: -119.5833 },
    metadata: { population: 36337 }
  },
  "muni-peachland": {
    id: "muni-peachland",
    name: "District of Peachland",
    shortName: "Peachland",
    level: "municipality",
    parentId: "central-okanagan",
    coordinates: { latitude: 49.7667, longitude: -119.7333 },
    metadata: { population: 5634 }
  },
  "muni-lake-country": {
    id: "muni-lake-country",
    name: "District of Lake Country",
    shortName: "Lake Country",
    level: "municipality",
    parentId: "central-okanagan",
    coordinates: { latitude: 50.0500, longitude: -119.4167 },
    metadata: { population: 15817 }
  },

  // ===============================================
  // NORTH OKANAGAN MUNICIPALITIES
  // ===============================================
  "muni-vernon": {
    id: "muni-vernon",
    name: "City of Vernon",
    shortName: "Vernon",
    level: "municipality",
    parentId: "north-okanagan",
    coordinates: { latitude: 50.2671, longitude: -119.2720 },
    metadata: { population: 44519 }
  },
  "muni-coldstream": {
    id: "muni-coldstream",
    name: "District of Coldstream",
    shortName: "Coldstream",
    level: "municipality",
    parentId: "north-okanagan",
    coordinates: { latitude: 50.2167, longitude: -119.1667 },
    metadata: { population: 11293 }
  },
  "muni-armstrong": {
    id: "muni-armstrong",
    name: "City of Armstrong",
    shortName: "Armstrong",
    level: "municipality",
    parentId: "north-okanagan",
    coordinates: { latitude: 50.4486, longitude: -119.1975 },
    metadata: { population: 5354 }
  },
  "muni-spallumcheen": {
    id: "muni-spallumcheen",
    name: "Township of Spallumcheen",
    shortName: "Spallumcheen",
    level: "municipality",
    parentId: "north-okanagan",
    coordinates: { latitude: 50.4667, longitude: -119.1500 },
    metadata: { population: 5625 }
  },
  "muni-enderby": {
    id: "muni-enderby",
    name: "City of Enderby",
    shortName: "Enderby",
    level: "municipality",
    parentId: "north-okanagan",
    coordinates: { latitude: 50.5500, longitude: -119.1500 },
    metadata: { population: 3036 }
  },
  "muni-lumby": {
    id: "muni-lumby",
    name: "Village of Lumby",
    shortName: "Lumby",
    level: "municipality",
    parentId: "north-okanagan",
    coordinates: { latitude: 50.2500, longitude: -118.9667 },
    metadata: { population: 1912 }
  },

  // ===============================================
  // OKANAGAN-SIMILKAMEEN MUNICIPALITIES
  // ===============================================
  "muni-penticton": {
    id: "muni-penticton",
    name: "City of Penticton",
    shortName: "Penticton",
    level: "municipality",
    parentId: "okanagan-similkameen",
    coordinates: { latitude: 49.4991, longitude: -119.5937 },
    metadata: { population: 36773 }
  },
  "muni-summerland": {
    id: "muni-summerland",
    name: "District of Summerland",
    shortName: "Summerland",
    level: "municipality",
    parentId: "okanagan-similkameen",
    coordinates: { latitude: 49.6006, longitude: -119.6778 },
    metadata: { population: 12038 }
  },
  "muni-oliver": {
    id: "muni-oliver",
    name: "Town of Oliver",
    shortName: "Oliver",
    level: "municipality",
    parentId: "okanagan-similkameen",
    coordinates: { latitude: 49.1833, longitude: -119.5500 },
    metadata: { population: 5304 }
  },
  "muni-osoyoos": {
    id: "muni-osoyoos",
    name: "Town of Osoyoos",
    shortName: "Osoyoos",
    level: "municipality",
    parentId: "okanagan-similkameen",
    coordinates: { latitude: 49.0333, longitude: -119.4667 },
    metadata: { population: 5574 }
  },
  "muni-princeton": {
    id: "muni-princeton",
    name: "Town of Princeton",
    shortName: "Princeton",
    level: "municipality",
    parentId: "okanagan-similkameen",
    coordinates: { latitude: 49.4583, longitude: -120.5083 },
    metadata: { population: 2828 }
  },
  "muni-keremeos": {
    id: "muni-keremeos",
    name: "Village of Keremeos",
    shortName: "Keremeos",
    level: "municipality",
    parentId: "okanagan-similkameen",
    coordinates: { latitude: 49.2000, longitude: -119.8333 },
    metadata: { population: 1502 }
  },

  // ===============================================
  // COLUMBIA-SHUSWAP MUNICIPALITIES
  // ===============================================
  "muni-revelstoke": {
    id: "muni-revelstoke",
    name: "City of Revelstoke",
    shortName: "Revelstoke",
    level: "municipality",
    parentId: "columbia-shuswap",
    coordinates: { latitude: 50.9981, longitude: -118.1957 },
    metadata: { population: 8275 }
  },
  "muni-salmon-arm": {
    id: "muni-salmon-arm",
    name: "City of Salmon Arm",
    shortName: "Salmon Arm",
    level: "municipality",
    parentId: "columbia-shuswap",
    coordinates: { latitude: 50.6997, longitude: -119.2714 },
    metadata: { population: 19232 }
  },
  "muni-golden": {
    id: "muni-golden",
    name: "Town of Golden",
    shortName: "Golden",
    level: "municipality",
    parentId: "columbia-shuswap",
    coordinates: { latitude: 51.2969, longitude: -116.9631 },
    metadata: { population: 4294 }
  },
  "muni-sicamous": {
    id: "muni-sicamous",
    name: "District of Sicamous",
    shortName: "Sicamous",
    level: "municipality",
    parentId: "columbia-shuswap",
    coordinates: { latitude: 50.8333, longitude: -118.9833 },
    metadata: { population: 3023 }
  },

  // ===============================================
  // EAST KOOTENAY MUNICIPALITIES
  // ===============================================
  "muni-cranbrook": {
    id: "muni-cranbrook",
    name: "City of Cranbrook",
    shortName: "Cranbrook",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 49.5097, longitude: -115.7686 },
    metadata: { population: 21286 }
  },
  "muni-kimberley": {
    id: "muni-kimberley",
    name: "City of Kimberley",
    shortName: "Kimberley",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 49.6700, longitude: -115.9778 },
    metadata: { population: 7821 }
  },
  "muni-fernie": {
    id: "muni-fernie",
    name: "City of Fernie",
    shortName: "Fernie",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 49.5042, longitude: -115.0628 },
    metadata: { population: 6177 }
  },
  "muni-invermere": {
    id: "muni-invermere",
    name: "District of Invermere",
    shortName: "Invermere",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 50.5072, longitude: -116.0311 },
    metadata: { population: 3769 }
  },
  "muni-sparwood": {
    id: "muni-sparwood",
    name: "District of Sparwood",
    shortName: "Sparwood",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 49.7333, longitude: -114.8833 },
    metadata: { population: 4182 }
  },
  "muni-elkford": {
    id: "muni-elkford",
    name: "District of Elkford",
    shortName: "Elkford",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 50.0167, longitude: -114.9167 },
    metadata: { population: 2499 }
  },
  "muni-radium-hot-springs": {
    id: "muni-radium-hot-springs",
    name: "Village of Radium Hot Springs",
    shortName: "Radium",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 50.6167, longitude: -116.0667 },
    metadata: { population: 858 }
  },
  "muni-canal-flats": {
    id: "muni-canal-flats",
    name: "Village of Canal Flats",
    shortName: "Canal Flats",
    level: "municipality",
    parentId: "east-kootenay",
    coordinates: { latitude: 50.1500, longitude: -115.8167 },
    metadata: { population: 703 }
  },

  // ===============================================
  // CENTRAL KOOTENAY MUNICIPALITIES
  // ===============================================
  "muni-nelson": {
    id: "muni-nelson",
    name: "City of Nelson",
    shortName: "Nelson",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.4928, longitude: -117.2948 },
    metadata: { population: 11106 }
  },
  "muni-castlegar": {
    id: "muni-castlegar",
    name: "City of Castlegar",
    shortName: "Castlegar",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.3256, longitude: -117.6661 },
    metadata: { population: 8612 }
  },
  "muni-trail": {
    id: "muni-trail",
    name: "City of Trail",
    shortName: "Trail",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.0950, longitude: -117.7103 },
    metadata: { population: 8097 }
  },
  "muni-creston": {
    id: "muni-creston",
    name: "Town of Creston",
    shortName: "Creston",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.0956, longitude: -116.5131 },
    metadata: { population: 5629 }
  },
  "muni-kaslo": {
    id: "muni-kaslo",
    name: "Village of Kaslo",
    shortName: "Kaslo",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.9167, longitude: -116.9167 },
    metadata: { population: 1049 }
  },
  "muni-nakusp": {
    id: "muni-nakusp",
    name: "Village of Nakusp",
    shortName: "Nakusp",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 50.2500, longitude: -117.8000 },
    metadata: { population: 1605 }
  },
  "muni-new-denver": {
    id: "muni-new-denver",
    name: "Village of New Denver",
    shortName: "New Denver",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.9833, longitude: -117.3833 },
    metadata: { population: 504 }
  },
  "muni-silverton": {
    id: "muni-silverton",
    name: "Village of Silverton",
    shortName: "Silverton",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.9500, longitude: -117.4000 },
    metadata: { population: 195 }
  },
  "muni-salmo": {
    id: "muni-salmo",
    name: "Village of Salmo",
    shortName: "Salmo",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.2000, longitude: -117.2833 },
    metadata: { population: 1141 }
  },
  "muni-slocan": {
    id: "muni-slocan",
    name: "Village of Slocan",
    shortName: "Slocan",
    level: "municipality",
    parentId: "central-kootenay",
    coordinates: { latitude: 49.7667, longitude: -117.4667 },
    metadata: { population: 297 }
  },

  // ===============================================
  // KOOTENAY BOUNDARY MUNICIPALITIES
  // ===============================================
  "muni-rossland": {
    id: "muni-rossland",
    name: "City of Rossland",
    shortName: "Rossland",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.0833, longitude: -117.8000 },
    metadata: { population: 4233 }
  },
  "muni-fruitvale": {
    id: "muni-fruitvale",
    name: "Village of Fruitvale",
    shortName: "Fruitvale",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.1167, longitude: -117.5500 },
    metadata: { population: 1990 }
  },
  "muni-montrose": {
    id: "muni-montrose",
    name: "Village of Montrose",
    shortName: "Montrose",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.1000, longitude: -117.5833 },
    metadata: { population: 1074 }
  },
  "muni-warfield": {
    id: "muni-warfield",
    name: "Village of Warfield",
    shortName: "Warfield",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.1000, longitude: -117.7500 },
    metadata: { population: 1744 }
  },
  "muni-greenwood": {
    id: "muni-greenwood",
    name: "City of Greenwood",
    shortName: "Greenwood",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.0833, longitude: -118.6833 },
    metadata: { population: 665 }
  },
  "muni-midway": {
    id: "muni-midway",
    name: "Village of Midway",
    shortName: "Midway",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.0000, longitude: -118.7833 },
    metadata: { population: 675 }
  },
  "muni-grand-forks": {
    id: "muni-grand-forks",
    name: "City of Grand Forks",
    shortName: "Grand Forks",
    level: "municipality",
    parentId: "kootenay-boundary",
    coordinates: { latitude: 49.0333, longitude: -118.4500 },
    metadata: { population: 4274 }
  },

  // ===============================================
  // CARIBOO MUNICIPALITIES
  // ===============================================
  "muni-quesnel": {
    id: "muni-quesnel",
    name: "City of Quesnel",
    shortName: "Quesnel",
    level: "municipality",
    parentId: "cariboo",
    coordinates: { latitude: 52.9784, longitude: -122.4927 },
    metadata: { population: 10283 }
  },
  "muni-williams-lake": {
    id: "muni-williams-lake",
    name: "City of Williams Lake",
    shortName: "Williams Lake",
    level: "municipality",
    parentId: "cariboo",
    coordinates: { latitude: 52.1417, longitude: -122.1417 },
    metadata: { population: 11488 }
  },
  "muni-100-mile-house": {
    id: "muni-100-mile-house",
    name: "District of 100 Mile House",
    shortName: "100 Mile House",
    level: "municipality",
    parentId: "cariboo",
    coordinates: { latitude: 51.6417, longitude: -121.2917 },
    metadata: { population: 2060 }
  },
  "muni-wells": {
    id: "muni-wells",
    name: "District of Wells",
    shortName: "Wells",
    level: "municipality",
    parentId: "cariboo",
    coordinates: { latitude: 53.1167, longitude: -121.5667 },
    metadata: { population: 217 }
  },

  // ===============================================
  // FRASER-FORT GEORGE MUNICIPALITIES
  // ===============================================
  "muni-prince-george": {
    id: "muni-prince-george",
    name: "City of Prince George",
    shortName: "Prince George",
    level: "municipality",
    parentId: "fraser-fort-george",
    coordinates: { latitude: 53.9171, longitude: -122.7497 },
    metadata: { population: 76708 }
  },
  "muni-valemount": {
    id: "muni-valemount",
    name: "Village of Valemount",
    shortName: "Valemount",
    level: "municipality",
    parentId: "fraser-fort-george",
    coordinates: { latitude: 52.8333, longitude: -119.2667 },
    metadata: { population: 1021 }
  },
  "muni-mcbride": {
    id: "muni-mcbride",
    name: "Village of McBride",
    shortName: "McBride",
    level: "municipality",
    parentId: "fraser-fort-george",
    coordinates: { latitude: 53.3000, longitude: -120.1667 },
    metadata: { population: 616 }
  },

  // ===============================================
  // BULKLEY-NECHAKO MUNICIPALITIES
  // ===============================================
  "muni-vanderhoof": {
    id: "muni-vanderhoof",
    name: "District of Vanderhoof",
    shortName: "Vanderhoof",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.0167, longitude: -124.0000 },
    metadata: { population: 4664 }
  },
  "muni-fort-st-james": {
    id: "muni-fort-st-james",
    name: "District of Fort St. James",
    shortName: "Fort St. James",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.4333, longitude: -124.2500 },
    metadata: { population: 1598 }
  },
  "muni-burns-lake": {
    id: "muni-burns-lake",
    name: "Village of Burns Lake",
    shortName: "Burns Lake",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.2333, longitude: -125.7667 },
    metadata: { population: 1779 }
  },
  "muni-houston": {
    id: "muni-houston",
    name: "District of Houston",
    shortName: "Houston",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.3833, longitude: -126.6500 },
    metadata: { population: 2993 }
  },
  "muni-smithers": {
    id: "muni-smithers",
    name: "Town of Smithers",
    shortName: "Smithers",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.7806, longitude: -127.1681 },
    metadata: { population: 5401 }
  },
  "muni-granisle": {
    id: "muni-granisle",
    name: "Village of Granisle",
    shortName: "Granisle",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.5000, longitude: -126.0833 },
    metadata: { population: 303 }
  },
  "muni-fraser-lake": {
    id: "muni-fraser-lake",
    name: "Village of Fraser Lake",
    shortName: "Fraser Lake",
    level: "municipality",
    parentId: "bulkley-nechako",
    coordinates: { latitude: 54.0500, longitude: -124.8500 },
    metadata: { population: 1007 }
  },

  // ===============================================
  // KITIMAT-STIKINE MUNICIPALITIES
  // ===============================================
  "muni-terrace": {
    id: "muni-terrace",
    name: "City of Terrace",
    shortName: "Terrace",
    level: "municipality",
    parentId: "kitimat-stikine",
    coordinates: { latitude: 54.5164, longitude: -128.5997 },
    metadata: { population: 12473 }
  },
  "muni-kitimat": {
    id: "muni-kitimat",
    name: "District of Kitimat",
    shortName: "Kitimat",
    level: "municipality",
    parentId: "kitimat-stikine",
    coordinates: { latitude: 54.0522, longitude: -128.6531 },
    metadata: { population: 8234 }
  },
  "muni-stewart": {
    id: "muni-stewart",
    name: "District of Stewart",
    shortName: "Stewart",
    level: "municipality",
    parentId: "kitimat-stikine",
    coordinates: { latitude: 55.9353, longitude: -130.0000 },
    metadata: { population: 401 }
  },
  "muni-hazelton": {
    id: "muni-hazelton",
    name: "Village of Hazelton",
    shortName: "Hazelton",
    level: "municipality",
    parentId: "kitimat-stikine",
    coordinates: { latitude: 55.2500, longitude: -127.6667 },
    metadata: { population: 263 }
  },
  "muni-new-hazelton": {
    id: "muni-new-hazelton",
    name: "District of New Hazelton",
    shortName: "New Hazelton",
    level: "municipality",
    parentId: "kitimat-stikine",
    coordinates: { latitude: 55.2500, longitude: -127.5833 },
    metadata: { population: 580 }
  },

  // ===============================================
  // NORTH COAST MUNICIPALITIES
  // ===============================================
  "muni-prince-rupert": {
    id: "muni-prince-rupert",
    name: "City of Prince Rupert",
    shortName: "Prince Rupert",
    level: "municipality",
    parentId: "north-coast",
    coordinates: { latitude: 54.3150, longitude: -130.3208 },
    metadata: { population: 12220 }
  },
  "muni-port-edward": {
    id: "muni-port-edward",
    name: "District of Port Edward",
    shortName: "Port Edward",
    level: "municipality",
    parentId: "north-coast",
    coordinates: { latitude: 54.2333, longitude: -130.2833 },
    metadata: { population: 436 }
  },
  "muni-masset": {
    id: "muni-masset",
    name: "Village of Masset",
    shortName: "Masset",
    level: "municipality",
    parentId: "north-coast",
    coordinates: { latitude: 54.0167, longitude: -132.1500 },
    metadata: { population: 829 }
  },
  "muni-queen-charlotte": {
    id: "muni-queen-charlotte",
    name: "Village of Queen Charlotte",
    shortName: "Queen Charlotte",
    level: "municipality",
    parentId: "north-coast",
    coordinates: { latitude: 53.2500, longitude: -132.0833 },
    metadata: { population: 879 }
  },

  // ===============================================
  // PEACE RIVER MUNICIPALITIES
  // ===============================================
  "muni-dawson-creek": {
    id: "muni-dawson-creek",
    name: "City of Dawson Creek",
    shortName: "Dawson Creek",
    level: "municipality",
    parentId: "peace-river",
    coordinates: { latitude: 55.7606, longitude: -120.2356 },
    metadata: { population: 12978 }
  },
  "muni-fort-st-john": {
    id: "muni-fort-st-john",
    name: "City of Fort St. John",
    shortName: "Fort St. John",
    level: "municipality",
    parentId: "peace-river",
    coordinates: { latitude: 56.2465, longitude: -120.8476 },
    metadata: { population: 21718 }
  },
  "muni-chetwynd": {
    id: "muni-chetwynd",
    name: "District of Chetwynd",
    shortName: "Chetwynd",
    level: "municipality",
    parentId: "peace-river",
    coordinates: { latitude: 55.6833, longitude: -121.6333 },
    metadata: { population: 2635 }
  },
  "muni-hudson-hope": {
    id: "muni-hudson-hope",
    name: "District of Hudson's Hope",
    shortName: "Hudson's Hope",
    level: "municipality",
    parentId: "peace-river",
    coordinates: { latitude: 56.0333, longitude: -121.9000 },
    metadata: { population: 925 }
  },
  "muni-pouce-coupe": {
    id: "muni-pouce-coupe",
    name: "Village of Pouce Coupe",
    shortName: "Pouce Coupe",
    level: "municipality",
    parentId: "peace-river",
    coordinates: { latitude: 55.7167, longitude: -120.1333 },
    metadata: { population: 739 }
  },
  "muni-taylor": {
    id: "muni-taylor",
    name: "District of Taylor",
    shortName: "Taylor",
    level: "municipality",
    parentId: "peace-river",
    coordinates: { latitude: 56.1500, longitude: -120.6833 },
    metadata: { population: 1469 }
  },

  // ===============================================
  // CENTRAL COAST (Unincorporated)
  // ===============================================
  "muni-bella-coola": {
    id: "muni-bella-coola",
    name: "Bella Coola",
    shortName: "Bella Coola",
    level: "municipality",
    parentId: "central-coast",
    coordinates: { latitude: 52.3833, longitude: -126.7500 },
    metadata: { population: 885 }
  },
  "muni-ocean-falls": {
    id: "muni-ocean-falls",
    name: "Ocean Falls",
    shortName: "Ocean Falls",
    level: "municipality",
    parentId: "central-coast",
    coordinates: { latitude: 52.3500, longitude: -127.7000 },
    metadata: { population: 29 }
  },

  // ===============================================
  // NORTHERN ROCKIES REGIONAL MUNICIPALITY
  // ===============================================
  "muni-fort-nelson": {
    id: "muni-fort-nelson",
    name: "Northern Rockies Regional Municipality",
    shortName: "Fort Nelson",
    level: "municipality",
    parentId: "northern-rockies",
    coordinates: { latitude: 58.8050, longitude: -122.6972 },
    metadata: { population: 4401 }
  }
};

export function getNode(id: string): GeoNode | undefined {
  return GEO_HIERARCHY[id];
}

export function getChildren(nodeId: string): GeoNode[] {
  const node = GEO_HIERARCHY[nodeId];
  if (!node?.children) return [];
  return node.children
    .map(childId => GEO_HIERARCHY[childId])
    .filter((n): n is GeoNode => n !== undefined);
}

export function getParent(nodeId: string): GeoNode | undefined {
  const node = GEO_HIERARCHY[nodeId];
  if (!node?.parentId) return undefined;
  return GEO_HIERARCHY[node.parentId];
}

export function getAncestors(nodeId: string): GeoNode[] {
  const ancestors: GeoNode[] = [];
  let current = getParent(nodeId);
  while (current) {
    ancestors.unshift(current);
    current = getParent(current.id);
  }
  return ancestors;
}

export function getAllMunicipalitiesInRegion(regionId: string): GeoNode[] {
  const region = GEO_HIERARCHY[regionId];
  if (!region?.children) return [];
  return region.children
    .map(id => GEO_HIERARCHY[id])
    .filter((n): n is GeoNode => n !== undefined && n.level === "municipality");
}

export function getAllRegions(): GeoNode[] {
  const bc = GEO_HIERARCHY["bc"];
  if (!bc?.children) return [];
  return bc.children
    .map(id => GEO_HIERARCHY[id])
    .filter((n): n is GeoNode => n !== undefined);
}

export function getTotalMunicipalities(): number {
  return Object.values(GEO_HIERARCHY).filter(n => n.level === "municipality").length;
}

export function getMunicipalityCoordinates(municipalityId: string): { latitude: number; longitude: number } | undefined {
  const node = GEO_HIERARCHY[municipalityId];
  return node?.coordinates;
}

export function getAllMunicipalitiesWithCoordinates(): GeoNode[] {
  return Object.values(GEO_HIERARCHY).filter(
    (n): n is GeoNode => n.level === "municipality" && n.coordinates !== undefined
  );
}
