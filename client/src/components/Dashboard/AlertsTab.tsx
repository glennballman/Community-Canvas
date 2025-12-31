import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  AlertTriangle, AlertCircle, Info, Clock, MapPin, Radio, X, Map as MapIcon,
  List, LayoutGrid, Calendar, ArrowRight, CheckCircle, Construction,
  CloudLightning, Ship, Zap, Flame, XCircle, Search, CircleDot,
  CloudSnow, Wind, Waves, MountainSnow, Plane, Bus, Droplets, CircleAlert,
  ExternalLink, Navigation, Route, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Alert {
  id: number;
  alert_type: string;
  severity: string;
  headline: string;
  description: string;
  region_id: string;
  region_name: string;
  source: string;
  signal_type?: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  status: string;
  metadata: Record<string, unknown>;
  details?: {
    roads?: Array<{ name: string; direction?: string }>;
    event_type?: string;
    event_subtype?: string;
    description?: string;
    drivebc_severity?: string;
  };
  source_url?: string;
  latitude?: string | number;
  longitude?: string | number;
  region_lat?: number;
  region_lng?: number;
}

interface AlertsTabProps {
  regionId?: string;
}

interface SeverityConfig {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  markerColor: string;
}

interface AlertTypeConfig {
  icon: React.ReactNode;
  label: string;
  color: string;
}

interface SourceConfig {
  icon: React.ReactNode;
  name: string;
  url?: string;
}

const severityConfig: Record<string, SeverityConfig> = {
  critical: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500', markerColor: '#ef4444' },
  emergency: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500', markerColor: '#ef4444' },
  major: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500', markerColor: '#f97316' },
  warning: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', markerColor: '#eab308' },
  advisory: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', markerColor: '#eab308' },
  minor: { icon: <Info className="w-3 h-3" />, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', markerColor: '#3b82f6' },
  info: { icon: <Info className="w-3 h-3" />, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500', markerColor: '#6b7280' },
};

const alertTypeConfig: Record<string, AlertTypeConfig> = {
  road_closure: { icon: <XCircle className="w-4 h-4" />, label: 'Road Closure', color: '#ef4444' },
  road_incident: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Incident', color: '#f97316' },
  incident: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Incident', color: '#f97316' },
  construction: { icon: <Construction className="w-4 h-4" />, label: 'Construction', color: '#eab308' },
  road_condition: { icon: <Route className="w-4 h-4" />, label: 'Road Condition', color: '#3b82f6' },
  closure: { icon: <XCircle className="w-4 h-4" />, label: 'Closure', color: '#ef4444' },
  weather_warning: { icon: <CloudLightning className="w-4 h-4" />, label: 'Weather Warning', color: '#8b5cf6' },
  weather_condition: { icon: <CloudLightning className="w-4 h-4" />, label: 'Weather', color: '#8b5cf6' },
  snow_warning: { icon: <CloudSnow className="w-4 h-4" />, label: 'Snow Warning', color: '#06b6d4' },
  wind_warning: { icon: <Wind className="w-4 h-4" />, label: 'Wind Warning', color: '#6366f1' },
  flood_warning: { icon: <Waves className="w-4 h-4" />, label: 'Flood Warning', color: '#0ea5e9' },
  wildfire: { icon: <Flame className="w-4 h-4" />, label: 'Wildfire', color: '#dc2626' },
  earthquake: { icon: <CircleAlert className="w-4 h-4" />, label: 'Earthquake', color: '#7c2d12' },
  avalanche: { icon: <MountainSnow className="w-4 h-4" />, label: 'Avalanche Risk', color: '#78716c' },
  ferry_delay: { icon: <Ship className="w-4 h-4" />, label: 'Ferry Delay', color: '#2563eb' },
  ferry_cancellation: { icon: <Ship className="w-4 h-4" />, label: 'Ferry Cancelled', color: '#dc2626' },
  transit_alert: { icon: <Bus className="w-4 h-4" />, label: 'Transit Alert', color: '#7c3aed' },
  airport_delay: { icon: <Plane className="w-4 h-4" />, label: 'Airport Delay', color: '#0891b2' },
  power_outage: { icon: <Zap className="w-4 h-4" />, label: 'Power Outage', color: '#ca8a04' },
  water_advisory: { icon: <Droplets className="w-4 h-4" />, label: 'Water Advisory', color: '#0284c7' },
  evacuation: { icon: <AlertCircle className="w-4 h-4" />, label: 'Evacuation', color: '#dc2626' },
  emergency: { icon: <AlertCircle className="w-4 h-4" />, label: 'Emergency', color: '#dc2626' },
  default: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Alert', color: '#6b7280' },
};

const sourceConfig: Record<string, SourceConfig> = {
  drivebc: { icon: <Route className="w-3 h-3" />, name: 'DriveBC', url: 'https://drivebc.ca' },
  bcferries: { icon: <Ship className="w-3 h-3" />, name: 'BC Ferries', url: 'https://bcferries.com' },
  bchydro: { icon: <Zap className="w-3 h-3" />, name: 'BC Hydro', url: 'https://bchydro.com' },
  env_canada: { icon: <CloudLightning className="w-3 h-3" />, name: 'Environment Canada', url: 'https://weather.gc.ca' },
  bcwildfire: { icon: <Flame className="w-3 h-3" />, name: 'BC Wildfire Service', url: 'https://bcwildfire.ca' },
  earthquakes_canada: { icon: <CircleAlert className="w-3 h-3" />, name: 'Earthquakes Canada', url: 'https://earthquakescanada.nrcan.gc.ca' },
  translink: { icon: <Bus className="w-3 h-3" />, name: 'TransLink', url: 'https://translink.ca' },
  bctransit: { icon: <Bus className="w-3 h-3" />, name: 'BC Transit', url: 'https://bctransit.com' },
  embc: { icon: <AlertCircle className="w-3 h-3" />, name: 'Emergency Management BC' },
  local_gov: { icon: <MapPin className="w-3 h-3" />, name: 'Local Government' },
  unknown: { icon: <Radio className="w-3 h-3" />, name: 'Unknown Source' },
};

function getAlertTypeConfig(alertType: string): AlertTypeConfig {
  const normalized = alertType?.toLowerCase().replace(/[- ]/g, '_') || 'default';
  return alertTypeConfig[normalized] || alertTypeConfig.default;
}

function getSourceConfig(source: string): SourceConfig {
  const normalized = source?.toLowerCase().replace(/[- ]/g, '_') || 'unknown';
  return sourceConfig[normalized] || sourceConfig.unknown;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AlertsTab({ regionId }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity'>('newest');
  
  const [viewMode, setViewMode] = useState<'list' | 'compact' | 'timeline'>('list');
  const [showMap, setShowMap] = useState(true);
  const [hoveredAlertId, setHoveredAlertId] = useState<number | null>(null);
  
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitializedRef = useRef(false);

  useEffect(() => {
    fetch('/api/config/mapbox-token')
      .then(r => r.json())
      .then(data => setMapboxToken(data.token || ''))
      .catch(() => setMapboxToken(''));
  }, []);

  const setMapContainer = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    
    if (node && mapboxToken && !mapInitializedRef.current) {
      mapInitializedRef.current = true;
      mapboxgl.accessToken = mapboxToken;
      
      const newMap = new mapboxgl.Map({
        container: node,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-123.1207, 49.2827],
        zoom: 5,
      });
      
      newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current = newMap;
    }
  }, [mapboxToken]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [regionId]);

  async function fetchAlerts() {
    if (!initialLoadComplete) {
      setLoading(true);
    }
    try {
      const url = `/api/v1/alerts/active?limit=500`;
      const response = await fetch(url);
      const data = await response.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }

  const { severities, types, regions } = useMemo(() => {
    const sevSet = new Set<string>();
    const typeSet = new Set<string>();
    const regionSet = new Set<string>();
    
    alerts.forEach(alert => {
      if (alert.severity) sevSet.add(alert.severity);
      if (alert.alert_type) typeSet.add(alert.alert_type);
      if (alert.region_name) regionSet.add(alert.region_name);
    });
    
    return {
      severities: Array.from(sevSet).sort(),
      types: Array.from(typeSet).sort(),
      regions: Array.from(regionSet).sort()
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    let filtered = alerts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.headline?.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.region_name?.toLowerCase().includes(query)
      );
    }

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(a => a.severity === selectedSeverity);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(a => a.alert_type === selectedType);
    }

    if (selectedRegion !== 'all') {
      filtered = filtered.filter(a => a.region_name === selectedRegion);
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'severity') {
        const order: Record<string, number> = { critical: 0, emergency: 0, major: 1, warning: 2, advisory: 2, minor: 3, info: 4 };
        return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
      }
      return 0;
    });

    return filtered;
  }, [alerts, searchQuery, selectedSeverity, selectedType, selectedRegion, sortBy]);

  useEffect(() => {
    if (!map.current || !showMap) return;

    const currentMap = map.current;

    const updateMarkers = () => {
      if (!currentMap) return;
      
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // BC bounding box: lat 48.2 to 60.0, lng -139.5 to -114.0
      const isInBC = (lat: number, lng: number) => {
        return lat >= 48.2 && lat <= 60.0 && lng >= -139.5 && lng <= -114.0;
      };
      
      const alertsWithCoords = filteredAlerts.filter(a => {
        const lat = Number(a.latitude || a.region_lat);
        const lng = Number(a.longitude || a.region_lng);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && isInBC(lat, lng);
      });

      alertsWithCoords.forEach(alert => {
        const sevConfig = severityConfig[alert.severity] || severityConfig.info;
        const typeConfig = getAlertTypeConfig(alert.alert_type);
        const srcConfig = getSourceConfig(alert.signal_type || alert.source || 'unknown');
        const lat = Number(alert.latitude || alert.region_lat);
        const lng = Number(alert.longitude || alert.region_lng);
        if (isNaN(lat) || isNaN(lng)) return;
        
        const el = document.createElement('div');
        el.className = 'alert-marker';
        el.style.cssText = `
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${typeConfig.color}40;
          border: 3px solid ${typeConfig.color};
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        `;
        
        const severityDot = document.createElement('div');
        severityDot.style.cssText = `
          position: absolute;
          top: -3px;
          right: -3px;
          width: 12px;
          height: 12px;
          background: ${sevConfig.markerColor};
          border: 2px solid white;
          border-radius: 50%;
        `;
        el.appendChild(severityDot);
        
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedAlert(alert);
        });
        el.addEventListener('mouseenter', () => {
          setHoveredAlertId(alert.id);
        });
        el.addEventListener('mouseleave', () => {
          setHoveredAlertId(null);
        });

        const roadsInfo = alert.details?.roads?.map(r => r.name).join(', ') || '';

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 20, maxWidth: '300px' }).setHTML(`
              <div style="padding: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="
                    width: 32px; height: 32px; border-radius: 50%;
                    background: ${typeConfig.color}20;
                    border: 2px solid ${typeConfig.color};
                    display: flex; align-items: center; justify-content: center;
                  ">
                    <span style="color: ${typeConfig.color}; font-size: 14px;">!</span>
                  </div>
                  <div>
                    <div style="font-weight: 600; color: #111;">${typeConfig.label}</div>
                    <div style="font-size: 12px; color: ${sevConfig.markerColor}; text-transform: uppercase; font-weight: 600;">
                      ${alert.severity}
                    </div>
                  </div>
                </div>
                <p style="margin: 0 0 8px; font-weight: 500; color: #333; font-size: 14px;">
                  ${alert.headline || 'Alert'}
                </p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #666; display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 12px;">📍</span> ${alert.region_name || 'Unknown'}
                </p>
                ${roadsInfo ? `
                  <p style="margin: 0 0 8px; font-size: 13px; color: #666; display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 12px;">🛣️</span> ${roadsInfo}
                  </p>
                ` : ''}
                <div style="display: flex; gap: 8px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
                  <span>${srcConfig.name}</span>
                  <span>•</span>
                  <span>${getTimeAgo(new Date(alert.created_at))}</span>
                </div>
              </div>
            `)
          )
          .addTo(currentMap);
        
        markersRef.current.push(marker);
      });
    };

    if (currentMap.loaded()) {
      updateMarkers();
    } else {
      currentMap.once('load', updateMarkers);
    }

    return () => {
      currentMap.off('load', updateMarkers);
    };
  }, [filteredAlerts, showMap]);

  function flyToAlert(alert: Alert) {
    const lat = alert.latitude || alert.region_lat;
    const lng = alert.longitude || alert.region_lng;
    if (map.current && lat && lng) {
      map.current.flyTo({
        center: [Number(lng), Number(lat)],
        zoom: 12,
        duration: 1000
      });
    }
  }

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    });
    return counts;
  }, [alerts]);

  if (loading && !initialLoadComplete) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-xl p-4 border animate-pulse">
          <div className="h-10 bg-muted rounded w-64 mb-4"></div>
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-4 border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Active Alerts
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredAlerts.length} of {alerts.length})
              </span>
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Real-time alerts across British Columbia
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(severityCounts).map(([sev, count]) => {
              if (count === 0) return null;
              const config = severityConfig[sev] || severityConfig.info;
              return (
                <Badge
                  key={sev}
                  variant={selectedSeverity === sev ? 'default' : 'secondary'}
                  className={`cursor-pointer ${config.color}`}
                  onClick={() => setSelectedSeverity(selectedSeverity === sev ? 'all' : sev)}
                  data-testid={`filter-severity-${sev}`}
                >
                  {config.icon}
                  <span className="ml-1">{count}</span>
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search alerts by headline, description, or region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-alerts"
          />
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <Button
            variant={showMap ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMap(!showMap)}
            data-testid="button-toggle-map"
          >
            <MapIcon className="w-4 h-4 mr-1" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </Button>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[160px]" data-testid="select-alert-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(type => (
                <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px]" data-testid="select-region">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(region => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'newest' | 'oldest' | 'severity')}>
            <SelectTrigger className="w-[140px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="severity">By Severity</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded ${viewMode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              data-testid="button-view-compact"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded ${viewMode === 'timeline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              data-testid="button-view-timeline"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={`grid ${showMap ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4`}>
        <div className={showMap ? 'max-h-[75vh] overflow-y-auto pr-2' : ''}>
          {viewMode === 'list' && (
            <div className="space-y-3">
              {filteredAlerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  isHovered={hoveredAlertId === alert.id}
                  onHover={(hovered) => setHoveredAlertId(hovered ? alert.id : null)}
                  onClick={() => { setSelectedAlert(alert); flyToAlert(alert); }}
                />
              ))}
            </div>
          )}

          {viewMode === 'compact' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Severity</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Headline</th>
                    <th className="text-left p-3">Region</th>
                    <th className="text-left p-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map(alert => {
                    const config = severityConfig[alert.severity] || severityConfig.info;
                    const typeConfig = getAlertTypeConfig(alert.alert_type);
                    return (
                      <tr 
                        key={alert.id} 
                        className={`border-b cursor-pointer transition-colors ${
                          hoveredAlertId === alert.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => { setSelectedAlert(alert); flyToAlert(alert); }}
                        onMouseEnter={() => setHoveredAlertId(alert.id)}
                        onMouseLeave={() => setHoveredAlertId(null)}
                      >
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${config.bg} ${config.color}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="flex items-center gap-1" style={{ color: typeConfig.color }}>
                            {typeConfig.icon}
                            <span className="text-muted-foreground">{typeConfig.label}</span>
                          </span>
                        </td>
                        <td className="p-3 max-w-[300px] truncate">{alert.headline}</td>
                        <td className="p-3 text-muted-foreground">{alert.region_name}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{getTimeAgo(new Date(alert.created_at))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'timeline' && (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-4">
                {filteredAlerts.map((alert, idx) => {
                  const config = severityConfig[alert.severity] || severityConfig.info;
                  const showDate = idx === 0 || 
                    new Date(alert.created_at).toDateString() !== 
                    new Date(filteredAlerts[idx - 1].created_at).toDateString();
                  
                  return (
                    <div key={alert.id}>
                      {showDate && (
                        <div className="ml-8 mb-2 text-sm text-muted-foreground font-medium">
                          {new Date(alert.created_at).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric'
                          })}
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1 z-10`} style={{ background: config.markerColor }}></div>
                        <div 
                          className={`flex-1 bg-card rounded-lg p-3 border cursor-pointer transition-all ${
                            hoveredAlertId === alert.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => { setSelectedAlert(alert); flyToAlert(alert); }}
                          onMouseEnter={() => setHoveredAlertId(alert.id)}
                          onMouseLeave={() => setHoveredAlertId(null)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold uppercase ${config.color}`}>
                              {alert.severity}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(alert.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm">{alert.headline}</h4>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredAlerts.length === 0 && (
            <div className="bg-card rounded-xl p-12 text-center border">
              <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">No alerts match your filters</p>
              <Button variant="ghost" onClick={() => {
                setSearchQuery('');
                setSelectedSeverity('all');
                setSelectedType('all');
                setSelectedRegion('all');
              }} className="mt-4">
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {showMap && (
          <div 
            className="bg-card rounded-xl border relative sticky top-4"
            style={{ height: '75vh', minHeight: '400px' }}
          >
            <div ref={setMapContainer} className="absolute inset-0 rounded-xl" />
            
            <div className="absolute bottom-4 left-4 bg-card/90 rounded-lg p-3 border">
              <h4 className="text-xs font-semibold mb-2">Alert Severity</h4>
              <div className="space-y-1">
                {['critical', 'major', 'warning', 'minor', 'info'].map(sev => {
                  const cfg = severityConfig[sev];
                  return (
                    <div key={sev} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full" style={{ background: cfg.markerColor }}></div>
                      <span className={cfg.color}>{sev}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="absolute top-4 left-4 bg-card/90 rounded-lg px-3 py-2 border">
              <span className="font-semibold">{filteredAlerts.length}</span>
              <span className="text-muted-foreground text-sm ml-1">alerts</span>
            </div>
          </div>
        )}
      </div>

      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}

interface AlertCardProps {
  alert: Alert;
  isHovered?: boolean;
  onHover?: (hovered: boolean) => void;
  onClick: () => void;
}

function AlertCard({ alert, isHovered, onHover, onClick }: AlertCardProps) {
  const sevConfig = severityConfig[alert.severity] || severityConfig.info;
  const typeConfig = getAlertTypeConfig(alert.alert_type);
  const srcConfig = getSourceConfig(alert.signal_type || alert.source || 'unknown');
  
  const roadsInfo = alert.details?.roads?.map(r => {
    const dir = r.direction && r.direction !== 'NONE' ? ` (${r.direction})` : '';
    return r.name + dir;
  }).join(', ');
  
  const eventSubType = alert.details?.event_subtype;
  
  return (
    <div
      className={`bg-card rounded-xl overflow-hidden cursor-pointer transition-all border ${
        isHovered ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className={`px-4 py-2 ${sevConfig.bg} border-b flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: typeConfig.color }}>{typeConfig.icon}</span>
          <span className={`text-sm font-semibold uppercase ${sevConfig.color}`}>
            {alert.severity}
          </span>
          <span className="text-muted-foreground">-</span>
          <span className="text-sm text-muted-foreground">{typeConfig.label}</span>
          {eventSubType && eventSubType !== alert.alert_type && (
            <>
              <span className="text-muted-foreground">-</span>
              <span className="text-xs text-muted-foreground">{eventSubType.replace(/_/g, ' ')}</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {getTimeAgo(new Date(alert.created_at))}
        </span>
      </div>
      
      <div className="p-4">
        <h3 className="font-medium leading-tight">{alert.headline}</h3>
        
        <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {alert.region_name || 'Unknown location'}
          </span>
          {roadsInfo && (
            <span className="text-muted-foreground flex items-center gap-1">
              <Route className="w-3 h-3" />
              {roadsInfo}
            </span>
          )}
        </div>
        
        {alert.description && (
          <p className="text-muted-foreground text-sm mt-3 line-clamp-2">
            {alert.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {srcConfig.icon}
            <span>{srcConfig.name}</span>
          </div>
          
          {alert.expires_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>Expires: {new Date(alert.expires_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
              })}</span>
            </div>
          )}
          
          {alert.source_url && (
            <a 
              href={alert.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              View Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
}

function AlertDetailModal({ alert, onClose }: AlertDetailModalProps) {
  const sevConfig = severityConfig[alert.severity] || severityConfig.info;
  const typeConfig = getAlertTypeConfig(alert.alert_type);
  const srcConfig = getSourceConfig(alert.signal_type || alert.source || 'unknown');
  
  const roadsInfo = alert.details?.roads?.map(r => {
    const dir = r.direction && r.direction !== 'NONE' ? ` (${r.direction})` : '';
    return r.name + dir;
  }).join(', ');
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="max-w-2xl w-full bg-card rounded-xl overflow-hidden border max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-6 py-4 ${sevConfig.bg} border-b sticky top-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded text-sm font-semibold uppercase inline-flex items-center gap-1 ${sevConfig.color} bg-background/50`}>
                {sevConfig.icon} {alert.severity}
              </span>
              <span className="text-muted-foreground flex items-center gap-1" style={{ color: typeConfig.color }}>
                {typeConfig.icon}
                {typeConfig.label}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{alert.headline}</h2>
          
          {alert.description && (
            <div className="mb-6">
              <h4 className="text-muted-foreground text-sm uppercase mb-2">Description</h4>
              <p className="whitespace-pre-wrap">{alert.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="text-muted-foreground text-sm uppercase mb-1">Region</h4>
              <p className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {alert.region_name}
              </p>
            </div>
            {roadsInfo && (
              <div>
                <h4 className="text-muted-foreground text-sm uppercase mb-1">Affected Roads</h4>
                <p className="flex items-center gap-1">
                  <Route className="w-4 h-4" />
                  {roadsInfo}
                </p>
              </div>
            )}
            <div>
              <h4 className="text-muted-foreground text-sm uppercase mb-1">Source</h4>
              <p className="flex items-center gap-1">
                {srcConfig.icon}
                {srcConfig.name}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm uppercase mb-1">Created</h4>
              <p className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(alert.created_at).toLocaleString()}
              </p>
            </div>
            {alert.expires_at && (
              <div>
                <h4 className="text-muted-foreground text-sm uppercase mb-1">Expires</h4>
                <p className="flex items-center gap-1">
                  <Timer className="w-4 h-4" />
                  {new Date(alert.expires_at).toLocaleString()}
                </p>
              </div>
            )}
            {alert.details?.event_subtype && (
              <div>
                <h4 className="text-muted-foreground text-sm uppercase mb-1">Event Type</h4>
                <p>{alert.details.event_subtype.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>
          
          {alert.source_url && (
            <div className="pt-4 border-t">
              <a 
                href={alert.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View Original Source
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AlertsTab;
