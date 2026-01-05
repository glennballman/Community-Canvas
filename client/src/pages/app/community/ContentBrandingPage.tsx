import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Palette, Image } from 'lucide-react';

export default function ContentBrandingPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="content-branding-page">
      <div>
        <h1 className="text-2xl font-bold">Content & Branding</h1>
        <p className="text-muted-foreground">
          Customize your community portal appearance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Portal Settings
          </CardTitle>
          <CardDescription>
            Configure how your community portal appears to visitors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-name">Portal Name</Label>
            <Input
              id="portal-name"
              placeholder="My Community"
              data-testid="input-portal-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portal-description">Description</Label>
            <Textarea
              id="portal-description"
              placeholder="Describe your community..."
              data-testid="input-portal-description"
            />
          </div>

          <Button data-testid="button-save-branding">
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Images
          </CardTitle>
          <CardDescription>
            Upload logo and hero images
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Image upload coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
