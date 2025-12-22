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

// This will be populated by Firecrawl agent results
// For now, placeholder structure showing expected format
export const METRO_VANCOUVER_SOURCES: MunicipalitySources[] = [
  {
    name: "Shared/Regional",
    data_sources: [
      { category: "transit", source_name: "TransLink Service Alerts", url: "https://www.translink.ca/service-alerts", is_shared: true },
      { category: "transit", source_name: "SkyTrain Status", url: "https://www.translink.ca/schedules-and-maps/skytrain", is_shared: true },
      { category: "power", source_name: "BC Hydro Outages", url: "https://www.bchydro.com/power-outages/app/outage-map.html", is_shared: true },
      { category: "ferry", source_name: "BC Ferries Current Conditions", url: "https://www.bcferries.com/current-conditions", is_shared: true },
      { category: "traffic", source_name: "DriveBC", url: "https://drivebc.ca", is_shared: true },
      { category: "weather", source_name: "Environment Canada", url: "https://weather.gc.ca/city/pages/bc-74_metric_e.html", is_shared: true },
      { category: "air_quality", source_name: "BC Air Quality", url: "https://www.env.gov.bc.ca/epd/bcairquality/", is_shared: true },
      { category: "fire", source_name: "BC Wildfire Service", url: "https://wildfiresituation.nrs.gov.bc.ca/map", is_shared: true },
    ]
  },
  {
    name: "Vancouver",
    data_sources: [
      { category: "emergency", source_name: "City of Vancouver Alerts", url: "https://vancouver.ca/news-calendar/news.aspx", is_shared: false },
      { category: "water", source_name: "Metro Vancouver Water", url: "https://metrovancouver.org/services/water", is_shared: false },
      { category: "parking", source_name: "EasyPark Vancouver", url: "https://www.easypark.ca/find-parking", is_shared: false },
      { category: "closures", source_name: "Vancouver Street Closures", url: "https://vancouver.ca/streets-transportation/road-closures.aspx", is_shared: false },
      { category: "health", source_name: "Vancouver Coastal Health", url: "https://www.vch.ca/", is_shared: false },
      { category: "events", source_name: "Vancouver Events", url: "https://vancouver.ca/news-calendar/calendar-of-events.aspx", is_shared: false },
      { category: "facilities", source_name: "Vancouver Parks & Rec", url: "https://vancouver.ca/parks-recreation-culture.aspx", is_shared: false },
      { category: "waste", source_name: "Vancouver Garbage Collection", url: "https://vancouver.ca/home-property-development/garbage-and-recycling-schedule.aspx", is_shared: false },
    ]
  },
  {
    name: "Burnaby",
    data_sources: [
      { category: "emergency", source_name: "Burnaby Emergency Alerts", url: "https://www.burnaby.ca/our-city/emergency-preparedness", is_shared: false },
      { category: "closures", source_name: "Burnaby Road Closures", url: "https://www.burnaby.ca/services-and-payments/roads-and-sidewalks", is_shared: false },
      { category: "facilities", source_name: "Burnaby Recreation", url: "https://www.burnaby.ca/recreation-and-arts", is_shared: false },
    ]
  },
  {
    name: "Surrey",
    data_sources: [
      { category: "emergency", source_name: "Surrey Emergency Program", url: "https://www.surrey.ca/about-surrey/emergency-preparedness", is_shared: false },
      { category: "closures", source_name: "Surrey Road Closures", url: "https://www.surrey.ca/services-payments/roads-transportation", is_shared: false },
    ]
  },
  {
    name: "Richmond",
    data_sources: [
      { category: "emergency", source_name: "Richmond Emergency", url: "https://www.richmond.ca/safety/prepare.htm", is_shared: false },
      { category: "airport", source_name: "YVR Airport", url: "https://www.yvr.ca/en/passengers/flights", is_shared: false },
    ]
  },
  {
    name: "North Vancouver City",
    data_sources: [
      { category: "emergency", source_name: "CNV Emergency", url: "https://www.cnv.org/city-services/emergency-preparedness", is_shared: false },
    ]
  },
  {
    name: "North Vancouver District",
    data_sources: [
      { category: "emergency", source_name: "DNV Emergency", url: "https://www.dnv.org/emergency-preparedness", is_shared: false },
    ]
  },
  {
    name: "West Vancouver",
    data_sources: [
      { category: "emergency", source_name: "West Van Emergency", url: "https://westvancouver.ca/emergency", is_shared: false },
      { category: "ferry", source_name: "Horseshoe Bay Terminal", url: "https://www.bcferries.com/terminals/horseshoe-bay", is_shared: false },
    ]
  },
  {
    name: "Coquitlam",
    data_sources: [
      { category: "emergency", source_name: "Coquitlam Emergency", url: "https://www.coquitlam.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Port Coquitlam",
    data_sources: [
      { category: "emergency", source_name: "PoCo Emergency", url: "https://www.portcoquitlam.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Port Moody",
    data_sources: [
      { category: "emergency", source_name: "Port Moody Emergency", url: "https://www.portmoody.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "New Westminster",
    data_sources: [
      { category: "emergency", source_name: "New West Emergency", url: "https://www.newwestcity.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Delta",
    data_sources: [
      { category: "emergency", source_name: "Delta Emergency", url: "https://www.delta.ca/emergency", is_shared: false },
      { category: "ferry", source_name: "Tsawwassen Terminal", url: "https://www.bcferries.com/terminals/tsawwassen", is_shared: false },
    ]
  },
  {
    name: "Langley City",
    data_sources: [
      { category: "emergency", source_name: "Langley City Emergency", url: "https://www.langleycity.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Langley Township",
    data_sources: [
      { category: "emergency", source_name: "TOL Emergency", url: "https://www.tol.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Maple Ridge",
    data_sources: [
      { category: "emergency", source_name: "Maple Ridge Emergency", url: "https://www.mapleridge.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Pitt Meadows",
    data_sources: [
      { category: "emergency", source_name: "Pitt Meadows Emergency", url: "https://www.pittmeadows.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "White Rock",
    data_sources: [
      { category: "emergency", source_name: "White Rock Emergency", url: "https://www.whiterockcity.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Anmore",
    data_sources: [
      { category: "emergency", source_name: "Anmore Emergency", url: "https://www.anmore.com/emergency", is_shared: false },
    ]
  },
  {
    name: "Belcarra",
    data_sources: [
      { category: "emergency", source_name: "Belcarra Emergency", url: "https://www.belcarra.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Bowen Island",
    data_sources: [
      { category: "emergency", source_name: "Bowen Island Emergency", url: "https://www.bowenislandmunicipality.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Lions Bay",
    data_sources: [
      { category: "emergency", source_name: "Lions Bay Emergency", url: "https://www.lionsbay.ca/emergency", is_shared: false },
    ]
  },
  {
    name: "Tsawwassen First Nation",
    data_sources: [
      { category: "emergency", source_name: "TFN Emergency", url: "https://www.tsawwassenfirstnation.com", is_shared: false },
    ]
  },
  {
    name: "Bamfield",
    data_sources: [
      { category: "emergency", source_name: "Bamfield Community", url: "https://bamfieldcommunity.com", is_shared: false },
      { category: "ferry", source_name: "Lady Rose Marine", url: "https://www.ladyrosemarine.com", is_shared: false },
      { category: "power", source_name: "BC Hydro - Bamfield", url: "https://www.bchydro.com/power-outages", is_shared: false },
    ]
  }
];

export function getSourcesForMunicipality(name: string): DataSource[] {
  const municipal = METRO_VANCOUVER_SOURCES.find(m => m.name === name);
  const shared = METRO_VANCOUVER_SOURCES.find(m => m.name === "Shared/Regional");
  
  const sources: DataSource[] = [];
  if (shared) sources.push(...shared.data_sources);
  if (municipal) sources.push(...municipal.data_sources);
  
  return sources;
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

export const ALL_MUNICIPALITIES = METRO_VANCOUVER_SOURCES
  .map(m => m.name)
  .filter(n => n !== "Shared/Regional")
  .sort();
