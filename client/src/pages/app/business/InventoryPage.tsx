import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, Home, Car, Anchor, Wrench, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface InventoryItem {
  id: string;
  name: string;
  asset_type: string;
  description: string | null;
  is_available: boolean;
  capability_count?: number;
  capacity_count?: number;
  constraint_count?: number;
}

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/rentals/items'],
  });
  
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'equipment': return Package;
      case 'accommodation': return Home;
      case 'property': return Home;
      case 'parking': return Car;
      case 'moorage': return Anchor;
      case 'watercraft': return Anchor;
      case 'vehicle': return Car;
      case 'trailer': return Car;
      case 'service': return Wrench;
      default: return Package;
    }
  };

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Things you can book out — rooms, parking spots, equipment, tools.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/app/inventory/import">
            <Button variant="outline" data-testid="button-import-inventory" title="Import inventory items from a file">
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
          placeholder="Search inventory..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-inventory"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">No Inventory Items</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm ? 'No items match your search.' : 'Add your first inventory item to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const Icon = getTypeIcon(item.asset_type);
            return (
              <Link key={item.id} to={`/app/inventory/${item.id}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-inventory-item-${item.id}`}>
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className="p-2 bg-muted rounded-md">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <Badge variant={item.is_available !== false ? 'default' : 'secondary'}>
                          {item.is_available !== false ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {item.asset_type?.replace(/_/g, ' ') || 'Item'}
                      </p>
                    </div>
                  </CardHeader>
                  {item.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
