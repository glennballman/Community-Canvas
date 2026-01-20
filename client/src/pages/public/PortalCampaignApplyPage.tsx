import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Send, Check, Users, MapPin, Building2, FileText, Upload, X
} from 'lucide-react';
import { PortalBrandedShell } from './components/PortalBrandedShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CampaignApplyForm {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantLocation: string;
  housingNeeded: boolean;
  workPermitQuestion: string;
  message: string;
  consentGiven: boolean;
}

interface AppliedJob {
  jobId: string;
  title: string;
}

export default function PortalCampaignApplyPage() {
  const { portalSlug, campaignKey } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState<CampaignApplyForm>({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    applicantLocation: '',
    housingNeeded: false,
    workPermitQuestion: '',
    message: '',
    consentGiven: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);

  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['/api/p2/public/jobs/campaigns', portalSlug],
    queryFn: async () => {
      const res = await fetch(`/api/p2/public/b/${portalSlug}/jobs/campaigns`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
  });

  const campaign = (campaignsData as any)?.campaigns?.find(
    (c: any) => c.key === campaignKey
  );

  const submitMutation = useMutation({
    mutationFn: async (data: CampaignApplyForm) => {
      const res = await apiRequest('POST', `/api/p2/public/b/${portalSlug}/jobs/campaign-apply`, {
        campaignKey,
        ...data,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      setSubmitted(true);
      setAppliedJobs(result.appliedJobs || []);
      toast({ title: `Application sent to ${result.appliedCount} employers!` });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to submit application', 
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.applicantName.trim() || !formData.applicantEmail.trim()) {
      toast({ 
        title: 'Required fields missing', 
        description: 'Please enter your name and email',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.consentGiven) {
      toast({ 
        title: 'Consent required', 
        description: 'Please confirm you want to send your application to multiple employers',
        variant: 'destructive'
      });
      return;
    }

    submitMutation.mutate(formData);
  };

  const updateField = <K extends keyof CampaignApplyForm>(field: K, value: CampaignApplyForm[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <PortalBrandedShell
        portalSlug={portalSlug}
        backHref={`/b/${portalSlug}/jobs`}
        backLabel="Back to Jobs"
      >
        <div className="container mx-auto max-w-2xl space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PortalBrandedShell>
    );
  }

  if (submitted) {
    return (
      <PortalBrandedShell
        portalSlug={portalSlug}
        backHref={`/b/${portalSlug}/jobs`}
        backLabel="Back to Jobs"
      >
        <div data-testid="page-campaign-apply-success" className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">Application Submitted!</CardTitle>
              <CardDescription className="text-base">
                Your application has been sent to {appliedJobs.length} employer{appliedJobs.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">Applied to:</h3>
                <div className="space-y-2">
                  {appliedJobs.map((job, i) => (
                    <div 
                      key={job.jobId} 
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                      data-testid={`applied-job-${i}`}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                      <span>{job.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button asChild data-testid="button-view-jobs">
                  <Link to={`/b/${portalSlug}/jobs`}>View Other Roles</Link>
                </Button>
                <Button variant="outline" asChild data-testid="button-home">
                  <Link to={`/p/${portalSlug}`}>Back to Portal</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PortalBrandedShell>
    );
  }

  return (
    <PortalBrandedShell
      portalSlug={portalSlug}
      backHref={`/b/${portalSlug}/jobs`}
      backLabel="Back to Jobs"
    >
      <div data-testid="page-campaign-apply" className="container mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">{campaign?.name || 'Apply to Multiple Roles'}</h1>
            {campaign?.jobCount && (
              <p className="text-sm text-muted-foreground">
                Apply to {campaign.jobCount} position{campaign.jobCount !== 1 ? 's' : ''} at once
              </p>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Information
              </CardTitle>
              <CardDescription>
                This information will be shared with employers in this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.applicantName}
                    onChange={(e) => updateField('applicantName', e.target.value)}
                    placeholder="Your full name"
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.applicantEmail}
                    onChange={(e) => updateField('applicantEmail', e.target.value)}
                    placeholder="your@email.com"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.applicantPhone}
                    onChange={(e) => updateField('applicantPhone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Current Location</Label>
                  <Input
                    id="location"
                    value={formData.applicantLocation}
                    onChange={(e) => updateField('applicantLocation', e.target.value)}
                    placeholder="City, Province/Country"
                    data-testid="input-location"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="housing"
                  checked={formData.housingNeeded}
                  onCheckedChange={(checked) => updateField('housingNeeded', checked === true)}
                  data-testid="checkbox-housing"
                />
                <Label htmlFor="housing" className="cursor-pointer">
                  I need housing / accommodation assistance
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workPermit">Work Permit Status (optional)</Label>
                <Input
                  id="workPermit"
                  value={formData.workPermitQuestion}
                  onChange={(e) => updateField('workPermitQuestion', e.target.value)}
                  placeholder="e.g., Citizen, PR, Work Permit, Seeking sponsorship..."
                  data-testid="input-work-permit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message to Employers (optional)</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => updateField('message', e.target.value)}
                  placeholder="Tell employers about yourself, your experience, and availability..."
                  className="min-h-[100px]"
                  data-testid="textarea-message"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={formData.consentGiven}
                  onCheckedChange={(checked) => updateField('consentGiven', checked === true)}
                  data-testid="checkbox-consent"
                />
                <Label htmlFor="consent" className="cursor-pointer text-sm leading-relaxed">
                  I understand and consent to sending my application and contact information 
                  to multiple employers participating in this campaign. Employers may contact 
                  me directly about their job opportunities.
                </Label>
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={submitMutation.isPending || !formData.consentGiven}
            data-testid="button-submit"
          >
            {submitMutation.isPending ? (
              <>Sending Applications...</>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Send Application to {campaign?.jobCount || 'All'} Employers
              </>
            )}
          </Button>
        </form>
      </div>
    </PortalBrandedShell>
  );
}
