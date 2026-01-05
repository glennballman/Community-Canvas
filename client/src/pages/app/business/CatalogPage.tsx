import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Package, Home, Car, Anchor, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CatalogPage() {
  const catalogItems = [
    { id: '1', name: 'Excavator', type: 'rental', status: 'available' },
    { id: '2', name: 'Cabin A', type: 'accommodation', status: 'booked' },
    { id: '3', name: 'Parking Spot 1', type: 'parking', status: 'available' },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rental': return Package;
      case 'accommodation': return Home;
      case 'parking': return Car;
      case 'moorage': return Anchor;
      case 'service': return Wrench;
      default: return Package;
    }
  };

  return (
    <div className="space-y-6" data-testid="catalog-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Catalog</h1>
          <p className="text-muted-foreground">
            Manage your inventory and offerings
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/app/catalog/import">
            <Button variant="outline" data-testid="button-import-catalog">
              Import
            </Button>
          </Link>
          <Button data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search catalog..."
          className="pl-9"
          data-testid="input-search-catalog"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalogItems.map((item) => {
          const Icon = getTypeIcon(item.type);
          return (
            <Card key={item.id} className="hover-elevate" data-testid={`card-catalog-item-${item.id}`}>
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="p-2 bg-muted rounded-md">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Badge variant={item.status === 'available' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">
                    {item.type}
                  </p>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
