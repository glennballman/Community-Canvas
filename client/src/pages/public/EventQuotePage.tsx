/**
 * Public Event Quote Page - A2.5
 * 
 * Anonymous lead capture form for customers at events.
 * No login required - creates a draft quote for contractor review.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressText: string;
  category: string;
  scopeSummary: string;
}

export default function EventQuotePage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    addressText: '',
    category: '',
    scopeSummary: '',
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest('POST', '/api/public/event/quote', data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: 'Submitted!', description: 'Your request has been sent.' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to submit. Please try again.', 
        variant: 'destructive' 
      });
    },
  });

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your name', variant: 'destructive' });
      return;
    }
    submitMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for your request. A contractor will review your information and be in touch soon.
            </p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2 pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Request a Quote
          </h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Tell us about your project and a local contractor will get back to you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Information</CardTitle>
            <CardDescription>
              We'll use this to get in touch with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Your Name *</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    placeholder="Your name"
                    required
                    data-testid="input-customer-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      id="customerPhone"
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => handleChange('customerPhone', e.target.value)}
                      placeholder="Phone number"
                      data-testid="input-customer-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      id="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => handleChange('customerEmail', e.target.value)}
                      placeholder="Email address"
                      data-testid="input-customer-email"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressText">Work Location</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    id="addressText"
                    value={formData.addressText}
                    onChange={(e) => handleChange('addressText', e.target.value)}
                    placeholder="Address or area"
                    data-testid="input-address"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Type of Work</Label>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="e.g., Landscaping, Plumbing, Roofing"
                    data-testid="input-category"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scopeSummary">Describe Your Project</Label>
                <Textarea
                  id="scopeSummary"
                  value={formData.scopeSummary}
                  onChange={(e) => handleChange('scopeSummary', e.target.value)}
                  placeholder="Tell us about what you need done..."
                  rows={4}
                  data-testid="input-scope-summary"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitMutation.isPending}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your information is secure and will only be shared with local contractors.
        </p>
      </div>
    </div>
  );
}
