/**
 * Contractor Event Mode Entry Page - A2.5
 * 
 * Three giant action tiles for booth/event operations:
 * 1. Scan booth sign / QR
 * 2. Add customer work photos
 * 3. Review draft quotes
 * 
 * Non-linear flow: supports messy order.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  QrCode, 
  Camera, 
  FileText, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface QuoteDraft {
  id: string;
  status: string;
  customerName: string | null;
  category: string | null;
  createdAt: string;
}

export default function EventModePage() {
  const navigate = useNavigate();

  const { data: draftsData } = useQuery<{ success: boolean; drafts: QuoteDraft[] }>({
    queryKey: ['/api/contractor/event/quote-drafts'],
  });

  const draftCount = draftsData?.drafts?.filter(d => d.status === 'draft').length || 0;

  const tiles = [
    {
      id: 'scan',
      title: 'Scan Booth Sign / QR',
      description: 'Capture a booth sign or scan QR code to connect with a contractor',
      icon: QrCode,
      color: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      onClick: () => navigate('/app/contractor/event/scan'),
      testId: 'tile-scan-qr',
    },
    {
      id: 'photos',
      title: 'Add Customer Work Photos',
      description: 'Upload photos from a worksite to create a lead',
      icon: Camera,
      color: 'bg-green-500/10',
      iconColor: 'text-green-500',
      onClick: () => navigate('/app/contractor/event/capture'),
      testId: 'tile-capture-photos',
    },
    {
      id: 'quotes',
      title: 'Review Draft Quotes',
      description: 'View and edit pending quotes before sending to customers',
      icon: FileText,
      color: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      badge: draftCount > 0 ? draftCount : undefined,
      onClick: () => navigate('/app/contractor/event/quotes'),
      testId: 'tile-review-quotes',
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
            <Sparkles className="h-4 w-4" />
            Event Mode
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Event Mode</h1>
          <p className="text-muted-foreground">
            Capture leads at booths, community events, or pop-ups
          </p>
        </div>

        <div className="space-y-4">
          {tiles.map((tile) => (
            <Card 
              key={tile.id}
              className="hover-elevate cursor-pointer transition-all"
              onClick={tile.onClick}
              data-testid={tile.testId}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl ${tile.color}`}>
                    <tile.icon className={`h-8 w-8 ${tile.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{tile.title}</h3>
                      {tile.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {tile.badge} pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                      {tile.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4">
          Photos and scans can arrive in any order. We'll help you connect the dots.
        </div>
      </div>
    </div>
  );
}
