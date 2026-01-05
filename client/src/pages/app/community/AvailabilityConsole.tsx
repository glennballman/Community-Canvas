import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, Phone } from 'lucide-react';

export default function AvailabilityConsole() {
  return (
    <div className="space-y-6" data-testid="availability-console">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Availability Console</h1>
          <p className="text-muted-foreground">
            Search and manage catalog availability across businesses
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search availability..."
            className="pl-9"
            data-testid="input-search-availability"
          />
        </div>
        <Button variant="outline" data-testid="button-filter">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Operator Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Search for available rentals, accommodations, parking, moorage, and services from
            businesses that have opted in to sharing their catalog with your community.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
