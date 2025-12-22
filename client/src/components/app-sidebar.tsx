import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader } from "@/components/ui/sidebar";
import { 
  Zap, 
  Droplet, 
  Ship, 
  Navigation, 
  AlertTriangle, 
  Cloud, 
  Waves, 
  Bus, 
  Plane, 
  Train,
  Wind,
  Heart,
  Calendar,
  Building,
  Construction,
  ParkingCircle,
  TrendingUp,
  Flame,
  Clock,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  { id: "emergency", label: "Emergency Alerts", icon: AlertTriangle },
  { id: "power", label: "Power & Utilities", icon: Zap },
  { id: "water", label: "Water & Sewer", icon: Droplet },
  { id: "ferry", label: "Ferries", icon: Ship },
  { id: "traffic", label: "Roads & Traffic", icon: Navigation },
  { id: "transit", label: "Public Transit", icon: Bus },
  { id: "airport", label: "Airport Status", icon: Plane },
  { id: "weather", label: "Weather", icon: Cloud },
  { id: "tides", label: "Tides & Marine", icon: Waves },
  { id: "air_quality", label: "Air Quality", icon: Wind },
  { id: "health", label: "Health Services", icon: Heart },
  { id: "events", label: "Active Events", icon: Calendar },
  { id: "parking", label: "Parking", icon: ParkingCircle },
  { id: "construction", label: "Construction", icon: Construction },
  { id: "economic", label: "Economic Indicators", icon: TrendingUp },
  { id: "fire", label: "Fire Risk", icon: Flame },
];

interface AppSidebarProps {
  onCategorySelect: (id: string) => void;
  activeCategory: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  cityName: string;
  onCityChange: (city: string) => void;
}

export function AppSidebar({ 
  onCategorySelect, 
  activeCategory, 
  onRefresh, 
  isRefreshing,
  cityName,
  onCityChange 
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">City Command</h1>
          </div>
          
          <div className="flex flex-col gap-2">
            <select 
              value={cityName.toLowerCase()}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="vancouver">Vancouver, BC</option>
              <option value="bamfield">Bamfield, BC</option>
            </select>
            
            <Button 
              onClick={onRefresh} 
              disabled={isRefreshing}
              variant="default"
              className="w-full"
            >
              {isRefreshing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                "Trigger Refresh"
              )}
            </Button>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Data Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    onClick={() => onCategorySelect(item.id)}
                    isActive={activeCategory === item.id}
                    className="w-full justify-start gap-3 px-3"
                  >
                    <item.icon className={`h-4 w-4 ${activeCategory === item.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-medium">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
