import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Clock, DollarSign, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function CreateProject() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'new';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contact_name: '',
    property_address: '',
    quoted_amount: '',
    status: mode === 'completed' ? 'completed' : 'lead',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
      };
      if (formData.quoted_amount) {
        payload.quoted_amount = parseFloat(formData.quoted_amount);
      }
      if (mode === 'completed') {
        payload.completed_at = new Date().toISOString();
        if (formData.quoted_amount) {
          payload.approved_amount = parseFloat(formData.quoted_amount);
          payload.invoiced_amount = parseFloat(formData.quoted_amount);
          payload.paid_amount = parseFloat(formData.quoted_amount);
          payload.status = 'paid';
        }
      }
      const res = await apiRequest('POST', '/api/projects', payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Project created', description: mode === 'completed' ? 'Past job recorded' : 'New project started' });
      navigate(`/app/projects/${data.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'Project title is required', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  const isBackwardsEntry = mode === 'completed';

  return (
    <div className="flex-1 p-4 max-w-2xl mx-auto" data-testid="page-create-project">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/projects')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">
            {isBackwardsEntry ? 'Record Past Job' : 'New Project'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBackwardsEntry ? 'I already did this job - record it for history' : 'Start tracking a new job'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isBackwardsEntry && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Type</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={formData.status} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                className="grid grid-cols-2 gap-4"
              >
                <Label 
                  htmlFor="status-lead" 
                  className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                    formData.status === 'lead' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <RadioGroupItem value="lead" id="status-lead" data-testid="radio-status-lead" />
                  <div>
                    <p className="font-medium">Lead</p>
                    <p className="text-sm text-muted-foreground">Potential job, not quoted yet</p>
                  </div>
                </Label>
                <Label 
                  htmlFor="status-quote" 
                  className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                    formData.status === 'quote' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <RadioGroupItem value="quote" id="status-quote" data-testid="radio-status-quote" />
                  <div>
                    <p className="font-medium">Quote</p>
                    <p className="text-sm text-muted-foreground">Quote sent, awaiting approval</p>
                  </div>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title / Description*</Label>
              <Input
                id="title"
                placeholder="e.g., Kitchen renovation, Roof repair, Lawn maintenance"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-title"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes (optional)</Label>
              <Textarea
                id="description"
                placeholder="Any additional details about the job..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                data-testid="textarea-description"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Amount
            </CardTitle>
            <CardDescription>
              {isBackwardsEntry 
                ? 'How much did you charge for this job?' 
                : 'Single total amount - you can add line items later if needed'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="quoted_amount">
                {isBackwardsEntry ? 'Amount Charged' : 'Quoted Amount'} (optional)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="quoted_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.quoted_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, quoted_amount: e.target.value }))}
                  className="pl-7"
                  data-testid="input-amount"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer (optional)
            </CardTitle>
            <CardDescription>
              You can add or link customer details later
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Customer Name</Label>
              <Input
                id="contact_name"
                placeholder="Customer name"
                value={formData.contact_name}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                data-testid="input-contact-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property_address">Job Site Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="property_address"
                  placeholder="123 Main St, City, BC"
                  value={formData.property_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, property_address: e.target.value }))}
                  className="pl-9"
                  data-testid="input-address"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/app/projects')} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
            {createMutation.isPending 
              ? 'Creating...' 
              : isBackwardsEntry 
                ? 'Record Job' 
                : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
