export type GeoLevel = "planet" | "country" | "province" | "region" | "municipality";

export interface GeoNode {
  id: string;
  name: string;
  shortName?: string;
  level: GeoLevel;
  parentId: string | null;
  children?: string[];
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
    shortName: "N Van City",
    level: "municipality",
    parentId: "metro-vancouver",
    metadata: { population: 58120 }
  },
  "muni-north-vancouver-district": {
    id: "muni-north-vancouver-district",
    name: "District of North Vancouver",
    shortName: "N Van District",
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
    metadata: { population: 33551 }
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
    metadata: { population: 145860 }
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
    metadata: { population: 1334 }
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
  "muni-tsawwassen": {
    id: "muni-tsawwassen",
    name: "Tsawwassen First Nation",
    shortName: "Tsawwassen FN",
    level: "municipality",
    parentId: "metro-vancouver",
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
    metadata: { population: 41519 }
  },
  "muni-hope": {
    id: "muni-hope",
    name: "District of Hope",
    shortName: "Hope",
    level: "municipality",
    parentId: "fraser-valley",
    metadata: { population: 7090 }
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

  // ===============================================
  // CAPITAL REGIONAL DISTRICT MUNICIPALITIES
  // ===============================================
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
    metadata: { population: 18613 }
  },
  "muni-oak-bay": {
    id: "muni-oak-bay",
    name: "District of Oak Bay",
    shortName: "Oak Bay",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 18094 }
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
    metadata: { population: 5120 }
  },
  "muni-highlands": {
    id: "muni-highlands",
    name: "District of Highlands",
    shortName: "Highlands",
    level: "municipality",
    parentId: "capital",
    metadata: { population: 2491 }
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
    metadata: { population: 12554 }
  },
  "muni-sidney": {
    id: "muni-sidney",
    name: "Town of Sidney",
    shortName: "Sidney",
    level: "municipality",
    parentId: "capital",
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
    metadata: { population: 5104 }
  },
  "muni-north-cowichan": {
    id: "muni-north-cowichan",
    name: "District of North Cowichan",
    shortName: "North Cowichan",
    level: "municipality",
    parentId: "cowichan-valley",
    metadata: { population: 31990 }
  },
  "muni-lake-cowichan": {
    id: "muni-lake-cowichan",
    name: "Town of Lake Cowichan",
    shortName: "Lake Cowichan",
    level: "municipality",
    parentId: "cowichan-valley",
    metadata: { population: 3467 }
  },
  "muni-ladysmith": {
    id: "muni-ladysmith",
    name: "Town of Ladysmith",
    shortName: "Ladysmith",
    level: "municipality",
    parentId: "cowichan-valley",
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
    metadata: { population: 99863 }
  },
  "muni-parksville": {
    id: "muni-parksville",
    name: "City of Parksville",
    shortName: "Parksville",
    level: "municipality",
    parentId: "nanaimo",
    metadata: { population: 13642 }
  },
  "muni-qualicum-beach": {
    id: "muni-qualicum-beach",
    name: "Town of Qualicum Beach",
    shortName: "Qualicum Beach",
    level: "municipality",
    parentId: "nanaimo",
    metadata: { population: 9416 }
  },
  "muni-lantzville": {
    id: "muni-lantzville",
    name: "District of Lantzville",
    shortName: "Lantzville",
    level: "municipality",
    parentId: "nanaimo",
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
    metadata: { population: 18867 }
  },
  "muni-tofino": {
    id: "muni-tofino",
    name: "District of Tofino",
    shortName: "Tofino",
    level: "municipality",
    parentId: "alberni-clayoquot",
    metadata: { population: 2304 }
  },
  "muni-ucluelet": {
    id: "muni-ucluelet",
    name: "District of Ucluelet",
    shortName: "Ucluelet",
    level: "municipality",
    parentId: "alberni-clayoquot",
    metadata: { population: 1922 }
  },
  "muni-bamfield": {
    id: "muni-bamfield",
    name: "Bamfield",
    shortName: "Bamfield",
    level: "municipality",
    parentId: "alberni-clayoquot",
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
    metadata: { population: 28420 }
  },
  "muni-comox": {
    id: "muni-comox",
    name: "Town of Comox",
    shortName: "Comox",
    level: "municipality",
    parentId: "comox-valley",
    metadata: { population: 15277 }
  },
  "muni-cumberland": {
    id: "muni-cumberland",
    name: "Village of Cumberland",
    shortName: "Cumberland",
    level: "municipality",
    parentId: "comox-valley",
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
    metadata: { population: 35519 }
  },
  "muni-gold-river": {
    id: "muni-gold-river",
    name: "Village of Gold River",
    shortName: "Gold River",
    level: "municipality",
    parentId: "strathcona",
    metadata: { population: 1212 }
  },
  "muni-tahsis": {
    id: "muni-tahsis",
    name: "Village of Tahsis",
    shortName: "Tahsis",
    level: "municipality",
    parentId: "strathcona",
    metadata: { population: 293 }
  },
  "muni-zeballos": {
    id: "muni-zeballos",
    name: "Village of Zeballos",
    shortName: "Zeballos",
    level: "municipality",
    parentId: "strathcona",
    metadata: { population: 107 }
  },
  "muni-sayward": {
    id: "muni-sayward",
    name: "Village of Sayward",
    shortName: "Sayward",
    level: "municipality",
    parentId: "strathcona",
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
    metadata: { population: 4132 }
  },
  "muni-port-mcneill": {
    id: "muni-port-mcneill",
    name: "Town of Port McNeill",
    shortName: "Port McNeill",
    level: "municipality",
    parentId: "mount-waddington",
    metadata: { population: 2623 }
  },
  "muni-alert-bay": {
    id: "muni-alert-bay",
    name: "Village of Alert Bay",
    shortName: "Alert Bay",
    level: "municipality",
    parentId: "mount-waddington",
    metadata: { population: 489 }
  },
  "muni-port-alice": {
    id: "muni-port-alice",
    name: "Village of Port Alice",
    shortName: "Port Alice",
    level: "municipality",
    parentId: "mount-waddington",
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
    metadata: { population: 10871 }
  },
  "muni-gibsons": {
    id: "muni-gibsons",
    name: "Town of Gibsons",
    shortName: "Gibsons",
    level: "municipality",
    parentId: "sunshine-coast",
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
    metadata: { population: 100046 }
  },
  "muni-merritt": {
    id: "muni-merritt",
    name: "City of Merritt",
    shortName: "Merritt",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 7051 }
  },
  "muni-sun-peaks": {
    id: "muni-sun-peaks",
    name: "Sun Peaks Mountain Resort Municipality",
    shortName: "Sun Peaks",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 616 }
  },
  "muni-ashcroft": {
    id: "muni-ashcroft",
    name: "Village of Ashcroft",
    shortName: "Ashcroft",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 1558 }
  },
  "muni-cache-creek": {
    id: "muni-cache-creek",
    name: "Village of Cache Creek",
    shortName: "Cache Creek",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 947 }
  },
  "muni-chase": {
    id: "muni-chase",
    name: "Village of Chase",
    shortName: "Chase",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 2419 }
  },
  "muni-clearwater": {
    id: "muni-clearwater",
    name: "District of Clearwater",
    shortName: "Clearwater",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 2331 }
  },
  "muni-barriere": {
    id: "muni-barriere",
    name: "District of Barriere",
    shortName: "Barriere",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 1713 }
  },
  "muni-clinton": {
    id: "muni-clinton",
    name: "Village of Clinton",
    shortName: "Clinton",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 580 }
  },
  "muni-logan-lake": {
    id: "muni-logan-lake",
    name: "District of Logan Lake",
    shortName: "Logan Lake",
    level: "municipality",
    parentId: "thompson-nicola",
    metadata: { population: 1993 }
  },
  "muni-lytton": {
    id: "muni-lytton",
    name: "Village of Lytton",
    shortName: "Lytton",
    level: "municipality",
    parentId: "thompson-nicola",
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
    metadata: { population: 144576 }
  },
  "muni-west-kelowna": {
    id: "muni-west-kelowna",
    name: "City of West Kelowna",
    shortName: "West Kelowna",
    level: "municipality",
    parentId: "central-okanagan",
    metadata: { population: 36337 }
  },
  "muni-peachland": {
    id: "muni-peachland",
    name: "District of Peachland",
    shortName: "Peachland",
    level: "municipality",
    parentId: "central-okanagan",
    metadata: { population: 5634 }
  },
  "muni-lake-country": {
    id: "muni-lake-country",
    name: "District of Lake Country",
    shortName: "Lake Country",
    level: "municipality",
    parentId: "central-okanagan",
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
    metadata: { population: 44519 }
  },
  "muni-coldstream": {
    id: "muni-coldstream",
    name: "District of Coldstream",
    shortName: "Coldstream",
    level: "municipality",
    parentId: "north-okanagan",
    metadata: { population: 11293 }
  },
  "muni-armstrong": {
    id: "muni-armstrong",
    name: "City of Armstrong",
    shortName: "Armstrong",
    level: "municipality",
    parentId: "north-okanagan",
    metadata: { population: 5354 }
  },
  "muni-spallumcheen": {
    id: "muni-spallumcheen",
    name: "Township of Spallumcheen",
    shortName: "Spallumcheen",
    level: "municipality",
    parentId: "north-okanagan",
    metadata: { population: 5625 }
  },
  "muni-enderby": {
    id: "muni-enderby",
    name: "City of Enderby",
    shortName: "Enderby",
    level: "municipality",
    parentId: "north-okanagan",
    metadata: { population: 3036 }
  },
  "muni-lumby": {
    id: "muni-lumby",
    name: "Village of Lumby",
    shortName: "Lumby",
    level: "municipality",
    parentId: "north-okanagan",
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
    metadata: { population: 36773 }
  },
  "muni-summerland": {
    id: "muni-summerland",
    name: "District of Summerland",
    shortName: "Summerland",
    level: "municipality",
    parentId: "okanagan-similkameen",
    metadata: { population: 12038 }
  },
  "muni-oliver": {
    id: "muni-oliver",
    name: "Town of Oliver",
    shortName: "Oliver",
    level: "municipality",
    parentId: "okanagan-similkameen",
    metadata: { population: 5304 }
  },
  "muni-osoyoos": {
    id: "muni-osoyoos",
    name: "Town of Osoyoos",
    shortName: "Osoyoos",
    level: "municipality",
    parentId: "okanagan-similkameen",
    metadata: { population: 5574 }
  },
  "muni-princeton": {
    id: "muni-princeton",
    name: "Town of Princeton",
    shortName: "Princeton",
    level: "municipality",
    parentId: "okanagan-similkameen",
    metadata: { population: 2828 }
  },
  "muni-keremeos": {
    id: "muni-keremeos",
    name: "Village of Keremeos",
    shortName: "Keremeos",
    level: "municipality",
    parentId: "okanagan-similkameen",
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
    metadata: { population: 8275 }
  },
  "muni-salmon-arm": {
    id: "muni-salmon-arm",
    name: "City of Salmon Arm",
    shortName: "Salmon Arm",
    level: "municipality",
    parentId: "columbia-shuswap",
    metadata: { population: 19232 }
  },
  "muni-golden": {
    id: "muni-golden",
    name: "Town of Golden",
    shortName: "Golden",
    level: "municipality",
    parentId: "columbia-shuswap",
    metadata: { population: 4294 }
  },
  "muni-sicamous": {
    id: "muni-sicamous",
    name: "District of Sicamous",
    shortName: "Sicamous",
    level: "municipality",
    parentId: "columbia-shuswap",
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
    metadata: { population: 21286 }
  },
  "muni-kimberley": {
    id: "muni-kimberley",
    name: "City of Kimberley",
    shortName: "Kimberley",
    level: "municipality",
    parentId: "east-kootenay",
    metadata: { population: 7821 }
  },
  "muni-fernie": {
    id: "muni-fernie",
    name: "City of Fernie",
    shortName: "Fernie",
    level: "municipality",
    parentId: "east-kootenay",
    metadata: { population: 6177 }
  },
  "muni-invermere": {
    id: "muni-invermere",
    name: "District of Invermere",
    shortName: "Invermere",
    level: "municipality",
    parentId: "east-kootenay",
    metadata: { population: 3769 }
  },
  "muni-sparwood": {
    id: "muni-sparwood",
    name: "District of Sparwood",
    shortName: "Sparwood",
    level: "municipality",
    parentId: "east-kootenay",
    metadata: { population: 4182 }
  },
  "muni-elkford": {
    id: "muni-elkford",
    name: "District of Elkford",
    shortName: "Elkford",
    level: "municipality",
    parentId: "east-kootenay",
    metadata: { population: 2499 }
  },
  "muni-radium-hot-springs": {
    id: "muni-radium-hot-springs",
    name: "Village of Radium Hot Springs",
    shortName: "Radium",
    level: "municipality",
    parentId: "east-kootenay",
    metadata: { population: 858 }
  },
  "muni-canal-flats": {
    id: "muni-canal-flats",
    name: "Village of Canal Flats",
    shortName: "Canal Flats",
    level: "municipality",
    parentId: "east-kootenay",
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
    metadata: { population: 11106 }
  },
  "muni-castlegar": {
    id: "muni-castlegar",
    name: "City of Castlegar",
    shortName: "Castlegar",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 8612 }
  },
  "muni-trail": {
    id: "muni-trail",
    name: "City of Trail",
    shortName: "Trail",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 8097 }
  },
  "muni-creston": {
    id: "muni-creston",
    name: "Town of Creston",
    shortName: "Creston",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 5629 }
  },
  "muni-kaslo": {
    id: "muni-kaslo",
    name: "Village of Kaslo",
    shortName: "Kaslo",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 1049 }
  },
  "muni-nakusp": {
    id: "muni-nakusp",
    name: "Village of Nakusp",
    shortName: "Nakusp",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 1605 }
  },
  "muni-new-denver": {
    id: "muni-new-denver",
    name: "Village of New Denver",
    shortName: "New Denver",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 504 }
  },
  "muni-silverton": {
    id: "muni-silverton",
    name: "Village of Silverton",
    shortName: "Silverton",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 195 }
  },
  "muni-salmo": {
    id: "muni-salmo",
    name: "Village of Salmo",
    shortName: "Salmo",
    level: "municipality",
    parentId: "central-kootenay",
    metadata: { population: 1141 }
  },
  "muni-slocan": {
    id: "muni-slocan",
    name: "Village of Slocan",
    shortName: "Slocan",
    level: "municipality",
    parentId: "central-kootenay",
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
    metadata: { population: 4233 }
  },
  "muni-fruitvale": {
    id: "muni-fruitvale",
    name: "Village of Fruitvale",
    shortName: "Fruitvale",
    level: "municipality",
    parentId: "kootenay-boundary",
    metadata: { population: 1990 }
  },
  "muni-montrose": {
    id: "muni-montrose",
    name: "Village of Montrose",
    shortName: "Montrose",
    level: "municipality",
    parentId: "kootenay-boundary",
    metadata: { population: 1074 }
  },
  "muni-warfield": {
    id: "muni-warfield",
    name: "Village of Warfield",
    shortName: "Warfield",
    level: "municipality",
    parentId: "kootenay-boundary",
    metadata: { population: 1744 }
  },
  "muni-greenwood": {
    id: "muni-greenwood",
    name: "City of Greenwood",
    shortName: "Greenwood",
    level: "municipality",
    parentId: "kootenay-boundary",
    metadata: { population: 665 }
  },
  "muni-midway": {
    id: "muni-midway",
    name: "Village of Midway",
    shortName: "Midway",
    level: "municipality",
    parentId: "kootenay-boundary",
    metadata: { population: 675 }
  },
  "muni-grand-forks": {
    id: "muni-grand-forks",
    name: "City of Grand Forks",
    shortName: "Grand Forks",
    level: "municipality",
    parentId: "kootenay-boundary",
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
    metadata: { population: 10283 }
  },
  "muni-williams-lake": {
    id: "muni-williams-lake",
    name: "City of Williams Lake",
    shortName: "Williams Lake",
    level: "municipality",
    parentId: "cariboo",
    metadata: { population: 11488 }
  },
  "muni-100-mile-house": {
    id: "muni-100-mile-house",
    name: "District of 100 Mile House",
    shortName: "100 Mile House",
    level: "municipality",
    parentId: "cariboo",
    metadata: { population: 2060 }
  },
  "muni-wells": {
    id: "muni-wells",
    name: "District of Wells",
    shortName: "Wells",
    level: "municipality",
    parentId: "cariboo",
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
    metadata: { population: 76708 }
  },
  "muni-valemount": {
    id: "muni-valemount",
    name: "Village of Valemount",
    shortName: "Valemount",
    level: "municipality",
    parentId: "fraser-fort-george",
    metadata: { population: 1021 }
  },
  "muni-mcbride": {
    id: "muni-mcbride",
    name: "Village of McBride",
    shortName: "McBride",
    level: "municipality",
    parentId: "fraser-fort-george",
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
    metadata: { population: 4664 }
  },
  "muni-fort-st-james": {
    id: "muni-fort-st-james",
    name: "District of Fort St. James",
    shortName: "Fort St. James",
    level: "municipality",
    parentId: "bulkley-nechako",
    metadata: { population: 1598 }
  },
  "muni-burns-lake": {
    id: "muni-burns-lake",
    name: "Village of Burns Lake",
    shortName: "Burns Lake",
    level: "municipality",
    parentId: "bulkley-nechako",
    metadata: { population: 1779 }
  },
  "muni-houston": {
    id: "muni-houston",
    name: "District of Houston",
    shortName: "Houston",
    level: "municipality",
    parentId: "bulkley-nechako",
    metadata: { population: 2993 }
  },
  "muni-smithers": {
    id: "muni-smithers",
    name: "Town of Smithers",
    shortName: "Smithers",
    level: "municipality",
    parentId: "bulkley-nechako",
    metadata: { population: 5401 }
  },
  "muni-granisle": {
    id: "muni-granisle",
    name: "Village of Granisle",
    shortName: "Granisle",
    level: "municipality",
    parentId: "bulkley-nechako",
    metadata: { population: 303 }
  },
  "muni-fraser-lake": {
    id: "muni-fraser-lake",
    name: "Village of Fraser Lake",
    shortName: "Fraser Lake",
    level: "municipality",
    parentId: "bulkley-nechako",
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
    metadata: { population: 12473 }
  },
  "muni-kitimat": {
    id: "muni-kitimat",
    name: "District of Kitimat",
    shortName: "Kitimat",
    level: "municipality",
    parentId: "kitimat-stikine",
    metadata: { population: 8234 }
  },
  "muni-stewart": {
    id: "muni-stewart",
    name: "District of Stewart",
    shortName: "Stewart",
    level: "municipality",
    parentId: "kitimat-stikine",
    metadata: { population: 401 }
  },
  "muni-hazelton": {
    id: "muni-hazelton",
    name: "Village of Hazelton",
    shortName: "Hazelton",
    level: "municipality",
    parentId: "kitimat-stikine",
    metadata: { population: 263 }
  },
  "muni-new-hazelton": {
    id: "muni-new-hazelton",
    name: "District of New Hazelton",
    shortName: "New Hazelton",
    level: "municipality",
    parentId: "kitimat-stikine",
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
    metadata: { population: 12220 }
  },
  "muni-port-edward": {
    id: "muni-port-edward",
    name: "District of Port Edward",
    shortName: "Port Edward",
    level: "municipality",
    parentId: "north-coast",
    metadata: { population: 436 }
  },
  "muni-masset": {
    id: "muni-masset",
    name: "Village of Masset",
    shortName: "Masset",
    level: "municipality",
    parentId: "north-coast",
    metadata: { population: 829 }
  },
  "muni-queen-charlotte": {
    id: "muni-queen-charlotte",
    name: "Village of Queen Charlotte",
    shortName: "Queen Charlotte",
    level: "municipality",
    parentId: "north-coast",
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
    metadata: { population: 12978 }
  },
  "muni-fort-st-john": {
    id: "muni-fort-st-john",
    name: "City of Fort St. John",
    shortName: "Fort St. John",
    level: "municipality",
    parentId: "peace-river",
    metadata: { population: 21718 }
  },
  "muni-chetwynd": {
    id: "muni-chetwynd",
    name: "District of Chetwynd",
    shortName: "Chetwynd",
    level: "municipality",
    parentId: "peace-river",
    metadata: { population: 2635 }
  },
  "muni-hudson-hope": {
    id: "muni-hudson-hope",
    name: "District of Hudson's Hope",
    shortName: "Hudson's Hope",
    level: "municipality",
    parentId: "peace-river",
    metadata: { population: 925 }
  },
  "muni-pouce-coupe": {
    id: "muni-pouce-coupe",
    name: "Village of Pouce Coupe",
    shortName: "Pouce Coupe",
    level: "municipality",
    parentId: "peace-river",
    metadata: { population: 739 }
  },
  "muni-taylor": {
    id: "muni-taylor",
    name: "District of Taylor",
    shortName: "Taylor",
    level: "municipality",
    parentId: "peace-river",
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
    metadata: { population: 885 }
  },
  "muni-ocean-falls": {
    id: "muni-ocean-falls",
    name: "Ocean Falls",
    shortName: "Ocean Falls",
    level: "municipality",
    parentId: "central-coast",
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
