import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, FileText, MapPin, AlertCircle } from 'lucide-react';

interface ServiceRequest {
  id: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  location_text: string | null;
  created_at: string;
  is_attached: boolean;
}

interface AddRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
}

export function AddRequestsModal({ open, onOpenChange, runId }: AddRequestsModalProps) {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [holdingRequest, setHoldingRequest] = useState<string | null>(null);
  const { toast } = useToast();
  const { resolve, nouns } = useCopy({ entryPoint: 'service' });
  const queryClient = useQueryClient();

  const { data: requestsData, isLoading: loadingRequests } = useQuery<{
    ok: boolean;
    requests: ServiceRequest[];
  }>({
    queryKey: ['/api/provider/requests'],
    enabled: open
  });

  const holdMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest('POST', `/api/provider/runs/${runId}/attachments/hold`, { requestId });
      return response.json();
    },
    onSuccess: (data, requestId) => {
      if (data.ok) {
        toast({
          title: resolve('provider.run.attachments.hold_success'),
          variant: 'default'
        });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId] });
        queryClient.invalidateQueries({ queryKey: ['/api/provider/requests'] });
        setSelectedRequests(prev => prev.filter(id => id !== requestId));
      } else {
        toast({
          title: 'Error',
          description: data.message || data.error,
          variant: 'destructive'
        });
      }
      setHoldingRequest(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to hold request',
        variant: 'destructive'
      });
      setHoldingRequest(null);
    }
  });

  const handleToggleRequest = (requestId: string, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedRequests(prev => [...prev, requestId]);
    } else {
      setSelectedRequests(prev => prev.filter(id => id !== requestId));
    }
  };

  const handleHoldSelected = async () => {
    for (const requestId of selectedRequests) {
      setHoldingRequest(requestId);
      await holdMutation.mutateAsync(requestId);
    }
    onOpenChange(false);
  };

  const handleHoldSingle = async (requestId: string) => {
    setHoldingRequest(requestId);
    await holdMutation.mutateAsync(requestId);
  };

  const availableRequests = requestsData?.requests?.filter(r => !r.is_attached) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-add-requests">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">
            {resolve('provider.run.attachments.add_modal_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {loadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p data-testid="text-no-requests">{resolve('provider.run.attachments.no_requests')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start gap-3 p-3 rounded-md border bg-card hover-elevate"
                  data-testid={`request-item-${request.id}`}
                >
                  <Checkbox
                    id={`request-${request.id}`}
                    checked={selectedRequests.includes(request.id)}
                    onCheckedChange={(checked) => handleToggleRequest(request.id, checked)}
                    data-testid={`checkbox-request-${request.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={`request-${request.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {request.summary || `Untitled ${nouns.request}`}
                    </Label>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {request.category && (
                        <Badge variant="outline" className="text-xs">
                          {request.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {request.status}
                      </Badge>
                    </div>
                    {request.location_text && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {request.location_text}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleHoldSingle(request.id)}
                    disabled={holdingRequest === request.id || holdMutation.isPending}
                    data-testid={`button-hold-${request.id}`}
                  >
                    {holdingRequest === request.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      resolve('provider.run.attachments.hold_cta')
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Close
          </Button>
          {selectedRequests.length > 0 && (
            <Button
              onClick={handleHoldSelected}
              disabled={holdMutation.isPending}
              data-testid="button-hold-selected"
            >
              {holdMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {resolve('provider.run.attachments.hold_cta')} ({selectedRequests.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
