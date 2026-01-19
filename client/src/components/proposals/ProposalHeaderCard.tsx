import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Lock } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { Proposal } from '@/lib/api/proposals';

interface ProposalHeaderCardProps {
  proposal: Proposal;
  participantCount: number;
  isAuthenticated?: boolean;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'confirmed':
      return 'default';
    case 'held':
      return 'secondary';
    case 'draft':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function humanizeDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const nights = differenceInDays(end, start);
  
  if (nights === 0) {
    return format(start, 'MMM d, yyyy');
  }
  
  const startFormatted = format(start, 'MMM d');
  const endFormatted = format(end, 'MMM d, yyyy');
  
  return `${startFormatted} - ${endFormatted} (${nights} night${nights > 1 ? 's' : ''})`;
}

export function ProposalHeaderCard({ proposal, participantCount, isAuthenticated = false }: ProposalHeaderCardProps) {
  const dateRange = humanizeDateRange(proposal.time_start, proposal.time_end);
  
  return (
    <Card data-testid="proposal-header-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl" data-testid="proposal-title">
              {proposal.title || 'Untitled Reservation'}
            </CardTitle>
            <CardDescription className="mt-1" data-testid="proposal-date-range">
              <Calendar className="inline-block w-4 h-4 mr-1 -mt-0.5" />
              {dateRange}
            </CardDescription>
          </div>
          <Badge variant={getStatusVariant(proposal.status)} data-testid="proposal-status">
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span data-testid="proposal-participant-count">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>Reserved {format(parseISO(proposal.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>
        {!isAuthenticated && proposal.status !== 'confirmed' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Lock className="w-4 h-4" />
            <span data-testid="privacy-notice">Guest names hidden until confirmed</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
