import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Upload, Wand2, ArrowRight } from 'lucide-react';

export default function CatalogOnboarding() {
  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="catalog-onboarding">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Set Up Your Catalog</h1>
        <p className="text-muted-foreground">
          Choose how you want to add items to your catalog
        </p>
      </div>

      <div className="grid gap-4">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add Items Manually
            </CardTitle>
            <CardDescription>
              Add items one by one with full control over details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/catalog">
              <Button data-testid="button-add-manually">
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import from File
            </CardTitle>
            <CardDescription>
              Upload a CSV or Excel file with your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/catalog/import">
              <Button variant="outline" data-testid="button-import-file">
                Import File
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI-Powered Import
            </CardTitle>
            <CardDescription>
              We'll scan your website and create catalog items automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" data-testid="button-ai-import">
              Try AI Import
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
