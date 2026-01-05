import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Calendar, MapPin, Users } from 'lucide-react';

interface PortalContext {
  community: { id: string; name: string; slug: string; description?: string } | undefined;
  slug: string;
}

export default function CommunityPortalOverview() {
  const { community, slug } = useOutletContext<PortalContext>();

  const stats = [
    { label: 'Local Businesses', value: '24', icon: Building2 },
    { label: 'Available Services', value: '12', icon: Users },
    { label: 'Places to Stay', value: '8', icon: MapPin },
    { label: 'Upcoming Events', value: '3', icon: Calendar },
  ];

  return (
    <div className="space-y-6" data-testid="portal-overview">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-community-name">
          Welcome to {community?.name || slug}
        </h1>
        {community?.description && (
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {community.description}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About This Community</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Explore local businesses, services, accommodations, and events in {community?.name || slug}.
            This community portal provides a central hub for residents and visitors alike.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
