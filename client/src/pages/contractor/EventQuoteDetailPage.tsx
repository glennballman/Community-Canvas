/**
 * Event Quote Detail/Edit Page - A2.5
 * 
 * Edit draft quote fields and publish to customer.
 * Includes Fourth Wow calendar opportunity prompt.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronLeft,
  Send,
  Trash2,
  MapPin,
  User,
  Phone,
  Mail,
  DollarSign,
  Tag,
  FileText,
  Calendar,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface QuoteDraft {
  id: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  addressText: string | null;
  category: string | null;
  scopeSummary: string | null;
  baseEstimate: string | null;
  notes: string | null;
  lineItems: any[];
  materials: any[];
  opportunityPreferences: Record<string, any>;
  conversationId: number | null;
  createdAt: string;
  publishedAt: string | null;
}

export default function EventQuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Partial<QuoteDraft>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; draft: QuoteDraft }>({
    queryKey: ['/api/contractor/event/quote-drafts', id],
    enabled: !!id,
  });

  const quote = data?.draft;
  const isDraft = quote?.status === 'draft';

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<QuoteDraft>) => {
      const res = await apiRequest('PATCH', `/api/contractor/event/quote-drafts/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/event/quote-drafts', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/event/quote-drafts'] });
      setHasChanges(false);
      toast({ title: 'Saved', description: 'Quote updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/contractor/event/quote-drafts/${id}/publish`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/event/quote-drafts', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/event/quote-drafts'] });
      toast({ title: 'Published', description: 'Quote sent to customer' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to publish quote', variant: 'destructive' });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/contractor/event/quote-drafts/${id}/discard`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/event/quote-drafts'] });
      toast({ title: 'Discarded', description: 'Quote has been archived' });
      navigate('/app/contractor/event/quotes');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to discard quote', variant: 'destructive' });
    },
  });

  const handleChange = (field: keyof QuoteDraft, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!hasChanges) return;
    updateMutation.mutate({
      ...formData,
      baseEstimate: formData.baseEstimate ? parseFloat(formData.baseEstimate as string) : undefined,
    } as any);
  };

  const getValue = (field: keyof QuoteDraft): string => {
    if (formData[field] !== undefined) return formData[field] as string || '';
    return quote?.[field] as string || '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Quote not found</h2>
          <p className="text-muted-foreground mb-4">This quote may have been deleted.</p>
          <Button onClick={() => navigate('/app/contractor/event/quotes')}>
            Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/app/contractor/event/quotes')}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" data-testid="text-page-title">
                {quote.category || 'Quote'} Details
              </h1>
              <Badge variant={isDraft ? 'secondary' : 'default'}>
                {quote.status}
              </Badge>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="customerName"
                  value={getValue('customerName')}
                  onChange={(e) => handleChange('customerName', e.target.value)}
                  disabled={!isDraft}
                  placeholder="Customer name"
                  data-testid="input-customer-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customerPhone"
                    value={getValue('customerPhone')}
                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                    disabled={!isDraft}
                    placeholder="Phone"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customerEmail"
                    type="email"
                    value={getValue('customerEmail')}
                    onChange={(e) => handleChange('customerEmail', e.target.value)}
                    disabled={!isDraft}
                    placeholder="Email"
                    data-testid="input-customer-email"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressText">Address</Label>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="addressText"
                  value={getValue('addressText')}
                  onChange={(e) => handleChange('addressText', e.target.value)}
                  disabled={!isDraft}
                  placeholder="Address"
                  data-testid="input-address"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Work Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="category"
                    value={getValue('category')}
                    onChange={(e) => handleChange('category', e.target.value)}
                    disabled={!isDraft}
                    placeholder="e.g., Landscaping"
                    data-testid="input-category"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseEstimate">Estimate ($)</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="baseEstimate"
                    type="number"
                    value={getValue('baseEstimate')}
                    onChange={(e) => handleChange('baseEstimate', e.target.value)}
                    disabled={!isDraft}
                    placeholder="0.00"
                    data-testid="input-estimate"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scopeSummary">Scope Summary</Label>
              <Textarea
                id="scopeSummary"
                value={getValue('scopeSummary')}
                onChange={(e) => handleChange('scopeSummary', e.target.value)}
                disabled={!isDraft}
                placeholder="Describe the work to be done..."
                rows={3}
                data-testid="input-scope-summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Assumptions</Label>
              <Textarea
                id="notes"
                value={getValue('notes')}
                onChange={(e) => handleChange('notes', e.target.value)}
                disabled={!isDraft}
                placeholder="Any additional notes or assumptions..."
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </CardContent>
        </Card>

        {quote.status === 'published' && quote.conversationId && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Quote Published</p>
                  <p className="text-sm text-muted-foreground">
                    A message thread has been created for this quote.
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  View Thread
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isDraft && (
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-medium">Opportunity Prompt</p>
                  <p className="text-sm text-muted-foreground">
                    After publishing, would you like this to appear on the community calendar?
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {isDraft && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save Changes
              </Button>
              <Button
                variant="destructive"
                onClick={() => discardMutation.mutate()}
                disabled={discardMutation.isPending}
                data-testid="button-discard"
              >
                {discardMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Discard
              </Button>
              <Button
                className="flex-1"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                data-testid="button-publish"
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Publish Quote
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
