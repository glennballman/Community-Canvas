import { useEffect, useState, useMemo } from 'react';
import { 
  AlertTriangle, AlertCircle, Info, Clock, MapPin, Radio, X,
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
}

interface AlertsTabProps {
  regionId?: string;
}

interface SeverityConfig {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}

const severityConfig: Record<string, SeverityConfig> = {
  critical: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500' },
  emergency: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500' },
  major: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500' },
  warning: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500' },
  advisory: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500' },
  minor: { icon: <Info className="w-3 h-3" />, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500' },
  info: { icon: <Info className="w-3 h-3" />, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500' },
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity'>('newest');
  
  const [viewMode, setViewMode] = useState<'list' | 'compact' | 'timeline'>('list');

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
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px]" data-testid="select-alert-type">
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
            <SelectTrigger className="w-[180px]" data-testid="select-alert-region">
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
            <SelectTrigger className="w-[150px]" data-testid="select-sort">
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
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                viewMode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="view-mode-compact"
            >
              <LayoutGrid className="w-4 h-4" /> Compact
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                viewMode === 'timeline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="view-mode-timeline"
            >
              <Calendar className="w-4 h-4" /> Timeline
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

      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onClick={() => setSelectedAlert(alert)}
            />
          ))}
        </div>
      )}

      {viewMode === 'compact' && (
        <div className="bg-card rounded-xl overflow-hidden border">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-sm">
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Headline</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAlerts.map(alert => {
                const config = severityConfig[alert.severity] || severityConfig.info;
                return (
                  <tr 
                    key={alert.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedAlert(alert)}
                    data-testid={`alert-row-${alert.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${config.bg} ${config.color}`}>
                        {config.icon} {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TypeIcon type={alert.alert_type} />
                        {alert.alert_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm truncate max-w-md">
                      {alert.headline}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {alert.region_name}
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
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
          <div className="space-y-4">
            {filteredAlerts.map((alert, idx) => {
              const config = severityConfig[alert.severity] || severityConfig.info;
              const showDate = idx === 0 || 
                new Date(alert.created_at).toDateString() !== 
                new Date(filteredAlerts[idx - 1].created_at).toDateString();
              
              return (
                <div key={alert.id}>
                  {showDate && (
                    <div className="ml-16 mb-2 text-sm text-muted-foreground font-medium">
                      {new Date(alert.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className={`w-4 h-4 rounded-full ${config.bg} ${config.border} border-2 mt-1 z-10 flex items-center justify-center`}>
                      <CircleDot className="w-2 h-2" />
                    </div>
                    <div className="text-xs text-muted-foreground w-16 pt-1">
                      {new Date(alert.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                    <div 
                      className={`flex-1 bg-card rounded-lg p-4 border-l-4 ${config.border} cursor-pointer hover:bg-muted/50 border`}
                      onClick={() => setSelectedAlert(alert)}
                      data-testid={`timeline-alert-${alert.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold uppercase ${config.color} flex items-center gap-1`}>
                          {config.icon} {alert.severity}
                        </span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <TypeIcon type={alert.alert_type} />
                          {alert.alert_type?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 className="font-medium">{alert.headline}</h4>
                      <p className="text-muted-foreground text-sm mt-1">{alert.region_name}</p>
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
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setSelectedSeverity('all');
              setSelectedType('all');
              setSelectedRegion('all');
            }}
            className="mt-4"
          >
            Clear filters
          </Button>
        </div>
      )}

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
  onClick: () => void;
}

function AlertCard({ alert, onClick }: AlertCardProps) {
  const config = severityConfig[alert.severity] || severityConfig.info;
  
  return (
    <div
      className={`bg-card rounded-xl p-4 border-l-4 ${config.border} cursor-pointer hover:bg-muted/50 transition-colors border`}
      onClick={onClick}
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
            <span className="text-muted-foreground">-</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {alert.region_name}
            </span>
          </div>
          
          <h3 className="font-medium text-lg">{alert.headline}</h3>
          
          {alert.description && (
            <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{alert.description}</p>
          )}
          
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTimeAgo(new Date(alert.created_at))}
            </span>
            {alert.source && (
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3" />
                {alert.source}
              </span>
            )}
          </div>
        </div>
        
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="alert-detail-modal">
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
          
          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="text-muted-foreground text-sm uppercase mb-2">Additional Details</h4>
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(alert.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AlertsTab;
