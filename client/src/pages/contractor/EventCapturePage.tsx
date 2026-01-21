/**
 * Event Capture Page - A2.5
 * Stub page for worksite photo capture
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, ArrowLeft, Construction } from 'lucide-react';

export default function EventCapturePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/app/contractor/event')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Event Mode
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-4">
              <Camera className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Add Customer Work Photos</CardTitle>
            <CardDescription>
              Upload photos from a worksite to create a lead
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-8 border-2 border-dashed border-muted rounded-lg">
              <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Photo capture feature coming soon. For now, create leads via the public quote form.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/app/contractor/event/quotes')}
              data-testid="button-view-quotes"
            >
              View Draft Quotes Instead
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
