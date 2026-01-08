export type EmergencyServiceType = 
  | 'hospital'
  | 'fire_station'
  | 'municipal_police'
  | 'rcmp_detachment'
  | 'ambulance_station';

export type HealthAuthority = 
  | 'Vancouver Coastal Health'
  | 'Fraser Health'
  | 'Island Health'
  | 'Interior Health'
  | 'Northern Health'
  | 'Provincial Health Services';

export interface EmergencyService {
  id: string;
  name: string;
  type: EmergencyServiceType;
  municipality: string;
  region: string;
  latitude: number;
  longitude: number;
  phone?: string;
  address?: string;
  health_authority?: HealthAuthority;
  has_helipad?: boolean;
  helipad_icao?: string;
  is_trauma_centre?: boolean;
  is_tertiary?: boolean;
  emergency_department?: boolean;
  notes?: string;
}

export const BC_EMERGENCY_SERVICES: EmergencyService[] = [
  // ==========================================
  // HOSPITALS - VANCOUVER COASTAL HEALTH
  // ==========================================
  {
    id: "hospital-vgh",
    name: "Vancouver General Hospital",
    type: "hospital",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2620,
    longitude: -123.1245,
    phone: "(604) 875-4111",
    address: "899 W 12th Ave, Vancouver",
    health_authority: "Vancouver Coastal Health",
    has_helipad: true,
    helipad_icao: "CBK4",
    is_trauma_centre: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Level 1 Trauma Centre - rooftop helipad"
  },
  {
    id: "hospital-bc-childrens",
    name: "BC Children's Hospital",
    type: "hospital",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2438,
    longitude: -123.1272,
    phone: "(604) 875-2345",
    address: "4480 Oak St, Vancouver",
    health_authority: "Provincial Health Services",
    has_helipad: true,
    helipad_icao: "CAK7",
    is_tertiary: true,
    emergency_department: true,
    notes: "Provincial pediatric tertiary care"
  },
  {
    id: "hospital-bc-womens",
    name: "BC Women's Hospital",
    type: "hospital",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2440,
    longitude: -123.1270,
    phone: "(604) 875-2424",
    address: "4500 Oak St, Vancouver",
    health_authority: "Provincial Health Services",
    has_helipad: true,
    helipad_icao: "CAK7",
    is_tertiary: true,
    emergency_department: true,
    notes: "Shares helipad with BC Children's"
  },
  {
    id: "hospital-st-pauls",
    name: "St. Paul's Hospital",
    type: "hospital",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2803,
    longitude: -123.1283,
    phone: "(604) 682-2344",
    address: "1081 Burrard St, Vancouver",
    health_authority: "Vancouver Coastal Health",
    has_helipad: false,
    is_tertiary: true,
    emergency_department: true,
    notes: "Heart, lung, and HIV/AIDS specialty"
  },
  {
    id: "hospital-mount-saint-joseph",
    name: "Mount Saint Joseph Hospital",
    type: "hospital",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2478,
    longitude: -123.0522,
    phone: "(604) 874-1141",
    address: "3080 Prince Edward St, Vancouver",
    health_authority: "Vancouver Coastal Health",
    emergency_department: true
  },
  {
    id: "hospital-lions-gate",
    name: "Lions Gate Hospital",
    type: "hospital",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3193,
    longitude: -123.0695,
    phone: "(604) 988-3131",
    address: "231 E 15th St, North Vancouver",
    health_authority: "Vancouver Coastal Health",
    has_helipad: true,
    emergency_department: true,
    notes: "North Shore regional hospital"
  },
  {
    id: "hospital-richmond",
    name: "Richmond Hospital",
    type: "hospital",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1708,
    longitude: -123.1358,
    phone: "(604) 278-9711",
    address: "7000 Westminster Hwy, Richmond",
    health_authority: "Vancouver Coastal Health",
    emergency_department: true
  },
  {
    id: "hospital-ubc",
    name: "UBC Hospital",
    type: "hospital",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2642,
    longitude: -123.2458,
    phone: "(604) 822-7121",
    address: "2211 Wesbrook Mall, Vancouver",
    health_authority: "Vancouver Coastal Health",
    emergency_department: false,
    notes: "Specialty and rehabilitation cc_services"
  },
  {
    id: "hospital-squamish",
    name: "Squamish General Hospital",
    type: "hospital",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.7016,
    longitude: -123.1558,
    phone: "(604) 892-5211",
    address: "38140 Behrner Dr, Squamish",
    health_authority: "Vancouver Coastal Health",
    emergency_department: true
  },
  {
    id: "hospital-whistler",
    name: "Whistler Health Care Centre",
    type: "hospital",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    latitude: 50.1163,
    longitude: -122.9574,
    phone: "(604) 932-4911",
    address: "4380 Lorimer Rd, Whistler",
    health_authority: "Vancouver Coastal Health",
    emergency_department: true
  },
  {
    id: "hospital-powell-river",
    name: "Powell River General Hospital",
    type: "hospital",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8354,
    longitude: -124.5245,
    phone: "(604) 485-3211",
    address: "5000 Joyce Ave, Powell River",
    health_authority: "Vancouver Coastal Health",
    emergency_department: true
  },
  {
    id: "hospital-sechelt",
    name: "Sechelt Hospital",
    type: "hospital",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    latitude: 49.4726,
    longitude: -123.7545,
    phone: "(604) 885-2224",
    address: "5544 Sunshine Coast Hwy, Sechelt",
    health_authority: "Vancouver Coastal Health",
    emergency_department: true,
    notes: "Sunshine Coast regional hospital"
  },

  // ==========================================
  // HOSPITALS - FRASER HEALTH
  // ==========================================
  {
    id: "hospital-surrey-memorial",
    name: "Surrey Memorial Hospital",
    type: "hospital",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1758,
    longitude: -122.8438,
    phone: "(604) 581-2211",
    address: "13750 96 Ave, Surrey",
    health_authority: "Fraser Health",
    has_helipad: true,
    helipad_icao: "CVS3",
    is_trauma_centre: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Level 1 Trauma Centre - rooftop helipad"
  },
  {
    id: "hospital-royal-columbian",
    name: "Royal Columbian Hospital",
    type: "hospital",
    municipality: "New Westminster",
    region: "Metro Vancouver",
    latitude: 49.2266,
    longitude: -122.8916,
    phone: "(604) 520-4253",
    address: "330 E Columbia St, New Westminster",
    health_authority: "Fraser Health",
    has_helipad: true,
    is_trauma_centre: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Level 1 Trauma Centre - cardiac surgery"
  },
  {
    id: "hospital-burnaby",
    name: "Burnaby Hospital",
    type: "hospital",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2506,
    longitude: -122.9833,
    phone: "(604) 434-4211",
    address: "3935 Kincaid St, Burnaby",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-eagle-ridge",
    name: "Eagle Ridge Hospital",
    type: "hospital",
    municipality: "Port Moody",
    region: "Metro Vancouver",
    latitude: 49.2828,
    longitude: -122.8305,
    phone: "(604) 461-2022",
    address: "475 Guildford Way, Port Moody",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-ridge-meadows",
    name: "Ridge Meadows Hospital",
    type: "hospital",
    municipality: "Maple Ridge",
    region: "Metro Vancouver",
    latitude: 49.2189,
    longitude: -122.5981,
    phone: "(604) 463-4111",
    address: "11666 Laity St, Maple Ridge",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-langley-memorial",
    name: "Langley Memorial Hospital",
    type: "hospital",
    municipality: "Langley",
    region: "Metro Vancouver",
    latitude: 49.1042,
    longitude: -122.6564,
    phone: "(604) 534-4121",
    address: "22051 Fraser Hwy, Langley",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-peace-arch",
    name: "Peace Arch Hospital",
    type: "hospital",
    municipality: "White Rock",
    region: "Metro Vancouver",
    latitude: 49.0254,
    longitude: -122.8028,
    phone: "(604) 531-5512",
    address: "15521 Russell Ave, White Rock",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-delta",
    name: "Delta Hospital",
    type: "hospital",
    municipality: "Delta",
    region: "Metro Vancouver",
    latitude: 49.0845,
    longitude: -123.0582,
    phone: "(604) 946-1121",
    address: "5800 Mountain View Blvd, Delta",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-abbotsford",
    name: "Abbotsford Regional Hospital",
    type: "hospital",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    latitude: 49.0389,
    longitude: -122.2847,
    phone: "(604) 851-4700",
    address: "32900 Marshall Rd, Abbotsford",
    health_authority: "Fraser Health",
    has_helipad: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Regional hospital with cancer centre"
  },
  {
    id: "hospital-chilliwack",
    name: "Chilliwack General Hospital",
    type: "hospital",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    latitude: 49.1655,
    longitude: -121.9506,
    phone: "(604) 795-4141",
    address: "45600 Menholm Rd, Chilliwack",
    health_authority: "Fraser Health",
    emergency_department: true
  },
  {
    id: "hospital-mission",
    name: "Mission Memorial Hospital",
    type: "hospital",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1336,
    longitude: -122.3095,
    phone: "(604) 826-6281",
    address: "7324 Hurd St, Mission",
    health_authority: "Fraser Health",
    emergency_department: true
  },

  // ==========================================
  // HOSPITALS - ISLAND HEALTH
  // ==========================================
  {
    id: "hospital-royal-jubilee",
    name: "Royal Jubilee Hospital",
    type: "hospital",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4337,
    longitude: -123.3267,
    phone: "(250) 370-8000",
    address: "1952 Bay St, Victoria",
    health_authority: "Island Health",
    has_helipad: true,
    is_trauma_centre: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Vancouver Island Trauma Centre"
  },
  {
    id: "hospital-victoria-general",
    name: "Victoria General Hospital",
    type: "hospital",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4638,
    longitude: -123.4278,
    phone: "(250) 727-4212",
    address: "1 Hospital Way, Victoria",
    health_authority: "Island Health",
    has_helipad: true,
    emergency_department: true,
    notes: "Surgical specialty centre"
  },
  {
    id: "hospital-saanich-peninsula",
    name: "Saanich Peninsula Hospital",
    type: "hospital",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6008,
    longitude: -123.4178,
    phone: "(250) 652-3911",
    address: "2166 Mt Newton X Rd, Saanichton",
    health_authority: "Island Health",
    emergency_department: true
  },
  {
    id: "hospital-cowichan-district",
    name: "Cowichan District Hospital",
    type: "hospital",
    municipality: "Duncan",
    region: "Cowichan Valley",
    latitude: 48.7858,
    longitude: -123.7195,
    phone: "(250) 737-2030",
    address: "3045 Gibbins Rd, Duncan",
    health_authority: "Island Health",
    emergency_department: true
  },
  {
    id: "hospital-lady-minto",
    name: "Lady Minto Hospital",
    type: "hospital",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8567,
    longitude: -123.5083,
    phone: "(250) 538-4800",
    address: "135 Crofton Rd, Salt Spring Island",
    health_authority: "Island Health",
    emergency_department: true,
    notes: "Gulf Islands hospital"
  },
  {
    id: "hospital-nanaimo-regional",
    name: "Nanaimo Regional General Hospital",
    type: "hospital",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1796,
    longitude: -123.9667,
    phone: "(250) 755-7691",
    address: "1200 Dufferin Cres, Nanaimo",
    health_authority: "Island Health",
    has_helipad: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Central Island regional hospital"
  },
  {
    id: "hospital-campbell-river",
    name: "North Island Hospital - Campbell River",
    type: "hospital",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0093,
    longitude: -125.2270,
    phone: "(250) 850-2141",
    address: "375 2nd Ave, Campbell River",
    health_authority: "Island Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-comox-valley",
    name: "North Island Hospital - Comox Valley",
    type: "hospital",
    municipality: "Courtenay",
    region: "Comox Valley",
    latitude: 49.6756,
    longitude: -124.9937,
    phone: "(250) 331-5100",
    address: "101 Lerwick Rd, Courtenay",
    health_authority: "Island Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-port-alberni",
    name: "West Coast General Hospital",
    type: "hospital",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2364,
    longitude: -124.7978,
    phone: "(250) 731-1315",
    address: "3949 Port Alberni Hwy, Port Alberni",
    health_authority: "Island Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-tofino",
    name: "Tofino General Hospital",
    type: "hospital",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1527,
    longitude: -125.9038,
    phone: "(250) 725-3212",
    address: "261 Neill St, Tofino",
    health_authority: "Island Health",
    has_helipad: true,
    emergency_department: true,
    notes: "Helipad opened June 2016"
  },
  {
    id: "hospital-port-hardy",
    name: "Port Hardy Hospital",
    type: "hospital",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    latitude: 50.7175,
    longitude: -127.4936,
    phone: "(250) 902-6011",
    address: "9120 Granville St, Port Hardy",
    health_authority: "Island Health",
    emergency_department: true
  },

  // ==========================================
  // HOSPITALS - INTERIOR HEALTH
  // ==========================================
  {
    id: "hospital-royal-inland",
    name: "Royal Inland Hospital",
    type: "hospital",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6756,
    longitude: -120.3352,
    phone: "(250) 374-5111",
    address: "311 Columbia St, Kamloops",
    health_authority: "Interior Health",
    has_helipad: true,
    is_trauma_centre: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Interior BC Trauma Centre - 254 beds"
  },
  {
    id: "hospital-kelowna-general",
    name: "Kelowna General Hospital",
    type: "hospital",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8833,
    longitude: -119.4833,
    phone: "(250) 862-4000",
    address: "2268 Pandosy St, Kelowna",
    health_authority: "Interior Health",
    has_helipad: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Okanagan tertiary centre"
  },
  {
    id: "hospital-penticton",
    name: "Penticton Regional Hospital",
    type: "hospital",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    latitude: 49.4817,
    longitude: -119.5762,
    phone: "(250) 492-4000",
    address: "550 Carmi Ave, Penticton",
    health_authority: "Interior Health",
    has_helipad: true,
    helipad_icao: "CPH6",
    emergency_department: true
  },
  {
    id: "hospital-vernon-jubilee",
    name: "Vernon Jubilee Hospital",
    type: "hospital",
    municipality: "Vernon",
    region: "North Okanagan",
    latitude: 50.2750,
    longitude: -119.2719,
    phone: "(250) 545-2211",
    address: "2101 32nd St, Vernon",
    health_authority: "Interior Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-east-kootenay",
    name: "East Kootenay Regional Hospital",
    type: "hospital",
    municipality: "Cranbrook",
    region: "East Kootenay",
    latitude: 49.5097,
    longitude: -115.7631,
    phone: "(250) 426-5281",
    address: "13 24th Ave N, Cranbrook",
    health_authority: "Interior Health",
    has_helipad: true,
    emergency_department: true,
    notes: "East Kootenay regional centre"
  },
  {
    id: "hospital-kootenay-boundary",
    name: "Kootenay Boundary Regional Hospital",
    type: "hospital",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0958,
    longitude: -117.7006,
    phone: "(250) 368-3311",
    address: "1200 Hospital Bench, Trail",
    health_authority: "Interior Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-kootenay-lake",
    name: "Kootenay Lake Hospital",
    type: "hospital",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4928,
    longitude: -117.2881,
    phone: "(250) 352-3111",
    address: "3 View St, Nelson",
    health_authority: "Interior Health",
    emergency_department: true
  },
  {
    id: "hospital-golden",
    name: "Golden and District Hospital",
    type: "hospital",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    latitude: 51.2972,
    longitude: -116.9631,
    phone: "(250) 344-5271",
    address: "835 9th Ave S, Golden",
    health_authority: "Interior Health",
    emergency_department: true
  },
  {
    id: "hospital-revelstoke",
    name: "Queen Victoria Hospital",
    type: "hospital",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    latitude: 50.9989,
    longitude: -118.1956,
    phone: "(250) 837-2131",
    address: "1200 Newlands Rd, Revelstoke",
    health_authority: "Interior Health",
    emergency_department: true
  },
  {
    id: "hospital-salmon-arm",
    name: "Shuswap Lake General Hospital",
    type: "hospital",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    latitude: 50.7014,
    longitude: -119.2806,
    phone: "(250) 833-3600",
    address: "601 10th St NE, Salmon Arm",
    health_authority: "Interior Health",
    emergency_department: true
  },

  // ==========================================
  // HOSPITALS - NORTHERN HEALTH
  // ==========================================
  {
    id: "hospital-uhnbc",
    name: "University Hospital of Northern BC",
    type: "hospital",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.8947,
    longitude: -122.8072,
    phone: "(250) 565-2000",
    address: "1475 Edmonton St, Prince George",
    health_authority: "Northern Health",
    has_helipad: true,
    is_trauma_centre: true,
    is_tertiary: true,
    emergency_department: true,
    notes: "Northern BC tertiary and trauma centre"
  },
  {
    id: "hospital-fort-st-john",
    name: "Fort St. John Hospital",
    type: "hospital",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.2436,
    longitude: -120.8458,
    phone: "(250) 262-5200",
    address: "8407 112 Ave, Fort St. John",
    health_authority: "Northern Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-dawson-creek",
    name: "Dawson Creek and District Hospital",
    type: "hospital",
    municipality: "Dawson Creek",
    region: "Peace River",
    latitude: 55.7597,
    longitude: -120.2378,
    phone: "(250) 782-8501",
    address: "11100 13th St, Dawson Creek",
    health_authority: "Northern Health",
    emergency_department: true
  },
  {
    id: "hospital-terrace",
    name: "Mills Memorial Hospital",
    type: "hospital",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    latitude: 54.5172,
    longitude: -128.5931,
    phone: "(250) 635-2211",
    address: "4720 Haugland Ave, Terrace",
    health_authority: "Northern Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-prince-rupert",
    name: "Prince Rupert Regional Hospital",
    type: "hospital",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3108,
    longitude: -130.3250,
    phone: "(250) 624-2171",
    address: "1305 Summit Ave, Prince Rupert",
    health_authority: "Northern Health",
    has_helipad: true,
    emergency_department: true
  },
  {
    id: "hospital-kitimat",
    name: "Kitimat General Hospital",
    type: "hospital",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 54.0519,
    longitude: -128.6542,
    phone: "(250) 632-2121",
    address: "920 Lahakas Blvd, Kitimat",
    health_authority: "Northern Health",
    emergency_department: true
  },
  {
    id: "hospital-quesnel",
    name: "G.R. Baker Memorial Hospital",
    type: "hospital",
    municipality: "Quesnel",
    region: "Cariboo",
    latitude: 52.9839,
    longitude: -122.4931,
    phone: "(250) 985-5600",
    address: "543 Front St, Quesnel",
    health_authority: "Northern Health",
    emergency_department: true
  },
  {
    id: "hospital-williams-lake",
    name: "Cariboo Memorial Hospital",
    type: "hospital",
    municipality: "Williams Lake",
    region: "Cariboo",
    latitude: 52.1286,
    longitude: -122.1411,
    phone: "(250) 392-4411",
    address: "517 6th Ave N, Williams Lake",
    health_authority: "Northern Health",
    emergency_department: true
  },
  {
    id: "hospital-burns-lake",
    name: "Lakes District Hospital",
    type: "hospital",
    municipality: "Burns Lake",
    region: "Bulkley-Nechako",
    latitude: 54.2306,
    longitude: -125.7597,
    phone: "(250) 692-2400",
    address: "741 Centre St, Burns Lake",
    health_authority: "Northern Health",
    emergency_department: true
  },
  {
    id: "hospital-smithers",
    name: "Bulkley Valley District Hospital",
    type: "hospital",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    latitude: 54.7806,
    longitude: -127.1667,
    phone: "(250) 847-2611",
    address: "3950 8th Ave, Smithers",
    health_authority: "Northern Health",
    emergency_department: true
  },

  // ==========================================
  // MUNICIPAL POLICE DEPARTMENTS
  // ==========================================
  {
    id: "police-vpd-hq",
    name: "Vancouver Police Department - Headquarters",
    type: "municipal_police",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2634,
    longitude: -123.1016,
    phone: "(604) 717-3321",
    address: "2120 Cambie St, Vancouver",
    notes: "VPD Headquarters - non-emergency"
  },
  {
    id: "police-vpd-district1",
    name: "Vancouver Police - District 1",
    type: "municipal_police",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2827,
    longitude: -123.1207,
    address: "312 Main St, Vancouver",
    notes: "Downtown/Gastown"
  },
  {
    id: "police-vpd-district2",
    name: "Vancouver Police - District 2",
    type: "municipal_police",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2634,
    longitude: -123.1016,
    address: "2120 Cambie St, Vancouver",
    notes: "Fairview/Mount Pleasant"
  },
  {
    id: "police-vpd-district3",
    name: "Vancouver Police - District 3",
    type: "municipal_police",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2389,
    longitude: -123.0308,
    address: "3585 Graveley St, Vancouver",
    notes: "Grandview-Woodland/Hastings-Sunrise"
  },
  {
    id: "police-vpd-district4",
    name: "Vancouver Police - District 4",
    type: "municipal_police",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2267,
    longitude: -123.0056,
    address: "2025 E 54th Ave, Vancouver",
    notes: "South Vancouver/Killarney"
  },
  {
    id: "police-victoria-hq",
    name: "Victoria Police Department - Headquarters",
    type: "municipal_police",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4284,
    longitude: -123.3656,
    phone: "(250) 995-7654",
    address: "850 Caledonia Ave, Victoria",
    notes: "VicPD Headquarters"
  },
  {
    id: "police-abbotsford",
    name: "Abbotsford Police Department",
    type: "municipal_police",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    latitude: 49.0504,
    longitude: -122.3045,
    phone: "(604) 859-5225",
    address: "2838 Justice Way, Abbotsford",
    notes: "APD Headquarters"
  },
  {
    id: "police-delta",
    name: "Delta Police Department",
    type: "municipal_police",
    municipality: "Delta",
    region: "Metro Vancouver",
    latitude: 49.0845,
    longitude: -123.0582,
    phone: "(604) 946-4411",
    address: "4455 Clarence Taylor Cres, Delta",
    notes: "DPD Headquarters"
  },
  {
    id: "police-new-westminster",
    name: "New Westminster Police Department",
    type: "municipal_police",
    municipality: "New Westminster",
    region: "Metro Vancouver",
    latitude: 49.2057,
    longitude: -122.9110,
    phone: "(604) 525-5411",
    address: "555 Columbia St, New Westminster",
    notes: "NWPD Headquarters"
  },
  {
    id: "police-port-moody",
    name: "Port Moody Police Department",
    type: "municipal_police",
    municipality: "Port Moody",
    region: "Metro Vancouver",
    latitude: 49.2850,
    longitude: -122.8311,
    phone: "(604) 461-3456",
    address: "3051 St Johns St, Port Moody",
    notes: "PMPD Headquarters"
  },
  {
    id: "police-west-vancouver",
    name: "West Vancouver Police Department",
    type: "municipal_police",
    municipality: "West Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3278,
    longitude: -123.1667,
    phone: "(604) 925-7300",
    address: "1330 Marine Dr, West Vancouver",
    notes: "WVPD Headquarters"
  },
  {
    id: "police-saanich",
    name: "Saanich Police Department",
    type: "municipal_police",
    municipality: "Saanich",
    region: "Capital",
    latitude: 48.4639,
    longitude: -123.3778,
    phone: "(250) 475-4321",
    address: "760 Vernon Ave, Victoria",
    notes: "Saanich PD Headquarters"
  },
  {
    id: "police-oak-bay",
    name: "Oak Bay Police Department",
    type: "municipal_police",
    municipality: "Oak Bay",
    region: "Capital",
    latitude: 48.4267,
    longitude: -123.3133,
    phone: "(250) 592-2424",
    address: "1703 Monterey Ave, Victoria",
    notes: "Oak Bay PD Headquarters"
  },
  {
    id: "police-central-saanich",
    name: "Central Saanich Police Service",
    type: "municipal_police",
    municipality: "Central Saanich",
    region: "Capital",
    latitude: 48.5350,
    longitude: -123.3833,
    phone: "(250) 652-4441",
    address: "1903 Mt Newton Cross Rd, Saanichton",
    notes: "CSPS Headquarters"
  },
  {
    id: "police-nelson",
    name: "Nelson Police Department",
    type: "municipal_police",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4928,
    longitude: -117.2881,
    phone: "(250) 354-3919",
    address: "606 Stanley St, Nelson",
    notes: "Nelson PD Headquarters"
  },
  {
    id: "police-transit",
    name: "Metro Vancouver Transit Police",
    type: "municipal_police",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2634,
    longitude: -123.0692,
    phone: "(604) 515-8300",
    address: "300-287 Nelson's Court, New Westminster",
    notes: "Transit Police HQ - regional jurisdiction"
  },

  // ==========================================
  // RCMP DETACHMENTS - METRO VANCOUVER
  // ==========================================
  {
    id: "rcmp-burnaby",
    name: "Burnaby RCMP",
    type: "rcmp_detachment",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2489,
    longitude: -122.9542,
    phone: "(604) 646-9999",
    address: "6355 Deer Lake Ave, Burnaby",
    notes: "E Division - Burnaby Detachment"
  },
  {
    id: "rcmp-coquitlam",
    name: "Coquitlam RCMP",
    type: "rcmp_detachment",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    latitude: 49.2897,
    longitude: -122.7919,
    phone: "(604) 945-1550",
    address: "2986 Guildford Way, Coquitlam",
    notes: "E Division"
  },
  {
    id: "rcmp-richmond",
    name: "Richmond RCMP",
    type: "rcmp_detachment",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1708,
    longitude: -123.1358,
    phone: "(604) 278-1212",
    address: "11411 No 5 Rd, Richmond",
    notes: "E Division"
  },
  {
    id: "rcmp-surrey",
    name: "Surrey RCMP",
    type: "rcmp_detachment",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1913,
    longitude: -122.8490,
    phone: "(604) 599-0502",
    address: "14355 57 Ave, Surrey",
    notes: "E Division - Main Detachment"
  },
  {
    id: "rcmp-langley",
    name: "Langley RCMP",
    type: "rcmp_detachment",
    municipality: "Langley",
    region: "Metro Vancouver",
    latitude: 49.1042,
    longitude: -122.6564,
    phone: "(604) 532-3200",
    address: "22180 48 Ave, Langley",
    notes: "E Division"
  },
  {
    id: "rcmp-maple-ridge",
    name: "Ridge Meadows RCMP",
    type: "rcmp_detachment",
    municipality: "Maple Ridge",
    region: "Metro Vancouver",
    latitude: 49.2189,
    longitude: -122.5981,
    phone: "(604) 463-6251",
    address: "11990 Haney Pl, Maple Ridge",
    notes: "E Division - serves Maple Ridge & Pitt Meadows"
  },
  {
    id: "rcmp-north-vancouver",
    name: "North Vancouver RCMP",
    type: "rcmp_detachment",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3193,
    longitude: -123.0695,
    phone: "(604) 985-1311",
    address: "147 E 14th St, North Vancouver",
    notes: "E Division"
  },

  // ==========================================
  // RCMP DETACHMENTS - VANCOUVER ISLAND
  // ==========================================
  {
    id: "rcmp-nanaimo",
    name: "Nanaimo RCMP",
    type: "rcmp_detachment",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1659,
    longitude: -123.9401,
    phone: "(250) 754-2345",
    address: "303 Prideaux St, Nanaimo",
    notes: "E Division - Island District"
  },
  {
    id: "rcmp-sidney",
    name: "Sidney/North Saanich RCMP",
    type: "rcmp_detachment",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6508,
    longitude: -123.4039,
    phone: "(250) 656-3931",
    address: "9895 4th St, Sidney",
    notes: "E Division"
  },
  {
    id: "rcmp-sooke",
    name: "Sooke RCMP",
    type: "rcmp_detachment",
    municipality: "Sooke",
    region: "Capital",
    latitude: 48.3739,
    longitude: -123.7261,
    phone: "(250) 642-5241",
    address: "2076 Church Rd, Sooke",
    notes: "E Division"
  },
  {
    id: "rcmp-west-shore",
    name: "West Shore RCMP",
    type: "rcmp_detachment",
    municipality: "Langford",
    region: "Capital",
    latitude: 48.4506,
    longitude: -123.5047,
    phone: "(250) 474-2264",
    address: "698 Atkins Ave, Victoria",
    notes: "E Division - serves Langford, Colwood, View Royal, Metchosin, Highlands"
  },
  {
    id: "rcmp-duncan",
    name: "North Cowichan/Duncan RCMP",
    type: "rcmp_detachment",
    municipality: "Duncan",
    region: "Cowichan Valley",
    latitude: 48.7858,
    longitude: -123.7195,
    phone: "(250) 748-5522",
    address: "6060 Canada Ave, Duncan",
    notes: "E Division"
  },
  {
    id: "rcmp-campbell-river",
    name: "Campbell River RCMP",
    type: "rcmp_detachment",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0247,
    longitude: -125.2437,
    phone: "(250) 286-6221",
    address: "286 S Dogwood St, Campbell River",
    notes: "E Division"
  },
  {
    id: "rcmp-port-alberni",
    name: "Port Alberni RCMP",
    type: "rcmp_detachment",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2419,
    longitude: -124.8028,
    phone: "(250) 723-2424",
    address: "4405 Stamp Ave, Port Alberni",
    notes: "E Division"
  },
  {
    id: "rcmp-tofino",
    name: "Tofino RCMP",
    type: "rcmp_detachment",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1530,
    longitude: -125.9066,
    phone: "(250) 725-3242",
    address: "400 Campbell St, Tofino",
    notes: "E Division"
  },
  {
    id: "rcmp-ucluelet",
    name: "Ucluelet RCMP",
    type: "rcmp_detachment",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    latitude: 48.9420,
    longitude: -125.5460,
    phone: "(250) 726-7773",
    address: "1690 Cedar Rd, Ucluelet",
    notes: "E Division"
  },
  {
    id: "rcmp-port-hardy",
    name: "Port Hardy RCMP",
    type: "rcmp_detachment",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    latitude: 50.7175,
    longitude: -127.4936,
    phone: "(250) 949-6335",
    address: "7355 Columbia St, Port Hardy",
    notes: "E Division"
  },
  {
    id: "rcmp-comox-valley",
    name: "Comox Valley RCMP",
    type: "rcmp_detachment",
    municipality: "Courtenay",
    region: "Comox Valley",
    latitude: 49.6856,
    longitude: -124.9937,
    phone: "(250) 338-1321",
    address: "800 Ryan Rd, Courtenay",
    notes: "E Division"
  },

  // ==========================================
  // RCMP DETACHMENTS - FRASER VALLEY
  // ==========================================
  {
    id: "rcmp-chilliwack",
    name: "Chilliwack RCMP",
    type: "rcmp_detachment",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    latitude: 49.1655,
    longitude: -121.9506,
    phone: "(604) 792-4611",
    address: "45924 Airport Rd, Chilliwack",
    notes: "E Division"
  },
  {
    id: "rcmp-mission",
    name: "Mission RCMP",
    type: "rcmp_detachment",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1336,
    longitude: -122.3095,
    phone: "(604) 826-7161",
    address: "7171 Oliver St, Mission",
    notes: "E Division"
  },
  {
    id: "rcmp-hope",
    name: "Hope RCMP",
    type: "rcmp_detachment",
    municipality: "Hope",
    region: "Fraser Valley",
    latitude: 49.3858,
    longitude: -121.4419,
    phone: "(604) 869-7750",
    address: "425 Park St, Hope",
    notes: "E Division"
  },

  // ==========================================
  // RCMP DETACHMENTS - SEA TO SKY / SUNSHINE COAST
  // ==========================================
  {
    id: "rcmp-squamish",
    name: "Squamish RCMP",
    type: "rcmp_detachment",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.7016,
    longitude: -123.1558,
    phone: "(604) 892-6100",
    address: "1247 Pemberton Ave, Squamish",
    notes: "E Division"
  },
  {
    id: "rcmp-whistler",
    name: "Whistler RCMP",
    type: "rcmp_detachment",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    latitude: 50.1163,
    longitude: -122.9574,
    phone: "(604) 932-3044",
    address: "4315 Blackcomb Way, Whistler",
    notes: "E Division"
  },
  {
    id: "rcmp-pemberton",
    name: "Pemberton RCMP",
    type: "rcmp_detachment",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    latitude: 50.3172,
    longitude: -122.8031,
    phone: "(604) 894-6634",
    address: "7431 Prospect St, Pemberton",
    notes: "E Division"
  },
  {
    id: "rcmp-sechelt",
    name: "Sunshine Coast RCMP",
    type: "rcmp_detachment",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    latitude: 49.4726,
    longitude: -123.7545,
    phone: "(604) 885-2266",
    address: "5528 Wharf Ave, Sechelt",
    notes: "E Division"
  },
  {
    id: "rcmp-powell-river",
    name: "Powell River RCMP",
    type: "rcmp_detachment",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8354,
    longitude: -124.5245,
    phone: "(604) 485-6255",
    address: "6955 Alberni St, Powell River",
    notes: "E Division"
  },

  // ==========================================
  // RCMP DETACHMENTS - INTERIOR
  // ==========================================
  {
    id: "rcmp-kamloops",
    name: "Kamloops RCMP",
    type: "rcmp_detachment",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6756,
    longitude: -120.3352,
    phone: "(250) 828-3000",
    address: "560 Battle St, Kamloops",
    notes: "E Division"
  },
  {
    id: "rcmp-kelowna",
    name: "Kelowna RCMP",
    type: "rcmp_detachment",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8833,
    longitude: -119.4833,
    phone: "(250) 762-3300",
    address: "350 Doyle Ave, Kelowna",
    notes: "E Division"
  },
  {
    id: "rcmp-penticton",
    name: "Penticton RCMP",
    type: "rcmp_detachment",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    latitude: 49.4817,
    longitude: -119.5762,
    phone: "(250) 492-4300",
    address: "1168 Main St, Penticton",
    notes: "E Division"
  },
  {
    id: "rcmp-vernon",
    name: "Vernon RCMP",
    type: "rcmp_detachment",
    municipality: "Vernon",
    region: "North Okanagan",
    latitude: 50.2750,
    longitude: -119.2719,
    phone: "(250) 545-7171",
    address: "3402 30th St, Vernon",
    notes: "E Division"
  },
  {
    id: "rcmp-cranbrook",
    name: "Cranbrook RCMP",
    type: "rcmp_detachment",
    municipality: "Cranbrook",
    region: "East Kootenay",
    latitude: 49.5097,
    longitude: -115.7631,
    phone: "(250) 489-3471",
    address: "42 8th Ave S, Cranbrook",
    notes: "E Division"
  },
  {
    id: "rcmp-trail",
    name: "Trail RCMP",
    type: "rcmp_detachment",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0958,
    longitude: -117.7006,
    phone: "(250) 364-2566",
    address: "2091 Columbia Ave, Trail",
    notes: "E Division"
  },
  {
    id: "rcmp-castlegar",
    name: "Castlegar RCMP",
    type: "rcmp_detachment",
    municipality: "Castlegar",
    region: "Central Kootenay",
    latitude: 49.3256,
    longitude: -117.6658,
    phone: "(250) 365-7721",
    address: "1430 Columbia Ave, Castlegar",
    notes: "E Division"
  },
  {
    id: "rcmp-golden",
    name: "Golden RCMP",
    type: "rcmp_detachment",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    latitude: 51.2972,
    longitude: -116.9631,
    phone: "(250) 344-2221",
    address: "1014 11th Ave S, Golden",
    notes: "E Division"
  },
  {
    id: "rcmp-revelstoke",
    name: "Revelstoke RCMP",
    type: "rcmp_detachment",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    latitude: 50.9989,
    longitude: -118.1956,
    phone: "(250) 837-5255",
    address: "320 Wilson St, Revelstoke",
    notes: "E Division"
  },
  {
    id: "rcmp-salmon-arm",
    name: "Salmon Arm RCMP",
    type: "rcmp_detachment",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    latitude: 50.7014,
    longitude: -119.2806,
    phone: "(250) 832-6044",
    address: "750 2nd Ave NE, Salmon Arm",
    notes: "E Division"
  },
  {
    id: "rcmp-merritt",
    name: "Merritt RCMP",
    type: "rcmp_detachment",
    municipality: "Merritt",
    region: "Thompson-Nicola",
    latitude: 50.1128,
    longitude: -120.7919,
    phone: "(250) 378-4262",
    address: "2999 Voght St, Merritt",
    notes: "E Division"
  },

  // ==========================================
  // RCMP DETACHMENTS - NORTHERN BC
  // ==========================================
  {
    id: "rcmp-prince-george",
    name: "Prince George RCMP",
    type: "rcmp_detachment",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.8947,
    longitude: -122.8072,
    phone: "(250) 561-3300",
    address: "455 Victoria St, Prince George",
    notes: "E Division - North District HQ"
  },
  {
    id: "rcmp-fort-st-john",
    name: "Fort St. John RCMP",
    type: "rcmp_detachment",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.2436,
    longitude: -120.8458,
    phone: "(250) 787-8100",
    address: "10648 100th St, Fort St. John",
    notes: "E Division"
  },
  {
    id: "rcmp-dawson-creek",
    name: "Dawson Creek RCMP",
    type: "rcmp_detachment",
    municipality: "Dawson Creek",
    region: "Peace River",
    latitude: 55.7597,
    longitude: -120.2378,
    phone: "(250) 784-3700",
    address: "1301 112th Ave, Dawson Creek",
    notes: "E Division"
  },
  {
    id: "rcmp-terrace",
    name: "Terrace RCMP",
    type: "rcmp_detachment",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    latitude: 54.5172,
    longitude: -128.5931,
    phone: "(250) 638-7400",
    address: "3205 Eby St, Terrace",
    notes: "E Division"
  },
  {
    id: "rcmp-prince-rupert",
    name: "Prince Rupert RCMP",
    type: "rcmp_detachment",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3108,
    longitude: -130.3250,
    phone: "(250) 624-2136",
    address: "100 6th Ave W, Prince Rupert",
    notes: "E Division"
  },
  {
    id: "rcmp-kitimat",
    name: "Kitimat RCMP",
    type: "rcmp_detachment",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 54.0519,
    longitude: -128.6542,
    phone: "(250) 632-7111",
    address: "1400 Kingfisher Ave, Kitimat",
    notes: "E Division"
  },
  {
    id: "rcmp-quesnel",
    name: "Quesnel RCMP",
    type: "rcmp_detachment",
    municipality: "Quesnel",
    region: "Cariboo",
    latitude: 52.9839,
    longitude: -122.4931,
    phone: "(250) 992-9211",
    address: "584 Carson Ave, Quesnel",
    notes: "E Division"
  },
  {
    id: "rcmp-williams-lake",
    name: "Williams Lake RCMP",
    type: "rcmp_detachment",
    municipality: "Williams Lake",
    region: "Cariboo",
    latitude: 52.1286,
    longitude: -122.1411,
    phone: "(250) 392-6211",
    address: "575 Borland St, Williams Lake",
    notes: "E Division"
  },
  {
    id: "rcmp-smithers",
    name: "Smithers RCMP",
    type: "rcmp_detachment",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    latitude: 54.7806,
    longitude: -127.1667,
    phone: "(250) 847-3233",
    address: "3351 Alfred Ave, Smithers",
    notes: "E Division"
  },
  {
    id: "rcmp-burns-lake",
    name: "Burns Lake RCMP",
    type: "rcmp_detachment",
    municipality: "Burns Lake",
    region: "Bulkley-Nechako",
    latitude: 54.2306,
    longitude: -125.7597,
    phone: "(250) 692-7171",
    address: "50 2nd Ave, Burns Lake",
    notes: "E Division"
  },

  // ==========================================
  // FIRE DEPARTMENTS - METRO VANCOUVER
  // ==========================================
  {
    id: "fire-vancouver-hall1",
    name: "Vancouver Fire Hall No. 1",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2778,
    longitude: -123.0953,
    address: "900 Heatley Ave, Vancouver",
    notes: "VFRS - Strathcona - Canada's first electric fire engine"
  },
  {
    id: "fire-vancouver-hall2",
    name: "Vancouver Fire Hall No. 2",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2827,
    longitude: -123.1064,
    address: "199 Main St, Vancouver",
    notes: "VFRS - Downtown"
  },
  {
    id: "fire-vancouver-hall5",
    name: "Vancouver Fire Hall No. 5",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2734,
    longitude: -123.1370,
    address: "1001 Hamilton St, Vancouver",
    notes: "VFRS - Yaletown"
  },
  {
    id: "fire-vancouver-hall6",
    name: "Vancouver Fire Hall No. 6",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2542,
    longitude: -123.1345,
    address: "1001 W 12th Ave, Vancouver",
    notes: "VFRS - Fairview"
  },
  {
    id: "fire-vancouver-hall7",
    name: "Vancouver Fire Hall No. 7",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2659,
    longitude: -123.1683,
    address: "1090 Haro St, Vancouver",
    notes: "VFRS - West End"
  },
  {
    id: "fire-vancouver-hall8",
    name: "Vancouver Fire Hall No. 8",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2719,
    longitude: -123.0711,
    address: "895 E Hastings St, Vancouver",
    notes: "VFRS - Hastings"
  },
  {
    id: "fire-vancouver-hall9",
    name: "Vancouver Fire Hall No. 9",
    type: "fire_station",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    latitude: 49.2461,
    longitude: -123.0553,
    address: "1805 Victoria Dr, Vancouver",
    notes: "VFRS - Grandview-Woodland"
  },
  {
    id: "fire-burnaby-hq",
    name: "Burnaby Fire Department - Headquarters",
    type: "fire_station",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    latitude: 49.2489,
    longitude: -122.9542,
    address: "6515 Bonsor Ave, Burnaby",
    notes: "BFD Headquarters"
  },
  {
    id: "fire-surrey-hall1",
    name: "Surrey Fire Hall 1",
    type: "fire_station",
    municipality: "Surrey",
    region: "Metro Vancouver",
    latitude: 49.1913,
    longitude: -122.8490,
    address: "14245 56 Ave, Surrey",
    notes: "Surrey Fire Service HQ"
  },
  {
    id: "fire-richmond-hall1",
    name: "Richmond Fire Hall No. 1",
    type: "fire_station",
    municipality: "Richmond",
    region: "Metro Vancouver",
    latitude: 49.1708,
    longitude: -123.1358,
    address: "6960 Gilbert Rd, Richmond",
    notes: "RFR Headquarters"
  },
  {
    id: "fire-coquitlam-hall1",
    name: "Coquitlam Fire Hall 1",
    type: "fire_station",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    latitude: 49.2897,
    longitude: -122.7919,
    address: "1300 Pinetree Way, Coquitlam",
    notes: "CFR Headquarters"
  },
  {
    id: "fire-north-vancouver-hall1",
    name: "North Vancouver Fire Hall 1",
    type: "fire_station",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3193,
    longitude: -123.0695,
    address: "147 E 15th St, North Vancouver",
    notes: "City of North Vancouver FD"
  },
  {
    id: "fire-west-vancouver",
    name: "West Vancouver Fire Hall 1",
    type: "fire_station",
    municipality: "West Vancouver",
    region: "Metro Vancouver",
    latitude: 49.3278,
    longitude: -123.1667,
    address: "1596 Duchess Ave, West Vancouver",
    notes: "WVFR Headquarters"
  },

  // ==========================================
  // FIRE DEPARTMENTS - CAPITAL REGION
  // ==========================================
  {
    id: "fire-victoria-hall1",
    name: "Victoria Fire Hall No. 1",
    type: "fire_station",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4318,
    longitude: -123.3589,
    address: "1025 Johnson St, Victoria",
    notes: "VFD Headquarters - opened April 2023"
  },
  {
    id: "fire-victoria-hall2",
    name: "Victoria Fire Hall No. 2",
    type: "fire_station",
    municipality: "Victoria",
    region: "Capital",
    latitude: 48.4200,
    longitude: -123.3733,
    address: "650 Michigan St, Victoria",
    notes: "VFD - James Bay"
  },
  {
    id: "fire-saanich-hall1",
    name: "Saanich Fire Hall 1",
    type: "fire_station",
    municipality: "Saanich",
    region: "Capital",
    latitude: 48.4639,
    longitude: -123.3778,
    address: "760 Vernon Ave, Saanich",
    notes: "SFD Headquarters"
  },
  {
    id: "fire-oak-bay",
    name: "Oak Bay Fire Department",
    type: "fire_station",
    municipality: "Oak Bay",
    region: "Capital",
    latitude: 48.4267,
    longitude: -123.3133,
    address: "1703 Monterey Ave, Oak Bay",
    notes: "Oak Bay FD"
  },
  {
    id: "fire-esquimalt",
    name: "Esquimalt Fire Department",
    type: "fire_station",
    municipality: "Esquimalt",
    region: "Capital",
    latitude: 48.4322,
    longitude: -123.4189,
    address: "500 Park Pl, Esquimalt",
    notes: "Esquimalt FD"
  },
  {
    id: "fire-langford",
    name: "Langford Fire Hall 1",
    type: "fire_station",
    municipality: "Langford",
    region: "Capital",
    latitude: 48.4506,
    longitude: -123.5047,
    address: "2625 Peatt Rd, Langford",
    notes: "Langford Fire Rescue"
  },
  {
    id: "fire-sidney",
    name: "Sidney Fire Hall",
    type: "fire_station",
    municipality: "Sidney",
    region: "Capital",
    latitude: 48.6508,
    longitude: -123.4039,
    address: "9838 4th St, Sidney",
    notes: "Sidney Volunteer Fire"
  },

  // ==========================================
  // FIRE DEPARTMENTS - VANCOUVER ISLAND
  // ==========================================
  {
    id: "fire-nanaimo-hall1",
    name: "Nanaimo Fire Hall 1",
    type: "fire_station",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1659,
    longitude: -123.9401,
    address: "480 Franklyn St, Nanaimo",
    notes: "Nanaimo Fire Rescue"
  },
  {
    id: "fire-campbell-river",
    name: "Campbell River Fire Hall",
    type: "fire_station",
    municipality: "Campbell River",
    region: "Strathcona",
    latitude: 50.0247,
    longitude: -125.2437,
    address: "1255 Shoppers Row, Campbell River",
    notes: "Campbell River Fire Dept"
  },
  {
    id: "fire-courtenay",
    name: "Courtenay Fire Hall",
    type: "fire_station",
    municipality: "Courtenay",
    region: "Comox Valley",
    latitude: 49.6856,
    longitude: -124.9937,
    address: "700 Harmston Ave, Courtenay",
    notes: "Courtenay Fire Dept"
  },
  {
    id: "fire-port-alberni",
    name: "Port Alberni Fire Hall",
    type: "fire_station",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2419,
    longitude: -124.8028,
    address: "3699 4th Ave, Port Alberni",
    notes: "Port Alberni Fire Dept"
  },
  {
    id: "fire-tofino",
    name: "Tofino Volunteer Fire Department",
    type: "fire_station",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    latitude: 49.1530,
    longitude: -125.9066,
    address: "165 1st St, Tofino",
    notes: "Tofino VFD"
  },
  {
    id: "fire-duncan",
    name: "Duncan Fire Hall",
    type: "fire_station",
    municipality: "Duncan",
    region: "Cowichan Valley",
    latitude: 48.7858,
    longitude: -123.7195,
    address: "75 Kenneth St, Duncan",
    notes: "Duncan Volunteer Fire"
  },

  // ==========================================
  // FIRE DEPARTMENTS - INTERIOR
  // ==========================================
  {
    id: "fire-kamloops-hall1",
    name: "Kamloops Fire Hall 1",
    type: "fire_station",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    latitude: 50.6756,
    longitude: -120.3352,
    address: "730 Battle St, Kamloops",
    notes: "Kamloops Fire Rescue HQ"
  },
  {
    id: "fire-kelowna-hall1",
    name: "Kelowna Fire Hall 1",
    type: "fire_station",
    municipality: "Kelowna",
    region: "Central Okanagan",
    latitude: 49.8833,
    longitude: -119.4833,
    address: "2255 Enterprise Way, Kelowna",
    notes: "Kelowna Fire Dept HQ"
  },
  {
    id: "fire-penticton",
    name: "Penticton Fire Hall",
    type: "fire_station",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    latitude: 49.4817,
    longitude: -119.5762,
    address: "310 Power St, Penticton",
    notes: "Penticton Fire Dept"
  },
  {
    id: "fire-vernon",
    name: "Vernon Fire Hall 1",
    type: "fire_station",
    municipality: "Vernon",
    region: "North Okanagan",
    latitude: 50.2750,
    longitude: -119.2719,
    address: "3402 35th Ave, Vernon",
    notes: "Vernon Fire Rescue Services"
  },
  {
    id: "fire-nelson",
    name: "Nelson Fire Hall",
    type: "fire_station",
    municipality: "Nelson",
    region: "Central Kootenay",
    latitude: 49.4928,
    longitude: -117.2881,
    address: "919 Ward St, Nelson",
    notes: "Nelson Fire Dept"
  },
  {
    id: "fire-cranbrook",
    name: "Cranbrook Fire Hall",
    type: "fire_station",
    municipality: "Cranbrook",
    region: "East Kootenay",
    latitude: 49.5097,
    longitude: -115.7631,
    address: "1015 Kootenay St N, Cranbrook",
    notes: "Cranbrook Fire & Emergency Services"
  },

  // ==========================================
  // FIRE DEPARTMENTS - NORTHERN BC
  // ==========================================
  {
    id: "fire-prince-george-hall1",
    name: "Prince George Fire Hall 1",
    type: "fire_station",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    latitude: 53.8947,
    longitude: -122.8072,
    address: "1255 3rd Ave, Prince George",
    notes: "Prince George Fire/Rescue HQ"
  },
  {
    id: "fire-fort-st-john",
    name: "Fort St. John Fire Hall",
    type: "fire_station",
    municipality: "Fort St. John",
    region: "Peace River",
    latitude: 56.2436,
    longitude: -120.8458,
    address: "10220 95th Ave, Fort St. John",
    notes: "FSJ Fire Dept"
  },
  {
    id: "fire-terrace",
    name: "Terrace Fire Hall",
    type: "fire_station",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    latitude: 54.5172,
    longitude: -128.5931,
    address: "3215 Eby St, Terrace",
    notes: "Terrace Fire Dept"
  },
  {
    id: "fire-prince-rupert",
    name: "Prince Rupert Fire Hall",
    type: "fire_station",
    municipality: "Prince Rupert",
    region: "North Coast",
    latitude: 54.3108,
    longitude: -130.3250,
    address: "200 1st Ave W, Prince Rupert",
    notes: "Prince Rupert Fire Rescue"
  },
  {
    id: "fire-quesnel",
    name: "Quesnel Fire Hall",
    type: "fire_station",
    municipality: "Quesnel",
    region: "Cariboo",
    latitude: 52.9839,
    longitude: -122.4931,
    address: "350 Kinchant St, Quesnel",
    notes: "Quesnel Fire Dept"
  },
  {
    id: "fire-williams-lake",
    name: "Williams Lake Fire Hall",
    type: "fire_station",
    municipality: "Williams Lake",
    region: "Cariboo",
    latitude: 52.1286,
    longitude: -122.1411,
    address: "75 1st Ave N, Williams Lake",
    notes: "Williams Lake Fire Dept"
  },

  // ==========================================
  // FIRE DEPARTMENTS - FRASER VALLEY
  // ==========================================
  {
    id: "fire-abbotsford-hall1",
    name: "Abbotsford Fire Hall 1",
    type: "fire_station",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    latitude: 49.0504,
    longitude: -122.3045,
    address: "2775 Ware St, Abbotsford",
    notes: "Abbotsford Fire Rescue HQ"
  },
  {
    id: "fire-chilliwack",
    name: "Chilliwack Fire Hall 1",
    type: "fire_station",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    latitude: 49.1655,
    longitude: -121.9506,
    address: "46150 Princess Ave, Chilliwack",
    notes: "Chilliwack Fire Dept HQ"
  },
  {
    id: "fire-mission",
    name: "Mission Fire Hall 1",
    type: "fire_station",
    municipality: "Mission",
    region: "Fraser Valley",
    latitude: 49.1336,
    longitude: -122.3095,
    address: "32352 Logan Ave, Mission",
    notes: "Mission Fire/Rescue"
  },

  // ==========================================
  // HEALTH CENTRES - RURAL/REMOTE FACILITIES
  // ==========================================
  {
    id: "health-bamfield",
    name: "Bamfield Health Centre",
    type: "hospital",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    latitude: 48.8336,
    longitude: -125.1361,
    phone: "(250) 728-3312",
    address: "353 Bamfield Rd, Bamfield",
    health_authority: "Island Health",
    has_helipad: false,
    emergency_department: true,
    notes: "Urgent care - Remote certified nurse 24h - No overnight admittance - Patient transfer to Port Alberni/Tofino"
  },
  {
    id: "health-alert-bay",
    name: "Cormorant Island Health Centre",
    type: "hospital",
    municipality: "Alert Bay",
    region: "Mount Waddington",
    latitude: 50.5858,
    longitude: -126.9328,
    phone: "(250) 974-5585",
    address: "29 School Rd, Alert Bay",
    health_authority: "Island Health",
    emergency_department: true,
    notes: "Remote community health centre"
  },
  {
    id: "health-bella-coola",
    name: "Bella Coola General Hospital",
    type: "hospital",
    municipality: "Bella Coola",
    region: "Central Coast",
    latitude: 52.3686,
    longitude: -126.7544,
    phone: "(250) 799-5311",
    address: "1025 Elcho St, Bella Coola",
    health_authority: "Vancouver Coastal Health",
    has_helipad: true,
    emergency_department: true,
    notes: "Remote hospital - Central Coast"
  },
  {
    id: "health-bella-bella",
    name: "R.W. Large Memorial Hospital",
    type: "hospital",
    municipality: "Bella Bella",
    region: "Central Coast",
    latitude: 52.1608,
    longitude: -128.1456,
    phone: "(250) 957-2314",
    address: "Bella Bella",
    health_authority: "Vancouver Coastal Health",
    has_helipad: true,
    emergency_department: true,
    notes: "Heiltsuk Nation - Remote hospital"
  },
  {
    id: "health-haida-gwaii",
    name: "Haida Gwaii Hospital",
    type: "hospital",
    municipality: "Queen Charlotte",
    region: "North Coast",
    latitude: 53.2522,
    longitude: -132.0756,
    phone: "(250) 559-4300",
    address: "3209 3rd Ave, Queen Charlotte",
    health_authority: "Northern Health",
    has_helipad: true,
    emergency_department: true,
    notes: "Haida Gwaii - Queen Charlotte City"
  },
  {
    id: "health-masset",
    name: "Northern Haida Gwaii Hospital",
    type: "hospital",
    municipality: "Masset",
    region: "North Coast",
    latitude: 54.0153,
    longitude: -132.1489,
    phone: "(250) 626-4700",
    address: "2520 Harrison Ave, Masset",
    health_authority: "Northern Health",
    emergency_department: true,
    notes: "Northern Haida Gwaii"
  },
  {
    id: "health-ucluelet",
    name: "Ucluelet Medical Clinic",
    type: "hospital",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    latitude: 48.9420,
    longitude: -125.5460,
    phone: "(250) 726-4433",
    address: "309 Forbes Rd, Ucluelet",
    health_authority: "Island Health",
    emergency_department: false,
    notes: "Medical clinic - Urgent care available"
  },

  // ==========================================
  // VOLUNTEER FIRE DEPARTMENTS - VANCOUVER ISLAND (VIFFA)
  // ==========================================
  {
    id: "fire-bamfield-east",
    name: "Bamfield Volunteer Fire Department - East Hall",
    type: "fire_station",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    latitude: 48.8350,
    longitude: -125.1350,
    notes: "Bamfield VFD - East Bamfield - VIFFA member"
  },
  {
    id: "fire-bamfield-west",
    name: "Bamfield Volunteer Fire Department - West Hall",
    type: "fire_station",
    municipality: "Bamfield",
    region: "Alberni-Clayoquot",
    latitude: 48.8320,
    longitude: -125.1400,
    notes: "Bamfield VFD - West Bamfield - VIFFA member"
  },
  {
    id: "fire-ahousaht",
    name: "Ahousaht Volunteer Fire Department",
    type: "fire_station",
    municipality: "Ahousaht",
    region: "Alberni-Clayoquot",
    latitude: 49.2819,
    longitude: -126.0653,
    notes: "First Nations community - VIFFA member"
  },
  {
    id: "fire-alert-bay",
    name: "Alert Bay Volunteer Fire Department",
    type: "fire_station",
    municipality: "Alert Bay",
    region: "Mount Waddington",
    latitude: 50.5858,
    longitude: -126.9328,
    notes: "VIFFA member"
  },
  {
    id: "fire-beaver-creek",
    name: "Beaver Creek Volunteer Fire Department",
    type: "fire_station",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2867,
    longitude: -124.7833,
    notes: "VIFFA member - serves Beaver Creek area"
  },
  {
    id: "fire-bow-horn-bay",
    name: "Bow Horn Bay Volunteer Fire Department",
    type: "fire_station",
    municipality: "Bowser",
    region: "Nanaimo",
    latitude: 49.4333,
    longitude: -124.6833,
    notes: "VIFFA member"
  },
  {
    id: "fire-caycuse",
    name: "Caycuse Volunteer Fire Department",
    type: "fire_station",
    municipality: "Lake Cowichan",
    region: "Cowichan Valley",
    latitude: 48.8667,
    longitude: -124.3000,
    notes: "CVRD - VIFFA member"
  },
  {
    id: "fire-central-saanich",
    name: "Central Saanich Fire Department",
    type: "fire_station",
    municipality: "Central Saanich",
    region: "Capital",
    latitude: 48.5350,
    longitude: -123.3833,
    address: "1903 Mt Newton Cross Rd, Saanichton",
    notes: "VIFFA member"
  },
  {
    id: "fire-chemainus",
    name: "Chemainus Volunteer Fire Department",
    type: "fire_station",
    municipality: "Chemainus",
    region: "Cowichan Valley",
    latitude: 48.9256,
    longitude: -123.7139,
    notes: "North Cowichan - VIFFA member"
  },
  {
    id: "fire-cherry-creek",
    name: "Cherry Creek Fire Department",
    type: "fire_station",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2700,
    longitude: -124.7500,
    notes: "VIFFA member"
  },
  {
    id: "fire-coal-harbour",
    name: "Coal Harbour Volunteer Fire Department",
    type: "fire_station",
    municipality: "Coal Harbour",
    region: "Mount Waddington",
    latitude: 50.6000,
    longitude: -127.5833,
    phone: "(250) 949-6430",
    notes: "VIFFA member"
  },
  {
    id: "fire-colwood",
    name: "Colwood Fire Rescue",
    type: "fire_station",
    municipality: "Colwood",
    region: "Capital",
    latitude: 48.4233,
    longitude: -123.4956,
    notes: "VIFFA member"
  },
  {
    id: "fire-comox",
    name: "Comox Fire Rescue",
    type: "fire_station",
    municipality: "Comox",
    region: "Comox Valley",
    latitude: 49.6728,
    longitude: -124.9278,
    notes: "VIFFA member"
  },
  {
    id: "fire-coombs-hilliers",
    name: "Coombs-Hilliers Volunteer Fire Department",
    type: "fire_station",
    municipality: "Coombs",
    region: "Nanaimo",
    latitude: 49.3000,
    longitude: -124.4167,
    notes: "VIFFA member"
  },
  {
    id: "fire-cortes-island",
    name: "Cortes Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Cortes Island",
    region: "Strathcona",
    latitude: 50.0667,
    longitude: -124.9667,
    notes: "VIFFA member"
  },
  {
    id: "fire-cowichan-bay",
    name: "Cowichan Bay Volunteer Fire Rescue",
    type: "fire_station",
    municipality: "Cowichan Bay",
    region: "Cowichan Valley",
    latitude: 48.7383,
    longitude: -123.6181,
    notes: "VIFFA member"
  },
  {
    id: "fire-cranberry",
    name: "Cranberry Volunteer Fire Department",
    type: "fire_station",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1500,
    longitude: -124.0333,
    notes: "VIFFA member"
  },
  {
    id: "fire-crofton",
    name: "Crofton Fire Department",
    type: "fire_station",
    municipality: "Crofton",
    region: "Cowichan Valley",
    latitude: 48.8667,
    longitude: -123.6500,
    notes: "North Cowichan - VIFFA member"
  },
  {
    id: "fire-cumberland",
    name: "Cumberland Fire Rescue",
    type: "fire_station",
    municipality: "Cumberland",
    region: "Comox Valley",
    latitude: 49.6197,
    longitude: -125.0278,
    notes: "VIFFA member"
  },
  {
    id: "fire-dashwood",
    name: "Dashwood Volunteer Fire Department",
    type: "fire_station",
    municipality: "Dashwood",
    region: "Nanaimo",
    latitude: 49.3667,
    longitude: -124.5167,
    notes: "VIFFA member"
  },
  {
    id: "fire-deep-bay",
    name: "Deep Bay Volunteer Fire Department",
    type: "fire_station",
    municipality: "Deep Bay",
    region: "Nanaimo",
    latitude: 49.4667,
    longitude: -124.7333,
    notes: "VIFFA member"
  },
  {
    id: "fire-denman-island",
    name: "Denman Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Denman Island",
    region: "Comox Valley",
    latitude: 49.5333,
    longitude: -124.8167,
    notes: "VIFFA member"
  },
  {
    id: "fire-east-sooke",
    name: "East Sooke Volunteer Fire Department",
    type: "fire_station",
    municipality: "East Sooke",
    region: "Capital",
    latitude: 48.3667,
    longitude: -123.6500,
    notes: "CRD - VIFFA member"
  },
  {
    id: "fire-east-wellington",
    name: "East Wellington Volunteer Fire Department",
    type: "fire_station",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1833,
    longitude: -123.9667,
    notes: "Mountain Fire Protection - VIFFA member"
  },
  {
    id: "fire-errington",
    name: "Errington Fire Department",
    type: "fire_station",
    municipality: "Errington",
    region: "Nanaimo",
    latitude: 49.2833,
    longitude: -124.3333,
    notes: "VIFFA member"
  },
  {
    id: "fire-extension",
    name: "Extension Fire Department",
    type: "fire_station",
    municipality: "Nanaimo",
    region: "Nanaimo",
    latitude: 49.1167,
    longitude: -123.9000,
    notes: "VIFFA member"
  },
  {
    id: "fire-fanny-bay",
    name: "Fanny Bay Fire Department",
    type: "fire_station",
    municipality: "Fanny Bay",
    region: "Comox Valley",
    latitude: 49.4833,
    longitude: -124.8167,
    notes: "VIFFA member"
  },
  {
    id: "fire-gabriola",
    name: "Gabriola Volunteer Fire Department",
    type: "fire_station",
    municipality: "Gabriola Island",
    region: "Nanaimo",
    latitude: 49.1500,
    longitude: -123.8000,
    notes: "VIFFA member"
  },
  {
    id: "fire-gillies-bay",
    name: "Gillies Bay Volunteer Fire Department",
    type: "fire_station",
    municipality: "Texada Island",
    region: "Powell River",
    latitude: 49.6833,
    longitude: -124.5167,
    notes: "VIFFA member"
  },
  {
    id: "fire-gold-river",
    name: "Gold River Volunteer Fire Department",
    type: "fire_station",
    municipality: "Gold River",
    region: "Strathcona",
    latitude: 49.7833,
    longitude: -126.1000,
    notes: "VIFFA member"
  },
  {
    id: "fire-highlands",
    name: "Highlands Volunteer Fire Department",
    type: "fire_station",
    municipality: "Highlands",
    region: "Capital",
    latitude: 48.4833,
    longitude: -123.5000,
    phone: "(250) 479-1814",
    notes: "VIFFA member"
  },
  {
    id: "fire-holberg",
    name: "Holberg Volunteer Fire Department",
    type: "fire_station",
    municipality: "Holberg",
    region: "Mount Waddington",
    latitude: 50.6333,
    longitude: -128.0333,
    notes: "RDMW - VIFFA member"
  },
  {
    id: "fire-honeymoon-bay",
    name: "Honeymoon Bay Fire Department",
    type: "fire_station",
    municipality: "Honeymoon Bay",
    region: "Cowichan Valley",
    latitude: 48.8333,
    longitude: -124.1667,
    notes: "VIFFA member"
  },
  {
    id: "fire-hornby-island",
    name: "Hornby Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Hornby Island",
    region: "Comox Valley",
    latitude: 49.5333,
    longitude: -124.6667,
    notes: "VIFFA member"
  },
  {
    id: "fire-hyde-creek",
    name: "Hyde Creek Fire Department",
    type: "fire_station",
    municipality: "Port McNeill",
    region: "Mount Waddington",
    latitude: 50.5500,
    longitude: -127.1667,
    notes: "VIFFA member"
  },
  {
    id: "fire-ladysmith",
    name: "Ladysmith Fire Rescue",
    type: "fire_station",
    municipality: "Ladysmith",
    region: "Cowichan Valley",
    latitude: 48.9947,
    longitude: -123.8172,
    notes: "VIFFA member"
  },
  {
    id: "fire-lake-cowichan",
    name: "Lake Cowichan Fire Department",
    type: "fire_station",
    municipality: "Lake Cowichan",
    region: "Cowichan Valley",
    latitude: 48.8278,
    longitude: -124.0544,
    notes: "VIFFA member"
  },
  {
    id: "fire-lantzville",
    name: "Lantzville Fire Rescue",
    type: "fire_station",
    municipality: "Lantzville",
    region: "Nanaimo",
    latitude: 49.2500,
    longitude: -124.0667,
    notes: "VIFFA member"
  },
  {
    id: "fire-lasqueti-island",
    name: "Lasqueti Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Lasqueti Island",
    region: "Powell River",
    latitude: 49.5000,
    longitude: -124.3667,
    notes: "VIFFA member"
  },
  {
    id: "fire-malahat",
    name: "Malahat Volunteer Fire Department",
    type: "fire_station",
    municipality: "Malahat",
    region: "Cowichan Valley",
    latitude: 48.5833,
    longitude: -123.5500,
    notes: "VIFFA member"
  },
  {
    id: "fire-maple-bay",
    name: "Maple Bay Fire Department",
    type: "fire_station",
    municipality: "Maple Bay",
    region: "Cowichan Valley",
    latitude: 48.8000,
    longitude: -123.6167,
    notes: "North Cowichan - VIFFA member"
  },
  {
    id: "fire-mayne-island",
    name: "Mayne Island Fire Department",
    type: "fire_station",
    municipality: "Mayne Island",
    region: "Capital",
    latitude: 48.8500,
    longitude: -123.2833,
    notes: "VIFFA member - Gulf Islands"
  },
  {
    id: "fire-mesachie-lake",
    name: "Mesachie Lake Volunteer Fire Department",
    type: "fire_station",
    municipality: "Mesachie Lake",
    region: "Cowichan Valley",
    latitude: 48.8333,
    longitude: -124.1333,
    notes: "VIFFA member"
  },
  {
    id: "fire-metchosin",
    name: "Metchosin Volunteer Fire Department",
    type: "fire_station",
    municipality: "Metchosin",
    region: "Capital",
    latitude: 48.3833,
    longitude: -123.5333,
    notes: "VIFFA member"
  },
  {
    id: "fire-mill-bay",
    name: "Mill Bay Fire Department",
    type: "fire_station",
    municipality: "Mill Bay",
    region: "Cowichan Valley",
    latitude: 48.6500,
    longitude: -123.5500,
    notes: "VIFFA member"
  },
  {
    id: "fire-nanoose-bay",
    name: "Nanoose Bay Volunteer Fire Department",
    type: "fire_station",
    municipality: "Nanoose Bay",
    region: "Nanaimo",
    latitude: 49.2667,
    longitude: -124.2000,
    notes: "VIFFA member"
  },
  {
    id: "fire-north-cedar",
    name: "North Cedar Fire Department",
    type: "fire_station",
    municipality: "Cedar",
    region: "Nanaimo",
    latitude: 49.0833,
    longitude: -123.8500,
    notes: "NCID - VIFFA member"
  },
  {
    id: "fire-north-cowichan-south",
    name: "North Cowichan Fire Department - South End",
    type: "fire_station",
    municipality: "North Cowichan",
    region: "Cowichan Valley",
    latitude: 48.8333,
    longitude: -123.7000,
    notes: "VIFFA member"
  },
  {
    id: "fire-north-galiano",
    name: "North Galiano Volunteer Fire Department",
    type: "fire_station",
    municipality: "Galiano Island",
    region: "Capital",
    latitude: 49.0000,
    longitude: -123.4500,
    notes: "VIFFA member - Gulf Islands"
  },
  {
    id: "fire-north-oyster",
    name: "North Oyster Fire Department",
    type: "fire_station",
    municipality: "Ladysmith",
    region: "Cowichan Valley",
    latitude: 49.0167,
    longitude: -123.8833,
    notes: "VIFFA member"
  },
  {
    id: "fire-north-saanich",
    name: "North Saanich Fire Department",
    type: "fire_station",
    municipality: "North Saanich",
    region: "Capital",
    latitude: 48.6667,
    longitude: -123.4167,
    notes: "VIFFA member"
  },
  {
    id: "fire-otter-point",
    name: "Otter Point Volunteer Fire Department",
    type: "fire_station",
    municipality: "Otter Point",
    region: "Capital",
    latitude: 48.3833,
    longitude: -123.8000,
    notes: "CRD - VIFFA member"
  },
  {
    id: "fire-oyster-river",
    name: "Oyster River Fire Department",
    type: "fire_station",
    municipality: "Black Creek",
    region: "Comox Valley",
    latitude: 49.8833,
    longitude: -125.1333,
    notes: "VIFFA member"
  },
  {
    id: "fire-pacheedaht",
    name: "Pacheedaht Volunteer Fire Department",
    type: "fire_station",
    municipality: "Port Renfrew",
    region: "Capital",
    latitude: 48.5500,
    longitude: -124.4333,
    notes: "First Nations - VIFFA member"
  },
  {
    id: "fire-parksville",
    name: "Parksville Fire Department",
    type: "fire_station",
    municipality: "Parksville",
    region: "Nanaimo",
    latitude: 49.3206,
    longitude: -124.3181,
    notes: "VIFFA member"
  },
  {
    id: "fire-pender-island",
    name: "Pender Island Fire Rescue",
    type: "fire_station",
    municipality: "Pender Island",
    region: "Capital",
    latitude: 48.7833,
    longitude: -123.2833,
    notes: "VIFFA member - Gulf Islands"
  },
  {
    id: "fire-piers-island",
    name: "Piers Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Piers Island",
    region: "Capital",
    latitude: 48.7000,
    longitude: -123.4167,
    notes: "VIFFA member - small island"
  },
  {
    id: "fire-port-alice",
    name: "Port Alice Volunteer Fire Department",
    type: "fire_station",
    municipality: "Port Alice",
    region: "Mount Waddington",
    latitude: 50.3833,
    longitude: -127.4500,
    notes: "VIFFA member"
  },
  {
    id: "fire-port-hardy",
    name: "Port Hardy Fire Rescue",
    type: "fire_station",
    municipality: "Port Hardy",
    region: "Mount Waddington",
    latitude: 50.7175,
    longitude: -127.4936,
    phone: "(250) 949-6564",
    notes: "VIFFA member"
  },
  {
    id: "fire-port-mcneill",
    name: "Port McNeill Volunteer Fire Department",
    type: "fire_station",
    municipality: "Port McNeill",
    region: "Mount Waddington",
    latitude: 50.5908,
    longitude: -127.0858,
    notes: "VIFFA member"
  },
  {
    id: "fire-port-renfrew",
    name: "Port Renfrew Volunteer Fire Department",
    type: "fire_station",
    municipality: "Port Renfrew",
    region: "Capital",
    latitude: 48.5547,
    longitude: -124.4214,
    notes: "CRD - VIFFA member"
  },
  {
    id: "fire-quadra-island",
    name: "Quadra Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Quadra Island",
    region: "Strathcona",
    latitude: 50.1000,
    longitude: -125.2333,
    notes: "VIFFA member"
  },
  {
    id: "fire-qualicum-beach",
    name: "Qualicum Beach Fire Department",
    type: "fire_station",
    municipality: "Qualicum Beach",
    region: "Nanaimo",
    latitude: 49.3500,
    longitude: -124.4333,
    notes: "VIFFA member"
  },
  {
    id: "fire-sahtlam",
    name: "Sahtlam Fire Department",
    type: "fire_station",
    municipality: "Duncan",
    region: "Cowichan Valley",
    latitude: 48.8000,
    longitude: -123.8000,
    notes: "VIFFA member"
  },
  {
    id: "fire-salt-spring",
    name: "Salt Spring Island Fire Rescue",
    type: "fire_station",
    municipality: "Salt Spring Island",
    region: "Capital",
    latitude: 48.8567,
    longitude: -123.5083,
    notes: "VIFFA member - Gulf Islands"
  },
  {
    id: "fire-saturna-island",
    name: "Saturna Island Fire Protection Society",
    type: "fire_station",
    municipality: "Saturna Island",
    region: "Capital",
    latitude: 48.7833,
    longitude: -123.1333,
    notes: "VIFFA member - Gulf Islands"
  },
  {
    id: "fire-sayward",
    name: "Sayward Fire Department",
    type: "fire_station",
    municipality: "Sayward",
    region: "Strathcona",
    latitude: 50.3833,
    longitude: -125.9500,
    notes: "VIFFA member"
  },
  {
    id: "fire-shawnigan-lake",
    name: "Shawnigan Lake Volunteer Fire Department",
    type: "fire_station",
    municipality: "Shawnigan Lake",
    region: "Cowichan Valley",
    latitude: 48.6500,
    longitude: -123.6333,
    notes: "VIFFA member"
  },
  {
    id: "fire-ships-point",
    name: "Ships Point Volunteer Fire Department",
    type: "fire_station",
    municipality: "Fanny Bay",
    region: "Comox Valley",
    latitude: 49.5167,
    longitude: -124.8000,
    notes: "SPID - VIFFA member"
  },
  {
    id: "fire-shirley",
    name: "Shirley Volunteer Fire Department",
    type: "fire_station",
    municipality: "Shirley",
    region: "Capital",
    latitude: 48.3667,
    longitude: -123.9333,
    notes: "CRD - VIFFA member"
  },
  {
    id: "fire-sointula",
    name: "Sointula Volunteer Fire Department",
    type: "fire_station",
    municipality: "Sointula",
    region: "Mount Waddington",
    latitude: 50.6167,
    longitude: -127.0000,
    notes: "Malcolm Island - VIFFA member"
  },
  {
    id: "fire-sooke",
    name: "Sooke Fire Rescue",
    type: "fire_station",
    municipality: "Sooke",
    region: "Capital",
    latitude: 48.3739,
    longitude: -123.7261,
    notes: "VIFFA member"
  },
  {
    id: "fire-sproat-lake",
    name: "Sproat Lake Volunteer Fire Department",
    type: "fire_station",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    latitude: 49.2833,
    longitude: -124.9167,
    notes: "VIFFA member"
  },
  {
    id: "fire-tahsis",
    name: "Tahsis Volunteer Fire Department",
    type: "fire_station",
    municipality: "Tahsis",
    region: "Strathcona",
    latitude: 49.9167,
    longitude: -126.6667,
    notes: "VIFFA member"
  },
  {
    id: "fire-thetis-island",
    name: "Thetis Island Volunteer Fire Department",
    type: "fire_station",
    municipality: "Thetis Island",
    region: "Cowichan Valley",
    latitude: 48.9833,
    longitude: -123.6833,
    notes: "VIFFA member"
  },
  {
    id: "fire-ucluelet",
    name: "Ucluelet Fire Rescue",
    type: "fire_station",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    latitude: 48.9420,
    longitude: -125.5460,
    notes: "VIFFA member"
  },
  {
    id: "fire-union-bay",
    name: "Union Bay Fire Rescue",
    type: "fire_station",
    municipality: "Union Bay",
    region: "Comox Valley",
    latitude: 49.5833,
    longitude: -124.8833,
    notes: "VIFFA member"
  },
  {
    id: "fire-view-royal",
    name: "View Royal Fire Department",
    type: "fire_station",
    municipality: "View Royal",
    region: "Capital",
    latitude: 48.4500,
    longitude: -123.4500,
    notes: "VIFFA member"
  },
  {
    id: "fire-willis-point",
    name: "Willis Point Volunteer Fire Department",
    type: "fire_station",
    municipality: "Willis Point",
    region: "Capital",
    latitude: 48.5500,
    longitude: -123.4833,
    notes: "CRD - VIFFA member"
  },
  {
    id: "fire-woss",
    name: "Woss Fire Department",
    type: "fire_station",
    municipality: "Woss",
    region: "Mount Waddington",
    latitude: 50.2167,
    longitude: -126.6000,
    notes: "VIFFA member"
  },
  {
    id: "fire-youbou",
    name: "Youbou Volunteer Fire Department",
    type: "fire_station",
    municipality: "Youbou",
    region: "Cowichan Valley",
    latitude: 48.8667,
    longitude: -124.1667,
    notes: "VIFFA member"
  },
  {
    id: "fire-zeballos",
    name: "Zeballos Fire Department",
    type: "fire_station",
    municipality: "Zeballos",
    region: "Strathcona",
    latitude: 49.9833,
    longitude: -126.8500,
    notes: "VIFFA member"
  },

  // ==========================================
  // ADDITIONAL VOLUNTEER FIRE DEPARTMENTS - BC MAINLAND
  // ==========================================
  {
    id: "fire-squamish",
    name: "Squamish Fire Rescue",
    type: "fire_station",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    latitude: 49.7016,
    longitude: -123.1558,
    notes: "District of Squamish"
  },
  {
    id: "fire-whistler",
    name: "Whistler Fire Rescue",
    type: "fire_station",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    latitude: 50.1163,
    longitude: -122.9574,
    notes: "Resort Municipality of Whistler"
  },
  {
    id: "fire-pemberton",
    name: "Pemberton Fire Rescue",
    type: "fire_station",
    municipality: "Pemberton",
    region: "Squamish-Lillooet",
    latitude: 50.3172,
    longitude: -122.8031,
    notes: "Village of Pemberton"
  },
  {
    id: "fire-britannia-beach",
    name: "Britannia Beach Volunteer Fire Department",
    type: "fire_station",
    municipality: "Britannia Beach",
    region: "Squamish-Lillooet",
    latitude: 49.6333,
    longitude: -123.2000,
    phone: "(604) 802-5441",
    notes: "Sea to Sky corridor"
  },
  {
    id: "fire-birken",
    name: "Birken Volunteer Fire Service",
    type: "fire_station",
    municipality: "Birken",
    region: "Squamish-Lillooet",
    latitude: 50.3833,
    longitude: -122.5500,
    phone: "(778) 837-7159",
    notes: "SLRD"
  },
  {
    id: "fire-bralorne",
    name: "Bralorne Fire Protection Association",
    type: "fire_station",
    municipality: "Bralorne",
    region: "Squamish-Lillooet",
    latitude: 50.7667,
    longitude: -122.8000,
    phone: "(604) 512-1442",
    notes: "Historic mining community"
  },
  {
    id: "fire-sechelt",
    name: "Sechelt Fire Department",
    type: "fire_station",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    latitude: 49.4726,
    longitude: -123.7545,
    notes: "Sunshine Coast"
  },
  {
    id: "fire-gibsons",
    name: "Gibsons Fire Department",
    type: "fire_station",
    municipality: "Gibsons",
    region: "Sunshine Coast",
    latitude: 49.4028,
    longitude: -123.5044,
    notes: "Sunshine Coast"
  },
  {
    id: "fire-powell-river",
    name: "Powell River Fire Rescue",
    type: "fire_station",
    municipality: "Powell River",
    region: "Powell River",
    latitude: 49.8354,
    longitude: -124.5245,
    notes: "City of Powell River"
  },
  {
    id: "fire-hope",
    name: "Hope Fire Department",
    type: "fire_station",
    municipality: "Hope",
    region: "Fraser Valley",
    latitude: 49.3858,
    longitude: -121.4419,
    notes: "District of Hope"
  },
  {
    id: "fire-agassiz",
    name: "Agassiz Fire Department",
    type: "fire_station",
    municipality: "Agassiz",
    region: "Fraser Valley",
    latitude: 49.2389,
    longitude: -121.7606,
    phone: "(604) 796-2614",
    notes: "District of Kent"
  },
  {
    id: "fire-boston-bar",
    name: "Boston Bar / North Bend VFD",
    type: "fire_station",
    municipality: "Boston Bar",
    region: "Fraser Valley",
    latitude: 49.8667,
    longitude: -121.4500,
    notes: "Fraser Canyon - volunteer"
  },
  {
    id: "fire-cache-creek",
    name: "Cache Creek Volunteer Fire Department",
    type: "fire_station",
    municipality: "Cache Creek",
    region: "Thompson-Nicola",
    latitude: 50.8100,
    longitude: -121.3244,
    phone: "(250) 457-9967",
    notes: "Village of Cache Creek"
  },
  {
    id: "fire-merritt",
    name: "Merritt Fire Rescue",
    type: "fire_station",
    municipality: "Merritt",
    region: "Thompson-Nicola",
    latitude: 50.1128,
    longitude: -120.7919,
    notes: "City of Merritt"
  },
  {
    id: "fire-barriere",
    name: "Barriere Fire Rescue",
    type: "fire_station",
    municipality: "Barriere",
    region: "Thompson-Nicola",
    latitude: 51.1833,
    longitude: -120.1333,
    notes: "District of Barriere"
  },
  {
    id: "fire-clearwater",
    name: "Clearwater Fire Rescue",
    type: "fire_station",
    municipality: "Clearwater",
    region: "Thompson-Nicola",
    latitude: 51.6500,
    longitude: -120.0333,
    notes: "District of Clearwater"
  },
  {
    id: "fire-100-mile-house",
    name: "100 Mile House Fire Rescue",
    type: "fire_station",
    municipality: "100 Mile House",
    region: "Cariboo",
    latitude: 51.6392,
    longitude: -121.2950,
    notes: "District of 100 Mile House"
  },
  {
    id: "fire-108-mile",
    name: "108 Mile Fire Department",
    type: "fire_station",
    municipality: "108 Mile Ranch",
    region: "Cariboo",
    latitude: 51.7333,
    longitude: -121.3667,
    notes: "CRD volunteer"
  },
  {
    id: "fire-150-mile",
    name: "150 Mile Fire Department",
    type: "fire_station",
    municipality: "150 Mile House",
    region: "Cariboo",
    latitude: 52.0500,
    longitude: -121.9333,
    notes: "CRD volunteer"
  },
  {
    id: "fire-revelstoke",
    name: "Revelstoke Fire Rescue",
    type: "fire_station",
    municipality: "Revelstoke",
    region: "Columbia-Shuswap",
    latitude: 50.9989,
    longitude: -118.1956,
    notes: "City of Revelstoke"
  },
  {
    id: "fire-golden",
    name: "Golden Fire Department",
    type: "fire_station",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    latitude: 51.2972,
    longitude: -116.9631,
    notes: "Town of Golden"
  },
  {
    id: "fire-salmon-arm",
    name: "Salmon Arm Fire Department",
    type: "fire_station",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    latitude: 50.7014,
    longitude: -119.2806,
    notes: "City of Salmon Arm"
  },
  {
    id: "fire-invermere",
    name: "Invermere Fire Rescue",
    type: "fire_station",
    municipality: "Invermere",
    region: "East Kootenay",
    latitude: 50.5064,
    longitude: -116.0322,
    notes: "District of Invermere"
  },
  {
    id: "fire-fernie",
    name: "Fernie Fire Rescue",
    type: "fire_station",
    municipality: "Fernie",
    region: "East Kootenay",
    latitude: 49.5128,
    longitude: -115.0566,
    notes: "City of Fernie"
  },
  {
    id: "fire-trail",
    name: "Trail Fire Department",
    type: "fire_station",
    municipality: "Trail",
    region: "Kootenay Boundary",
    latitude: 49.0958,
    longitude: -117.7006,
    notes: "City of Trail"
  },
  {
    id: "fire-castlegar",
    name: "Castlegar Fire Department",
    type: "fire_station",
    municipality: "Castlegar",
    region: "Central Kootenay",
    latitude: 49.3256,
    longitude: -117.6658,
    notes: "City of Castlegar"
  },
  {
    id: "fire-kaslo",
    name: "Kaslo Volunteer Fire Department",
    type: "fire_station",
    municipality: "Kaslo",
    region: "Central Kootenay",
    latitude: 49.9133,
    longitude: -116.9136,
    notes: "Village of Kaslo"
  },
  {
    id: "fire-nakusp",
    name: "Nakusp Fire Department",
    type: "fire_station",
    municipality: "Nakusp",
    region: "Central Kootenay",
    latitude: 50.2387,
    longitude: -117.7946,
    notes: "Village of Nakusp"
  },
  {
    id: "fire-grand-forks",
    name: "Grand Forks Fire Rescue",
    type: "fire_station",
    municipality: "Grand Forks",
    region: "Kootenay Boundary",
    latitude: 49.0303,
    longitude: -118.4406,
    notes: "City of Grand Forks"
  },
  {
    id: "fire-princeton",
    name: "Princeton Fire Rescue",
    type: "fire_station",
    municipality: "Princeton",
    region: "Okanagan-Similkameen",
    latitude: 49.4589,
    longitude: -120.5064,
    notes: "Town of Princeton"
  },
  {
    id: "fire-oliver",
    name: "Oliver Fire Department",
    type: "fire_station",
    municipality: "Oliver",
    region: "Okanagan-Similkameen",
    latitude: 49.1833,
    longitude: -119.5500,
    notes: "Town of Oliver"
  },
  {
    id: "fire-osoyoos",
    name: "Osoyoos Fire Department",
    type: "fire_station",
    municipality: "Osoyoos",
    region: "Okanagan-Similkameen",
    latitude: 49.0333,
    longitude: -119.4667,
    notes: "Town of Osoyoos"
  },
  {
    id: "fire-summerland",
    name: "Summerland Fire Department",
    type: "fire_station",
    municipality: "Summerland",
    region: "Okanagan-Similkameen",
    latitude: 49.5997,
    longitude: -119.6772,
    notes: "District of Summerland"
  },
  {
    id: "fire-lake-country",
    name: "Lake Country Fire Department",
    type: "fire_station",
    municipality: "Lake Country",
    region: "Central Okanagan",
    latitude: 50.0500,
    longitude: -119.4167,
    notes: "District of Lake Country"
  },
  {
    id: "fire-west-kelowna",
    name: "West Kelowna Fire Rescue",
    type: "fire_station",
    municipality: "West Kelowna",
    region: "Central Okanagan",
    latitude: 49.8622,
    longitude: -119.5833,
    notes: "City of West Kelowna"
  },
  {
    id: "fire-armstrong",
    name: "Armstrong-Spallumcheen Fire Department",
    type: "fire_station",
    municipality: "Armstrong",
    region: "North Okanagan",
    latitude: 50.4489,
    longitude: -119.1961,
    phone: "(250) 546-6708",
    notes: "Composite department"
  },
  {
    id: "fire-enderby",
    name: "Enderby Fire Department",
    type: "fire_station",
    municipality: "Enderby",
    region: "North Okanagan",
    latitude: 50.5500,
    longitude: -119.1333,
    notes: "City of Enderby"
  },
  {
    id: "fire-lumby",
    name: "Lumby Fire Department",
    type: "fire_station",
    municipality: "Lumby",
    region: "North Okanagan",
    latitude: 50.2500,
    longitude: -118.9667,
    notes: "Village of Lumby"
  },
  {
    id: "fire-mackenzie",
    name: "Mackenzie Fire Department",
    type: "fire_station",
    municipality: "Mackenzie",
    region: "Fraser-Fort George",
    latitude: 55.3378,
    longitude: -123.0942,
    notes: "District of Mackenzie"
  },
  {
    id: "fire-mcbride",
    name: "McBride Fire Department",
    type: "fire_station",
    municipality: "McBride",
    region: "Fraser-Fort George",
    latitude: 53.3000,
    longitude: -120.1667,
    notes: "Village of McBride"
  },
  {
    id: "fire-valemount",
    name: "Valemount Fire Department",
    type: "fire_station",
    municipality: "Valemount",
    region: "Fraser-Fort George",
    latitude: 52.8283,
    longitude: -119.2644,
    notes: "Village of Valemount"
  },
  {
    id: "fire-vanderhoof",
    name: "Vanderhoof Fire Department",
    type: "fire_station",
    municipality: "Vanderhoof",
    region: "Bulkley-Nechako",
    latitude: 54.0167,
    longitude: -124.0000,
    notes: "District of Vanderhoof"
  },
  {
    id: "fire-fort-st-james",
    name: "Fort St. James Fire Department",
    type: "fire_station",
    municipality: "Fort St. James",
    region: "Bulkley-Nechako",
    latitude: 54.4500,
    longitude: -124.2500,
    notes: "District of Fort St. James"
  },
  {
    id: "fire-burns-lake",
    name: "Burns Lake Fire Department",
    type: "fire_station",
    municipality: "Burns Lake",
    region: "Bulkley-Nechako",
    latitude: 54.2306,
    longitude: -125.7597,
    notes: "Village of Burns Lake"
  },
  {
    id: "fire-houston",
    name: "Houston Fire Department",
    type: "fire_station",
    municipality: "Houston",
    region: "Bulkley-Nechako",
    latitude: 54.4000,
    longitude: -126.6500,
    notes: "District of Houston"
  },
  {
    id: "fire-smithers",
    name: "Smithers Fire Department",
    type: "fire_station",
    municipality: "Smithers",
    region: "Bulkley-Nechako",
    latitude: 54.7806,
    longitude: -127.1667,
    notes: "Town of Smithers"
  },
  {
    id: "fire-hazelton",
    name: "Hazelton Fire Department",
    type: "fire_station",
    municipality: "Hazelton",
    region: "Kitimat-Stikine",
    latitude: 55.2500,
    longitude: -127.6667,
    notes: "Village of Hazelton"
  },
  {
    id: "fire-kitimat",
    name: "Kitimat Fire Department",
    type: "fire_station",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    latitude: 54.0519,
    longitude: -128.6542,
    notes: "District of Kitimat"
  },
  {
    id: "fire-stewart",
    name: "Stewart Fire Department",
    type: "fire_station",
    municipality: "Stewart",
    region: "Kitimat-Stikine",
    latitude: 55.9361,
    longitude: -130.0053,
    notes: "District of Stewart"
  },
  {
    id: "fire-fort-nelson",
    name: "Fort Nelson Fire Department",
    type: "fire_station",
    municipality: "Fort Nelson",
    region: "Northern Rockies",
    latitude: 58.8050,
    longitude: -122.6972,
    notes: "Northern Rockies Regional Municipality"
  },
  {
    id: "fire-chetwynd",
    name: "Chetwynd Fire Department",
    type: "fire_station",
    municipality: "Chetwynd",
    region: "Peace River",
    latitude: 55.6997,
    longitude: -121.6333,
    notes: "District of Chetwynd"
  },
  {
    id: "fire-hudson-hope",
    name: "Hudson's Hope Fire Department",
    type: "fire_station",
    municipality: "Hudson's Hope",
    region: "Peace River",
    latitude: 56.0333,
    longitude: -121.9000,
    notes: "District of Hudson's Hope"
  },
  {
    id: "fire-tumbler-ridge",
    name: "Tumbler Ridge Fire Department",
    type: "fire_station",
    municipality: "Tumbler Ridge",
    region: "Peace River",
    latitude: 55.1294,
    longitude: -121.0011,
    notes: "District of Tumbler Ridge"
  },
  {
    id: "fire-pouce-coupe",
    name: "Pouce Coupe Fire Department",
    type: "fire_station",
    municipality: "Pouce Coupe",
    region: "Peace River",
    latitude: 55.7167,
    longitude: -120.1333,
    notes: "Village of Pouce Coupe"
  },
  {
    id: "fire-atlin",
    name: "Atlin Fire Department",
    type: "fire_station",
    municipality: "Atlin",
    region: "Stikine",
    latitude: 59.5706,
    longitude: -133.6925,
    notes: "Atlin Community Improvement District"
  },
  {
    id: "fire-port-clements",
    name: "Port Clements Fire Department",
    type: "fire_station",
    municipality: "Port Clements",
    region: "North Coast",
    latitude: 53.6833,
    longitude: -132.1833,
    notes: "Haida Gwaii"
  },
  {
    id: "fire-sandspit",
    name: "Sandspit Fire Department",
    type: "fire_station",
    municipality: "Sandspit",
    region: "North Coast",
    latitude: 53.2500,
    longitude: -131.8167,
    notes: "Haida Gwaii"
  },
  {
    id: "fire-queen-charlotte",
    name: "Queen Charlotte Fire Department",
    type: "fire_station",
    municipality: "Queen Charlotte",
    region: "North Coast",
    latitude: 53.2522,
    longitude: -132.0756,
    notes: "Haida Gwaii"
  },
  {
    id: "fire-port-edward",
    name: "Port Edward Fire Department",
    type: "fire_station",
    municipality: "Port Edward",
    region: "North Coast",
    latitude: 54.2333,
    longitude: -130.2833,
    notes: "District of Port Edward"
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

export function getEmergencyServicesByMunicipality(municipalityName: string): EmergencyService[] {
  const searchName = municipalityName.toLowerCase();
  return BC_EMERGENCY_SERVICES.filter(s => 
    s.municipality.toLowerCase() === searchName ||
    s.municipality.toLowerCase().includes(searchName) ||
    searchName.includes(s.municipality.toLowerCase())
  );
}

export function getNearestEmergencyServices(
  lat: number, 
  lon: number, 
  count: number = 5,
  typeFilter?: EmergencyServiceType[]
): { service: EmergencyService; distance_km: number }[] {
  let cc_services = BC_EMERGENCY_SERVICES;
  
  if (typeFilter && typeFilter.length > 0) {
    cc_services = cc_services.filter(s => typeFilter.includes(s.type));
  }
  
  const withDistances = cc_services.map(service => ({
    service,
    distance_km: calculateDistance(lat, lon, service.latitude, service.longitude)
  }));
  
  withDistances.sort((a, b) => a.distance_km - b.distance_km);
  
  return withDistances.slice(0, count);
}

export function getHospitalsWithHelipads(): EmergencyService[] {
  return BC_EMERGENCY_SERVICES.filter(s => 
    s.type === 'hospital' && s.has_helipad
  );
}

export function getTraumaCentres(): EmergencyService[] {
  return BC_EMERGENCY_SERVICES.filter(s => 
    s.type === 'hospital' && s.is_trauma_centre
  );
}
