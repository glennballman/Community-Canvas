import { GEO_HIERARCHY, getNode, getAncestors, type GeoNode } from "./geography";

export interface DataSource {
  category: string;
  source_name: string;
  url: string;
  description?: string;
  is_shared: boolean;
}

export interface MunicipalitySources {
  name: string;
  data_sources: DataSource[];
}

// Category mapping from Firecrawl categories to dashboard category IDs
export function mapCategory(firecrawlCategory: string): string {
  const cat = firecrawlCategory.toLowerCase();
  if (cat.includes('aviation') || cat.includes('airport') || cat.includes('heliport') || cat.includes('seaplane')) return 'aviation';
  if (cat.includes('water') || cat.includes('sewer')) return 'water';
  if (cat.includes('power') || cat.includes('hydro') || cat.includes('utilities') && !cat.includes('water')) return 'power';
  if (cat.includes('garbage') || cat.includes('recycling') || cat.includes('waste')) return 'waste';
  if (cat.includes('transit') || cat.includes('road') || cat.includes('traffic') || cat.includes('parking') || cat.includes('bridge') || cat.includes('tunnel')) return 'transit';
  if (cat.includes('emergency') || cat.includes('fire') || cat.includes('police') || cat.includes('alert') || cat.includes('tsunami') || cat.includes('earthquake')) return 'emergency';
  if (cat.includes('news') || cat.includes('media')) return 'news';
  if (cat.includes('economic') || cat.includes('government') || cat.includes('permit') || cat.includes('budget') || cat.includes('development')) return 'economic';
  if (cat.includes('health') || cat.includes('medical') || cat.includes('hospital') || cat.includes('wait time')) return 'health';
  if (cat.includes('environment') || cat.includes('climate') || cat.includes('air quality') || cat.includes('wildfire')) return 'environment';
  if (cat.includes('education') || cat.includes('school') || cat.includes('university')) return 'education';
  if (cat.includes('housing') || cat.includes('shelter') || cat.includes('homeless')) return 'housing';
  if (cat.includes('parks') || cat.includes('recreation') || cat.includes('trails')) return 'parks';
  if (cat.includes('digital') || cat.includes('website') || cat.includes('online') || cat.includes('app')) return 'digital';
  if (cat.includes('weather') || cat.includes('forecast') || cat.includes('temperature')) return 'weather';
  if (cat.includes('marine') || cat.includes('tide') || cat.includes('ocean') || cat.includes('beach')) return 'marine';
  if (cat.includes('event') || cat.includes('concert') || cat.includes('game') || cat.includes('festival')) return 'events';
  if (cat.includes('financial') || cat.includes('gas price') || cat.includes('exchange') || cat.includes('stock') || cat.includes('market')) return 'financial';
  return 'other';
}

// =============================================================================
// PROVINCIAL SOURCES - Apply to all of BC
// =============================================================================
export const PROVINCIAL_SOURCES: DataSource[] = [
  // Power & Utilities
  { category: "power", source_name: "BC Hydro Outage Map", url: "https://www.bchydro.com/safety-outages/power-outages/outage_map.html", description: "Real-time power outage map for all of British Columbia", is_shared: true },
  
  // Emergency & Safety
  { category: "emergency", source_name: "Environment Canada Weather Alerts", url: "https://weather.gc.ca/warnings/index_e.html", description: "Official weather warnings, watches, and alerts for all BC regions", is_shared: true },
  { category: "emergency", source_name: "Emergency Info BC", url: "https://www.emergencyinfobc.gov.bc.ca/", description: "Provincial emergency alerts, evacuations, and disaster response", is_shared: true },
  { category: "emergency", source_name: "DriveBC Road Conditions", url: "https://www.drivebc.ca/", description: "Real-time highway conditions, road closures, and traffic cameras", is_shared: true },
  { category: "emergency", source_name: "Tsunami Warning - NOAA", url: "https://tsunami.gov/", description: "Pacific Tsunami Warning Center alerts", is_shared: true },
  { category: "emergency", source_name: "Earthquakes Canada", url: "https://earthquakescanada.nrcan.gc.ca/index-en.php", description: "Recent seismic activity in Canada", is_shared: true },
  { category: "emergency", source_name: "Earthquakes - USGS", url: "https://earthquake.usgs.gov/earthquakes/map/?extent=47.5,-130&extent=52,-120", description: "Recent earthquakes near BC", is_shared: true },
  
  // Environment & Climate
  { category: "environment", source_name: "BC Wildfire Service", url: "https://wildfiresituation.nrs.gov.bc.ca/map", description: "Active wildfire map and fire danger ratings", is_shared: true },
  { category: "environment", source_name: "BC Air Quality", url: "https://www.env.gov.bc.ca/epd/bcairquality/data/aqhi-table.html", description: "Real-time Air Quality Health Index readings", is_shared: true },
  { category: "environment", source_name: "BC Drought Information", url: "https://www2.gov.bc.ca/gov/content/environment/air-land-water/water/drought-flooding-dikes-dams/drought-information", description: "Provincial drought levels and water restrictions", is_shared: true },
  
  // Health
  { category: "health", source_name: "BC CDC Health Alerts", url: "https://www.bccdc.ca/about/news-stories/news-releases", description: "Provincial health alerts and disease outbreak information", is_shared: true },
  { category: "health", source_name: "HealthLink BC", url: "https://www.healthlinkbc.ca/healthlinkbc-files/drinking-water-advisories", description: "Drinking water advisories and boil water notices", is_shared: true },
  { category: "health", source_name: "ER Wait Times - BC", url: "https://www.edwaittimes.ca/", description: "Emergency department wait times across BC", is_shared: true },
  
  // Education
  { category: "education", source_name: "BC School Closures", url: "https://www.bced.gov.bc.ca/", description: "Ministry of Education announcements", is_shared: true },
  
  // Housing
  { category: "housing", source_name: "BC Housing", url: "https://www.bchousing.org/", description: "Provincial housing programs and emergency shelter info", is_shared: true },
  { category: "housing", source_name: "BC 211", url: "https://www.bc211.ca/", description: "Information on extreme weather shelters and emergency services", is_shared: true },
  
  // Parks
  { category: "parks", source_name: "BC Parks Alerts", url: "https://bcparks.ca/park-advisories/", description: "Park closures, trail advisories, and campground status", is_shared: true },
  { category: "parks", source_name: "Parks Canada - Pacific", url: "https://www.pc.gc.ca/en/voyage-travel/regles-rules/conditions/bc", description: "National park conditions and closures in BC", is_shared: true },
  
  // Digital Services
  { category: "digital", source_name: "BC Government Service Status", url: "https://www2.gov.bc.ca/gov/content/home", description: "Provincial government online services status", is_shared: true },
  { category: "digital", source_name: "Service BC Status", url: "https://www.servicebc.gov.bc.ca/", description: "Status of Service BC locations and online services", is_shared: true },
  
  // Weather
  { category: "weather", source_name: "BC Weather Warnings", url: "https://weather.gc.ca/warnings/index_e.html?prov=bc", description: "All active weather warnings for British Columbia", is_shared: true },
  
  // Ferry
  { category: "ferry", source_name: "BC Ferries Sailings", url: "https://www.bcferries.com/current-conditions", description: "Current sailing conditions and wait times", is_shared: true },
  { category: "ferry", source_name: "BC Ferries Departures", url: "https://www.bcferries.com/current-conditions/departures", description: "Departure bay current conditions", is_shared: true },
  
  // Financial
  { category: "financial", source_name: "Gas Prices - BC", url: "https://www.gasbuddy.com/charts", description: "Gas price trends for British Columbia", is_shared: true },
  { category: "financial", source_name: "USD/CAD Exchange Rate", url: "https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/", description: "Bank of Canada daily exchange rates", is_shared: true },
  { category: "financial", source_name: "TSX Composite Index", url: "https://www.tmx.com/", description: "Toronto Stock Exchange market data", is_shared: true },
  
  // Aviation (provincial scope - serves multiple regions)
  { category: "aviation", source_name: "Harbour Air Flight Status", url: "https://harbourair.com/flight-status/", description: "Seaplane services between Vancouver, Victoria, Nanaimo, and coastal destinations", is_shared: true },
  { category: "aviation", source_name: "Helijet Scheduled Flights", url: "https://helijet.com/scheduled-airline/", description: "Helicopter service between Vancouver, Victoria, and other BC locations", is_shared: true },
];

// =============================================================================
// REGIONAL SOURCES - Apply only to municipalities within specific regions
// =============================================================================
export const REGIONAL_SOURCES: Record<string, DataSource[]> = {
  "metro-vancouver": [
    // Transit
    { category: "transit", source_name: "TransLink Alerts", url: "https://www.translink.ca/alerts", description: "Real-time alerts for SkyTrain, bus, SeaBus, and West Coast Express", is_shared: true },
    { category: "transit", source_name: "TransLink Trip Planner", url: "https://www.translink.ca/trip-planner", description: "Plan trips across Metro Vancouver's transit network", is_shared: true },
    { category: "transit", source_name: "George Massey Tunnel", url: "https://www.drivebc.ca/", description: "Traffic conditions for George Massey Tunnel", is_shared: true },
    { category: "transit", source_name: "Port Mann Bridge", url: "https://www.drivebc.ca/", description: "Port Mann Bridge traffic and conditions", is_shared: true },
    { category: "transit", source_name: "Alex Fraser Bridge", url: "https://www.drivebc.ca/", description: "Alex Fraser Bridge traffic status", is_shared: true },
    { category: "transit", source_name: "Lions Gate Bridge", url: "https://www.th.gov.bc.ca/LGBridge/", description: "Lions Gate Bridge lane configuration and traffic", is_shared: true },
    { category: "transit", source_name: "Ironworkers Memorial Bridge", url: "https://www.drivebc.ca/", description: "Second Narrows Bridge traffic conditions", is_shared: true },
    { category: "transit", source_name: "EasyPark Parkades", url: "https://www.easypark.ca/find-parking", description: "Downtown Vancouver parkade availability", is_shared: true },
    { category: "transit", source_name: "Impark Parking", url: "https://lots.impark.com/", description: "Impark lot locations and rates", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Metro Vancouver Regional District", url: "https://www.metrovancouver.org/", description: "Regional planning, air quality, water services for 21 municipalities", is_shared: true },
    // Air Quality
    { category: "emergency", source_name: "Metro Vancouver AirMap", url: "https://gis.metrovancouver.org/maps/air", description: "Real-time air quality monitoring for Lower Fraser Valley", is_shared: true },
    // Health
    { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/en/health-alerts", description: "Health alerts for Vancouver, Richmond, North Shore", is_shared: true },
    { category: "health", source_name: "Fraser Health Authority", url: "https://www.fraserhealth.ca/health-topics-a-to-z/public-health-alerts", description: "Public health alerts for Fraser Health region", is_shared: true },
    { category: "health", source_name: "ER Wait Times - VGH", url: "https://www.edwaittimes.ca/WaitTimes.aspx", description: "Emergency room wait times at Vancouver General Hospital", is_shared: true },
    // Housing
    { category: "housing", source_name: "Metro Vancouver Shelter Listings", url: "https://www.metrovancouver.org/services/regional-planning/homelessness", description: "Regional homelessness response and shelter information", is_shared: true },
    // Parks
    { category: "parks", source_name: "Metro Vancouver Parks", url: "https://www.metrovancouver.org/parks", description: "Regional park closures, trail conditions, and beach advisories", is_shared: true },
    // Weather
    { category: "weather", source_name: "Environment Canada - Vancouver", url: "https://weather.gc.ca/city/pages/bc-74_metric_e.html", description: "Current conditions and forecast for Vancouver and Metro area", is_shared: true },
    { category: "weather", source_name: "Weather Network - Vancouver", url: "https://www.theweathernetwork.com/ca/weather/british-columbia/vancouver", description: "Extended forecast and radar for Metro Vancouver", is_shared: true },
    // Marine
    { category: "marine", source_name: "Tides - Point Atkinson", url: "https://www.waterlevels.gc.ca/eng/find/zone/6", description: "Tide predictions for Vancouver Harbour area", is_shared: true },
    { category: "marine", source_name: "Tides - Vancouver", url: "https://www.tide-forecast.com/locations/Vancouver-British-Columbia/tides/latest", description: "Current and upcoming tide times for Vancouver", is_shared: true },
    { category: "marine", source_name: "Ocean Conditions - Strait of Georgia", url: "https://www.oceannetworks.ca/observatories/pacific-northeast/salish-sea", description: "Real-time ocean data from Ocean Networks Canada", is_shared: true },
    { category: "marine", source_name: "Marine Weather - Juan de Fuca", url: "https://weather.gc.ca/marine/region_e.html?mapID=02", description: "Marine forecast for Strait of Georgia and Juan de Fuca", is_shared: true },
    { category: "marine", source_name: "Beach Water Quality", url: "https://www.vch.ca/en/service/beach-water-quality-monitoring", description: "Beach swimming advisories for Metro Vancouver", is_shared: true },
    // Events
    { category: "events", source_name: "Vancouver Canucks Schedule", url: "https://www.nhl.com/canucks/schedule", description: "NHL Vancouver Canucks game schedule", is_shared: true },
    { category: "events", source_name: "BC Lions Schedule", url: "https://www.bclions.com/schedule", description: "CFL BC Lions game schedule", is_shared: true },
    { category: "events", source_name: "Vancouver Whitecaps Schedule", url: "https://www.whitecapsfc.com/schedule/", description: "MLS Vancouver Whitecaps game schedule", is_shared: true },
    { category: "events", source_name: "Rogers Arena Events", url: "https://rogersarena.com/events/", description: "Concerts and events at Rogers Arena", is_shared: true },
    { category: "events", source_name: "BC Place Events", url: "https://www.bcplace.com/events", description: "Events and concerts at BC Place Stadium", is_shared: true },
    { category: "events", source_name: "Vancouver Events Calendar", url: "https://www.tourismvancouver.com/events/", description: "Major events and festivals in Vancouver", is_shared: true },
    // Financial
    { category: "financial", source_name: "Gas Prices - Vancouver", url: "https://www.gasbuddy.com/gasprices/british-columbia/vancouver", description: "Current gas prices in Metro Vancouver", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Vancouver International Airport (YVR)", url: "https://www.yvr.ca/en/passengers/flights", description: "Real-time flight arrivals and departures for YVR", is_shared: true },
    { category: "aviation", source_name: "Boundary Bay Airport", url: "https://www.boundarybayairport.com/", description: "General aviation airport in Delta", is_shared: true },
    { category: "aviation", source_name: "Seair Seaplanes", url: "https://www.seairseaplanes.com/", description: "Seaplane flights and charters serving Gulf Islands", is_shared: true },
  ],
  "fraser-valley": [
    // Regional Government
    { category: "economic", source_name: "Fraser Valley Regional District", url: "https://www.fvrd.ca/", description: "Regional services and planning for Fraser Valley", is_shared: true },
    // Health
    { category: "health", source_name: "Fraser Health Authority", url: "https://www.fraserhealth.ca/health-topics-a-to-z/public-health-alerts", description: "Public health alerts for Fraser Health region", is_shared: true },
    // Weather
    { category: "weather", source_name: "Environment Canada - Abbotsford", url: "https://weather.gc.ca/city/pages/bc-63_metric_e.html", description: "Current conditions and forecast for Fraser Valley", is_shared: true },
  ],
  "capital": [
    // Transit
    { category: "transit", source_name: "BC Transit - Victoria", url: "https://www.bctransit.com/victoria", description: "Victoria Regional Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Capital Regional District", url: "https://www.crd.bc.ca/", description: "Regional services for Greater Victoria", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
    // Weather
    { category: "weather", source_name: "Environment Canada - Victoria", url: "https://weather.gc.ca/city/pages/bc-85_metric_e.html", description: "Current conditions and forecast for Victoria", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Victoria International Airport (YYJ)", url: "https://www.victoriaairport.com/", description: "Flight information for Victoria International Airport", is_shared: true },
  ],
  "cowichan-valley": [
    // Regional Government
    { category: "economic", source_name: "Cowichan Valley Regional District", url: "https://www.cvrd.ca/", description: "Regional services for Cowichan Valley", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
  ],
  "alberni-clayoquot": [
    // Regional Government
    { category: "economic", source_name: "Alberni-Clayoquot Regional District", url: "https://www.acrd.bc.ca/", description: "Regional services for Alberni-Clayoquot", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
    // Weather
    { category: "weather", source_name: "Environment Canada - Tofino", url: "https://weather.gc.ca/city/pages/bc-131_metric_e.html", description: "Current conditions and forecast for Tofino area", is_shared: true },
  ],
  "nanaimo": [
    // Transit
    { category: "transit", source_name: "BC Transit - Nanaimo", url: "https://www.bctransit.com/nanaimo", description: "Nanaimo Regional Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Regional District of Nanaimo", url: "https://www.rdn.bc.ca/", description: "Regional services for Nanaimo area", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Nanaimo Airport (YCD)", url: "https://www.nanaimoairport.com/", description: "Flight information for Nanaimo Airport", is_shared: true },
  ],
  "comox-valley": [
    // Transit
    { category: "transit", source_name: "BC Transit - Comox Valley", url: "https://www.bctransit.com/comox-valley", description: "Comox Valley Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Comox Valley Regional District", url: "https://www.comoxvalleyrd.ca/", description: "Regional services for Comox Valley", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Comox Valley Airport (YQQ)", url: "https://www.comoxairport.com/", description: "Flight information for Comox Valley Airport", is_shared: true },
  ],
  "strathcona": [
    // Regional Government
    { category: "economic", source_name: "Strathcona Regional District", url: "https://www.srd.ca/", description: "Regional services for Strathcona", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
  ],
  "mount-waddington": [
    // Regional Government
    { category: "economic", source_name: "Mount Waddington Regional District", url: "https://www.rdmw.bc.ca/", description: "Regional services for Mount Waddington", is_shared: true },
    // Health
    { category: "health", source_name: "Island Health", url: "https://www.islandhealth.ca/news", description: "Health alerts for Vancouver Island", is_shared: true },
  ],
  "central-okanagan": [
    // Transit
    { category: "transit", source_name: "BC Transit - Kelowna", url: "https://www.bctransit.com/kelowna", description: "Kelowna Regional Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Central Okanagan Regional District", url: "https://www.regionaldistrict.com/", description: "Regional services for Central Okanagan", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Kelowna International Airport (YLW)", url: "https://ylw.kelowna.ca/", description: "Flight information for Kelowna Airport", is_shared: true },
  ],
  "thompson-nicola": [
    // Transit
    { category: "transit", source_name: "BC Transit - Kamloops", url: "https://www.bctransit.com/kamloops", description: "Kamloops Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Thompson-Nicola Regional District", url: "https://www.tnrd.ca/", description: "Regional services for Thompson-Nicola", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Kamloops Airport (YKA)", url: "https://www.kamloopsairport.com/", description: "Flight information for Kamloops Airport", is_shared: true },
  ],
  "cariboo": [
    // Regional Government
    { category: "economic", source_name: "Cariboo Regional District", url: "https://www.cariboord.ca/", description: "Regional services for Cariboo", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
  ],
  "fraser-fort-george": [
    // Transit
    { category: "transit", source_name: "BC Transit - Prince George", url: "https://www.bctransit.com/prince-george", description: "Prince George Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Regional District of Fraser-Fort George", url: "https://www.rdffg.bc.ca/", description: "Regional services for Fraser-Fort George", is_shared: true },
    // Health
    { category: "health", source_name: "Northern Health", url: "https://www.northernhealth.ca/health-topics/news-releases", description: "Health alerts for Northern region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Prince George Airport (YXS)", url: "https://www.flyprg.com/", description: "Flight information for Prince George Airport", is_shared: true },
  ],
  "peace-river": [
    // Regional Government
    { category: "economic", source_name: "Peace River Regional District", url: "https://www.prrd.bc.ca/", description: "Regional services for Peace River", is_shared: true },
    // Health
    { category: "health", source_name: "Northern Health", url: "https://www.northernhealth.ca/health-topics/news-releases", description: "Health alerts for Northern region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Fort St. John Airport (YXJ)", url: "https://www.fsjairport.com/", description: "Flight information for Fort St. John Airport", is_shared: true },
  ],
  "kootenay-boundary": [
    // Regional Government
    { category: "economic", source_name: "Regional District of Kootenay Boundary", url: "https://www.rdkb.com/", description: "Regional services for Kootenay Boundary", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
  ],
  "central-kootenay": [
    // Regional Government
    { category: "economic", source_name: "Regional District of Central Kootenay", url: "https://www.rdck.ca/", description: "Regional services for Central Kootenay", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
  ],
  "east-kootenay": [
    // Transit
    { category: "transit", source_name: "BC Transit - Cranbrook", url: "https://www.bctransit.com/cranbrook", description: "Cranbrook Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Regional District of East Kootenay", url: "https://www.rdek.bc.ca/", description: "Regional services for East Kootenay", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Cranbrook Airport (YXC)", url: "https://www.flyckc.com/", description: "Flight information for Canadian Rockies International Airport", is_shared: true },
  ],
  "north-okanagan": [
    // Regional Government
    { category: "economic", source_name: "Regional District of North Okanagan", url: "https://www.rdno.ca/", description: "Regional services for North Okanagan", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
  ],
  "okanagan-similkameen": [
    // Transit
    { category: "transit", source_name: "BC Transit - South Okanagan", url: "https://www.bctransit.com/south-okanagan-similkameen", description: "South Okanagan Transit System", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Regional District of Okanagan-Similkameen", url: "https://www.rdos.bc.ca/", description: "Regional services for Okanagan-Similkameen", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Penticton Regional Airport (YYF)", url: "https://www.penticton.ca/your-city/airport", description: "Flight information for Penticton Airport", is_shared: true },
  ],
  "columbia-shuswap": [
    // Regional Government
    { category: "economic", source_name: "Columbia Shuswap Regional District", url: "https://www.csrd.bc.ca/", description: "Regional services for Columbia-Shuswap", is_shared: true },
    // Health
    { category: "health", source_name: "Interior Health", url: "https://www.interiorhealth.ca/health-topics/news-and-alerts", description: "Health alerts for Interior region", is_shared: true },
  ],
  "squamish-lillooet": [
    // Regional Government
    { category: "economic", source_name: "Squamish-Lillooet Regional District", url: "https://www.slrd.bc.ca/", description: "Regional services for Squamish-Lillooet", is_shared: true },
    // Health
    { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/en/health-alerts", description: "Health alerts for Sea-to-Sky corridor", is_shared: true },
  ],
  "sunshine-coast": [
    // Ferry
    { category: "ferry", source_name: "BC Ferries - Langdale", url: "https://www.bcferries.com/current-conditions/HSB-LNG", description: "Horseshoe Bay to Langdale ferry conditions", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Sunshine Coast Regional District", url: "https://www.scrd.ca/", description: "Regional services for Sunshine Coast", is_shared: true },
    // Health
    { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/en/health-alerts", description: "Health alerts for Sunshine Coast", is_shared: true },
  ],
  "powell-river": [
    // Ferry
    { category: "ferry", source_name: "BC Ferries - Texada Island", url: "https://www.bcferries.com/current-conditions/POW-TXI", description: "Powell River to Texada Island ferry conditions", is_shared: true },
    // Regional Government
    { category: "economic", source_name: "Powell River Regional District", url: "https://www.powellriverrd.bc.ca/", description: "Regional services for Powell River", is_shared: true },
    // Health
    { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/en/health-alerts", description: "Health alerts for Powell River area", is_shared: true },
  ],
  "central-coast": [
    // Regional Government
    { category: "economic", source_name: "Central Coast Regional District", url: "https://www.ccrd.ca/", description: "Regional services for Central Coast", is_shared: true },
    // Health
    { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/en/health-alerts", description: "Health alerts for Central Coast", is_shared: true },
  ],
  "north-coast": [
    // Regional Government
    { category: "economic", source_name: "North Coast Regional District", url: "https://www.northcoastrd.bc.ca/", description: "Regional services for North Coast", is_shared: true },
    // Health
    { category: "health", source_name: "Northern Health", url: "https://www.northernhealth.ca/health-topics/news-releases", description: "Health alerts for Northern region", is_shared: true },
    // Ferry
    { category: "ferry", source_name: "BC Ferries - Prince Rupert", url: "https://www.bcferries.com/current-conditions/PRI-SKI", description: "Prince Rupert ferry conditions", is_shared: true },
  ],
  "kitimat-stikine": [
    // Regional Government
    { category: "economic", source_name: "Regional District of Kitimat-Stikine", url: "https://www.rdks.bc.ca/", description: "Regional services for Kitimat-Stikine", is_shared: true },
    // Health
    { category: "health", source_name: "Northern Health", url: "https://www.northernhealth.ca/health-topics/news-releases", description: "Health alerts for Northern region", is_shared: true },
    // Aviation
    { category: "aviation", source_name: "Northwest Regional Airport (YXT)", url: "https://www.nwra.ca/", description: "Flight information for Terrace-Kitimat Airport", is_shared: true },
  ],
  "bulkley-nechako": [
    // Regional Government
    { category: "economic", source_name: "Regional District of Bulkley-Nechako", url: "https://www.rdbn.bc.ca/", description: "Regional services for Bulkley-Nechako", is_shared: true },
    // Health
    { category: "health", source_name: "Northern Health", url: "https://www.northernhealth.ca/health-topics/news-releases", description: "Health alerts for Northern region", is_shared: true },
  ],
  "northern-rockies": [
    // Regional Government
    { category: "economic", source_name: "Northern Rockies Regional Municipality", url: "https://www.northernrockies.ca/", description: "Regional services for Northern Rockies", is_shared: true },
    // Health
    { category: "health", source_name: "Northern Health", url: "https://www.northernhealth.ca/health-topics/news-releases", description: "Health alerts for Northern region", is_shared: true },
  ],
};

// Legacy alias for backward compatibility
export const SHARED_SOURCES: DataSource[] = PROVINCIAL_SOURCES;

// Municipal-specific sources
export const MUNICIPAL_SOURCES: Record<string, DataSource[]> = {
  "City of Abbotsford": [
    { category: "water", source_name: "Abbotsford Utility Billing", url: "https://www.abbotsford.ca/city-services/utility-billing", description: "Bi-monthly water and sewer utility billing services", is_shared: false },
    { category: "water", source_name: "Water & Wastewater Services", url: "https://www.abbotsford.ca/city-services/water-wastewater", description: "Regional water supply system information for Abbotsford and Mission", is_shared: false },
    { category: "transit", source_name: "Central Fraser Valley Transit", url: "https://www.bctransit.com/abbotsford", description: "BC Transit service for Abbotsford providing bus routes and real-time transit information", is_shared: false },
    { category: "transit", source_name: "Road Closures & Construction", url: "https://www.abbotsford.ca/city-services/transportation-roads/road-closures", description: "Information on road closures, construction updates, and traffic management", is_shared: false },
    { category: "emergency", source_name: "Abbotsford Fire Rescue", url: "https://www.abbotsford.ca/public-safety/fire-rescue-service", description: "24-hour fire prevention, suppression, rescue operations, and emergency response", is_shared: false },
    { category: "emergency", source_name: "Abbotsford Police Department", url: "https://www.abbypd.ca/", description: "Official police department with crime reporting and community programs", is_shared: false },
    { category: "emergency", source_name: "City Alerts & Notifications", url: "https://www.abbotsford.ca/alerts", description: "Emergency alerts system for evacuation orders, alerts, and news releases", is_shared: false },
    { category: "news", source_name: "City News & Media", url: "https://www.abbotsford.ca/city-hall/news-media", description: "Official municipal news source with media releases and bulletins", is_shared: false },
    { category: "economic", source_name: "City Budget & Financial Docs", url: "https://www.abbotsford.ca/city-hall/finance", description: "Annual reports, financial statements, budgets, and long-term financial plans", is_shared: false },
    { category: "economic", source_name: "Building Permits", url: "https://www.abbotsford.ca/city-services/permits-licences/building-permits", description: "Building permit applications, requirements, and issuance processes", is_shared: false },
    { category: "aviation", source_name: "Abbotsford International Airport (YXX)", url: "https://www.abbotsfordairport.ca/", description: "Official airport website with flight tracking and passenger resources", is_shared: false },
    { category: "aviation", source_name: "YXX Flight Departures", url: "https://www.abbotsfordairport.ca/departures", description: "Live departure flight board with real-time flight status", is_shared: false },
    { category: "aviation", source_name: "YXX Flight Arrivals", url: "https://www.abbotsfordairport.ca/arrivals", description: "Live arrival flight board with real-time flight information", is_shared: false },
    { category: "aviation", source_name: "FlightAware - CYXX", url: "https://www.flightaware.com/live/airport/CYXX", description: "Third-party flight tracking service for Abbotsford International Airport", is_shared: false },
  ],
  "Village of Anmore": [
    { category: "water", source_name: "Anmore Water Services", url: "https://anmore.com/services/water-services/", description: "Official water service information including water quality reports", is_shared: false },
    { category: "water", source_name: "Utilities Billing", url: "https://anmore.com/village-hall/taxes-utilities/utilities/", description: "Utility billing information including water rates", is_shared: false },
    { category: "transit", source_name: "Road Projects", url: "https://anmore.com/village-hall/projects/road-projects/", description: "Ongoing and completed road construction projects", is_shared: false },
    { category: "emergency", source_name: "Alertable Emergency System", url: "https://anmore.com/community/safety/alertable/", description: "Free emergency notification system for residents", is_shared: false },
    { category: "emergency", source_name: "Police & Fire Services", url: "https://anmore.com/community/safety/police-fire/", description: "Contact information for Coquitlam RCMP and Sasamat Fire Dept", is_shared: false },
    { category: "news", source_name: "Tri-Cities Dispatch", url: "https://tricitiesdispatch.com/", description: "Independent local news for Anmore, Belcarra, Coquitlam, Port Coquitlam, Port Moody", is_shared: false },
    { category: "news", source_name: "Village Official Website", url: "https://anmore.com/", description: "Official municipal website with latest news and events", is_shared: false },
    { category: "economic", source_name: "Business Licensing", url: "https://anmore.com/business-licence/", description: "Business license application and fee information", is_shared: false },
    { category: "aviation", source_name: "Harbour Air Seaplanes", url: "https://harbourair.com/", description: "Seaplane tours and scenic flights operating from the area", is_shared: false },
    { category: "aviation", source_name: "BLADE Helicopter Charter", url: "https://www.blade.com/flight-routes/vancouver-anmore", description: "Private helicopter charter service", is_shared: false },
  ],
  "City of Vancouver": [
    { category: "water", source_name: "Metro Vancouver Water", url: "https://metrovancouver.org/services/water", description: "Regional water supply information", is_shared: false },
    { category: "transit", source_name: "Vancouver Street Closures", url: "https://vancouver.ca/streets-transportation/road-closures.aspx", description: "Information on road closures and traffic management", is_shared: false },
    { category: "emergency", source_name: "Vancouver Alerts", url: "https://vancouver.ca/news-calendar/news.aspx", description: "City of Vancouver news and alerts", is_shared: false },
    { category: "emergency", source_name: "Vancouver Police Department", url: "https://www.vpd.ca/", description: "Official police department with crime reporting", is_shared: false },
    { category: "emergency", source_name: "Vancouver Fire Rescue", url: "https://www.vancouver.ca/fire-rescue-services.aspx", description: "Fire and rescue services information", is_shared: false },
    { category: "news", source_name: "City of Vancouver News", url: "https://vancouver.ca/news-calendar/news.aspx", description: "Official municipal news releases", is_shared: false },
    { category: "economic", source_name: "Building Permits", url: "https://vancouver.ca/home-property-development/permits-licenses.aspx", description: "Permits and business licenses portal", is_shared: false },
    { category: "economic", source_name: "Budget & Financial Reports", url: "https://vancouver.ca/your-government/budgets-and-financial-reports.aspx", description: "Official city budget documents and financial reports", is_shared: false },
    { category: "aviation", source_name: "YVR Flight Status", url: "https://www.yvr.ca/en/passengers/flights", description: "Official YVR airport with real-time flight information", is_shared: false },
    { category: "aviation", source_name: "YVR Operational Info", url: "https://www.yvr.ca/en/about-yvr/operational-information", description: "YVR operational information and airport alerts", is_shared: false },
    { category: "aviation", source_name: "YVR Alerts", url: "https://www.yvr.ca/en/passengers/alerts", description: "Current airport alerts and service updates", is_shared: false },
    { category: "aviation", source_name: "Harbour Air Seaplanes", url: "https://www.harbourair.com/", description: "Seaplane services from Vancouver's Inner Harbour", is_shared: false },
    { category: "aviation", source_name: "Vancouver Harbour Heliport", url: "https://helijet.com/", description: "Scheduled helicopter airline and charter services", is_shared: false },
  ],
  "District of West Vancouver": [
    { category: "water", source_name: "Water and Sewers", url: "https://westvancouver.ca/services/water-sewers", description: "Water and sewer utility information", is_shared: false },
    { category: "waste", source_name: "Garbage & Recycling", url: "https://westvancouver.ca/services/garbage-recycling/collection-schedules", description: "Curbside garbage and green can collection schedules", is_shared: false },
    { category: "transit", source_name: "Traffic Updates", url: "https://westvancouver.ca/services/transportation/traffic-updates", description: "Real-time traffic updates and road closures", is_shared: false },
    { category: "transit", source_name: "Parking Services", url: "https://westvancouver.ca/services/transportation/parking", description: "Parking information and permits", is_shared: false },
    { category: "emergency", source_name: "North Shore Emergency Mgmt", url: "https://nsem.ca/alertable/", description: "Free emergency alert system for North Shore", is_shared: false },
    { category: "emergency", source_name: "Emergency Services", url: "https://westvancouver.ca/services/emergency-services", description: "Fire, Police, and emergency preparedness resources", is_shared: false },
    { category: "emergency", source_name: "West Van Police", url: "https://westvanpolice.ca/", description: "Official police website with online incident reporting", is_shared: false },
    { category: "news", source_name: "North Shore News", url: "https://www.nsnews.com/", description: "Primary local news for North and West Vancouver", is_shared: false },
    { category: "economic", source_name: "Development Permits", url: "https://westvancouver.ca/business-development/building-development/building-permits-inspections/development-permits", description: "Development permit applications", is_shared: false },
    { category: "economic", source_name: "Business Licences", url: "https://westvancouver.ca/business-development/information-businesses/permits-licences/business-licences", description: "Business license applications and renewals", is_shared: false },
    { category: "aviation", source_name: "Vancouver Harbour Flight Centre", url: "https://www.vhfc.ca/", description: "Seaplane terminal at Burrard Landing", is_shared: false },
    { category: "aviation", source_name: "Helijet Helicopter", url: "https://helijet.com/", description: "Scheduled helicopter and charter services", is_shared: false },
  ],
  "City of Richmond": [
    { category: "aviation", source_name: "YVR Airport", url: "https://www.yvr.ca/en/passengers/flights", description: "Vancouver International Airport located in Richmond", is_shared: false },
    { category: "aviation", source_name: "YVR Operational Info", url: "https://www.yvr.ca/en/about-yvr/operational-information", description: "Airport operations, hours, and ground transportation", is_shared: false },
    { category: "emergency", source_name: "Richmond Emergency", url: "https://www.richmond.ca/safety/prepare.htm", description: "Emergency preparedness information", is_shared: false },
  ],
  "Corporation of Delta": [
    { category: "aviation", source_name: "Boundary Bay Airport (CZBB)", url: "https://www.boundarybayairport.com/", description: "General aviation airport serving private aircraft and flight training", is_shared: false },
    { category: "emergency", source_name: "Delta Emergency", url: "https://www.delta.ca/emergency", description: "Emergency preparedness information", is_shared: false },
  ],
  "City of Burnaby": [
    { category: "emergency", source_name: "Burnaby Emergency", url: "https://www.burnaby.ca/our-city/emergency-preparedness", description: "Emergency alerts and preparedness", is_shared: false },
    { category: "transit", source_name: "Road Closures", url: "https://www.burnaby.ca/services-and-payments/roads-and-sidewalks", description: "Road closures and construction", is_shared: false },
  ],
  "City of Surrey": [
    { category: "emergency", source_name: "Surrey Emergency", url: "https://www.surrey.ca/about-surrey/emergency-preparedness", description: "Emergency program and alerts", is_shared: false },
    { category: "transit", source_name: "Road Closures", url: "https://www.surrey.ca/services-payments/roads-transportation", description: "Road closures and transportation", is_shared: false },
  ],
  "City of Coquitlam": [
    { category: "emergency", source_name: "Coquitlam Emergency", url: "https://www.coquitlam.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "City of Port Coquitlam": [
    { category: "emergency", source_name: "PoCo Emergency", url: "https://www.portcoquitlam.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "City of Port Moody": [
    { category: "emergency", source_name: "Port Moody Emergency", url: "https://www.portmoody.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "City of New Westminster": [
    { category: "emergency", source_name: "New West Emergency", url: "https://www.newwestcity.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "City of North Vancouver": [
    { category: "emergency", source_name: "CNV Emergency", url: "https://www.cnv.org/city-services/emergency-preparedness", description: "Emergency services", is_shared: false },
  ],
  "District of North Vancouver": [
    { category: "emergency", source_name: "DNV Emergency", url: "https://www.dnv.org/emergency-preparedness", description: "Emergency services", is_shared: false },
  ],
  "City of Langley": [
    { category: "emergency", source_name: "Langley City Emergency", url: "https://www.langleycity.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "Township of Langley": [
    { category: "emergency", source_name: "TOL Emergency", url: "https://www.tol.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "City of Maple Ridge": [
    { category: "emergency", source_name: "Maple Ridge Emergency", url: "https://www.mapleridge.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "City of Pitt Meadows": [
    { category: "emergency", source_name: "Pitt Meadows Emergency", url: "https://www.pittmeadows.ca/emergency", description: "Emergency services", is_shared: false },
    { category: "aviation", source_name: "Pitt Meadows Airport (CYPK)", url: "https://www.pittmeadowsairport.com/", description: "General aviation airport with flight training", is_shared: false },
  ],
  "City of White Rock": [
    { category: "water", source_name: "Water Services", url: "https://www.whiterockcity.ca/residents/utilities/water-services", description: "Water utility service and quality reports", is_shared: false },
    { category: "emergency", source_name: "White Rock Fire", url: "https://www.whiterockcity.ca/fire-rescue", description: "Fire and rescue services", is_shared: false },
  ],
  "Village of Belcarra": [
    { category: "emergency", source_name: "Belcarra Emergency", url: "https://www.belcarra.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "Bowen Island Municipality": [
    { category: "emergency", source_name: "Bowen Island Emergency", url: "https://www.bowenislandmunicipality.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "Village of Lions Bay": [
    { category: "emergency", source_name: "Lions Bay Emergency", url: "https://www.lionsbay.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "Tsawwassen First Nation": [
    { category: "emergency", source_name: "TFN Emergency", url: "https://www.tsawwassenfirstnation.com", description: "Emergency services", is_shared: false },
  ],
  "City of Chilliwack": [
    { category: "emergency", source_name: "Chilliwack Emergency", url: "https://www.chilliwack.com/main/emergency", description: "Emergency services", is_shared: false },
    { category: "aviation", source_name: "Chilliwack Airport (CYCW)", url: "https://www.chilliwackairport.com/", description: "General aviation airport", is_shared: false },
  ],
  "District of Mission": [
    { category: "emergency", source_name: "Mission Emergency", url: "https://www.mission.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "District of Hope": [
    { category: "emergency", source_name: "Hope Emergency", url: "https://www.hope.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "District of Kent": [
    { category: "emergency", source_name: "Kent Emergency", url: "https://www.kentbc.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "Village of Harrison Hot Springs": [
    { category: "emergency", source_name: "Harrison Emergency", url: "https://www.harrisonhotsprings.ca/emergency", description: "Emergency services", is_shared: false },
  ],
  "Bamfield": [
    // Community & Emergency
    { category: "emergency", source_name: "Bamfield Community", url: "https://bamfieldcommunity.com", description: "Community news and emergency information", is_shared: false },
    { category: "emergency", source_name: "Bamfield Fire Department", url: "https://bamfieldcommunity.com/fire-department", description: "Volunteer fire department and emergency response", is_shared: false },
    // Ferry & Marine Access
    { category: "ferry", source_name: "Lady Rose Marine Services", url: "https://www.ladyrosemarine.com", description: "MV Frances Barkley passenger/cargo ferry from Port Alberni to Bamfield", is_shared: false },
    // Roads & Access
    { category: "road", source_name: "Bamfield Main Road Conditions", url: "https://www.drivebc.ca", description: "Bamfield Main logging road conditions and closures", is_shared: false },
    { category: "road", source_name: "Lake Cowichan/Youbou Road", url: "https://www.drivebc.ca", description: "Alternative access route via Lake Cowichan and Youbou", is_shared: false },
    // Weather & Marine
    { category: "weather", source_name: "Bamfield Weather", url: "https://weather.gc.ca/city/pages/bc-80_metric_e.html", description: "Environment Canada weather forecast for Bamfield", is_shared: false },
    { category: "weather", source_name: "Barkley Sound Marine Forecast", url: "https://weather.gc.ca/marine/forecast_e.html?mapID=02&siteID=06300", description: "Marine weather for Barkley Sound and approaches", is_shared: false },
    { category: "marine", source_name: "Bamfield Tides", url: "https://www.tides.gc.ca/en/stations/8545", description: "Tide predictions for Bamfield Inlet", is_shared: false },
    // Natural Hazards
    { category: "earthquake", source_name: "Earthquakes Near Bamfield", url: "https://earthquakescanada.nrcan.gc.ca/recent/maps-cartes/index-en.php?tpl_region=west", description: "Recent seismic activity in Cascadia region", is_shared: false },
    { category: "tsunami", source_name: "Tsunami Alerts", url: "https://wcatwc.arh.noaa.gov/", description: "West Coast/Alaska Tsunami Warning Center alerts", is_shared: false },
    { category: "wildfire", source_name: "BC Wildfire Map", url: "https://wildfiresituation.nrs.gov.bc.ca/map", description: "Active wildfires and fire danger rating", is_shared: false },
    { category: "flood", source_name: "BC River Forecast Centre", url: "https://bcrfc.env.gov.bc.ca/warnings/", description: "Flood warnings and streamflow advisories", is_shared: false },
    { category: "weather", source_name: "Atmospheric River Alerts", url: "https://weather.gc.ca/warnings/index_e.html?prov=bc", description: "Weather warnings including atmospheric rivers", is_shared: false },
    // Power & Utilities
    { category: "power", source_name: "BC Hydro - West Coast", url: "https://www.bchydro.com/power-outages/app/outage-map.html", description: "Power outage information for Bamfield area", is_shared: false },
    // Parks & Environment
    { category: "park", source_name: "Pacific Rim National Park Reserve", url: "https://parks.canada.ca/pn-np/bc/pacificrim", description: "National park conditions and closures", is_shared: false },
    { category: "park", source_name: "West Coast Trail", url: "https://parks.canada.ca/pn-np/bc/pacificrim/activ/activ6", description: "Trail conditions and reservations", is_shared: false },
    // Facilities
    { category: "facility", source_name: "Bamfield Marine Sciences Centre", url: "https://www.bamfieldmsc.com", description: "Research and education facility", is_shared: false },
    { category: "facility", source_name: "Bamfield Community School", url: "https://bamfield.sd70.bc.ca/", description: "K-12 community school", is_shared: false },
  ],
};

// Municipalities that have municipal-specific data sources
export const MUNICIPALITIES_WITH_DATA = Object.keys(MUNICIPAL_SOURCES).sort();

// Legacy alias for compatibility
export const ALL_MUNICIPALITIES = MUNICIPALITIES_WITH_DATA;

// Helper to find a municipality node by name
function findMunicipalityByName(name: string): GeoNode | undefined {
  return Object.values(GEO_HIERARCHY).find(
    node => node.level === "municipality" && node.name === name
  );
}

// Helper to get the region ID for a municipality
function getRegionIdForMunicipality(municipalityName: string): string | undefined {
  const muniNode = findMunicipalityByName(municipalityName);
  if (!muniNode) return undefined;
  
  const ancestors = getAncestors(muniNode.id);
  const regionNode = ancestors.find(node => node.level === "region");
  return regionNode?.id;
}

// Get sources with proper geographic inheritance
export function getSourcesForMunicipality(name: string): DataSource[] {
  const municipal = MUNICIPAL_SOURCES[name] || [];
  const regionId = getRegionIdForMunicipality(name);
  const regional = regionId ? (REGIONAL_SOURCES[regionId] || []) : [];
  
  return [...PROVINCIAL_SOURCES, ...regional, ...municipal];
}

// Get sources split by tier for display
export function getSourcesByTier(municipalityName: string): {
  provincial: DataSource[];
  regional: DataSource[];
  municipal: DataSource[];
  regionName?: string;
} {
  const municipal = MUNICIPAL_SOURCES[municipalityName] || [];
  const regionId = getRegionIdForMunicipality(municipalityName);
  const regional = regionId ? (REGIONAL_SOURCES[regionId] || []) : [];
  const regionNode = regionId ? getNode(regionId) : undefined;
  
  return {
    provincial: PROVINCIAL_SOURCES,
    regional,
    municipal,
    regionName: regionNode?.name
  };
}

export function getSourcesByCategory(municipalityName: string): Record<string, DataSource[]> {
  const sources = getSourcesForMunicipality(municipalityName);
  const byCategory: Record<string, DataSource[]> = {};
  
  for (const source of sources) {
    if (!byCategory[source.category]) {
      byCategory[source.category] = [];
    }
    byCategory[source.category].push(source);
  }
  
  return byCategory;
}
