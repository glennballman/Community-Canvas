import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Siren,
  Mountain,
  Users,
  Heart,
  BadgeCheck,
  Bus,
  Train,
  Truck,
  GraduationCap,
  Package,
  Mail
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BC_AIRPORTS, type Airport } from "@shared/aviation";
import { BC_WEATHER_STATIONS, type WeatherStation } from "@shared/weather-stations";
import { BC_MARINE_FACILITIES, type MarineFacility, type MarineFacilityType } from "@shared/marine";
import { BC_EMERGENCY_SERVICES, type EmergencyService, type EmergencyServiceType } from "@shared/emergency-services";
import { BC_SAR_GROUPS, type SARGroup, type SARCapability } from "@shared/search-rescue";
import { 
  BC_INTERCITY_BUS, 
  BC_TRANSIT_SYSTEMS, 
  BC_CHARTER_BUS,
  BC_COURIER_SERVICES,
  BC_TRUCKING_SERVICES,
  type IntercityBusService,
  type TransitSystem,
  type CharterBusOperator,
  type CourierService,
  type TruckingService,
  type IntercityBusType,
  type TransitSystemType,
  type CharterBusType,
  type CourierServiceType
} from "@shared/ground-transport";
import { Fuel, Apple, Container, TreePine, Snowflake } from "lucide-react";
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

function getSARCapabilityBadge(capability: SARCapability) {
  const colors: Record<SARCapability, string> = {
    'ground_search': 'bg-green-500/20 text-green-400 border-green-500/30',
    'rope_rescue': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'swiftwater_rescue': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'avalanche_rescue': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'search_dogs': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'mountain_rescue': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'inland_water': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    'helicopter_operations': 'bg-red-500/20 text-red-400 border-red-500/30',
    'first_aid': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'tracking': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'night_operations': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  };
  const labels: Record<SARCapability, string> = {
    'ground_search': 'GROUND',
    'rope_rescue': 'ROPE',
    'swiftwater_rescue': 'SWIFT',
    'avalanche_rescue': 'AVY',
    'search_dogs': 'K9',
    'mountain_rescue': 'MTN',
    'inland_water': 'WATER',
    'helicopter_operations': 'HELI',
    'first_aid': 'MED',
    'tracking': 'TRACK',
    'night_operations': 'NIGHT',
  };
  return (
    <Badge key={capability} variant="outline" className={`text-[8px] ${colors[capability] || ''}`}>
      {labels[capability] || capability.toUpperCase()}
    </Badge>
  );
}

function findMatchingMunicipality(name: string | undefined): GeoNode | null {
  if (!name) return null;
  
  const municipalities = Object.values(GEO_HIERARCHY).filter(n => n.level === 'municipality');
  const searchName = name.toLowerCase();
  
  for (const muni of municipalities) {
    if (muni.shortName?.toLowerCase() === searchName) return muni;
    if (muni.name.toLowerCase() === searchName) return muni;
    
    const cleaned = muni.name
      .replace(/^(City of |District of |Township of |Village of |Corporation of |Town of )/i, "")
      .replace(/ Municipality$/i, "");
    if (cleaned.toLowerCase() === searchName) return muni;
    
    const searchCleaned = name
      .replace(/ Township$/i, "")
      .replace(/ City$/i, "")
      .replace(/ District$/i, "")
      .replace(/ Municipality$/i, "")
      .replace(/^District of /i, "")
      .replace(/^City of /i, "")
      .replace(/^Township of /i, "")
      .toLowerCase();
    
    if (cleaned.toLowerCase() === searchCleaned) return muni;
    if (muni.shortName?.toLowerCase() === searchCleaned) return muni;
    
    if (searchName === "langley township" && cleaned.toLowerCase() === "langley") {
      if (muni.name.toLowerCase().includes("township")) return muni;
    }
    if (searchName === "north vancouver city" && cleaned.toLowerCase() === "north vancouver") {
      if (muni.name.toLowerCase().includes("city")) return muni;
    }
    if (searchName === "north vancouver district" && cleaned.toLowerCase() === "north vancouver") {
      if (muni.name.toLowerCase().includes("district")) return muni;
    }
  }
  return null;
}

function findMatchingRegion(regionId: string | undefined): GeoNode | null {
  if (!regionId) return null;
  // GEO_HIERARCHY uses direct slugs like "capital", "metro-vancouver"
  return GEO_HIERARCHY[regionId] || null;
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

interface SARWithMatch extends SARGroup {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface IntercityBusWithMatch extends IntercityBusService {
  matchedMunicipalities: GeoNode[];
}

interface TransitWithMatch extends TransitSystem {
  matchedMunicipalities: GeoNode[];
}

interface CharterWithMatch extends CharterBusOperator {
  matchedMunicipality: GeoNode | null;
}

interface CourierWithMatch extends CourierService {
  matchedMunicipalities: GeoNode[];
}

interface TruckingWithMatch extends TruckingService {
  matchedMunicipalities: GeoNode[];
}

export default function AdminInfrastructure() {
  const [airportSearch, setAirportSearch] = useState("");
  const [weatherSearch, setWeatherSearch] = useState("");
  const [marineSearch, setMarineSearch] = useState("");
  const [healthcareSearch, setHealthcareSearch] = useState("");
  const [fireSearch, setFireSearch] = useState("");
  const [policeSearch, setPoliceSearch] = useState("");
  const [sarSearch, setSarSearch] = useState("");
  const [groundSearch, setGroundSearch] = useState("");
  const [groundSubTab, setGroundSubTab] = useState<"intercity" | "transit" | "charter" | "courier" | "trucking">("intercity");
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

  const healthcareWithMatches: EmergencyWithMatch[] = useMemo(() => {
    return BC_EMERGENCY_SERVICES
      .filter(service => service.type === 'hospital')
      .map(service => ({
        ...service,
        matchedMunicipality: findMatchingMunicipality(service.municipality),
        matchedRegion: findMatchingRegion(service.region.toLowerCase().replace(/\s+/g, '-')),
      }));
  }, []);

  const fireWithMatches: EmergencyWithMatch[] = useMemo(() => {
    return BC_EMERGENCY_SERVICES
      .filter(service => service.type === 'fire_station')
      .map(service => ({
        ...service,
        matchedMunicipality: findMatchingMunicipality(service.municipality),
        matchedRegion: findMatchingRegion(service.region.toLowerCase().replace(/\s+/g, '-')),
      }));
  }, []);

  const policeWithMatches: EmergencyWithMatch[] = useMemo(() => {
    return BC_EMERGENCY_SERVICES
      .filter(service => service.type === 'municipal_police' || service.type === 'rcmp_detachment')
      .map(service => ({
        ...service,
        matchedMunicipality: findMatchingMunicipality(service.municipality),
        matchedRegion: findMatchingRegion(service.region.toLowerCase().replace(/\s+/g, '-')),
      }));
  }, []);

  const sarWithMatches: SARWithMatch[] = useMemo(() => {
    return BC_SAR_GROUPS.map(group => ({
      ...group,
      matchedMunicipality: findMatchingMunicipality(group.municipality),
      matchedRegion: findMatchingRegion(group.region.toLowerCase().replace(/\s+/g, '-')),
    }));
  }, []);

  const intercityBusWithMatches: IntercityBusWithMatch[] = useMemo(() => {
    return BC_INTERCITY_BUS.map(service => ({
      ...service,
      matchedMunicipalities: service.hubs
        .map(hub => findMatchingMunicipality(hub.municipality))
        .filter((m): m is GeoNode => m !== null),
    }));
  }, []);

  const transitWithMatches: TransitWithMatch[] = useMemo(() => {
    return BC_TRANSIT_SYSTEMS.map(system => ({
      ...system,
      matchedMunicipalities: system.municipalities_served
        .map(m => findMatchingMunicipality(m))
        .filter((m): m is GeoNode => m !== null),
    }));
  }, []);

  const charterWithMatches: CharterWithMatch[] = useMemo(() => {
    return BC_CHARTER_BUS.map(operator => ({
      ...operator,
      matchedMunicipality: findMatchingMunicipality(operator.base_location.municipality),
    }));
  }, []);

  const courierWithMatches: CourierWithMatch[] = useMemo(() => {
    return BC_COURIER_SERVICES.map(service => ({
      ...service,
      matchedMunicipalities: service.facilities
        .map(f => findMatchingMunicipality(f.municipality))
        .filter((m): m is GeoNode => m !== null),
    }));
  }, []);

  const truckingWithMatches: TruckingWithMatch[] = useMemo(() => {
    return BC_TRUCKING_SERVICES.map(service => ({
      ...service,
      matchedMunicipalities: service.terminals
        .map(t => findMatchingMunicipality(t.municipality))
        .filter((m): m is GeoNode => m !== null),
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

  const filteredHealthcare = useMemo(() => {
    if (!healthcareSearch) return healthcareWithMatches;
    const search = healthcareSearch.toLowerCase();
    return healthcareWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.municipality?.toLowerCase().includes(search) ||
      s.region?.toLowerCase().includes(search) ||
      s.matchedMunicipality?.name.toLowerCase().includes(search) ||
      s.matchedRegion?.name.toLowerCase().includes(search) ||
      s.health_authority?.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [healthcareWithMatches, healthcareSearch]);

  const filteredFire = useMemo(() => {
    if (!fireSearch) return fireWithMatches;
    const search = fireSearch.toLowerCase();
    return fireWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.municipality?.toLowerCase().includes(search) ||
      s.region?.toLowerCase().includes(search) ||
      s.matchedMunicipality?.name.toLowerCase().includes(search) ||
      s.matchedRegion?.name.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [fireWithMatches, fireSearch]);

  const filteredPolice = useMemo(() => {
    if (!policeSearch) return policeWithMatches;
    const search = policeSearch.toLowerCase();
    return policeWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.municipality?.toLowerCase().includes(search) ||
      s.region?.toLowerCase().includes(search) ||
      s.matchedMunicipality?.name.toLowerCase().includes(search) ||
      s.matchedRegion?.name.toLowerCase().includes(search) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [policeWithMatches, policeSearch]);

  const filteredSAR = useMemo(() => {
    if (!sarSearch) return sarWithMatches;
    const search = sarSearch.toLowerCase();
    return sarWithMatches.filter(g => 
      g.name.toLowerCase().includes(search) ||
      g.short_name.toLowerCase().includes(search) ||
      g.municipality?.toLowerCase().includes(search) ||
      g.region?.toLowerCase().includes(search) ||
      g.coverage_area?.toLowerCase().includes(search) ||
      g.matchedMunicipality?.name.toLowerCase().includes(search) ||
      g.matchedRegion?.name.toLowerCase().includes(search) ||
      g.capabilities.some(c => c.toLowerCase().includes(search))
    );
  }, [sarWithMatches, sarSearch]);

  const filteredIntercity = useMemo(() => {
    if (!groundSearch) return intercityBusWithMatches;
    const search = groundSearch.toLowerCase();
    return intercityBusWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.routes.some(r => r.toLowerCase().includes(search)) ||
      s.hubs.some(h => h.name.toLowerCase().includes(search) || h.municipality.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [intercityBusWithMatches, groundSearch]);

  const filteredTransit = useMemo(() => {
    if (!groundSearch) return transitWithMatches;
    const search = groundSearch.toLowerCase();
    return transitWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.operator.toLowerCase().includes(search) ||
      s.municipalities_served.some(m => m.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [transitWithMatches, groundSearch]);

  const filteredCharter = useMemo(() => {
    if (!groundSearch) return charterWithMatches;
    const search = groundSearch.toLowerCase();
    return charterWithMatches.filter(o => 
      o.name.toLowerCase().includes(search) ||
      o.base_location.municipality.toLowerCase().includes(search) ||
      o.service_area.some(a => a.toLowerCase().includes(search)) ||
      o.type.toLowerCase().includes(search) ||
      o.notes?.toLowerCase().includes(search)
    );
  }, [charterWithMatches, groundSearch]);

  const filteredCourier = useMemo(() => {
    if (!groundSearch) return courierWithMatches;
    const search = groundSearch.toLowerCase();
    return courierWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.facilities.some(f => f.name.toLowerCase().includes(search) || f.municipality.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [courierWithMatches, groundSearch]);

  const filteredTrucking = useMemo(() => {
    if (!groundSearch) return truckingWithMatches;
    const search = groundSearch.toLowerCase();
    return truckingWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.terminals.some(t => t.name.toLowerCase().includes(search) || t.municipality.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [truckingWithMatches, groundSearch]);

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

  const healthcareStats = useMemo(() => {
    const matched = healthcareWithMatches.filter(s => s.matchedMunicipality).length;
    const regionOnly = healthcareWithMatches.filter(s => !s.matchedMunicipality && s.matchedRegion).length;
    const unmatched = healthcareWithMatches.filter(s => !s.matchedMunicipality && !s.matchedRegion).length;
    const withHelipad = healthcareWithMatches.filter(s => s.has_helipad).length;
    const traumaCentres = healthcareWithMatches.filter(s => s.is_trauma_centre).length;
    const withER = healthcareWithMatches.filter(s => s.emergency_department).length;
    return { total: healthcareWithMatches.length, matched, regionOnly, unmatched, withHelipad, traumaCentres, withER };
  }, [healthcareWithMatches]);

  const fireStats = useMemo(() => {
    const matched = fireWithMatches.filter(s => s.matchedMunicipality).length;
    const regionOnly = fireWithMatches.filter(s => !s.matchedMunicipality && s.matchedRegion).length;
    const unmatched = fireWithMatches.filter(s => !s.matchedMunicipality && !s.matchedRegion).length;
    return { total: fireWithMatches.length, matched, regionOnly, unmatched };
  }, [fireWithMatches]);

  const policeStats = useMemo(() => {
    const matched = policeWithMatches.filter(s => s.matchedMunicipality).length;
    const regionOnly = policeWithMatches.filter(s => !s.matchedMunicipality && s.matchedRegion).length;
    const unmatched = policeWithMatches.filter(s => !s.matchedMunicipality && !s.matchedRegion).length;
    const municipal = policeWithMatches.filter(s => s.type === 'municipal_police').length;
    const rcmp = policeWithMatches.filter(s => s.type === 'rcmp_detachment').length;
    return { total: policeWithMatches.length, matched, regionOnly, unmatched, municipal, rcmp };
  }, [policeWithMatches]);

  const sarStats = useMemo(() => {
    const matched = sarWithMatches.filter(g => g.matchedMunicipality).length;
    const regionOnly = sarWithMatches.filter(g => !g.matchedMunicipality && g.matchedRegion).length;
    const unmatched = sarWithMatches.filter(g => !g.matchedMunicipality && !g.matchedRegion).length;
    const byCapability: Record<string, number> = {};
    sarWithMatches.forEach(g => {
      g.capabilities.forEach(c => {
        byCapability[c] = (byCapability[c] || 0) + 1;
      });
    });
    const withAvalanche = sarWithMatches.filter(g => g.capabilities.includes('avalanche_rescue')).length;
    const withHeli = sarWithMatches.filter(g => g.capabilities.includes('helicopter_operations')).length;
    const withMountain = sarWithMatches.filter(g => g.capabilities.includes('mountain_rescue')).length;
    return { total: sarWithMatches.length, matched, regionOnly, unmatched, byCapability, withAvalanche, withHeli, withMountain };
  }, [sarWithMatches]);

  const groundStats = useMemo(() => {
    const intercityMatched = intercityBusWithMatches.filter(s => s.matchedMunicipalities.length > 0).length;
    const transitMatched = transitWithMatches.filter(s => s.matchedMunicipalities.length > 0).length;
    const charterMatched = charterWithMatches.filter(o => o.matchedMunicipality).length;
    const courierMatched = courierWithMatches.filter(s => s.matchedMunicipalities.length > 0).length;
    const truckingMatched = truckingWithMatches.filter(s => s.matchedMunicipalities.length > 0).length;
    const totalHubs = intercityBusWithMatches.reduce((sum, s) => sum + s.hubs.length, 0);
    const totalMunis = Array.from(new Set(transitWithMatches.flatMap(s => s.municipalities_served))).length;
    const schoolBus = charterWithMatches.filter(o => o.type === 'school').length;
    const totalFacilities = courierWithMatches.reduce((sum, s) => sum + s.facilities.length, 0);
    const postalFacilities = courierWithMatches.filter(s => s.type === 'postal').reduce((sum, s) => sum + s.facilities.length, 0);
    const expressCouriers = courierWithMatches.filter(s => s.type === 'express').length;
    const truckingTerminals = truckingWithMatches.reduce((sum, s) => sum + s.terminals.length, 0);
    const fuelDistributors = truckingWithMatches.filter(s => s.type === 'fuel').length;
    const foodDistributors = truckingWithMatches.filter(s => s.type === 'food').length;
    return {
      intercityServices: intercityBusWithMatches.length,
      intercityHubs: totalHubs,
      intercityMatched,
      transitSystems: transitWithMatches.length,
      transitMatched,
      municipalitiesServed: totalMunis,
      charterOperators: charterWithMatches.length,
      charterMatched,
      schoolBusOperators: schoolBus,
      courierServices: courierWithMatches.length,
      courierMatched,
      courierFacilities: totalFacilities,
      postalFacilities,
      expressCouriers,
      truckingServices: truckingWithMatches.length,
      truckingMatched,
      truckingTerminals,
      fuelDistributors,
      foodDistributors,
      total: intercityBusWithMatches.length + transitWithMatches.length + charterWithMatches.length + courierWithMatches.length + truckingWithMatches.length
    };
  }, [intercityBusWithMatches, transitWithMatches, charterWithMatches, courierWithMatches, truckingWithMatches]);

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
              value="healthcare" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-healthcare"
            >
              <Heart className="w-3 h-3 mr-1" />
              HEALTHCARE ({healthcareStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="fire" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-fire"
            >
              <Flame className="w-3 h-3 mr-1" />
              FIRE ({fireStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="police" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-police"
            >
              <Shield className="w-3 h-3 mr-1" />
              POLICE ({policeStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="sar" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-sar"
            >
              <Mountain className="w-3 h-3 mr-1" />
              SAR ({sarStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="ground" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-ground"
            >
              <Bus className="w-3 h-3 mr-1" />
              GROUND ({groundStats.total})
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

        <TabsContent value="healthcare" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search hospitals..."
                value={healthcareSearch}
                onChange={e => setHealthcareSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-healthcare-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{healthcareStats.matched} MATCHED</span>
              <span className="text-purple-400">{healthcareStats.withHelipad} HELIPAD</span>
              <span className="text-red-400">{healthcareStats.traumaCentres} TRAUMA</span>
              <span className="text-cyan-400">{healthcareStats.withER} ER</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">TYPE</th>
                    <th className="text-left py-2 px-2 font-medium">NAME</th>
                    <th className="text-left py-2 px-2 font-medium">HEALTH AUTHORITY</th>
                    <th className="text-left py-2 px-2 font-medium">MUNICIPALITY</th>
                    <th className="text-left py-2 px-2 font-medium">MATCHED TO</th>
                    <th className="text-left py-2 px-2 font-medium">REGION</th>
                    <th className="text-center py-2 px-2 font-medium">HELI</th>
                    <th className="text-center py-2 px-2 font-medium">TRAUMA</th>
                    <th className="text-center py-2 px-2 font-medium">ER</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHealthcare.map(service => (
                    <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className="text-[9px] bg-red-500/20 text-red-400 border-red-500/30"
                        >
                          HOSPITAL
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Heart className="w-3 h-3 text-red-400" />
                          <div>
                            <div className="font-medium text-foreground">{service.name}</div>
                            {service.address && (
                              <div className="text-[10px] text-muted-foreground">{service.address}</div>
                            )}
                            {service.notes && (
                              <div className="text-[10px] text-cyan-400/70">{service.notes}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {service.health_authority && (
                          <Badge variant="outline" className="text-[9px]">
                            {service.health_authority}
                          </Badge>
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

        <TabsContent value="fire" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search fire departments..."
                value={fireSearch}
                onChange={e => setFireSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-fire-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{fireStats.matched} MATCHED</span>
              <span className="text-yellow-400">{fireStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{fireStats.unmatched} UNMATCHED</span>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredFire.map(service => (
                    <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className="text-[9px] bg-orange-500/20 text-orange-400 border-orange-500/30"
                        >
                          FIRE DEPT
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <div>
                            <div className="font-medium text-foreground">{service.name}</div>
                            {service.address && (
                              <div className="text-[10px] text-muted-foreground">{service.address}</div>
                            )}
                            {service.notes && (
                              <div className="text-[10px] text-cyan-400/70">{service.notes}</div>
                            )}
                          </div>
                        </div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="police" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search police services..."
                value={policeSearch}
                onChange={e => setPoliceSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-police-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{policeStats.matched} MATCHED</span>
              <span className="text-blue-400">{policeStats.municipal} MUNICIPAL</span>
              <span className="text-yellow-400">{policeStats.rcmp} RCMP</span>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredPolice.map(service => (
                    <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${
                            service.type === 'municipal_police' 
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }`}
                        >
                          {service.type === 'municipal_police' ? 'MUNICIPAL' : 'RCMP'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3 h-3 text-blue-400" />
                          <div>
                            <div className="font-medium text-foreground">{service.name}</div>
                            {service.address && (
                              <div className="text-[10px] text-muted-foreground">{service.address}</div>
                            )}
                            {service.notes && (
                              <div className="text-[10px] text-cyan-400/70">{service.notes}</div>
                            )}
                          </div>
                        </div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="sar" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search SAR groups..."
                value={sarSearch}
                onChange={e => setSarSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-sar-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{sarStats.total} GROUPS</span>
              <span className="text-purple-400">{sarStats.withMountain} MTN</span>
              <span className="text-blue-400">{sarStats.withAvalanche} AVY</span>
              <span className="text-red-400">{sarStats.withHeli} HELI</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">NAME</th>
                    <th className="text-left py-2 px-2 font-medium">COVERAGE AREA</th>
                    <th className="text-left py-2 px-2 font-medium">CAPABILITIES</th>
                    <th className="text-left py-2 px-2 font-medium">MATCHED TO</th>
                    <th className="text-left py-2 px-2 font-medium">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSAR.map(group => (
                    <tr key={group.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Mountain className="w-3 h-3 text-orange-400" />
                          <div>
                            <div className="font-medium text-foreground">{group.short_name}</div>
                            <div className="text-[10px] text-muted-foreground">{group.name}</div>
                            {group.website && (
                              <a 
                                href={group.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-cyan-400 hover:underline"
                              >
                                {group.website.replace('https://', '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px] text-muted-foreground max-w-48">
                          {group.coverage_area}
                        </div>
                        {group.notes && (
                          <div className="text-[10px] text-cyan-400/70 mt-1">{group.notes}</div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1 max-w-64">
                          {group.capabilities.slice(0, 5).map(c => getSARCapabilityBadge(c))}
                          {group.capabilities.length > 5 && (
                            <Badge variant="outline" className="text-[8px] bg-muted/30">
                              +{group.capabilities.length - 5}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {group.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{group.matchedMunicipality.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {group.matchedRegion ? (
                          <span className="text-cyan-400">{group.matchedRegion.shortName || group.matchedRegion.name}</span>
                        ) : group.region ? (
                          <span className="text-yellow-400">{group.region}</span>
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

        <TabsContent value="ground" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search ground transport..."
                value={groundSearch}
                onChange={e => setGroundSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-ground-search"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={groundSubTab === "intercity" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setGroundSubTab("intercity")}
                data-testid="button-ground-subtab-intercity"
              >
                <Bus className="w-2.5 h-2.5 mr-1" />
                INTERCITY ({groundStats.intercityServices})
              </Button>
              <Button
                size="sm"
                variant={groundSubTab === "transit" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setGroundSubTab("transit")}
                data-testid="button-ground-subtab-transit"
              >
                <Train className="w-2.5 h-2.5 mr-1" />
                TRANSIT ({groundStats.transitSystems})
              </Button>
              <Button
                size="sm"
                variant={groundSubTab === "charter" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setGroundSubTab("charter")}
                data-testid="button-ground-subtab-charter"
              >
                <Truck className="w-2.5 h-2.5 mr-1" />
                CHARTER ({groundStats.charterOperators})
              </Button>
              <Button
                size="sm"
                variant={groundSubTab === "courier" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setGroundSubTab("courier")}
                data-testid="button-ground-subtab-courier"
              >
                <Package className="w-2.5 h-2.5 mr-1" />
                COURIER ({groundStats.courierServices})
              </Button>
              <Button
                size="sm"
                variant={groundSubTab === "trucking" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setGroundSubTab("trucking")}
                data-testid="button-ground-subtab-trucking"
              >
                <Fuel className="w-2.5 h-2.5 mr-1" />
                TRUCKING ({groundStats.truckingServices})
              </Button>
            </div>
          </div>

          {groundSubTab === "intercity" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">SERVICE</th>
                      <th className="text-left py-2 px-2 font-medium">ROUTES</th>
                      <th className="text-left py-2 px-2 font-medium">HUBS</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIntercity.map(service => (
                      <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              service.type === 'scheduled' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              service.type === 'seasonal' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              service.type === 'cross_border' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                              'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {service.type.toUpperCase().replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Bus className="w-3 h-3 text-green-400" />
                            <div>
                              <div className="font-medium text-foreground">{service.name}</div>
                              {service.website && (
                                <a 
                                  href={service.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-cyan-400 hover:underline"
                                >
                                  {service.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {service.notes && (
                                <div className="text-[10px] text-muted-foreground">{service.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5 max-w-64">
                            {service.routes.slice(0, 3).map((route, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground">{route}</div>
                            ))}
                            {service.routes.length > 3 && (
                              <div className="text-[10px] text-cyan-400">+{service.routes.length - 3} more</div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.hubs.slice(0, 4).map((hub, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground">
                                {hub.name} ({hub.municipality})
                              </div>
                            ))}
                            {service.hubs.length > 4 && (
                              <div className="text-[10px] text-cyan-400">+{service.hubs.length - 4} more</div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {service.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{service.matchedMunicipalities.length} of {service.hubs.length}</span>
                            </div>
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
          )}

          {groundSubTab === "transit" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">SYSTEM</th>
                      <th className="text-left py-2 px-2 font-medium">OPERATOR</th>
                      <th className="text-left py-2 px-2 font-medium">MUNICIPALITIES SERVED</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransit.map(system => (
                      <tr key={system.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              system.type === 'translink' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              system.type === 'bc_transit' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              system.type === 'municipal' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}
                          >
                            {system.type === 'bc_transit' ? 'BC TRANSIT' : 
                             system.type === 'translink' ? 'TRANSLINK' :
                             system.type === 'municipal' ? 'MUNICIPAL' :
                             system.type.toUpperCase().replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Train className="w-3 h-3 text-blue-400" />
                            <div>
                              <div className="font-medium text-foreground">{system.name}</div>
                              {system.hub_location && (
                                <div className="text-[10px] text-muted-foreground">Hub: {system.hub_location.name}</div>
                              )}
                              {system.notes && (
                                <div className="text-[10px] text-cyan-400/70">{system.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{system.operator}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1 max-w-80">
                            {system.municipalities_served.slice(0, 5).map((m, i) => (
                              <Badge key={i} variant="outline" className="text-[8px]">
                                {m}
                              </Badge>
                            ))}
                            {system.municipalities_served.length > 5 && (
                              <Badge variant="outline" className="text-[8px] bg-muted/30">
                                +{system.municipalities_served.length - 5}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {system.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{system.matchedMunicipalities.length} of {system.municipalities_served.length}</span>
                            </div>
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
          )}

          {groundSubTab === "charter" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">OPERATOR</th>
                      <th className="text-left py-2 px-2 font-medium">BASE LOCATION</th>
                      <th className="text-left py-2 px-2 font-medium">SERVICE AREA</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCharter.map(operator => (
                      <tr key={operator.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              operator.type === 'charter' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              operator.type === 'tour' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                              operator.type === 'school' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {operator.type === 'school' ? (
                              <><GraduationCap className="w-2 h-2 mr-1" />SCHOOL</>
                            ) : (
                              operator.type.toUpperCase()
                            )}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {operator.type === 'school' ? (
                              <GraduationCap className="w-3 h-3 text-yellow-400" />
                            ) : (
                              <Truck className="w-3 h-3 text-blue-400" />
                            )}
                            <div>
                              <div className="font-medium text-foreground">{operator.name}</div>
                              {operator.website && (
                                <a 
                                  href={operator.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-cyan-400 hover:underline"
                                >
                                  {operator.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {operator.fleet_size && (
                                <div className="text-[10px] text-muted-foreground">Fleet: {operator.fleet_size}</div>
                              )}
                              {operator.notes && (
                                <div className="text-[10px] text-muted-foreground">{operator.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="text-muted-foreground">{operator.base_location.municipality}</div>
                          {operator.base_location.address && (
                            <div className="text-[10px] text-muted-foreground/70">{operator.base_location.address}</div>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1 max-w-64">
                            {operator.service_area.slice(0, 4).map((area, i) => (
                              <Badge key={i} variant="outline" className="text-[8px]">
                                {area}
                              </Badge>
                            ))}
                            {operator.service_area.length > 4 && (
                              <Badge variant="outline" className="text-[8px] bg-muted/30">
                                +{operator.service_area.length - 4}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {operator.matchedMunicipality ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{operator.matchedMunicipality.name}</span>
                            </div>
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
          )}

          {groundSubTab === "courier" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">SERVICE</th>
                      <th className="text-left py-2 px-2 font-medium">FACILITIES</th>
                      <th className="text-left py-2 px-2 font-medium">COVERAGE</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourier.map(service => (
                      <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              service.type === 'postal' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              service.type === 'express' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              service.type === 'regional' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              service.type === 'freight' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                              'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            }`}
                          >
                            {service.type === 'postal' ? (
                              <><Mail className="w-2 h-2 mr-1" />POSTAL</>
                            ) : service.type === 'same_day' ? (
                              'SAME DAY'
                            ) : (
                              service.type.toUpperCase()
                            )}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {service.type === 'postal' ? (
                              <Mail className="w-3 h-3 text-red-400" />
                            ) : (
                              <Package className="w-3 h-3 text-green-400" />
                            )}
                            <div>
                              <div className="font-medium text-foreground">{service.name}</div>
                              {service.website && (
                                <a 
                                  href={service.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-cyan-400 hover:underline"
                                >
                                  {service.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {service.phone && (
                                <div className="text-[10px] text-muted-foreground">{service.phone}</div>
                              )}
                              {service.notes && (
                                <div className="text-[10px] text-muted-foreground/70">{service.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.facilities.slice(0, 4).map((facility, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] px-1">
                                  {facility.facility_type.toUpperCase()}
                                </Badge>
                                <span>{facility.municipality}</span>
                              </div>
                            ))}
                            {service.facilities.length > 4 && (
                              <div className="text-[10px] text-cyan-400">+{service.facilities.length - 4} more facilities</div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1 max-w-64">
                            {service.service_coverage.slice(0, 4).map((area, i) => (
                              <Badge key={i} variant="outline" className="text-[8px]">
                                {area}
                              </Badge>
                            ))}
                            {service.service_coverage.length > 4 && (
                              <Badge variant="outline" className="text-[8px] bg-muted/30">
                                +{service.service_coverage.length - 4}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {service.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{service.matchedMunicipalities.length} of {service.facilities.length}</span>
                            </div>
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
          )}

          {groundSubTab === "trucking" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">CARRIER</th>
                      <th className="text-left py-2 px-2 font-medium">TERMINALS</th>
                      <th className="text-left py-2 px-2 font-medium">COVERAGE</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucking.map(service => (
                      <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              service.type === 'fuel' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                              service.type === 'food' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              service.type === 'refrigerated' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                              service.type === 'logging' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                              service.type === 'aggregate' ? 'bg-stone-500/20 text-stone-400 border-stone-500/30' :
                              service.type === 'hazmat' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              service.type === 'ltl' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                              'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {service.type === 'fuel' ? (
                              <><Fuel className="w-2 h-2 mr-1" />FUEL</>
                            ) : service.type === 'food' ? (
                              <><Apple className="w-2 h-2 mr-1" />FOOD</>
                            ) : service.type === 'refrigerated' ? (
                              <><Snowflake className="w-2 h-2 mr-1" />REEFER</>
                            ) : service.type === 'logging' ? (
                              <><TreePine className="w-2 h-2 mr-1" />LOGGING</>
                            ) : service.type === 'general_freight' ? (
                              <><Container className="w-2 h-2 mr-1" />FREIGHT</>
                            ) : (
                              service.type.toUpperCase().replace('_', ' ')
                            )}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {service.type === 'fuel' ? (
                              <Fuel className="w-3 h-3 text-orange-400" />
                            ) : service.type === 'food' ? (
                              <Apple className="w-3 h-3 text-green-400" />
                            ) : (
                              <Truck className="w-3 h-3 text-blue-400" />
                            )}
                            <div>
                              <div className="font-medium text-foreground">{service.name}</div>
                              {service.website && (
                                <a 
                                  href={service.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-cyan-400 hover:underline"
                                >
                                  {service.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {service.fleet_size && (
                                <div className="text-[10px] text-muted-foreground">Fleet: {service.fleet_size}</div>
                              )}
                              {service.notes && (
                                <div className="text-[10px] text-muted-foreground/70">{service.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.terminals.slice(0, 4).map((terminal, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] px-1">
                                  {terminal.facility_type.toUpperCase()}
                                </Badge>
                                <span>{terminal.municipality}</span>
                              </div>
                            ))}
                            {service.terminals.length > 4 && (
                              <div className="text-[10px] text-cyan-400">+{service.terminals.length - 4} more terminals</div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1 max-w-64">
                            {service.service_coverage.slice(0, 4).map((area, i) => (
                              <Badge key={i} variant="outline" className="text-[8px]">
                                {area}
                              </Badge>
                            ))}
                            {service.service_coverage.length > 4 && (
                              <Badge variant="outline" className="text-[8px] bg-muted/30">
                                +{service.service_coverage.length - 4}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {service.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{service.matchedMunicipalities.length} of {service.terminals.length}</span>
                            </div>
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
          )}
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
