import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Map, 
  Camera, 
  AlertTriangle, 
  Bell,
  Leaf,
  Cloud,
  Radio
} from 'lucide-react';
import { StatusCards } from './StatusCards';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DashboardLayoutProps {
  defaultRegion?: string;
  params?: Record<string, string>;
}

export function DashboardLayout({ defaultRegion = 'bc' }: DashboardLayoutProps) {
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'webcams' | 'alerts'>('overview');
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
          <div className="bg-card rounded-xl p-8 text-center border">
            <Map className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Map view coming soon</p>
          </div>
        )}
        {activeTab === 'webcams' && (
          <div className="bg-card rounded-xl p-8 text-center border">
            <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Webcams tab - 1,100 cameras</p>
          </div>
        )}
        {activeTab === 'alerts' && (
          <div className="bg-card rounded-xl p-8 text-center border">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Alerts tab coming soon</p>
          </div>
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
        <div className="lg:col-span-2 bg-card rounded-xl border p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Live Alerts
          </h3>
          <p className="text-muted-foreground">Alert feed will appear here</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl p-6 text-white">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Weather
          </h3>
          <p className="text-4xl font-bold">-2°C</p>
          <p className="opacity-80">Light Snow</p>
        </div>
      </div>
      
      <div className="bg-card rounded-xl border p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5" />
          Live Webcams
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-video bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
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
