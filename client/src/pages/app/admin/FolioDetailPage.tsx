/**
 * Folio Detail Page - P-UI-17
 * Route: /app/admin/folios/:id
 * 
 * Read-only view of a single folio with ledger entries
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, ArrowLeft, Receipt, CreditCard, User, Calendar, DollarSign, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface FolioDetail {
  id: string;
  folio_number: string;
  status: string;
  guest_individual_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
  nights_stayed: number | null;
  balance_due_cents: number;
  created_at: string;
  updated_at: string;
}

interface FolioSummary {
  total_charges_cents: number;
  total_payments_cents: number;
  balance_due_cents: number;
  entry_count: number;
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount_cents: number;
  description: string;
  posted_at: string;
  payment_method: string | null;
  payment_reference: string | null;
  sequence_number: number;
  linked_surface_claim_id: string | null;
  linked_surface_unit_id: string | null;
  linked_incident_id: string | null;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  void: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const entryTypeIcons: Record<string, typeof Plus> = {
  charge: Plus,
  payment: Minus,
  adjustment: DollarSign,
  refund: Minus,
  tax: Plus,
  fee: Plus,
  discount: Minus,
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return format(new Date(dateStr), 'MMM d, yyyy');
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
}

export default function FolioDetailPage() {
  const params = useParams<{ id: string }>();
  const folioId = params.id;
  const [activeTab, setActiveTab] = useState('ledger');
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: folioData, isLoading: folioLoading, error: folioError } = useQuery<{ ok: boolean; folio: FolioDetail; summary: FolioSummary }>({
    queryKey: ['/api/p2/folios', folioId],
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery<{ ok: boolean; entries: LedgerEntry[]; total: number }>({
    queryKey: ['/api/p2/folios', folioId, 'ledger', { limit, offset: (page - 1) * limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('offset', ((page - 1) * limit).toString());
      const res = await fetch(`/api/p2/folios/${folioId}/ledger?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch ledger');
      return res.json();
    },
    enabled: !!folioId,
  });

  const folio = folioData?.folio;
  const summary = folioData?.summary;
  const entries = entriesData?.entries ?? [];
  const totalEntries = entriesData?.total ?? 0;
  const totalPages = Math.ceil(totalEntries / limit);

  if (folioLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="page-folio-detail-loading">
        Loading folio...
      </div>
    );
  }

  if (folioError || !folio) {
    return (
      <div className="p-6" data-testid="page-folio-detail-error">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">Failed to load folio</p>
            <Link href="/app/admin/folios">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Folios
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-folio-detail">
      <div className="flex items-center gap-4">
        <Link href="/app/admin/folios">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <Wallet className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{folio.folio_number}</h1>
            <Badge className={statusColors[folio.status] || ''} data-testid="badge-status">
              {folio.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{folio.guest_name || folio.guest_email || 'No guest information'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Total Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="stat-charges">
              {formatCents(summary?.total_charges_cents ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600" data-testid="stat-payments">
              {formatCents(summary?.total_payments_cents ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Balance Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${(summary?.balance_due_cents ?? 0) > 0 ? 'text-destructive' : 'text-green-600'}`} data-testid="stat-balance">
              {formatCents(summary?.balance_due_cents ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Nights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="stat-nights">
              {folio.nights_stayed ?? 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ledger" data-testid="tab-ledger">
            <Receipt className="h-4 w-4 mr-2" />
            Ledger ({summary?.entry_count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">
            <User className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ledger Entries</CardTitle>
              <CardDescription>Immutable record of all charges and payments</CardDescription>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading ledger...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No ledger entries</div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-6 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
                    <div>#</div>
                    <div>Type</div>
                    <div className="col-span-2">Description</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Posted</div>
                  </div>
                  {entries.map(entry => {
                    const Icon = entryTypeIcons[entry.entry_type] || DollarSign;
                    const isCredit = ['payment', 'refund', 'discount'].includes(entry.entry_type);
                    return (
                      <div
                        key={entry.id}
                        className="grid grid-cols-6 gap-4 px-4 py-3 rounded-lg border bg-card items-center"
                        data-testid={`ledger-row-${entry.id}`}
                      >
                        <div className="text-sm text-muted-foreground">{entry.sequence_number}</div>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isCredit ? 'text-green-600' : 'text-foreground'}`} />
                          <span className="capitalize text-sm">{entry.entry_type}</span>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm">{entry.description}</div>
                          {entry.payment_method && (
                            <div className="text-xs text-muted-foreground">
                              {entry.payment_method} {entry.payment_reference ? `- ${entry.payment_reference}` : ''}
                            </div>
                          )}
                        </div>
                        <div className={`text-right font-medium ${isCredit ? 'text-green-600' : ''}`}>
                          {isCredit ? '-' : ''}{formatCents(entry.amount_cents)}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {formatDateTime(entry.posted_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Folio Details</CardTitle>
              <CardDescription>Guest and reservation information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Guest Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span data-testid="detail-guest-name">{folio.guest_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span data-testid="detail-guest-email">{folio.guest_email || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Stay Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in Date</span>
                      <span data-testid="detail-checkin">{formatDate(folio.check_in_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out Date</span>
                      <span data-testid="detail-checkout">{formatDate(folio.check_out_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual Check-in</span>
                      <span>{formatDateTime(folio.actual_check_in)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual Check-out</span>
                      <span>{formatDateTime(folio.actual_check_out)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nights Stayed</span>
                      <span>{folio.nights_stayed ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Record Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDateTime(folio.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{formatDateTime(folio.updated_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folio ID</span>
                    <span className="font-mono text-xs">{folio.id}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
