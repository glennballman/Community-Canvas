/**
 * OperatorErrorAlert - Displays error messages from P2 operations
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface OperatorErrorAlertProps {
  error?: string | null;
}

export function OperatorErrorAlert({ error }: OperatorErrorAlertProps) {
  if (!error) return null;
  
  return (
    <Alert variant="destructive" data-testid="alert-operator-error">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
