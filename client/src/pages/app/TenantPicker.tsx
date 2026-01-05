import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TenantPicker() {
  const { ccTenants, user } = useAuth();

  const getTenantIcon = (type: string) => {
    switch (type) {
      case 'community':
        return Users;
      default:
        return Building2;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="tenant-picker">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Welcome back, {user?.displayName || user?.email}</h1>
        <p className="text-muted-foreground">
          Select a place to manage, or create a new one.
        </p>
      </div>

      {ccTenants.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No places yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first business or community to get started.
            </p>
            <Button data-testid="button-create-first-tenant">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Place
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ccTenants.map((tenant) => {
            const Icon = getTenantIcon(tenant.type);
            return (
              <Link key={tenant.id} to="/app/dashboard" data-testid={`card-tenant-${tenant.id}`}>
                <Card className="hover-elevate h-full">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className="p-2 bg-muted rounded-md">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{tenant.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {tenant.type}
                        </Badge>
                      </div>
                      <CardDescription>
                        {tenant.role}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      /{tenant.slug}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          <Card className="border-dashed hover-elevate">
            <CardContent className="flex flex-col items-center justify-center h-full py-12">
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium">Add Another Place</p>
              <p className="text-sm text-muted-foreground">Business or Community</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
