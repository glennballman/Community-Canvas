/**
 * BC Chambers of Commerce Dataset
 * Comprehensive list of chambers of commerce and boards of trade across British Columbia
 * Including smaller and unincorporated community chambers
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
    members: "3,000+",
    notes: "Formed from merger of Surrey and White Rock chambers. Trade Accelerator Program (TAP). Top 10 largest in Canada."
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
    members: "700-1,000",
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
    members: "450+",
    notes: "Originally Board of Trade (1910), became Chamber in 1961."
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
      address: "#205 - 2773 Barnet Highway, Coquitlam, BC V3B 1C2",
      lat: 49.2838,
      lng: -122.7932
    },
    phone: "(604) 464-2716",
    website: "https://www.tricitieschamber.com",
    founded: 1971,
    members: "1,300+",
    notes: "Serving Coquitlam, Port Coquitlam, Port Moody, Anmore, and Belcarra."
  },
  {
    id: "cloverdale-district-chamber",
    name: "Cloverdale District Chamber of Commerce",
    municipality: "Surrey",
    region: "Metro Vancouver",
    location: {
      address: "5738 176 St, Surrey, BC V3S 4C8",
      lat: 49.1044,
      lng: -122.7239
    },
    phone: "(604) 574-9802",
    email: "info@cloverdalechamber.ca",
    website: "https://www.cloverdalechamber.ca",
    founded: 1949,
    notes: "Serving Cloverdale, Clayton, and Campbell Heights since 1949."
  },
  {
    id: "new-westminster-chamber",
    name: "New Westminster Chamber of Commerce",
    municipality: "New Westminster",
    region: "Metro Vancouver",
    location: {
      address: "201-309 Sixth Street, New Westminster, BC V3L 3A7",
      lat: 49.2057,
      lng: -122.9110
    },
    phone: "(604) 521-7781",
    website: "https://www.newwestchamber.com",
    founded: 1883,
    members: "240",
    notes: "One of BC's oldest chambers (141+ years). Exploring merger with Tri-Cities/Burnaby."
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
    members: "800",
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
    members: "500+",
    notes: "4th fastest-growing in Canada 2024 (8.6% growth). 120+ years in operation."
  },
  {
    id: "langley-chamber-of-commerce",
    name: "Greater Langley Chamber of Commerce",
    municipality: "Langley",
    region: "Fraser Valley",
    location: {
      address: "207 - 8047 199 Street, Langley, BC V2Y 0E2",
      lat: 49.1044,
      lng: -122.6608
    },
    phone: "(604) 371-3770",
    website: "https://www.langleychamber.com",
    founded: 1931,
    members: "1,100+",
    notes: "BC's Fastest-Growing Chamber 2025. Nearly 70% small businesses."
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
    phone: "(604) 826-6914",
    website: "https://www.missionchamber.bc.ca",
    founded: 1893,
    members: "425+",
    notes: "BC's 4th Board of Trade. 70% of members have 5 or fewer employees."
  },
  {
    id: "maple-ridge-pitt-meadows-chamber",
    name: "Ridge Meadows Chamber of Commerce",
    municipality: "Maple Ridge",
    region: "Fraser Valley",
    location: {
      address: "#6 - 20214 Lougheed Highway, Maple Ridge, BC V2X 2P7",
      lat: 49.2193,
      lng: -122.5984
    },
    phone: "(604) 457-4599",
    website: "https://www.ridgemeadowschamber.com",
    members: "507",
    notes: "Serving Maple Ridge and Pitt Meadows. Target 530 members by 2025."
  },
  {
    id: "hope-chamber-of-commerce",
    name: "Hope & District Chamber of Commerce",
    municipality: "Hope",
    region: "Fraser Valley",
    location: {
      address: "P.O. Box 588, Hope, BC V0X 1L0",
      lat: 49.3858,
      lng: -121.4419
    },
    phone: "(604) 869-2021",
    email: "info@hopechamber.ca",
    website: "https://www.hopechamber.ca",
    members: "100+",
    notes: "Gateway to the Fraser Canyon. Serves Laidlaw to Boston Bar."
  },
  {
    id: "harrison-hot-springs-chamber",
    name: "Harrison Hot Springs Chamber of Commerce",
    municipality: "Harrison Hot Springs",
    region: "Fraser Valley",
    location: {
      address: "Harrison Hot Springs",
      lat: 49.2997,
      lng: -121.7855
    },
    website: "https://www.tourharrison.com",
    notes: "Resort community on Harrison Lake."
  },
  {
    id: "agassiz-chamber",
    name: "Agassiz-Harrison Chamber of Commerce",
    municipality: "Agassiz",
    region: "Fraser Valley",
    location: {
      address: "Agassiz",
      lat: 49.2389,
      lng: -121.7622
    },
    notes: "Serving Agassiz and Kent communities."
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
      address: "2830 Aldwynd Road, Victoria, BC V9B 3S7",
      lat: 48.4506,
      lng: -123.5058
    },
    phone: "(250) 478-1130",
    website: "https://www.westshore.bc.ca",
    members: "500+",
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
      address: "10382 Patricia Bay Hwy, Sidney, BC V8L 5S8",
      lat: 48.6500,
      lng: -123.3986
    },
    phone: "(250) 656-3616",
    email: "info@peninsulachamber.ca",
    website: "https://www.peninsulachamber.ca",
    members: "300+",
    notes: "Serving Sidney, North Saanich, Central Saanich. Manufacturing, tech, service sectors."
  },
  {
    id: "salt-spring-chamber",
    name: "Salt Spring Island Chamber of Commerce",
    municipality: "Salt Spring Island",
    region: "Capital",
    location: {
      address: "121 Lower Ganges Rd, Salt Spring Island, BC V8K 2T1",
      lat: 48.8547,
      lng: -123.5086
    },
    phone: "(250) 537-4223",
    website: "https://www.saltspringchamber.com",
    founded: 1948,
    members: "300+",
    notes: "First Chamber in Canada accredited by Green Tourism Canada. Manages Visitor Centre."
  },
  {
    id: "pender-island-chamber",
    name: "Pender Island Chamber of Commerce",
    municipality: "Pender Island",
    region: "Capital",
    location: {
      address: "31-4605 Bedwell Harbour Rd, Pender Island, BC V0N 2M0",
      lat: 48.7742,
      lng: -123.2742
    },
    phone: "(250) 629-3665",
    email: "info@penderislandchamber.com",
    website: "https://www.penderislandchamber.com",
    notes: "Covers North and South Pender Islands. Visitor Centre at Driftwood Centre."
  },

  // ============================================================================
  // VANCOUVER ISLAND - SOUTH (COWICHAN VALLEY)
  // ============================================================================
  {
    id: "duncan-cowichan-chamber",
    name: "Duncan Cowichan Chamber of Commerce",
    municipality: "Duncan",
    region: "Cowichan Valley",
    location: {
      address: "2896 Drinkwater Road, Duncan, BC V9L 6C2",
      lat: 48.7787,
      lng: -123.7079
    },
    phone: "(250) 748-1111",
    website: "https://www.duncancc.bc.ca",
    founded: 1908,
    members: "600+",
    notes: "Largest business org in Cowichan Valley. Operates Cowichan Regional Visitor Centre."
  },
  {
    id: "ladysmith-chamber",
    name: "Ladysmith Chamber of Commerce",
    municipality: "Ladysmith",
    region: "Cowichan Valley",
    location: {
      address: "33 Roberts Street, P.O. Box 598, Ladysmith, BC V9G 1A4",
      lat: 48.9975,
      lng: -123.8181
    },
    phone: "(250) 245-2112",
    email: "info@ladysmithcofc.com",
    website: "https://www.ladysmithcofc.com",
    notes: "Mid-Vancouver Island. Active community events, Tour de Rock sponsorship."
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
  {
    id: "cowichan-lake-chamber",
    name: "Cowichan Lake District Chamber of Commerce",
    municipality: "Lake Cowichan",
    region: "Cowichan Valley",
    location: {
      address: "125C South Shore Road, P.O. Box 824, Lake Cowichan, BC V0R 2G0",
      lat: 48.8258,
      lng: -124.0541
    },
    phone: "(250) 749-3244",
    website: "https://www.cowichanlake.ca",
    founded: 1946,
    notes: "Originally Board of Trade. Covers Cowichan Lake area."
  },

  // ============================================================================
  // VANCOUVER ISLAND - CENTRAL (NANAIMO / PARKSVILLE / QUALICUM)
  // ============================================================================
  {
    id: "greater-nanaimo-chamber",
    name: "Greater Nanaimo Chamber of Commerce",
    municipality: "Nanaimo",
    region: "Nanaimo",
    location: {
      address: "2133 Bowen Rd, Nanaimo, BC V9S 1H8",
      lat: 49.1659,
      lng: -123.9401
    },
    phone: "(250) 756-1191",
    email: "memberservices@nanaimochamber.bc.ca",
    website: "https://www.nanaimochamber.bc.ca",
    members: "730+",
    notes: "Third largest on Vancouver Island. Hosts annual Business Expo."
  },
  {
    id: "parksville-chamber",
    name: "Parksville & District Chamber of Commerce",
    municipality: "Parksville",
    region: "Nanaimo",
    location: {
      address: "1275 East Island Highway, P.O. Box 99, Parksville, BC V9P 2G3",
      lat: 49.3150,
      lng: -124.3119
    },
    phone: "(250) 248-3613",
    website: "https://www.parksvillechamber.com",
    founded: 1927,
    members: "380-430",
    notes: "Summer by the Sea Street Market. Canadian Open Sand Sculpting Competition."
  },
  {
    id: "qualicum-beach-chamber",
    name: "Qualicum Beach Chamber of Commerce",
    municipality: "Qualicum Beach",
    region: "Nanaimo",
    location: {
      address: "2711 W Island Highway, Qualicum Beach, BC V9K 2C4",
      lat: 49.3500,
      lng: -124.4357
    },
    phone: "(250) 752-9532",
    email: "chamber@qualicum.bc.ca",
    website: "https://www.qualicum.bc.ca",
    founded: 1927,
    members: "200",
    notes: "Voice of Business since 1927. Operates Visitor Centre. Growing membership."
  },

  // ============================================================================
  // VANCOUVER ISLAND - COMOX VALLEY / STRATHCONA
  // ============================================================================
  {
    id: "comox-valley-chamber",
    name: "Comox Valley Chamber of Commerce",
    municipality: "Courtenay",
    region: "Comox Valley",
    location: {
      address: "#103 576 England Ave, Courtenay, BC V9N 2L3",
      lat: 49.6879,
      lng: -124.9941
    },
    phone: "(250) 334-3234",
    email: "hello@comoxvalleychamber.com",
    website: "https://www.comoxvalleychamber.com",
    members: "500",
    notes: "Third largest chamber in BC. Business Hub co-working space."
  },
  {
    id: "campbell-river-chamber",
    name: "Campbell River & District Chamber of Commerce",
    municipality: "Campbell River",
    region: "Strathcona",
    location: {
      address: "900 Alder Street, Campbell River, BC V9W 2P6",
      lat: 50.0244,
      lng: -125.2475
    },
    phone: "(250) 287-4636",
    email: "exdir@crchamber.ca",
    website: "https://www.campbellriverchamber.ca",
    members: "250+",
    notes: "Salmon Capital of the World. Gateway to Discovery Islands. 30+ cost-saving programs."
  },

  // ============================================================================
  // VANCOUVER ISLAND - NORTH (MOUNT WADDINGTON)
  // ============================================================================
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
    notes: "Gateway to Cape Scott and North Island. BC Ferries terminal."
  },
  {
    id: "port-mcneill-chamber",
    name: "Port McNeill & District Chamber of Commerce",
    municipality: "Port McNeill",
    region: "Mount Waddington",
    location: {
      address: "Port McNeill",
      lat: 50.5903,
      lng: -127.0847
    },
    website: "https://www.portmcneillchamber.com",
    notes: "Serving Port McNeill and North Island communities."
  },
  {
    id: "alert-bay-chamber",
    name: "Alert Bay Chamber of Commerce",
    municipality: "Alert Bay",
    region: "Mount Waddington",
    location: {
      address: "Alert Bay, Cormorant Island",
      lat: 50.5867,
      lng: -126.9342
    },
    notes: "Serving 'Namgis First Nation territory and Cormorant Island."
  },

  // ============================================================================
  // VANCOUVER ISLAND - WEST COAST (ALBERNI-CLAYOQUOT)
  // ============================================================================
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
    members: "320",
    notes: "Gateway to West Coast. MV Frances Barkley heritage vessel."
  },
  {
    id: "tofino-chamber",
    name: "Tofino-Long Beach Chamber of Commerce",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    location: {
      address: "632 Main St, P.O. Box 249, Tofino, BC V0R 2Z0",
      lat: 49.1530,
      lng: -125.9066
    },
    phone: "(250) 725-3153",
    website: "https://www.tofinochamber.org",
    founded: 1929,
    members: "350+",
    notes: "Tourism, hospitality, adventure sectors. Partnership with Tourism Tofino."
  },
  {
    id: "ucluelet-chamber",
    name: "Ucluelet Chamber of Commerce",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    location: {
      address: "Ucluelet",
      lat: 48.9423,
      lng: -125.5466
    },
    email: "chamberoffice@uclueletchamber.com",
    website: "https://www.uclueletchamber.com",
    notes: "Pacific Rim National Park gateway. Storm-watching destination."
  },
  {
    id: "bamfield-chamber",
    name: "Bamfield Chamber of Commerce",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    location: {
      address: "Grappler Rd, Bamfield, BC V0R 1B0",
      lat: 48.8336,
      lng: -125.1383
    },
    phone: "(250) 728-3500",
    website: "https://www.bamfieldchamber.com",
    notes: "Remote coastal community. West Coast Trail terminus. Bamfield Marine Sciences Centre."
  },
  {
    id: "port-renfrew-chamber",
    name: "Port Renfrew Chamber of Commerce",
    municipality: "Port Renfrew",
    region: "Capital",
    location: {
      address: "1 Parkinson Rd, Box 39, Sooke, BC V0S 1K0",
      lat: 48.5547,
      lng: -124.4211
    },
    founded: 2000,
    website: "https://www.portrenfrewchamber.com",
    members: "40+",
    notes: "West Coast Trail terminus. Tall Trees Capital. Avatar Grove."
  },

  // ============================================================================
  // OKANAGAN - CENTRAL
  // ============================================================================
  {
    id: "kelowna-chamber",
    name: "Kelowna Chamber of Commerce",
    municipality: "Kelowna",
    region: "Central Okanagan",
    location: {
      address: "Kelowna, BC",
      lat: 49.8863,
      lng: -119.4966
    },
    website: "https://www.kelownachamber.org",
    founded: 1906,
    members: "1,000",
    notes: "50+ networking events annually. Top 40 Under 40, Business Excellence Awards."
  },
  {
    id: "west-kelowna-board-of-trade",
    name: "Greater Westside Board of Trade",
    municipality: "West Kelowna",
    region: "Central Okanagan",
    location: {
      address: "West Kelowna",
      lat: 49.8625,
      lng: -119.5833
    },
    website: "https://www.gwboardoftrade.com",
    members: "400",
    notes: "West Kelowna's chamber of commerce. Business After Hours, annual awards."
  },
  {
    id: "lake-country-chamber",
    name: "Lake Country Chamber of Commerce",
    municipality: "Lake Country",
    region: "Central Okanagan",
    location: {
      address: "#102-3121 Hill Rd, Lake Country, BC",
      lat: 50.0303,
      lng: -119.4087
    },
    phone: "(250) 766-5670",
    website: "https://www.lakecountrychamber.com",
    members: "265+",
    notes: "77% growth 2016-2018. Business Excellence Awards."
  },
  {
    id: "peachland-chamber",
    name: "Peachland Chamber of Commerce",
    municipality: "Peachland",
    region: "Central Okanagan",
    location: {
      address: "5878C Beach Avenue, Peachland, BC V0H 1X7",
      lat: 49.7764,
      lng: -119.7378
    },
    phone: "(250) 767-2455",
    email: "peachlandchamber@gmail.com",
    website: "https://www.peachlandchamber.com",
    founded: 2000,
    notes: "Economic prosperity through connectivity, education, advocacy."
  },

  // ============================================================================
  // OKANAGAN - NORTH
  // ============================================================================
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
    members: "700",
    notes: "10th fastest-growing in Canada 2025. Serving Vernon and North Okanagan."
  },
  {
    id: "armstrong-spallumcheen-chamber",
    name: "Armstrong Spallumcheen Chamber of Commerce",
    municipality: "Armstrong",
    region: "North Okanagan",
    location: {
      address: "Armstrong",
      lat: 50.4489,
      lng: -119.1958
    },
    website: "https://www.aschamber.com",
    notes: "Famous for IPE (Interior Provincial Exhibition)."
  },
  {
    id: "enderby-chamber",
    name: "Enderby & District Chamber of Commerce",
    municipality: "Enderby",
    region: "North Okanagan",
    location: {
      address: "702 Railway St, P.O. Box 1000, Enderby, BC V0E 1V0",
      lat: 50.5500,
      lng: -119.1400
    },
    phone: "(250) 838-6727",
    members: "59",
    notes: "Shuswap River community. 200+ businesses in the area."
  },

  // ============================================================================
  // OKANAGAN - SOUTH / SIMILKAMEEN
  // ============================================================================
  {
    id: "penticton-chamber",
    name: "Penticton & Wine Country Chamber of Commerce",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    location: {
      address: "185 Lakeshore Drive West, Penticton, BC V2A 1B7",
      lat: 49.4991,
      lng: -119.5937
    },
    phone: "778-476-3111",
    email: "admin@penticton.org",
    website: "https://www.penticton.org",
    members: "475",
    notes: "Certified by Chamber Accreditation Council of Canada."
  },
  {
    id: "south-okanagan-chamber",
    name: "South Okanagan Chamber of Commerce",
    municipality: "Oliver",
    region: "Okanagan-Similkameen",
    location: {
      address: "6237 Main St, P.O. Box 1414, Oliver, BC V0H 1T0",
      lat: 49.1845,
      lng: -119.5503
    },
    phone: "(250) 498-6321",
    email: "admin@sochamber.ca",
    website: "https://www.sochamber.ca",
    founded: 2009,
    members: "300",
    notes: "Amalgamation of Oliver, Osoyoos, Okanagan Falls chambers."
  },
  {
    id: "summerland-chamber",
    name: "Summerland Chamber of Economic Development & Tourism",
    municipality: "Summerland",
    region: "Okanagan-Similkameen",
    location: {
      address: "15600 Highway 97, P.O. Box 130, Summerland, BC V0H 1Z0",
      lat: 49.6009,
      lng: -119.6772
    },
    phone: "(250) 494-2686",
    website: "https://www.summerlandchamber.com",
    founded: 1908,
    members: "700+",
    notes: "Only BC chamber where every business license holder is automatically a member. Top 25 largest in BC."
  },
  {
    id: "similkameen-chamber",
    name: "Similkameen Chamber of Commerce",
    municipality: "Keremeos",
    region: "Okanagan-Similkameen",
    location: {
      address: "Keremeos",
      lat: 49.2028,
      lng: -119.8292
    },
    phone: "(250) 499-5225",
    email: "chamber@similkameencountry.org",
    website: "https://www.similkameencountry.org",
    notes: "Serving Keremeos, Cawston, Hedley, Similkameen Valley."
  },
  {
    id: "princeton-chamber",
    name: "Princeton & District Chamber of Commerce",
    municipality: "Princeton",
    region: "Okanagan-Similkameen",
    location: {
      address: "139 Vermilion Ave, Princeton, BC V0X 1W0",
      lat: 49.4589,
      lng: -120.5061
    },
    website: "https://www.princetonchamber.ca",
    notes: "Gateway to Manning Park."
  },

  // ============================================================================
  // SHUSWAP / COLUMBIA-SHUSWAP
  // ============================================================================
  {
    id: "salmon-arm-chamber",
    name: "Salmon Arm & District Chamber of Commerce",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    location: {
      address: "P.O. Box 999, 101 160 Harbourfront Dr NE, Salmon Arm, BC V1E 4P2",
      lat: 50.7019,
      lng: -119.2908
    },
    phone: "(250) 832-6247",
    email: "admin@sachamber.bc.ca",
    website: "https://sachamber.bc.ca",
    members: "300+",
    notes: "50+ new members in 2024. Serving Salmon Arm and Shuswap region."
  },
  {
    id: "sicamous-chamber",
    name: "Sicamous and District Chamber of Commerce",
    municipality: "Sicamous",
    region: "Columbia-Shuswap",
    location: {
      address: "P.O. Box 346, 3 446 Main St, Sicamous, BC V0E 2V0",
      lat: 50.8367,
      lng: -118.9761
    },
    phone: "(250) 836-3313",
    notes: "Houseboat capital of Canada."
  },
  {
    id: "revelstoke-chamber",
    name: "Revelstoke Chamber of Commerce",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    location: {
      address: "301 Victoria Road, P.O. Box 490, Revelstoke, BC V0E 2S0",
      lat: 50.9981,
      lng: -118.1957
    },
    phone: "(250) 837-5345",
    email: "info@revelstokechamber.com",
    website: "https://www.revelstokechamber.com",
    founded: 1895,
    members: "440+",
    notes: "BC's fastest-growing chamber 2024 (29.5% growth). 129+ years in operation."
  },
  {
    id: "golden-chamber",
    name: "Kicking Horse Country Chamber of Commerce",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    location: {
      address: "500 10th Ave N, P.O. Box 1320, Golden, BC V0A 1H0",
      lat: 51.2985,
      lng: -116.9631
    },
    phone: "(250) 344-7125",
    email: "info@goldenchamber.bc.ca",
    website: "https://www.goldenchamber.bc.ca",
    founded: 1979,
    members: "215",
    notes: "Gateway to six national parks. Business & Community Excellence Awards."
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
    phone: "(250) 372-7722",
    website: "https://www.kamloopschamber.ca",
    founded: 1896,
    members: "700+",
    notes: "Serving Thompson Valley since 1896. Visitor information center."
  },
  {
    id: "merritt-chamber",
    name: "Merritt & District Chamber of Commerce",
    municipality: "Merritt",
    region: "Thompson-Nicola",
    location: {
      address: "2058 Granite Ave, Merritt, BC",
      lat: 50.1129,
      lng: -120.7862
    },
    website: "https://www.merrittchamber.com",
    notes: "Country music capital of Canada."
  },
  {
    id: "clearwater-chamber",
    name: "Clearwater & District Chamber of Commerce",
    municipality: "Clearwater",
    region: "Thompson-Nicola",
    location: {
      address: "201 - 416 Eden Road, Clearwater, BC V0E 1N1",
      lat: 51.6511,
      lng: -120.0383
    },
    phone: "(250) 674-3530",
    email: "info@clearwaterbcchamber.com",
    website: "https://www.clearwaterbcchamber.com",
    members: "64+",
    notes: "Gateway to Wells Gray Provincial Park."
  },
  {
    id: "barriere-chamber",
    name: "Barriere & District Chamber of Commerce",
    municipality: "Barriere",
    region: "Thompson-Nicola",
    location: {
      address: "Barriere",
      lat: 51.1897,
      lng: -120.1233
    },
    notes: "North Thompson Valley community."
  },
  {
    id: "sun-peaks-chamber",
    name: "Sun Peaks Chamber of Commerce",
    municipality: "Sun Peaks",
    region: "Thompson-Nicola",
    location: {
      address: "Sun Peaks Resort",
      lat: 50.8833,
      lng: -119.9000
    },
    notes: "Resort municipality. Second largest ski area in Canada."
  },
  {
    id: "lytton-chamber",
    name: "Lytton & District Chamber of Commerce",
    municipality: "Lytton",
    region: "Thompson-Nicola",
    location: {
      address: "P.O. Box 100, 380 Main Street, Lytton, BC V0K 1Z0",
      lat: 50.2300,
      lng: -121.5800
    },
    phone: "(250) 455-2355",
    email: "hotspot@lytton.ca",
    website: "https://www.lyttonchamber.ca",
    notes: "Rebuilding after 2021 fire. Hottest spot in Canada."
  },
  {
    id: "corridor-chamber",
    name: "Desert Mesa Regional Chamber (Corridor Chamber)",
    municipality: "Ashcroft",
    region: "Thompson-Nicola",
    location: {
      address: "Ashcroft",
      lat: 50.7247,
      lng: -121.2772
    },
    website: "https://www.corridorchamber.ca",
    founded: 2023,
    notes: "Free membership. Serves Ashcroft, Cache Creek, Clinton, Spences Bridge."
  },
  {
    id: "logan-lake-chamber",
    name: "Logan Lake Chamber of Commerce",
    municipality: "Logan Lake",
    region: "Thompson-Nicola",
    location: {
      address: "Logan Lake",
      lat: 50.4928,
      lng: -120.8117
    },
    notes: "Mining community. Highland Valley Copper."
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
    id: "south-cariboo-chamber",
    name: "South Cariboo Chamber of Commerce",
    municipality: "100 Mile House",
    region: "Cariboo",
    location: {
      address: "#2-385 Birch Ave, P.O. Box 2312, 100 Mile House, BC V0K 2E0",
      lat: 51.6418,
      lng: -121.2940
    },
    phone: "(250) 395-6124",
    email: "manager@southcariboochamber.org",
    website: "https://www.southcariboochamber.org",
    members: "85+",
    notes: "Cross-country skiing hub. 100 Mile House and area."
  },
  {
    id: "clinton-chamber",
    name: "Clinton and District Chamber of Commerce",
    municipality: "Clinton",
    region: "Cariboo",
    location: {
      address: "P.O. Box 256, 1507 Cariboo Highway, Clinton, BC V0K 1K0",
      lat: 51.0908,
      lng: -121.5861
    },
    phone: "(250) 459-2640",
    notes: "Historic Cariboo Gold Rush Trail."
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
      address: "890 Vancouver Street, Prince George, BC V2L 2P5",
      lat: 53.9171,
      lng: -122.7497
    },
    phone: "(250) 562-2454",
    website: "https://www.pgchamber.bc.ca",
    members: "850+",
    notes: "Northern BC's largest city. Forestry and resource hub."
  },
  {
    id: "valemount-chamber",
    name: "Valemount & Area Chamber of Commerce",
    municipality: "Valemount",
    region: "Fraser-Fort George",
    location: {
      address: "P.O. Box 690, Valemount, BC V0E 2Z0",
      lat: 52.8306,
      lng: -119.2639
    },
    phone: "(250) 566-0061",
    website: "https://www.valemountchamber.com",
    notes: "Gateway to Mount Robson. Snowmobiling destination."
  },
  {
    id: "mcbride-chamber",
    name: "McBride & District Chamber of Commerce",
    municipality: "McBride",
    region: "Fraser-Fort George",
    location: {
      address: "McBride",
      lat: 53.3000,
      lng: -120.1667
    },
    notes: "Robson Valley community."
  },

  // ============================================================================
  // NORTHERN BC - BULKLEY-NECHAKO
  // ============================================================================
  {
    id: "vanderhoof-chamber",
    name: "Vanderhoof & District Chamber of Commerce",
    municipality: "Vanderhoof",
    region: "Bulkley-Nechako",
    location: {
      address: "2750 Burrard St, P.O. Box 126, Vanderhoof, BC V0J 3A0",
      lat: 54.0167,
      lng: -124.0000
    },
    phone: "(250) 567-2124",
    website: "https://www.vanderhoofchamber.com",
    members: "150+",
    notes: "Geographic centre of BC. Visitor info centre."
  },
  {
    id: "fort-st-james-chamber",
    name: "Fort St. James Chamber of Commerce",
    municipality: "Fort St. James",
    region: "Bulkley-Nechako",
    location: {
      address: "115 Douglas Avenue, P.O. Box 1164, Fort St. James, BC V0J 1P0",
      lat: 54.4439,
      lng: -124.2514
    },
    phone: "(250) 996-7023",
    website: "https://www.fortstjameschamber.ca",
    notes: "Historic fur trading post. Stuart Lake."
  },
  {
    id: "burns-lake-chamber",
    name: "Burns Lake & District Chamber of Commerce",
    municipality: "Burns Lake",
    region: "Bulkley-Nechako",
    location: {
      address: "540 Highway 16 W, Burns Lake, BC V0J 1E0",
      lat: 54.2300,
      lng: -125.7600
    },
    phone: "(250) 692-3773",
    website: "https://www.burnslakechamber.com",
    founded: 1927,
    members: "136",
    notes: "Nearly 100 years old. Lakes District. Local gift certificate program."
  },
  {
    id: "houston-chamber",
    name: "Houston & District Chamber of Commerce",
    municipality: "Houston",
    region: "Bulkley-Nechako",
    location: {
      address: "3289 Highway 16, P.O. Box 396, Houston, BC V0J 1Z0",
      lat: 54.4000,
      lng: -126.6667
    },
    phone: "(250) 845-7640",
    email: "info@houstonchamber.ca",
    website: "https://www.houstonchamber.ca",
    notes: "World's Largest Fly Rod. Visitor Information Centre."
  },
  {
    id: "fraser-lake-chamber",
    name: "Fraser Lake & District Chamber of Commerce",
    municipality: "Fraser Lake",
    region: "Bulkley-Nechako",
    location: {
      address: "Fraser Lake",
      lat: 54.0500,
      lng: -124.8500
    },
    notes: "White Sturgeon conservation area."
  },
  {
    id: "smithers-chamber",
    name: "Smithers District Chamber of Commerce",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    location: {
      address: "P.O. Box 2379, Smithers, BC V0J 2N0",
      lat: 54.7800,
      lng: -127.1700
    },
    phone: "(250) 847-5072",
    email: "info@smitherschamber.com",
    website: "https://smitherschamber.com",
    founded: 1924,
    members: "200+",
    notes: "Centennial in 2024. Operates Smithers Visitor Centre. Bulkley Valley."
  },

  // ============================================================================
  // NORTHERN BC - PEACE RIVER
  // ============================================================================
  {
    id: "fort-st-john-chamber",
    name: "Fort St. John & District Chamber of Commerce",
    municipality: "Fort St. John",
    region: "Peace River",
    location: {
      address: "100-9907 99 Ave, Fort St. John, BC V1J 1V1",
      lat: 56.2465,
      lng: -120.8476
    },
    email: "info@fsjchamber.com",
    website: "https://www.fsjchamber.com",
    members: "400",
    notes: "60+ years. North Peace Region: Taylor, Prophet River, Hudson's Hope, Clayhurst."
  },
  {
    id: "dawson-creek-chamber",
    name: "Dawson Creek & District Chamber of Commerce",
    municipality: "Dawson Creek",
    region: "Peace River",
    location: {
      address: "10201 - 10th Street, Dawson Creek, BC V1G 3T5",
      lat: 55.7596,
      lng: -120.2377
    },
    phone: "(250) 782-4868",
    email: "info@dawsoncreekchamber.ca",
    website: "https://www.dawsoncreekchamber.ca",
    notes: "Mile Zero of the Alaska Highway."
  },
  {
    id: "tumbler-ridge-chamber",
    name: "Tumbler Ridge Chamber of Commerce",
    municipality: "Tumbler Ridge",
    region: "Peace River",
    location: {
      address: "P.O. Box 1780, Tumbler Ridge, BC V0C 2W0",
      lat: 55.1303,
      lng: -120.9944
    },
    phone: "(250) 242-3620",
    email: "tumblerchamber@gmail.com",
    website: "https://www.tumblerchamber.com",
    notes: "UNESCO Global Geopark. Dinosaur discoveries."
  },
  {
    id: "chetwynd-chamber",
    name: "Chetwynd Chamber of Commerce",
    municipality: "Chetwynd",
    region: "Peace River",
    location: {
      address: "5121 47th Ave NW, P.O. Box 870, Chetwynd, BC V0C 1J0",
      lat: 55.6969,
      lng: -121.6306
    },
    phone: "(250) 788-3345",
    email: "manager@chetwyndchamber.ca",
    website: "https://www.chetwyndchamber.ca",
    founded: 1959,
    notes: "Chainsaw carving capital of BC. Annual Trade Show."
  },

  // ============================================================================
  // NORTHERN BC - NORTHERN ROCKIES
  // ============================================================================
  {
    id: "fort-nelson-chamber",
    name: "Fort Nelson & District Chamber of Commerce",
    municipality: "Fort Nelson",
    region: "Northern Rockies",
    location: {
      address: "5500 Alaska Highway, P.O. Box 196, Fort Nelson, BC V0C 1R0",
      lat: 58.8050,
      lng: -122.6972
    },
    phone: "(250) 774-6400",
    website: "https://www.fortnelsonchamber.com",
    notes: "Gateway to Northern Rockies. Alaska Highway."
  },

  // ============================================================================
  // NORTHERN BC - KITIMAT-STIKINE
  // ============================================================================
  {
    id: "terrace-chamber",
    name: "Terrace & District Chamber of Commerce",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    location: {
      address: "3224 Kalum Street, Terrace, BC V8G 2N1",
      lat: 54.5182,
      lng: -128.6037
    },
    phone: "(250) 635-2063",
    email: "admin@terracechamber.com",
    website: "https://www.terracechamber.com",
    founded: 1927,
    members: "350",
    notes: "Serving Terrace, Thornhill, and Northwest BC since 1927. 350+ business networking."
  },
  {
    id: "kitimat-chamber",
    name: "Kitimat Chamber of Commerce",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    location: {
      address: "P.O. Box 214, Kitimat, BC V8C 2G7",
      lat: 54.0523,
      lng: -128.6537
    },
    phone: "(250) 632-6294",
    website: "https://www.kitimatchamber.ca",
    notes: "Industrial hub. LNG Canada project."
  },
  {
    id: "stewart-chamber",
    name: "Stewart/Hyder International Chamber of Commerce",
    municipality: "Stewart",
    region: "Kitimat-Stikine",
    location: {
      address: "P.O. Box 306, Stewart, BC V0T 1W0",
      lat: 55.9361,
      lng: -129.9889
    },
    phone: "(250) 636-9224",
    notes: "Canada's most northerly ice-free port. International border with Hyder, Alaska."
  },

  // ============================================================================
  // NORTHERN BC - NORTH COAST
  // ============================================================================
  {
    id: "prince-rupert-chamber",
    name: "Prince Rupert & District Chamber of Commerce",
    municipality: "Prince Rupert",
    region: "North Coast",
    location: {
      address: "100-515 3rd Ave West, Prince Rupert, BC V8J 1L9",
      lat: 54.3150,
      lng: -130.3208
    },
    phone: "(250) 624-2296",
    email: "info@princerupertchamber.ca",
    website: "https://www.rupertchamber.ca",
    founded: 1908,
    members: "300",
    notes: "Deep-sea port. BC Ferries northern terminus. Originally Board of Trade."
  },

  // ============================================================================
  // KOOTENAYS - EAST
  // ============================================================================
  {
    id: "cranbrook-chamber",
    name: "Cranbrook & District Chamber of Commerce",
    municipality: "Cranbrook",
    region: "East Kootenay",
    location: {
      address: "2279 Cranbrook St N, Cranbrook, BC V1C 3T3",
      lat: 49.5097,
      lng: -115.7689
    },
    phone: "(250) 426-5914",
    website: "https://www.cranbrookchamber.com",
    founded: 1910,
    members: "450+",
    notes: "Largest city in East Kootenay. All business sizes and sectors represented."
  },
  {
    id: "kimberley-chamber",
    name: "Kimberley & District Chamber of Commerce",
    municipality: "Kimberley",
    region: "East Kootenay",
    location: {
      address: "550 Mark Street (B), Kimberley, BC V1A 2B8",
      lat: 49.6700,
      lng: -116.0000
    },
    founded: 1925,
    website: "https://www.kimberleychamber.com",
    notes: "Bavaria of the Rockies. Platzl pedestrian village."
  },
  {
    id: "fernie-chamber",
    name: "Fernie Chamber of Commerce",
    municipality: "Fernie",
    region: "East Kootenay",
    location: {
      address: "102 Commerce Road, Fernie, BC V0B 1M5",
      lat: 49.5042,
      lng: -115.0631
    },
    phone: "(250) 423-6868",
    website: "https://www.ferniechamber.com",
    members: "300",
    notes: "Runs Visitor Centre and 2nd Edition Coworking. Griz Days, Business Excellence Awards."
  },
  {
    id: "sparwood-chamber",
    name: "Sparwood & District Chamber of Commerce",
    municipality: "Sparwood",
    region: "East Kootenay",
    location: {
      address: "141A Aspen Drive, Sparwood, BC",
      lat: 49.7328,
      lng: -114.8856
    },
    phone: "(250) 425-2423",
    website: "https://www.sparwoodchamber.bc.ca",
    members: "135",
    notes: "World's Biggest Truck (Terex Titan). Coal mining community."
  },
  {
    id: "elkford-chamber",
    name: "Elkford Chamber of Commerce",
    municipality: "Elkford",
    region: "East Kootenay",
    location: {
      address: "750 Fording Drive, Elkford, BC",
      lat: 50.0244,
      lng: -114.9178
    },
    email: "info@elkfordchamber.ca",
    website: "https://www.elkfordchamber.ca",
    members: "80",
    notes: "Wild at heart. Part of Elk Valley Economic Initiative (EVEI)."
  },
  {
    id: "columbia-valley-chamber",
    name: "Columbia Valley Chamber of Commerce",
    municipality: "Invermere",
    region: "East Kootenay",
    location: {
      address: "651 Highway 93/95, P.O. Box 1019, Invermere, BC V0B 1K0",
      lat: 50.5089,
      lng: -116.0303
    },
    phone: "(250) 342-2844",
    email: "info@cvchamber.ca",
    website: "https://www.cvchamber.ca",
    members: "325-350",
    notes: "Serves Invermere, Radium Hot Springs, Panorama, Fairmont, Canal Flats, Wilmer, Edgewater."
  },
  {
    id: "creston-valley-chamber",
    name: "Creston Valley Chamber of Commerce",
    municipality: "Creston",
    region: "East Kootenay",
    location: {
      address: "121 Northwest Blvd, P.O. Box 268, Creston, BC V0B 1G0",
      lat: 49.0956,
      lng: -116.5131
    },
    phone: "(250) 428-5151",
    email: "hello@crestonvalleychamber.com",
    website: "https://www.crestonvalleychamber.com",
    founded: 1935,
    members: "140",
    notes: "Originally Creston Board of Trade. Kootenay Lake south. Agriculture and orchards."
  },

  // ============================================================================
  // KOOTENAYS - WEST / CENTRAL
  // ============================================================================
  {
    id: "nelson-chamber",
    name: "Nelson & District Chamber of Commerce",
    municipality: "Nelson",
    region: "Central Kootenay",
    location: {
      address: "Nelson, BC",
      lat: 49.4928,
      lng: -117.2948
    },
    website: "https://www.discovernelson.com",
    members: "500+",
    notes: "Queen City. Heritage downtown. Serving Nelson, Harrop/Procter, Balfour, Ainsworth."
  },
  {
    id: "trail-chamber",
    name: "Trail & District Chamber of Commerce",
    municipality: "Trail",
    region: "Central Kootenay",
    location: {
      address: "#201, 1199 Bay Avenue, Trail, BC V1R 4A4",
      lat: 49.0958,
      lng: -117.7108
    },
    phone: "(250) 368-3144",
    email: "info@trailchamber.bc.ca",
    website: "https://www.trailchamber.bc.ca",
    founded: 1900,
    members: "300+",
    notes: "Serves Trail, Rossland, Warfield, Montrose, Fruitvale."
  },
  {
    id: "castlegar-chamber",
    name: "Castlegar & District Chamber of Commerce",
    municipality: "Castlegar",
    region: "Central Kootenay",
    location: {
      address: "1995 6th Ave, Castlegar, BC V1N 4W3",
      lat: 49.3256,
      lng: -117.6592
    },
    phone: "(250) 365-6313",
    founded: 1946,
    website: "https://www.chamber.castlegar.com",
    members: "95+",
    notes: "Named BC's best chamber in 2018. 'The Confluence' mass timber building. Opened new tourism building Aug 2024."
  },
  {
    id: "nakusp-chamber",
    name: "Nakusp & District Chamber of Commerce",
    municipality: "Nakusp",
    region: "Central Kootenay",
    location: {
      address: "92 6th Ave NW, P.O. Box 387, Nakusp, BC V0G 1R0",
      lat: 50.2397,
      lng: -117.8022
    },
    phone: "(250) 265-4234",
    email: "nakusp@telus.net",
    website: "https://www.nakusparrowlakes.com",
    founded: 1985,
    members: "75",
    notes: "Arrow Lakes. Hot springs."
  },

  // ============================================================================
  // SEA TO SKY / SQUAMISH-LILLOOET
  // ============================================================================
  {
    id: "whistler-chamber",
    name: "Whistler Chamber of Commerce",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    location: {
      address: "4230 Gateway Dr #201, Whistler, BC",
      lat: 50.1163,
      lng: -122.9574
    },
    phone: "(604) 932-5922",
    email: "chamber@whistlerchamber.com",
    website: "https://www.whistlerchamber.com",
    founded: 1966,
    members: "700",
    notes: "BC's largest and most influential resort chamber. Whistler Experience program."
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
    members: "300+",
    notes: "Largest and oldest business organization in Squamish. Outdoor recreation capital."
  },
  {
    id: "pemberton-chamber",
    name: "Pemberton & District Chamber of Commerce",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    location: {
      address: "Pemberton",
      lat: 50.3167,
      lng: -122.8000
    },
    notes: "Works with Lil'wat Nation. Growing business community."
  },
  {
    id: "lillooet-chamber",
    name: "Lillooet & District Chamber of Commerce",
    municipality: "Lillooet",
    region: "Squamish-Lillooet",
    location: {
      address: "Lillooet",
      lat: 50.6869,
      lng: -121.9411
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
      address: "#102-5700 Cowrie Street, P.O. Box 360, Sechelt, BC V0N 3A0",
      lat: 49.4742,
      lng: -123.7545
    },
    phone: "(604) 885-0662",
    website: "https://www.secheltchamber.bc.ca",
    members: "200",
    notes: "Also operates as Sunshine Coast Chamber of Commerce. Roberts Creek to Halfmoon Bay."
  },
  {
    id: "gibsons-chamber",
    name: "Gibsons & District Chamber of Commerce",
    municipality: "Gibsons",
    region: "Sunshine Coast",
    location: {
      address: "Unit 20, 900 Gibsons Way (Sunnycrest Mall), P.O. Box 1190, Gibsons, BC V0N 1V0",
      lat: 49.3965,
      lng: -123.5053
    },
    phone: "(604) 886-2325",
    website: "https://www.gibsonschamber.com",
    notes: "Beachcombers country. Visitor information services."
  },
  {
    id: "pender-harbour-chamber",
    name: "Pender Harbour & District Chamber of Commerce",
    municipality: "Pender Harbour",
    region: "Sunshine Coast",
    location: {
      address: "P.O. Box 265, Madeira Park, BC V0N 2H0",
      lat: 49.6284,
      lng: -124.0268
    },
    phone: "(604) 883-2561",
    website: "https://www.penderharbour.ca",
    notes: "Covers Pender Harbour to Egmont, Francis Peninsula, Garden Bay, Ruby Lake, Earl's Cove."
  },
  {
    id: "powell-river-chamber",
    name: "Powell River Chamber of Commerce",
    municipality: "Powell River",
    region: "Powell River",
    location: {
      address: "6807 Wharf Street, Powell River, BC V8A 2T9",
      lat: 49.8353,
      lng: -124.5247
    },
    website: "https://www.powellriverchamber.com",
    notes: "Serving Powell River and Texada Island."
  },

  // ============================================================================
  // HAIDA GWAII
  // ============================================================================
  {
    id: "haida-gwaii-chamber",
    name: "Haida Gwaii Chamber of Commerce",
    municipality: "Queen Charlotte",
    region: "North Coast",
    location: {
      address: "Queen Charlotte, Haida Gwaii, BC",
      lat: 53.2541,
      lng: -132.0750
    },
    notes: "Serving the Haida Gwaii archipelago including Queen Charlotte, Skidegate, Masset, and Old Massett."
  }
];

export const chambersOfCommerceCount = BC_CHAMBERS_OF_COMMERCE.length;
