/**
 * Portals Admin Page
 * Route: /app/admin/portals
 * 
 * Lists all portals for the tenant with quick access to QA Launchpad and settings.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Globe, Rocket, Settings, ExternalLink, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Portal {
  id: string;
  slug: string;
  name: string;
  status: string;
  portalType: string | null;
}

interface PortalsResponse {
  ok: boolean;
  portals: Portal[];
}

export default function PortalsPage() {
  const { data, isLoading, error } = useQuery<PortalsResponse>({
    queryKey: ['/api/p2/admin/portals'],
    queryFn: async () => {
      const res = await fetch('/api/p2/admin/portals', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) {
          return { ok: true, portals: [] };
        }
        throw new Error('Failed to load portals');
      }
      return res.json();
    },
  });
  
  const portals = data?.portals || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="page-admin-portals-loading">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Portals</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-portals">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Portals</h1>
        </div>
      </div>
      
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load portals</p>
          </CardContent>
        </Card>
      ) : portals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No portals configured</p>
            <p className="text-muted-foreground mb-4">
              Portals let you create branded public-facing sites for your business.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portals.map(portal => (
            <Card key={portal.id} className="hover-elevate" data-testid={`card-portal-${portal.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{portal.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      /{portal.slug}
                      {portal.status && (
                        <Badge variant={portal.status === 'active' ? 'default' : 'secondary'}>
                          {portal.status}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {portal.portalType && (
                  <p className="text-sm text-muted-foreground">
                    Type: {portal.portalType}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" asChild data-testid={`button-qa-${portal.id}`}>
                    <Link to={`/app/admin/portals/${portal.id}/qa`}>
                      <Rocket className="h-4 w-4 mr-1" />
                      QA Launchpad
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild data-testid={`button-appearance-${portal.id}`}>
                    <Link to={`/app/admin/portals/${portal.id}/appearance`}>
                      <Settings className="h-4 w-4 mr-1" />
                      Appearance
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild data-testid={`button-view-${portal.id}`}>
                    <a href={`/p/${portal.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
