/**
 * Event Quote Drafts List - A2.5
 * 
 * Shows all draft quotes for the contractor with status badges.
 * Links to detail page for editing and publishing.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Clock,
  Plus
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface QuoteDraft {
  id: string;
  status: string;
  tenantId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  category: string | null;
  addressText: string | null;
  baseEstimate: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export default function EventQuotesListPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<{ success: boolean; drafts: QuoteDraft[] }>({
    queryKey: ['/api/contractor/event/quote-drafts'],
  });

  const drafts = data?.drafts || [];
  const draftQuotes = drafts.filter(d => d.status === 'draft');
  const publishedQuotes = drafts.filter(d => d.status === 'published');
  const archivedQuotes = drafts.filter(d => d.status === 'archived');

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    published: { label: 'Published', variant: 'default' },
    archived: { label: 'Archived', variant: 'outline' },
  };

  const renderQuoteCard = (quote: QuoteDraft) => (
    <Card 
      key={quote.id}
      className="hover-elevate cursor-pointer transition-all"
      onClick={() => navigate(`/app/contractor/event/quotes/${quote.id}`)}
      data-testid={`card-quote-${quote.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusConfig[quote.status]?.variant || 'secondary'}>
                {statusConfig[quote.status]?.label || quote.status}
              </Badge>
              {!quote.tenantId && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                  Unclaimed
                </Badge>
              )}
              {quote.category && (
                <Badge variant="outline">{quote.category}</Badge>
              )}
            </div>
            
            <div className="space-y-1">
              {quote.customerName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{quote.customerName}</span>
                </div>
              )}
              {quote.addressText && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{quote.addressText}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(quote.createdAt), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {quote.baseEstimate && (
              <span className="font-semibold text-lg">
                ${parseFloat(quote.baseEstimate).toLocaleString()}
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmptyState = () => (
    <Card>
      <CardContent className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No quotes yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first quote by scanning a booth sign or capturing worksite photos.
        </p>
        <Button onClick={() => navigate('/app/contractor/event')}>
          <Plus className="h-4 w-4 mr-2" />
          Start Capturing
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/app/contractor/event')}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" data-testid="text-page-title">Draft Quotes</h1>
            <p className="text-sm text-muted-foreground">
              Review and publish quotes to customers
            </p>
          </div>
          <Button 
            onClick={() => navigate('/app/contractor/event/quotes/new')}
            data-testid="button-new-quote"
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-6">
            {draftQuotes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Drafts ({draftQuotes.length})
                </h2>
                <div className="space-y-3">
                  {draftQuotes.map(renderQuoteCard)}
                </div>
              </div>
            )}

            {publishedQuotes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Published ({publishedQuotes.length})
                </h2>
                <div className="space-y-3">
                  {publishedQuotes.map(renderQuoteCard)}
                </div>
              </div>
            )}

            {archivedQuotes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Archived ({archivedQuotes.length})
                </h2>
                <div className="space-y-3">
                  {archivedQuotes.map(renderQuoteCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
