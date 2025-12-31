import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  AlertTriangle, AlertCircle, Info, Clock, MapPin, Radio, X, Map as MapIcon,
  List, LayoutGrid, Calendar, ArrowRight, CheckCircle, Construction,
  CloudLightning, Ship, Zap, Flame, XCircle, Search, CircleDot
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
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  status: string;
  metadata: Record<string, unknown>;
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

const severityConfig: Record<string, SeverityConfig> = {
  critical: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500', markerColor: '#ef4444' },
  emergency: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500', markerColor: '#ef4444' },
  major: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500', markerColor: '#f97316' },
  warning: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', markerColor: '#eab308' },
  advisory: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', markerColor: '#eab308' },
  minor: { icon: <Info className="w-3 h-3" />, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', markerColor: '#3b82f6' },
  info: { icon: <Info className="w-3 h-3" />, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500', markerColor: '#6b7280' },
};

const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'road_event': return <Construction className="w-4 h-4" />;
    case 'incident': return <AlertTriangle className="w-4 h-4" />;
    case 'construction': return <Construction className="w-4 h-4" />;
    case 'closure': return <XCircle className="w-4 h-4" />;
    case 'weather_warning': return <CloudLightning className="w-4 h-4" />;
    case 'ferry_delay': return <Ship className="w-4 h-4" />;
    case 'power_outage': return <Zap className="w-4 h-4" />;
    case 'wildfire': return <Flame className="w-4 h-4" />;
    default: return <AlertTriangle className="w-4 h-4" />;
  }
};

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
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    fetch('/api/config/mapbox-token')
      .then(r => r.json())
      .then(data => setMapboxToken(data.token || ''))
      .catch(() => setMapboxToken(''));
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [regionId]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const url = `/api/v1/alerts/active?limit=500`;
      const response = await fetch(url);
      const data = await response.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
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

  const [mapReady, setMapReady] = useState(false);

  // Initialize map only once when container and token are available
  useEffect(() => {
    if (!showMap || !mapboxToken || !mapContainer.current) return;
    if (map.current) return; // Already initialized

    mapboxgl.accessToken = mapboxToken;
    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-123.1207, 49.2827],
      zoom: 5,
    });

    newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    newMap.on('load', () => {
      setMapReady(true);
    });

    map.current = newMap;

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapReady(false);
      }
    };
  }, [showMap, mapboxToken]);

  // Update markers when alerts change
  useEffect(() => {
    if (!map.current || !mapReady || !showMap) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const alertsWithCoords = filteredAlerts.filter(a => {
      const lat = Number(a.latitude || a.region_lat);
      const lng = Number(a.longitude || a.region_lng);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    alertsWithCoords.forEach(alert => {
      const config = severityConfig[alert.severity] || severityConfig.info;
      const lat = Number(alert.latitude || alert.region_lat);
      const lng = Number(alert.longitude || alert.region_lng);
      if (isNaN(lat) || isNaN(lng)) return;
      
      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${config.markerColor};
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      
      el.addEventListener('click', () => setSelectedAlert(alert));
      el.addEventListener('mouseenter', () => {
        setHoveredAlertId(alert.id);
        el.style.transform = 'scale(1.3)';
      });
      el.addEventListener('mouseleave', () => {
        setHoveredAlertId(null);
        el.style.transform = 'scale(1)';
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 15 }).setHTML(`
            <div style="padding: 8px; max-width: 200px;">
              <strong style="color: #333;">${alert.headline}</strong>
              <p style="margin: 4px 0 0; color: #666; font-size: 12px;">
                ${alert.region_name || 'Unknown region'}
              </p>
            </div>
          `)
        )
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });

    // Fit bounds only on first load, not on every update
    if (alertsWithCoords.length > 0 && map.current && markersRef.current.length === alertsWithCoords.length) {
      const bounds = new mapboxgl.LngLatBounds();
      let validCount = 0;
      alertsWithCoords.forEach(a => {
        const lat = Number(a.latitude || a.region_lat);
        const lng = Number(a.longitude || a.region_lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend([lng, lat]);
          validCount++;
        }
      });
      if (validCount > 0) {
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
      }
    }
  }, [filteredAlerts, mapReady, showMap]);

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

  if (loading) {
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
            <SelectTrigger className="w-[160px]" data-testid="select-alert-region">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(region => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="severity">By Severity</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex bg-muted rounded-lg p-1 ml-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="view-mode-list"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                viewMode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="view-mode-compact"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                viewMode === 'timeline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="view-mode-timeline"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(searchQuery || selectedSeverity !== 'all' || selectedType !== 'all' || selectedRegion !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedSeverity('all');
              setSelectedType('all');
              setSelectedRegion('all');
            }}
            className="mt-3"
            data-testid="button-clear-filters"
          >
            <X className="w-4 h-4 mr-1" />
            Clear all filters
          </Button>
        )}
      </div>

      <div className={`grid ${showMap ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4`}>
        <div className={`space-y-3 ${showMap ? 'max-h-[70vh] overflow-y-auto pr-2' : ''}`}>
          {viewMode === 'list' && filteredAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isHovered={hoveredAlertId === alert.id}
              onHover={(hovered) => setHoveredAlertId(hovered ? alert.id : null)}
              onClick={() => {
                setSelectedAlert(alert);
                flyToAlert(alert);
              }}
            />
          ))}

          {viewMode === 'compact' && (
            <div className="bg-card rounded-xl overflow-hidden border">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-sm">
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Headline</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAlerts.map(alert => {
                    const config = severityConfig[alert.severity] || severityConfig.info;
                    return (
                      <tr 
                        key={alert.id} 
                        className={`cursor-pointer transition-colors ${hoveredAlertId === alert.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => { setSelectedAlert(alert); flyToAlert(alert); }}
                        onMouseEnter={() => setHoveredAlertId(alert.id)}
                        onMouseLeave={() => setHoveredAlertId(null)}
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${config.bg} ${config.color}`}>
                            {config.icon} {alert.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm truncate max-w-xs">
                          {alert.headline}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {getTimeAgo(new Date(alert.created_at))}
                        </td>
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
            className="bg-card rounded-xl border relative"
            style={{ height: '70vh', minHeight: '400px' }}
          >
            <div ref={mapContainer} className="absolute inset-0 rounded-xl" />
            
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
  const config = severityConfig[alert.severity] || severityConfig.info;
  
  return (
    <div
      className={`bg-card rounded-xl p-4 border-l-4 cursor-pointer transition-all border ${config.border} ${
        isHovered ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold uppercase inline-flex items-center gap-1 ${config.bg} ${config.color}`}>
              {config.icon} {alert.severity}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <TypeIcon type={alert.alert_type} />
              {alert.alert_type?.replace(/_/g, ' ')}
            </span>
          </div>
          
          <h3 className="font-medium">{alert.headline}</h3>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {alert.region_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTimeAgo(new Date(alert.created_at))}
            </span>
          </div>
        </div>
        
        <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </div>
  );
}

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
}

function AlertDetailModal({ alert, onClose }: AlertDetailModalProps) {
  const config = severityConfig[alert.severity] || severityConfig.info;
  
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
        className="max-w-2xl w-full bg-card rounded-xl overflow-hidden border"
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-6 py-4 ${config.bg} border-b`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded text-sm font-semibold uppercase inline-flex items-center gap-1 ${config.color} bg-background/50`}>
                {config.icon} {alert.severity}
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <TypeIcon type={alert.alert_type} />
                {alert.alert_type?.replace(/_/g, ' ')}
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
              <p>{alert.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-muted-foreground text-sm uppercase mb-1">Region</h4>
              <p className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {alert.region_name}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm uppercase mb-1">Source</h4>
              <p className="flex items-center gap-1">
                <Radio className="w-4 h-4" />
                {alert.source || 'Unknown'}
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
                  <Clock className="w-4 h-4" />
                  {new Date(alert.expires_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertsTab;
