/**
 * N3 Segment List Component
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Truck, 
  Ship, 
  Briefcase, 
  Hotel, 
  Clock, 
  Package,
  MapPin,
  Calendar 
} from 'lucide-react';
import { format } from 'date-fns';

interface Segment {
  id: string;
  segmentKind: string;
  startsAt: string | null;
  endsAt: string | null;
  locationRef: string | null;
  constraints: Record<string, unknown> | null;
}

interface SegmentListProps {
  segments: Segment[];
  highlightSegmentIds?: string[];
}

function getSegmentIcon(kind: string) {
  switch (kind) {
    case 'move':
      return <Truck className="h-4 w-4" />;
    case 'ride':
      return <Ship className="h-4 w-4" />;
    case 'work':
      return <Briefcase className="h-4 w-4" />;
    case 'stay':
      return <Hotel className="h-4 w-4" />;
    case 'wait':
      return <Clock className="h-4 w-4" />;
    case 'load':
      return <Package className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getSegmentColor(kind: string): string {
  switch (kind) {
    case 'move':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'ride':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
    case 'work':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'stay':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'wait':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'load':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}

export function SegmentList({ segments, highlightSegmentIds = [] }: SegmentListProps) {
  const sortedSegments = [...segments].sort((a, b) => {
    if (!a.startsAt || !b.startsAt) return 0;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });

  return (
    <div className="space-y-2">
      {sortedSegments.map((segment, idx) => {
        const isHighlighted = highlightSegmentIds.includes(segment.id);
        
        return (
          <Card 
            key={segment.id}
            className={isHighlighted ? 'border-orange-500 border-2' : ''}
            data-testid={`segment-item-${idx}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded ${getSegmentColor(segment.segmentKind)}`}>
                  {getSegmentIcon(segment.segmentKind)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {segment.segmentKind}
                    </Badge>
                    {segment.locationRef && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {segment.locationRef}
                      </span>
                    )}
                  </div>
                  
                  {segment.startsAt && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(segment.startsAt), 'MMM d, h:mm a')}
                      {segment.endsAt && (
                        <>
                          <span className="mx-1">-</span>
                          {format(new Date(segment.endsAt), 'h:mm a')}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isHighlighted && (
                  <Badge variant="destructive" className="text-xs">
                    Affected
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
