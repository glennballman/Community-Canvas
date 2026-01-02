import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Map, 
  Camera, 
  AlertTriangle, 
  Bell,
  Leaf,
  Cloud,
  Radio,
  Navigation2,
  Settings,
  Compass,
  Truck
} from 'lucide-react';
import { Link } from 'wouter';
import { StatusCards } from './StatusCards';
import { AlertsFeed } from './AlertsFeed';
import { AlertsTab } from './AlertsTab';
import { WebcamGrid } from './WebcamGrid';
import { WebcamsTab } from './WebcamsTab';
import { FerryStatus } from './FerryStatus';
import { WeatherWidget } from './WeatherWidget';
import { RoadEvents } from './RoadEvents';
import { MapView } from './MapView';
import { RoadTripsTab } from './RoadTripsTab';
import { TripPlanningTab } from '../TripPlanning/TripPlanningTab';
import { FleetDashboard } from '../Fleet/FleetDashboard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TabType = 'overview' | 'map' | 'webcams' | 'alerts' | 'roadtrips' | 'planning' | 'fleet';

interface DashboardLayoutProps {
  defaultRegion?: string;
  defaultTab?: TabType;
  params?: Record<string, string>;
}

export function DashboardLayout({ defaultRegion = 'bc', defaultTab }: DashboardLayoutProps) {
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion);
  
  // Read initial tab from prop or URL query parameter
  const getInitialTab = (): TabType => {
    if (defaultTab) return defaultTab;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['overview', 'map', 'webcams', 'alerts', 'roadtrips', 'planning', 'fleet'].includes(tab)) {
      return tab as TabType;
    }
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    fetch('/api/v1/alerts/count')
      .then(r => r.json())
      .then(data => setAlertCount(data.count || 0))
      .catch(() => setAlertCount(0));
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'webcams', label: 'Webcams', icon: Camera },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'roadtrips', label: 'Road Trips', icon: Navigation2 },
    { id: 'planning', label: 'Trip Planning', icon: Compass },
    { id: 'fleet', label: 'Fleet', icon: Truck },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Leaf className="w-6 h-6 text-green-600" />
              <h1 className="text-xl font-bold" data-testid="text-dashboard-title">BC Community Status</h1>
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Radio className="w-3 h-3" />
                LIVE
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-[200px]" data-testid="select-region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bc">All British Columbia</SelectItem>
                  <SelectItem value="metro-vancouver">Metro Vancouver</SelectItem>
                  <SelectItem value="capital">Capital Region</SelectItem>
                  <SelectItem value="fraser-valley">Fraser Valley</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="w-5 h-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </Button>
              
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-admin">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
          
          <nav className="flex gap-1 mt-3 -mb-px">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-b-none border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {tab.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewTab regionId={selectedRegion} />
        )}
        {activeTab === 'map' && (
          <MapView regionId={selectedRegion} />
        )}
        {activeTab === 'webcams' && (
          <WebcamsTab regionId={selectedRegion} />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab regionId={selectedRegion} />
        )}
        {activeTab === 'roadtrips' && (
          <RoadTripsTab regionId={selectedRegion} />
        )}
        {activeTab === 'planning' && (
          <TripPlanningTab />
        )}
        {activeTab === 'fleet' && (
          <FleetDashboard />
        )}
      </main>
      
      <footer className="bg-card border-t py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Data refreshes automatically | <LiveTimestamp /></p>
          <p className="mt-1">10,353 entities | 190 regions | 5 live data pipelines</p>
        </div>
      </footer>
    </div>
  );
}

function OverviewTab({ regionId }: { regionId: string }) {
  return (
    <div className="space-y-6">
      <StatusCards regionId={regionId} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <AlertsFeed regionId={regionId} maxAlerts={6} compact={true} />
          <RoadEvents regionId={regionId} maxEvents={5} />
        </div>
        <div className="space-y-4">
          <WeatherWidget regionId={regionId} />
          <FerryStatus />
        </div>
      </div>
      
      <WebcamGrid regionId={regionId} columns={4} maxWebcams={8} />
    </div>
  );
}

function LiveTimestamp() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  return <span data-testid="text-live-timestamp">Last updated: {time.toLocaleTimeString()}</span>;
}

export default DashboardLayout;
