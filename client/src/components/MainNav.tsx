import { Link, useLocation } from 'wouter';
import { 
  Shield, Radio, Globe, Truck, Building2, Home, Search, MapPin, 
  Calendar, Store, Settings, Download, Database, FileText, Book,
  LayoutDashboard, Map, Users, Car
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Shield;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
  color: string;
}

const navSections: NavSection[] = [
  {
    title: 'Community Manager',
    color: 'blue',
    items: [
      { path: '/command-center', label: 'Command Center', icon: Shield, description: 'Real-time emergency & infrastructure monitoring' },
      { path: '/admin/civos', label: 'CivOS Operations', icon: Radio, description: 'Emergency signals & capacity' },
      { path: '/admin/geo', label: 'Geographic Data', icon: Globe, description: 'Municipalities & regions' },
      { path: '/admin/infrastructure', label: 'Infrastructure', icon: Building2, description: 'Roads, bridges, utilities' },
    ]
  },
  {
    title: 'Business Owner',
    color: 'green',
    items: [
      { path: '/host/dashboard', label: 'Property Dashboard', icon: Home, description: 'Manage your accommodations' },
      { path: '/fleet', label: 'Vehicle Fleet', icon: Truck, description: 'Manage vehicles & trailers' },
      { path: '/admin/accommodations', label: 'All Accommodations', icon: Building2, description: 'Browse all properties' },
    ]
  },
  {
    title: 'Crew & Traveller',
    color: 'amber',
    items: [
      { path: '/staging', label: 'Find Staging', icon: Search, description: 'Search crew-friendly stays' },
      { path: '/staging/map', label: 'Map View', icon: MapPin, description: 'Visual property search' },
      { path: '/staging/bookings', label: 'My Bookings', icon: Calendar, description: 'Upcoming stays' },
      { path: '/staging/chamber', label: 'Local Services', icon: Store, description: 'Chamber of Commerce' },
    ]
  },
  {
    title: 'System Admin',
    color: 'purple',
    items: [
      { path: '/admin', label: 'Admin Console', icon: LayoutDashboard, description: 'System overview' },
      { path: '/admin/import', label: 'Data Import', icon: Download, description: 'Import properties & data' },
      { path: '/admin/sources', label: 'Data Sources', icon: Database, description: 'Manage feeds' },
      { path: '/admin/settings', label: 'Settings', icon: Settings, description: 'System configuration' },
    ]
  },
];

interface MainNavProps {
  stats?: {
    municipalities: number;
    entities: number;
    accommodations: number;
    stagingProperties: number;
  };
}

export default function MainNav({ stats }: MainNavProps) {
  const [location] = useLocation();
  
  const colorClasses: Record<string, string> = {
    blue: 'border-l-blue-500 bg-blue-500/10',
    green: 'border-l-green-500 bg-green-500/10',
    amber: 'border-l-amber-500 bg-amber-500/10',
    purple: 'border-l-purple-500 bg-purple-500/10',
  };

  const iconColors: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="p-6 space-y-8">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Map className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Community Canvas</h1>
        </div>
        <p className="text-muted-foreground">BC Staging Network - Navigation Hub</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {navSections.map(section => (
          <div 
            key={section.title}
            className={`border-l-4 ${colorClasses[section.color]} rounded-lg p-4`}
          >
            <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                  >
                    <div
                      className={`block p-3 rounded-lg transition-colors cursor-pointer ${
                        location === item.path
                          ? 'bg-primary/20 text-foreground'
                          : 'hover-elevate text-muted-foreground'
                      }`}
                      data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${iconColors[section.color]}`} />
                        <div>
                          <div className="font-medium text-foreground">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-blue-400">{stats?.municipalities ?? 190}</div>
          <div className="text-muted-foreground text-sm">Municipalities</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-green-400">{stats?.entities ?? '10,791'}</div>
          <div className="text-muted-foreground text-sm">Entities</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-amber-400">{stats?.accommodations ?? '7,458'}</div>
          <div className="text-muted-foreground text-sm">Accommodations</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-purple-400">{stats?.stagingProperties ?? 37}</div>
          <div className="text-muted-foreground text-sm">Staging Properties</div>
        </div>
      </div>
    </div>
  );
}
