import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

interface PortalContext {
  community: { id: string; name: string; slug: string } | undefined;
  slug: string;
}

export default function CommunityPortalBusinesses() {
  const { community } = useOutletContext<PortalContext>();

  return (
    <div className="space-y-6" data-testid="portal-businesses">
      <div>
        <h1 className="text-2xl font-bold">Local Businesses</h1>
        <p className="text-muted-foreground">
          Discover businesses in {community?.name || 'this community'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-muted rounded-md">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Sample Business</CardTitle>
              <p className="text-sm text-muted-foreground">Category</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Business directory coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
