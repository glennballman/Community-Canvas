import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Building2 } from 'lucide-react';

export default function DirectoryPage() {
  return (
    <div className="space-y-6" data-testid="directory-page">
      <div>
        <h1 className="text-2xl font-bold">Business Directory</h1>
        <p className="text-muted-foreground">
          Businesses registered in your community
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search businesses..."
          className="pl-9"
          data-testid="input-search-businesses"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 bg-muted rounded-md">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg">Directory</CardTitle>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            View and manage businesses that are part of your community network.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
