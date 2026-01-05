import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home } from 'lucide-react';

interface PortalContext {
  community: { id: string; name: string; slug: string } | undefined;
  slug: string;
}

export default function CommunityPortalStay() {
  const { community } = useOutletContext<PortalContext>();

  return (
    <div className="space-y-6" data-testid="portal-stay">
      <div>
        <h1 className="text-2xl font-bold">Places to Stay</h1>
        <p className="text-muted-foreground">
          Find accommodations in {community?.name || 'this community'}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 bg-muted rounded-md">
            <Home className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg">Accommodations</CardTitle>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Browse available accommodations, from short-term rentals to crew staging areas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
