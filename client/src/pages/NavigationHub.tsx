import { Link } from "wouter";
import { 
  Shield, 
  Truck, 
  Search, 
  MapPin, 
  Building2, 
  Globe, 
  Radio, 
  LayoutDashboard,
  Users,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface CivosStats {
  success: boolean;
  stats: {
    signals: { active: number };
    capacity: { properties: number; spots: number };
  };
}

export default function NavigationHub() {
  const { data: civosData } = useQuery<CivosStats>({
    queryKey: ['/api/civos/stats'],
  });

  const quickLinks = [
    {
      title: "Command Center",
      description: "Emergency operations dashboard",
      icon: Shield,
      path: "/command-center",
      color: "text-red-400",
      badge: `${civosData?.stats?.signals?.active || 0} signals`
    },
    {
      title: "Staging Search",
      description: "Find RV parks and work crew staging",
      icon: Search,
      path: "/staging",
      color: "text-blue-400",
      badge: `${civosData?.stats?.capacity?.spots || 0} spots`
    },
    {
      title: "Map View",
      description: "Interactive staging property map",
      icon: MapPin,
      path: "/staging/map",
      color: "text-green-400",
      badge: `${civosData?.stats?.capacity?.properties || 0} properties`
    },
    {
      title: "Fleet Management",
      description: "Vehicles and trailers",
      icon: Truck,
      path: "/fleet",
      color: "text-orange-400",
      badge: "9 assets"
    },
    {
      title: "Host Portal",
      description: "Property owner dashboard",
      icon: Users,
      path: "/host/dashboard",
      color: "text-purple-400"
    },
    {
      title: "Admin Overview",
      description: "System statistics and health",
      icon: LayoutDashboard,
      path: "/admin",
      color: "text-cyan-400"
    },
  ];

  const dataModules = [
    { title: "Geographic View", icon: Globe, path: "/admin/geo", count: "190 regions" },
    { title: "Infrastructure", icon: Radio, path: "/admin/infrastructure", count: "10,791 entities" },
    { title: "Accommodations", icon: Building2, path: "/admin/accommodations", count: "7,458 properties" },
    { title: "CivOS Dashboard", icon: Shield, path: "/admin/civos", count: "Live signals" },
    { title: "Documentation", icon: FileText, path: "/admin/docs" },
  ];

  return (
    <div className="h-full overflow-auto p-6 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-foreground">Navigation Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            BC Community Canvas - Central navigation for all modules
          </p>
        </div>

        {/* Quick Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <Link key={link.path} href={link.path}>
              <Card className="bg-card/50 hover-elevate cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md bg-background/50 ${link.color}`}>
                      <link.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm">{link.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                      {link.badge && (
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {link.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Data Modules */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Data Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {dataModules.map(module => (
                <Link key={module.path} href={module.path}>
                  <div className="p-3 bg-background/50 rounded-md hover-elevate cursor-pointer text-center">
                    <module.icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-xs font-medium">{module.title}</div>
                    {module.count && (
                      <div className="text-[10px] text-muted-foreground mt-1">{module.count}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Public Site Link */}
        <Card className="bg-card/50 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-bold text-sm">Public Dashboard</h3>
                <p className="text-xs text-muted-foreground">View the public-facing community status dashboard</p>
              </div>
              <Link href="/">
                <Badge variant="outline" className="cursor-pointer hover-elevate">
                  <Globe className="w-3 h-3 mr-1" />
                  Visit Public Site
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
