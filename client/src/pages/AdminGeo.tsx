import { useState, useMemo } from "react";
import { Globe, ChevronRight, Database, Users, MapPin, ExternalLink, Plane, Cloud, Anchor, Radio, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import GeoTree from "@/components/GeoTree";
import { 
  GEO_HIERARCHY, 
  getAncestors, 
  getChildren,
  getNode,
  type GeoNode 
} from "@shared/geography";
import { PROVINCIAL_SOURCES, REGIONAL_SOURCES, MUNICIPAL_SOURCES, ALL_MUNICIPALITIES, getSourcesByTier, type DataSource } from "@shared/sources";
import { BC_AIRPORTS, getAirportsByMunicipality, getNearestAirports, type Airport } from "@shared/aviation";
import { BC_WEATHER_STATIONS, getNearestWeatherStationsWithDistance, type WeatherStation, type NearestStationWithDistance } from "@shared/weather-stations";
import { BC_MARINE_FACILITIES, getNearestMarineFacilities, getMarineFacilitiesByMunicipality, type MarineFacility, type MarineFacilityType } from "@shared/marine";

function Breadcrumb({ nodeId }: { nodeId: string }) {
  const node = getNode(nodeId);
  const ancestors = getAncestors(nodeId);
  const chain = node ? [...ancestors, node] : ancestors;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {chain.map((node, idx) => (
        <span key={node.id} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="w-3 h-3" />}
          <span className={idx === chain.length - 1 ? "text-foreground font-medium" : ""}>
            {node.shortName || node.name}
          </span>
        </span>
      ))}
    </div>
  );
}

function getSourcesForNode(node: GeoNode): { sources: DataSource[]; coverageType: string }[] {
  const results: { sources: DataSource[]; coverageType: string }[] = [];
  
  if (node.level === "province") {
    results.push({ sources: PROVINCIAL_SOURCES, coverageType: "Provincial" });
    // Show all regional sources aggregated
    const allRegionalSources = Object.values(REGIONAL_SOURCES).flat();
    if (allRegionalSources.length > 0) {
      results.push({ sources: allRegionalSources, coverageType: "Regional (all)" });
    }
  } else if (node.level === "region") {
    results.push({ sources: PROVINCIAL_SOURCES, coverageType: "Provincial" });
    
    // Get regional sources for this specific region
    const regionalSources = REGIONAL_SOURCES[node.id] || [];
    if (regionalSources.length > 0) {
      results.push({ sources: regionalSources, coverageType: "Regional" });
    }
    
    // Aggregate municipal sources from child municipalities
    const regionMuniSources: DataSource[] = [];
    const childNodes = getChildren(node.id);
    childNodes.forEach(child => {
      const muniSources = MUNICIPAL_SOURCES[child.name] || [];
      regionMuniSources.push(...muniSources);
    });
    if (regionMuniSources.length > 0) {
      results.push({ sources: regionMuniSources, coverageType: "Municipal (aggregated)" });
    }
  } else if (node.level === "municipality") {
    // Use the tiered source function for municipalities
    const tiers = getSourcesByTier(node.name);
    
    results.push({ sources: tiers.provincial, coverageType: "Provincial" });
    
    if (tiers.regional.length > 0) {
      results.push({ sources: tiers.regional, coverageType: `Regional (${tiers.regionName || 'inherited'})` });
    }
    
    if (tiers.municipal.length > 0) {
      results.push({ sources: tiers.municipal, coverageType: "Municipal" });
    }
  }
  
  return results;
}

function hasMunicipalData(node: GeoNode): boolean {
  if (node.level === "municipality") {
    return ALL_MUNICIPALITIES.includes(node.name);
  }
  if (node.level === "region") {
    const children = getChildren(node.id);
    return children.some(child => ALL_MUNICIPALITIES.includes(child.name));
  }
  return true;
}

function NodeDetail({ nodeId }: { nodeId: string }) {
  const node = getNode(nodeId);
  if (!node) return null;
  
  const allChildren = getChildren(nodeId);
  const coveredChildren = allChildren.filter(c => ALL_MUNICIPALITIES.includes(c.name));
  const children = node.level === "region" ? coveredChildren : allChildren;
  const sourceGroups = getSourcesForNode(node);
  const totalSources = sourceGroups.reduce((sum, g) => sum + g.sources.length, 0);
  const hasData = hasMunicipalData(node);
  const noCoverage = node.level === "region" && coveredChildren.length === 0;
  
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{node.name}</h2>
          {node.level === "municipality" && !ALL_MUNICIPALITIES.includes(node.name) && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">NO DATA</Badge>
          )}
          {node.level === "municipality" && ALL_MUNICIPALITIES.includes(node.name) && (
            <Badge className="text-[9px] bg-green-500/20 text-green-400">COVERED</Badge>
          )}
          {noCoverage && (
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-400/30">NO MUNICIPAL DATA YET</Badge>
          )}
        </div>
        <Breadcrumb nodeId={nodeId} />
      </div>
      
      {noCoverage && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-amber-400 text-sm mb-2">Region Not Yet Covered</div>
            <p className="text-xs text-muted-foreground">
              This region has {allChildren.length} municipalities but none are in the current dataset.
              Provincial/regional shared sources still apply.
            </p>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            {node.level === "province" ? (
              <>
                <div className="text-2xl font-bold">{allChildren.filter(r => {
                  const regionChildren = getChildren(r.id);
                  return regionChildren.some(c => ALL_MUNICIPALITIES.includes(c.name));
                }).length}/{allChildren.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Regions with Data</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{children.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  {node.level === "region" ? "Municipalities" : "Sub-areas"}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{totalSources}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Data Sources</div>
          </CardContent>
        </Card>
        
        {node.metadata?.population && (
          <Card className="bg-card/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">
                {(node.metadata.population / 1000).toFixed(0)}K
              </div>
              <div className="text-[10px] text-muted-foreground uppercase">Population</div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {children.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Child Jurisdictions ({children.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {children.map(child => (
                <Badge key={child.id} variant="secondary" className="text-xs">
                  {child.shortName || child.name}
                  {child.metadata?.population && (
                    <span className="ml-1 text-muted-foreground">
                      ({(child.metadata.population / 1000).toFixed(0)}K)
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <AviationWeatherSection node={node} />
      
      {sourceGroups.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceGroups.map((group, idx) => (
              <div key={idx}>
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{group.coverageType}</Badge>
                  <span>{group.sources.length} sources</span>
                </div>
                <div className="space-y-1">
                  {group.sources.map((source, sidx) => (
                    <div 
                      key={sidx} 
                      className="flex items-center justify-between gap-2 text-xs p-1.5 rounded bg-background/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="text-[9px] shrink-0">
                          {source.category}
                        </Badge>
                        <span className="truncate">{source.source_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => window.open(source.url, "_blank")}
                        data-testid={`button-open-source-${sidx}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AviationWeatherSection({ node }: { node: GeoNode }) {
  const coords = node.coordinates;
  
  const localAirports = useMemo(() => {
    if (node.level === "municipality") {
      const shortName = node.shortName || node.name;
      const fullName = node.name;
      const byShortName = getAirportsByMunicipality(shortName);
      if (byShortName.length > 0) return byShortName;
      const byFullName = getAirportsByMunicipality(fullName);
      if (byFullName.length > 0) return byFullName;
      const cleanedName = fullName
        .replace(/^(City of |District of |Township of |Village of |Corporation of |Town of )/i, "")
        .replace(/ Municipality$/i, "");
      return getAirportsByMunicipality(cleanedName);
    }
    return [];
  }, [node]);
  
  const nearbyAirports = useMemo(() => {
    if (coords) {
      return getNearestAirports(coords.latitude, coords.longitude, 5);
    }
    return [];
  }, [coords]);
  
  const nearbyWeatherStations = useMemo(() => {
    if (coords) {
      return getNearestWeatherStationsWithDistance(coords.latitude, coords.longitude, 8);
    }
    return [];
  }, [coords]);
  
  const nearbyMarineFacilities = useMemo(() => {
    if (coords) {
      return getNearestMarineFacilities(coords.latitude, coords.longitude, 8);
    }
    return [];
  }, [coords]);
  
  const localMarineFacilities = useMemo(() => {
    if (node.level === "municipality") {
      const shortName = node.shortName || node.name;
      const fullName = node.name;
      const byShortName = getMarineFacilitiesByMunicipality(shortName);
      if (byShortName.length > 0) return byShortName;
      const byFullName = getMarineFacilitiesByMunicipality(fullName);
      if (byFullName.length > 0) return byFullName;
      const cleanedName = fullName
        .replace(/^(City of |District of |Township of |Village of |Corporation of |Town of )/i, "")
        .replace(/ Municipality$/i, "");
      return getMarineFacilitiesByMunicipality(cleanedName);
    }
    return [];
  }, [node]);
  
  if (node.level !== "municipality") {
    return null;
  }
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'metar': return <Plane className="w-3 h-3" />;
      case 'marine_buoy': return <Anchor className="w-3 h-3" />;
      case 'lightstation': return <Radio className="w-3 h-3" />;
      default: return <Cloud className="w-3 h-3" />;
    }
  };
  
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'metar': return 'bg-sky-500/20 text-sky-400';
      case 'marine_buoy': return 'bg-blue-500/20 text-blue-400';
      case 'lightstation': return 'bg-amber-500/20 text-amber-400';
      case 'climate': return 'bg-green-500/20 text-green-400';
      default: return 'bg-muted';
    }
  };
  
  const getAirportTypeBadge = (airport: Airport) => {
    const typeColors: Record<string, string> = {
      'large_airport': 'bg-green-500/20 text-green-400',
      'medium_airport': 'bg-blue-500/20 text-blue-400',
      'small_airport': 'bg-sky-500/20 text-sky-400',
      'seaplane_base': 'bg-cyan-500/20 text-cyan-400',
      'heliport': 'bg-purple-500/20 text-purple-400',
      'closed': 'bg-red-500/20 text-red-400',
    };
    return typeColors[airport.type] || 'bg-muted';
  };
  
  const getMarineTypeBadge = (type: MarineFacilityType) => {
    const typeColors: Record<MarineFacilityType, string> = {
      'coast_guard': 'bg-red-500/20 text-red-400',
      'rescue_station': 'bg-orange-500/20 text-orange-400',
      'marina': 'bg-blue-500/20 text-blue-400',
      'fuel_dock': 'bg-amber-500/20 text-amber-400',
      'public_wharf': 'bg-cyan-500/20 text-cyan-400',
      'harbour_authority': 'bg-green-500/20 text-green-400',
      'ferry_terminal': 'bg-purple-500/20 text-purple-400',
      'seaplane_dock': 'bg-sky-500/20 text-sky-400',
    };
    return typeColors[type] || 'bg-muted';
  };
  
  const getMarineTypeIcon = (type: MarineFacilityType) => {
    switch (type) {
      case 'coast_guard': return <Anchor className="w-3 h-3 text-red-400" />;
      case 'rescue_station': return <Anchor className="w-3 h-3 text-orange-400" />;
      case 'ferry_terminal': return <Ship className="w-3 h-3 text-purple-400" />;
      case 'fuel_dock': return <Ship className="w-3 h-3 text-amber-400" />;
      default: return <Ship className="w-3 h-3" />;
    }
  };
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400" />
            Weather Stations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!coords ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No coordinates available for this location
            </div>
          ) : (
            <div className="space-y-1">
              {nearbyWeatherStations.map((item, idx) => (
                <div key={item.station.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                  <span className="w-4 text-muted-foreground">{idx + 1}.</span>
                  {getTypeIcon(item.station.type)}
                  <Badge className={`text-[9px] ${getTypeBadgeClass(item.station.type)}`}>
                    {item.station.type.toUpperCase()}
                  </Badge>
                  <span className="truncate flex-1">{item.station.name}</span>
                  <span className="text-muted-foreground text-[10px]">{item.distance_km}km</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plane className="w-4 h-4 text-sky-400" />
            Aviation Infrastructure
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!coords ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No coordinates available for this location
            </div>
          ) : (
            <div className="space-y-3">
              {localAirports.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase">Local Airports</div>
                  <div className="space-y-1">
                    {localAirports.map(airport => (
                      <div key={airport.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                        <Badge className={`text-[9px] ${getAirportTypeBadge(airport)}`}>
                          {airport.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="truncate flex-1">{airport.name}</span>
                        {airport.icao && <span className="text-muted-foreground">{airport.icao}</span>}
                        {airport.has_metar && <Badge className="text-[8px] bg-green-500/20 text-green-400">METAR</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase">Nearest Airports</div>
                <div className="space-y-1">
                  {nearbyAirports.map((airport, idx) => (
                    <div key={airport.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                      <span className="w-4 text-muted-foreground">{idx + 1}.</span>
                      <Badge className={`text-[9px] ${getAirportTypeBadge(airport)}`}>
                        {airport.icao || airport.tc_lid || airport.type.substring(0, 3).toUpperCase()}
                      </Badge>
                      <span className="truncate flex-1">{airport.name}</span>
                      {airport.has_metar && <Cloud className="w-3 h-3 text-green-400" />}
                      {airport.status === 'closed' && <Badge variant="destructive" className="text-[8px]">CLOSED</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Anchor className="w-4 h-4 text-blue-400" />
            Marine Infrastructure
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!coords ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No coordinates available for this location
            </div>
          ) : (
            <div className="space-y-3">
              {localMarineFacilities.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase">Local Facilities</div>
                  <div className="space-y-1">
                    {localMarineFacilities.map(facility => (
                      <div key={facility.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                        {getMarineTypeIcon(facility.type)}
                        <Badge className={`text-[9px] ${getMarineTypeBadge(facility.type)}`}>
                          {facility.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="truncate flex-1">{facility.name}</span>
                        {facility.has_fuel && <Badge className="text-[8px] bg-amber-500/20 text-amber-400">FUEL</Badge>}
                        {facility.emergency_services && <Badge className="text-[8px] bg-red-500/20 text-red-400">RESCUE</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase">Nearest Facilities</div>
                <div className="space-y-1">
                  {nearbyMarineFacilities.map((item, idx) => (
                    <div key={item.facility.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                      <span className="w-4 text-muted-foreground">{idx + 1}.</span>
                      {getMarineTypeIcon(item.facility.type)}
                      <Badge className={`text-[9px] ${getMarineTypeBadge(item.facility.type)}`}>
                        {item.facility.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="truncate flex-1">{item.facility.name}</span>
                      <span className="text-muted-foreground text-[10px]">{item.distance_km}km</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminGeo() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("bc");

  return (
    <div className="h-full flex font-mono">
      <div className="w-64 border-r border-border/50 bg-card/20 flex flex-col">
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold tracking-wider">GEOGRAPHIC VIEW</span>
        </header>
        <div className="flex-1 overflow-hidden">
          <GeoTree 
            selectedNodeId={selectedNodeId} 
            onSelectNode={setSelectedNodeId}
          />
        </div>
        <footer className="px-3 py-2 border-t border-border/30 text-[10px] text-muted-foreground">
          {Object.keys(GEO_HIERARCHY).length} nodes in hierarchy
        </footer>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {selectedNodeId ? (
          <NodeDetail nodeId={selectedNodeId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Select a location from the tree</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
