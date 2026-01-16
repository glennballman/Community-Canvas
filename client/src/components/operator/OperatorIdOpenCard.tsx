/**
 * OperatorIdOpenCard - Reusable card for navigating by ID
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export interface OperatorIdOpenCardProps {
  label: string;
  placeholder?: string;
  description?: string;
  onOpen: (id: string) => void;
}

export function OperatorIdOpenCard({
  label,
  placeholder = 'Enter UUID',
  description,
  onOpen,
}: OperatorIdOpenCardProps) {
  const [idValue, setIdValue] = useState('');

  const handleOpen = () => {
    const trimmedId = idValue.trim();
    if (trimmedId) {
      onOpen(trimmedId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOpen();
    }
  };

  return (
    <Card data-testid="card-id-open">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          {label}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={idValue}
          onChange={(e) => setIdValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          data-testid="input-id-value"
        />
        <Button
          onClick={handleOpen}
          disabled={!idValue.trim()}
          data-testid="button-open-id"
        >
          Open
        </Button>
      </CardContent>
    </Card>
  );
}
