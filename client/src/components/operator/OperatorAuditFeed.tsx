/**
 * OperatorAuditFeed - Expandable table display of operator audit events
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface AuditEvent {
  id: string;
  occurred_at: string;
  action_key: string;
  subject_type: string;
  subject_id: string;
  operator_individual_id?: string;
  payload?: Record<string, unknown>;
}

interface OperatorAuditFeedProps {
  items: AuditEvent[];
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasPayload = event.payload && Object.keys(event.payload).length > 0;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <>
        <TableRow data-testid={`row-audit-${event.id}`}>
          <TableCell className="w-8">
            {hasPayload && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`expand-audit-${event.id}`}>
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">
            {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="font-mono text-xs">
              {event.action_key}
            </Badge>
          </TableCell>
          <TableCell>{event.subject_type}</TableCell>
          <TableCell className="font-mono text-xs max-w-32 truncate">
            {event.subject_id}
          </TableCell>
          <TableCell className="font-mono text-xs max-w-32 truncate">
            {event.operator_individual_id || '-'}
          </TableCell>
        </TableRow>
        {hasPayload && (
          <CollapsibleContent asChild>
            <TableRow className="bg-muted/50">
              <TableCell colSpan={6} className="py-3">
                <div className="pl-8" data-testid={`payload-audit-${event.id}`}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Event Payload</p>
                  <pre className="text-xs bg-background p-3 rounded-md border overflow-auto max-h-48">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              </TableCell>
            </TableRow>
          </CollapsibleContent>
        )}
      </>
    </Collapsible>
  );
}

export function OperatorAuditFeed({ items }: OperatorAuditFeedProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="audit-empty">
        No audit events found
      </div>
    );
  }
  
  return (
    <Table data-testid="table-audit-feed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Subject Type</TableHead>
          <TableHead>Subject ID</TableHead>
          <TableHead>Operator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((event) => (
          <AuditEventRow key={event.id} event={event} />
        ))}
      </TableBody>
    </Table>
  );
}
