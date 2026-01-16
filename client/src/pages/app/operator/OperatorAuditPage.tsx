/**
 * OperatorAuditPage - View all operator audit events
 * Route: /app/operator/audit
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ClipboardList, ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useOperatorAuditEvents } from '@/lib/api/operatorP2/useOperatorAuditEvents';
import { OperatorErrorAlert } from '@/components/operator/OperatorErrorAlert';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

export default function OperatorAuditPage() {
  const auditQuery = useOperatorAuditEvents(100);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-audit');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  return (
    <div className="p-6 space-y-6" data-testid="page-operator-audit">
      <div className="flex items-center gap-4">
        <Link to="/app/operator">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-muted-foreground text-sm">All operator actions</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => auditQuery.refetch()}
          disabled={auditQuery.isRefetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${auditQuery.isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {auditQuery.error && (
        <OperatorErrorAlert error={(auditQuery.error as Error).message} />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operator Events</CardTitle>
          <CardDescription>
            {auditQuery.data?.length || 0} events (latest first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditQuery.isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Loading events...</p>
          ) : !auditQuery.data || auditQuery.data.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No audit events found</p>
          ) : (
            <Table data-testid="table-audit">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Subject Type</TableHead>
                  <TableHead>Subject ID</TableHead>
                  <TableHead>Operator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.data.map((event) => (
                  <Collapsible key={event.id} asChild>
                    <>
                      <TableRow data-testid={`row-event-${event.id}`}>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleRow(event.id)}
                              data-testid={`button-expand-${event.id}`}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  expandedRows.has(event.id) ? 'rotate-180' : ''
                                }`}
                              />
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                          </div>
                          <div className="text-xs text-muted-foreground/60">
                            {format(new Date(event.occurred_at), 'PPpp')}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{event.action_key}</TableCell>
                        <TableCell>{event.subject_type}</TableCell>
                        <TableCell className="font-mono text-xs max-w-40 truncate">
                          {event.subject_id}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-32 truncate">
                          {event.operator_individual_id || '-'}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6}>
                            <div className="p-4">
                              <h4 className="text-sm font-medium mb-2">Payload</h4>
                              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                                {JSON.stringify(event.payload, null, 2) || 'null'}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
