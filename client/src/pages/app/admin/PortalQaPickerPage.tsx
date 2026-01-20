import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, FlaskConical, Globe } from 'lucide-react';

interface Portal {
  id: string;
  slug: string;
  name: string;
  status: string;
  portalType: string;
}

export default function PortalQaPickerPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ ok: boolean; portals: Portal[] }>({
    queryKey: ['/api/p2/admin/portals'],
  });

  const portals = data?.portals || [];
  
  const filtered = portals.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" data-testid="page-portal-qa-picker">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portal QA Launchpad</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Select a Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-portal-search"
            />
          </div>

          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading portals...</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              {search ? 'No portals match your search' : 'No portals configured'}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((portal) => (
                <div
                  key={portal.id}
                  className="flex items-center justify-between py-3"
                  data-testid={`row-portal-${portal.id}`}
                >
                  <div>
                    <div className="font-medium" data-testid={`text-portal-name-${portal.id}`}>
                      {portal.name}
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`text-portal-slug-${portal.id}`}>
                      /{portal.slug}
                    </div>
                  </div>
                  <Button asChild size="sm" data-testid={`button-qa-${portal.id}`}>
                    <Link to={`/app/admin/portals/${portal.id}/qa`}>
                      <FlaskConical className="h-4 w-4 mr-2" />
                      QA
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
