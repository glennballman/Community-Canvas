import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';

interface PortalContext {
  community: { id: string; name: string; slug: string } | undefined;
  slug: string;
}

export default function CommunityPortalServices() {
  const { community } = useOutletContext<PortalContext>();

  return (
    <div className="space-y-6" data-testid="portal-services">
      <div>
        <h1 className="text-2xl font-bold">Community Services</h1>
        <p className="text-muted-foreground">
          Service runs and shared services in {community?.name || 'this community'}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 bg-muted rounded-md">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg">Service Runs</CardTitle>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cooperative service runs allow neighbors to bundle together and share mobilization costs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
