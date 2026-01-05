import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, AlertCircle, DollarSign, Calendar } from 'lucide-react';

interface Milestone {
  id: string;
  name: string;
  description: string;
  amount: number;
  status: string;
  communication_status: string;
  trigger_type: string;
  due_date: string;
  paid_at: string;
  partial_amount: number;
  remaining_amount: number;
  extended_to: string;
  owner_message: string;
  contractor_response: string;
}

interface PaymentPromiseData {
  id: string;
  total_amount: number;
  currency: string;
  status: string;
  communication_status: string;
  affected_by_community_event: boolean;
  community_event_description: string;
  honor_system_note: string;
}

interface PaymentPromiseProps {
  conversationId: string;
  myRole: 'owner' | 'contractor';
}

export function PaymentPromise({ conversationId, myRole }: PaymentPromiseProps) {
  const [promise, setPromise] = useState<PaymentPromiseData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentPromise();
  }, [conversationId]);

  async function fetchPaymentPromise() {
    setLoading(true);
    try {
      const data = await api.get<{ payment_promise: PaymentPromiseData; milestones: Milestone[] }>(
        `/conversations/${conversationId}/payment-promise`
      );
      setPromise(data.payment_promise);
      setMilestones(data.milestones || []);
    } catch (error) {
      console.error('Error fetching payment promise:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsSent(milestoneId: string) {
    const reference = prompt('Payment reference (optional):');
    
    try {
      await api.post(`/payment-milestones/${milestoneId}/sent`, { 
        reference, 
        message: 'Payment sent' 
      });
      fetchPaymentPromise();
    } catch (error) {
      console.error('Error marking as sent:', error);
    }
  }

  async function confirmReceived(milestoneId: string, partial: boolean = false) {
    const message = prompt('Any notes? (optional):');
    let amount = null;
    
    if (partial) {
      const amountStr = prompt('Amount received:');
      if (!amountStr) return;
      amount = parseFloat(amountStr);
    }
    
    try {
      await api.post(`/payment-milestones/${milestoneId}/received`, { 
        message, amount, partial 
      });
      fetchPaymentPromise();
      alert('Payment confirmed. Thank you!');
    } catch (error) {
      console.error('Error confirming receipt:', error);
    }
  }

  async function requestExtension(milestoneId: string) {
    const reason = prompt('Reason for extension request:');
    if (!reason) return;
    
    const newDate = prompt('Requested new date (YYYY-MM-DD):');
    
    try {
      await api.post(`/payment-milestones/${milestoneId}/request-extension`, { 
        reason, new_date: newDate 
      });
      fetchPaymentPromise();
      alert('Extension request sent.');
    } catch (error) {
      console.error('Error requesting extension:', error);
    }
  }

  async function grantExtension(milestoneId: string) {
    const newDate = prompt('New due date (YYYY-MM-DD):');
    const message = prompt('Message (optional):');
    
    try {
      await api.post(`/payment-milestones/${milestoneId}/grant-extension`, { 
        new_date: newDate, message 
      });
      fetchPaymentPromise();
      alert('Extension granted.');
    } catch (error) {
      console.error('Error granting extension:', error);
    }
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      in_transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      verified: 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      submitted: 'Sent',
      in_transit: 'In Transit',
      partial: 'Partial',
      received: 'Received',
      verified: 'Confirmed'
    };
    return labels[status] || status;
  }

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading payment info...</div>;
  }

  if (!promise) {
    return (
      <div className="p-6 text-center">
        <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Payment Agreement Yet</h3>
        <p className="text-muted-foreground text-sm">
          Payment terms will appear here once agreed upon.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-lg">Payment Promise</CardTitle>
          <Badge className={getStatusColor(promise.status)}>
            {getStatusLabel(promise.status)}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold">
              ${promise.total_amount.toLocaleString()}
            </span>
            <span className="text-muted-foreground">{promise.currency}</span>
          </div>

          {promise.honor_system_note && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3 mb-4">
              {promise.honor_system_note}
            </p>
          )}

          {promise.affected_by_community_event && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded mb-4">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-800 dark:text-amber-200">
                  Community Event Noted
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {promise.community_event_description}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Payment Milestones</h4>
        
        {milestones.map((milestone) => (
          <Card key={milestone.id} data-testid={`card-milestone-${milestone.id}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div>
                  <h5 className="font-medium">{milestone.name}</h5>
                  {milestone.description && (
                    <p className="text-sm text-muted-foreground">{milestone.description}</p>
                  )}
                </div>
                <Badge className={getStatusColor(milestone.status)}>
                  {getStatusLabel(milestone.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm mb-3">
                <span className="font-semibold">${milestone.amount.toLocaleString()}</span>
                {milestone.due_date && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Due: {new Date(milestone.due_date).toLocaleDateString()}
                  </span>
                )}
                {milestone.extended_to && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Extended to: {new Date(milestone.extended_to).toLocaleDateString()}
                  </span>
                )}
              </div>

              {milestone.partial_amount > 0 && (
                <div className="text-sm text-muted-foreground mb-2">
                  Partial: ${milestone.partial_amount.toLocaleString()} received
                  {milestone.remaining_amount > 0 && (
                    <span> (${milestone.remaining_amount.toLocaleString()} remaining)</span>
                  )}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {myRole === 'owner' && milestone.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => markAsSent(milestone.id)}
                    data-testid={`button-mark-sent-${milestone.id}`}
                  >
                    <Check className="h-4 w-4 mr-1" /> Mark as Sent
                  </Button>
                )}

                {myRole === 'owner' && milestone.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => requestExtension(milestone.id)}
                    data-testid={`button-request-extension-${milestone.id}`}
                  >
                    <Clock className="h-4 w-4 mr-1" /> Request Extension
                  </Button>
                )}

                {myRole === 'contractor' && ['submitted', 'in_transit'].includes(milestone.status) && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => confirmReceived(milestone.id)}
                      data-testid={`button-confirm-received-${milestone.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" /> Confirm Received
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmReceived(milestone.id, true)}
                      data-testid={`button-partial-payment-${milestone.id}`}
                    >
                      Partial Payment
                    </Button>
                  </>
                )}

                {myRole === 'contractor' && milestone.communication_status === 'extension_requested' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => grantExtension(milestone.id)}
                    data-testid={`button-grant-extension-${milestone.id}`}
                  >
                    Grant Extension
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
        This is an honor system. Payments are tracked but not enforced. Work continues regardless.
      </div>
    </div>
  );
}
