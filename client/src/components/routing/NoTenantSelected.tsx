/**
 * NO TENANT SELECTED FALLBACK
 * 
 * Shown when a user is authenticated but hasn't selected a tenant,
 * and is trying to access a tenant-scoped route.
 * 
 * Provides guidance on how to select a tenant via:
 * 1. Debug Panel (dev mode)
 * 2. Your Places page
 */

import { Building2, Bug, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface NoTenantSelectedProps {
  isDev?: boolean;
}

export function NoTenantSelected({ isDev = false }: NoTenantSelectedProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Select a Tenant</CardTitle>
          <CardDescription>
            You need to select a tenant/organization to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="default" 
            className="w-full"
            onClick={() => navigate('/app/places')}
            data-testid="button-go-places"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Go to Your Places
          </Button>
          
          {isDev && (
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <div className="border-t pt-4">
                <p className="font-medium mb-2">Dev Mode Options:</p>
                <ol className="text-left list-decimal list-inside space-y-1">
                  <li>Open Debug Panel (bug icon, bottom-right)</li>
                  <li>Click "Load Tenants"</li>
                  <li>Select a tenant from the dropdown</li>
                  <li>Click "Set Tenant"</li>
                </ol>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => {
                  const debugBtn = document.querySelector('[data-testid="button-open-debug"]') as HTMLButtonElement;
                  if (debugBtn) debugBtn.click();
                }}
                className="mt-2"
                data-testid="button-open-debug-hint"
              >
                <Bug className="h-4 w-4 mr-2" />
                Open Debug Panel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
