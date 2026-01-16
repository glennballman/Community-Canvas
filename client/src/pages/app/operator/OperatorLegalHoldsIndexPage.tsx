/**
 * OperatorLegalHoldsIndexPage - Legal holds index
 * Route: /app/operator/legal
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Scale, Info } from 'lucide-react';
import { OperatorActionPanel } from '@/components/operator/OperatorActionPanel';
import { OperatorIdOpenCard } from '@/components/operator/OperatorIdOpenCard';
import { useCreateLegalHold } from '@/lib/api/operatorP2/useCreateLegalHold';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

const HOLD_TYPES = [
  { value: 'litigation', label: 'Litigation' },
  { value: 'class_action', label: 'Class Action' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'dispute', label: 'Dispute' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'other', label: 'Other' },
];

export default function OperatorLegalHoldsIndexPage() {
  const navigate = useNavigate();
  const createLegalHold = useCreateLegalHold();
  
  const [holdType, setHoldType] = useState<string>('litigation');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-legal');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleCreateHold = async () => {
    const result = await createLegalHold.mutateAsync({
      hold_type: holdType as any,
      title: title || undefined,
      reason: reason || undefined,
    });
    navigate(`/app/operator/legal/${result.holdId}`);
    return result;
  };
  
  const handleOpenHold = (holdId: string) => {
    navigate(`/app/operator/legal/${holdId}`);
  };
  
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/app/operator">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Scale className="h-6 w-6" />
            Legal Holds
          </h1>
          <p className="text-muted-foreground text-sm">
            Create and manage legal hold containers
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OperatorActionPanel
          title="Create Legal Hold"
          description="Start a new legal hold container"
          actionLabel="Create Hold"
          onAction={handleCreateHold}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hold Type</label>
              <Select value={holdType} onValueChange={setHoldType}>
                <SelectTrigger data-testid="select-hold-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {HOLD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Hold title"
                data-testid="input-hold-title"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for legal hold (optional)"
                rows={3}
                data-testid="textarea-hold-reason"
              />
            </div>
          </div>
        </OperatorActionPanel>
        
        <OperatorIdOpenCard
          label="Open Existing Hold"
          description="Navigate to an existing legal hold by ID"
          placeholder="Enter hold UUID"
          onOpen={handleOpenHold}
        />
      </div>
      
      <Separator />
      
      <Card data-testid="card-info">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About Legal Holds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Legal holds preserve evidence and prevent deletion of records subject to 
            litigation, regulatory inquiry, or dispute resolution. Once created, add 
            targets (evidence bundles, emergency runs, claims, etc.) to the hold.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
