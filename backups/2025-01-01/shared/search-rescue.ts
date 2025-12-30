// BC Ground Search and Rescue (GSAR) Groups Dataset
// Source: BC Search and Rescue Association (BCSARA) - bcsara.com
// 78 volunteer SAR groups across British Columbia

export type SARCapability = 
  | 'ground_search'
  | 'rope_rescue'
  | 'swiftwater_rescue'
  | 'avalanche_rescue'
  | 'search_dogs'
  | 'mountain_rescue'
  | 'inland_water'
  | 'helicopter_operations'
  | 'first_aid'
  | 'tracking'
  | 'night_operations';

export interface SARGroup {
  id: string;
  name: string;
  short_name: string;
  municipality: string;
  region: string;
  latitude: number;
  longitude: number;
  website?: string;
  phone?: string;
  email?: string;
  coverage_area: string;
  capabilities: SARCapability[];
  notes?: string;
}

export const BC_SAR_GROUPS: SARGroup[] = [
  // ==========================================
  // VANCOUVER ISLAND & GULF ISLANDS
  // ==========================================
  {
    id: "sar-alberni-valley",
    name: "Alberni Valley Rescue Squad",
    short_name: "AVRS",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2419,
    longitude: -124.8028,
    website: "https://avrescue.ca",
    coverage_area: "Port Alberni, Bamfield, Barkley Sound, Pacific Rim area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "Covers Alberni-Clayoquot Regional District including Bamfield"
  },
  {
    id: "sar-arrowsmith",
    name: "Arrowsmith Search and Rescue",
    short_name: "Arrowsmith SAR",
    municipality: "Parksville",
    region: "Nanaimo",
    latitude: 49.3206,
    longitude: -124.3181,
    website: "https://arrowsmithsar.bc.ca",
    coverage_area: "Parksville, Qualicum Beach, Coombs, Errington, Mt Arrowsmith area",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'first_aid', 'tracking'],
    notes: "RDN Electoral Area F and surrounding communities"
  },
  {
    id: "sar-campbell-river",
    name: "Campbell River Search and Rescue",
    short_name: "CRSAR",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0247,
    longitude: -125.2437,
    website: "https://crsar.ca",
    coverage_area: "Campbell River, Quadra Island, Cortes Island, Strathcona Park area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'mountain_rescue', 'first_aid', 'tracking'],
    notes: "Strathcona Regional District coverage"
  },
  {
    id: "sar-comox-valley",
    name: "Comox Valley Search and Rescue",
    short_name: "CVSAR",
    municipality: "Courtenay",
    region: "Comox Valley",
    latitude: 49.6856,
    longitude: -124.9937,
    website: "https://cvgsar.com",
    coverage_area: "Courtenay, Comox, Cumberland, Denman Island, Hornby Island, Mt Washington",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid', 'tracking'],
    notes: "60+ volunteers, 73 tasks in 2024"
  },
  {
    id: "sar-cowichan",
    name: "Cowichan Search and Rescue",
    short_name: "Cowichan SAR",
    municipality: "Duncan",
    region: "Cowichan Valley",
    latitude: 48.7858,
    longitude: -123.7195,
    website: "https://cowichansar.ca",
    coverage_area: "Duncan, Lake Cowichan, Chemainus, Cobble Hill, Cowichan Valley",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Cowichan Valley Regional District"
  },
  {
    id: "sar-juan-de-fuca",
    name: "Juan de Fuca Search and Rescue",
    short_name: "JdF SAR",
    municipality: "Sooke",
    region: "Capital",
    latitude: 48.3739,
    longitude: -123.7261,
    website: "https://jdfsar.com",
    coverage_area: "Sooke, Jordan River, Port Renfrew, West Coast Trail, Juan de Fuca Trail",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking', 'night_operations'],
    notes: "Covers challenging West Coast Trail terrain"
  },
  {
    id: "sar-ladysmith",
    name: "Ladysmith Search and Rescue",
    short_name: "Ladysmith SAR",
    municipality: "Ladysmith",
    region: "Cowichan Valley",
    latitude: 48.9947,
    longitude: -123.8172,
    coverage_area: "Ladysmith, Saltair, North Oyster, Thetis Island",
    capabilities: ['ground_search', 'rope_rescue', 'first_aid', 'tracking'],
    notes: "North Cowichan area coverage"
  },
  {
    id: "sar-metchosin",
    name: "Metchosin Search and Rescue",
    short_name: "Metchosin SAR",
    municipality: "Metchosin",
    region: "Capital",
    latitude: 48.3833,
    longitude: -123.5333,
    coverage_area: "Metchosin, East Sooke, Colwood west areas",
    capabilities: ['ground_search', 'first_aid', 'tracking'],
    notes: "CRD Electoral Area coverage"
  },
  {
    id: "sar-nanaimo",
    name: "Nanaimo Search and Rescue",
    short_name: "Nanaimo SAR",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1659,
    longitude: -123.9401,
    website: "https://nanaimosar.com",
    coverage_area: "Nanaimo, Gabriola Island, Cedar, Lantzville, Extension",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "RDN coverage including offshore islands"
  },
  {
    id: "sar-peninsula",
    name: "Peninsula Emergency Measures Organization",
    short_name: "PEMO",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6508,
    longitude: -123.4039,
    coverage_area: "Sidney, North Saanich, Central Saanich, Victoria Airport area",
    capabilities: ['ground_search', 'first_aid', 'tracking'],
    notes: "Saanich Peninsula coverage"
  },
  {
    id: "sar-salt-spring",
    name: "Salt Spring Island Search and Rescue",
    short_name: "Salt Spring SAR",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8567,
    longitude: -123.5083,
    coverage_area: "Salt Spring Island and surrounding Gulf Islands waters",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Gulf Islands coverage"
  },
  {
    id: "sar-west-coast-inland",
    name: "West Coast Inland Search and Rescue",
    short_name: "WII SAR",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1530,
    longitude: -125.9066,
    coverage_area: "Tofino, Ucluelet, Pacific Rim National Park, Long Beach, Clayoquot Sound",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Pacific Rim region - remote wilderness coverage"
  },

  // ==========================================
  // LOWER MAINLAND & SEA-TO-SKY
  // ==========================================
  {
    id: "sar-coquitlam",
    name: "Coquitlam Search and Rescue",
    short_name: "Coquitlam SAR",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    latitude: 49.2897,
    longitude: -122.7919,
    website: "https://coquitlam-sar.bc.ca",
    coverage_area: "Coquitlam, Port Coquitlam, Port Moody, Anmore, Belcarra, Burke Mountain",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'helicopter_operations', 'first_aid', 'tracking'],
    notes: "Tri-Cities coverage, one of busiest SAR groups in BC"
  },
  {
    id: "sar-lions-bay",
    name: "Lions Bay Search and Rescue",
    short_name: "Lions Bay SAR",
    municipality: "Lions Bay",
    region: "Metro Vancouver",
    latitude: 49.4517,
    longitude: -123.2361,
    website: "https://lionsbaysar.com",
    coverage_area: "Lions Bay, Howe Sound, Brunswick Mountain, Lions peaks",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'helicopter_operations', 'first_aid'],
    notes: "Sea-to-Sky corridor - alpine terrain specialists"
  },
  {
    id: "sar-north-shore",
    name: "North Shore Rescue",
    short_name: "NSR",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3193,
    longitude: -123.0695,
    website: "https://northshorerescue.com",
    coverage_area: "North Vancouver, West Vancouver, Grouse Mountain, Seymour, Cypress, Lynn Valley",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'night_operations', 'first_aid', 'search_dogs'],
    notes: "One of busiest and most experienced SAR teams in Canada - 100+ calls/year"
  },
  {
    id: "sar-ridge-meadows",
    name: "Ridge Meadows Search and Rescue",
    short_name: "Ridge Meadows SAR",
    municipality: "Maple Ridge",
    region: "Metro Vancouver",
    latitude: 49.2194,
    longitude: -122.5984,
    website: "https://rmsar.bc.ca",
    coverage_area: "Maple Ridge, Pitt Meadows, Golden Ears Park, Pitt Lake",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "Golden Ears Provincial Park primary response"
  },
  {
    id: "sar-south-fraser",
    name: "South Fraser Search and Rescue",
    short_name: "South Fraser SAR",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1913,
    longitude: -122.8490,
    coverage_area: "Surrey, Langley, White Rock, Delta east areas",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "South of Fraser River coverage"
  },
  {
    id: "sar-pemberton",
    name: "Pemberton Search and Rescue",
    short_name: "Pemberton SAR",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    latitude: 50.3172,
    longitude: -122.8031,
    website: "https://pembertonsar.com",
    coverage_area: "Pemberton, D'Arcy, Birken, Meager Creek, Joffre Lakes area",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'first_aid'],
    notes: "Remote backcountry and alpine coverage"
  },
  {
    id: "sar-squamish",
    name: "Squamish Search and Rescue",
    short_name: "Squamish SAR",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.7016,
    longitude: -123.1558,
    website: "https://squamishsar.org",
    coverage_area: "Squamish, Porteau Cove to Whistler, Garibaldi Park, Stawamus Chief",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'swiftwater_rescue', 'helicopter_operations', 'first_aid'],
    notes: "World-class climbing terrain - technical rescue specialists"
  },
  {
    id: "sar-whistler",
    name: "Whistler Search and Rescue",
    short_name: "Whistler SAR",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    latitude: 50.1163,
    longitude: -122.9574,
    website: "https://whistlersar.com",
    coverage_area: "Whistler, Blackcomb, Callaghan Valley, Cheakamus",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'first_aid', 'search_dogs'],
    notes: "Resort and backcountry coverage - avalanche response specialists"
  },

  // ==========================================
  // FRASER VALLEY
  // ==========================================
  {
    id: "sar-chilliwack",
    name: "Chilliwack Search and Rescue",
    short_name: "Chilliwack SAR",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    latitude: 49.1655,
    longitude: -121.9506,
    website: "https://chilliwacksar.ca",
    coverage_area: "Chilliwack, Rosedale, Cultus Lake, Lindeman Lake, Chilliwack River area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'mountain_rescue', 'first_aid', 'tracking'],
    notes: "Chilliwack area including Chilliwack Lake Provincial Park"
  },
  {
    id: "sar-central-fraser-valley",
    name: "Central Fraser Valley Search and Rescue",
    short_name: "CFV SAR",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    latitude: 49.0504,
    longitude: -122.3045,
    coverage_area: "Abbotsford, Sumas Mountain, Vedder area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "FVRD coverage area"
  },
  {
    id: "sar-hope",
    name: "Hope Search and Rescue",
    short_name: "Hope SAR",
    municipality: "Hope",
    region: "Fraser Valley",
    latitude: 49.3858,
    longitude: -121.4419,
    coverage_area: "Hope, Othello Tunnels, Coquihalla, Manning Park area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'mountain_rescue', 'first_aid', 'tracking'],
    notes: "Covers major highway corridors and backcountry"
  },
  {
    id: "sar-kent-harrison",
    name: "Kent Harrison Search and Rescue",
    short_name: "KHSAR",
    municipality: "Agassiz",
    region: "Fraser Valley",
    latitude: 49.2389,
    longitude: -121.7606,
    website: "https://khsar.ca",
    coverage_area: "Agassiz, Harrison Hot Springs, Harrison Lake, Sasquatch Park",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "District of Kent coverage"
  },
  {
    id: "sar-mission",
    name: "Mission Search and Rescue",
    short_name: "Mission SAR",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1336,
    longitude: -122.3095,
    coverage_area: "Mission, Stave Lake, Hayward Lake, Dewdney area",
    capabilities: ['ground_search', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "Mission and eastern Fraser Valley"
  },

  // ==========================================
  // SUNSHINE COAST & POWELL RIVER
  // ==========================================
  {
    id: "sar-powell-river",
    name: "Powell River Search and Rescue",
    short_name: "Powell River SAR",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8354,
    longitude: -124.5245,
    website: "https://powellriversar.ca",
    coverage_area: "Powell River, Texada Island, Lund, Desolation Sound area",
    capabilities: ['ground_search', 'rope_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "Covers qathet Regional District"
  },
  {
    id: "sar-sunshine-coast",
    name: "Sunshine Coast Search and Rescue",
    short_name: "Sunshine Coast SAR",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    latitude: 49.4726,
    longitude: -123.7545,
    website: "https://sunshinecoastsar.ca",
    coverage_area: "Sechelt, Gibsons, Pender Harbour, Halfmoon Bay, Texada trails",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Sunshine Coast Regional District"
  },

  // ==========================================
  // THOMPSON-OKANAGAN
  // ==========================================
  {
    id: "sar-barriere",
    name: "Barriere Search and Rescue",
    short_name: "Barriere SAR",
    municipality: "Barriere",
    region: "Thompson-Nicola",
    latitude: 51.1833,
    longitude: -120.1333,
    coverage_area: "Barriere, North Thompson Valley, Adams Lake area",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "North Thompson coverage"
  },
  {
    id: "sar-kamloops",
    name: "Kamloops Search and Rescue",
    short_name: "Kamloops SAR",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6756,
    longitude: -120.3352,
    website: "https://kamloopssar.ca",
    coverage_area: "Kamloops, Sun Peaks, Lac Le Jeune, Paul Lake, Shuswap area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'first_aid', 'search_dogs'],
    notes: "75 calls in 2024 - New $10M facility approved 2024"
  },
  {
    id: "sar-logan-lake",
    name: "Logan Lake Search and Rescue",
    short_name: "Logan Lake SAR",
    municipality: "Logan Lake",
    region: "Thompson-Nicola",
    latitude: 50.4944,
    longitude: -120.8097,
    coverage_area: "Logan Lake, Highland Valley, Tunkwa Lake area",
    capabilities: ['ground_search', 'first_aid', 'tracking'],
    notes: "Highland Valley coverage"
  },
  {
    id: "sar-nicola-valley",
    name: "Nicola Valley Search and Rescue",
    short_name: "Nicola Valley SAR",
    municipality: "Merritt",
    region: "Thompson-Nicola",
    latitude: 50.1128,
    longitude: -120.7919,
    coverage_area: "Merritt, Nicola Valley, Douglas Lake, Quilchena",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "TNRD Nicola Valley coverage"
  },
  {
    id: "sar-wells-gray",
    name: "Wells Gray Search and Rescue",
    short_name: "Wells Gray SAR",
    municipality: "Clearwater",
    region: "Thompson-Nicola",
    latitude: 51.6500,
    longitude: -120.0333,
    coverage_area: "Clearwater, Wells Gray Park, Helmcken Falls, Blue River south",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Wells Gray Provincial Park primary response"
  },
  {
    id: "sar-central-okanagan",
    name: "Central Okanagan Search and Rescue",
    short_name: "COSAR",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8833,
    longitude: -119.4833,
    website: "https://cosar.ca",
    coverage_area: "Kelowna, West Kelowna, Peachland, Lake Country, Big White",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'first_aid', 'search_dogs'],
    notes: "Regional District of Central Okanagan - very active team"
  },
  {
    id: "sar-oliver-osoyoos",
    name: "Oliver Osoyoos Search and Rescue",
    short_name: "Oliver Osoyoos SAR",
    municipality: "Oliver",
    region: "Okanagan-Similkameen",
    latitude: 49.1833,
    longitude: -119.5500,
    coverage_area: "Oliver, Osoyoos, Anarchist Mountain, Mt Baldy area",
    capabilities: ['ground_search', 'rope_rescue', 'first_aid', 'tracking'],
    notes: "South Okanagan coverage"
  },
  {
    id: "sar-penticton",
    name: "Penticton Search and Rescue",
    short_name: "Penticton SAR",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    latitude: 49.4817,
    longitude: -119.5762,
    website: "https://pentictonsar.com",
    coverage_area: "Penticton, Naramata, Summerland, Cathedral Park area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Okanagan-Similkameen Regional District"
  },
  {
    id: "sar-princeton",
    name: "Princeton Search and Rescue",
    short_name: "Princeton SAR",
    municipality: "Princeton",
    region: "Okanagan-Similkameen",
    latitude: 49.4589,
    longitude: -120.5064,
    coverage_area: "Princeton, Tulameen, Manning Park east areas, Copper Mountain",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Similkameen Valley coverage"
  },
  {
    id: "sar-vernon",
    name: "Vernon Search and Rescue",
    short_name: "Vernon SAR",
    municipality: "Vernon",
    region: "North Okanagan",
    latitude: 50.2750,
    longitude: -119.2719,
    website: "https://vernonsar.ca",
    coverage_area: "Vernon, Armstrong, Enderby, Lumby, Silver Star, Mabel Lake",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid', 'tracking'],
    notes: "Regional District of North Okanagan"
  },

  // ==========================================
  // KOOTENAYS
  // ==========================================
  {
    id: "sar-arrow-lakes",
    name: "Arrow Lakes Search and Rescue",
    short_name: "Arrow Lakes SAR",
    municipality: "Nakusp",
    region: "Central Kootenay",
    latitude: 50.2387,
    longitude: -117.7946,
    coverage_area: "Nakusp, Arrow Lakes, Trout Lake, Fauquier",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Upper and Lower Arrow Lake coverage"
  },
  {
    id: "sar-castlegar",
    name: "Castlegar Search and Rescue",
    short_name: "Castlegar SAR",
    municipality: "Castlegar",
    region: "Central Kootenay",
    latitude: 49.3256,
    longitude: -117.6658,
    coverage_area: "Castlegar, Robson, Thrums, Pass Creek",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "RDCK Area I and J coverage"
  },
  {
    id: "sar-columbia-valley",
    name: "Columbia Valley Search and Rescue",
    short_name: "Columbia Valley SAR",
    municipality: "Invermere",
    region: "East Kootenay",
    latitude: 50.5064,
    longitude: -116.0322,
    website: "https://columbiavalleysar.ca",
    coverage_area: "Invermere, Radium, Fairmont, Panorama, Columbia Lake",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'inland_water', 'first_aid'],
    notes: "Upper Columbia Valley"
  },
  {
    id: "sar-cranbrook",
    name: "Cranbrook Search and Rescue",
    short_name: "Cranbrook SAR",
    municipality: "Cranbrook",
    region: "East Kootenay",
    latitude: 49.5097,
    longitude: -115.7631,
    coverage_area: "Cranbrook, Moyie, Yahk, Movie Lake area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "RDEK Area C coverage"
  },
  {
    id: "sar-creston-valley",
    name: "Creston Valley Search and Rescue",
    short_name: "Creston Valley SAR",
    municipality: "Creston",
    region: "Central Kootenay",
    latitude: 49.0953,
    longitude: -116.5133,
    coverage_area: "Creston, Erickson, Canyon, Creston Valley Wildlife area",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Creston Valley coverage"
  },
  {
    id: "sar-elkford",
    name: "Elkford Search and Rescue",
    short_name: "Elkford SAR",
    municipality: "Elkford",
    region: "East Kootenay",
    latitude: 50.0239,
    longitude: -114.9206,
    coverage_area: "Elkford, Elk Lakes, Fording River, Line Creek",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Elk Valley north coverage"
  },
  {
    id: "sar-fernie",
    name: "Fernie Search and Rescue",
    short_name: "Fernie SAR",
    municipality: "Fernie",
    region: "East Kootenay",
    latitude: 49.5128,
    longitude: -115.0566,
    website: "https://ferniesar.com",
    coverage_area: "Fernie, Island Lake, Coal Creek, Fernie Alpine Resort",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'first_aid'],
    notes: "Elk Valley - major ski area coverage"
  },
  {
    id: "sar-golden",
    name: "Golden Search and Rescue",
    short_name: "Golden SAR",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    latitude: 51.2972,
    longitude: -116.9631,
    website: "https://goldensar.ca",
    coverage_area: "Golden, Kicking Horse, Yoho NP interface, Rogers Pass south",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'swiftwater_rescue', 'first_aid'],
    notes: "Major mountain terrain - parks interface"
  },
  {
    id: "sar-grand-forks",
    name: "Grand Forks Search and Rescue",
    short_name: "Grand Forks SAR",
    municipality: "Grand Forks",
    region: "Kootenay Boundary",
    latitude: 49.0303,
    longitude: -118.4406,
    coverage_area: "Grand Forks, Christina Lake, Boundary area",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Boundary region coverage"
  },
  {
    id: "sar-kaslo",
    name: "Kaslo Search and Rescue",
    short_name: "Kaslo SAR",
    municipality: "Kaslo",
    region: "Central Kootenay",
    latitude: 49.9133,
    longitude: -116.9136,
    coverage_area: "Kaslo, Kootenay Lake north, Lardeau, Ainsworth",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "North Kootenay Lake coverage"
  },
  {
    id: "sar-kimberley",
    name: "Kimberley Search and Rescue",
    short_name: "Kimberley SAR",
    municipality: "Kimberley",
    region: "East Kootenay",
    latitude: 49.6697,
    longitude: -116.0261,
    coverage_area: "Kimberley, Marysville, Wasa, St Mary River area",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Kimberley Alpine Resort coverage"
  },
  {
    id: "sar-nelson",
    name: "Nelson Search and Rescue",
    short_name: "Nelson SAR",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4928,
    longitude: -117.2881,
    website: "https://nelsonsar.com",
    coverage_area: "Nelson, Balfour, Whitewater, Slocan Valley south",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'swiftwater_rescue', 'first_aid'],
    notes: "West Arm Kootenay Lake coverage"
  },
  {
    id: "sar-revelstoke",
    name: "Revelstoke Search and Rescue",
    short_name: "Revelstoke SAR",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    latitude: 50.9989,
    longitude: -118.1956,
    website: "https://revelstokesar.com",
    coverage_area: "Revelstoke, Mt Revelstoke NP, Rogers Pass, Glacier NP interface",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'helicopter_operations', 'first_aid'],
    notes: "World-class avalanche terrain - parks interface"
  },
  {
    id: "sar-rossland",
    name: "Rossland Search and Rescue",
    short_name: "Rossland SAR",
    municipality: "Rossland",
    region: "Kootenay Boundary",
    latitude: 49.0783,
    longitude: -117.8022,
    coverage_area: "Rossland, Red Mountain, Trail west areas",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Red Mountain Resort coverage"
  },
  {
    id: "sar-shuswap",
    name: "Shuswap Search and Rescue",
    short_name: "Shuswap SAR",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    latitude: 50.7014,
    longitude: -119.2806,
    coverage_area: "Salmon Arm, Sicamous, Mara, Enderby area, Shuswap Lake",
    capabilities: ['ground_search', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "Shuswap Lake and surrounding areas"
  },
  {
    id: "sar-south-columbia",
    name: "South Columbia Search and Rescue",
    short_name: "South Columbia SAR",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0958,
    longitude: -117.7006,
    coverage_area: "Trail, Warfield, Fruitvale, Montrose",
    capabilities: ['ground_search', 'rope_rescue', 'first_aid', 'tracking'],
    notes: "Greater Trail area coverage"
  },
  {
    id: "sar-sparwood",
    name: "Sparwood Search and Rescue",
    short_name: "Sparwood SAR",
    municipality: "Sparwood",
    region: "East Kootenay",
    latitude: 49.7333,
    longitude: -114.8833,
    coverage_area: "Sparwood, Crowsnest Pass BC side, Corbin",
    capabilities: ['ground_search', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Elk Valley central coverage"
  },

  // ==========================================
  // CARIBOO-CHILCOTIN
  // ==========================================
  {
    id: "sar-central-cariboo",
    name: "Central Cariboo Search and Rescue",
    short_name: "Central Cariboo SAR",
    municipality: "Williams Lake",
    region: "Cariboo",
    latitude: 52.1286,
    longitude: -122.1411,
    coverage_area: "Williams Lake, 150 Mile House, Horsefly, Likely",
    capabilities: ['ground_search', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "CRD central area coverage"
  },
  {
    id: "sar-quesnel",
    name: "Quesnel Search and Rescue",
    short_name: "Quesnel SAR",
    municipality: "Quesnel",
    region: "Cariboo",
    latitude: 52.9839,
    longitude: -122.4931,
    coverage_area: "Quesnel, Wells, Barkerville, Bowron Lakes area",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Bowron Lakes Park primary response"
  },
  {
    id: "sar-south-cariboo",
    name: "South Cariboo Search and Rescue",
    short_name: "South Cariboo SAR",
    municipality: "100 Mile House",
    region: "Cariboo",
    latitude: 51.6392,
    longitude: -121.2950,
    coverage_area: "100 Mile House, 108 Mile, Lac La Hache, Forest Grove",
    capabilities: ['ground_search', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "South Cariboo lake district"
  },
  {
    id: "sar-west-chilcotin",
    name: "West Chilcotin Search and Rescue",
    short_name: "West Chilcotin SAR",
    municipality: "Anahim Lake",
    region: "Cariboo",
    latitude: 52.4667,
    longitude: -125.3000,
    coverage_area: "Anahim Lake, Nimpo Lake, Bella Coola east, Tweedsmuir Park",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Remote Chilcotin Plateau coverage"
  },

  // ==========================================
  // CENTRAL/NORTH COAST
  // ==========================================
  {
    id: "sar-bella-coola",
    name: "Bella Coola Search and Rescue",
    short_name: "Bella Coola SAR",
    municipality: "Bella Coola",
    region: "Central Coast",
    latitude: 52.3686,
    longitude: -126.7544,
    coverage_area: "Bella Coola Valley, Hagensborg, Stuie, Highway 20 west",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'first_aid'],
    notes: "Remote Central Coast coverage"
  },

  // ==========================================
  // NORTHERN BC - PRINCE GEORGE REGION
  // ==========================================
  {
    id: "sar-prince-george",
    name: "Prince George Search and Rescue",
    short_name: "Prince George SAR",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.8947,
    longitude: -122.8072,
    website: "https://pgsar.com",
    coverage_area: "Prince George, Tabor Mountain, Purden Lake, McBride south",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'avalanche_rescue', 'first_aid', 'tracking', 'search_dogs'],
    notes: "Northern BC hub - large coverage area"
  },
  {
    id: "sar-robson-valley",
    name: "Robson Valley Search and Rescue",
    short_name: "Robson Valley SAR",
    municipality: "McBride",
    region: "Fraser-Fort George",
    latitude: 53.3000,
    longitude: -120.1667,
    coverage_area: "McBride, Valemount, Mt Robson Park, Yellowhead Pass BC side",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Mt Robson Provincial Park coverage"
  },
  {
    id: "sar-mackenzie",
    name: "Mackenzie Search and Rescue",
    short_name: "Mackenzie SAR",
    municipality: "Mackenzie",
    region: "Fraser-Fort George",
    latitude: 55.3378,
    longitude: -123.0942,
    coverage_area: "Mackenzie, Williston Lake, Pine Pass south",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Williston Lake area"
  },

  // ==========================================
  // NORTHERN BC - BULKLEY-NECHAKO
  // ==========================================
  {
    id: "sar-bulkley-valley",
    name: "Bulkley Valley Search and Rescue",
    short_name: "Bulkley Valley SAR",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    latitude: 54.7806,
    longitude: -127.1667,
    coverage_area: "Smithers, Telkwa, Houston east, Hudson Bay Mountain, Babine Mountains",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Bulkley Valley and alpine areas"
  },
  {
    id: "sar-burns-lake",
    name: "Burns Lake Search and Rescue",
    short_name: "Burns Lake SAR",
    municipality: "Burns Lake",
    region: "Bulkley-Nechako",
    latitude: 54.2306,
    longitude: -125.7597,
    coverage_area: "Burns Lake, Francois Lake, Ootsa Lake, Tweedsmuir Park north",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Lakes District coverage"
  },
  {
    id: "sar-fort-st-james",
    name: "Fort St. James Search and Rescue",
    short_name: "Fort St. James SAR",
    municipality: "Fort St. James",
    region: "Bulkley-Nechako",
    latitude: 54.4500,
    longitude: -124.2500,
    coverage_area: "Fort St. James, Stuart Lake, Tachie, Mt Pope area",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Stuart Lake and Nechako region"
  },
  {
    id: "sar-houston",
    name: "Houston Search and Rescue",
    short_name: "Houston SAR",
    municipality: "Houston",
    region: "Bulkley-Nechako",
    latitude: 54.4000,
    longitude: -126.6500,
    coverage_area: "Houston, Topley, Granisle, Morice Lake area",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Houston and Buck Flats area"
  },
  {
    id: "sar-nechako-valley",
    name: "Nechako Valley Search and Rescue",
    short_name: "Nechako Valley SAR",
    municipality: "Vanderhoof",
    region: "Bulkley-Nechako",
    latitude: 54.0167,
    longitude: -124.0000,
    coverage_area: "Vanderhoof, Fraser Lake, Endako, Kenney Dam area",
    capabilities: ['ground_search', 'swiftwater_rescue', 'inland_water', 'first_aid', 'tracking'],
    notes: "Nechako River corridor"
  },

  // ==========================================
  // NORTHERN BC - NORTHWEST
  // ==========================================
  {
    id: "sar-kitimat",
    name: "Kitimat Search and Rescue",
    short_name: "Kitimat SAR",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 54.0519,
    longitude: -128.6542,
    coverage_area: "Kitimat, Douglas Channel, Kitimat River",
    capabilities: ['ground_search', 'swiftwater_rescue', 'inland_water', 'first_aid'],
    notes: "Kitimat Valley coverage"
  },
  {
    id: "sar-terrace",
    name: "Terrace Search and Rescue",
    short_name: "Terrace SAR",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    latitude: 54.5172,
    longitude: -128.5931,
    coverage_area: "Terrace, Thornhill, Lakelse Lake, Shames Mountain",
    capabilities: ['ground_search', 'rope_rescue', 'swiftwater_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Skeena River Valley"
  },
  {
    id: "sar-prince-rupert",
    name: "Prince Rupert Search and Rescue",
    short_name: "Prince Rupert SAR",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3108,
    longitude: -130.3250,
    coverage_area: "Prince Rupert, Port Edward, Digby Island, Kaien Island",
    capabilities: ['ground_search', 'first_aid', 'tracking'],
    notes: "North Coast coverage - coordinates with Coast Guard"
  },
  {
    id: "sar-stewart",
    name: "Stewart Search and Rescue",
    short_name: "Stewart SAR",
    municipality: "Stewart",
    region: "Kitimat-Stikine",
    latitude: 55.9361,
    longitude: -130.0053,
    coverage_area: "Stewart, Hyder interface, Bear Glacier, Salmon Glacier",
    capabilities: ['ground_search', 'rope_rescue', 'mountain_rescue', 'avalanche_rescue', 'first_aid'],
    notes: "Remote border community - glacier access"
  },

  // ==========================================
  // NORTHERN BC - PEACE REGION
  // ==========================================
  {
    id: "sar-chetwynd",
    name: "Chetwynd Search and Rescue",
    short_name: "Chetwynd SAR",
    municipality: "Chetwynd",
    region: "Peace River",
    latitude: 55.6997,
    longitude: -121.6333,
    coverage_area: "Chetwynd, Tumbler Ridge east, Pine Pass, Moberly Lake",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Peace River south coverage"
  },
  {
    id: "sar-fort-nelson",
    name: "Fort Nelson Search and Rescue",
    short_name: "Fort Nelson SAR",
    municipality: "Fort Nelson",
    region: "Northern Rockies",
    latitude: 58.8050,
    longitude: -122.6972,
    coverage_area: "Fort Nelson, Liard River, Alaska Highway north, Fort Liard BC side",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Largest SAR coverage area in BC - remote wilderness"
  },
  {
    id: "sar-north-peace",
    name: "North Peace Search and Rescue",
    short_name: "North Peace SAR",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.2436,
    longitude: -120.8458,
    coverage_area: "Fort St. John, Taylor, Charlie Lake, Alaska Highway corridor",
    capabilities: ['ground_search', 'swiftwater_rescue', 'first_aid', 'tracking'],
    notes: "Peace River north bank coverage"
  },
  {
    id: "sar-south-peace",
    name: "South Peace Search and Rescue",
    short_name: "South Peace SAR",
    municipality: "Dawson Creek",
    region: "Peace River",
    latitude: 55.7596,
    longitude: -120.2377,
    coverage_area: "Dawson Creek, Pouce Coupe, Rolla, Mile 0 Alaska Highway",
    capabilities: ['ground_search', 'first_aid', 'tracking'],
    notes: "Peace River south bank coverage"
  },
  {
    id: "sar-tumbler-ridge",
    name: "Tumbler Ridge Search and Rescue",
    short_name: "Tumbler Ridge SAR",
    municipality: "Tumbler Ridge",
    region: "Peace River",
    latitude: 55.1294,
    longitude: -121.0011,
    coverage_area: "Tumbler Ridge, Kinuseo Falls, Monkman Park, Murray River",
    capabilities: ['ground_search', 'rope_rescue', 'first_aid', 'tracking'],
    notes: "Tumbler Ridge Global Geopark coverage"
  },

  // ==========================================
  // FAR NORTH - STIKINE
  // ==========================================
  {
    id: "sar-atlin",
    name: "Atlin Search and Rescue",
    short_name: "Atlin SAR",
    municipality: "Atlin",
    region: "Stikine",
    latitude: 59.5706,
    longitude: -133.6925,
    coverage_area: "Atlin, Atlin Lake, Llewellyn Glacier, BC-Yukon border area",
    capabilities: ['ground_search', 'inland_water', 'first_aid', 'tracking'],
    notes: "Most northerly SAR group in BC - remote wilderness"
  }
];

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function getSARGroupsByRegion(regionName: string): SARGroup[] {
  const searchRegion = regionName.toLowerCase();
  return BC_SAR_GROUPS.filter(g => 
    g.region.toLowerCase() === searchRegion ||
    g.region.toLowerCase().includes(searchRegion) ||
    searchRegion.includes(g.region.toLowerCase())
  );
}

export function getSARGroupsByMunicipality(municipalityName: string): SARGroup[] {
  const searchMuni = municipalityName.toLowerCase();
  return BC_SAR_GROUPS.filter(g => 
    g.municipality.toLowerCase() === searchMuni ||
    g.municipality.toLowerCase().includes(searchMuni) ||
    g.coverage_area.toLowerCase().includes(searchMuni)
  );
}

export function getNearestSARGroups(
  lat: number, 
  lon: number, 
  count: number = 3
): { group: SARGroup; distance_km: number }[] {
  const withDistances = BC_SAR_GROUPS.map(group => ({
    group,
    distance_km: calculateDistance(lat, lon, group.latitude, group.longitude)
  }));
  
  withDistances.sort((a, b) => a.distance_km - b.distance_km);
  
  return withDistances.slice(0, count);
}

export function getSARGroupsByCapability(capability: SARCapability): SARGroup[] {
  return BC_SAR_GROUPS.filter(g => g.capabilities.includes(capability));
}

export function getAvalancheRescueGroups(): SARGroup[] {
  return getSARGroupsByCapability('avalanche_rescue');
}

export function getSwiftwaterRescueGroups(): SARGroup[] {
  return getSARGroupsByCapability('swiftwater_rescue');
}

export function getMountainRescueGroups(): SARGroup[] {
  return getSARGroupsByCapability('mountain_rescue');
}
