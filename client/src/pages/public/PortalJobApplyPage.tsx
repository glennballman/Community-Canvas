import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Briefcase, Upload, Send, Check, File, X
} from 'lucide-react';
import { PortalBrandedShell } from './components/PortalBrandedShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ApplicationForm {
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  cover_letter: string;
  resume_file_id: string | null;
}

export default function PortalJobApplyPage() {
  const { portalSlug, postingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState<ApplicationForm>({
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    cover_letter: '',
    resume_file_id: null,
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: jobData, isLoading: jobLoading } = useQuery({
    queryKey: ['/api/p2/public/jobs', portalSlug, postingId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/public/jobs/${portalSlug}/${postingId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ApplicationForm) => {
      const res = await apiRequest('POST', `/api/p2/public/jobs/${portalSlug}/${postingId}/apply`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Application submitted successfully!' });
      navigate(`/b/${portalSlug}/jobs/${postingId}?applied=true`);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to submit application', 
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'File too large', 
        description: 'Resume must be less than 5MB',
        variant: 'destructive'
      });
      return;
    }

    setResumeFile(file);
    setIsUploading(true);

    try {
      const tokenRes = await fetch(`/api/p2/public/jobs/${portalSlug}/${postingId}/upload-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          size_bytes: file.size
        }),
      });
      
      if (!tokenRes.ok) throw new Error('Failed to get upload session');
      
      const { session_token, upload_url } = await tokenRes.json();
      
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('session_token', session_token);
      
      const uploadRes = await fetch(upload_url || `/api/p2/public/jobs/${portalSlug}/${postingId}/upload-resume`, {
        method: 'POST',
        body: uploadFormData,
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      
      const result = await uploadRes.json();
      setFormData(prev => ({ ...prev, resume_file_id: result.file_id }));
      toast({ title: 'Resume uploaded' });
    } catch (error) {
      toast({ 
        title: 'Upload failed', 
        description: 'Please try again',
        variant: 'destructive'
      });
      setResumeFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    setFormData(prev => ({ ...prev, resume_file_id: null }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.applicant_name.trim() || !formData.applicant_email.trim()) {
      toast({ 
        title: 'Required fields missing', 
        description: 'Please enter your name and email',
        variant: 'destructive'
      });
      return;
    }

    submitMutation.mutate(formData);
  };

  const updateField = (field: keyof ApplicationForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (jobLoading) {
    return (
      <PortalBrandedShell
        portalSlug={portalSlug}
        backHref={`/b/${portalSlug}/jobs/${postingId}`}
        backLabel="Back to Job"
      >
        <div className="container mx-auto max-w-2xl space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PortalBrandedShell>
    );
  }

  const job = (jobData as any)?.job;

  return (
    <PortalBrandedShell
      portalSlug={portalSlug}
      backHref={`/b/${portalSlug}/jobs/${postingId}`}
      backLabel="Back to Job"
    >
      <div data-testid="page-job-apply" className="container mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Apply for {job?.title || 'Job'}</h1>
            <p className="text-sm text-muted-foreground">
              {job?.brand_name_snapshot || 'Employer'}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Your Application</CardTitle>
              <CardDescription>
                Fill out the form below to apply for this position
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.applicant_name}
                    onChange={e => updateField('applicant_name', e.target.value)}
                    placeholder="Jane Smith"
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.applicant_email}
                    onChange={e => updateField('applicant_email', e.target.value)}
                    placeholder="jane@example.com"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.applicant_phone}
                  onChange={e => updateField('applicant_phone', e.target.value)}
                  placeholder="250-555-0123"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label>Resume</Label>
                {resumeFile ? (
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <File className="h-5 w-5 text-primary" />
                    <span className="flex-1 truncate">{resumeFile.name}</span>
                    {formData.resume_file_id ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : isUploading ? (
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    ) : null}
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon"
                      onClick={handleRemoveFile}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload your resume (PDF, DOC, DOCX)
                    </p>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      id="resume-upload"
                      data-testid="input-file"
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      asChild
                    >
                      <label htmlFor="resume-upload" className="cursor-pointer" data-testid="button-upload">
                        Choose File
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cover">Cover Letter / Message</Label>
                <Textarea
                  id="cover"
                  value={formData.cover_letter}
                  onChange={e => updateField('cover_letter', e.target.value)}
                  placeholder="Tell us why you're interested in this position..."
                  rows={6}
                  data-testid="textarea-cover-letter"
                />
              </div>

              <Button 
                type="submit"
                size="lg" 
                className="w-full"
                disabled={submitMutation.isPending || isUploading}
                data-testid="button-submit"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit Application'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By submitting, you agree to share your information with the employer.
              </p>
            </CardContent>
          </Card>
        </form>
      </div>
    </PortalBrandedShell>
  );
}
