/**
 * BC Taxi Services Dataset
 * Comprehensive list of taxi companies across British Columbia
 * All coordinates in WGS84 (lat/lng)
 * Tier 3 MOBILITY: Community movement services
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
    notes: "Operating 80+ years. Uses eCab app for booking."
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
    notes: "Owner-operated fleet. Serves Greater Victoria and YYJ airport. Some pre-booking available."
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
    notes: "Online booking available. Wheelchair accessible."
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
    notes: "Electric Tesla fleet. Eco-friendly. App-based booking."
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
    notes: "Swiftsure Taxi Co Ltd. App and online booking available."
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
  }
];

export const taxiServiceTypeLabels: Record<TaxiServiceType, string> = {
  taxi: "Taxi",
  accessible: "Accessible",
  eco: "Eco-Friendly",
  airport: "Airport"
};
