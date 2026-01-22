/**
 * A2.7: Photo Bundles List Page
 * 
 * Lists all proof bundles for the current contractor
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Camera, 
  Loader2, 
  ChevronRight,
  AlertTriangle,
  Check,
  Clock
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { formatDistanceToNow } from 'date-fns';

interface PhotoBundle {
  id: string;
  bundleType: string;
  status: string;
  missingStage?: string;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Check }> = {
  incomplete: { label: 'Incomplete', variant: 'destructive', icon: AlertTriangle },
  complete: { label: 'Complete', variant: 'secondary', icon: Clock },
  confirmed: { label: 'Confirmed', variant: 'default', icon: Check },
};

export default function PhotoBundlesListPage() {
  const { currentTenant } = useTenant();
  
  const { data, isLoading, error } = useQuery<{ bundles: PhotoBundle[] }>({
    queryKey: ['/api/contractor/photo-bundles'],
    queryFn: async () => {
      const res = await fetch('/api/contractor/photo-bundles', {
        headers: {
          'x-portal-id': currentTenant?.tenant_id || '',
          'x-tenant-id': currentTenant?.tenant_id || ''
        },
        credentials: 'include'
      });
      return res.json();
    },
    enabled: !!currentTenant
  });
  
  const bundles = data?.bundles || [];

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-bundles" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-muted-foreground">Failed to load bundles</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="heading-bundles">
            <Camera className="h-5 w-5" />
            Photo Bundles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bundles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-bundles">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No photo bundles yet</p>
              <p className="text-sm mt-1">Upload photos to create proof bundles</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="bundles-list">
              {bundles.map((bundle) => {
                const config = statusConfig[bundle.status] || statusConfig.incomplete;
                const StatusIcon = config.icon;
                
                return (
                  <Link 
                    key={bundle.id} 
                    to={`/app/contractor/photo-bundles/${bundle.id}`}
                    className="block"
                    data-testid={`bundle-item-${bundle.id}`}
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {bundle.bundleType === 'before_after' ? 'Before/After Bundle' : bundle.bundleType}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created {formatDistanceToNow(new Date(bundle.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {bundle.missingStage && (
                          <Badge variant="outline" className="text-xs">
                            Missing: {bundle.missingStage}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
