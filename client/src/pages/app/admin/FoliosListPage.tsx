/**
 * Folios List Page - P-UI-17
 * Route: /app/admin/folios
 * 
 * Read-only view of all folios for the tenant
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Wallet, Search, ChevronRight, DollarSign, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface FolioSummary {
  id: string;
  folio_number: string;
  status: string;
  guest_name: string;
  guest_email: string;
  total_charges_cents: number;
  total_payments_cents: number;
  balance_due_cents: number;
  check_in_date: string | null;
  check_out_date: string | null;
  created_at: string;
}

interface FolioStats {
  total_folios: number;
  open_folios: number;
  total_receivable_cents: number;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  void: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100);
}

export default function FoliosListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: foliosData, isLoading } = useQuery<{ ok: boolean; folios: FolioSummary[]; total: number; limit: number; offset: number }>({
    queryKey: ['/api/p2/folios', { status: statusFilter !== 'all' ? statusFilter : undefined, search: searchTerm || undefined, limit, offset: (page - 1) * limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      params.set('limit', limit.toString());
      params.set('offset', ((page - 1) * limit).toString());
      const res = await fetch(`/api/p2/folios?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch folios');
      return res.json();
    },
  });

  const { data: statsData } = useQuery<{ ok: boolean; stats: FolioStats }>({
    queryKey: ['/api/p2/folios/stats'],
  });

  const folios = foliosData?.folios ?? [];
  const total = foliosData?.total ?? 0;
  const stats = statsData?.stats;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6" data-testid="page-folios-list">
      <div className="flex items-center gap-3">
        <Wallet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Folios</h1>
          <p className="text-muted-foreground">View guest folios and ledger balances</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Folios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-folios">{stats.total_folios}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Open Folios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-open-folios">{stats.open_folios}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Accounts Receivable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-receivable">
                {formatCents(stats.total_receivable_cents)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Folios</CardTitle>
          <CardDescription>Read-only view of folio records and balances</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by folio number, guest name, or email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-9"
                data-testid="input-search-folios"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading folios...</div>
          ) : folios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No folios found</div>
          ) : (
            <div className="space-y-2">
              {folios.map(folio => (
                <Link key={folio.id} href={`/app/admin/folios/${folio.id}`}>
                  <div
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate cursor-pointer"
                    data-testid={`folio-row-${folio.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">{folio.folio_number}</div>
                        <div className="text-sm text-muted-foreground">{folio.guest_name || folio.guest_email || 'No guest'}</div>
                      </div>
                      <Badge className={statusColors[folio.status] || ''}>
                        {folio.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Charges</div>
                        <div className="font-medium">{formatCents(folio.total_charges_cents)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Payments</div>
                        <div className="font-medium text-green-600">{formatCents(folio.total_payments_cents)}</div>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-sm text-muted-foreground">Balance</div>
                        <div className={`font-bold ${folio.balance_due_cents > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCents(folio.balance_due_cents)}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
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
    </div>
  );
}
