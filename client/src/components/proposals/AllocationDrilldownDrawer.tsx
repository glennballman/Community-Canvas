import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Home, DoorOpen, Bed, Armchair, UserSquare, Plug, ChevronRight, ImageOff, Accessibility, ChevronLeft, Camera, ZoomIn, X } from 'lucide-react';
import type { ProposalAllocation, ProposalParticipant } from '@/lib/api/proposals';

interface MediaAsset {
  id: string;
  url: string;
  media_type: 'photo' | 'document' | 'video';
  caption: string | null;
  created_at: string;
}

interface AllocationDrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: ProposalParticipant | null;
  allocation: ProposalAllocation | null;
}

function MediaCarousel({ unitIds }: { unitIds: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  const { data: mediaData, isLoading } = useQuery<{ ok: boolean; media: MediaAsset[] }>({
    queryKey: ['/api/p2/app/ops/media', { target_type: 'unit', target_id: unitIds[0] }],
    enabled: unitIds.length > 0,
  });
  
  const photos = (mediaData?.media || []).filter(m => m.media_type === 'photo');
  
  if (isLoading) {
    return (
      <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (photos.length === 0) {
    return (
      <div className="p-4 rounded-lg border bg-muted/30" data-testid="no-photos">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <ImageOff className="w-4 h-4" />
          <span>Photos</span>
        </div>
        <p className="text-sm text-muted-foreground">No photos available</p>
      </div>
    );
  }
  
  const currentPhoto = photos[currentIndex];
  
  return (
    <div data-testid="media-carousel">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Camera className="w-4 h-4" />
        <span>Photos ({photos.length})</span>
      </div>
      
      <div className="relative overflow-hidden rounded-lg border bg-muted/30">
        <div className="aspect-video relative">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || 'Unit photo'}
            className="w-full h-full object-cover"
            data-testid={`photo-${currentIndex}`}
          />
          
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
            onClick={() => setLightboxOpen(true)}
            data-testid="button-zoom-photo"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        
        {photos.length > 1 && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
            <Button
              size="icon"
              variant="ghost"
              className="bg-background/80 backdrop-blur-sm ml-2 pointer-events-auto"
              onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : photos.length - 1)}
              data-testid="button-prev-photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="bg-background/80 backdrop-blur-sm mr-2 pointer-events-auto"
              onClick={() => setCurrentIndex(prev => prev < photos.length - 1 ? prev + 1 : 0)}
              data-testid="button-next-photo"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {photos.length > 1 && (
          <div className="flex justify-center gap-0.5 py-2">
            {photos.map((_, idx) => (
              <Button
                key={idx}
                size="icon"
                variant="ghost"
                onClick={() => setCurrentIndex(idx)}
                className="p-2"
                data-testid={`button-dot-${idx}`}
              >
                <span 
                  className={`block w-2 h-2 rounded-full transition-colors ${
                    idx === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  aria-hidden="true"
                />
              </Button>
            ))}
          </div>
        )}
      </div>
      
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 z-10 text-white"
              onClick={() => setLightboxOpen(false)}
              data-testid="button-close-lightbox"
            >
              <X className="w-5 h-5" />
            </Button>
            <img
              src={currentPhoto.url}
              alt={currentPhoto.caption || 'Unit photo'}
              className="w-full max-h-[85vh] object-contain"
            />
            {photos.length > 1 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white ml-4 pointer-events-auto"
                  onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : photos.length - 1)}
                  data-testid="button-lightbox-prev"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white mr-4 pointer-events-auto"
                  onClick={() => setCurrentIndex(prev => prev < photos.length - 1 ? prev + 1 : 0)}
                  data-testid="button-lightbox-next"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getUnitIcon(unitType: string) {
  const type = unitType?.toLowerCase() || '';
  if (type.includes('sleep') || type.includes('bed')) {
    return <Bed className="w-4 h-4" />;
  } else if (type.includes('sit') || type.includes('seat')) {
    return <Armchair className="w-4 h-4" />;
  } else if (type.includes('stand')) {
    return <UserSquare className="w-4 h-4" />;
  } else if (type.includes('utility') || type.includes('power')) {
    return <Plug className="w-4 h-4" />;
  }
  return <DoorOpen className="w-4 h-4" />;
}

function formatUnitType(unitType: string): string {
  if (!unitType) return 'Unknown';
  
  const type = unitType.toLowerCase();
  if (type.includes('sleep')) return 'Sleep Spot';
  if (type.includes('sit') || type.includes('seat')) return 'Seat';
  if (type.includes('stand')) return 'Standing Spot';
  if (type.includes('utility') || type.includes('power')) return 'Power Endpoint';
  
  return unitType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ContainerPath({ path }: { path: string[] }) {
  if (!path || path.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
      <Home className="w-3 h-3" />
      {path.map((segment, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="w-3 h-3" />}
          <span>{segment}</span>
        </span>
      ))}
    </div>
  );
}

export function AllocationDrilldownDrawer({ 
  open, 
  onOpenChange, 
  participant,
  allocation 
}: AllocationDrilldownDrawerProps) {
  const hasUnits = allocation?.claims?.some(c => c.units.length > 0);
  
  const unitIds = allocation?.claims?.flatMap(c => c.units.map(u => u.unit_id)) || [];
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg" data-testid="allocation-drilldown-drawer">
        <SheetHeader>
          <SheetTitle data-testid="drilldown-participant-name">
            {participant?.display_name || 'Participant'}
          </SheetTitle>
          <SheetDescription>
            Allocated units and resources
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          {!hasUnits ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-units-message">
              <DoorOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No assigned units yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {allocation?.claims?.map((claim, claimIndex) => (
                <div key={claim.claim_id} data-testid={`claim-${claimIndex}`}>
                  <ContainerPath path={claim.container_path} />
                  
                  <div className="mt-2 space-y-2">
                    {claim.units.map((unit, unitIndex) => (
                      <div 
                        key={unit.unit_id}
                        className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30"
                        data-testid={`unit-${claimIndex}-${unitIndex}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 p-2 rounded-md bg-background">
                            {getUnitIcon(unit.unit_type)}
                          </div>
                          <div>
                            <div className="font-medium" data-testid={`unit-label-${claimIndex}-${unitIndex}`}>
                              {unit.unit_label || `Unit ${unitIndex + 1}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatUnitType(unit.unit_type)}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {claim.claim_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  {claimIndex < (allocation?.claims?.length || 0) - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
              
              <Separator className="my-4" />
              
              <MediaCarousel unitIds={unitIds} />
              
              <div className="p-4 rounded-lg border bg-muted/30" data-testid="accessibility-info">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Accessibility className="w-4 h-4" />
                  <span>Accessibility</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accessibility information available upon request
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
