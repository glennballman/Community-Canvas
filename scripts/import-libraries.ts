import { pool } from "../server/db";

interface Library {
  name: string;
  system: string;
  branch_type: "main" | "branch";
  address: string;
  city: string;
  postal_code?: string;
  phone?: string;
  website?: string;
  lat: number;
  lng: number;
}

// BC Public Libraries data
const LIBRARIES: Library[] = [
  // VANCOUVER PUBLIC LIBRARY (21 branches)
  { name: "Vancouver Public Library - Central Branch", system: "Vancouver Public Library", branch_type: "main", address: "350 W Georgia St", city: "Vancouver", postal_code: "V6B 6B1", phone: "604-331-3603", website: "https://www.vpl.ca", lat: 49.2797, lng: -123.1156 },
  { name: "Britannia Branch", system: "Vancouver Public Library", branch_type: "branch", address: "1661 Napier St", city: "Vancouver", lat: 49.2756, lng: -123.0698 },
  { name: "Carnegie Branch", system: "Vancouver Public Library", branch_type: "branch", address: "401 Main St", city: "Vancouver", lat: 49.2822, lng: -123.1005 },
  { name: "Champlain Heights Branch", system: "Vancouver Public Library", branch_type: "branch", address: "7110 Kerr St", city: "Vancouver", lat: 49.2167, lng: -123.0333 },
  { name: "Collingwood Branch", system: "Vancouver Public Library", branch_type: "branch", address: "2985 Kingsway", city: "Vancouver", lat: 49.2392, lng: -123.0339 },
  { name: "Dunbar Branch", system: "Vancouver Public Library", branch_type: "branch", address: "4515 Dunbar St", city: "Vancouver", lat: 49.2456, lng: -123.1861 },
  { name: "Firehall Branch", system: "Vancouver Public Library", branch_type: "branch", address: "1455 W 10th Ave", city: "Vancouver", lat: 49.2622, lng: -123.1389 },
  { name: "Fraserview Branch", system: "Vancouver Public Library", branch_type: "branch", address: "1950 Argyle Dr", city: "Vancouver", lat: 49.2167, lng: -123.0667 },
  { name: "Hastings Branch", system: "Vancouver Public Library", branch_type: "branch", address: "2674 E Hastings St", city: "Vancouver", lat: 49.2811, lng: -123.0422 },
  { name: "Joe Fortes Branch", system: "Vancouver Public Library", branch_type: "branch", address: "870 Denman St", city: "Vancouver", lat: 49.2881, lng: -123.1361 },
  { name: "Kensington Branch", system: "Vancouver Public Library", branch_type: "branch", address: "1428 Cedar Cottage Mews", city: "Vancouver", lat: 49.2483, lng: -123.0650 },
  { name: "Kerrisdale Branch", system: "Vancouver Public Library", branch_type: "branch", address: "2112 W 42nd Ave", city: "Vancouver", lat: 49.2322, lng: -123.1567 },
  { name: "Kitsilano Branch", system: "Vancouver Public Library", branch_type: "branch", address: "2425 MacDonald St", city: "Vancouver", lat: 49.2656, lng: -123.1675 },
  { name: "Marpole Branch", system: "Vancouver Public Library", branch_type: "branch", address: "8386 Granville St", city: "Vancouver", lat: 49.2108, lng: -123.1375 },
  { name: "Mount Pleasant Branch", system: "Vancouver Public Library", branch_type: "branch", address: "1 Kingsway", city: "Vancouver", lat: 49.2656, lng: -123.1008 },
  { name: "Oakridge Branch", system: "Vancouver Public Library", branch_type: "branch", address: "189 W 41st Ave", city: "Vancouver", lat: 49.2267, lng: -123.1186 },
  { name: "Renfrew Branch", system: "Vancouver Public Library", branch_type: "branch", address: "2969 E 22nd Ave", city: "Vancouver", lat: 49.2494, lng: -123.0389 },
  { name: "Riley Park Branch", system: "Vancouver Public Library", branch_type: "branch", address: "3981 Main St", city: "Vancouver", lat: 49.2483, lng: -123.1008 },
  { name: "South Hill Branch", system: "Vancouver Public Library", branch_type: "branch", address: "6076 Fraser St", city: "Vancouver", lat: 49.2233, lng: -123.0925 },
  { name: "Strathcona Branch", system: "Vancouver Public Library", branch_type: "branch", address: "592 E Pender St", city: "Vancouver", lat: 49.2797, lng: -123.0911 },
  { name: "Terry Salman Branch", system: "Vancouver Public Library", branch_type: "branch", address: "555 W 57th Ave", city: "Vancouver", lat: 49.2167, lng: -123.1167 },

  // GREATER VICTORIA PUBLIC LIBRARY (13 branches)
  { name: "Greater Victoria Public Library - Central Branch", system: "Greater Victoria Public Library", branch_type: "main", address: "735 Broughton St", city: "Victoria", postal_code: "V8W 3H2", phone: "250-382-7241", website: "https://www.gvpl.ca", lat: 48.4224, lng: -123.3647 },
  { name: "Esquimalt Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "1231 Esquimalt Rd", city: "Esquimalt", lat: 48.4319, lng: -123.4039 },
  { name: "Juan de Fuca Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "1759 Island Hwy", city: "Colwood", lat: 48.4436, lng: -123.4936 },
  { name: "Langford Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "2899 Langford Lake Rd", city: "Langford", lat: 48.4500, lng: -123.4833 },
  { name: "Nellie McClung Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "3950 Cedar Hill Rd", city: "Saanich", lat: 48.4706, lng: -123.3578 },
  { name: "Oak Bay Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "1442 Monterey Ave", city: "Oak Bay", lat: 48.4297, lng: -123.3119 },
  { name: "Saanich Centennial Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "3110 Tillicum Rd", city: "Saanich", lat: 48.4506, lng: -123.3917 },
  { name: "Emily Carr Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "3500 Blanshard St", city: "Victoria", lat: 48.4500, lng: -123.3558 },
  { name: "Bruce Hutchison Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "4636 Elk Lake Dr", city: "Saanich", lat: 48.4867, lng: -123.3867 },
  { name: "Goudy Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "1648 Chambers St", city: "Victoria", lat: 48.4342, lng: -123.3478 },
  { name: "James Bay Branch", system: "Greater Victoria Public Library", branch_type: "branch", address: "500 Menzies St", city: "Victoria", lat: 48.4183, lng: -123.3692 },

  // VANCOUVER ISLAND REGIONAL LIBRARY (major branches)
  { name: "Nanaimo Harbourfront Branch", system: "Vancouver Island Regional Library", branch_type: "main", address: "90 Commercial St", city: "Nanaimo", phone: "250-753-1154", website: "https://virl.bc.ca", lat: 49.1659, lng: -123.9358 },
  { name: "Nanaimo Wellington Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "6251 Hammond Bay Rd", city: "Nanaimo", lat: 49.2083, lng: -123.9500 },
  { name: "Parksville Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "100 Jensen Ave E", city: "Parksville", lat: 49.3181, lng: -124.3106 },
  { name: "Qualicum Beach Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "660 Primrose St", city: "Qualicum Beach", lat: 49.3494, lng: -124.4369 },
  { name: "Port Alberni Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "4255 Wallace St", city: "Port Alberni", lat: 49.2353, lng: -124.7989 },
  { name: "Tofino Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "331 Main St", city: "Tofino", lat: 49.1528, lng: -125.9044 },
  { name: "Ucluelet Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "500 Matterson Dr", city: "Ucluelet", lat: 48.9406, lng: -125.5461 },
  { name: "Campbell River Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "1240 Shoppers Row", city: "Campbell River", lat: 50.0244, lng: -125.2475 },
  { name: "Courtenay Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "300 6th St", city: "Courtenay", lat: 49.6869, lng: -124.9919 },
  { name: "Comox Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "1720 Beaufort Ave", city: "Comox", lat: 49.6733, lng: -124.9022 },
  { name: "Cumberland Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "2674 Dunsmuir Ave", city: "Cumberland", lat: 49.6181, lng: -125.0289 },
  { name: "Port Hardy Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "7070 Market St", city: "Port Hardy", lat: 50.7256, lng: -127.4969 },
  { name: "Port McNeill Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "2005 Pine Dr", city: "Port McNeill", lat: 50.5878, lng: -127.0856 },
  { name: "Ladysmith Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "740 1st Ave", city: "Ladysmith", lat: 48.9975, lng: -123.8203 },
  { name: "Chemainus Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "2988 Daniel St", city: "Chemainus", lat: 48.9267, lng: -123.7144 },
  { name: "Sooke Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "2065 Anna Marie Rd", city: "Sooke", lat: 48.3724, lng: -123.7262 },
  { name: "Sidney/North Saanich Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "10091 Resthaven Dr", city: "Sidney", lat: 48.6500, lng: -123.3986 },
  { name: "Salt Spring Island Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "129 McPhillips Ave", city: "Salt Spring Island", lat: 48.8528, lng: -123.5078 },

  // OKANAGAN REGIONAL LIBRARY (major branches)
  { name: "Kelowna Branch", system: "Okanagan Regional Library", branch_type: "main", address: "1380 Ellis St", city: "Kelowna", phone: "250-762-2800", website: "https://www.orl.bc.ca", lat: 49.8881, lng: -119.4922 },
  { name: "Vernon Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "3001 32nd Ave", city: "Vernon", lat: 50.2728, lng: -119.2592 },
  { name: "Penticton Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "785 Main St", city: "Penticton", lat: 49.4931, lng: -119.5869 },
  { name: "West Kelowna Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "2484 Main St", city: "West Kelowna", lat: 49.8628, lng: -119.5836 },
  { name: "Summerland Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "9525 Wharton St", city: "Summerland", lat: 49.6006, lng: -119.6778 },
  { name: "Oliver Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "6172 350th Ave", city: "Oliver", lat: 49.1844, lng: -119.5503 },
  { name: "Osoyoos Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "8505 68th Ave", city: "Osoyoos", lat: 49.0333, lng: -119.4667 },
  { name: "Lake Country Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "10150 Bottom Wood Lake Rd", city: "Lake Country", lat: 50.0361, lng: -119.3892 },
  { name: "Armstrong Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "3305 Pleasant Valley Rd", city: "Armstrong", lat: 50.4483, lng: -119.2008 },
  { name: "Enderby Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "901 George St", city: "Enderby", lat: 50.5500, lng: -119.1400 },

  // FRASER VALLEY REGIONAL LIBRARY (major branches)
  { name: "Abbotsford Community Library", system: "Fraser Valley Regional Library", branch_type: "main", address: "33660 South Fraser Way", city: "Abbotsford", phone: "604-859-7814", website: "https://fvrl.bc.ca", lat: 49.0502, lng: -122.3189 },
  { name: "Chilliwack Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "45860 First Ave", city: "Chilliwack", lat: 49.1572, lng: -121.9508 },
  { name: "Mission Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "33247 2nd Ave", city: "Mission", lat: 49.1361, lng: -122.3103 },
  { name: "Hope Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "796 Fraser Ave", city: "Hope", lat: 49.3858, lng: -121.4419 },
  { name: "Langley City Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "20399 Douglas Crescent", city: "Langley", lat: 49.1044, lng: -122.6597 },
  { name: "Aldergrove Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "26770 29th Ave", city: "Aldergrove", lat: 49.0556, lng: -122.4711 },
  { name: "Fort Langley Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "9167 Glover Rd", city: "Fort Langley", lat: 49.1694, lng: -122.5775 },
  { name: "Clearbrook Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "32320 George Ferguson Way", city: "Abbotsford", lat: 49.0506, lng: -122.3281 },
  { name: "Agassiz Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "7140 Cheam Ave", city: "Agassiz", lat: 49.2386, lng: -121.7617 },
  { name: "White Rock Branch", system: "Fraser Valley Regional Library", branch_type: "branch", address: "1474 Oxford St", city: "White Rock", lat: 49.0247, lng: -122.8081 },

  // BURNABY PUBLIC LIBRARY
  { name: "Burnaby Public Library - Metrotown", system: "Burnaby Public Library", branch_type: "main", address: "6100 Willingdon Ave", city: "Burnaby", phone: "604-436-5400", website: "https://www.bpl.bc.ca", lat: 49.2269, lng: -123.0003 },
  { name: "Tommy Douglas Branch", system: "Burnaby Public Library", branch_type: "branch", address: "7311 Kingsway", city: "Burnaby", lat: 49.2250, lng: -122.9750 },
  { name: "McGill Branch", system: "Burnaby Public Library", branch_type: "branch", address: "4595 Albert St", city: "Burnaby", lat: 49.2517, lng: -122.9867 },
  { name: "Cameron Branch", system: "Burnaby Public Library", branch_type: "branch", address: "9523 Cameron St", city: "Burnaby", lat: 49.2250, lng: -122.8917 },

  // RICHMOND PUBLIC LIBRARY
  { name: "Richmond Public Library - Brighouse", system: "Richmond Public Library", branch_type: "main", address: "7700 Minoru Gate", city: "Richmond", phone: "604-231-6413", website: "https://www.yourlibrary.ca", lat: 49.1656, lng: -123.1364 },
  { name: "Steveston Branch", system: "Richmond Public Library", branch_type: "branch", address: "4111 Moncton St", city: "Richmond", lat: 49.1253, lng: -123.1822 },
  { name: "Ironwood Branch", system: "Richmond Public Library", branch_type: "branch", address: "10351 No 3 Rd", city: "Richmond", lat: 49.1833, lng: -123.1289 },
  { name: "Cambie Branch", system: "Richmond Public Library", branch_type: "branch", address: "11590 Cambie Rd", city: "Richmond", lat: 49.1858, lng: -123.1022 },

  // SURREY PUBLIC LIBRARY
  { name: "Surrey City Centre Branch", system: "Surrey Libraries", branch_type: "main", address: "10350 University Dr", city: "Surrey", phone: "604-598-7300", website: "https://www.surreylibraries.ca", lat: 49.1867, lng: -122.8478 },
  { name: "Cloverdale Branch", system: "Surrey Libraries", branch_type: "branch", address: "5642 176A St", city: "Surrey", lat: 49.1042, lng: -122.7283 },
  { name: "Fleetwood Branch", system: "Surrey Libraries", branch_type: "branch", address: "15996 84th Ave", city: "Surrey", lat: 49.1517, lng: -122.7833 },
  { name: "Guildford Branch", system: "Surrey Libraries", branch_type: "branch", address: "15105 105th Ave", city: "Surrey", lat: 49.1917, lng: -122.8000 },
  { name: "Newton Branch", system: "Surrey Libraries", branch_type: "branch", address: "13795 70th Ave", city: "Surrey", lat: 49.1267, lng: -122.8333 },
  { name: "Ocean Park Branch", system: "Surrey Libraries", branch_type: "branch", address: "12854 17th Ave", city: "Surrey", lat: 49.0500, lng: -122.8667 },
  { name: "Semiahmoo Branch", system: "Surrey Libraries", branch_type: "branch", address: "1815 152nd St", city: "Surrey", lat: 49.0417, lng: -122.8017 },
  { name: "Strawberry Hill Branch", system: "Surrey Libraries", branch_type: "branch", address: "7399 122nd St", city: "Surrey", lat: 49.1250, lng: -122.8917 },

  // NORTH VANCOUVER LIBRARIES
  { name: "North Vancouver City Library", system: "North Vancouver City Library", branch_type: "main", address: "120 W 14th St", city: "North Vancouver", phone: "604-998-3450", website: "https://www.nvcl.ca", lat: 49.3197, lng: -123.0750 },
  { name: "Lynn Valley Branch", system: "North Vancouver District Library", branch_type: "main", address: "1277 Lynn Valley Rd", city: "North Vancouver", phone: "604-984-0286", website: "https://www.nvdpl.ca", lat: 49.3369, lng: -123.0433 },
  { name: "Capilano Branch", system: "North Vancouver District Library", branch_type: "branch", address: "3045 Highland Blvd", city: "North Vancouver", lat: 49.3283, lng: -123.1003 },
  { name: "Parkgate Branch", system: "North Vancouver District Library", branch_type: "branch", address: "3675 Banff Ct", city: "North Vancouver", lat: 49.3197, lng: -122.9850 },

  // WEST VANCOUVER MEMORIAL LIBRARY
  { name: "West Vancouver Memorial Library", system: "West Vancouver Memorial Library", branch_type: "main", address: "1950 Marine Dr", city: "West Vancouver", phone: "604-925-7400", website: "https://westvanlibrary.ca", lat: 49.3258, lng: -123.1658 },

  // COQUITLAM PUBLIC LIBRARY
  { name: "Coquitlam City Centre Branch", system: "Coquitlam Public Library", branch_type: "main", address: "1169 Pinetree Way", city: "Coquitlam", phone: "604-554-7323", website: "https://www.coqlibrary.ca", lat: 49.2789, lng: -122.8003 },
  { name: "Poirier Branch", system: "Coquitlam Public Library", branch_type: "branch", address: "575 Poirier St", city: "Coquitlam", lat: 49.2567, lng: -122.8500 },

  // PORT MOODY PUBLIC LIBRARY
  { name: "Port Moody Public Library", system: "Port Moody Public Library", branch_type: "main", address: "100 Newport Dr", city: "Port Moody", phone: "604-469-4575", website: "https://www.portmoodylibrary.ca", lat: 49.2833, lng: -122.8397 },

  // NEW WESTMINSTER PUBLIC LIBRARY
  { name: "New Westminster Public Library", system: "New Westminster Public Library", branch_type: "main", address: "716 6th Ave", city: "New Westminster", phone: "604-527-4660", website: "https://www.nwpl.ca", lat: 49.2072, lng: -122.9111 },

  // PRINCE GEORGE PUBLIC LIBRARY
  { name: "Bob Harkins Branch", system: "Prince George Public Library", branch_type: "main", address: "887 Dominion St", city: "Prince George", phone: "250-563-9251", website: "https://pgpl.ca", lat: 53.9156, lng: -122.7500 },
  { name: "Nechako Branch", system: "Prince George Public Library", branch_type: "branch", address: "3355 Westwood Dr", city: "Prince George", lat: 53.9350, lng: -122.7917 },

  // KAMLOOPS LIBRARY
  { name: "Thompson-Nicola Regional Library - Kamloops", system: "Thompson-Nicola Regional Library", branch_type: "main", address: "465 Victoria St", city: "Kamloops", phone: "250-372-5145", website: "https://tnrl.ca", lat: 50.6739, lng: -120.3256 },
  { name: "North Kamloops Branch", system: "Thompson-Nicola Regional Library", branch_type: "branch", address: "693 Fortune Dr", city: "Kamloops", lat: 50.6917, lng: -120.3167 },

  // COWICHAN VALLEY - DUNCAN
  { name: "Vancouver Island Regional Library - Duncan", system: "Vancouver Island Regional Library", branch_type: "branch", address: "2687 James St", city: "Duncan", lat: 48.7878, lng: -123.7100 },
  { name: "Lake Cowichan Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "37 S Shore Rd", city: "Lake Cowichan", lat: 48.8261, lng: -124.0533 },
  { name: "Mill Bay Branch", system: "Vancouver Island Regional Library", branch_type: "branch", address: "2473 Shawnigan Mill Bay Rd", city: "Mill Bay", lat: 48.6450, lng: -123.5533 },

  // KOOTENAY LIBRARY FEDERATION
  { name: "Nelson Public Library", system: "Nelson Public Library", branch_type: "main", address: "602 Stanley St", city: "Nelson", phone: "250-352-6333", website: "https://nelsonlibrary.ca", lat: 49.4944, lng: -117.2917 },
  { name: "Castlegar & District Public Library", system: "Castlegar & District Public Library", branch_type: "main", address: "1005 3rd St", city: "Castlegar", phone: "250-365-6611", lat: 49.3264, lng: -117.6661 },
  { name: "Trail & District Public Library", system: "Trail & District Public Library", branch_type: "main", address: "1505 Victoria St", city: "Trail", phone: "250-364-1731", lat: 49.0969, lng: -117.7119 },
  { name: "Cranbrook Public Library", system: "Cranbrook Public Library", branch_type: "main", address: "1212 2nd St N", city: "Cranbrook", phone: "250-426-4063", lat: 49.5125, lng: -115.7678 },
  { name: "Fernie Heritage Library", system: "Fernie Heritage Library", branch_type: "main", address: "492 3rd Ave", city: "Fernie", phone: "250-423-4458", lat: 49.5039, lng: -115.0633 },
  { name: "Kimberley Public Library", system: "Kimberley Public Library", branch_type: "main", address: "115 Spokane St", city: "Kimberley", phone: "250-427-3833", lat: 49.6697, lng: -115.9778 },
  { name: "Revelstoke Branch", system: "Okanagan Regional Library", branch_type: "branch", address: "605 Campbell Ave", city: "Revelstoke", lat: 50.9983, lng: -118.1958 },
  { name: "Golden & District Library", system: "Golden & District Library", branch_type: "main", address: "416 9th Ave N", city: "Golden", phone: "250-344-6516", lat: 51.2978, lng: -116.9634 },

  // NORTHERN BC
  { name: "Prince Rupert Public Library", system: "Prince Rupert Public Library", branch_type: "main", address: "101 6th Ave W", city: "Prince Rupert", phone: "250-627-1345", lat: 54.3150, lng: -130.3194 },
  { name: "Terrace Public Library", system: "Terrace Public Library", branch_type: "main", address: "4610 Park Ave", city: "Terrace", phone: "250-638-8177", lat: 54.5164, lng: -128.5967 },
  { name: "Kitimat Public Library", system: "Kitimat Public Library", branch_type: "main", address: "940 Wakashan Ave", city: "Kitimat", phone: "250-632-8985", lat: 54.0522, lng: -128.6536 },
  { name: "Smithers Public Library", system: "Smithers Public Library", branch_type: "main", address: "3817 Alfred Ave", city: "Smithers", phone: "250-847-3043", lat: 54.7800, lng: -127.1667 },
  { name: "Fort St. John Public Library", system: "Fort St. John Public Library", branch_type: "main", address: "10015 100th Ave", city: "Fort St. John", phone: "250-785-3731", lat: 56.2465, lng: -120.8476 },
  { name: "Dawson Creek Public Library", system: "Dawson Creek Public Library", branch_type: "main", address: "1001 McKellar Ave", city: "Dawson Creek", phone: "250-782-4661", lat: 55.7596, lng: -120.2377 },

  // SUNSHINE COAST / SQUAMISH
  { name: "Gibsons & District Public Library", system: "Gibsons & District Public Library", branch_type: "main", address: "470 S Fletcher Rd", city: "Gibsons", phone: "604-886-2130", lat: 49.4022, lng: -123.5058 },
  { name: "Sechelt Public Library", system: "Sechelt Public Library", branch_type: "main", address: "5797 Cowrie St", city: "Sechelt", phone: "604-885-3260", lat: 49.4742, lng: -123.7545 },
  { name: "Powell River Public Library", system: "Powell River Public Library", branch_type: "main", address: "4411 Michigan Ave", city: "Powell River", phone: "604-485-4796", lat: 49.8353, lng: -124.5247 },
  { name: "Squamish Public Library", system: "Squamish Public Library", branch_type: "main", address: "37907 2nd Ave", city: "Squamish", phone: "604-892-3110", lat: 49.7016, lng: -123.1558 },
  { name: "Whistler Public Library", system: "Whistler Public Library", branch_type: "main", address: "4329 Main St", city: "Whistler", phone: "604-935-8433", lat: 50.1163, lng: -122.9574 },
  { name: "Pemberton & District Public Library", system: "Pemberton & District Public Library", branch_type: "main", address: "7390 Cottonwood St", city: "Pemberton", phone: "604-894-6916", lat: 50.3165, lng: -122.8028 },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

async function importLibraries() {
  console.log("Starting BC public libraries import...");
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    let skipped = 0;
    
    for (const lib of LIBRARIES) {
      const slug = generateSlug(lib.name);
      
      // Check if exists
      const exists = await client.query(
        "SELECT id FROM entities WHERE slug = $1",
        [slug]
      );
      
      if (exists.rows.length > 0) {
        skipped++;
        continue;
      }
      
      await client.query(`
        INSERT INTO entities (
          slug, name, entity_type_id, 
          latitude, longitude,
          phone, website,
          address_line1, city, postal_code,
          configuration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        slug,
        lib.name,
        'library',
        lib.lat,
        lib.lng,
        lib.phone?.substring(0, 30) || null,
        lib.website || null,
        lib.address,
        lib.city,
        lib.postal_code || null,
        JSON.stringify({
          library_system: lib.system,
          branch_type: lib.branch_type
        })
      ]);
      
      imported++;
    }
    
    await client.query("COMMIT");
    
    console.log(`\nImport complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped (existing): ${skipped}`);
    
    // Verification
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM entities WHERE entity_type_id = 'library'
    `);
    console.log(`  Total libraries: ${countResult.rows[0].total}`);
    
    // Distribution by system
    const distResult = await client.query(`
      SELECT 
        configuration->>'library_system' as system,
        COUNT(*) as branches
      FROM entities
      WHERE entity_type_id = 'library'
      GROUP BY configuration->>'library_system'
      ORDER BY branches DESC
      LIMIT 15
    `);
    
    console.log(`\nDistribution by library system:`);
    for (const row of distResult.rows) {
      console.log(`  ${row.system}: ${row.branches}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importLibraries().catch(console.error);
