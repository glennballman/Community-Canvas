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

// All municipalities from Firecrawl data
export const ALL_MUNICIPALITIES = [
  "City of Abbotsford",
  "Village of Anmore",
  "Village of Belcarra",
  "Bowen Island Municipality",
  "City of Burnaby",
  "City of Chilliwack",
  "City of Coquitlam",
  "Corporation of Delta",
  "District of Hope",
  "District of Kent",
  "Village of Harrison Hot Springs",
  "City of Langley",
  "Township of Langley",
  "Village of Lions Bay",
  "City of Maple Ridge",
  "District of Mission",
  "City of New Westminster",
  "City of North Vancouver",
  "District of North Vancouver",
  "City of Pitt Meadows",
  "City of Port Coquitlam",
  "City of Port Moody",
  "City of Richmond",
  "City of Surrey",
  "Tsawwassen First Nation",
  "City of Vancouver",
  "District of West Vancouver",
  "City of White Rock",
  "Bamfield"
].sort();

// Shared/Regional sources that appear across all municipalities
export const SHARED_SOURCES: DataSource[] = [
  { category: "transit", source_name: "TransLink Alerts", url: "https://www.translink.ca/alerts", description: "Real-time alerts and service advisories for SkyTrain, bus, SeaBus, and West Coast Express across Metro Vancouver", is_shared: true },
  { category: "transit", source_name: "TransLink Trip Planner", url: "https://www.translink.ca/trip-planner", description: "Plan trips across Metro Vancouver's integrated transit network including bus, SkyTrain, SeaBus, and West Coast Express", is_shared: true },
  { category: "power", source_name: "BC Hydro Outage Map", url: "https://www.bchydro.com/safety-outages/power-outages/outage_map.html", description: "Real-time power outage map for all of British Columbia including Metro Vancouver and Fraser Valley", is_shared: true },
  { category: "emergency", source_name: "Metro Vancouver AirMap", url: "https://gis.metrovancouver.org/maps/air", description: "Real-time air quality monitoring and Air Quality Health Index for the Lower Fraser Valley", is_shared: true },
  { category: "emergency", source_name: "Environment Canada Weather Alerts", url: "https://weather.gc.ca/warnings/index_e.html", description: "Official weather warnings, watches, and alerts for all BC regions from Environment and Climate Change Canada", is_shared: true },
  { category: "emergency", source_name: "Emergency Info BC", url: "https://www.emergencyinfobc.gov.bc.ca/", description: "Provincial emergency alerts, evacuations, and disaster response information for British Columbia", is_shared: true },
  { category: "emergency", source_name: "DriveBC Road Conditions", url: "https://www.drivebc.ca/", description: "Real-time highway conditions, road closures, and traffic cameras for all BC highways and major routes", is_shared: true },
  { category: "aviation", source_name: "Vancouver International Airport (YVR)", url: "https://www.yvr.ca/en/passengers/flights", description: "Real-time flight arrivals and departures for Vancouver International Airport, the primary international airport serving Metro Vancouver", is_shared: true },
  { category: "aviation", source_name: "Harbour Air Flight Status", url: "https://harbourair.com/flight-status/", description: "Real-time flight status for Harbour Air seaplane services between Vancouver, Victoria, Nanaimo, and other coastal destinations", is_shared: true },
  { category: "aviation", source_name: "Helijet Scheduled Flights", url: "https://helijet.com/scheduled-airline/", description: "Scheduled helicopter service information between Vancouver, Victoria, and other BC locations", is_shared: true },
  { category: "aviation", source_name: "Boundary Bay Airport", url: "https://www.boundarybayairport.com/", description: "General aviation airport in Delta serving private aircraft, flight training, and regional aviation services", is_shared: true },
  { category: "aviation", source_name: "Seair Seaplanes", url: "https://www.seairseaplanes.com/", description: "Scheduled seaplane flights and charters serving Gulf Islands and coastal BC communities", is_shared: true },
  { category: "economic", source_name: "Metro Vancouver Regional District", url: "https://www.metrovancouver.org/", description: "Regional planning, air quality, water services, and economic data for 21 Metro Vancouver municipalities", is_shared: true },
  { category: "economic", source_name: "Fraser Valley Regional District", url: "https://www.fvrd.ca/", description: "Regional services, planning, and economic development for Fraser Valley communities", is_shared: true },
  
  // Public Health
  { category: "health", source_name: "Fraser Health Authority", url: "https://www.fraserhealth.ca/health-topics-a-to-z/public-health-alerts", description: "Public health alerts and advisories for Fraser Health region", is_shared: true },
  { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/en/health-alerts", description: "Health alerts for Vancouver, Richmond, North Shore, Sea-to-Sky, Sunshine Coast, and Central Coast", is_shared: true },
  { category: "health", source_name: "BC CDC Health Alerts", url: "https://www.bccdc.ca/about/news-stories/news-releases", description: "Provincial health alerts and disease outbreak information from BC Centre for Disease Control", is_shared: true },
  { category: "health", source_name: "HealthLink BC", url: "https://www.healthlinkbc.ca/healthlinkbc-files/drinking-water-advisories", description: "Drinking water advisories and boil water notices across BC", is_shared: true },
  
  // Environment & Climate
  { category: "environment", source_name: "BC Wildfire Service", url: "https://wildfiresituation.nrs.gov.bc.ca/map", description: "Active wildfire map and fire danger ratings for all of British Columbia", is_shared: true },
  { category: "environment", source_name: "BC Air Quality", url: "https://www.env.gov.bc.ca/epd/bcairquality/data/aqhi-table.html", description: "Real-time Air Quality Health Index readings for BC monitoring stations", is_shared: true },
  { category: "environment", source_name: "Environment Canada Heat Warnings", url: "https://weather.gc.ca/warnings/index_e.html?prov=bc", description: "Heat warnings, extreme cold alerts, and weather advisories for BC", is_shared: true },
  { category: "environment", source_name: "BC Drought Information", url: "https://www2.gov.bc.ca/gov/content/environment/air-land-water/water/drought-flooding-dikes-dams/drought-information", description: "Provincial drought levels and water restriction information", is_shared: true },
  
  // Education
  { category: "education", source_name: "BC School Closures", url: "https://www.bced.gov.bc.ca/", description: "Ministry of Education announcements affecting BC schools", is_shared: true },
  { category: "education", source_name: "Metro Vancouver School Districts", url: "https://www.bcsta.org/school-districts/", description: "Links to all BC school district websites for closure announcements", is_shared: true },
  
  // Housing & Shelters
  { category: "housing", source_name: "BC Housing", url: "https://www.bchousing.org/", description: "Provincial housing programs, emergency shelter information, and housing registry", is_shared: true },
  { category: "housing", source_name: "Metro Vancouver Shelter Listings", url: "https://www.metrovancouver.org/services/regional-planning/homelessness", description: "Regional homelessness response and shelter information", is_shared: true },
  { category: "housing", source_name: "Extreme Weather Response", url: "https://www.bc211.ca/", description: "211 BC - Information on extreme weather shelters and emergency services", is_shared: true },
  
  // Parks & Recreation
  { category: "parks", source_name: "BC Parks Alerts", url: "https://bcparks.ca/park-advisories/", description: "Park closures, trail advisories, and campground status for BC Parks", is_shared: true },
  { category: "parks", source_name: "Metro Vancouver Parks", url: "https://www.metrovancouver.org/parks", description: "Regional park closures, trail conditions, and beach advisories", is_shared: true },
  { category: "parks", source_name: "Parks Canada - Pacific", url: "https://www.pc.gc.ca/en/voyage-travel/regles-rules/conditions/bc", description: "National park conditions and closures in British Columbia", is_shared: true },
  
  // Digital Services
  { category: "digital", source_name: "BC Government Service Status", url: "https://www2.gov.bc.ca/gov/content/home", description: "Provincial government online services status", is_shared: true },
  { category: "digital", source_name: "Service BC Status", url: "https://www.servicebc.gov.bc.ca/", description: "Status of Service BC locations and online services", is_shared: true },
  
  // Weather
  { category: "weather", source_name: "Environment Canada - Vancouver", url: "https://weather.gc.ca/city/pages/bc-74_metric_e.html", description: "Current conditions and forecast for Vancouver and Metro area", is_shared: true },
  { category: "weather", source_name: "Environment Canada - Abbotsford", url: "https://weather.gc.ca/city/pages/bc-63_metric_e.html", description: "Current conditions and forecast for Fraser Valley", is_shared: true },
  { category: "weather", source_name: "Weather Network - Vancouver", url: "https://www.theweathernetwork.com/ca/weather/british-columbia/vancouver", description: "Extended forecast and radar for Metro Vancouver", is_shared: true },
  { category: "weather", source_name: "BC Weather Warnings", url: "https://weather.gc.ca/warnings/index_e.html?prov=bc", description: "All active weather warnings for British Columbia", is_shared: true },
  
  // Marine & Tides
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
  
  // Financial/Markets
  { category: "financial", source_name: "Gas Prices - Vancouver", url: "https://www.gasbuddy.com/gasprices/british-columbia/vancouver", description: "Current gas prices in Metro Vancouver", is_shared: true },
  { category: "financial", source_name: "Gas Prices - BC", url: "https://www.gasbuddy.com/charts", description: "Gas price trends for British Columbia", is_shared: true },
  { category: "financial", source_name: "USD/CAD Exchange Rate", url: "https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/", description: "Bank of Canada daily exchange rates", is_shared: true },
  { category: "financial", source_name: "TSX Composite Index", url: "https://www.tmx.com/", description: "Toronto Stock Exchange market data", is_shared: true },
  { category: "financial", source_name: "Yahoo Finance - TSX", url: "https://finance.yahoo.com/quote/%5EGSPTSE/", description: "S&P/TSX Composite Index live data", is_shared: true },
  
  // Additional Emergency Sources
  { category: "emergency", source_name: "Tsunami Warning - NOAA", url: "https://tsunami.gov/", description: "Pacific Tsunami Warning Center alerts", is_shared: true },
  { category: "emergency", source_name: "Earthquakes - USGS", url: "https://earthquake.usgs.gov/earthquakes/map/?extent=47.5,-130&extent=52,-120", description: "Recent earthquakes near BC from USGS", is_shared: true },
  { category: "emergency", source_name: "Earthquakes Canada", url: "https://earthquakescanada.nrcan.gc.ca/index-en.php", description: "Recent seismic activity in Canada", is_shared: true },
  
  // Additional Transit Sources
  { category: "transit", source_name: "BC Ferries Sailings", url: "https://www.bcferries.com/current-conditions", description: "Current sailing conditions and wait times", is_shared: true },
  { category: "transit", source_name: "BC Ferries Departures", url: "https://www.bcferries.com/current-conditions/departures", description: "Departure bay current conditions", is_shared: true },
  { category: "transit", source_name: "George Massey Tunnel", url: "https://www.drivebc.ca/", description: "Traffic conditions for George Massey Tunnel", is_shared: true },
  { category: "transit", source_name: "Port Mann Bridge", url: "https://www.drivebc.ca/", description: "Port Mann Bridge traffic and conditions", is_shared: true },
  { category: "transit", source_name: "Alex Fraser Bridge", url: "https://www.drivebc.ca/", description: "Alex Fraser Bridge traffic status", is_shared: true },
  { category: "transit", source_name: "Lions Gate Bridge", url: "https://www.th.gov.bc.ca/LGBridge/", description: "Lions Gate Bridge lane configuration and traffic", is_shared: true },
  { category: "transit", source_name: "Ironworkers Memorial Bridge", url: "https://www.drivebc.ca/", description: "Second Narrows Bridge traffic conditions", is_shared: true },
  { category: "transit", source_name: "EasyPark Parkades", url: "https://www.easypark.ca/find-parking", description: "Downtown Vancouver parkade availability", is_shared: true },
  { category: "transit", source_name: "Impark Parking", url: "https://lots.impark.com/", description: "Impark lot locations and rates", is_shared: true },
  
  // Additional Health Sources
  { category: "health", source_name: "ER Wait Times - VGH", url: "https://www.edwaittimes.ca/WaitTimes.aspx", description: "Emergency room wait times at Vancouver General Hospital", is_shared: true },
  { category: "health", source_name: "ER Wait Times - BC", url: "https://www.edwaittimes.ca/", description: "Emergency department wait times across BC", is_shared: true },
];

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
    { category: "emergency", source_name: "Bamfield Community", url: "https://bamfieldcommunity.com", description: "Community emergency information", is_shared: false },
    { category: "aviation", source_name: "Lady Rose Marine", url: "https://www.ladyrosemarine.com", description: "Ferry service to Bamfield", is_shared: false },
    { category: "power", source_name: "BC Hydro - Bamfield", url: "https://www.bchydro.com/power-outages", description: "Power outage information", is_shared: false },
  ],
};

export function getSourcesForMunicipality(name: string): DataSource[] {
  const municipal = MUNICIPAL_SOURCES[name] || [];
  return [...SHARED_SOURCES, ...municipal];
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
