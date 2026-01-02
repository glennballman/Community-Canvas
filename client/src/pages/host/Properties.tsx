import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Building2, Plus, Loader2, MapPin, Search, 
  MoreVertical, Edit, Trash2, Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

function PropertiesContent() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/host/properties'],
    queryFn: async () => {
      const res = await fetch('/api/host/properties', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load properties');
      return res.json();
    }
  });

  const properties = (data?.properties || []).filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.city || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-properties-title">Properties</h1>
            <p className="text-muted-foreground">{properties.length} properties</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search"
              />
            </div>
            <Link href="/host/properties/claim">
              <Button variant="outline" data-testid="button-claim">
                Claim Existing
              </Button>
            </Link>
            <Link href="/host/properties/add">
              <Button data-testid="button-add">
                <Plus className="h-4 w-4 mr-2" /> Add New
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No properties yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first property or claim an existing listing
              </p>
              <div className="flex justify-center gap-2">
                <Link href="/host/properties/claim">
                  <Button variant="outline">Claim Existing</Button>
                </Link>
                <Link href="/host/properties/add">
                  <Button>Add New Property</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property: any) => (
              <Card key={property.id} className="overflow-hidden" data-testid={`card-property-${property.id}`}>
                <div className="aspect-video bg-muted relative">
                  {property.thumbnailUrl ? (
                    <img src={property.thumbnailUrl} alt={property.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Building2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link href={`/staging/${property.id}`}>
                          <DropdownMenuItem className="cursor-pointer">
                            <Eye className="h-4 w-4 mr-2" /> View Public
                          </DropdownMenuItem>
                        </Link>
                        <Link href={`/host/properties/${property.id}`}>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem className="cursor-pointer text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold line-clamp-1">{property.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {property.city || property.region}
                      </p>
                    </div>
                    <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                      {property.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{property.totalSpots || 0} spots</span>
                    <Link href={`/host/properties/${property.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </HostLayout>
  );
}

export default function HostProperties() {
  return (
    <ProtectedHostRoute>
      <PropertiesContent />
    </ProtectedHostRoute>
  );
}
