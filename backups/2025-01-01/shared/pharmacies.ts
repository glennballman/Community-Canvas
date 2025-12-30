// BC Pharmacies Dataset
// Comprehensive pharmacy locations across British Columbia
// Includes chain pharmacies, independent pharmacies, and hospital pharmacies
// Cross-references courier services where applicable

export type PharmacyType = 
  | "chain"           // Major chain pharmacy (Shoppers, London Drugs, etc.)
  | "grocery"         // Grocery store pharmacy (Save-On, Safeway, etc.)
  | "warehouse"       // Warehouse pharmacy (Costco)
  | "independent"     // Independent community pharmacy
  | "hospital"        // Hospital outpatient pharmacy
  | "compounding";    // Specialty compounding pharmacy

export type PharmacyChain =
  | "shoppers_drug_mart"
  | "london_drugs"
  | "pharmasave"
  | "rexall"
  | "walmart"
  | "costco"
  | "save_on_foods"
  | "safeway"
  | "real_canadian_superstore"
  | "thriftys"
  | "independent"
  | "hospital";

export interface Pharmacy {
  id: string;
  name: string;
  chain: PharmacyChain;
  type: PharmacyType;
  municipality: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  courier_services?: ("canada_post" | "purolator" | "ups" | "fedex")[];
  services?: ("prescription" | "compounding" | "immunization" | "diabetes_care" | "blister_packing" | "delivery")[];
  hours_24?: boolean;
  notes?: string;
}

export const BC_PHARMACIES: Pharmacy[] = [
  // ============================================================================
  // SHOPPERS DRUG MART (Loblaw Companies)
  // Major chain with extensive Canada Post partnership
  // ============================================================================
  // Metro Vancouver - Vancouver
  { id: "sdm-vancouver-granville", name: "Shoppers Drug Mart - Granville & Broadway", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "2302 Granville St", lat: 49.2635, lng: -123.1384, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-commercial", name: "Shoppers Drug Mart - Commercial Drive", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "1650 Commercial Dr", lat: 49.2686, lng: -123.0695, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-kerrisdale", name: "Shoppers Drug Mart - Kerrisdale", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "2188 W 41st Ave", lat: 49.2335, lng: -123.1577, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-dunbar", name: "Shoppers Drug Mart - Dunbar", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "4326 Dunbar St", lat: 49.2445, lng: -123.1867, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-main", name: "Shoppers Drug Mart - Main Street", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "4088 Main St", lat: 49.2447, lng: -123.1008, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-cambie", name: "Shoppers Drug Mart - Cambie Village", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "3989 Cambie St", lat: 49.2461, lng: -123.1147, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-kitsilano", name: "Shoppers Drug Mart - Kitsilano", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "2560 W Broadway", lat: 49.2635, lng: -123.1654, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-marpole", name: "Shoppers Drug Mart - Marpole", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "8318 Granville St", lat: 49.2112, lng: -123.1384, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-joyce", name: "Shoppers Drug Mart - Joyce", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "5080 Joyce St", lat: 49.2382, lng: -123.0281, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-hastings", name: "Shoppers Drug Mart - Hastings Sunrise", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "2918 E Hastings St", lat: 49.2812, lng: -123.0389, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-robson", name: "Shoppers Drug Mart - Robson Street", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "1125 Robson St", lat: 49.2823, lng: -123.1234, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vancouver-davie", name: "Shoppers Drug Mart - Davie Street", chain: "shoppers_drug_mart", type: "chain", municipality: "Vancouver", address: "1235 Davie St", lat: 49.2778, lng: -123.1312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - Burnaby
  { id: "sdm-burnaby-metrotown", name: "Shoppers Drug Mart - Metrotown", chain: "shoppers_drug_mart", type: "chain", municipality: "Burnaby", address: "4820 Kingsway", lat: 49.2277, lng: -123.0025, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-burnaby-brentwood", name: "Shoppers Drug Mart - Brentwood", chain: "shoppers_drug_mart", type: "chain", municipality: "Burnaby", address: "4567 Lougheed Hwy", lat: 49.2683, lng: -123.0002, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-burnaby-edmonds", name: "Shoppers Drug Mart - Edmonds", chain: "shoppers_drug_mart", type: "chain", municipality: "Burnaby", address: "7155 Kingsway", lat: 49.2145, lng: -122.9567, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-burnaby-heights", name: "Shoppers Drug Mart - Burnaby Heights", chain: "shoppers_drug_mart", type: "chain", municipality: "Burnaby", address: "4012 Hastings St", lat: 49.2812, lng: -123.0134, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - Surrey
  { id: "sdm-surrey-guildford", name: "Shoppers Drug Mart - Guildford", chain: "shoppers_drug_mart", type: "chain", municipality: "Surrey", address: "10355 152nd St", lat: 49.1912, lng: -122.8012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-surrey-newton", name: "Shoppers Drug Mart - Newton", chain: "shoppers_drug_mart", type: "chain", municipality: "Surrey", address: "7380 King George Blvd", lat: 49.1289, lng: -122.8475, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-surrey-fleetwood", name: "Shoppers Drug Mart - Fleetwood", chain: "shoppers_drug_mart", type: "chain", municipality: "Surrey", address: "15910 Fraser Hwy", lat: 49.1534, lng: -122.7712, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-surrey-central", name: "Shoppers Drug Mart - Surrey Central", chain: "shoppers_drug_mart", type: "chain", municipality: "Surrey", address: "10233 King George Blvd", lat: 49.1856, lng: -122.8489, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-surrey-cloverdale", name: "Shoppers Drug Mart - Cloverdale", chain: "shoppers_drug_mart", type: "chain", municipality: "Surrey", address: "5671 176th St", lat: 49.1034, lng: -122.7312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-surrey-south", name: "Shoppers Drug Mart - South Surrey", chain: "shoppers_drug_mart", type: "chain", municipality: "Surrey", address: "2355 160th St", lat: 49.0312, lng: -122.7712, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - Richmond
  { id: "sdm-richmond-centre", name: "Shoppers Drug Mart - Richmond Centre", chain: "shoppers_drug_mart", type: "chain", municipality: "Richmond", address: "6060 Minoru Blvd", lat: 49.1666, lng: -123.1369, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-richmond-steveston", name: "Shoppers Drug Mart - Steveston", chain: "shoppers_drug_mart", type: "chain", municipality: "Richmond", address: "12051 2nd Ave", lat: 49.1289, lng: -123.1812, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-richmond-broadmoor", name: "Shoppers Drug Mart - Broadmoor", chain: "shoppers_drug_mart", type: "chain", municipality: "Richmond", address: "7771 Westminster Hwy", lat: 49.1645, lng: -123.1034, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - Coquitlam/Tri-Cities
  { id: "sdm-coquitlam-centre", name: "Shoppers Drug Mart - Coquitlam Centre", chain: "shoppers_drug_mart", type: "chain", municipality: "Coquitlam", address: "2929 Barnet Hwy", lat: 49.2744, lng: -122.7941, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-coquitlam-westwood", name: "Shoppers Drug Mart - Westwood Mall", chain: "shoppers_drug_mart", type: "chain", municipality: "Coquitlam", address: "3025 Lougheed Hwy", lat: 49.2744, lng: -122.7891, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-portcoquitlam", name: "Shoppers Drug Mart - Port Coquitlam", chain: "shoppers_drug_mart", type: "chain", municipality: "Port Coquitlam", address: "1250 Dominion Ave", lat: 49.2633, lng: -122.7531, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-portmoody", name: "Shoppers Drug Mart - Port Moody", chain: "shoppers_drug_mart", type: "chain", municipality: "Port Moody", address: "2601 St Johns St", lat: 49.2789, lng: -122.8312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - North Shore
  { id: "sdm-northvan-lonsdale", name: "Shoppers Drug Mart - Lonsdale", chain: "shoppers_drug_mart", type: "chain", municipality: "North Vancouver", address: "1277 Marine Dr", lat: 49.3132, lng: -123.0752, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-northvan-lynnvalley", name: "Shoppers Drug Mart - Lynn Valley", chain: "shoppers_drug_mart", type: "chain", municipality: "North Vancouver", address: "1199 Lynn Valley Rd", lat: 49.3396, lng: -123.0435, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-westvan-dundarave", name: "Shoppers Drug Mart - Dundarave", chain: "shoppers_drug_mart", type: "chain", municipality: "West Vancouver", address: "2459 Marine Dr", lat: 49.3351, lng: -123.1892, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - Langley/Maple Ridge
  { id: "sdm-langley-walnutgrove", name: "Shoppers Drug Mart - Walnut Grove", chain: "shoppers_drug_mart", type: "chain", municipality: "Langley", address: "20159 88th Ave", lat: 49.1515, lng: -122.6586, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-langley-willowbrook", name: "Shoppers Drug Mart - Willowbrook", chain: "shoppers_drug_mart", type: "chain", municipality: "Langley", address: "19705 Fraser Hwy", lat: 49.1126, lng: -122.6658, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-mapleridge", name: "Shoppers Drug Mart - Maple Ridge", chain: "shoppers_drug_mart", type: "chain", municipality: "Maple Ridge", address: "22709 Lougheed Hwy", lat: 49.2194, lng: -122.5978, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-mission", name: "Shoppers Drug Mart - Mission", chain: "shoppers_drug_mart", type: "chain", municipality: "Mission", address: "32530 Lougheed Hwy", lat: 49.1289, lng: -122.3089, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Metro Vancouver - Delta/White Rock
  { id: "sdm-delta-ladner", name: "Shoppers Drug Mart - Ladner", chain: "shoppers_drug_mart", type: "chain", municipality: "Delta", address: "5231 Ladner Trunk Rd", lat: 49.0889, lng: -123.0812, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-delta-tsawwassen", name: "Shoppers Drug Mart - Tsawwassen", chain: "shoppers_drug_mart", type: "chain", municipality: "Delta", address: "1215 56th St", lat: 49.0134, lng: -123.0789, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-whiterock", name: "Shoppers Drug Mart - White Rock", chain: "shoppers_drug_mart", type: "chain", municipality: "White Rock", address: "1711 152nd St", lat: 49.0189, lng: -122.8012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Fraser Valley
  { id: "sdm-abbotsford-highstreet", name: "Shoppers Drug Mart - Abbotsford Highstreet", chain: "shoppers_drug_mart", type: "chain", municipality: "Abbotsford", address: "32555 London Ave", lat: 49.0412, lng: -122.2934, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-abbotsford-clearbrook", name: "Shoppers Drug Mart - Clearbrook", chain: "shoppers_drug_mart", type: "chain", municipality: "Abbotsford", address: "2628 Clearbrook Rd", lat: 49.0534, lng: -122.3312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-chilliwack", name: "Shoppers Drug Mart - Chilliwack", chain: "shoppers_drug_mart", type: "chain", municipality: "Chilliwack", address: "45585 Luckakuck Way", lat: 49.1534, lng: -121.9512, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-hope", name: "Shoppers Drug Mart - Hope", chain: "shoppers_drug_mart", type: "chain", municipality: "Hope", address: "890 Old Hope Princeton Way", lat: 49.3812, lng: -121.4312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Vancouver Island - Victoria
  { id: "sdm-victoria-downtown", name: "Shoppers Drug Mart - Victoria Downtown", chain: "shoppers_drug_mart", type: "chain", municipality: "Victoria", address: "1222 Douglas St", lat: 49.4289, lng: -123.3689, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-victoria-hillside", name: "Shoppers Drug Mart - Hillside", chain: "shoppers_drug_mart", type: "chain", municipality: "Victoria", address: "1644 Hillside Ave", lat: 48.4389, lng: -123.3512, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-victoria-tillicum", name: "Shoppers Drug Mart - Tillicum", chain: "shoppers_drug_mart", type: "chain", municipality: "Victoria", address: "3170 Tillicum Rd", lat: 48.4512, lng: -123.3934, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-saanich-quadra", name: "Shoppers Drug Mart - Quadra", chain: "shoppers_drug_mart", type: "chain", municipality: "Saanich", address: "3995 Quadra St", lat: 48.4612, lng: -123.3612, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-sidney", name: "Shoppers Drug Mart - Sidney", chain: "shoppers_drug_mart", type: "chain", municipality: "Sidney", address: "2345 Beacon Ave", lat: 48.6489, lng: -123.3989, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-langford", name: "Shoppers Drug Mart - Langford", chain: "shoppers_drug_mart", type: "chain", municipality: "Langford", address: "2945 Jacklin Rd", lat: 48.4489, lng: -123.5012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-colwood", name: "Shoppers Drug Mart - Colwood", chain: "shoppers_drug_mart", type: "chain", municipality: "Colwood", address: "1913 Sooke Rd", lat: 48.4234, lng: -123.4912, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Vancouver Island - Nanaimo/Central
  { id: "sdm-nanaimo-downtown", name: "Shoppers Drug Mart - Nanaimo Downtown", chain: "shoppers_drug_mart", type: "chain", municipality: "Nanaimo", address: "125 Terminal Ave", lat: 49.1656, lng: -123.9367, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-nanaimo-woodgrove", name: "Shoppers Drug Mart - Woodgrove", chain: "shoppers_drug_mart", type: "chain", municipality: "Nanaimo", address: "6631 Island Hwy N", lat: 49.2234, lng: -124.0012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-parksville", name: "Shoppers Drug Mart - Parksville", chain: "shoppers_drug_mart", type: "chain", municipality: "Parksville", address: "280 E Island Hwy", lat: 49.3189, lng: -124.3112, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-courtenay", name: "Shoppers Drug Mart - Courtenay", chain: "shoppers_drug_mart", type: "chain", municipality: "Courtenay", address: "2750 Cliffe Ave", lat: 49.6834, lng: -124.9934, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-campbellriver", name: "Shoppers Drug Mart - Campbell River", chain: "shoppers_drug_mart", type: "chain", municipality: "Campbell River", address: "1400 Island Hwy", lat: 50.0189, lng: -125.2489, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-duncan", name: "Shoppers Drug Mart - Duncan", chain: "shoppers_drug_mart", type: "chain", municipality: "Duncan", address: "561 Canada Ave", lat: 48.7834, lng: -123.7089, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Okanagan
  { id: "sdm-kelowna-orchard", name: "Shoppers Drug Mart - Orchard Park", chain: "shoppers_drug_mart", type: "chain", municipality: "Kelowna", address: "2271 Harvey Ave", lat: 49.8834, lng: -119.4812, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-kelowna-mission", name: "Shoppers Drug Mart - Mission", chain: "shoppers_drug_mart", type: "chain", municipality: "Kelowna", address: "3155 Lakeshore Rd", lat: 49.8612, lng: -119.4312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-westkelowna", name: "Shoppers Drug Mart - West Kelowna", chain: "shoppers_drug_mart", type: "chain", municipality: "West Kelowna", address: "2484 Main St", lat: 49.8612, lng: -119.5812, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-penticton", name: "Shoppers Drug Mart - Penticton", chain: "shoppers_drug_mart", type: "chain", municipality: "Penticton", address: "2111 Main St", lat: 49.4889, lng: -119.5889, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-vernon", name: "Shoppers Drug Mart - Vernon", chain: "shoppers_drug_mart", type: "chain", municipality: "Vernon", address: "4400 32nd St", lat: 50.2612, lng: -119.2712, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-salmonarm", name: "Shoppers Drug Mart - Salmon Arm", chain: "shoppers_drug_mart", type: "chain", municipality: "Salmon Arm", address: "1091 Trans-Canada Hwy", lat: 50.6989, lng: -119.2712, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // BC Interior
  { id: "sdm-kamloops-columbia", name: "Shoppers Drug Mart - Columbia Place", chain: "shoppers_drug_mart", type: "chain", municipality: "Kamloops", address: "1210 Summit Dr", lat: 50.6734, lng: -120.3512, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-kamloops-aberdeen", name: "Shoppers Drug Mart - Aberdeen", chain: "shoppers_drug_mart", type: "chain", municipality: "Kamloops", address: "1320 Hugh Allan Dr", lat: 50.6989, lng: -120.3712, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-williamslake", name: "Shoppers Drug Mart - Williams Lake", chain: "shoppers_drug_mart", type: "chain", municipality: "Williams Lake", address: "1150 Broadway Ave S", lat: 52.1289, lng: -122.1412, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Northern BC
  { id: "sdm-princegeorge-pine", name: "Shoppers Drug Mart - Pine Centre", chain: "shoppers_drug_mart", type: "chain", municipality: "Prince George", address: "3055 Massey Dr", lat: 53.8856, lng: -122.8012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-princegeorge-spruceland", name: "Shoppers Drug Mart - Spruceland", chain: "shoppers_drug_mart", type: "chain", municipality: "Prince George", address: "1600 15th Ave", lat: 53.9089, lng: -122.7689, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-terrace", name: "Shoppers Drug Mart - Terrace", chain: "shoppers_drug_mart", type: "chain", municipality: "Terrace", address: "4635 Lakelse Ave", lat: 54.5134, lng: -128.5989, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Kootenays
  { id: "sdm-cranbrook", name: "Shoppers Drug Mart - Cranbrook", chain: "shoppers_drug_mart", type: "chain", municipality: "Cranbrook", address: "1600 2nd St N", lat: 49.5189, lng: -115.7689, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-nelson", name: "Shoppers Drug Mart - Nelson", chain: "shoppers_drug_mart", type: "chain", municipality: "Nelson", address: "590 Baker St", lat: 49.4934, lng: -117.2934, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-trail", name: "Shoppers Drug Mart - Trail", chain: "shoppers_drug_mart", type: "chain", municipality: "Trail", address: "1500 Bay Ave", lat: 49.0989, lng: -117.7089, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Peace Region
  { id: "sdm-fortstjohn", name: "Shoppers Drug Mart - Fort St John", chain: "shoppers_drug_mart", type: "chain", municipality: "Fort St John", address: "9815 100th St", lat: 56.2434, lng: -120.8512, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "sdm-dawsoncreek", name: "Shoppers Drug Mart - Dawson Creek", chain: "shoppers_drug_mart", type: "chain", municipality: "Dawson Creek", address: "10200 8th St", lat: 55.7634, lng: -120.2312, courier_services: ["canada_post"], services: ["prescription", "immunization"] },

  // ============================================================================
  // LONDON DRUGS
  // Western Canadian chain - also Canada Post partners
  // ============================================================================
  // Metro Vancouver
  { id: "ld-vancouver-broadway", name: "London Drugs - Broadway & Cambie", chain: "london_drugs", type: "chain", municipality: "Vancouver", address: "525 W Broadway", lat: 49.2634, lng: -123.1147, courier_services: ["canada_post"], services: ["prescription", "immunization", "compounding"] },
  { id: "ld-vancouver-oakridge", name: "London Drugs - Oakridge", chain: "london_drugs", type: "chain", municipality: "Vancouver", address: "650 W 41st Ave", lat: 49.2271, lng: -123.1166, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-vancouver-robson", name: "London Drugs - Robson Street", chain: "london_drugs", type: "chain", municipality: "Vancouver", address: "1187 Robson St", lat: 49.2823, lng: -123.1234, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-vancouver-kingsgate", name: "London Drugs - Kingsgate Mall", chain: "london_drugs", type: "chain", municipality: "Vancouver", address: "370 E Broadway", lat: 49.2634, lng: -123.0889, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-burnaby-lougheed", name: "London Drugs - Lougheed", chain: "london_drugs", type: "chain", municipality: "Burnaby", address: "9855 Austin Ave", lat: 49.2533, lng: -122.8912, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-burnaby-brentwood", name: "London Drugs - Brentwood", chain: "london_drugs", type: "chain", municipality: "Burnaby", address: "4501 North Rd", lat: 49.2683, lng: -122.9989, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-richmond-centre", name: "London Drugs - Richmond Centre", chain: "london_drugs", type: "chain", municipality: "Richmond", address: "6551 No. 3 Rd", lat: 49.1666, lng: -123.1369, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-richmond-ironwood", name: "London Drugs - Ironwood", chain: "london_drugs", type: "chain", municipality: "Richmond", address: "11666 Steveston Hwy", lat: 49.1412, lng: -123.1089, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-surrey-guildford", name: "London Drugs - Guildford", chain: "london_drugs", type: "chain", municipality: "Surrey", address: "10355 152nd St", lat: 49.1912, lng: -122.8012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-surrey-central", name: "London Drugs - Surrey Central", chain: "london_drugs", type: "chain", municipality: "Surrey", address: "10153 King George Blvd", lat: 49.1856, lng: -122.8489, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-coquitlam", name: "London Drugs - Coquitlam", chain: "london_drugs", type: "chain", municipality: "Coquitlam", address: "1163 Pinetree Way", lat: 49.2786, lng: -122.7958, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-northvan", name: "London Drugs - Marine Drive", chain: "london_drugs", type: "chain", municipality: "North Vancouver", address: "1403 Lonsdale Ave", lat: 49.3117, lng: -123.0752, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-westvan-parkroyal", name: "London Drugs - Park Royal", chain: "london_drugs", type: "chain", municipality: "West Vancouver", address: "910 Park Royal S", lat: 49.3259, lng: -123.1356, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-langley", name: "London Drugs - Langley", chain: "london_drugs", type: "chain", municipality: "Langley", address: "20202 66th Ave", lat: 49.1041, lng: -122.6586, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-abbotsford", name: "London Drugs - Abbotsford", chain: "london_drugs", type: "chain", municipality: "Abbotsford", address: "32700 S Fraser Way", lat: 49.0534, lng: -122.3212, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-newwest", name: "London Drugs - New Westminster", chain: "london_drugs", type: "chain", municipality: "New Westminster", address: "800 6th Ave", lat: 49.2089, lng: -122.9112, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Vancouver Island
  { id: "ld-victoria-downtown", name: "London Drugs - Victoria Downtown", chain: "london_drugs", type: "chain", municipality: "Victoria", address: "911 Yates St", lat: 48.4289, lng: -123.3612, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-victoria-hillside", name: "London Drugs - Hillside", chain: "london_drugs", type: "chain", municipality: "Victoria", address: "1644 Hillside Ave", lat: 48.4389, lng: -123.3512, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-victoria-uptown", name: "London Drugs - Uptown", chain: "london_drugs", type: "chain", municipality: "Victoria", address: "3130 Blanshard St", lat: 48.4512, lng: -123.3589, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-nanaimo", name: "London Drugs - Nanaimo", chain: "london_drugs", type: "chain", municipality: "Nanaimo", address: "6801 Island Hwy N", lat: 49.2234, lng: -124.0012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-courtenay", name: "London Drugs - Courtenay", chain: "london_drugs", type: "chain", municipality: "Courtenay", address: "3200 Island Hwy N", lat: 49.6912, lng: -125.0089, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Okanagan & Interior
  { id: "ld-kelowna", name: "London Drugs - Kelowna", chain: "london_drugs", type: "chain", municipality: "Kelowna", address: "565 Bernard Ave", lat: 49.8856, lng: -119.4934, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-kamloops", name: "London Drugs - Kamloops", chain: "london_drugs", type: "chain", municipality: "Kamloops", address: "700 Tranquille Rd", lat: 50.6789, lng: -120.3412, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-vernon", name: "London Drugs - Vernon", chain: "london_drugs", type: "chain", municipality: "Vernon", address: "3400 30th Ave", lat: 50.2612, lng: -119.2789, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  { id: "ld-penticton", name: "London Drugs - Penticton", chain: "london_drugs", type: "chain", municipality: "Penticton", address: "2111 Main St", lat: 49.4889, lng: -119.5889, courier_services: ["canada_post"], services: ["prescription", "immunization"] },
  
  // Northern BC
  { id: "ld-princegeorge", name: "London Drugs - Prince George", chain: "london_drugs", type: "chain", municipality: "Prince George", address: "3055 Massey Dr", lat: 53.8856, lng: -122.8012, courier_services: ["canada_post"], services: ["prescription", "immunization"] },

  // ============================================================================
  // PHARMASAVE (Independent Network)
  // Community pharmacy network with some courier partnerships
  // ============================================================================
  // Metro Vancouver
  { id: "ps-burnaby-heights", name: "Pharmasave - Burnaby Heights", chain: "pharmasave", type: "chain", municipality: "Burnaby", address: "4208 Hastings St", lat: 49.2812, lng: -123.0089, courier_services: ["canada_post"], services: ["prescription", "compounding", "delivery"] },
  { id: "ps-richmond-broadmoor", name: "Pharmasave - Broadmoor", chain: "pharmasave", type: "chain", municipality: "Richmond", address: "7771 Westminster Hwy", lat: 49.1645, lng: -123.1123, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-portmoody", name: "Pharmasave - Port Moody", chain: "pharmasave", type: "chain", municipality: "Port Moody", address: "2701 Barnet Hwy", lat: 49.2839, lng: -122.8317, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-northvan-deepcove", name: "Pharmasave - Deep Cove", chain: "pharmasave", type: "chain", municipality: "North Vancouver", address: "4380 Gallant Ave", lat: 49.3289, lng: -122.9512, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-vancouver-kits", name: "Pharmasave - Kitsilano", chain: "pharmasave", type: "chain", municipality: "Vancouver", address: "2092 W 4th Ave", lat: 49.2689, lng: -123.1567, services: ["prescription", "compounding", "delivery"] },
  { id: "ps-vancouver-main", name: "Pharmasave - Main Street", chain: "pharmasave", type: "chain", municipality: "Vancouver", address: "4528 Main St", lat: 49.2412, lng: -123.1008, services: ["prescription", "delivery"] },
  { id: "ps-newwest", name: "Pharmasave - New Westminster", chain: "pharmasave", type: "chain", municipality: "New Westminster", address: "628 6th St", lat: 49.2089, lng: -122.9134, services: ["prescription", "compounding"] },
  { id: "ps-whiterock", name: "Pharmasave - White Rock", chain: "pharmasave", type: "chain", municipality: "White Rock", address: "1548 Johnston Rd", lat: 49.0189, lng: -122.8089, services: ["prescription", "delivery"] },
  { id: "ps-squamish", name: "Pharmasave - Squamish", chain: "pharmasave", type: "chain", municipality: "Squamish", address: "38085 2nd Ave", lat: 49.7012, lng: -123.1489, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-whistler", name: "Pharmasave - Whistler", chain: "pharmasave", type: "chain", municipality: "Whistler", address: "4308 Main St", lat: 50.1167, lng: -122.9578, services: ["prescription"] },
  { id: "ps-pemberton", name: "Pharmasave - Pemberton", chain: "pharmasave", type: "chain", municipality: "Pemberton", address: "7452 Prospect St", lat: 50.3189, lng: -122.8012, courier_services: ["canada_post"], services: ["prescription"] },
  
  // Vancouver Island
  { id: "ps-victoria-fairfield", name: "Pharmasave - Fairfield", chain: "pharmasave", type: "chain", municipality: "Victoria", address: "1516 Fairfield Rd", lat: 48.4189, lng: -123.3412, services: ["prescription", "compounding", "delivery"] },
  { id: "ps-victoria-james", name: "Pharmasave - James Bay", chain: "pharmasave", type: "chain", municipality: "Victoria", address: "230 Menzies St", lat: 48.4134, lng: -123.3789, services: ["prescription", "delivery"] },
  { id: "ps-oak-bay", name: "Pharmasave - Oak Bay", chain: "pharmasave", type: "chain", municipality: "Oak Bay", address: "2188 Oak Bay Ave", lat: 48.4312, lng: -123.3134, services: ["prescription", "delivery"] },
  { id: "ps-sooke", name: "Pharmasave - Sooke", chain: "pharmasave", type: "chain", municipality: "Sooke", address: "6716 West Coast Rd", lat: 48.3712, lng: -123.7312, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-saltspring", name: "Pharmasave - Salt Spring Island", chain: "pharmasave", type: "chain", municipality: "Salt Spring Island", address: "104 Lower Ganges Rd", lat: 48.8534, lng: -123.5089, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-tofino", name: "Pharmasave - Tofino", chain: "pharmasave", type: "chain", municipality: "Tofino", address: "411 Campbell St", lat: 49.1534, lng: -125.9034, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-ucluelet", name: "Pharmasave - Ucluelet", chain: "pharmasave", type: "chain", municipality: "Ucluelet", address: "1636 Peninsula Rd", lat: 48.9412, lng: -125.5412, services: ["prescription"] },
  { id: "ps-qualicum", name: "Pharmasave - Qualicum Beach", chain: "pharmasave", type: "chain", municipality: "Qualicum Beach", address: "133 W 2nd Ave", lat: 49.3489, lng: -124.4389, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-comox", name: "Pharmasave - Comox", chain: "pharmasave", type: "chain", municipality: "Comox", address: "1751 Comox Ave", lat: 49.6712, lng: -124.9312, services: ["prescription", "delivery"] },
  { id: "ps-porthardy", name: "Pharmasave - Port Hardy", chain: "pharmasave", type: "chain", municipality: "Port Hardy", address: "8635 Granville St", lat: 50.7234, lng: -127.4934, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-portalice", name: "Pharmasave - Port Alice", chain: "pharmasave", type: "chain", municipality: "Port Alice", address: "1061 Marine Dr", lat: 50.3912, lng: -127.4612, services: ["prescription"] },
  
  // Okanagan & Interior
  { id: "ps-osoyoos", name: "Pharmasave - Osoyoos", chain: "pharmasave", type: "chain", municipality: "Osoyoos", address: "8523 Main St", lat: 49.0312, lng: -119.4612, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-oliver", name: "Pharmasave - Oliver", chain: "pharmasave", type: "chain", municipality: "Oliver", address: "35929 97th St", lat: 49.1834, lng: -119.5489, services: ["prescription"] },
  { id: "ps-summerland", name: "Pharmasave - Summerland", chain: "pharmasave", type: "chain", municipality: "Summerland", address: "13211 Henry Ave", lat: 49.6012, lng: -119.6712, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-peachland", name: "Pharmasave - Peachland", chain: "pharmasave", type: "chain", municipality: "Peachland", address: "5811 Beach Ave", lat: 49.7712, lng: -119.7312, services: ["prescription"] },
  { id: "ps-armstrong", name: "Pharmasave - Armstrong", chain: "pharmasave", type: "chain", municipality: "Armstrong", address: "2489 Pleasant Valley Rd", lat: 50.4489, lng: -119.1989, services: ["prescription"] },
  { id: "ps-revelstoke", name: "Pharmasave - Revelstoke", chain: "pharmasave", type: "chain", municipality: "Revelstoke", address: "555 Victoria Rd", lat: 50.9989, lng: -118.1934, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-golden", name: "Pharmasave - Golden", chain: "pharmasave", type: "chain", municipality: "Golden", address: "1007 11th Ave S", lat: 51.2989, lng: -116.9634, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-merritt", name: "Pharmasave - Merritt", chain: "pharmasave", type: "chain", municipality: "Merritt", address: "2025 Voght St", lat: 50.1112, lng: -120.7889, courier_services: ["canada_post"], services: ["prescription"] },
  
  // Kootenays
  { id: "ps-castlegar", name: "Pharmasave - Castlegar", chain: "pharmasave", type: "chain", municipality: "Castlegar", address: "1555 Columbia Ave", lat: 49.3234, lng: -117.6612, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-rossland", name: "Pharmasave - Rossland", chain: "pharmasave", type: "chain", municipality: "Rossland", address: "2063 Columbia Ave", lat: 49.0789, lng: -117.8012, services: ["prescription"] },
  { id: "ps-fernie", name: "Pharmasave - Fernie", chain: "pharmasave", type: "chain", municipality: "Fernie", address: "792 2nd Ave", lat: 49.5034, lng: -115.0634, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-invermere", name: "Pharmasave - Invermere", chain: "pharmasave", type: "chain", municipality: "Invermere", address: "1310 7th Ave", lat: 50.5089, lng: -116.0312, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-kimberley", name: "Pharmasave - Kimberley", chain: "pharmasave", type: "chain", municipality: "Kimberley", address: "380 Wallinger Ave", lat: 49.6712, lng: -115.9789, services: ["prescription"] },
  { id: "ps-sparwood", name: "Pharmasave - Sparwood", chain: "pharmasave", type: "chain", municipality: "Sparwood", address: "141 Aspen Dr", lat: 49.7312, lng: -114.8834, services: ["prescription"] },
  { id: "ps-creston", name: "Pharmasave - Creston", chain: "pharmasave", type: "chain", municipality: "Creston", address: "1124 Canyon St", lat: 49.0934, lng: -116.5134, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-nakusp", name: "Pharmasave - Nakusp", chain: "pharmasave", type: "chain", municipality: "Nakusp", address: "92 Broadway St W", lat: 50.2412, lng: -117.8012, services: ["prescription"] },
  { id: "ps-kaslo", name: "Pharmasave - Kaslo", chain: "pharmasave", type: "chain", municipality: "Kaslo", address: "403 Front St", lat: 49.9134, lng: -116.9134, services: ["prescription"] },
  { id: "ps-newdenver", name: "Pharmasave - New Denver", chain: "pharmasave", type: "chain", municipality: "New Denver", address: "309 6th Ave", lat: 49.9912, lng: -117.3712, services: ["prescription"] },
  
  // Northern BC
  { id: "ps-smithers", name: "Pharmasave - Smithers", chain: "pharmasave", type: "chain", municipality: "Smithers", address: "3763 Broadway Ave", lat: 54.7834, lng: -127.1712, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-houston", name: "Pharmasave - Houston", chain: "pharmasave", type: "chain", municipality: "Houston", address: "2345 Yellowhead Hwy", lat: 54.3989, lng: -126.6412, services: ["prescription"] },
  { id: "ps-burnslake", name: "Pharmasave - Burns Lake", chain: "pharmasave", type: "chain", municipality: "Burns Lake", address: "260 Hwy 16 W", lat: 54.2312, lng: -125.7612, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-vanderhoof", name: "Pharmasave - Vanderhoof", chain: "pharmasave", type: "chain", municipality: "Vanderhoof", address: "2641 Burrard Ave", lat: 54.0189, lng: -124.0012, services: ["prescription"] },
  { id: "ps-quesnel", name: "Pharmasave - Quesnel", chain: "pharmasave", type: "chain", municipality: "Quesnel", address: "383 Reid St", lat: 52.9789, lng: -122.4912, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-100milehouse", name: "Pharmasave - 100 Mile House", chain: "pharmasave", type: "chain", municipality: "100 Mile House", address: "385 Birch Ave", lat: 51.6434, lng: -121.2934, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-lillooet", name: "Pharmasave - Lillooet", chain: "pharmasave", type: "chain", municipality: "Lillooet", address: "655 Main St", lat: 50.6834, lng: -121.9412, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-mackenzie", name: "Pharmasave - Mackenzie", chain: "pharmasave", type: "chain", municipality: "Mackenzie", address: "400 Mackenzie Blvd", lat: 55.3389, lng: -123.0912, services: ["prescription"] },
  { id: "ps-chetwynd", name: "Pharmasave - Chetwynd", chain: "pharmasave", type: "chain", municipality: "Chetwynd", address: "4727 51st Ave", lat: 55.6989, lng: -121.6312, courier_services: ["canada_post"], services: ["prescription"] },
  { id: "ps-tumblerdridge", name: "Pharmasave - Tumbler Ridge", chain: "pharmasave", type: "chain", municipality: "Tumbler Ridge", address: "330 Southgate", lat: 55.1289, lng: -120.9989, services: ["prescription"] },
  { id: "ps-hudsonshope", name: "Pharmasave - Hudson's Hope", chain: "pharmasave", type: "chain", municipality: "Hudson's Hope", address: "10511 Beattie Dr", lat: 56.0312, lng: -121.9089, services: ["prescription"] },
  { id: "ps-fortnelson", name: "Pharmasave - Fort Nelson", chain: "pharmasave", type: "chain", municipality: "Fort Nelson", address: "5500 50th Ave S", lat: 58.8067, lng: -122.6989, courier_services: ["canada_post"], services: ["prescription"] },
  
  // Sunshine Coast
  { id: "ps-gibsons", name: "Pharmasave - Gibsons", chain: "pharmasave", type: "chain", municipality: "Gibsons", address: "900 Gibsons Way", lat: 49.4012, lng: -123.5089, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-sechelt", name: "Pharmasave - Sechelt", chain: "pharmasave", type: "chain", municipality: "Sechelt", address: "5500 Shorncliffe Ave", lat: 49.4712, lng: -123.7534, courier_services: ["canada_post"], services: ["prescription", "delivery"] },
  { id: "ps-powellriver", name: "Pharmasave - Powell River", chain: "pharmasave", type: "chain", municipality: "Powell River", address: "4794 Joyce Ave", lat: 49.8312, lng: -124.5234, courier_services: ["canada_post"], services: ["prescription", "delivery"] },

  // ============================================================================
  // REXALL PHARMACY
  // National chain (McKesson)
  // ============================================================================
  { id: "rex-vancouver-denman", name: "Rexall - Denman Street", chain: "rexall", type: "chain", municipality: "Vancouver", address: "1125 Denman St", lat: 49.2856, lng: -123.1389, services: ["prescription", "immunization"] },
  { id: "rex-vancouver-broadway", name: "Rexall - Broadway", chain: "rexall", type: "chain", municipality: "Vancouver", address: "850 W Broadway", lat: 49.2634, lng: -123.1234, services: ["prescription", "immunization"] },
  { id: "rex-burnaby", name: "Rexall - Burnaby", chain: "rexall", type: "chain", municipality: "Burnaby", address: "4885 Kingsway", lat: 49.2267, lng: -123.0012, services: ["prescription", "immunization"] },
  { id: "rex-surrey", name: "Rexall - Surrey", chain: "rexall", type: "chain", municipality: "Surrey", address: "10233 King George Blvd", lat: 49.1856, lng: -122.8489, services: ["prescription", "immunization"] },
  { id: "rex-richmond", name: "Rexall - Richmond", chain: "rexall", type: "chain", municipality: "Richmond", address: "5300 No. 3 Rd", lat: 49.1534, lng: -123.1369, services: ["prescription", "immunization"] },
  { id: "rex-northvan", name: "Rexall - North Vancouver", chain: "rexall", type: "chain", municipality: "North Vancouver", address: "935 Marine Dr", lat: 49.3132, lng: -123.0789, services: ["prescription", "immunization"] },
  { id: "rex-coquitlam", name: "Rexall - Coquitlam", chain: "rexall", type: "chain", municipality: "Coquitlam", address: "1020 Austin Ave", lat: 49.2744, lng: -122.8512, services: ["prescription", "immunization"] },
  { id: "rex-langley", name: "Rexall - Langley", chain: "rexall", type: "chain", municipality: "Langley", address: "20090 88th Ave", lat: 49.1515, lng: -122.6612, services: ["prescription", "immunization"] },
  { id: "rex-abbotsford", name: "Rexall - Abbotsford", chain: "rexall", type: "chain", municipality: "Abbotsford", address: "2529 McCallum Rd", lat: 49.0412, lng: -122.3089, services: ["prescription", "immunization"] },
  { id: "rex-victoria", name: "Rexall - Victoria", chain: "rexall", type: "chain", municipality: "Victoria", address: "3200 Shelbourne St", lat: 48.4512, lng: -123.3312, services: ["prescription", "immunization"] },
  { id: "rex-nanaimo", name: "Rexall - Nanaimo", chain: "rexall", type: "chain", municipality: "Nanaimo", address: "4750 Rutherford Rd", lat: 49.1856, lng: -123.9689, services: ["prescription", "immunization"] },
  { id: "rex-kelowna", name: "Rexall - Kelowna", chain: "rexall", type: "chain", municipality: "Kelowna", address: "1876 Cooper Rd", lat: 49.8689, lng: -119.4312, services: ["prescription", "immunization"] },
  { id: "rex-kamloops", name: "Rexall - Kamloops", chain: "rexall", type: "chain", municipality: "Kamloops", address: "910 Columbia St W", lat: 50.6734, lng: -120.3312, services: ["prescription", "immunization"] },

  // ============================================================================
  // COSTCO PHARMACY (Warehouse)
  // Requires membership for pharmacy
  // ============================================================================
  { id: "costco-vancouver-1st", name: "Costco Pharmacy - 1st Avenue", chain: "costco", type: "warehouse", municipality: "Vancouver", address: "605 Expo Blvd", lat: 49.2756, lng: -123.1089, services: ["prescription"] },
  { id: "costco-burnaby", name: "Costco Pharmacy - Burnaby", chain: "costco", type: "warehouse", municipality: "Burnaby", address: "4500 Still Creek Dr", lat: 49.2667, lng: -123.0012, services: ["prescription"] },
  { id: "costco-richmond", name: "Costco Pharmacy - Richmond", chain: "costco", type: "warehouse", municipality: "Richmond", address: "9151 Bridgeport Rd", lat: 49.1789, lng: -123.1234, services: ["prescription"] },
  { id: "costco-surrey", name: "Costco Pharmacy - Surrey", chain: "costco", type: "warehouse", municipality: "Surrey", address: "7423 King George Blvd", lat: 49.1312, lng: -122.8456, services: ["prescription"] },
  { id: "costco-langley", name: "Costco Pharmacy - Langley", chain: "costco", type: "warehouse", municipality: "Langley", address: "20499 64th Ave", lat: 49.1041, lng: -122.6689, services: ["prescription"] },
  { id: "costco-coquitlam", name: "Costco Pharmacy - Coquitlam", chain: "costco", type: "warehouse", municipality: "Coquitlam", address: "1411 United Blvd", lat: 49.2534, lng: -122.7934, services: ["prescription"] },
  { id: "costco-abbotsford", name: "Costco Pharmacy - Abbotsford", chain: "costco", type: "warehouse", municipality: "Abbotsford", address: "1525 Sumas Way", lat: 49.0312, lng: -122.2612, services: ["prescription"] },
  { id: "costco-northvan", name: "Costco Pharmacy - North Vancouver", chain: "costco", type: "warehouse", municipality: "North Vancouver", address: "1175 Main St", lat: 49.3134, lng: -123.0612, services: ["prescription"] },
  { id: "costco-victoria", name: "Costco Pharmacy - Victoria", chain: "costco", type: "warehouse", municipality: "Victoria", address: "799 McCallum Rd", lat: 48.4512, lng: -123.4312, services: ["prescription"] },
  { id: "costco-langford", name: "Costco Pharmacy - Langford", chain: "costco", type: "warehouse", municipality: "Langford", address: "2420 Millstream Rd", lat: 48.4512, lng: -123.5312, services: ["prescription"] },
  { id: "costco-nanaimo", name: "Costco Pharmacy - Nanaimo", chain: "costco", type: "warehouse", municipality: "Nanaimo", address: "6404 Metral Dr", lat: 49.2134, lng: -123.9989, services: ["prescription"] },
  { id: "costco-kelowna", name: "Costco Pharmacy - Kelowna", chain: "costco", type: "warehouse", municipality: "Kelowna", address: "2329 Baron Rd", lat: 49.8756, lng: -119.4234, services: ["prescription"] },
  { id: "costco-kamloops", name: "Costco Pharmacy - Kamloops", chain: "costco", type: "warehouse", municipality: "Kamloops", address: "1500 Iron Mask Rd", lat: 50.6989, lng: -120.3989, services: ["prescription"] },
  { id: "costco-princegeorge", name: "Costco Pharmacy - Prince George", chain: "costco", type: "warehouse", municipality: "Prince George", address: "6555 Southridge Ave", lat: 53.8612, lng: -122.8134, services: ["prescription"] },

  // ============================================================================
  // WALMART PHARMACY (Grocery/Warehouse)
  // Located in Walmart Supercentres
  // ============================================================================
  { id: "walmart-vancouver-grandview", name: "Walmart Pharmacy - Grandview", chain: "walmart", type: "grocery", municipality: "Vancouver", address: "2220 Cambie St", lat: 49.2656, lng: -123.1147, services: ["prescription", "immunization"] },
  { id: "walmart-surrey-guildford", name: "Walmart Pharmacy - Guildford", chain: "walmart", type: "grocery", municipality: "Surrey", address: "10355 King George Blvd", lat: 49.1912, lng: -122.8012, services: ["prescription", "immunization"] },
  { id: "walmart-surrey-newton", name: "Walmart Pharmacy - Newton", chain: "walmart", type: "grocery", municipality: "Surrey", address: "7550 King George Blvd", lat: 49.1312, lng: -122.8456, services: ["prescription", "immunization"] },
  { id: "walmart-surrey-panorama", name: "Walmart Pharmacy - Panorama", chain: "walmart", type: "grocery", municipality: "Surrey", address: "15157 64th Ave", lat: 49.1067, lng: -122.7512, services: ["prescription", "immunization"] },
  { id: "walmart-richmond", name: "Walmart Pharmacy - Richmond", chain: "walmart", type: "grocery", municipality: "Richmond", address: "3500 No. 3 Rd", lat: 49.1534, lng: -123.1369, services: ["prescription", "immunization"] },
  { id: "walmart-langley", name: "Walmart Pharmacy - Langley", chain: "walmart", type: "grocery", municipality: "Langley", address: "20202 66th Ave", lat: 49.1041, lng: -122.6586, services: ["prescription", "immunization"] },
  { id: "walmart-coquitlam", name: "Walmart Pharmacy - Coquitlam", chain: "walmart", type: "grocery", municipality: "Coquitlam", address: "3000 Lougheed Hwy", lat: 49.2744, lng: -122.7891, services: ["prescription", "immunization"] },
  { id: "walmart-mapleridge", name: "Walmart Pharmacy - Maple Ridge", chain: "walmart", type: "grocery", municipality: "Maple Ridge", address: "11969 224th St", lat: 49.2189, lng: -122.5312, services: ["prescription", "immunization"] },
  { id: "walmart-abbotsford", name: "Walmart Pharmacy - Abbotsford", chain: "walmart", type: "grocery", municipality: "Abbotsford", address: "3122 Mount Lehman Rd", lat: 49.0534, lng: -122.3712, services: ["prescription", "immunization"] },
  { id: "walmart-chilliwack", name: "Walmart Pharmacy - Chilliwack", chain: "walmart", type: "grocery", municipality: "Chilliwack", address: "45480 Luckakuck Way", lat: 49.1534, lng: -121.9489, services: ["prescription", "immunization"] },
  { id: "walmart-victoria-tillicum", name: "Walmart Pharmacy - Tillicum", chain: "walmart", type: "grocery", municipality: "Victoria", address: "3130 Tillicum Rd", lat: 48.4512, lng: -123.3934, services: ["prescription", "immunization"] },
  { id: "walmart-langford", name: "Walmart Pharmacy - Langford", chain: "walmart", type: "grocery", municipality: "Langford", address: "840 Langford Pkwy", lat: 48.4489, lng: -123.5112, services: ["prescription", "immunization"] },
  { id: "walmart-nanaimo", name: "Walmart Pharmacy - Nanaimo", chain: "walmart", type: "grocery", municipality: "Nanaimo", address: "6475 Metral Dr", lat: 49.2134, lng: -124.0012, services: ["prescription", "immunization"] },
  { id: "walmart-courtenay", name: "Walmart Pharmacy - Courtenay", chain: "walmart", type: "grocery", municipality: "Courtenay", address: "3201 Island Hwy N", lat: 49.6912, lng: -125.0089, services: ["prescription", "immunization"] },
  { id: "walmart-campbellriver", name: "Walmart Pharmacy - Campbell River", chain: "walmart", type: "grocery", municipality: "Campbell River", address: "1400 Island Hwy", lat: 50.0189, lng: -125.2489, services: ["prescription", "immunization"] },
  { id: "walmart-kelowna", name: "Walmart Pharmacy - Kelowna", chain: "walmart", type: "grocery", municipality: "Kelowna", address: "2121 Harvey Ave", lat: 49.8834, lng: -119.4712, services: ["prescription", "immunization"] },
  { id: "walmart-westkelowna", name: "Walmart Pharmacy - West Kelowna", chain: "walmart", type: "grocery", municipality: "West Kelowna", address: "2484 Main St", lat: 49.8612, lng: -119.5812, services: ["prescription", "immunization"] },
  { id: "walmart-vernon", name: "Walmart Pharmacy - Vernon", chain: "walmart", type: "grocery", municipality: "Vernon", address: "4300 32nd St", lat: 50.2612, lng: -119.2689, services: ["prescription", "immunization"] },
  { id: "walmart-penticton", name: "Walmart Pharmacy - Penticton", chain: "walmart", type: "grocery", municipality: "Penticton", address: "2111 Main St", lat: 49.4889, lng: -119.5889, services: ["prescription", "immunization"] },
  { id: "walmart-kamloops", name: "Walmart Pharmacy - Kamloops", chain: "walmart", type: "grocery", municipality: "Kamloops", address: "1800 Trans-Canada Hwy E", lat: 50.6689, lng: -120.2912, services: ["prescription", "immunization"] },
  { id: "walmart-princegeorge", name: "Walmart Pharmacy - Prince George", chain: "walmart", type: "grocery", municipality: "Prince George", address: "2155 Ferry Ave", lat: 53.9012, lng: -122.7812, services: ["prescription", "immunization"] },
  { id: "walmart-cranbrook", name: "Walmart Pharmacy - Cranbrook", chain: "walmart", type: "grocery", municipality: "Cranbrook", address: "124 Van Horne St S", lat: 49.5089, lng: -115.7612, services: ["prescription", "immunization"] },
  { id: "walmart-fortstjohn", name: "Walmart Pharmacy - Fort St John", chain: "walmart", type: "grocery", municipality: "Fort St John", address: "9520 100th St", lat: 56.2434, lng: -120.8489, services: ["prescription", "immunization"] },

  // ============================================================================
  // SAVE-ON-FOODS PHARMACY (Grocery)
  // BC-based grocery chain with in-store pharmacies
  // ============================================================================
  { id: "sof-vancouver-marpole", name: "Save-On-Foods Pharmacy - Marpole", chain: "save_on_foods", type: "grocery", municipality: "Vancouver", address: "8255 Oak St", lat: 49.2112, lng: -123.1289, services: ["prescription", "immunization"] },
  { id: "sof-vancouver-main", name: "Save-On-Foods Pharmacy - Main Street", chain: "save_on_foods", type: "grocery", municipality: "Vancouver", address: "350 SE Marine Dr", lat: 49.2089, lng: -123.1012, services: ["prescription", "immunization"] },
  { id: "sof-burnaby-heights", name: "Save-On-Foods Pharmacy - Burnaby Heights", chain: "save_on_foods", type: "grocery", municipality: "Burnaby", address: "4150 E Hastings St", lat: 49.2812, lng: -123.0134, services: ["prescription", "immunization"] },
  { id: "sof-burnaby-brentwood", name: "Save-On-Foods Pharmacy - Brentwood", chain: "save_on_foods", type: "grocery", municipality: "Burnaby", address: "4567 Lougheed Hwy", lat: 49.2683, lng: -123.0002, services: ["prescription", "immunization"] },
  { id: "sof-richmond-steveston", name: "Save-On-Foods Pharmacy - Steveston", chain: "save_on_foods", type: "grocery", municipality: "Richmond", address: "12031 1st Ave", lat: 49.1289, lng: -123.1812, services: ["prescription", "immunization"] },
  { id: "sof-richmond-ironwood", name: "Save-On-Foods Pharmacy - Ironwood", chain: "save_on_foods", type: "grocery", municipality: "Richmond", address: "11666 Steveston Hwy", lat: 49.1412, lng: -123.1089, services: ["prescription", "immunization"] },
  { id: "sof-surrey-fleetwood", name: "Save-On-Foods Pharmacy - Fleetwood", chain: "save_on_foods", type: "grocery", municipality: "Surrey", address: "16033 Fraser Hwy", lat: 49.1534, lng: -122.7689, services: ["prescription", "immunization"] },
  { id: "sof-surrey-cloverdale", name: "Save-On-Foods Pharmacy - Cloverdale", chain: "save_on_foods", type: "grocery", municipality: "Surrey", address: "5671 176th St", lat: 49.1034, lng: -122.7312, services: ["prescription", "immunization"] },
  { id: "sof-langley-willowbrook", name: "Save-On-Foods Pharmacy - Willowbrook", chain: "save_on_foods", type: "grocery", municipality: "Langley", address: "19800 Willowbrook Dr", lat: 49.1126, lng: -122.6689, services: ["prescription", "immunization"] },
  { id: "sof-coquitlam-burquitlam", name: "Save-On-Foods Pharmacy - Burquitlam", chain: "save_on_foods", type: "grocery", municipality: "Coquitlam", address: "552 Clarke Rd", lat: 49.2612, lng: -122.8912, services: ["prescription", "immunization"] },
  { id: "sof-portcoquitlam", name: "Save-On-Foods Pharmacy - Port Coquitlam", chain: "save_on_foods", type: "grocery", municipality: "Port Coquitlam", address: "2564 Shaughnessy St", lat: 49.2612, lng: -122.7612, services: ["prescription", "immunization"] },
  { id: "sof-northvan", name: "Save-On-Foods Pharmacy - North Vancouver", chain: "save_on_foods", type: "grocery", municipality: "North Vancouver", address: "333 Brooksbank Ave", lat: 49.3089, lng: -123.0689, services: ["prescription", "immunization"] },
  { id: "sof-mapleridge", name: "Save-On-Foods Pharmacy - Maple Ridge", chain: "save_on_foods", type: "grocery", municipality: "Maple Ridge", address: "22935 Lougheed Hwy", lat: 49.2194, lng: -122.5912, services: ["prescription", "immunization"] },
  { id: "sof-abbotsford-mclure", name: "Save-On-Foods Pharmacy - McCallum", chain: "save_on_foods", type: "grocery", municipality: "Abbotsford", address: "2655 McCallum Rd", lat: 49.0412, lng: -122.3089, services: ["prescription", "immunization"] },
  { id: "sof-chilliwack", name: "Save-On-Foods Pharmacy - Chilliwack", chain: "save_on_foods", type: "grocery", municipality: "Chilliwack", address: "8850 Young Rd S", lat: 49.1512, lng: -121.9589, services: ["prescription", "immunization"] },
  { id: "sof-victoria-downtown", name: "Save-On-Foods Pharmacy - Victoria Downtown", chain: "save_on_foods", type: "grocery", municipality: "Victoria", address: "911 Yates St", lat: 48.4289, lng: -123.3612, services: ["prescription", "immunization"] },
  { id: "sof-victoria-quadra", name: "Save-On-Foods Pharmacy - Quadra", chain: "save_on_foods", type: "grocery", municipality: "Victoria", address: "3995 Quadra St", lat: 48.4612, lng: -123.3612, services: ["prescription", "immunization"] },
  { id: "sof-sidney", name: "Save-On-Foods Pharmacy - Sidney", chain: "save_on_foods", type: "grocery", municipality: "Sidney", address: "2345 Beacon Ave", lat: 48.6489, lng: -123.3989, services: ["prescription", "immunization"] },
  { id: "sof-langford", name: "Save-On-Foods Pharmacy - Langford", chain: "save_on_foods", type: "grocery", municipality: "Langford", address: "850 Langford Pkwy", lat: 48.4489, lng: -123.5089, services: ["prescription", "immunization"] },
  { id: "sof-nanaimo-brooks", name: "Save-On-Foods Pharmacy - Brooks Landing", chain: "save_on_foods", type: "grocery", municipality: "Nanaimo", address: "2945 Departure Bay Rd", lat: 49.1912, lng: -123.9689, services: ["prescription", "immunization"] },
  { id: "sof-parksville", name: "Save-On-Foods Pharmacy - Parksville", chain: "save_on_foods", type: "grocery", municipality: "Parksville", address: "100 Jensen Ave E", lat: 49.3189, lng: -124.3089, services: ["prescription", "immunization"] },
  { id: "sof-courtenay", name: "Save-On-Foods Pharmacy - Courtenay", chain: "save_on_foods", type: "grocery", municipality: "Courtenay", address: "1599 Cliffe Ave", lat: 49.6756, lng: -124.9912, services: ["prescription", "immunization"] },
  { id: "sof-campbellriver", name: "Save-On-Foods Pharmacy - Campbell River", chain: "save_on_foods", type: "grocery", municipality: "Campbell River", address: "1410 Ironwood St", lat: 50.0134, lng: -125.2434, services: ["prescription", "immunization"] },
  { id: "sof-kelowna-glenmore", name: "Save-On-Foods Pharmacy - Glenmore", chain: "save_on_foods", type: "grocery", municipality: "Kelowna", address: "1970 Kane Rd", lat: 49.9089, lng: -119.4312, services: ["prescription", "immunization"] },
  { id: "sof-kelowna-mission", name: "Save-On-Foods Pharmacy - Mission", chain: "save_on_foods", type: "grocery", municipality: "Kelowna", address: "3175 Lakeshore Rd", lat: 49.8612, lng: -119.4289, services: ["prescription", "immunization"] },
  { id: "sof-vernon", name: "Save-On-Foods Pharmacy - Vernon", chain: "save_on_foods", type: "grocery", municipality: "Vernon", address: "4300 32nd St", lat: 50.2612, lng: -119.2689, services: ["prescription", "immunization"] },
  { id: "sof-penticton", name: "Save-On-Foods Pharmacy - Penticton", chain: "save_on_foods", type: "grocery", municipality: "Penticton", address: "2100 Main St", lat: 49.4889, lng: -119.5867, services: ["prescription", "immunization"] },
  { id: "sof-kamloops-columbia", name: "Save-On-Foods Pharmacy - Columbia Place", chain: "save_on_foods", type: "grocery", municipality: "Kamloops", address: "1200 Summit Dr", lat: 50.6734, lng: -120.3489, services: ["prescription", "immunization"] },
  { id: "sof-kamloops-sahali", name: "Save-On-Foods Pharmacy - Sahali", chain: "save_on_foods", type: "grocery", municipality: "Kamloops", address: "945 Columbia St W", lat: 50.6712, lng: -120.3312, services: ["prescription", "immunization"] },
  { id: "sof-princegeorge-hart", name: "Save-On-Foods Pharmacy - Hart", chain: "save_on_foods", type: "grocery", municipality: "Prince George", address: "6575 Southridge Ave", lat: 53.8612, lng: -122.8134, services: ["prescription", "immunization"] },
  { id: "sof-princegeorge-downtown", name: "Save-On-Foods Pharmacy - Downtown", chain: "save_on_foods", type: "grocery", municipality: "Prince George", address: "1600 15th Ave", lat: 53.9089, lng: -122.7689, services: ["prescription", "immunization"] },
  { id: "sof-cranbrook", name: "Save-On-Foods Pharmacy - Cranbrook", chain: "save_on_foods", type: "grocery", municipality: "Cranbrook", address: "124 Van Horne St S", lat: 49.5089, lng: -115.7612, services: ["prescription", "immunization"] },
  { id: "sof-terrace", name: "Save-On-Foods Pharmacy - Terrace", chain: "save_on_foods", type: "grocery", municipality: "Terrace", address: "4731 Lakelse Ave", lat: 54.5134, lng: -128.6012, services: ["prescription", "immunization"] },

  // ============================================================================
  // SAFEWAY PHARMACY (Sobeys)
  // In-store pharmacies in Safeway locations
  // ============================================================================
  { id: "sfw-vancouver-broadway", name: "Safeway Pharmacy - Broadway", chain: "safeway", type: "grocery", municipality: "Vancouver", address: "2315 W 4th Ave", lat: 49.2689, lng: -123.1567, services: ["prescription", "immunization"] },
  { id: "sfw-vancouver-robson", name: "Safeway Pharmacy - Robson", chain: "safeway", type: "grocery", municipality: "Vancouver", address: "1766 Robson St", lat: 49.2889, lng: -123.1367, services: ["prescription", "immunization"] },
  { id: "sfw-vancouver-dunbar", name: "Safeway Pharmacy - Dunbar", chain: "safeway", type: "grocery", municipality: "Vancouver", address: "4475 Dunbar St", lat: 49.2412, lng: -123.1867, services: ["prescription", "immunization"] },
  { id: "sfw-vancouver-kerrisdale", name: "Safeway Pharmacy - Kerrisdale", chain: "safeway", type: "grocery", municipality: "Vancouver", address: "5655 W Boulevard", lat: 49.2289, lng: -123.1612, services: ["prescription", "immunization"] },
  { id: "sfw-burnaby-metrotown", name: "Safeway Pharmacy - Metrotown", chain: "safeway", type: "grocery", municipality: "Burnaby", address: "4500 Kingsway", lat: 49.2277, lng: -123.0012, services: ["prescription", "immunization"] },
  { id: "sfw-richmond-garden", name: "Safeway Pharmacy - Garden City", chain: "safeway", type: "grocery", municipality: "Richmond", address: "8180 No. 2 Rd", lat: 49.1689, lng: -123.1567, services: ["prescription", "immunization"] },
  { id: "sfw-surrey-south", name: "Safeway Pharmacy - South Surrey", chain: "safeway", type: "grocery", municipality: "Surrey", address: "3033 152nd St", lat: 49.0412, lng: -122.8012, services: ["prescription", "immunization"] },
  { id: "sfw-coquitlam-pinetree", name: "Safeway Pharmacy - Pinetree", chain: "safeway", type: "grocery", municipality: "Coquitlam", address: "1199 Pinetree Way", lat: 49.2789, lng: -122.7934, services: ["prescription", "immunization"] },
  { id: "sfw-northvan-capilano", name: "Safeway Pharmacy - Capilano", chain: "safeway", type: "grocery", municipality: "North Vancouver", address: "935 Marine Dr", lat: 49.3134, lng: -123.0789, services: ["prescription", "immunization"] },
  { id: "sfw-westvan", name: "Safeway Pharmacy - West Vancouver", chain: "safeway", type: "grocery", municipality: "West Vancouver", address: "1555 Marine Dr", lat: 49.3289, lng: -123.1489, services: ["prescription", "immunization"] },
  { id: "sfw-abbotsford", name: "Safeway Pharmacy - Abbotsford", chain: "safeway", type: "grocery", municipality: "Abbotsford", address: "2063 Sumas Way", lat: 49.0312, lng: -122.2689, services: ["prescription", "immunization"] },
  { id: "sfw-victoria-fort", name: "Safeway Pharmacy - Fort Street", chain: "safeway", type: "grocery", municipality: "Victoria", address: "1520 Fort St", lat: 48.4289, lng: -123.3412, services: ["prescription", "immunization"] },
  { id: "sfw-victoria-oak", name: "Safeway Pharmacy - Oak Bay", chain: "safeway", type: "grocery", municipality: "Victoria", address: "1960 Foul Bay Rd", lat: 48.4389, lng: -123.3234, services: ["prescription", "immunization"] },
  { id: "sfw-nanaimo", name: "Safeway Pharmacy - Nanaimo", chain: "safeway", type: "grocery", municipality: "Nanaimo", address: "100 Port Place", lat: 49.1656, lng: -123.9312, services: ["prescription", "immunization"] },
  { id: "sfw-kelowna", name: "Safeway Pharmacy - Kelowna", chain: "safeway", type: "grocery", municipality: "Kelowna", address: "1915 Harvey Ave", lat: 49.8834, lng: -119.4612, services: ["prescription", "immunization"] },
  { id: "sfw-kamloops", name: "Safeway Pharmacy - Kamloops", chain: "safeway", type: "grocery", municipality: "Kamloops", address: "850 Notre Dame Dr", lat: 50.7012, lng: -120.3612, services: ["prescription", "immunization"] },

  // ============================================================================
  // THRIFTY FOODS PHARMACY (Sobeys - Vancouver Island)
  // In-store pharmacies - primarily Vancouver Island
  // ============================================================================
  { id: "thrifty-victoria-broadmead", name: "Thrifty Foods Pharmacy - Broadmead", chain: "thriftys", type: "grocery", municipality: "Victoria", address: "777 Royal Oak Dr", lat: 48.4789, lng: -123.3734, services: ["prescription", "immunization"] },
  { id: "thrifty-victoria-fort", name: "Thrifty Foods Pharmacy - Fort Street", chain: "thriftys", type: "grocery", municipality: "Victoria", address: "1521 Fort St", lat: 48.4289, lng: -123.3412, services: ["prescription", "immunization"] },
  { id: "thrifty-victoria-fairfield", name: "Thrifty Foods Pharmacy - Fairfield", chain: "thriftys", type: "grocery", municipality: "Victoria", address: "1590 Fairfield Rd", lat: 48.4189, lng: -123.3412, services: ["prescription", "immunization"] },
  { id: "thrifty-saanich-tillicum", name: "Thrifty Foods Pharmacy - Tillicum", chain: "thriftys", type: "grocery", municipality: "Saanich", address: "3255 Tillicum Rd", lat: 48.4489, lng: -123.4012, services: ["prescription", "immunization"] },
  { id: "thrifty-sidney", name: "Thrifty Foods Pharmacy - Sidney", chain: "thriftys", type: "grocery", municipality: "Sidney", address: "2353 Bevan Ave", lat: 48.6489, lng: -123.3989, services: ["prescription", "immunization"] },
  { id: "thrifty-brentwood", name: "Thrifty Foods Pharmacy - Brentwood Bay", chain: "thriftys", type: "grocery", municipality: "Central Saanich", address: "7043 West Saanich Rd", lat: 48.5689, lng: -123.4512, services: ["prescription", "immunization"] },
  { id: "thrifty-langford", name: "Thrifty Foods Pharmacy - Langford", chain: "thriftys", type: "grocery", municipality: "Langford", address: "2940 Jacklin Rd", lat: 48.4489, lng: -123.4989, services: ["prescription", "immunization"] },
  { id: "thrifty-sooke", name: "Thrifty Foods Pharmacy - Sooke", chain: "thriftys", type: "grocery", municipality: "Sooke", address: "6750 West Coast Rd", lat: 48.3712, lng: -123.7289, services: ["prescription", "immunization"] },
  { id: "thrifty-duncan", name: "Thrifty Foods Pharmacy - Duncan", chain: "thriftys", type: "grocery", municipality: "Duncan", address: "6555 Norcross Rd", lat: 48.7889, lng: -123.7134, services: ["prescription", "immunization"] },
  { id: "thrifty-saltspring", name: "Thrifty Foods Pharmacy - Salt Spring Island", chain: "thriftys", type: "grocery", municipality: "Salt Spring Island", address: "114 Purvis Lane", lat: 48.8534, lng: -123.5089, services: ["prescription"] },
  { id: "thrifty-nanaimo", name: "Thrifty Foods Pharmacy - Nanaimo", chain: "thriftys", type: "grocery", municipality: "Nanaimo", address: "6581 Aulds Rd", lat: 49.2189, lng: -123.9934, services: ["prescription", "immunization"] },
  { id: "thrifty-parksville", name: "Thrifty Foods Pharmacy - Parksville", chain: "thriftys", type: "grocery", municipality: "Parksville", address: "280 E Island Hwy", lat: 49.3189, lng: -124.3089, services: ["prescription", "immunization"] },
  { id: "thrifty-qualicum", name: "Thrifty Foods Pharmacy - Qualicum Beach", chain: "thriftys", type: "grocery", municipality: "Qualicum Beach", address: "180 W 2nd Ave", lat: 49.3489, lng: -124.4389, services: ["prescription", "immunization"] },
  { id: "thrifty-courtenay", name: "Thrifty Foods Pharmacy - Courtenay", chain: "thriftys", type: "grocery", municipality: "Courtenay", address: "2801 Cliffe Ave", lat: 49.6834, lng: -124.9912, services: ["prescription", "immunization"] },
  { id: "thrifty-comox", name: "Thrifty Foods Pharmacy - Comox", chain: "thriftys", type: "grocery", municipality: "Comox", address: "1745 Comox Ave", lat: 49.6712, lng: -124.9289, services: ["prescription", "immunization"] },
  { id: "thrifty-campbellriver", name: "Thrifty Foods Pharmacy - Campbell River", chain: "thriftys", type: "grocery", municipality: "Campbell River", address: "980 Shoppers Row", lat: 50.0189, lng: -125.2434, services: ["prescription", "immunization"] },

  // ============================================================================
  // INDEPENDENT COMMUNITY PHARMACIES
  // Locally owned - unique to their communities
  // ============================================================================
  // Metro Vancouver Independents
  { id: "ind-vancouver-kits-apothecary", name: "Kits Apothecary", chain: "independent", type: "independent", municipality: "Vancouver", address: "2092 W 4th Ave", lat: 49.2689, lng: -123.1567, services: ["prescription", "compounding", "delivery"] },
  { id: "ind-vancouver-alma", name: "Alma Pharmacy", chain: "independent", type: "independent", municipality: "Vancouver", address: "3686 W 4th Ave", lat: 49.2689, lng: -123.1889, services: ["prescription", "compounding"] },
  { id: "ind-vancouver-drive", name: "The Drive Pharmacy", chain: "independent", type: "independent", municipality: "Vancouver", address: "1458 Commercial Dr", lat: 49.2712, lng: -123.0695, services: ["prescription", "delivery"] },
  { id: "ind-burnaby-willingdon", name: "Willingdon Pharmacy", chain: "independent", type: "independent", municipality: "Burnaby", address: "4505 Willingdon Ave", lat: 49.2789, lng: -123.0012, services: ["prescription", "compounding", "delivery"] },
  { id: "ind-richmond-terra", name: "Terra Nova Pharmacy", chain: "independent", type: "independent", municipality: "Richmond", address: "3031 Moncton St", lat: 49.1534, lng: -123.1812, services: ["prescription", "delivery"] },
  { id: "ind-northvan-edgemont", name: "Edgemont Pharmacy", chain: "independent", type: "independent", municipality: "North Vancouver", address: "3050 Edgemont Blvd", lat: 49.3489, lng: -123.0612, services: ["prescription", "compounding"] },
  { id: "ind-westvan-ambleside", name: "Ambleside Pharmacy", chain: "independent", type: "independent", municipality: "West Vancouver", address: "1455 Marine Dr", lat: 49.3267, lng: -123.1512, services: ["prescription", "delivery"] },
  
  // Vancouver Island Independents
  { id: "ind-victoria-fernwood", name: "Fernwood Pharmacy", chain: "independent", type: "independent", municipality: "Victoria", address: "1303 Gladstone Ave", lat: 48.4334, lng: -123.3412, services: ["prescription", "compounding", "delivery"] },
  { id: "ind-victoria-cook", name: "Cook Street Village Pharmacy", chain: "independent", type: "independent", municipality: "Victoria", address: "230 Cook St", lat: 48.4134, lng: -123.3612, services: ["prescription", "delivery"] },
  { id: "ind-nanaimo-harewood", name: "Harewood Pharmacy", chain: "independent", type: "independent", municipality: "Nanaimo", address: "584 5th St", lat: 49.1512, lng: -123.9534, services: ["prescription"] },
  
  // Okanagan Independents
  { id: "ind-kelowna-downtown", name: "Downtown Kelowna Pharmacy", chain: "independent", type: "independent", municipality: "Kelowna", address: "489 Bernard Ave", lat: 49.8856, lng: -119.4934, services: ["prescription", "compounding", "delivery"] },
  { id: "ind-penticton-main", name: "Main Street Pharmacy", chain: "independent", type: "independent", municipality: "Penticton", address: "338 Main St", lat: 49.4934, lng: -119.5889, services: ["prescription", "delivery"] },
  
  // Kootenays Independents
  { id: "ind-nelson-baker", name: "Baker Street Pharmacy", chain: "independent", type: "independent", municipality: "Nelson", address: "524 Baker St", lat: 49.4934, lng: -117.2912, services: ["prescription", "compounding"] },
  { id: "ind-revelstoke-community", name: "Revelstoke Community Pharmacy", chain: "independent", type: "independent", municipality: "Revelstoke", address: "301 Victoria Rd", lat: 50.9989, lng: -118.1912, services: ["prescription", "delivery"] },

  // ============================================================================
  // HOSPITAL OUTPATIENT PHARMACIES
  // Major hospital pharmacy services
  // ============================================================================
  { id: "hosp-vgh", name: "VGH Outpatient Pharmacy", chain: "hospital", type: "hospital", municipality: "Vancouver", address: "899 W 12th Ave", lat: 49.2612, lng: -123.1234, services: ["prescription"] },
  { id: "hosp-stpauls", name: "St. Paul's Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Vancouver", address: "1081 Burrard St", lat: 49.2812, lng: -123.1267, services: ["prescription"] },
  { id: "hosp-bcch", name: "BC Children's Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Vancouver", address: "4480 Oak St", lat: 49.2445, lng: -123.1234, services: ["prescription"] },
  { id: "hosp-bcwh", name: "BC Women's Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Vancouver", address: "4500 Oak St", lat: 49.2445, lng: -123.1234, services: ["prescription"] },
  { id: "hosp-burnaby", name: "Burnaby Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Burnaby", address: "3935 Kincaid St", lat: 49.2534, lng: -122.9812, services: ["prescription"] },
  { id: "hosp-royalcolumbian", name: "Royal Columbian Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "New Westminster", address: "330 E Columbia St", lat: 49.2267, lng: -122.8912, services: ["prescription"] },
  { id: "hosp-surreymemorial", name: "Surrey Memorial Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Surrey", address: "13750 96th Ave", lat: 49.1789, lng: -122.8612, services: ["prescription"] },
  { id: "hosp-richmond", name: "Richmond Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Richmond", address: "7000 Westminster Hwy", lat: 49.1689, lng: -123.1312, services: ["prescription"] },
  { id: "hosp-lionsgatehosp", name: "Lions Gate Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "North Vancouver", address: "231 E 15th St", lat: 49.3189, lng: -123.0712, services: ["prescription"] },
  { id: "hosp-abbotsford", name: "Abbotsford Regional Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Abbotsford", address: "32900 Marshall Rd", lat: 49.0312, lng: -122.3089, services: ["prescription"] },
  { id: "hosp-victoriagen", name: "Victoria General Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Victoria", address: "1 Hospital Way", lat: 48.4612, lng: -123.4312, services: ["prescription"] },
  { id: "hosp-royaljubilee", name: "Royal Jubilee Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Victoria", address: "1952 Bay St", lat: 48.4389, lng: -123.3234, services: ["prescription"] },
  { id: "hosp-nanaimo-rgh", name: "Nanaimo Regional General Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Nanaimo", address: "1200 Dufferin Cres", lat: 49.1712, lng: -123.9489, services: ["prescription"] },
  { id: "hosp-kelowna-gen", name: "Kelowna General Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Kelowna", address: "2268 Pandosy St", lat: 49.8712, lng: -119.4812, services: ["prescription"] },
  { id: "hosp-kamloops-rir", name: "Royal Inland Hospital Pharmacy", chain: "hospital", type: "hospital", municipality: "Kamloops", address: "311 Columbia St", lat: 50.6734, lng: -120.3312, services: ["prescription"] },
  { id: "hosp-princegeorge-uhnbc", name: "University Hospital of Northern BC Pharmacy", chain: "hospital", type: "hospital", municipality: "Prince George", address: "1475 Edmonton St", lat: 53.9134, lng: -122.7612, services: ["prescription"] }
];

export const pharmacyTypeLabels: Record<PharmacyType, string> = {
  chain: "Chain Pharmacy",
  grocery: "Grocery Pharmacy",
  warehouse: "Warehouse Pharmacy",
  independent: "Independent Pharmacy",
  hospital: "Hospital Pharmacy",
  compounding: "Compounding Pharmacy"
};

export const pharmacyChainLabels: Record<PharmacyChain, string> = {
  shoppers_drug_mart: "Shoppers Drug Mart",
  london_drugs: "London Drugs",
  pharmasave: "Pharmasave",
  rexall: "Rexall",
  walmart: "Walmart",
  costco: "Costco",
  save_on_foods: "Save-On-Foods",
  safeway: "Safeway",
  real_canadian_superstore: "Real Canadian Superstore",
  thriftys: "Thrifty Foods",
  independent: "Independent",
  hospital: "Hospital"
};
