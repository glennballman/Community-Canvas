/**
 * OperatorAuditFeed - Table display of operator audit events
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';

interface AuditEvent {
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
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Subject Type</TableHead>
          <TableHead>Subject ID</TableHead>
          <TableHead>Operator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((event) => (
          <TableRow key={event.id} data-testid={`row-audit-${event.id}`}>
            <TableCell className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
            </TableCell>
            <TableCell className="font-mono text-sm">{event.action_key}</TableCell>
            <TableCell>{event.subject_type}</TableCell>
            <TableCell className="font-mono text-xs max-w-32 truncate">
              {event.subject_id}
            </TableCell>
            <TableCell className="font-mono text-xs max-w-32 truncate">
              {event.operator_individual_id || '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
