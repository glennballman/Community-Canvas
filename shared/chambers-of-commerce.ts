/**
 * BC Chambers of Commerce Dataset
 * Comprehensive list of chambers of commerce and boards of trade across British Columbia
 * All coordinates in WGS84 (lat/lng)
 */

export interface ChamberOfCommerce {
  id: string;
  name: string;
  municipality: string;
  region: string;
  location: {
    address?: string;
    lat: number;
    lng: number;
  };
  phone?: string;
  email?: string;
  website?: string;
  founded?: number;
  members?: string;
  notes?: string;
}

export const BC_CHAMBERS_OF_COMMERCE: ChamberOfCommerce[] = [
  // ============================================================================
  // METRO VANCOUVER
  // ============================================================================
  {
    id: "greater-vancouver-board-of-trade",
    name: "Greater Vancouver Board of Trade",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    location: {
      address: "400-999 Canada Place, Vancouver, BC V6C 3E1",
      lat: 49.2888,
      lng: -123.1115
    },
    phone: "(604) 681-2111",
    website: "https://www.boardoftrade.com",
    members: "5,000+",
    notes: "Largest business association in Western Canada. Founded 1887."
  },
  {
    id: "burnaby-board-of-trade",
    name: "Burnaby Board of Trade",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    location: {
      address: "201-4555 Kingsway, Burnaby, BC V5H 4T8",
      lat: 49.2276,
      lng: -123.0076
    },
    phone: "(604) 412-0100",
    website: "https://www.bbot.ca",
    founded: 1910,
    members: "1,100+",
    notes: "Official economic development office for City of Burnaby. 70+ events annually."
  },
  {
    id: "surrey-white-rock-board-of-trade",
    name: "Surrey & White Rock Board of Trade",
    municipality: "Surrey",
    region: "Metro Vancouver",
    location: {
      address: "Surrey",
      lat: 49.1913,
      lng: -122.8490
    },
    website: "https://www.sswrchamberofcommerce.ca",
    notes: "Formed from merger of Surrey and White Rock chambers. Trade Accelerator Program (TAP)."
  },
  {
    id: "richmond-chamber-of-commerce",
    name: "Richmond Chamber of Commerce",
    municipality: "Richmond",
    region: "Metro Vancouver",
    location: {
      address: "201-13888 Wireless Way, Richmond, BC V6V 0A3",
      lat: 49.1666,
      lng: -123.1336
    },
    phone: "(604) 278-2822",
    website: "https://www.richmondchamber.ca",
    founded: 1925,
    notes: "Celebrating 100 years of service. Annual Business Excellence Awards."
  },
  {
    id: "delta-chamber-of-commerce",
    name: "Delta Chamber of Commerce",
    municipality: "Delta",
    region: "Metro Vancouver",
    location: {
      address: "6201 60th Avenue, Delta, BC V4K 4E2",
      lat: 49.0847,
      lng: -123.0587
    },
    email: "admin@deltachamber.ca",
    website: "https://www.deltachamber.ca",
    founded: 1910,
    notes: "Originally Board of Trade, became Chamber in 1961."
  },
  {
    id: "north-vancouver-chamber",
    name: "North Vancouver Chamber",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    location: {
      address: "North Vancouver",
      lat: 49.3165,
      lng: -123.0688
    },
    website: "https://www.nvchamber.ca",
    notes: "Serving North Vancouver business community."
  },
  {
    id: "west-vancouver-chamber",
    name: "West Vancouver Chamber of Commerce",
    municipality: "West Vancouver",
    region: "Metro Vancouver",
    location: {
      address: "West Vancouver",
      lat: 49.3270,
      lng: -123.1662
    },
    website: "https://www.westvanchamber.com",
    notes: "Serving West Vancouver business community."
  },
  {
    id: "tri-cities-chamber",
    name: "Tri-Cities Chamber of Commerce",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    location: {
      address: "Coquitlam",
      lat: 49.2838,
      lng: -122.7932
    },
    website: "https://www.tricitieschamber.com",
    notes: "Serving Coquitlam, Port Coquitlam, and Port Moody."
  },
  {
    id: "cloverdale-district-chamber",
    name: "Cloverdale District Chamber of Commerce",
    municipality: "Surrey",
    region: "Metro Vancouver",
    location: {
      address: "Cloverdale, Surrey",
      lat: 49.1044,
      lng: -122.7239
    },
    website: "https://www.cloverdalechamber.ca",
    notes: "Serving Cloverdale district of Surrey."
  },
  {
    id: "new-westminster-chamber",
    name: "New Westminster Chamber of Commerce",
    municipality: "New Westminster",
    region: "Metro Vancouver",
    location: {
      address: "New Westminster",
      lat: 49.2057,
      lng: -122.9110
    },
    website: "https://www.newwestchamber.com",
    notes: "Serving New Westminster business community."
  },

  // ============================================================================
  // FRASER VALLEY
  // ============================================================================
  {
    id: "abbotsford-chamber-of-commerce",
    name: "Abbotsford Chamber of Commerce",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    location: {
      address: "#207-32900 South Fraser Way, Abbotsford, BC V2S 5A1",
      lat: 49.0504,
      lng: -122.3045
    },
    phone: "(604) 859-9651",
    email: "hello@abbotsfordchamber.com",
    website: "https://www.abbotsfordchamber.com",
    founded: 1913,
    members: "700",
    notes: "Nationally accredited. Agriculture, ag-tech, aerospace focus."
  },
  {
    id: "chilliwack-chamber-of-commerce",
    name: "Chilliwack Chamber of Commerce",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    location: {
      address: "46115 Yale Road, Chilliwack, BC V2P 2P2",
      lat: 49.1579,
      lng: -121.9514
    },
    phone: "(604) 793-4323",
    email: "info@chilliwackchamber.com",
    website: "https://www.chilliwackchamber.com",
    founded: 1903,
    notes: "Originally Board of Trade. 120+ years in operation."
  },
  {
    id: "langley-chamber-of-commerce",
    name: "Greater Langley Chamber of Commerce",
    municipality: "Langley",
    region: "Fraser Valley",
    location: {
      address: "Langley",
      lat: 49.1044,
      lng: -122.6608
    },
    website: "https://www.langleychamber.com",
    notes: "Serving Langley City and Township."
  },
  {
    id: "mission-chamber-of-commerce",
    name: "Mission Regional Chamber of Commerce",
    municipality: "Mission",
    region: "Fraser Valley",
    location: {
      address: "Mission",
      lat: 49.1329,
      lng: -122.3095
    },
    website: "https://www.missionchamber.bc.ca",
    notes: "Serving Mission and district."
  },
  {
    id: "maple-ridge-pitt-meadows-chamber",
    name: "Maple Ridge Pitt Meadows Chamber of Commerce",
    municipality: "Maple Ridge",
    region: "Fraser Valley",
    location: {
      address: "Maple Ridge",
      lat: 49.2193,
      lng: -122.5984
    },
    website: "https://www.ridgemeadowschamber.com",
    notes: "Serving Maple Ridge and Pitt Meadows."
  },
  {
    id: "hope-chamber-of-commerce",
    name: "Hope & District Chamber of Commerce",
    municipality: "Hope",
    region: "Fraser Valley",
    location: {
      address: "Hope",
      lat: 49.3858,
      lng: -121.4419
    },
    website: "https://www.hopechamber.ca",
    notes: "Gateway to the Fraser Canyon."
  },

  // ============================================================================
  // VICTORIA / CAPITAL REGION
  // ============================================================================
  {
    id: "greater-victoria-chamber",
    name: "Greater Victoria Chamber of Commerce",
    municipality: "Victoria",
    region: "Capital",
    location: {
      address: "Victoria",
      lat: 48.4284,
      lng: -123.3656
    },
    phone: "(250) 383-7191",
    email: "ceo@victoriachamber.ca",
    website: "https://www.victoriachamber.ca",
    members: "1,400",
    notes: "Oldest chamber in Western Canada. One of BC's 5 largest."
  },
  {
    id: "westshore-chamber",
    name: "WestShore Chamber of Commerce",
    municipality: "Langford",
    region: "Capital",
    location: {
      address: "Langford",
      lat: 48.4506,
      lng: -123.5058
    },
    website: "https://www.westshore.bc.ca",
    notes: "Serving Langford, Colwood, View Royal, Metchosin, Highlands."
  },
  {
    id: "sooke-chamber",
    name: "Sooke Region Chamber of Commerce",
    municipality: "Sooke",
    region: "Capital",
    location: {
      address: "Sooke",
      lat: 48.3756,
      lng: -123.7256
    },
    website: "https://www.sookeregionchamber.com",
    notes: "Serving Sooke and surrounding communities."
  },
  {
    id: "sidney-chamber",
    name: "Saanich Peninsula Chamber of Commerce",
    municipality: "Sidney",
    region: "Capital",
    location: {
      address: "Sidney",
      lat: 48.6500,
      lng: -123.3986
    },
    website: "https://www.peninsulachamber.ca",
    notes: "Serving Sidney, North Saanich, Central Saanich."
  },
  {
    id: "salt-spring-chamber",
    name: "Salt Spring Island Chamber of Commerce",
    municipality: "Salt Spring Island",
    region: "Capital",
    location: {
      address: "Ganges, Salt Spring Island",
      lat: 48.8547,
      lng: -123.5086
    },
    website: "https://www.saltspringchamber.com",
    notes: "Serving Salt Spring Island businesses."
  },

  // ============================================================================
  // VANCOUVER ISLAND - CENTRAL & NORTH
  // ============================================================================
  {
    id: "greater-nanaimo-chamber",
    name: "Greater Nanaimo Chamber of Commerce",
    municipality: "Nanaimo",
    region: "Nanaimo",
    location: {
      address: "Nanaimo",
      lat: 49.1659,
      lng: -123.9401
    },
    phone: "(250) 756-1191",
    website: "https://www.nanaimochamber.bc.ca",
    notes: "Third largest on Vancouver Island."
  },
  {
    id: "parksville-qualicum-chamber",
    name: "Parksville Qualicum Beach & District Chamber of Commerce",
    municipality: "Parksville",
    region: "Nanaimo",
    location: {
      address: "Parksville",
      lat: 49.3150,
      lng: -124.3119
    },
    website: "https://www.pqbchamber.com",
    notes: "Serving Parksville and Qualicum Beach area."
  },
  {
    id: "comox-valley-chamber",
    name: "Comox Valley Chamber of Commerce",
    municipality: "Courtenay",
    region: "Comox Valley",
    location: {
      address: "Courtenay",
      lat: 49.6879,
      lng: -124.9941
    },
    website: "https://www.comoxvalleychamber.com",
    members: "500",
    notes: "Third largest chamber in BC."
  },
  {
    id: "campbell-river-chamber",
    name: "Campbell River & District Chamber of Commerce",
    municipality: "Campbell River",
    region: "Strathcona",
    location: {
      address: "Campbell River",
      lat: 50.0244,
      lng: -125.2475
    },
    phone: "(250) 287-4636",
    email: "admin@campbellriverchamber.ca",
    website: "https://www.campbellriverchamber.ca",
    notes: "Serving Campbell River and district."
  },
  {
    id: "port-hardy-chamber",
    name: "Port Hardy & District Chamber of Commerce",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    location: {
      address: "Port Hardy",
      lat: 50.7225,
      lng: -127.4947
    },
    website: "https://www.porthardychamber.com",
    notes: "Gateway to Cape Scott and North Island."
  },
  {
    id: "port-alberni-chamber",
    name: "Alberni Valley Chamber of Commerce",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    location: {
      address: "Port Alberni",
      lat: 49.2339,
      lng: -124.8055
    },
    phone: "(250) 724-6535",
    email: "office@albernichamber.ca",
    website: "https://www.albernichamber.ca",
    notes: "Serving Port Alberni and Alberni Valley."
  },
  {
    id: "tofino-ucluelet-chamber",
    name: "Pacific Rim Chamber of Commerce",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    location: {
      address: "Tofino",
      lat: 49.1530,
      lng: -125.9066
    },
    website: "https://www.pacificrimchamber.ca",
    notes: "Serving Tofino, Ucluelet, and Pacific Rim area."
  },
  {
    id: "duncan-cowichan-chamber",
    name: "Duncan Cowichan Chamber of Commerce",
    municipality: "Duncan",
    region: "Cowichan Valley",
    location: {
      address: "Duncan",
      lat: 48.7787,
      lng: -123.7079
    },
    website: "https://www.duncancc.bc.ca",
    notes: "Serving Cowichan Valley."
  },
  {
    id: "ladysmith-chamber",
    name: "Ladysmith Chamber of Commerce",
    municipality: "Ladysmith",
    region: "Cowichan Valley",
    location: {
      address: "Ladysmith",
      lat: 48.9975,
      lng: -123.8181
    },
    website: "https://www.ladysmithcofc.com",
    notes: "Serving Ladysmith and area."
  },
  {
    id: "chemainus-chamber",
    name: "Chemainus & District Chamber of Commerce",
    municipality: "Chemainus",
    region: "Cowichan Valley",
    location: {
      address: "Chemainus",
      lat: 48.9261,
      lng: -123.7147
    },
    phone: "(250) 246-3944",
    email: "chamber@chemainus.bc.ca",
    website: "https://www.chemainus.bc.ca",
    notes: "Serving Chemainus mural town."
  },

  // ============================================================================
  // OKANAGAN
  // ============================================================================
  {
    id: "kelowna-chamber",
    name: "Kelowna Chamber of Commerce",
    municipality: "Kelowna",
    region: "Central Okanagan",
    location: {
      address: "Kelowna",
      lat: 49.8863,
      lng: -119.4966
    },
    website: "https://www.kelownachamber.org",
    notes: "Central Okanagan's main business chamber."
  },
  {
    id: "west-kelowna-chamber",
    name: "West Kelowna Chamber of Commerce",
    municipality: "West Kelowna",
    region: "Central Okanagan",
    location: {
      address: "West Kelowna",
      lat: 49.8625,
      lng: -119.5833
    },
    website: "https://www.westkelownachamber.com",
    notes: "Serving West Kelowna area."
  },
  {
    id: "vernon-chamber",
    name: "Greater Vernon Chamber of Commerce",
    municipality: "Vernon",
    region: "North Okanagan",
    location: {
      address: "701 Highway 97 South, Vernon, BC",
      lat: 50.2670,
      lng: -119.2720
    },
    phone: "(250) 545-0771",
    website: "https://www.vernonchamber.ca",
    notes: "Serving Vernon and North Okanagan."
  },
  {
    id: "penticton-chamber",
    name: "Penticton & Wine Country Chamber of Commerce",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    location: {
      address: "Penticton",
      lat: 49.4991,
      lng: -119.5937
    },
    website: "https://www.penticton.org",
    notes: "Serving Penticton and wine country."
  },
  {
    id: "south-okanagan-chamber",
    name: "South Okanagan Chamber of Commerce",
    municipality: "Oliver",
    region: "Okanagan-Similkameen",
    location: {
      address: "6237 Main St, Oliver, BC V0H 1T0",
      lat: 49.1845,
      lng: -119.5503
    },
    phone: "(250) 498-6321",
    email: "admin@sochamber.ca",
    website: "https://www.sochamber.ca",
    notes: "Serving Oliver, Osoyoos, Okanagan Falls."
  },
  {
    id: "summerland-chamber",
    name: "Summerland Chamber of Economic Development & Tourism",
    municipality: "Summerland",
    region: "Okanagan-Similkameen",
    location: {
      address: "Hwy 97, Summerland, BC",
      lat: 49.6009,
      lng: -119.6772
    },
    phone: "(250) 494-2686",
    website: "https://www.summerlandchamber.com",
    notes: "Economic development and tourism focus."
  },
  {
    id: "salmon-arm-chamber",
    name: "Salmon Arm & District Chamber of Commerce",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    location: {
      address: "Salmon Arm",
      lat: 50.7019,
      lng: -119.2908
    },
    website: "https://www.sachamber.bc.ca",
    notes: "Serving Salmon Arm and Shuswap."
  },
  {
    id: "sicamous-chamber",
    name: "Sicamous and District Chamber of Commerce",
    municipality: "Sicamous",
    region: "Columbia-Shuswap",
    location: {
      address: "Sicamous",
      lat: 50.8367,
      lng: -118.9761
    },
    phone: "(250) 836-3313",
    notes: "Houseboat capital of Canada."
  },

  // ============================================================================
  // KAMLOOPS / THOMPSON-NICOLA
  // ============================================================================
  {
    id: "kamloops-chamber",
    name: "Kamloops & District Chamber of Commerce",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    location: {
      address: "615 Victoria St, Kamloops, BC V2C 2B3",
      lat: 50.6745,
      lng: -120.3273
    },
    website: "https://www.kamloopschamber.ca",
    founded: 1896,
    notes: "Serving Thompson Valley since 1896. Visitor information center."
  },
  {
    id: "merritt-chamber",
    name: "Merritt & District Chamber of Commerce",
    municipality: "Merritt",
    region: "Thompson-Nicola",
    location: {
      address: "Merritt",
      lat: 50.1129,
      lng: -120.7862
    },
    website: "https://www.merrittchamber.com",
    notes: "Country music capital of Canada."
  },

  // ============================================================================
  // CARIBOO
  // ============================================================================
  {
    id: "williams-lake-chamber",
    name: "Williams Lake & District Chamber of Commerce",
    municipality: "Williams Lake",
    region: "Cariboo",
    location: {
      address: "1660 South Broadway, Williams Lake, BC V2G 2W4",
      lat: 52.1417,
      lng: -122.1417
    },
    phone: "(250) 392-5025",
    website: "https://www.wlchamber.ca",
    members: "225-300",
    notes: "Manages Tourism Discovery Centre. Cariboo-Chilcotin coverage."
  },
  {
    id: "quesnel-chamber",
    name: "Quesnel & District Chamber of Commerce",
    municipality: "Quesnel",
    region: "Cariboo",
    location: {
      address: "335 E Vaughan Street, Quesnel, BC V2J 2T1",
      lat: 52.9784,
      lng: -122.4927
    },
    phone: "(250) 992-7262",
    email: "qchamber@quesnelbc.com",
    website: "https://www.quesnelchamber.com",
    founded: 1910,
    members: "250+",
    notes: "Voice of business since 1910. Runs Quesnel Visitor Centre."
  },
  {
    id: "100-mile-house-chamber",
    name: "100 Mile House & District Chamber of Commerce",
    municipality: "100 Mile House",
    region: "Cariboo",
    location: {
      address: "100 Mile House",
      lat: 51.6418,
      lng: -121.2940
    },
    website: "https://www.southcariboochamber.org",
    notes: "South Cariboo chamber. Cross-country skiing hub."
  },

  // ============================================================================
  // PRINCE GEORGE / FRASER-FORT GEORGE
  // ============================================================================
  {
    id: "prince-george-chamber",
    name: "Prince George Chamber of Commerce",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    location: {
      address: "Prince George",
      lat: 53.9171,
      lng: -122.7497
    },
    website: "https://www.pgchamber.bc.ca",
    notes: "Northern BC's largest city. Forestry and resource hub."
  },

  // ============================================================================
  // NORTHERN BC
  // ============================================================================
  {
    id: "fort-st-john-chamber",
    name: "Fort St. John & District Chamber of Commerce",
    municipality: "Fort St. John",
    region: "Peace River",
    location: {
      address: "100-9907 99 Ave, Fort St. John, BC",
      lat: 56.2465,
      lng: -120.8476
    },
    email: "info@fsjchamber.com",
    website: "https://www.fsjchamber.com",
    notes: "Represents North Peace Region including Taylor, Prophet River, Hudson's Hope."
  },
  {
    id: "dawson-creek-chamber",
    name: "Dawson Creek & District Chamber of Commerce",
    municipality: "Dawson Creek",
    region: "Peace River",
    location: {
      address: "Dawson Creek",
      lat: 55.7596,
      lng: -120.2377
    },
    website: "https://www.dawsoncreekchamber.ca",
    notes: "Mile Zero of the Alaska Highway."
  },
  {
    id: "fort-nelson-chamber",
    name: "Fort Nelson & District Chamber of Commerce",
    municipality: "Fort Nelson",
    region: "Northern Rockies",
    location: {
      address: "Fort Nelson",
      lat: 58.8050,
      lng: -122.6972
    },
    website: "https://www.fortnelsonchamber.com",
    notes: "Gateway to Northern Rockies."
  },
  {
    id: "terrace-chamber",
    name: "Terrace & District Chamber of Commerce",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    location: {
      address: "Terrace",
      lat: 54.5182,
      lng: -128.6037
    },
    website: "https://www.terracechamber.com",
    notes: "Serving Terrace and Northwest BC."
  },
  {
    id: "kitimat-chamber",
    name: "Kitimat Chamber of Commerce",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    location: {
      address: "Kitimat",
      lat: 54.0523,
      lng: -128.6537
    },
    website: "https://www.kitimatchamber.ca",
    notes: "Industrial hub. LNG Canada project."
  },
  {
    id: "prince-rupert-chamber",
    name: "Prince Rupert & District Chamber of Commerce",
    municipality: "Prince Rupert",
    region: "North Coast",
    location: {
      address: "Prince Rupert",
      lat: 54.3150,
      lng: -130.3208
    },
    website: "https://www.princerupertchamber.ca",
    notes: "Pacific gateway port city."
  },
  {
    id: "smithers-chamber",
    name: "Smithers District Chamber of Commerce",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    location: {
      address: "Smithers",
      lat: 54.7804,
      lng: -127.1743
    },
    website: "https://www.smitherschamber.com",
    notes: "Bavarian-themed town in Bulkley Valley."
  },

  // ============================================================================
  // KOOTENAYS
  // ============================================================================
  {
    id: "nelson-chamber",
    name: "Nelson & District Chamber of Commerce",
    municipality: "Nelson",
    region: "Central Kootenay",
    location: {
      address: "91 Baker Street, Nelson, BC V1L 4G8",
      lat: 49.4928,
      lng: -117.2948
    },
    phone: "(250) 352-3433",
    email: "info@discovernelson.com",
    website: "https://www.discovernelson.com",
    members: "500+",
    notes: "First point of contact for business and relocation."
  },
  {
    id: "cranbrook-chamber",
    name: "Cranbrook & District Chamber of Commerce",
    municipality: "Cranbrook",
    region: "East Kootenay",
    location: {
      address: "2279 Cranbrook Street North, Cranbrook, BC V1C 4H6",
      lat: 49.5097,
      lng: -115.7687
    },
    phone: "(250) 426-5914",
    website: "https://www.cranbrookchamber.com",
    members: "400+",
    notes: "Located at Visitor Information Centre."
  },
  {
    id: "trail-chamber",
    name: "Trail & District Chamber of Commerce",
    municipality: "Trail",
    region: "Kootenay Boundary",
    location: {
      address: "Trail",
      lat: 49.0966,
      lng: -117.7103
    },
    website: "https://www.trailchamber.bc.ca",
    notes: "Home of Teck smelter."
  },
  {
    id: "castlegar-chamber",
    name: "Castlegar & District Chamber of Commerce",
    municipality: "Castlegar",
    region: "Central Kootenay",
    location: {
      address: "Castlegar",
      lat: 49.3255,
      lng: -117.6662
    },
    website: "https://www.castlegarchamber.com",
    notes: "Confluence of Columbia and Kootenay rivers."
  },
  {
    id: "revelstoke-chamber",
    name: "Revelstoke Chamber of Commerce",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    location: {
      address: "Revelstoke",
      lat: 50.9981,
      lng: -118.1957
    },
    website: "https://www.revelstokechamber.com",
    notes: "Mountain resort and railway town."
  },
  {
    id: "golden-chamber",
    name: "Golden & District Chamber of Commerce",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    location: {
      address: "Golden",
      lat: 51.2985,
      lng: -116.9631
    },
    website: "https://www.goldenchamber.bc.ca",
    notes: "Gateway to six national parks."
  },
  {
    id: "fernie-chamber",
    name: "Fernie Chamber of Commerce",
    municipality: "Fernie",
    region: "East Kootenay",
    location: {
      address: "Fernie",
      lat: 49.5040,
      lng: -115.0631
    },
    website: "https://www.ferniechamber.com",
    notes: "Ski resort and outdoor recreation hub."
  },
  {
    id: "invermere-chamber",
    name: "Invermere & District Chamber of Commerce",
    municipality: "Invermere",
    region: "East Kootenay",
    location: {
      address: "Invermere",
      lat: 50.5065,
      lng: -116.0312
    },
    website: "https://www.invermerechamber.ca",
    notes: "Columbia Valley tourism."
  },
  {
    id: "kimberley-chamber",
    name: "Kimberley & District Chamber of Commerce",
    municipality: "Kimberley",
    region: "East Kootenay",
    location: {
      address: "Kimberley",
      lat: 49.6700,
      lng: -115.9775
    },
    website: "https://www.kimberleychamber.com",
    notes: "Bavarian city of the Rockies."
  },
  {
    id: "creston-chamber",
    name: "Creston Valley Chamber of Commerce",
    municipality: "Creston",
    region: "Central Kootenay",
    location: {
      address: "Creston",
      lat: 49.0956,
      lng: -116.5131
    },
    website: "https://www.crestonvalleychamber.com",
    notes: "Fruit-growing and agriculture."
  },

  // ============================================================================
  // SEA-TO-SKY / SQUAMISH-LILLOOET
  // ============================================================================
  {
    id: "whistler-chamber",
    name: "Whistler Chamber of Commerce",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    location: {
      address: "201-4230 Gateway Drive, Whistler, BC V8E 0Z8",
      lat: 50.1163,
      lng: -122.9574
    },
    phone: "(604) 932-5922",
    email: "chamber@whistlerchamber.com",
    website: "https://www.whistlerchamber.com",
    founded: 1966,
    members: "700-800",
    notes: "One of BC's largest and most influential business organizations."
  },
  {
    id: "squamish-chamber",
    name: "Squamish Chamber of Commerce",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    location: {
      address: "#102, 38551 Loggers Lane, Squamish, BC V8B 0H2",
      lat: 49.7016,
      lng: -123.1558
    },
    phone: "(604) 815-4990",
    email: "admin@squamishchamber.com",
    website: "https://www.squamishchamber.com",
    founded: 1934,
    notes: "Largest and oldest business organization in Squamish."
  },
  {
    id: "pemberton-chamber",
    name: "Pemberton & District Chamber of Commerce",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    location: {
      address: "Pemberton",
      lat: 50.3222,
      lng: -122.8028
    },
    website: "https://www.pembertonchamber.com",
    notes: "Gateway to Pemberton Valley."
  },
  {
    id: "lillooet-chamber",
    name: "Lillooet & District Chamber of Commerce",
    municipality: "Lillooet",
    region: "Squamish-Lillooet",
    location: {
      address: "Lillooet",
      lat: 50.6856,
      lng: -121.9428
    },
    website: "https://www.lillooetchamber.com",
    notes: "Mile 0 of the Cariboo Gold Rush Trail."
  },

  // ============================================================================
  // SUNSHINE COAST / POWELL RIVER
  // ============================================================================
  {
    id: "sechelt-chamber",
    name: "Sechelt & District Chamber of Commerce",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    location: {
      address: "Sechelt",
      lat: 49.4742,
      lng: -123.7545
    },
    website: "https://www.secheltchamber.bc.ca",
    notes: "Serving central Sunshine Coast."
  },
  {
    id: "gibsons-chamber",
    name: "Gibsons & District Chamber of Commerce",
    municipality: "Gibsons",
    region: "Sunshine Coast",
    location: {
      address: "Gibsons",
      lat: 49.3965,
      lng: -123.5053
    },
    website: "https://www.gibsonschamber.com",
    notes: "Beachcombers country."
  },
  {
    id: "pender-harbour-chamber",
    name: "Pender Harbour & Egmont Chamber of Commerce",
    municipality: "Pender Harbour",
    region: "Sunshine Coast",
    location: {
      address: "Madeira Park",
      lat: 49.6284,
      lng: -124.0268
    },
    notes: "Upper Sunshine Coast."
  },
  {
    id: "powell-river-chamber",
    name: "Powell River Chamber of Commerce",
    municipality: "Powell River",
    region: "Powell River",
    location: {
      address: "Powell River",
      lat: 49.8353,
      lng: -124.5247
    },
    website: "https://www.powellriverchamber.com",
    notes: "Serving Powell River and Texada Island."
  }
];

export const chambersOfCommerceCount = BC_CHAMBERS_OF_COMMERCE.length;
