/**
 * BC Taxi Services Dataset
 * Comprehensive list of taxi companies across British Columbia
 * All coordinates in WGS84 (lat/lng)
 * Tier 3 MOBILITY: Community movement cc_services
 */

export type TaxiServiceType =
  | "taxi"           // Traditional taxi service
  | "accessible"     // Wheelchair accessible service
  | "eco"            // Eco-friendly/hybrid fleet
  | "airport";       // Airport specialty service

export interface TaxiService {
  id: string;
  name: string;
  type: TaxiServiceType;
  municipality: string;
  region: string;
  base_location: {
    address?: string;
    lat: number;
    lng: number;
  };
  service_area: string[];
  fleet_size?: string;
  phone?: string;
  website?: string;
  app_available?: boolean;
  wheelchair_accessible?: boolean;
  notes?: string;
}

export const BC_TAXI_SERVICES: TaxiService[] = [
  // ============================================================================
  // METRO VANCOUVER
  // ============================================================================
  {
    id: "yellow-cab-vancouver",
    name: "Yellow Cab Vancouver",
    type: "taxi",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    base_location: {
      address: "808 West 14th Ave, Vancouver",
      lat: 49.2610,
      lng: -123.1207
    },
    service_area: ["Vancouver", "Burnaby", "Richmond", "North Vancouver", "West Vancouver", "New Westminster"],
    fleet_size: "408 taxis",
    phone: "(604) 681-1111",
    website: "https://www.yellowcabonline.com",
    app_available: true,
    wheelchair_accessible: true,
    notes: "Largest fleet in Vancouver, operating since 1921. 63 wheelchair accessible vans, 345+ hybrid vehicles. Uses eCab app."
  },
  {
    id: "black-top-checker-cabs",
    name: "Black Top & Checker Cabs",
    type: "taxi",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    base_location: {
      address: "Vancouver",
      lat: 49.2827,
      lng: -123.1207
    },
    service_area: ["Vancouver", "Burnaby", "Richmond"],
    phone: "(604) 731-1111",
    website: "https://btccabs.ca",
    app_available: true,
    wheelchair_accessible: true,
    notes: "Operating 80+ years. Uses eCab app for reservation."
  },
  {
    id: "maclures-cabs",
    name: "MacLure's Cabs",
    type: "taxi",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    base_location: {
      address: "Vancouver",
      lat: 49.2827,
      lng: -123.1207
    },
    service_area: ["Vancouver", "Burnaby", "Richmond"],
    fleet_size: "103 vehicles",
    phone: "(604) 683-6666",
    website: "https://maclurescabs.ca",
    app_available: true,
    wheelchair_accessible: true,
    notes: "Established 1911. Driver-shareholders. 15 wheelchair accessible vehicles. Uses eCab app."
  },
  {
    id: "vancouver-taxi",
    name: "Vancouver Taxi",
    type: "accessible",
    municipality: "Vancouver",
    region: "Metro Vancouver",
    base_location: {
      address: "Vancouver",
      lat: 49.2827,
      lng: -123.1207
    },
    service_area: ["Vancouver", "Burnaby", "Richmond"],
    phone: "(604) 871-1111",
    website: "https://vancouvertaxi.cab",
    app_available: true,
    wheelchair_accessible: true,
    notes: "100% wheelchair accessible fleet. Uses eCab app."
  },
  {
    id: "bonnys-taxi",
    name: "Bonny's Taxi",
    type: "taxi",
    municipality: "Burnaby",
    region: "Metro Vancouver",
    base_location: {
      address: "Burnaby",
      lat: 49.2488,
      lng: -122.9805
    },
    service_area: ["Burnaby", "Surrey", "New Westminster", "Coquitlam"],
    phone: "(604) 433-4466",
    website: "https://bonnystaxi.com",
    notes: "Suburban specialist - Burnaby, Surrey, suburbs"
  },
  {
    id: "north-shore-taxi",
    name: "North Shore Taxi",
    type: "taxi",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    base_location: {
      address: "North Vancouver",
      lat: 49.3165,
      lng: -123.0688
    },
    service_area: ["North Vancouver", "West Vancouver", "Deep Cove"],
    fleet_size: "31 vehicles",
    phone: "(604) 987-7171",
    website: "https://www.northshoretaxi.com",
    notes: "Primary North Shore service"
  },
  {
    id: "sunshine-cabs",
    name: "Sunshine Cabs",
    type: "eco",
    municipality: "North Vancouver",
    region: "Metro Vancouver",
    base_location: {
      address: "North Vancouver",
      lat: 49.3165,
      lng: -123.0688
    },
    service_area: ["North Vancouver", "West Vancouver"],
    website: "https://sunshinecabs.ca",
    notes: "Sustainability-focused North Vancouver service"
  },
  {
    id: "surdell-kennedy-taxi",
    name: "Surdell-Kennedy Taxi",
    type: "taxi",
    municipality: "Surrey",
    region: "Metro Vancouver",
    base_location: {
      address: "Surrey",
      lat: 49.1913,
      lng: -122.8490
    },
    service_area: ["Surrey", "Crescent Beach", "South Surrey", "Cloverdale", "North Delta", "Port Kells"],
    fleet_size: "96 taxis",
    phone: "(604) 581-1111",
    website: "https://www.surdelltaxi.com",
    wheelchair_accessible: true,
    notes: "Established 1900. Rates: $3.20 meter drop + $2.18/km. Pet-friendly, courier service, jump-start assistance."
  },
  {
    id: "pacific-cabs",
    name: "Pacific Cabs",
    type: "taxi",
    municipality: "Surrey",
    region: "Metro Vancouver",
    base_location: {
      address: "Surrey",
      lat: 49.1913,
      lng: -122.8490
    },
    service_area: ["Surrey", "Langley"],
    website: "https://pacificcabs.com",
    notes: "Serving Surrey and Langley"
  },
  {
    id: "newton-whalley-taxi",
    name: "Newton Whalley Taxi",
    type: "taxi",
    municipality: "Surrey",
    region: "Metro Vancouver",
    base_location: {
      address: "Surrey",
      lat: 49.2056,
      lng: -122.8537
    },
    service_area: ["Surrey", "South Surrey", "Delta", "Ladner", "Tsawwassen", "White Rock", "Cloverdale"],
    phone: "(604) 591-1111",
    website: "http://www.whalleytaxi.com",
    notes: "Covers Surrey, Delta, White Rock areas"
  },
  {
    id: "royal-city-taxi",
    name: "Royal City Taxi",
    type: "taxi",
    municipality: "New Westminster",
    region: "Metro Vancouver",
    base_location: {
      address: "New Westminster",
      lat: 49.2057,
      lng: -122.9110
    },
    service_area: ["New Westminster", "Burnaby", "Coquitlam"],
    phone: "(604) 525-3311",
    website: "https://royalcitytaxi.com",
    notes: "Primary New Westminster service"
  },
  {
    id: "kimber-cabs",
    name: "Kimber Cabs",
    type: "taxi",
    municipality: "Richmond",
    region: "Metro Vancouver",
    base_location: {
      address: "Unit 248 – 2633 Viking Way, Richmond",
      lat: 49.1666,
      lng: -123.1336
    },
    service_area: ["Richmond", "Vancouver", "Burnaby", "Airport (YVR)"],
    phone: "(604) 270-1111",
    website: "https://kimbercabs.com",
    notes: "Operating since 1989. Owner-operated. Also offers Whistler service."
  },

  // ============================================================================
  // VICTORIA / CAPITAL REGION
  // ============================================================================
  {
    id: "bluebird-cabs-victoria",
    name: "Bluebird Cabs",
    type: "taxi",
    municipality: "Victoria",
    region: "Capital",
    base_location: {
      address: "Victoria",
      lat: 48.4284,
      lng: -123.3656
    },
    service_area: ["Victoria", "Saanich", "Oak Bay", "Esquimalt", "Sidney"],
    phone: "(250) 382-2222",
    website: "https://www.taxicab.com",
    wheelchair_accessible: true,
    notes: "Computer terminals in all vehicles. Wheelchair accessible."
  },
  {
    id: "yellow-cab-victoria",
    name: "Yellow Cab of Victoria",
    type: "taxi",
    municipality: "Victoria",
    region: "Capital",
    base_location: {
      address: "Victoria",
      lat: 48.4284,
      lng: -123.3656
    },
    service_area: ["Victoria", "Saanich", "Oak Bay", "Esquimalt", "Langford"],
    phone: "(250) 381-2222",
    website: "https://www.yellowcabvictoria.com",
    wheelchair_accessible: true,
    notes: "24/7 service. Wheelchair accessible."
  },
  {
    id: "victoria-taxi",
    name: "Victoria Taxi",
    type: "taxi",
    municipality: "Victoria",
    region: "Capital",
    base_location: {
      address: "Victoria",
      lat: 48.4284,
      lng: -123.3656
    },
    service_area: ["Victoria", "Greater Victoria", "Sidney", "YYJ Airport"],
    fleet_size: "59 cars",
    website: "https://victoriataxi.com",
    notes: "Owner-operated fleet. Serves Greater Victoria and YYJ airport. Some pre-reservation available."
  },
  {
    id: "uptown-taxi",
    name: "Uptown Taxi",
    type: "taxi",
    municipality: "Victoria",
    region: "Capital",
    base_location: {
      address: "Victoria",
      lat: 48.4534,
      lng: -123.3778
    },
    service_area: ["Victoria", "Saanich", "Oak Bay"],
    phone: "(250) 888-3000",
    website: "https://www.uptowntaxi.ca",
    notes: "Top-rated Victoria taxi (5/5 reviews). Clean cabs, airport service."
  },

  // ============================================================================
  // SEA-TO-SKY / SQUAMISH-LILLOOET
  // ============================================================================
  {
    id: "whistler-taxis",
    name: "Whistler Taxis",
    type: "taxi",
    municipality: "Whistler",
    region: "Squamish-Lillooet",
    base_location: {
      address: "Whistler Village",
      lat: 50.1163,
      lng: -122.9574
    },
    service_area: ["Whistler", "Squamish", "Pemberton"],
    website: "https://whistlertaxis.ca",
    app_available: true,
    notes: "24/7 GPS dispatch. Airport transfers, hourly rentals. Mobile app available."
  },
  {
    id: "squamish-taxi",
    name: "Squamish Taxi",
    type: "taxi",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    base_location: {
      address: "Squamish",
      lat: 49.7016,
      lng: -123.1558
    },
    service_area: ["Squamish", "Britannia Beach", "Brackendale"],
    website: "https://squamishtaxi.ca",
    wheelchair_accessible: true,
    notes: "Wheelchair accessible taxis. Guarantees to beat comparable flat-rates."
  },

  // ============================================================================
  // FRASER VALLEY
  // ============================================================================
  {
    id: "chilliwack-taxi",
    name: "Chilliwack Taxi",
    type: "taxi",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    base_location: {
      address: "Chilliwack",
      lat: 49.1579,
      lng: -121.9514
    },
    service_area: ["Chilliwack", "Sardis", "Yarrow", "Rosedale"],
    fleet_size: "31+ taxis",
    phone: "(604) 795-9111",
    website: "https://www.chilliwacktaxi.com",
    app_available: true,
    wheelchair_accessible: true,
    notes: "65+ years in service. Mobile app with GPS tracking."
  },
  {
    id: "cheam-taxi",
    name: "Cheam Taxi",
    type: "taxi",
    municipality: "Chilliwack",
    region: "Fraser Valley",
    base_location: {
      address: "Chilliwack",
      lat: 49.1579,
      lng: -121.9514
    },
    service_area: ["Chilliwack", "Agassiz", "Harrison Hot Springs"],
    website: "https://www.cheamtaxi.com",
    notes: "Fast service. Airport service (YVR, YXX)."
  },

  // ============================================================================
  // OKANAGAN
  // ============================================================================
  {
    id: "kelowna-cabs",
    name: "Kelowna Cabs",
    type: "taxi",
    municipality: "Kelowna",
    region: "Central Okanagan",
    base_location: {
      address: "Kelowna",
      lat: 49.8863,
      lng: -119.4966
    },
    service_area: ["Kelowna", "West Kelowna", "Lake Country"],
    phone: "(250) 762-2222",
    website: "https://www.kelownacabs.ca",
    wheelchair_accessible: true,
    notes: "Online reservation available. Wheelchair accessible."
  },
  {
    id: "checkmate-cabs",
    name: "Checkmate Cabs",
    type: "taxi",
    municipality: "Kelowna",
    region: "Central Okanagan",
    base_location: {
      address: "Kelowna",
      lat: 49.8863,
      lng: -119.4966
    },
    service_area: ["Kelowna", "West Kelowna", "Westbank"],
    phone: "(250) 861-1111",
    website: "https://www.checkmatecabs.com",
    wheelchair_accessible: true,
    notes: "Family owned since 1989. 24/7 service. Wine tours available."
  },
  {
    id: "current-taxi",
    name: "Current Taxi",
    type: "eco",
    municipality: "Kelowna",
    region: "Central Okanagan",
    base_location: {
      address: "Kelowna",
      lat: 49.8863,
      lng: -119.4966
    },
    service_area: ["Kelowna", "West Kelowna"],
    phone: "(250) 864-8294",
    website: "https://currenttaxi.ca",
    app_available: true,
    notes: "Electric Tesla fleet. Eco-friendly. App-based reservation."
  },
  {
    id: "west-cabs",
    name: "West Cabs",
    type: "taxi",
    municipality: "West Kelowna",
    region: "Central Okanagan",
    base_location: {
      address: "West Kelowna",
      lat: 49.8625,
      lng: -119.5833
    },
    service_area: ["West Kelowna", "Westbank", "Peachland"],
    website: "https://www.westcabs.ca",
    notes: "West Kelowna based service"
  },
  {
    id: "penticton-taxi",
    name: "Penticton Taxi",
    type: "taxi",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    base_location: {
      address: "Penticton",
      lat: 49.4991,
      lng: -119.5937
    },
    service_area: ["Penticton", "Summerland", "Naramata", "Okanagan Falls"],
    phone: "(250) 492-5555",
    website: "https://pentictontaxi.ca",
    app_available: true,
    wheelchair_accessible: true,
    notes: "24/7 service. Mobile app available. Roadside assistance, drive-your-car-home service."
  },
  {
    id: "eco-taxi-penticton",
    name: "Eco Taxi Penticton",
    type: "eco",
    municipality: "Penticton",
    region: "Okanagan-Similkameen",
    base_location: {
      address: "102 Adamson Crt, Penticton",
      lat: 49.4991,
      lng: -119.5937
    },
    service_area: ["Penticton", "Summerland", "Naramata", "Kelowna Airport"],
    phone: "(250) 493-9999",
    website: "http://ecotaxipenticton.ca",
    wheelchair_accessible: true,
    notes: "Smoke-free hybrid vehicles (Toyota Prius). Wine tours. 24/7 service."
  },

  // ============================================================================
  // KAMLOOPS / THOMPSON-NICOLA
  // ============================================================================
  {
    id: "kami-cabs",
    name: "Kami Cabs",
    type: "eco",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    base_location: {
      address: "Kamloops",
      lat: 50.6745,
      lng: -120.3273
    },
    service_area: ["Kamloops", "Sun Peaks", "Chase"],
    fleet_size: "34 vehicles",
    website: "https://kamicabs.ca",
    notes: "Established 1973. Hybrid Prius fleet. 24/7 service. Airport service, long distance."
  },
  {
    id: "yellow-cabs-kamloops",
    name: "Yellow Cabs Kamloops",
    type: "taxi",
    municipality: "Kamloops",
    region: "Thompson-Nicola",
    base_location: {
      address: "Kamloops",
      lat: 50.6745,
      lng: -120.3273
    },
    service_area: ["Kamloops"],
    phone: "(250) 374-3333",
    website: "https://www.yellowcabs.ca",
    notes: "Airport service, city tours, senior discount"
  },

  // ============================================================================
  // PRINCE GEORGE / CARIBOO
  // ============================================================================
  {
    id: "prince-george-taxi",
    name: "Prince George Taxi",
    type: "taxi",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    base_location: {
      address: "331 1st Avenue, Prince George",
      lat: 53.9171,
      lng: -122.7497
    },
    service_area: ["Prince George", "Hart", "College Heights"],
    fleet_size: "65 taxis",
    phone: "(250) 564-4444",
    website: "https://pgtaxi.ca",
    app_available: true,
    wheelchair_accessible: true,
    notes: "Operating since 1964. GPS dispatch. Battery boost service. 24/7."
  },
  {
    id: "emerald-taxi-pg",
    name: "Emerald Taxi",
    type: "taxi",
    municipality: "Prince George",
    region: "Fraser-Fort George",
    base_location: {
      address: "Prince George",
      lat: 53.9171,
      lng: -122.7497
    },
    service_area: ["Prince George"],
    website: "http://emeraldtaxiltd.ca",
    notes: "28+ years in service. GPS-equipped fleet, computer dispatch."
  },

  // ============================================================================
  // NANAIMO / CENTRAL VANCOUVER ISLAND
  // ============================================================================
  {
    id: "ac-taxi-nanaimo",
    name: "A.C. Taxi",
    type: "taxi",
    municipality: "Nanaimo",
    region: "Nanaimo",
    base_location: {
      address: "Nanaimo",
      lat: 49.1659,
      lng: -123.9401
    },
    service_area: ["Nanaimo", "Lantzville", "Cedar", "Chase River"],
    phone: "(250) 753-1231",
    website: "http://actaxi.ca",
    wheelchair_accessible: true,
    notes: "Largest taxi company in Nanaimo. 25+ years service. Ferry/airport service."
  },
  {
    id: "yellow-cab-nanaimo",
    name: "Yellow Cab Nanaimo",
    type: "taxi",
    municipality: "Nanaimo",
    region: "Nanaimo",
    base_location: {
      address: "Nanaimo",
      lat: 49.1659,
      lng: -123.9401
    },
    service_area: ["Nanaimo", "Departure Bay", "Woodgrove"],
    website: "https://www.nanaimotaxi.ca",
    app_available: true,
    notes: "Swiftsure Taxi Co Ltd. App and online reservation available."
  },
  {
    id: "nanaimo-taxi-cab",
    name: "Nanaimo Taxi Cab",
    type: "taxi",
    municipality: "Nanaimo",
    region: "Nanaimo",
    base_location: {
      address: "Nanaimo",
      lat: 49.1659,
      lng: -123.9401
    },
    service_area: ["Nanaimo", "Ladysmith", "Parksville"],
    phone: "1-800-753-1231",
    website: "https://www.nanaimotaxicab.ca",
    wheelchair_accessible: true,
    notes: "50+ years in business. Airport & ferry transfers."
  },

  // ============================================================================
  // CAMPBELL RIVER / NORTH ISLAND
  // ============================================================================
  {
    id: "bee-line-taxi",
    name: "Bee Line Taxi",
    type: "taxi",
    municipality: "Campbell River",
    region: "Strathcona",
    base_location: {
      address: "560D 11th Ave, Campbell River",
      lat: 50.0244,
      lng: -125.2475
    },
    service_area: ["Campbell River", "Black Creek", "Quathiaski Cove"],
    phone: "(250) 286-7408",
    website: "https://www.taxibeeline.ca",
    notes: "Operating since 1982. Longest-serving taxi in Campbell River. 24/7. Parcel delivery. Taxi vans for 5-6 passengers."
  },

  // ============================================================================
  // COMOX VALLEY
  // ============================================================================
  {
    id: "comox-taxi",
    name: "Comox Taxi",
    type: "eco",
    municipality: "Courtenay",
    region: "Comox Valley",
    base_location: {
      address: "1199 Braidwood Road, Courtenay",
      lat: 49.6879,
      lng: -124.9941
    },
    service_area: ["Courtenay", "Comox", "Cumberland", "Royston"],
    phone: "(250) 339-7955",
    website: "https://www.comoxtaxi.com",
    wheelchair_accessible: true,
    notes: "Eco-friendly Toyota Prius fleet since 2015. 24/7, 365 days. Book wheelchair accessible 24 hours ahead."
  },
  {
    id: "ambassador-shuttle",
    name: "Ambassador Shuttle Service",
    type: "airport",
    municipality: "Courtenay",
    region: "Comox Valley",
    base_location: {
      address: "Courtenay",
      lat: 49.6879,
      lng: -124.9941
    },
    service_area: ["Courtenay", "Comox", "Cumberland", "Comox Airport (YQQ)"],
    website: "https://ambassadortransportation.net",
    notes: "Specializes in airport shuttles"
  },

  // ============================================================================
  // FRASER VALLEY - ABBOTSFORD / LANGLEY / MISSION
  // ============================================================================
  {
    id: "abbotsford-mission-taxi",
    name: "Abbotsford Mission Taxi",
    type: "taxi",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    base_location: {
      address: "Abbotsford",
      lat: 49.0504,
      lng: -122.3045
    },
    service_area: ["Abbotsford", "Mission", "Matsqui", "Clearbrook"],
    phone: "(604) 853-8888",
    website: "https://abbotsfordmissiontaxi.com",
    app_available: true,
    notes: "Operating since 1955. 5-10 min response. Flat rates, no surge pricing."
  },
  {
    id: "central-valley-taxi",
    name: "Central Valley Taxi",
    type: "taxi",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    base_location: {
      address: "Abbotsford",
      lat: 49.0504,
      lng: -122.3045
    },
    service_area: ["Abbotsford", "Clearbrook", "YXX Airport"],
    phone: "(604) 859-1111",
    website: "https://centralvalleytaxiltd.com",
    notes: "Airport transfers, experienced local drivers."
  },
  {
    id: "yellow-top-taxi",
    name: "Yellow Top Taxi",
    type: "taxi",
    municipality: "Abbotsford",
    region: "Fraser Valley",
    base_location: {
      address: "Abbotsford",
      lat: 49.0504,
      lng: -122.3045
    },
    service_area: ["Abbotsford", "Mission"],
    phone: "(778) 480-8008",
    website: "https://yellowtoptaxi.ca",
    app_available: true,
    notes: "Mobile app (iOS/Android). No surge pricing. Corporate transport."
  },
  {
    id: "mission-taxi",
    name: "Mission Taxi (1980) Ltd",
    type: "taxi",
    municipality: "Mission",
    region: "Fraser Valley",
    base_location: {
      address: "Mission",
      lat: 49.1329,
      lng: -122.3095
    },
    service_area: ["Mission", "Hatzic", "Dewdney"],
    phone: "(604) 826-7155",
    notes: "Serving Mission since 1980."
  },
  {
    id: "aldergrove-langley-taxi",
    name: "Aldergrove-Langley Taxi",
    type: "taxi",
    municipality: "Langley",
    region: "Fraser Valley",
    base_location: {
      address: "Langley",
      lat: 49.1044,
      lng: -122.6608
    },
    service_area: ["Langley", "Aldergrove", "Fort Langley", "Walnut Grove"],
    phone: "(604) 530-4444",
    website: "https://langleytaxi.ca",
    app_available: true,
    notes: "24/7 service. City tours, airport transfers, special occasions."
  },
  {
    id: "langley-cabs",
    name: "Langley Cabs",
    type: "taxi",
    municipality: "Langley",
    region: "Fraser Valley",
    base_location: {
      address: "Langley",
      lat: 49.1044,
      lng: -122.6608
    },
    service_area: ["Langley", "Surrey"],
    phone: "(604) 533-3333",
    notes: "Established Langley provider."
  },
  {
    id: "maple-ridge-taxi",
    name: "Maple Ridge Taxi",
    type: "taxi",
    municipality: "Maple Ridge",
    region: "Fraser Valley",
    base_location: {
      address: "Maple Ridge",
      lat: 49.2193,
      lng: -122.5984
    },
    service_area: ["Maple Ridge", "Pitt Meadows", "Mission"],
    phone: "(604) 463-8888",
    notes: "Serving Maple Ridge and Pitt Meadows."
  },
  {
    id: "hope-taxi",
    name: "Hope Taxi",
    type: "taxi",
    municipality: "Hope",
    region: "Fraser Valley",
    base_location: {
      address: "Hope",
      lat: 49.3858,
      lng: -121.4419
    },
    service_area: ["Hope", "Yale", "Boston Bar"],
    phone: "(604) 869-5501",
    notes: "Serving Hope and Fraser Canyon."
  },

  // ============================================================================
  // KOOTENAYS
  // ============================================================================
  {
    id: "glacier-cabs-nelson",
    name: "Glacier Cabs",
    type: "taxi",
    municipality: "Nelson",
    region: "Central Kootenay",
    base_location: {
      address: "593 Baker Street, Nelson",
      lat: 49.4928,
      lng: -117.2948
    },
    service_area: ["Nelson", "Castlegar", "Trail", "Salmo"],
    phone: "(250) 354-1111",
    website: "https://glaciercabs.ca",
    wheelchair_accessible: true,
    notes: "24/7 service. Express courier, beverage delivery, long-distance, wheelchair accessible van."
  },
  {
    id: "star-taxi-cranbrook",
    name: "Star Taxi",
    type: "taxi",
    municipality: "Cranbrook",
    region: "East Kootenay",
    base_location: {
      address: "911 Kootenay Street North, Cranbrook",
      lat: 49.5097,
      lng: -115.7687
    },
    service_area: ["Cranbrook", "Kimberley", "Creston", "Fernie", "Invermere"],
    phone: "(250) 426-5511",
    website: "https://startaxicranbrook.ca",
    notes: "Since 1985. 24/7. Airport shuttle (YXC). Long haul. Roadside assistance."
  },
  {
    id: "key-city-cabs-cranbrook",
    name: "Key City Cabs",
    type: "taxi",
    municipality: "Cranbrook",
    region: "East Kootenay",
    base_location: {
      address: "113 5th Avenue S, Cranbrook",
      lat: 49.5097,
      lng: -115.7687
    },
    service_area: ["Cranbrook", "Kimberley"],
    phone: "(250) 426-1111",
    website: "https://keycitycabscranbrook.ca",
    notes: "24/7 service. Airport transportation."
  },
  {
    id: "kootenay-taxi-fernie",
    name: "Kootenay Taxi",
    type: "taxi",
    municipality: "Fernie",
    region: "East Kootenay",
    base_location: {
      address: "Fernie",
      lat: 49.5040,
      lng: -115.0631
    },
    service_area: ["Fernie", "Fernie Alpine Resort", "Sparwood"],
    phone: "(250) 423-4409",
    notes: "Local Fernie service."
  },
  {
    id: "tunnel49-fernie",
    name: "Tunnel49 / Fernie Taxi",
    type: "taxi",
    municipality: "Fernie",
    region: "East Kootenay",
    base_location: {
      address: "100-802 BC-3, Fernie",
      lat: 49.5040,
      lng: -115.0631
    },
    service_area: ["Fernie", "Fernie Alpine Resort"],
    phone: "(250) 423-5008",
    website: "https://t49.ca/fernie-taxi/",
    notes: "10-passenger van. $80 + GST per half hour."
  },
  {
    id: "mount-7-taxi-golden",
    name: "Mount 7 Taxi",
    type: "taxi",
    municipality: "Golden",
    region: "Columbia-Shuswap",
    base_location: {
      address: "801 10th Ave S, Golden",
      lat: 51.2985,
      lng: -116.9631
    },
    service_area: ["Golden", "Kicking Horse", "Field"],
    notes: "Operating since 1977. BC Safety Council member. Licensed BC & Alberta."
  },

  // ============================================================================
  // NORTHERN BC - TERRACE / KITIMAT / PRINCE RUPERT
  // ============================================================================
  {
    id: "kalum-kabs-terrace",
    name: "Kalum Kabs",
    type: "taxi",
    municipality: "Terrace",
    region: "Kitimat-Stikine",
    base_location: {
      address: "4449 Lakelse Ave, Terrace",
      lat: 54.5182,
      lng: -128.6037
    },
    service_area: ["Terrace", "Thornhill", "Northwest BC Regional Airport (YXT)"],
    phone: "(250) 635-7177",
    notes: "24/7 service. Serving area for 50+ years."
  },
  {
    id: "kitimat-taxi",
    name: "Kitimat Taxi Co.",
    type: "taxi",
    municipality: "Kitimat",
    region: "Kitimat-Stikine",
    base_location: {
      address: "Kitimat",
      lat: 54.0523,
      lng: -128.6537
    },
    service_area: ["Kitimat", "Terrace"],
    phone: "(250) 632-2100",
    website: "https://kitimattaxi.ca",
    notes: "Services Kitimat and Terrace area."
  },
  {
    id: "skeena-taxi-prince-rupert",
    name: "Skeena Taxi",
    type: "accessible",
    municipality: "Prince Rupert",
    region: "North Coast",
    base_location: {
      address: "Prince Rupert",
      lat: 54.3150,
      lng: -130.3208
    },
    service_area: ["Prince Rupert", "Port Edward"],
    website: "https://skeenataxi.com",
    app_available: true,
    wheelchair_accessible: true,
    notes: "Mobile app (Android/iPhone). 3 wheelchair-accessible vehicles. IVR reservation."
  },

  // ============================================================================
  // NORTHERN BC - PEACE RIVER / FORT ST. JOHN / DAWSON CREEK
  // ============================================================================
  {
    id: "teco-taxi-fsj",
    name: "Teco Taxi",
    type: "taxi",
    municipality: "Fort St. John",
    region: "Peace River",
    base_location: {
      address: "9415 100 Ave, Fort St. John",
      lat: 56.2465,
      lng: -120.8476
    },
    service_area: ["Fort St. John", "Taylor", "Charlie Lake"],
    phone: "(250) 787-0641",
    website: "https://tecotaxi.ca",
    wheelchair_accessible: true,
    notes: "24/7 service. Wheelchair accessible. Airport taxi."
  },
  {
    id: "fort-st-john-cabs",
    name: "Fort St. John Cabs",
    type: "taxi",
    municipality: "Fort St. John",
    region: "Peace River",
    base_location: {
      address: "Fort St. John",
      lat: 56.2465,
      lng: -120.8476
    },
    service_area: ["Fort St. John", "Dawson Creek"],
    phone: "(250) 785-8294",
    notes: "Established local service. Long-distance to Dawson Creek."
  },
  {
    id: "energetic-taxi-fsj",
    name: "Energetic Taxi Cab",
    type: "taxi",
    municipality: "Fort St. John",
    region: "Peace River",
    base_location: {
      address: "104-9317 96 St, Fort St. John",
      lat: 56.2465,
      lng: -120.8476
    },
    service_area: ["Fort St. John"],
    notes: "7-seaters and minivans. Airport pickup/dropoff. Pre-reservation available."
  },

  // ============================================================================
  // CARIBOO - WILLIAMS LAKE / QUESNEL / 100 MILE HOUSE
  // ============================================================================
  {
    id: "town-taxi-williams-lake",
    name: "Town Taxi",
    type: "taxi",
    municipality: "Williams Lake",
    region: "Cariboo",
    base_location: {
      address: "Williams Lake",
      lat: 52.1417,
      lng: -122.1417
    },
    service_area: ["Williams Lake", "150 Mile House", "Cariboo-Chilcotin"],
    phone: "(250) 392-4151",
    app_available: true,
    notes: "Serving Cariboo-Chilcotin since 1987. Charter vans, deliveries, shuttle service."
  },
  {
    id: "williams-lake-taxi",
    name: "Williams Lake Taxi",
    type: "taxi",
    municipality: "Williams Lake",
    region: "Cariboo",
    base_location: {
      address: "Williams Lake",
      lat: 52.1417,
      lng: -122.1417
    },
    service_area: ["Williams Lake", "Surrounding area"],
    phone: "(778) 267-2002",
    notes: "24/7. Female drivers on request. Courier, deliveries."
  },
  {
    id: "cariboo-taxi-quesnel",
    name: "Cariboo Taxi",
    type: "taxi",
    municipality: "Quesnel",
    region: "Cariboo",
    base_location: {
      address: "151 Baker Cres, Quesnel",
      lat: 52.9784,
      lng: -122.4927
    },
    service_area: ["Quesnel", "Quesnel area"],
    phone: "(250) 991-0007",
    website: "https://www.caribootaxi.com",
    notes: "Since 2000. Corporate & private transport. 24/7. Interstate journeys."
  },
  {
    id: "quesnel-taxi",
    name: "Quesnel Taxi",
    type: "taxi",
    municipality: "Quesnel",
    region: "Cariboo",
    base_location: {
      address: "Quesnel",
      lat: 52.9784,
      lng: -122.4927
    },
    service_area: ["Quesnel"],
    phone: "(250) 985-1333",
    notes: "Serves Quesnel and area."
  },

  // ============================================================================
  // OKANAGAN - VERNON / SALMON ARM / REVELSTOKE
  // ============================================================================
  {
    id: "vernon-taxi",
    name: "Vernon Taxi",
    type: "taxi",
    municipality: "Vernon",
    region: "North Okanagan",
    base_location: {
      address: "2701A 35 Street, Vernon",
      lat: 50.2670,
      lng: -119.2720
    },
    service_area: ["Vernon", "Coldstream", "Armstrong", "Enderby"],
    phone: "(250) 545-3337",
    website: "https://www.vernontaxi.com",
    wheelchair_accessible: true,
    notes: "Locally owned 30+ years. Wheelchair accessible. Airport transportation."
  },
  {
    id: "salmon-arm-taxi",
    name: "Salmon Arm Taxi",
    type: "taxi",
    municipality: "Salmon Arm",
    region: "Columbia-Shuswap",
    base_location: {
      address: "875 Lakeshore Dr SW, Salmon Arm",
      lat: 50.7019,
      lng: -119.2908
    },
    service_area: ["Salmon Arm", "Sicamous", "Enderby"],
    phone: "(250) 803-6677",
    website: "https://salmonarmtaxi.ca",
    notes: "24/7. Delivery, roadside assistance, battery boost. Cloud-based dispatch."
  },
  {
    id: "kelowna-eco-taxi",
    name: "Kelowna Eco Taxi",
    type: "eco",
    municipality: "Kelowna",
    region: "Central Okanagan",
    base_location: {
      address: "Kelowna",
      lat: 49.8863,
      lng: -119.4966
    },
    service_area: ["Kelowna", "Rutland"],
    phone: "(250) 860-6666",
    notes: "Eco-friendly transportation."
  },

  // ============================================================================
  // VANCOUVER ISLAND - DUNCAN / PORT ALBERNI / TOFINO / LADYSMITH
  // ============================================================================
  {
    id: "ladysmith-gotaxi",
    name: "Ladysmith GoTaxi",
    type: "taxi",
    municipality: "Ladysmith",
    region: "Cowichan Valley",
    base_location: {
      address: "Ladysmith",
      lat: 48.9975,
      lng: -123.8181
    },
    service_area: ["Ladysmith", "Chemainus", "Duncan"],
    phone: "(250) 324-2231",
    notes: "Serves Duncan, Ladysmith, Chemainus area."
  },
  {
    id: "go-taxi-chemainus",
    name: "Go Taxi Chemainus",
    type: "taxi",
    municipality: "Chemainus",
    region: "Cowichan Valley",
    base_location: {
      address: "Chemainus",
      lat: 48.9261,
      lng: -123.7147
    },
    service_area: ["Chemainus", "Duncan", "Ladysmith"],
    phone: "(250) 324-8294",
    notes: "Serves Duncan region."
  },
  {
    id: "united-cabs-port-alberni",
    name: "United Cabs",
    type: "taxi",
    municipality: "Port Alberni",
    region: "Alberni-Clayoquot",
    base_location: {
      address: "Port Alberni",
      lat: 49.2339,
      lng: -124.8055
    },
    service_area: ["Port Alberni", "Sproat Lake"],
    phone: "(250) 723-2121",
    notes: "Local Port Alberni service."
  },
  {
    id: "tofino-taxi",
    name: "Tofino Taxi",
    type: "taxi",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    base_location: {
      address: "Tofino",
      lat: 49.1530,
      lng: -125.9066
    },
    service_area: ["Tofino", "Long Beach", "Pacific Rim"],
    phone: "(250) 725-3333",
    notes: "Cash-only service."
  },
  {
    id: "ucluelet-taxi",
    name: "Ucluelet Taxi",
    type: "taxi",
    municipality: "Ucluelet",
    region: "Alberni-Clayoquot",
    base_location: {
      address: "Ucluelet",
      lat: 48.9419,
      lng: -125.5466
    },
    service_area: ["Ucluelet", "Pacific Rim"],
    phone: "(250) 726-4415",
    notes: "Serves Ucluelet and surrounding area."
  },
  {
    id: "pacific-rim-navigators",
    name: "Pacific Rim Navigators",
    type: "taxi",
    municipality: "Tofino",
    region: "Alberni-Clayoquot",
    base_location: {
      address: "Tofino",
      lat: 49.1530,
      lng: -125.9066
    },
    service_area: ["Tofino", "Ucluelet", "Pacific Rim"],
    phone: "(250) 725-8393",
    notes: "Shuttle and private car service."
  },

  // ============================================================================
  // VICTORIA REGION - SIDNEY / SOOKE / WESTSHORE
  // ============================================================================
  {
    id: "sidney-taxi",
    name: "Sidney Taxi",
    type: "taxi",
    municipality: "Sidney",
    region: "Capital",
    base_location: {
      address: "Sidney",
      lat: 48.6500,
      lng: -123.3986
    },
    service_area: ["Sidney", "North Saanich", "YYJ Airport", "Swartz Bay Ferry"],
    notes: "Serves Sidney and Saanich Peninsula."
  },
  {
    id: "peninsula-taxi",
    name: "Peninsula Taxi",
    type: "taxi",
    municipality: "Sidney",
    region: "Capital",
    base_location: {
      address: "Sidney",
      lat: 48.6500,
      lng: -123.3986
    },
    service_area: ["Sidney", "North Saanich", "Central Saanich"],
    notes: "Saanich Peninsula service."
  },
  {
    id: "westshore-taxi",
    name: "Westshore Taxi",
    type: "taxi",
    municipality: "Langford",
    region: "Capital",
    base_location: {
      address: "Langford",
      lat: 48.4506,
      lng: -123.5058
    },
    service_area: ["Langford", "Colwood", "Sooke", "Metchosin", "View Royal"],
    notes: "Covers Sooke-Victoria corridor."
  },
  {
    id: "orange-taxi-victoria",
    name: "Orange Taxi",
    type: "taxi",
    municipality: "Victoria",
    region: "Capital",
    base_location: {
      address: "Victoria",
      lat: 48.4284,
      lng: -123.3656
    },
    service_area: ["Victoria", "Greater Victoria"],
    notes: "Highly rated on Yelp."
  },

  // ============================================================================
  // SUNSHINE COAST / POWELL RIVER
  // ============================================================================
  {
    id: "sechelt-taxi",
    name: "Sechelt Taxi",
    type: "eco",
    municipality: "Sechelt",
    region: "Sunshine Coast",
    base_location: {
      address: "Sechelt",
      lat: 49.4742,
      lng: -123.7545
    },
    service_area: ["Sechelt", "Gibsons", "Pender Harbour", "Earls Cove to Langdale"],
    phone: "(604) 989-8294",
    website: "https://sechelttaxi.com",
    notes: "Electric & gas vehicles. Ferry-to-ferry service. Pre-reservation recommended."
  },
  {
    id: "powell-river-taxi",
    name: "Powell River Taxi",
    type: "taxi",
    municipality: "Powell River",
    region: "Powell River",
    base_location: {
      address: "Powell River",
      lat: 49.8353,
      lng: -124.5247
    },
    service_area: ["Powell River", "Texada Island ferry"],
    phone: "(604) 483-3681",
    website: "https://powellrivertaxi.ca",
    notes: "24/7 service. Limo available."
  },
  {
    id: "howe-sound-taxi",
    name: "Howe Sound Taxi",
    type: "accessible",
    municipality: "Squamish",
    region: "Squamish-Lillooet",
    base_location: {
      address: "Squamish",
      lat: 49.7016,
      lng: -123.1558
    },
    service_area: ["Squamish", "Britannia Beach"],
    phone: "(604) 898-8888",
    website: "https://howesoundtaxi.com",
    wheelchair_accessible: true,
    notes: "Wheelchair accessible 24/7. Vans and sedans."
  },

  // ============================================================================
  // GULF ISLANDS
  // ============================================================================
  {
    id: "silver-shadow-taxi",
    name: "Silver Shadow Taxi",
    type: "taxi",
    municipality: "Salt Spring Island",
    region: "Capital",
    base_location: {
      address: "Ganges, Salt Spring Island",
      lat: 48.8547,
      lng: -123.5086
    },
    service_area: ["Salt Spring Island", "Ganges", "Fulford Harbour", "Vesuvius"],
    phone: "(250) 537-3030",
    website: "https://www.silvershadow.ca",
    notes: "4 cabs. Door-to-door service anywhere on Salt Spring."
  },
  {
    id: "salt-spring-taxi",
    name: "Salt Spring Taxi",
    type: "taxi",
    municipality: "Salt Spring Island",
    region: "Capital",
    base_location: {
      address: "Salt Spring Island",
      lat: 48.8547,
      lng: -123.5086
    },
    service_area: ["Salt Spring Island"],
    phone: "(250) 537-3030",
    notes: "Island-wide service."
  },

  // ============================================================================
  // ADDITIONAL METRO VANCOUVER
  // ============================================================================
  {
    id: "queen-city-taxi",
    name: "Queen City Taxi",
    type: "taxi",
    municipality: "New Westminster",
    region: "Metro Vancouver",
    base_location: {
      address: "New Westminster",
      lat: 49.2057,
      lng: -122.9110
    },
    service_area: ["New Westminster", "Burnaby", "Coquitlam"],
    phone: "(604) 526-1166",
    notes: "YVR licensed operator."
  },
  {
    id: "tsawwassen-taxi",
    name: "Tsawwassen Taxi",
    type: "taxi",
    municipality: "Delta",
    region: "Metro Vancouver",
    base_location: {
      address: "Tsawwassen",
      lat: 49.0068,
      lng: -123.0812
    },
    service_area: ["Tsawwassen", "Ladner", "South Delta", "BC Ferries"],
    phone: "(604) 943-1111",
    notes: "YVR licensed. BC Ferries service."
  },
  {
    id: "white-rock-south-surrey-taxi",
    name: "White Rock South Surrey Taxi",
    type: "taxi",
    municipality: "White Rock",
    region: "Metro Vancouver",
    base_location: {
      address: "White Rock",
      lat: 49.0253,
      lng: -122.8029
    },
    service_area: ["White Rock", "South Surrey", "Crescent Beach"],
    phone: "(604) 596-6666",
    notes: "YVR licensed operator."
  },
  {
    id: "coquitlam-taxi",
    name: "Coquitlam Taxi",
    type: "taxi",
    municipality: "Coquitlam",
    region: "Metro Vancouver",
    base_location: {
      address: "Coquitlam",
      lat: 49.2838,
      lng: -122.7932
    },
    service_area: ["Coquitlam", "Port Coquitlam", "Port Moody"],
    phone: "(604) 936-8888",
    notes: "Tri-Cities service."
  },
  {
    id: "delta-sunshine-taxi",
    name: "Delta Sunshine Taxi",
    type: "taxi",
    municipality: "Delta",
    region: "Metro Vancouver",
    base_location: {
      address: "Delta",
      lat: 49.0847,
      lng: -123.0587
    },
    service_area: ["Delta", "North Delta", "Ladner"],
    phone: "(604) 594-1111",
    notes: "Serving Delta."
  }
];

export const taxiServiceTypeLabels: Record<TaxiServiceType, string> = {
  taxi: "Taxi",
  accessible: "Accessible",
  eco: "Eco-Friendly",
  airport: "Airport"
};
