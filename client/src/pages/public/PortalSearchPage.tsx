/**
 * PortalSearchPage - Public search page for portal availability
 * 
 * Route: /p/:portalSlug/search
 * 
 * This page provides search functionality for guests to find
 * available assets/services within a portal.
 */

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ArrowLeft } from 'lucide-react';

export default function PortalSearchPage() {
  const { portalSlug } = useParams<{ portalSlug: string }>();

  return (
    <div className="min-h-screen bg-background" data-testid="portal-search-page">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle data-testid="text-portal-search-title">
              Search Available Services
            </CardTitle>
            <CardDescription>
              Find availability for {portalSlug || 'this portal'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Search functionality coming soon.
              </p>
              <Button variant="outline" asChild data-testid="button-back-to-portal">
                <Link to={`/p/${portalSlug}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
