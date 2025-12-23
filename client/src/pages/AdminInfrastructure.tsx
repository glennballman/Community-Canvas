import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plane, 
  Radio, 
  MapPin, 
  Anchor,
  Lightbulb,
  Thermometer,
  CheckCircle,
  XCircle,
  Search,
  Ship,
  Building2,
  Flame,
  Shield,
  Siren
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BC_AIRPORTS, type Airport } from "@shared/aviation";
import { BC_WEATHER_STATIONS, type WeatherStation } from "@shared/weather-stations";
import { BC_MARINE_FACILITIES, type MarineFacility, type MarineFacilityType } from "@shared/marine";
import { BC_EMERGENCY_SERVICES, type EmergencyService, type EmergencyServiceType } from "@shared/emergency-services";
import { GEO_HIERARCHY, type GeoNode } from "@shared/geography";

function getAirportTypeIcon(type: string) {
  switch (type) {
    case 'large_airport': return <Plane className="w-3 h-3" />;
    case 'medium_airport': return <Plane className="w-3 h-3" />;
    case 'small_airport': return <Plane className="w-2.5 h-2.5" />;
    case 'seaplane_base': return <Anchor className="w-3 h-3" />;
    case 'heliport': return <Radio className="w-3 h-3" />;
    case 'closed': return <XCircle className="w-3 h-3" />;
    default: return <Plane className="w-3 h-3" />;
  }
}

function getAirportTypeBadge(type: string) {
  const colors: Record<string, string> = {
    'large_airport': 'bg-green-500/20 text-green-400 border-green-500/30',
    'medium_airport': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'small_airport': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'seaplane_base': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'heliport': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'closed': 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = {
    'large_airport': 'LARGE',
    'medium_airport': 'MEDIUM',
    'small_airport': 'SMALL',
    'seaplane_base': 'SEAPLANE',
    'heliport': 'HELI',
    'closed': 'CLOSED',
  };
  return (
    <Badge variant="outline" className={`text-[9px] ${colors[type] || ''}`}>
      {getAirportTypeIcon(type)}
      <span className="ml-1">{labels[type] || type.toUpperCase()}</span>
    </Badge>
  );
}

function getWeatherTypeIcon(type: string) {
  switch (type) {
    case 'metar': return <Plane className="w-3 h-3" />;
    case 'marine_buoy': return <Anchor className="w-3 h-3" />;
    case 'lightstation': return <Lightbulb className="w-3 h-3" />;
    case 'climate': return <Thermometer className="w-3 h-3" />;
    case 'synop': return <Radio className="w-3 h-3" />;
    default: return <Radio className="w-3 h-3" />;
  }
}

function getWeatherTypeBadge(type: string) {
  const colors: Record<string, string> = {
    'metar': 'bg-green-500/20 text-green-400 border-green-500/30',
    'marine_buoy': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'lightstation': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'climate': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'synop': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const labels: Record<string, string> = {
    'metar': 'METAR',
    'marine_buoy': 'BUOY',
    'lightstation': 'LIGHT',
    'climate': 'CLIMATE',
    'synop': 'SYNOP',
  };
  return (
    <Badge variant="outline" className={`text-[9px] ${colors[type] || ''}`}>
      {getWeatherTypeIcon(type)}
      <span className="ml-1">{labels[type] || type.toUpperCase()}</span>
    </Badge>
  );
}

function getMarineTypeIcon(type: MarineFacilityType) {
  switch (type) {
    case 'coast_guard': return <Anchor className="w-3 h-3" />;
    case 'rescue_station': return <Anchor className="w-3 h-3" />;
    case 'marina': return <Ship className="w-3 h-3" />;
    case 'fuel_dock': return <Ship className="w-3 h-3" />;
    case 'public_wharf': return <Anchor className="w-3 h-3" />;
    case 'harbour_authority': return <Ship className="w-3 h-3" />;
    case 'ferry_terminal': return <Ship className="w-3 h-3" />;
    case 'seaplane_dock': return <Plane className="w-3 h-3" />;
    case 'private_ferry': return <Ship className="w-3 h-3" />;
    case 'water_taxi': return <Ship className="w-3 h-3" />;
    default: return <Ship className="w-3 h-3" />;
  }
}

function getMarineTypeBadge(type: MarineFacilityType) {
  const colors: Record<MarineFacilityType, string> = {
    'coast_guard': 'bg-red-500/20 text-red-400 border-red-500/30',
    'rescue_station': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'marina': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'fuel_dock': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'public_wharf': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'harbour_authority': 'bg-green-500/20 text-green-400 border-green-500/30',
    'ferry_terminal': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'seaplane_dock': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    'private_ferry': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'water_taxi': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  };
  const labels: Record<MarineFacilityType, string> = {
    'coast_guard': 'COAST GUARD',
    'rescue_station': 'RESCUE',
    'marina': 'MARINA',
    'fuel_dock': 'FUEL',
    'public_wharf': 'WHARF',
    'harbour_authority': 'HARBOUR',
    'ferry_terminal': 'FERRY',
    'seaplane_dock': 'SEAPLANE',
    'private_ferry': 'PRIVATE FERRY',
    'water_taxi': 'WATER TAXI',
  };
  return (
    <Badge variant="outline" className={`text-[9px] ${colors[type] || ''}`}>
      {getMarineTypeIcon(type)}
      <span className="ml-1">{labels[type] || type.toUpperCase()}</span>
    </Badge>
  );
}

function getEmergencyTypeIcon(type: EmergencyServiceType) {
  switch (type) {
    case 'hospital': return <Building2 className="w-3 h-3" />;
    case 'fire_station': return <Flame className="w-3 h-3" />;
    case 'municipal_police': return <Shield className="w-3 h-3" />;
    case 'rcmp_detachment': return <Shield className="w-3 h-3" />;
    case 'ambulance_station': return <Siren className="w-3 h-3" />;
    default: return <Building2 className="w-3 h-3" />;
  }
}

function getEmergencyTypeBadge(type: EmergencyServiceType) {
  const colors: Record<EmergencyServiceType, string> = {
    'hospital': 'bg-red-500/20 text-red-400 border-red-500/30',
    'fire_station': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'municipal_police': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'rcmp_detachment': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'ambulance_station': 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  const labels: Record<EmergencyServiceType, string> = {
    'hospital': 'HOSPITAL',
    'fire_station': 'FIRE',
    'municipal_police': 'MUNICIPAL POLICE',
    'rcmp_detachment': 'RCMP',
    'ambulance_station': 'AMBULANCE',
  };
  return (
    <Badge variant="outline" className={`text-[9px] ${colors[type] || ''}`}>
      {getEmergencyTypeIcon(type)}
      <span className="ml-1">{labels[type] || type.toUpperCase()}</span>
    </Badge>
  );
}

function findMatchingMunicipality(name: string | undefined): GeoNode | null {
  if (!name) return null;
  
  const municipalities = Object.values(GEO_HIERARCHY).filter(n => n.level === 'municipality');
  
  for (const muni of municipalities) {
    if (muni.shortName?.toLowerCase() === name.toLowerCase()) return muni;
    if (muni.name.toLowerCase() === name.toLowerCase()) return muni;
    const cleaned = muni.name
      .replace(/^(City of |District of |Township of |Village of |Corporation of |Town of )/i, "")
      .replace(/ Municipality$/i, "");
    if (cleaned.toLowerCase() === name.toLowerCase()) return muni;
  }
  return null;
}

function findMatchingRegion(regionId: string | undefined): GeoNode | null {
  if (!regionId) return null;
  const key = `region-${regionId}`;
  return GEO_HIERARCHY[key] || null;
}

interface AirportWithMatch extends Airport {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface WeatherWithMatch extends WeatherStation {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface MarineWithMatch extends MarineFacility {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface EmergencyWithMatch extends EmergencyService {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

export default function AdminInfrastructure() {
  const [airportSearch, setAirportSearch] = useState("");
  const [weatherSearch, setWeatherSearch] = useState("");
  const [marineSearch, setMarineSearch] = useState("");
  const [emergencySearch, setEmergencySearch] = useState("");
  const [activeTab, setActiveTab] = useState("airports");

  const airportsWithMatches: AirportWithMatch[] = useMemo(() => {
    return BC_AIRPORTS.map(airport => ({
      ...airport,
      matchedMunicipality: findMatchingMunicipality(airport.municipality),
      matchedRegion: findMatchingRegion(airport.region_id),
    }));
  }, []);

  const weatherWithMatches: WeatherWithMatch[] = useMemo(() => {
    return BC_WEATHER_STATIONS.map(station => ({
      ...station,
      matchedMunicipality: findMatchingMunicipality(station.municipality),
      matchedRegion: findMatchingRegion(station.region_id),
    }));
  }, []);

  const marineWithMatches: MarineWithMatch[] = useMemo(() => {
    return BC_MARINE_FACILITIES.map(facility => ({
      ...facility,
      matchedMunicipality: findMatchingMunicipality(facility.municipality),
      matchedRegion: findMatchingRegion(facility.region.toLowerCase().replace(/\s+/g, '-')),
    }));
  }, []);

  const emergencyWithMatches: EmergencyWithMatch[] = useMemo(() => {
    return BC_EMERGENCY_SERVICES.map(service => ({
      ...service,
      matchedMunicipality: findMatchingMunicipality(service.municipality),
      matchedRegion: findMatchingRegion(service.region.toLowerCase().replace(/\s+/g, '-')),
    }));
  }, []);

  const filteredAirports = useMemo(() => {
    if (!airportSearch) return airportsWithMatches;
    const search = airportSearch.toLowerCase();
    return airportsWithMatches.filter(a => 
      a.name.toLowerCase().includes(search) ||
      a.icao?.toLowerCase().includes(search) ||
      a.iata?.toLowerCase().includes(search) ||
      a.tc_lid?.toLowerCase().includes(search) ||
      a.municipality?.toLowerCase().includes(search) ||
      a.matchedMunicipality?.name.toLowerCase().includes(search) ||
      a.matchedRegion?.name.toLowerCase().includes(search)
    );
  }, [airportsWithMatches, airportSearch]);

  const filteredWeather = useMemo(() => {
    if (!weatherSearch) return weatherWithMatches;
    const search = weatherSearch.toLowerCase();
    return weatherWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.station_id.toLowerCase().includes(search) ||
      s.icao?.toLowerCase().includes(search) ||
      s.municipality?.toLowerCase().includes(search) ||
      s.matchedMunicipality?.name.toLowerCase().includes(search) ||
      s.matchedRegion?.name.toLowerCase().includes(search) ||
      s.type.toLowerCase().includes(search)
    );
  }, [weatherWithMatches, weatherSearch]);

  const filteredMarine = useMemo(() => {
    if (!marineSearch) return marineWithMatches;
    const search = marineSearch.toLowerCase();
    return marineWithMatches.filter(f => 
      f.name.toLowerCase().includes(search) ||
      f.municipality?.toLowerCase().includes(search) ||
      f.region?.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search) ||
      f.type.toLowerCase().includes(search)
    );
  }, [marineWithMatches, marineSearch]);

  const filteredEmergency = useMemo(() => {
    if (!emergencySearch) return emergencyWithMatches;
    const search = emergencySearch.toLowerCase();
    return emergencyWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.municipality?.toLowerCase().includes(search) ||
      s.region?.toLowerCase().includes(search) ||
      s.matchedMunicipality?.name.toLowerCase().includes(search) ||
      s.matchedRegion?.name.toLowerCase().includes(search) ||
      s.type.toLowerCase().includes(search) ||
      s.health_authority?.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [emergencyWithMatches, emergencySearch]);

  const airportStats = useMemo(() => {
    const matched = airportsWithMatches.filter(a => a.matchedMunicipality).length;
    const regionOnly = airportsWithMatches.filter(a => !a.matchedMunicipality && a.matchedRegion).length;
    const unmatched = airportsWithMatches.filter(a => !a.matchedMunicipality && !a.matchedRegion).length;
    const byType: Record<string, number> = {};
    airportsWithMatches.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });
    return { total: airportsWithMatches.length, matched, regionOnly, unmatched, byType };
  }, [airportsWithMatches]);

  const weatherStats = useMemo(() => {
    const matched = weatherWithMatches.filter(s => s.matchedMunicipality).length;
    const regionOnly = weatherWithMatches.filter(s => !s.matchedMunicipality && s.matchedRegion).length;
    const unmatched = weatherWithMatches.filter(s => !s.matchedMunicipality && !s.matchedRegion).length;
    const byType: Record<string, number> = {};
    weatherWithMatches.forEach(s => {
      byType[s.type] = (byType[s.type] || 0) + 1;
    });
    return { total: weatherWithMatches.length, matched, regionOnly, unmatched, byType };
  }, [weatherWithMatches]);

  const marineStats = useMemo(() => {
    const matched = marineWithMatches.filter(f => f.matchedMunicipality).length;
    const regionOnly = marineWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length;
    const unmatched = marineWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length;
    const byType: Record<string, number> = {};
    marineWithMatches.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });
    return { total: marineWithMatches.length, matched, regionOnly, unmatched, byType };
  }, [marineWithMatches]);

  const emergencyStats = useMemo(() => {
    const matched = emergencyWithMatches.filter(s => s.matchedMunicipality).length;
    const regionOnly = emergencyWithMatches.filter(s => !s.matchedMunicipality && s.matchedRegion).length;
    const unmatched = emergencyWithMatches.filter(s => !s.matchedMunicipality && !s.matchedRegion).length;
    const byType: Record<string, number> = {};
    emergencyWithMatches.forEach(s => {
      byType[s.type] = (byType[s.type] || 0) + 1;
    });
    const hospitalsWithHelipad = emergencyWithMatches.filter(s => s.type === 'hospital' && s.has_helipad).length;
    const traumaCentres = emergencyWithMatches.filter(s => s.type === 'hospital' && s.is_trauma_centre).length;
    return { total: emergencyWithMatches.length, matched, regionOnly, unmatched, byType, hospitalsWithHelipad, traumaCentres };
  }, [emergencyWithMatches]);

  return (
    <div className="h-full flex flex-col font-mono">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <h1 className="text-sm font-bold tracking-wider text-foreground">INFRASTRUCTURE DATABASE</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-5">
          Aviation and weather infrastructure correlated to BC municipalities
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="border-b border-border/50 px-4">
          <TabsList className="bg-transparent border-none h-10">
            <TabsTrigger 
              value="airports" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-airports"
            >
              <Plane className="w-3 h-3 mr-1" />
              AIRPORTS ({airportStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="weather" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-weather"
            >
              <Radio className="w-3 h-3 mr-1" />
              WEATHER STATIONS ({weatherStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="marine" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-marine"
            >
              <Anchor className="w-3 h-3 mr-1" />
              MARINE ({marineStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="emergency" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-emergency"
            >
              <Siren className="w-3 h-3 mr-1" />
              EMERGENCY ({emergencyStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-summary"
            >
              <MapPin className="w-3 h-3 mr-1" />
              CORRELATION SUMMARY
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="airports" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search airports..."
                value={airportSearch}
                onChange={e => setAirportSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-airport-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{airportStats.matched} MATCHED</span>
              <span className="text-yellow-400">{airportStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{airportStats.unmatched} UNMATCHED</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">CODES</th>
                    <th className="text-left py-2 px-2">NAME</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                    <th className="text-center py-2 px-2">METAR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAirports.map(airport => (
                    <tr 
                      key={airport.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-airport-${airport.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex flex-col gap-0.5">
                          {airport.icao && <span className="text-green-400 font-bold">{airport.icao}</span>}
                          {airport.iata && <span className="text-blue-400">{airport.iata}</span>}
                          {airport.tc_lid && <span className="text-yellow-400">{airport.tc_lid}</span>}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-foreground">{airport.name}</td>
                      <td className="py-2 px-2">{getAirportTypeBadge(airport.type)}</td>
                      <td className="py-2 px-2 text-muted-foreground">{airport.municipality || '-'}</td>
                      <td className="py-2 px-2">
                        {airport.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{airport.matchedMunicipality.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {airport.matchedRegion ? (
                          <span className="text-cyan-400">{airport.matchedRegion.shortName || airport.matchedRegion.name}</span>
                        ) : airport.region_id ? (
                          <span className="text-yellow-400">{airport.region_id}</span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {airport.has_metar ? (
                          <CheckCircle className="w-3 h-3 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="weather" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search weather stations..."
                value={weatherSearch}
                onChange={e => setWeatherSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-weather-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{weatherStats.matched} MATCHED</span>
              <span className="text-yellow-400">{weatherStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{weatherStats.unmatched} UNMATCHED</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">STATION ID</th>
                    <th className="text-left py-2 px-2">NAME</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">REPORTS</th>
                    <th className="text-left py-2 px-2">SOURCE LOCATION</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeather.map(station => (
                    <tr 
                      key={station.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-weather-${station.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-green-400 font-bold">{station.station_id}</span>
                          {station.wmo_id && <span className="text-muted-foreground text-[10px]">WMO: {station.wmo_id}</span>}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-foreground">{station.name}</td>
                      <td className="py-2 px-2">{getWeatherTypeBadge(station.type)}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1">
                          {station.reports.map(r => (
                            <Badge key={r} variant="outline" className="text-[9px] bg-muted/30">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{station.municipality || '-'}</td>
                      <td className="py-2 px-2">
                        {station.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{station.matchedMunicipality.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {station.matchedRegion ? (
                          <span className="text-cyan-400">{station.matchedRegion.shortName || station.matchedRegion.name}</span>
                        ) : station.region_id ? (
                          <span className="text-yellow-400">{station.region_id}</span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="marine" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search marine facilities..."
                value={marineSearch}
                onChange={e => setMarineSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-marine-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{marineStats.matched} MATCHED</span>
              <span className="text-yellow-400">{marineStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{marineStats.unmatched} UNMATCHED</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">NAME</th>
                    <th className="text-left py-2 px-2">SERVICES</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                    <th className="text-center py-2 px-2">FUEL</th>
                    <th className="text-center py-2 px-2">RESCUE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarine.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-marine-${facility.id}`}
                    >
                      <td className="py-2 px-2">{getMarineTypeBadge(facility.type)}</td>
                      <td className="py-2 px-2 text-foreground">{facility.name}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1">
                          {facility.services?.slice(0, 2).map(s => (
                            <Badge key={s} variant="outline" className="text-[9px] bg-muted/30">
                              {s}
                            </Badge>
                          ))}
                          {(facility.services?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-[9px] bg-muted/30">
                              +{(facility.services?.length || 0) - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality || '-'}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.matchedRegion ? (
                          <span className="text-cyan-400">{facility.matchedRegion.shortName || facility.matchedRegion.name}</span>
                        ) : facility.region ? (
                          <span className="text-yellow-400">{facility.region}</span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {facility.has_fuel ? (
                          <CheckCircle className="w-3 h-3 text-amber-400 mx-auto" />
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {facility.emergency_services ? (
                          <CheckCircle className="w-3 h-3 text-red-400 mx-auto" />
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="emergency" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search emergency services..."
                value={emergencySearch}
                onChange={e => setEmergencySearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-emergency-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{emergencyStats.matched} MATCHED</span>
              <span className="text-red-400">{emergencyStats.byType['hospital'] || 0} HOSPITALS</span>
              <span className="text-orange-400">{emergencyStats.byType['fire_station'] || 0} FIRE</span>
              <span className="text-blue-400">{emergencyStats.byType['municipal_police'] || 0} MUNICIPAL</span>
              <span className="text-yellow-400">{emergencyStats.byType['rcmp_detachment'] || 0} RCMP</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">TYPE</th>
                    <th className="text-left py-2 px-2 font-medium">NAME</th>
                    <th className="text-left py-2 px-2 font-medium">MUNICIPALITY</th>
                    <th className="text-left py-2 px-2 font-medium">MATCHED TO</th>
                    <th className="text-left py-2 px-2 font-medium">REGION</th>
                    <th className="text-center py-2 px-2 font-medium">HELI</th>
                    <th className="text-center py-2 px-2 font-medium">TRAUMA</th>
                    <th className="text-center py-2 px-2 font-medium">ER</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmergency.map(service => (
                    <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2">{getEmergencyTypeBadge(service.type)}</td>
                      <td className="py-2 px-2">
                        <div className="font-medium text-foreground">{service.name}</div>
                        {service.address && (
                          <div className="text-[10px] text-muted-foreground">{service.address}</div>
                        )}
                        {service.notes && (
                          <div className="text-[10px] text-cyan-400/70">{service.notes}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{service.municipality || '-'}</td>
                      <td className="py-2 px-2">
                        {service.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{service.matchedMunicipality.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {service.matchedRegion ? (
                          <span className="text-cyan-400">{service.matchedRegion.shortName || service.matchedRegion.name}</span>
                        ) : service.region ? (
                          <span className="text-yellow-400">{service.region}</span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {service.has_helipad ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle className="w-3 h-3 text-purple-400" />
                            {service.helipad_icao && (
                              <span className="text-[9px] text-purple-400">{service.helipad_icao}</span>
                            )}
                          </div>
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {service.is_trauma_centre ? (
                          <CheckCircle className="w-3 h-3 text-red-400 mx-auto" />
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {service.emergency_department ? (
                          <CheckCircle className="w-3 h-3 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="summary" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold tracking-wider text-foreground flex items-center gap-2">
                    <Plane className="w-4 h-4 text-cyan-400" />
                    AIRPORT STATISTICS
                  </h3>
                  <div className="bg-card/50 border border-border/30 rounded-md p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total Airports</span>
                      <span className="text-foreground font-bold">{airportStats.total}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Matched to Municipality</span>
                      <span className="text-green-400">{airportStats.matched}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Region Match Only</span>
                      <span className="text-yellow-400">{airportStats.regionOnly}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Unmatched</span>
                      <span className="text-red-400">{airportStats.unmatched}</span>
                    </div>
                    <div className="border-t border-border/30 pt-3 mt-3">
                      <div className="text-[10px] text-muted-foreground mb-2">BY TYPE:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(airportStats.byType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-xs">
                            {getAirportTypeBadge(type)}
                            <span className="text-foreground">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold tracking-wider text-foreground flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    WEATHER STATION STATISTICS
                  </h3>
                  <div className="bg-card/50 border border-border/30 rounded-md p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total Stations</span>
                      <span className="text-foreground font-bold">{weatherStats.total}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Matched to Municipality</span>
                      <span className="text-green-400">{weatherStats.matched}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Region Match Only</span>
                      <span className="text-yellow-400">{weatherStats.regionOnly}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Unmatched</span>
                      <span className="text-red-400">{weatherStats.unmatched}</span>
                    </div>
                    <div className="border-t border-border/30 pt-3 mt-3">
                      <div className="text-[10px] text-muted-foreground mb-2">BY TYPE:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(weatherStats.byType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-xs">
                            {getWeatherTypeBadge(type)}
                            <span className="text-foreground">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold tracking-wider text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  CORRELATION METHODOLOGY
                </h3>
                <div className="bg-card/50 border border-border/30 rounded-md p-4 text-xs text-muted-foreground space-y-2">
                  <p>Infrastructure entries are correlated to municipalities using a multi-step matching process:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Match against municipality <span className="text-cyan-400">shortName</span> (e.g., "Richmond")</li>
                    <li>Match against municipality <span className="text-cyan-400">full name</span> (e.g., "City of Richmond")</li>
                    <li>Match against <span className="text-cyan-400">cleaned name</span> with prefixes removed (e.g., "Richmond" from "City of Richmond")</li>
                  </ol>
                  <p className="mt-3">Entries without a municipality match but with a region_id are matched to regional districts for geographic context.</p>
                  <p className="mt-2">All 160 BC municipalities have GPS coordinates, enabling nearest-infrastructure lookups for any location in the province.</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
