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
  Mail,
  Car
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
  BC_RAIL_SERVICES,
  getTruckingTier,
  getRailTier,
  type IntercityBusService,
  type TransitSystem,
  type CharterBusOperator,
  type CourierService,
  type TruckingService,
  type RailService,
  type IntercityBusType,
  type TransitSystemType,
  type CharterBusType,
  type CourierServiceType,
  type RailServiceType
} from "@shared/ground-transport";
import { BC_WATER_FACILITIES, type WaterFacility, type WaterFacilityType } from "@shared/utilities-water";
import { BC_WASTE_FACILITIES, type WasteFacility, type WasteFacilityType } from "@shared/utilities-waste";
import { BC_ELECTRICITY_FACILITIES, type ElectricityFacility, type ElectricityFacilityType } from "@shared/utilities-electricity";
import { BC_PHARMACIES, type Pharmacy, type PharmacyType, type PharmacyChain, pharmacyTypeLabels, pharmacyChainLabels } from "@shared/pharmacies";
import { BC_COMMUNITY_FACILITIES, type CommunityFacility, type FacilityCategory, type AmenityType, facilityCategoryLabels, amenityTypeLabels } from "@shared/community-facilities";
import { BC_SCHOOLS, type School, type SchoolType, type SchoolCategory, schoolTypeLabels, schoolCategoryLabels } from "@shared/schools";
import { municipalOffices, type MunicipalOffice } from "@shared/municipal-offices";
import { BC_TAXI_SERVICES, type TaxiService, type TaxiServiceType, taxiServiceTypeLabels } from "@shared/taxi-services";
import { BC_CHAMBERS_OF_COMMERCE, type ChamberOfCommerce } from "@shared/chambers-of-commerce";
import { chamberMembers, type ChamberMember, getMembersByChamber } from "@shared/chamber-members";
import { naicsSubsectorLabels } from "@shared/naics-codes";
import { Fuel, Apple, Container, TreePine, Snowflake, Droplets, Trash2, Zap, Pill, Briefcase, Store, ExternalLink, Globe, Link2 } from "lucide-react";
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

interface RailWithMatch extends RailService {
  matchedMunicipalities: GeoNode[];
}

interface WaterWithMatch extends WaterFacility {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface WasteWithMatch extends WasteFacility {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface ElectricityWithMatch extends ElectricityFacility {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface PostalFacilityWithMatch {
  id: string;
  serviceName: string;
  facilityName: string;
  facilityType: "hub" | "depot" | "outlet" | "dropbox" | "locker" | "post_office" | "rural_po" | "franchise";
  municipality: string;
  address?: string;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface CourierFacilityWithMatch {
  id: string;
  serviceName: string;
  serviceType: "express" | "regional" | "freight" | "same_day";
  facilityName: string;
  facilityType: "hub" | "depot" | "outlet" | "dropbox" | "locker";
  municipality: string;
  address?: string;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface PharmacyWithMatch extends Pharmacy {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface CommunityFacilityWithMatch extends CommunityFacility {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface SchoolWithMatch extends School {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface MunicipalOfficeWithMatch extends MunicipalOffice {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface TaxiServiceWithMatch extends TaxiService {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

interface ChamberWithMatch extends ChamberOfCommerce {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
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
  const [waterSearch, setWaterSearch] = useState("");
  const [wasteSearch, setWasteSearch] = useState("");
  const [electricitySearch, setElectricitySearch] = useState("");
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [facilitySearch, setFacilitySearch] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [municipalOfficeSearch, setMunicipalOfficeSearch] = useState("");
  const [taxiSearch, setTaxiSearch] = useState("");
  const [chamberSearch, setChamberSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberNaicsFilter, setMemberNaicsFilter] = useState<string>("all");
  const [lifelineSubTab, setLifelineSubTab] = useState<"fuel" | "food" | "hazmat">("fuel");
  const [supplySubTab, setSupplySubTab] = useState<"freight" | "rail">("freight");
  const [mobilitySubTab, setMobilitySubTab] = useState<"intercity" | "transit" | "charter" | "rail">("intercity");
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

  const postalFacilitiesWithMatches: PostalFacilityWithMatch[] = useMemo(() => {
    const postalServices = BC_COURIER_SERVICES.filter(s => s.type === 'postal');
    return postalServices.flatMap(service => 
      service.facilities.map((facility, index) => {
        const matchedMuni = findMatchingMunicipality(facility.municipality);
        const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
        return {
          id: `${service.id}-${index}`,
          serviceName: service.name,
          facilityName: facility.name,
          facilityType: facility.facility_type,
          municipality: facility.municipality,
          address: facility.address,
          lat: facility.lat,
          lng: facility.lng,
          website: service.website,
          phone: service.phone,
          matchedMunicipality: matchedMuni,
          matchedRegion,
        };
      })
    );
  }, []);

  const courierFacilitiesWithMatches: CourierFacilityWithMatch[] = useMemo(() => {
    const courierServices = BC_COURIER_SERVICES.filter(s => s.type !== 'postal');
    return courierServices.flatMap(service => 
      service.facilities
        .filter(f => ['hub', 'depot', 'outlet', 'dropbox', 'locker'].includes(f.facility_type))
        .map((facility, index) => {
          const matchedMuni = findMatchingMunicipality(facility.municipality);
          const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
          return {
            id: `${service.id}-${index}`,
            serviceName: service.name,
            serviceType: service.type as "express" | "regional" | "freight" | "same_day",
            facilityName: facility.name,
            facilityType: facility.facility_type as "hub" | "depot" | "outlet" | "dropbox" | "locker",
            municipality: facility.municipality,
            address: facility.address,
            lat: facility.lat,
            lng: facility.lng,
            website: service.website,
            phone: service.phone,
            matchedMunicipality: matchedMuni,
            matchedRegion,
          };
        })
    );
  }, []);

  const truckingWithMatches: TruckingWithMatch[] = useMemo(() => {
    return BC_TRUCKING_SERVICES.map(service => ({
      ...service,
      matchedMunicipalities: service.terminals
        .map(t => findMatchingMunicipality(t.municipality))
        .filter((m): m is GeoNode => m !== null),
    }));
  }, []);

  const railWithMatches: RailWithMatch[] = useMemo(() => {
    return BC_RAIL_SERVICES.map(service => ({
      ...service,
      matchedMunicipalities: service.stations
        .map(s => findMatchingMunicipality(s.municipality))
        .filter((m): m is GeoNode => m !== null),
    }));
  }, []);

  const waterWithMatches: WaterWithMatch[] = useMemo(() => {
    return BC_WATER_FACILITIES.map(facility => ({
      ...facility,
      matchedMunicipality: findMatchingMunicipality(facility.municipality),
      matchedRegion: findMatchingRegion(facility.region.toLowerCase().replace(/\s+/g, '-')),
    }));
  }, []);

  const wasteWithMatches: WasteWithMatch[] = useMemo(() => {
    return BC_WASTE_FACILITIES.map(facility => ({
      ...facility,
      matchedMunicipality: findMatchingMunicipality(facility.municipality),
      matchedRegion: findMatchingRegion(facility.region.toLowerCase().replace(/\s+/g, '-')),
    }));
  }, []);

  const electricityWithMatches: ElectricityWithMatch[] = useMemo(() => {
    return BC_ELECTRICITY_FACILITIES.map(facility => ({
      ...facility,
      matchedMunicipality: findMatchingMunicipality(facility.municipality),
      matchedRegion: findMatchingRegion(facility.region.toLowerCase().replace(/\s+/g, '-')),
    }));
  }, []);

  const pharmacyWithMatches: PharmacyWithMatch[] = useMemo(() => {
    return BC_PHARMACIES.map(pharmacy => {
      const matchedMuni = findMatchingMunicipality(pharmacy.municipality);
      const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
      return {
        ...pharmacy,
        matchedMunicipality: matchedMuni,
        matchedRegion,
      };
    });
  }, []);

  const facilityWithMatches: CommunityFacilityWithMatch[] = useMemo(() => {
    return BC_COMMUNITY_FACILITIES.map(facility => {
      const matchedMuni = findMatchingMunicipality(facility.municipality);
      const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
      return {
        ...facility,
        matchedMunicipality: matchedMuni,
        matchedRegion,
      };
    });
  }, []);

  const schoolWithMatches: SchoolWithMatch[] = useMemo(() => {
    return BC_SCHOOLS.map(school => {
      const matchedMuni = findMatchingMunicipality(school.municipality);
      const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
      return {
        ...school,
        matchedMunicipality: matchedMuni,
        matchedRegion,
      };
    });
  }, []);

  const municipalOfficeWithMatches: MunicipalOfficeWithMatch[] = useMemo(() => {
    return municipalOffices.map(office => {
      const matchedMuni = findMatchingMunicipality(office.municipality);
      const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
      return {
        ...office,
        matchedMunicipality: matchedMuni,
        matchedRegion,
      };
    });
  }, []);

  const taxiServiceWithMatches: TaxiServiceWithMatch[] = useMemo(() => {
    return BC_TAXI_SERVICES.map(taxi => {
      const matchedMuni = findMatchingMunicipality(taxi.municipality);
      const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
      return {
        ...taxi,
        matchedMunicipality: matchedMuni,
        matchedRegion,
      };
    });
  }, []);

  const chamberWithMatches: ChamberWithMatch[] = useMemo(() => {
    return BC_CHAMBERS_OF_COMMERCE.map(chamber => {
      const matchedMuni = findMatchingMunicipality(chamber.municipality);
      const matchedRegion = matchedMuni?.parentId ? GEO_HIERARCHY[matchedMuni.parentId] || null : null;
      return {
        ...chamber,
        matchedMunicipality: matchedMuni,
        matchedRegion,
      };
    });
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
    const nonPostal = courierWithMatches.filter(s => s.type !== 'postal');
    if (!groundSearch) return nonPostal;
    const search = groundSearch.toLowerCase();
    return nonPostal.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.facilities.some(f => f.name.toLowerCase().includes(search) || f.municipality.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [courierWithMatches, groundSearch]);

  const filteredCourierFacilities = useMemo(() => {
    if (!groundSearch) return courierFacilitiesWithMatches;
    const search = groundSearch.toLowerCase();
    return courierFacilitiesWithMatches.filter(f => 
      f.facilityName.toLowerCase().includes(search) ||
      f.serviceName.toLowerCase().includes(search) ||
      f.municipality.toLowerCase().includes(search) ||
      f.address?.toLowerCase().includes(search) ||
      f.facilityType.toLowerCase().includes(search) ||
      f.serviceType.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search)
    );
  }, [courierFacilitiesWithMatches, groundSearch]);

  const filteredPostal = useMemo(() => {
    if (!groundSearch) return postalFacilitiesWithMatches;
    const search = groundSearch.toLowerCase();
    return postalFacilitiesWithMatches.filter(f => 
      f.facilityName.toLowerCase().includes(search) ||
      f.serviceName.toLowerCase().includes(search) ||
      f.municipality.toLowerCase().includes(search) ||
      f.address?.toLowerCase().includes(search) ||
      f.facilityType.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search)
    );
  }, [postalFacilitiesWithMatches, groundSearch]);

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

  const filteredRail = useMemo(() => {
    if (!groundSearch) return railWithMatches;
    const search = groundSearch.toLowerCase();
    return railWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.stations.some(st => st.name.toLowerCase().includes(search) || st.municipality.toLowerCase().includes(search)) ||
      s.routes.some(r => r.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [railWithMatches, groundSearch]);

  const filteredLifelineTrucking = useMemo(() => {
    const tier1 = truckingWithMatches.filter(s => getTruckingTier(s.type) === 1);
    if (!groundSearch) return tier1;
    const search = groundSearch.toLowerCase();
    return tier1.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.terminals.some(t => t.name.toLowerCase().includes(search) || t.municipality.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [truckingWithMatches, groundSearch]);

  const filteredSupplyTrucking = useMemo(() => {
    const tier2 = truckingWithMatches.filter(s => getTruckingTier(s.type) === 2);
    if (!groundSearch) return tier2;
    const search = groundSearch.toLowerCase();
    return tier2.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.terminals.some(t => t.name.toLowerCase().includes(search) || t.municipality.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [truckingWithMatches, groundSearch]);

  const filteredSupplyRail = useMemo(() => {
    const tier2 = railWithMatches.filter(s => getRailTier(s.type) === 2);
    if (!groundSearch) return tier2;
    const search = groundSearch.toLowerCase();
    return tier2.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.stations.some(st => st.name.toLowerCase().includes(search) || st.municipality.toLowerCase().includes(search)) ||
      s.routes.some(r => r.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [railWithMatches, groundSearch]);

  const filteredMobilityRail = useMemo(() => {
    const tier3 = railWithMatches.filter(s => getRailTier(s.type) === 3);
    if (!groundSearch) return tier3;
    const search = groundSearch.toLowerCase();
    return tier3.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.stations.some(st => st.name.toLowerCase().includes(search) || st.municipality.toLowerCase().includes(search)) ||
      s.routes.some(r => r.toLowerCase().includes(search)) ||
      s.service_coverage.some(c => c.toLowerCase().includes(search)) ||
      s.type.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search)
    );
  }, [railWithMatches, groundSearch]);

  const filteredWater = useMemo(() => {
    if (!waterSearch) return waterWithMatches;
    const search = waterSearch.toLowerCase();
    return waterWithMatches.filter(f => 
      f.name.toLowerCase().includes(search) ||
      f.municipality?.toLowerCase().includes(search) ||
      f.region?.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search) ||
      f.type.toLowerCase().includes(search) ||
      f.operator?.toLowerCase().includes(search)
    );
  }, [waterWithMatches, waterSearch]);

  const filteredWaste = useMemo(() => {
    if (!wasteSearch) return wasteWithMatches;
    const search = wasteSearch.toLowerCase();
    return wasteWithMatches.filter(f => 
      f.name.toLowerCase().includes(search) ||
      f.municipality?.toLowerCase().includes(search) ||
      f.region?.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search) ||
      f.type.toLowerCase().includes(search) ||
      f.operator?.toLowerCase().includes(search) ||
      f.services?.some(s => s.toLowerCase().includes(search))
    );
  }, [wasteWithMatches, wasteSearch]);

  const filteredElectricity = useMemo(() => {
    if (!electricitySearch) return electricityWithMatches;
    const search = electricitySearch.toLowerCase();
    return electricityWithMatches.filter(f => 
      f.name.toLowerCase().includes(search) ||
      f.municipality?.toLowerCase().includes(search) ||
      f.region?.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search) ||
      f.type.toLowerCase().includes(search) ||
      f.operator?.toLowerCase().includes(search) ||
      (f as any).dam_name?.toLowerCase().includes(search)
    );
  }, [electricityWithMatches, electricitySearch]);

  const filteredPharmacies = useMemo(() => {
    if (!pharmacySearch) return pharmacyWithMatches;
    const search = pharmacySearch.toLowerCase();
    return pharmacyWithMatches.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.municipality?.toLowerCase().includes(search) ||
      p.chain?.toLowerCase().includes(search) ||
      p.matchedMunicipality?.name.toLowerCase().includes(search) ||
      p.matchedRegion?.name.toLowerCase().includes(search) ||
      p.type.toLowerCase().includes(search) ||
      p.address?.toLowerCase().includes(search) ||
      p.courier_services?.some(c => c.toLowerCase().includes(search))
    );
  }, [pharmacyWithMatches, pharmacySearch]);

  const filteredFacilities = useMemo(() => {
    if (!facilitySearch) return facilityWithMatches;
    const search = facilitySearch.toLowerCase();
    return facilityWithMatches.filter(f => 
      f.name.toLowerCase().includes(search) ||
      f.municipality?.toLowerCase().includes(search) ||
      f.category?.toLowerCase().includes(search) ||
      f.matchedMunicipality?.name.toLowerCase().includes(search) ||
      f.matchedRegion?.name.toLowerCase().includes(search) ||
      f.address?.toLowerCase().includes(search) ||
      f.operator?.toLowerCase().includes(search) ||
      f.amenities?.some(a => a.type.toLowerCase().includes(search) || amenityTypeLabels[a.type]?.toLowerCase().includes(search))
    );
  }, [facilityWithMatches, facilitySearch]);

  const filteredSchools = useMemo(() => {
    if (!schoolSearch) return schoolWithMatches;
    const search = schoolSearch.toLowerCase();
    return schoolWithMatches.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.municipality?.toLowerCase().includes(search) ||
      s.category?.toLowerCase().includes(search) ||
      s.type?.toLowerCase().includes(search) ||
      s.matchedMunicipality?.name.toLowerCase().includes(search) ||
      s.matchedRegion?.name.toLowerCase().includes(search) ||
      s.address?.toLowerCase().includes(search) ||
      s.district?.toLowerCase().includes(search) ||
      schoolTypeLabels[s.type]?.toLowerCase().includes(search) ||
      schoolCategoryLabels[s.category]?.toLowerCase().includes(search)
    );
  }, [schoolWithMatches, schoolSearch]);

  const filteredMunicipalOffices = useMemo(() => {
    if (!municipalOfficeSearch) return municipalOfficeWithMatches;
    const search = municipalOfficeSearch.toLowerCase();
    return municipalOfficeWithMatches.filter(o => 
      o.name.toLowerCase().includes(search) ||
      o.municipality?.toLowerCase().includes(search) ||
      o.type?.toLowerCase().includes(search) ||
      o.matchedMunicipality?.name.toLowerCase().includes(search) ||
      o.matchedRegion?.name.toLowerCase().includes(search) ||
      o.address?.toLowerCase().includes(search) ||
      o.region?.toLowerCase().includes(search)
    );
  }, [municipalOfficeWithMatches, municipalOfficeSearch]);

  const filteredTaxiServices = useMemo(() => {
    if (!taxiSearch) return taxiServiceWithMatches;
    const search = taxiSearch.toLowerCase();
    return taxiServiceWithMatches.filter(t => 
      t.name.toLowerCase().includes(search) ||
      t.municipality?.toLowerCase().includes(search) ||
      t.type?.toLowerCase().includes(search) ||
      t.matchedMunicipality?.name.toLowerCase().includes(search) ||
      t.matchedRegion?.name.toLowerCase().includes(search) ||
      t.region?.toLowerCase().includes(search) ||
      t.service_area?.some(a => a.toLowerCase().includes(search)) ||
      taxiServiceTypeLabels[t.type]?.toLowerCase().includes(search)
    );
  }, [taxiServiceWithMatches, taxiSearch]);

  const filteredChambers = useMemo(() => {
    if (!chamberSearch) return chamberWithMatches;
    const search = chamberSearch.toLowerCase();
    return chamberWithMatches.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.municipality?.toLowerCase().includes(search) ||
      c.region?.toLowerCase().includes(search) ||
      c.matchedMunicipality?.name.toLowerCase().includes(search) ||
      c.matchedRegion?.name.toLowerCase().includes(search) ||
      c.notes?.toLowerCase().includes(search) ||
      c.website?.toLowerCase().includes(search)
    );
  }, [chamberWithMatches, chamberSearch]);

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
    const railMatched = railWithMatches.filter(s => s.matchedMunicipalities.length > 0).length;
    const totalHubs = intercityBusWithMatches.reduce((sum, s) => sum + s.hubs.length, 0);
    const totalMunis = Array.from(new Set(transitWithMatches.flatMap(s => s.municipalities_served))).length;
    const schoolBus = charterWithMatches.filter(o => o.type === 'school').length;
    const totalFacilities = courierWithMatches.reduce((sum, s) => sum + s.facilities.length, 0);
    const postalFacilities = courierWithMatches.filter(s => s.type === 'postal').reduce((sum, s) => sum + s.facilities.length, 0);
    const expressCouriers = courierWithMatches.filter(s => s.type === 'express').length;
    const truckingTerminals = truckingWithMatches.reduce((sum, s) => sum + s.terminals.length, 0);
    const fuelDistributors = truckingWithMatches.filter(s => s.type === 'fuel').length;
    const foodDistributors = truckingWithMatches.filter(s => s.type === 'food').length;
    const railStations = railWithMatches.reduce((sum, s) => sum + s.stations.length, 0);
    const freightRails = railWithMatches.filter(s => s.type === 'class_1_freight' || s.type === 'shortline').length;
    const passengerRails = railWithMatches.filter(s => s.type === 'passenger' || s.type === 'commuter').length;
    const touristRails = railWithMatches.filter(s => s.type === 'tourist').length;
    
    const lifelineTrucking = truckingWithMatches.filter(s => getTruckingTier(s.type) === 1);
    const supplyTrucking = truckingWithMatches.filter(s => getTruckingTier(s.type) === 2);
    const supplyRail = railWithMatches.filter(s => getRailTier(s.type) === 2);
    const mobilityRail = railWithMatches.filter(s => getRailTier(s.type) === 3);
    
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
      railServices: railWithMatches.length,
      railMatched,
      railStations,
      freightRails,
      passengerRails,
      touristRails,
      lifelineTotal: lifelineTrucking.length,
      supplyTotal: supplyTrucking.length + supplyRail.length,
      busTotal: intercityBusWithMatches.length + transitWithMatches.length + charterWithMatches.length + mobilityRail.length,
      courierTotal: courierFacilitiesWithMatches.length,
      postalTotal: postalFacilitiesWithMatches.length,
      total: intercityBusWithMatches.length + transitWithMatches.length + charterWithMatches.length + courierFacilitiesWithMatches.length + truckingWithMatches.length + railWithMatches.length
    };
  }, [intercityBusWithMatches, transitWithMatches, charterWithMatches, courierWithMatches, truckingWithMatches, railWithMatches, postalFacilitiesWithMatches, courierFacilitiesWithMatches]);

  const waterStats = useMemo(() => {
    const matched = waterWithMatches.filter(f => f.matchedMunicipality).length;
    const regionOnly = waterWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length;
    const unmatched = waterWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length;
    const byType: Record<string, number> = {};
    waterWithMatches.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });
    const totalCapacity = waterWithMatches.reduce((sum, f) => sum + (f.capacity_ml_day || 0), 0);
    const totalPopulation = waterWithMatches.reduce((sum, f) => sum + (f.population_served || 0), 0);
    return { total: waterWithMatches.length, matched, regionOnly, unmatched, byType, totalCapacity, totalPopulation };
  }, [waterWithMatches]);

  const wasteStats = useMemo(() => {
    const matched = wasteWithMatches.filter(f => f.matchedMunicipality).length;
    const regionOnly = wasteWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length;
    const unmatched = wasteWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length;
    const byType: Record<string, number> = {};
    wasteWithMatches.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });
    const publicAccess = wasteWithMatches.filter(f => f.accepts_public).length;
    return { total: wasteWithMatches.length, matched, regionOnly, unmatched, byType, publicAccess };
  }, [wasteWithMatches]);

  const electricityStats = useMemo(() => {
    const matched = electricityWithMatches.filter(f => f.matchedMunicipality).length;
    const regionOnly = electricityWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length;
    const unmatched = electricityWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length;
    const byType: Record<string, number> = {};
    electricityWithMatches.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });
    const totalCapacity = electricityWithMatches.reduce((sum, f) => sum + (f.capacity_mw || 0), 0);
    return { total: electricityWithMatches.length, matched, regionOnly, unmatched, byType, totalCapacity };
  }, [electricityWithMatches]);

  const pharmacyStats = useMemo(() => {
    const matched = pharmacyWithMatches.filter(p => p.matchedMunicipality).length;
    const regionOnly = pharmacyWithMatches.filter(p => !p.matchedMunicipality && p.matchedRegion).length;
    const unmatched = pharmacyWithMatches.filter(p => !p.matchedMunicipality && !p.matchedRegion).length;
    const byChain: Record<string, number> = {};
    pharmacyWithMatches.forEach(p => {
      byChain[p.chain] = (byChain[p.chain] || 0) + 1;
    });
    const byType: Record<string, number> = {};
    pharmacyWithMatches.forEach(p => {
      byType[p.type] = (byType[p.type] || 0) + 1;
    });
    const withCourier = pharmacyWithMatches.filter(p => p.courier_services && p.courier_services.length > 0).length;
    return { total: pharmacyWithMatches.length, matched, regionOnly, unmatched, byChain, byType, withCourier };
  }, [pharmacyWithMatches]);

  const facilityStats = useMemo(() => {
    const matched = facilityWithMatches.filter(f => f.matchedMunicipality).length;
    const regionOnly = facilityWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length;
    const unmatched = facilityWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length;
    const byCategory: Record<string, number> = {};
    facilityWithMatches.forEach(f => {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    });
    const totalAmenities = facilityWithMatches.reduce((sum, f) => sum + (f.amenities?.length || 0), 0);
    return { total: facilityWithMatches.length, matched, regionOnly, unmatched, byCategory, totalAmenities };
  }, [facilityWithMatches]);

  const schoolStats = useMemo(() => {
    const matched = schoolWithMatches.filter(s => s.matchedMunicipality).length;
    const regionOnly = schoolWithMatches.filter(s => !s.matchedMunicipality && s.matchedRegion).length;
    const unmatched = schoolWithMatches.filter(s => !s.matchedMunicipality && !s.matchedRegion).length;
    const byCategory: Record<string, number> = {};
    schoolWithMatches.forEach(s => {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    });
    const byType: Record<string, number> = {};
    schoolWithMatches.forEach(s => {
      byType[s.type] = (byType[s.type] || 0) + 1;
    });
    return { total: schoolWithMatches.length, matched, regionOnly, unmatched, byCategory, byType };
  }, [schoolWithMatches]);

  const municipalOfficeStats = useMemo(() => {
    const matched = municipalOfficeWithMatches.filter(o => o.matchedMunicipality).length;
    const regionOnly = municipalOfficeWithMatches.filter(o => !o.matchedMunicipality && o.matchedRegion).length;
    const unmatched = municipalOfficeWithMatches.filter(o => !o.matchedMunicipality && !o.matchedRegion).length;
    const byType: Record<string, number> = {};
    municipalOfficeWithMatches.forEach(o => {
      byType[o.type] = (byType[o.type] || 0) + 1;
    });
    const cityHalls = municipalOfficeWithMatches.filter(o => o.type === 'city_hall').length;
    const townOffices = municipalOfficeWithMatches.filter(o => o.type === 'town_office').length;
    const districtOffices = municipalOfficeWithMatches.filter(o => o.type === 'district_office').length;
    const villageOffices = municipalOfficeWithMatches.filter(o => o.type === 'village_office').length;
    const regionalDistricts = municipalOfficeWithMatches.filter(o => o.type === 'regional_district').length;
    const firstNation = municipalOfficeWithMatches.filter(o => o.type === 'first_nation_band_office').length;
    const treatyNation = municipalOfficeWithMatches.filter(o => o.type === 'treaty_nation_office').length;
    return { 
      total: municipalOfficeWithMatches.length, 
      matched, 
      regionOnly, 
      unmatched, 
      byType, 
      cityHalls, 
      townOffices, 
      districtOffices, 
      villageOffices,
      regionalDistricts,
      firstNation,
      treatyNation
    };
  }, [municipalOfficeWithMatches]);

  const taxiStats = useMemo(() => {
    const matched = taxiServiceWithMatches.filter(t => t.matchedMunicipality).length;
    const regionOnly = taxiServiceWithMatches.filter(t => !t.matchedMunicipality && t.matchedRegion).length;
    const unmatched = taxiServiceWithMatches.filter(t => !t.matchedMunicipality && !t.matchedRegion).length;
    const byType: Record<string, number> = {};
    taxiServiceWithMatches.forEach(t => {
      byType[t.type] = (byType[t.type] || 0) + 1;
    });
    const withApp = taxiServiceWithMatches.filter(t => t.app_available).length;
    const accessible = taxiServiceWithMatches.filter(t => t.wheelchair_accessible).length;
    return { 
      total: taxiServiceWithMatches.length, 
      matched, 
      regionOnly, 
      unmatched, 
      byType,
      withApp,
      accessible
    };
  }, [taxiServiceWithMatches]);

  const chamberStats = useMemo(() => {
    const matched = chamberWithMatches.filter(c => c.matchedMunicipality).length;
    const regionOnly = chamberWithMatches.filter(c => !c.matchedMunicipality && c.matchedRegion).length;
    const unmatched = chamberWithMatches.filter(c => !c.matchedMunicipality && !c.matchedRegion).length;
    const byRegion: Record<string, number> = {};
    chamberWithMatches.forEach(c => {
      byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    });
    const withWebsite = chamberWithMatches.filter(c => c.website).length;
    const withPhone = chamberWithMatches.filter(c => c.phone).length;
    const withMembers = chamberWithMatches.filter(c => c.members).length;
    return { 
      total: chamberWithMatches.length, 
      matched, 
      regionOnly, 
      unmatched, 
      byRegion,
      withWebsite,
      withPhone,
      withMembers
    };
  }, [chamberWithMatches]);

  const filteredMembers = useMemo(() => {
    let filtered = chamberMembers;
    
    if (memberNaicsFilter !== "all") {
      filtered = filtered.filter(m => m.naicsSubsector === memberNaicsFilter);
    }
    
    if (!memberSearch) return filtered;
    const search = memberSearch.toLowerCase();
    return filtered.filter(m => {
      const businessName = m.businessName.toLowerCase();
      const naicsTitle = m.naicsTitle?.toLowerCase() || '';
      const subcategory = m.subcategory?.toLowerCase();
      const description = m.description?.toLowerCase();
      const municipality = m.municipality?.toLowerCase();
      const region = m.region?.toLowerCase();
      const website = m.website?.toLowerCase();
      const subsectorLabel = naicsSubsectorLabels[m.naicsSubsector || '']?.toLowerCase() || '';
      
      return businessName.includes(search) ||
        naicsTitle.includes(search) ||
        (subcategory && subcategory.includes(search)) ||
        (description && description.includes(search)) ||
        (municipality && municipality.includes(search)) ||
        (region && region.includes(search)) ||
        (website && website.includes(search)) ||
        subsectorLabel.includes(search);
    });
  }, [memberSearch, memberNaicsFilter]);

  const memberStats = useMemo(() => {
    const byNaicsSubsector: Record<string, number> = {};
    chamberMembers.forEach(m => {
      const subsector = m.naicsSubsector || 'unknown';
      byNaicsSubsector[subsector] = (byNaicsSubsector[subsector] || 0) + 1;
    });
    const withWebsite = chamberMembers.filter(m => m.website && !m.websiteNeedsCollection).length;
    const needsWebsite = chamberMembers.filter(m => m.websiteNeedsCollection).length;
    const withCrossRef = chamberMembers.filter(m => m.crossReference).length;
    const byChamber: Record<string, number> = {};
    chamberMembers.forEach(m => {
      byChamber[m.chamberId] = (byChamber[m.chamberId] || 0) + 1;
    });
    const usedSubsectors = Object.keys(byNaicsSubsector).filter(s => s !== 'unknown').sort();
    return { 
      total: chamberMembers.length, 
      byNaicsSubsector,
      byChamber,
      withWebsite,
      needsWebsite,
      withCrossRef,
      usedSubsectors
    };
  }, []);

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
              value="ground-lifeline" 
              className="text-xs data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
              data-testid="tab-ground-lifeline"
            >
              <Fuel className="w-3 h-3 mr-1" />
              GROUND - LIFELINE ({groundStats.lifelineTotal})
            </TabsTrigger>
            <TabsTrigger 
              value="ground-supply" 
              className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              data-testid="tab-ground-supply"
            >
              <Container className="w-3 h-3 mr-1" />
              GROUND - SUPPLY CHAIN ({groundStats.supplyTotal})
            </TabsTrigger>
            <TabsTrigger 
              value="ground-bus" 
              className="text-xs data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
              data-testid="tab-ground-bus"
            >
              <Bus className="w-3 h-3 mr-1" />
              GROUND - BUS ({groundStats.busTotal})
            </TabsTrigger>
            <TabsTrigger 
              value="ground-taxi" 
              className="text-xs data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400"
              data-testid="tab-ground-taxi"
            >
              <Car className="w-3 h-3 mr-1" />
              GROUND - TAXI ({taxiStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="ground-courier" 
              className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
              data-testid="tab-ground-courier"
            >
              <Package className="w-3 h-3 mr-1" />
              GROUND - COURIER ({groundStats.courierTotal})
            </TabsTrigger>
            <TabsTrigger 
              value="ground-postal" 
              className="text-xs data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400"
              data-testid="tab-ground-postal"
            >
              <Mail className="w-3 h-3 mr-1" />
              GROUND - POSTAL ({groundStats.postalTotal})
            </TabsTrigger>
            <TabsTrigger 
              value="water" 
              className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
              data-testid="tab-water"
            >
              <Droplets className="w-3 h-3 mr-1" />
              WATER ({waterStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="waste" 
              className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
              data-testid="tab-waste"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              WASTE ({wasteStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="electricity" 
              className="text-xs data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400"
              data-testid="tab-electricity"
            >
              <Zap className="w-3 h-3 mr-1" />
              ELECTRICITY ({electricityStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="pharmacies" 
              className="text-xs data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-400"
              data-testid="tab-pharmacies"
            >
              <Pill className="w-3 h-3 mr-1" />
              PHARMACIES ({pharmacyStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="facilities" 
              className="text-xs data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400"
              data-testid="tab-facilities"
            >
              <Building2 className="w-3 h-3 mr-1" />
              REC FACILITIES ({facilityStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="schools" 
              className="text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400"
              data-testid="tab-schools"
            >
              <GraduationCap className="w-3 h-3 mr-1" />
              SCHOOLS ({schoolStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="municipal-offices" 
              className="text-xs data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400"
              data-testid="tab-municipal-offices"
            >
              <Building2 className="w-3 h-3 mr-1" />
              MUNICIPAL ({municipalOfficeStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="chambers" 
              className="text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400"
              data-testid="tab-chambers"
            >
              <Briefcase className="w-3 h-3 mr-1" />
              CHAMBERS ({chamberStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="members" 
              className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
              data-testid="tab-members"
            >
              <Store className="w-3 h-3 mr-1" />
              MEMBERS ({memberStats.total})
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

        <TabsContent value="ground-lifeline" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search lifeline transport..."
                value={groundSearch}
                onChange={e => setGroundSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-lifeline-search"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={lifelineSubTab === "fuel" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setLifelineSubTab("fuel")}
                data-testid="button-lifeline-subtab-fuel"
              >
                <Fuel className="w-2.5 h-2.5 mr-1" />
                FUEL ({filteredLifelineTrucking.filter(s => s.type === 'fuel').length})
              </Button>
              <Button
                size="sm"
                variant={lifelineSubTab === "food" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setLifelineSubTab("food")}
                data-testid="button-lifeline-subtab-food"
              >
                <Apple className="w-2.5 h-2.5 mr-1" />
                FOOD ({filteredLifelineTrucking.filter(s => s.type === 'food').length})
              </Button>
              <Button
                size="sm"
                variant={lifelineSubTab === "hazmat" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setLifelineSubTab("hazmat")}
                data-testid="button-lifeline-subtab-hazmat"
              >
                <Flame className="w-2.5 h-2.5 mr-1" />
                HAZMAT ({filteredLifelineTrucking.filter(s => s.type === 'hazmat').length})
              </Button>
            </div>
            <div className="text-[10px] text-orange-400 font-medium">TIER 1 - CRITICAL</div>
          </div>
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
                  {filteredLifelineTrucking.filter(s => s.type === lifelineSubTab).map(service => (
                    <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${
                            service.type === 'fuel' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                            service.type === 'food' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}
                        >
                          {service.type === 'fuel' ? (
                            <><Fuel className="w-2 h-2 mr-1" />FUEL</>
                          ) : service.type === 'food' ? (
                            <><Apple className="w-2 h-2 mr-1" />FOOD</>
                          ) : (
                            <><Flame className="w-2 h-2 mr-1" />HAZMAT</>
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
                            <Flame className="w-3 h-3 text-red-400" />
                          )}
                          <div>
                            <div className="font-medium text-foreground">{service.name}</div>
                            {service.website && (
                              <a href={service.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                                {service.website.replace('https://', '').replace('http://', '')}
                              </a>
                            )}
                            {service.fleet_size && <div className="text-[10px] text-muted-foreground">Fleet: {service.fleet_size}</div>}
                            {service.notes && <div className="text-[10px] text-muted-foreground/70">{service.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="space-y-0.5">
                          {service.terminals.slice(0, 4).map((terminal, i) => (
                            <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Badge variant="outline" className="text-[8px] px-1">{terminal.facility_type.toUpperCase()}</Badge>
                              <span>{terminal.municipality}</span>
                            </div>
                          ))}
                          {service.terminals.length > 4 && <div className="text-[10px] text-cyan-400">+{service.terminals.length - 4} more</div>}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1 max-w-64">
                          {service.service_coverage.slice(0, 4).map((area, i) => (
                            <Badge key={i} variant="outline" className="text-[8px]">{area}</Badge>
                          ))}
                          {service.service_coverage.length > 4 && (
                            <Badge variant="outline" className="text-[8px] bg-muted/30">+{service.service_coverage.length - 4}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {service.matchedMunicipalities.length > 0 ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{service.matchedMunicipalities.length} of {service.terminals.length}</span>
                          </div>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ground-supply" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search supply chain..."
                value={groundSearch}
                onChange={e => setGroundSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-supply-search"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={supplySubTab === "freight" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setSupplySubTab("freight")}
                data-testid="button-supply-subtab-freight"
              >
                <Container className="w-2.5 h-2.5 mr-1" />
                FREIGHT ({filteredSupplyTrucking.length})
              </Button>
              <Button
                size="sm"
                variant={supplySubTab === "rail" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setSupplySubTab("rail")}
                data-testid="button-supply-subtab-rail"
              >
                <Train className="w-2.5 h-2.5 mr-1" />
                RAIL ({filteredSupplyRail.length})
              </Button>
            </div>
            <div className="text-[10px] text-blue-400 font-medium">TIER 2 - SUPPLY CHAIN</div>
          </div>

          {supplySubTab === "freight" && (
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
                    {filteredSupplyTrucking.map(service => (
                      <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              service.type === 'refrigerated' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                              service.type === 'logging' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                              service.type === 'aggregate' ? 'bg-stone-500/20 text-stone-400 border-stone-500/30' :
                              service.type === 'ltl' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                              'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {service.type === 'refrigerated' ? (
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
                            <Truck className="w-3 h-3 text-blue-400" />
                            <div>
                              <div className="font-medium text-foreground">{service.name}</div>
                              {service.website && (
                                <a href={service.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                                  {service.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {service.fleet_size && <div className="text-[10px] text-muted-foreground">Fleet: {service.fleet_size}</div>}
                              {service.notes && <div className="text-[10px] text-muted-foreground/70">{service.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.terminals.slice(0, 4).map((terminal, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] px-1">{terminal.facility_type.toUpperCase()}</Badge>
                                <span>{terminal.municipality}</span>
                              </div>
                            ))}
                            {service.terminals.length > 4 && <div className="text-[10px] text-cyan-400">+{service.terminals.length - 4} more</div>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1 max-w-64">
                            {service.service_coverage.slice(0, 4).map((area, i) => (
                              <Badge key={i} variant="outline" className="text-[8px]">{area}</Badge>
                            ))}
                            {service.service_coverage.length > 4 && (
                              <Badge variant="outline" className="text-[8px] bg-muted/30">+{service.service_coverage.length - 4}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {service.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{service.matchedMunicipalities.length} of {service.terminals.length}</span>
                            </div>
                          ) : <span className="text-muted-foreground/50">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}

          {supplySubTab === "rail" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">RAILWAY</th>
                      <th className="text-left py-2 px-2 font-medium">STATIONS</th>
                      <th className="text-left py-2 px-2 font-medium">ROUTES</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplyRail.map(service => (
                      <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-[9px] bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {service.type === 'class_1_freight' ? 'CLASS I' : 'SHORTLINE'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Train className="w-3 h-3 text-blue-400" />
                            <div>
                              <div className="font-medium text-foreground">{service.name}</div>
                              {service.website && (
                                <a href={service.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                                  {service.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {service.notes && <div className="text-[10px] text-muted-foreground/70">{service.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.stations.slice(0, 4).map((station, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] px-1">{station.station_type.replace('_', ' ').toUpperCase()}</Badge>
                                <span>{station.municipality}</span>
                              </div>
                            ))}
                            {service.stations.length > 4 && <div className="text-[10px] text-cyan-400">+{service.stations.length - 4} more</div>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.routes.slice(0, 3).map((route, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground">{route}</div>
                            ))}
                            {service.routes.length > 3 && <div className="text-[10px] text-cyan-400">+{service.routes.length - 3} more</div>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {service.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{service.matchedMunicipalities.length} of {service.stations.length}</span>
                            </div>
                          ) : <span className="text-muted-foreground/50">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="ground-bus" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search bus services..."
                value={groundSearch}
                onChange={e => setGroundSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-bus-search"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={mobilitySubTab === "intercity" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setMobilitySubTab("intercity")}
                data-testid="button-bus-subtab-intercity"
              >
                <Bus className="w-2.5 h-2.5 mr-1" />
                INTERCITY ({filteredIntercity.length})
              </Button>
              <Button
                size="sm"
                variant={mobilitySubTab === "transit" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setMobilitySubTab("transit")}
                data-testid="button-bus-subtab-transit"
              >
                <Train className="w-2.5 h-2.5 mr-1" />
                TRANSIT ({filteredTransit.length})
              </Button>
              <Button
                size="sm"
                variant={mobilitySubTab === "charter" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setMobilitySubTab("charter")}
                data-testid="button-bus-subtab-charter"
              >
                <Truck className="w-2.5 h-2.5 mr-1" />
                CHARTER ({filteredCharter.length})
              </Button>
              <Button
                size="sm"
                variant={mobilitySubTab === "rail" ? "default" : "outline"}
                className="text-[9px] h-7"
                onClick={() => setMobilitySubTab("rail")}
                data-testid="button-bus-subtab-rail"
              >
                <Train className="w-2.5 h-2.5 mr-1" />
                RAIL ({filteredMobilityRail.length})
              </Button>
            </div>
            <div className="text-[10px] text-green-400 font-medium">TIER 3 - COMMUNITY MOVEMENT</div>
          </div>

          {mobilitySubTab === "intercity" && (
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

          {mobilitySubTab === "transit" && (
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

          {mobilitySubTab === "charter" && (
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

          {mobilitySubTab === "rail" && (
            <ScrollArea className="flex-1">
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">TYPE</th>
                      <th className="text-left py-2 px-2 font-medium">RAILWAY</th>
                      <th className="text-left py-2 px-2 font-medium">STATIONS</th>
                      <th className="text-left py-2 px-2 font-medium">ROUTES</th>
                      <th className="text-left py-2 px-2 font-medium">MATCHED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMobilityRail.map(service => (
                      <tr key={service.id} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              service.type === 'passenger' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              service.type === 'commuter' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            }`}
                          >
                            {service.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Train className={`w-3 h-3 ${
                              service.type === 'passenger' ? 'text-green-400' :
                              service.type === 'commuter' ? 'text-yellow-400' :
                              'text-purple-400'
                            }`} />
                            <div>
                              <div className="font-medium text-foreground">{service.name}</div>
                              {service.website && (
                                <a href={service.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                                  {service.website.replace('https://', '').replace('http://', '')}
                                </a>
                              )}
                              {service.notes && <div className="text-[10px] text-muted-foreground/70">{service.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.stations.slice(0, 4).map((station, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] px-1">{station.station_type.replace('_', ' ').toUpperCase()}</Badge>
                                <span>{station.municipality}</span>
                              </div>
                            ))}
                            {service.stations.length > 4 && <div className="text-[10px] text-cyan-400">+{service.stations.length - 4} more</div>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="space-y-0.5">
                            {service.routes.slice(0, 3).map((route, i) => (
                              <div key={i} className="text-[10px] text-muted-foreground">{route}</div>
                            ))}
                            {service.routes.length > 3 && <div className="text-[10px] text-cyan-400">+{service.routes.length - 3} more</div>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {service.matchedMunicipalities.length > 0 ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{service.matchedMunicipalities.length} of {service.stations.length}</span>
                            </div>
                          ) : <span className="text-muted-foreground/50">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="ground-taxi" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search taxi services..."
                value={taxiSearch}
                onChange={e => setTaxiSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-taxi-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{taxiStats.matched} MATCHED</span>
              <span className="text-blue-400">{taxiStats.withApp} APP</span>
              <span className="text-purple-400">{taxiStats.accessible} ACCESSIBLE</span>
              <span className="text-cyan-400">{taxiStats.byType['eco'] || 0} ECO</span>
            </div>
            <div className="text-[10px] text-yellow-400 font-medium">TIER 3 - MOBILITY</div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">COMPANY</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">SERVICE AREA</th>
                    <th className="text-left py-2 px-2">FEATURES</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">CONTACT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTaxiServices.map(taxi => (
                    <tr 
                      key={taxi.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-taxi-${taxi.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Car className="w-3 h-3 text-yellow-400" />
                          <div>
                            <div className="font-medium">{taxi.name}</div>
                            {taxi.fleet_size && <div className="text-[10px] text-muted-foreground">{taxi.fleet_size}</div>}
                            <div className="text-[10px] text-muted-foreground">{taxi.base_location.lat.toFixed(4)}, {taxi.base_location.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          taxi.type === 'taxi' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                          taxi.type === 'accessible' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          taxi.type === 'eco' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          taxi.type === 'airport' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          'bg-muted/30 text-muted-foreground border-muted/50'
                        }`}>
                          {taxiServiceTypeLabels[taxi.type]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="space-y-0.5">
                          {taxi.service_area.slice(0, 3).map((area, i) => (
                            <div key={i} className="text-[10px] text-muted-foreground">{area}</div>
                          ))}
                          {taxi.service_area.length > 3 && <div className="text-[10px] text-yellow-400">+{taxi.service_area.length - 3} more</div>}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {taxi.app_available && (
                            <Badge variant="outline" className="text-[8px] bg-blue-500/10 text-blue-400 border-blue-500/30">APP</Badge>
                          )}
                          {taxi.wheelchair_accessible && (
                            <Badge variant="outline" className="text-[8px] bg-purple-500/10 text-purple-400 border-purple-500/30">ACCESSIBLE</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{taxi.municipality}</td>
                      <td className="py-2 px-2">
                        {taxi.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{taxi.matchedMunicipality.name}</span>
                          </div>
                        ) : taxi.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-3 h-3" />
                            <span>No match</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          {taxi.phone && <div className="text-muted-foreground">{taxi.phone}</div>}
                          {taxi.website && <div className="text-blue-400/70 truncate max-w-[120px]">{taxi.website.replace(/^https?:\/\//, '')}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ground-courier" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search courier locations..."
                value={groundSearch}
                onChange={e => setGroundSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-courier-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{courierFacilitiesWithMatches.filter(f => f.matchedMunicipality).length} MATCHED</span>
              <span className="text-yellow-400">{courierFacilitiesWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length} REGION ONLY</span>
              <span className="text-red-400">{courierFacilitiesWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length} UNMATCHED</span>
            </div>
            <div className="text-[10px] text-purple-400 font-medium">TIER 4 - DELIVERY SERVICES</div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">LOCATION</th>
                    <th className="text-left py-2 px-2">SERVICE</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">ADDRESS</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourierFacilities.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-courier-${facility.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3 text-purple-400" />
                          <div>
                            <div className="font-medium">{facility.facilityName}</div>
                            <div className="text-[10px] text-muted-foreground">{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-[8px] ${
                            facility.serviceType === 'express' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                            facility.serviceType === 'regional' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                            facility.serviceType === 'freight' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                            'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          }`}
                        >
                          {facility.serviceName}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          facility.facilityType === 'hub' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          facility.facilityType === 'depot' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          facility.facilityType === 'outlet' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/30'
                        }`}>
                          {facility.facilityType.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-[10px]">{facility.address || '-'}</td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : facility.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{facility.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ground-postal" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search post offices..."
                value={groundSearch}
                onChange={e => setGroundSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-postal-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{postalFacilitiesWithMatches.filter(f => f.matchedMunicipality).length} MATCHED</span>
              <span className="text-yellow-400">{postalFacilitiesWithMatches.filter(f => !f.matchedMunicipality && f.matchedRegion).length} REGION ONLY</span>
              <span className="text-red-400">{postalFacilitiesWithMatches.filter(f => !f.matchedMunicipality && !f.matchedRegion).length} UNMATCHED</span>
            </div>
            <div className="text-[10px] text-red-400 font-medium">TIER 4 - POSTAL SERVICE</div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">POST OFFICE</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">ADDRESS</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPostal.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-postal-${facility.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-red-400" />
                          <div>
                            <div className="font-medium">{facility.facilityName}</div>
                            <div className="text-[10px] text-muted-foreground">{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          facility.facilityType === 'hub' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          facility.facilityType === 'depot' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          facility.facilityType === 'post_office' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          facility.facilityType === 'rural_po' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                          facility.facilityType === 'franchise' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/30'
                        }`}>
                          {facility.facilityType.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-[10px]">{facility.address || '-'}</td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : facility.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{facility.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="water" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search water facilities..."
                value={waterSearch}
                onChange={e => setWaterSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-water-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{waterStats.matched} MATCHED</span>
              <span className="text-yellow-400">{waterStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{waterStats.unmatched} UNMATCHED</span>
              <span className="text-cyan-400">{waterStats.totalCapacity.toFixed(0)} ML/DAY CAPACITY</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">FACILITY</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">OPERATOR</th>
                    <th className="text-left py-2 px-2">CAPACITY</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWater.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-water-${facility.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-3 h-3 text-cyan-400" />
                          <div>
                            <div className="font-medium">{facility.name}</div>
                            <div className="text-[10px] text-muted-foreground">{facility.latitude.toFixed(4)}, {facility.longitude.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[8px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                          {facility.type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.operator || '-'}</td>
                      <td className="py-2 px-2">
                        {facility.capacity_ml_day ? (
                          <span className="text-cyan-400">{facility.capacity_ml_day} ML/day</span>
                        ) : facility.population_served ? (
                          <span className="text-blue-400">{facility.population_served.toLocaleString()} people</span>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : facility.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{facility.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">{facility.region}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="waste" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search waste facilities..."
                value={wasteSearch}
                onChange={e => setWasteSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-waste-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{wasteStats.matched} MATCHED</span>
              <span className="text-yellow-400">{wasteStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{wasteStats.unmatched} UNMATCHED</span>
              <span className="text-amber-400">{wasteStats.publicAccess} PUBLIC ACCESS</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">FACILITY</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">OPERATOR</th>
                    <th className="text-left py-2 px-2">SERVICES</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-center py-2 px-2">PUBLIC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWaste.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-waste-${facility.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-3 h-3 text-amber-400" />
                          <div>
                            <div className="font-medium">{facility.name}</div>
                            <div className="text-[10px] text-muted-foreground">{facility.latitude.toFixed(4)}, {facility.longitude.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[8px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {facility.type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.operator || '-'}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1 max-w-48">
                          {facility.services?.slice(0, 3).map((service, i) => (
                            <Badge key={i} variant="outline" className="text-[8px]">{service}</Badge>
                          ))}
                          {facility.services && facility.services.length > 3 && (
                            <Badge variant="outline" className="text-[8px] bg-muted/30">+{facility.services.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : facility.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {facility.accepts_public ? (
                          <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="electricity" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search electricity facilities..."
                value={electricitySearch}
                onChange={e => setElectricitySearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-electricity-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{electricityStats.matched} MATCHED</span>
              <span className="text-yellow-400">{electricityStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{electricityStats.unmatched} UNMATCHED</span>
              <span className="text-yellow-400">{electricityStats.totalCapacity.toLocaleString()} MW TOTAL</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">FACILITY</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">OPERATOR</th>
                    <th className="text-left py-2 px-2">CAPACITY</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredElectricity.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-electricity-${facility.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <div>
                            <div className="font-medium">{facility.name}</div>
                            {(facility as any).dam_name && <div className="text-[10px] text-muted-foreground">Dam: {(facility as any).dam_name}</div>}
                            <div className="text-[10px] text-muted-foreground">{facility.latitude.toFixed(4)}, {facility.longitude.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[8px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                          {facility.type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.operator || '-'}</td>
                      <td className="py-2 px-2">
                        {facility.capacity_mw ? (
                          <span className="text-yellow-400">{facility.capacity_mw.toLocaleString()} MW</span>
                        ) : facility.voltage_kv ? (
                          <span className="text-blue-400">{facility.voltage_kv} kV</span>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : facility.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{facility.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">{facility.region}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pharmacies" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search pharmacies..."
                value={pharmacySearch}
                onChange={e => setPharmacySearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-pharmacy-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{pharmacyStats.matched} MATCHED</span>
              <span className="text-yellow-400">{pharmacyStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{pharmacyStats.unmatched} UNMATCHED</span>
              <span className="text-pink-400">{pharmacyStats.withCourier} W/COURIER</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">PHARMACY</th>
                    <th className="text-left py-2 px-2">CHAIN</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">COURIER SERVICES</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPharmacies.map(pharmacy => (
                    <tr 
                      key={pharmacy.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-pharmacy-${pharmacy.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Pill className="w-3 h-3 text-pink-400" />
                          <div>
                            <div className="font-medium">{pharmacy.name}</div>
                            {pharmacy.address && <div className="text-[10px] text-muted-foreground">{pharmacy.address}</div>}
                            <div className="text-[10px] text-muted-foreground">{pharmacy.lat.toFixed(4)}, {pharmacy.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[8px] bg-pink-500/10 text-pink-400 border-pink-500/30">
                          {pharmacyChainLabels[pharmacy.chain]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          pharmacy.type === 'chain' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          pharmacy.type === 'grocery' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          pharmacy.type === 'warehouse' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          pharmacy.type === 'independent' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          pharmacy.type === 'hospital' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          'bg-orange-500/10 text-orange-400 border-orange-500/30'
                        }`}>
                          {pharmacyTypeLabels[pharmacy.type]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        {pharmacy.courier_services && pharmacy.courier_services.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {pharmacy.courier_services.map(cs => (
                              <Badge key={cs} variant="outline" className={`text-[8px] ${
                                cs === 'canada_post' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                cs === 'purolator' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                                cs === 'ups' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              }`}>
                                {cs.replace(/_/g, ' ').toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{pharmacy.municipality}</td>
                      <td className="py-2 px-2">
                        {pharmacy.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{pharmacy.matchedMunicipality.name}</span>
                          </div>
                        ) : pharmacy.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {pharmacy.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{pharmacy.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="facilities" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search facilities, amenities..."
                value={facilitySearch}
                onChange={e => setFacilitySearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-facility-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{facilityStats.matched} MATCHED</span>
              <span className="text-yellow-400">{facilityStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{facilityStats.unmatched} UNMATCHED</span>
              <span className="text-teal-400">{facilityStats.totalAmenities} AMENITIES</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">FACILITY</th>
                    <th className="text-left py-2 px-2">CATEGORY</th>
                    <th className="text-left py-2 px-2">AMENITIES</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacilities.map(facility => (
                    <tr 
                      key={facility.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-facility-${facility.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-teal-400" />
                          <div>
                            <div className="font-medium">{facility.name}</div>
                            {facility.address && <div className="text-[10px] text-muted-foreground">{facility.address}</div>}
                            <div className="text-[10px] text-muted-foreground">{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</div>
                            {facility.operator && <div className="text-[10px] text-muted-foreground/60">{facility.operator}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          facility.category === 'community_center' ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' :
                          facility.category === 'sports_complex' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          facility.category === 'arena' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          facility.category === 'aquatic_center' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                          facility.category === 'curling_club' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                          facility.category === 'ice_rink' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          facility.category === 'fieldhouse' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          facility.category === 'recreation_park' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          facility.category === 'playground' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          facility.category === 'skate_park' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}>
                          {facilityCategoryLabels[facility.category]}
                        </Badge>
                        {facility.ownership && (
                          <Badge variant="outline" className="text-[8px] ml-1 bg-muted/30 text-muted-foreground border-muted/50">
                            {facility.ownership}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.amenities && facility.amenities.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {facility.amenities.slice(0, 6).map((am, idx) => (
                              <Badge key={idx} variant="outline" className={`text-[8px] ${
                                am.type.includes('pool') || am.type.includes('hot_tub') || am.type.includes('sauna') || am.type.includes('steam') ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                                am.type.includes('ice') || am.type.includes('curling') ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                                am.type.includes('gym') || am.type.includes('weight') || am.type.includes('fitness') ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                                am.type.includes('court') || am.type.includes('field') || am.type.includes('diamond') || am.type.includes('turf') ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                am.type.includes('meeting') || am.type.includes('lounge') || am.type.includes('banquet') ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                am.type.includes('child') || am.type.includes('youth') || am.type.includes('senior') ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' :
                                am.type.includes('playground') || am.type.includes('spray') || am.type.includes('skate') ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-muted/30 text-muted-foreground border-muted/50'
                              }`}>
                                {amenityTypeLabels[am.type]}{am.count && am.count > 1 ? ` (${am.count})` : ''}
                              </Badge>
                            ))}
                            {facility.amenities.length > 6 && (
                              <Badge variant="outline" className="text-[8px] bg-muted/30 text-muted-foreground border-muted/50">
                                +{facility.amenities.length - 6} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{facility.municipality}</td>
                      <td className="py-2 px-2">
                        {facility.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{facility.matchedMunicipality.name}</span>
                          </div>
                        ) : facility.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {facility.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{facility.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="schools" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search schools, districts..."
                value={schoolSearch}
                onChange={e => setSchoolSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-school-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-green-400">{schoolStats.matched} MATCHED</span>
              <span className="text-yellow-400">{schoolStats.regionOnly} REGION ONLY</span>
              <span className="text-red-400">{schoolStats.unmatched} UNMATCHED</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">SCHOOL</th>
                    <th className="text-left py-2 px-2">CATEGORY</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">DISTRICT / GRADES</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.map(school => (
                    <tr 
                      key={school.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-school-${school.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-3 h-3 text-violet-400" />
                          <div>
                            <div className="font-medium">{school.name}</div>
                            {school.address && <div className="text-[10px] text-muted-foreground">{school.address}</div>}
                            <div className="text-[10px] text-muted-foreground">{school.lat.toFixed(4)}, {school.lng.toFixed(4)}</div>
                            {school.website && <div className="text-[10px] text-blue-400/70 truncate max-w-[200px]">{school.website}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          school.category === 'public_k12' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          school.category === 'private_k12' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          school.category === 'post_secondary' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          school.category === 'trades_technical' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          'bg-muted/30 text-muted-foreground border-muted/50'
                        }`}>
                          {schoolCategoryLabels[school.category]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          school.type === 'university' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          school.type === 'college' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          school.type === 'polytechnic' ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' :
                          school.type === 'trades' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          school.type === 'secondary' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          school.type === 'elementary' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                          school.type === 'k_12' || school.type === 'k_9' || school.type === 'k_7' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                          school.type === 'private_k_12' || school.type === 'independent' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          school.type === 'first_nations' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                          school.type === 'online' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' :
                          'bg-muted/30 text-muted-foreground border-muted/50'
                        }`}>
                          {schoolTypeLabels[school.type]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-xs">
                          {school.district && <div className="text-muted-foreground">{school.district}</div>}
                          {school.grades && <div className="text-[10px] text-muted-foreground/70">Grades: {school.grades}</div>}
                          {school.enrollment && <div className="text-[10px] text-muted-foreground/70">Enrollment: {school.enrollment.toLocaleString()}</div>}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{school.municipality}</td>
                      <td className="py-2 px-2">
                        {school.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{school.matchedMunicipality.name}</span>
                          </div>
                        ) : school.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <span className="text-red-400">NOT MATCHED</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {school.matchedRegion ? (
                          <Badge variant="outline" className="text-[8px]">{school.matchedRegion.name}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="municipal-offices" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search municipal offices, city halls..."
                value={municipalOfficeSearch}
                onChange={e => setMunicipalOfficeSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-municipal-office-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{municipalOfficeStats.matched} MATCHED</span>
              <span className="text-blue-400">{municipalOfficeStats.cityHalls} CITIES</span>
              <span className="text-cyan-400">{municipalOfficeStats.districtOffices} DISTRICTS</span>
              <span className="text-amber-400">{municipalOfficeStats.townOffices} TOWNS</span>
              <span className="text-orange-400">{municipalOfficeStats.firstNation + municipalOfficeStats.treatyNation} FIRST NATIONS</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">OFFICE</th>
                    <th className="text-left py-2 px-2">TYPE</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">REGION</th>
                    <th className="text-left py-2 px-2">CONTACT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMunicipalOffices.map(office => (
                    <tr 
                      key={office.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-municipal-office-${office.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-rose-400" />
                          <div>
                            <div className="font-medium">{office.name}</div>
                            {office.address && <div className="text-[10px] text-muted-foreground">{office.address}</div>}
                            <div className="text-[10px] text-muted-foreground">{office.lat.toFixed(4)}, {office.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[8px] ${
                          office.type === 'city_hall' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          office.type === 'town_office' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          office.type === 'district_office' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          office.type === 'village_office' ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' :
                          office.type === 'regional_district' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          office.type === 'first_nation_band_office' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                          office.type === 'treaty_nation_office' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          'bg-muted/30 text-muted-foreground border-muted/50'
                        }`}>
                          {office.type === 'city_hall' ? 'CITY HALL' :
                           office.type === 'town_office' ? 'TOWN' :
                           office.type === 'district_office' ? 'DISTRICT' :
                           office.type === 'village_office' ? 'VILLAGE' :
                           office.type === 'regional_district' ? 'REGIONAL' :
                           office.type === 'first_nation_band_office' ? 'FIRST NATION' :
                           'TREATY NATION'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{office.municipality}</td>
                      <td className="py-2 px-2">
                        {office.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{office.matchedMunicipality.name}</span>
                          </div>
                        ) : office.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-3 h-3" />
                            <span>No match</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {office.matchedRegion ? (
                          <span className="text-blue-400">{office.matchedRegion.name}</span>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          {office.phone && <div className="text-muted-foreground">{office.phone}</div>}
                          {office.website && <div className="text-blue-400/70 truncate max-w-[150px]">{office.website.replace(/^https?:\/\//, '')}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="chambers" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search chambers of commerce..."
                value={chamberSearch}
                onChange={e => setChamberSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-chamber-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{chamberStats.matched} MATCHED</span>
              <span className="text-blue-400">{chamberStats.withWebsite} WEBSITES</span>
              <span className="text-cyan-400">{chamberStats.withPhone} PHONE</span>
              <span className="text-amber-400">{chamberStats.withMembers} MEMBER DATA</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">CHAMBER</th>
                    <th className="text-left py-2 px-2">REGION</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">CONTACT</th>
                    <th className="text-left py-2 px-2">DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChambers.map(chamber => (
                    <tr 
                      key={chamber.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-chamber-${chamber.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3 h-3 text-indigo-400" />
                          <div>
                            <div className="font-medium">{chamber.name}</div>
                            {chamber.location.address && <div className="text-[10px] text-muted-foreground">{chamber.location.address}</div>}
                            <div className="text-[10px] text-muted-foreground">{chamber.location.lat.toFixed(4)}, {chamber.location.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[8px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                          {chamber.region}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{chamber.municipality}</td>
                      <td className="py-2 px-2">
                        {chamber.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{chamber.matchedMunicipality.name}</span>
                          </div>
                        ) : chamber.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-3 h-3" />
                            <span>No match</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          {chamber.phone && <div className="text-muted-foreground">{chamber.phone}</div>}
                          {chamber.email && <div className="text-muted-foreground">{chamber.email}</div>}
                          {chamber.website && <div className="text-blue-400/70 truncate max-w-[150px]">{chamber.website.replace(/^https?:\/\//, '')}</div>}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          {chamber.founded && <div className="text-muted-foreground">Est. {chamber.founded}</div>}
                          {chamber.members && <div className="text-cyan-400">{chamber.members} members</div>}
                          {chamber.notes && <div className="text-muted-foreground/70 truncate max-w-[180px]">{chamber.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="members" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-member-search"
              />
            </div>
            <select
              value={memberNaicsFilter}
              onChange={e => setMemberNaicsFilter(e.target.value)}
              className="h-8 text-xs bg-background/50 border border-border/50 rounded-md px-2"
              data-testid="select-member-naics"
            >
              <option value="all">All Industries ({memberStats.total})</option>
              {memberStats.usedSubsectors.map(subsector => (
                <option key={subsector} value={subsector}>
                  {subsector}: {naicsSubsectorLabels[subsector] || 'Unknown'} ({memberStats.byNaicsSubsector[subsector] || 0})
                </option>
              ))}
            </select>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-emerald-400">{memberStats.withWebsite} WITH WEBSITE</span>
              <span className="text-amber-400">{memberStats.needsWebsite} NEEDS WEBSITE</span>
              <span className="text-cyan-400">{memberStats.withCrossRef} CROSS-REF</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">BUSINESS</th>
                    <th className="text-left py-2 px-2">NAICS INDUSTRY</th>
                    <th className="text-left py-2 px-2">CHAMBER</th>
                    <th className="text-left py-2 px-2">LOCATION</th>
                    <th className="text-left py-2 px-2">WEBSITE</th>
                    <th className="text-left py-2 px-2">CROSS-REF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => (
                    <tr 
                      key={member.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-member-${member.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-3 h-3 text-emerald-400" />
                          <div>
                            <div className="font-medium text-foreground">{member.businessName}</div>
                            {member.description && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{member.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            {member.naicsSubsector}: {naicsSubsectorLabels[member.naicsSubsector || ''] || 'Unknown'}
                          </Badge>
                          <div className="text-[9px] text-muted-foreground mt-0.5">{member.naicsTitle}</div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-indigo-400 text-[10px]">{member.chamberId}</span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          <div className="text-foreground">{member.municipality}</div>
                          <div className="text-muted-foreground">{member.region}</div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {member.website ? (
                          <a 
                            href={member.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[10px]"
                            data-testid={`link-member-website-${member.id}`}
                          >
                            <Globe className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{member.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                          </a>
                        ) : member.websiteNeedsCollection ? (
                          <span className="text-amber-400/70 text-[10px]">Needs collection</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {member.crossReference ? (
                          <div className="flex items-center gap-1 text-cyan-400 text-[10px]">
                            <Link2 className="w-3 h-3" />
                            <span>{member.crossReference.dataset}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">-</span>
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
