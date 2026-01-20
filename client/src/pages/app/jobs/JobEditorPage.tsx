import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Briefcase, ArrowLeft, Link as LinkIcon, Upload, FileText, Sparkles,
  Save, Eye, MapPin, DollarSign, Clock, Home, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Job, JobDetailResponse, createJob, updateJob,
  roleCategories, employmentTypes, payUnits, housingStatuses, workPermitSupports 
} from '@/lib/api/jobs';
import { AlertCircle, Loader2 } from 'lucide-react';

type InputMode = 'manual' | 'paste' | 'upload' | 'ai';

interface AIDraft {
  title?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
}

export default function JobEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Job>>({
    title: '',
    description: '',
    role_category: 'general_labour',
    employment_type: 'full_time',
    location_text: '',
    pay_min: null,
    pay_max: null,
    pay_unit: 'hourly',
    housing_provided: false,
    housing_status: 'unknown',
    housing_cost_min_cents: null,
    housing_cost_max_cents: null,
    work_permit_support: 'unknown',
    work_permit_conditions: null,
    start_date: null,
    end_date: null,
    season_window: '',
    qualifications_tags: [],
    schedule_tags: [],
    responsibilities: '',
    requirements: '',
    nice_to_have: '',
    hours_per_week: null,
    shift_details: '',
    is_flexible_dates: false,
    external_apply_url: '',
    status: 'open',
  });

  const { data: existingJob, isLoading } = useQuery<JobDetailResponse>({
    queryKey: ['/api/p2/app/jobs', id],
    enabled: !isNew,
  });

  useEffect(() => {
    if (existingJob?.job) {
      setFormData(existingJob.job);
    }
  }, [existingJob]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      if (isNew) {
        return createJob(data);
      }
      return updateJob(id!, data);
    },
    onSuccess: (result) => {
      toast({ title: isNew ? 'Job created' : 'Job saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/jobs'] });
      if (isNew && result.job?.id) {
        navigate(`/app/jobs/${result.job.id}/destinations`);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error saving job', 
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    if (!formData.title?.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(formData);
  };

  const updateField = <K extends keyof Job>(field: K, value: Job[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-job-editor">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/jobs')} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Briefcase className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{isNew ? 'Create Job' : 'Edit Job'}</h1>
      </div>

      <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="mb-6">
        <TabsList>
          <TabsTrigger value="manual" data-testid="tab-manual">
            <FileText className="h-4 w-4 mr-2" />
            Write Manually
          </TabsTrigger>
          <TabsTrigger value="paste" data-testid="tab-paste">
            <LinkIcon className="h-4 w-4 mr-2" />
            Paste Link
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Draft
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Paste a URL to an existing job listing and we'll extract the details.
              </p>
              <div className="flex gap-2">
                <Input placeholder="https://example.com/job/123" className="flex-1" />
                <Button disabled>Import</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Upload a screenshot, PDF, or image of a job posting.
              </p>
              <Button variant="outline" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Describe the role and let AI create a draft for you.
              </p>
              <Textarea 
                placeholder="We need a summer line cook for our busy restaurant..." 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                data-testid="input-ai-prompt"
              />
              {aiError && (
                <p className="text-sm text-destructive mt-2">{aiError}</p>
              )}
              <Button 
                className="mt-2" 
                disabled={aiLoading || !aiPrompt.trim()}
                onClick={async () => {
                  setAiLoading(true);
                  setAiError(null);
                  try {
                    const response = await fetch('/api/p2/ai/job-posting-draft', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        title: aiPrompt,
                        type: formData.employment_type,
                        location: formData.location_text,
                      }),
                    });
                    if (!response.ok) {
                      setAiError(`AI service error (${response.status})`);
                      setAiLoading(false);
                      return;
                    }
                    let data;
                    try {
                      data = await response.json();
                    } catch {
                      setAiError('Invalid response from AI service');
                      setAiLoading(false);
                      return;
                    }
                    if (data.ok && data.draft) {
                      setFormData(prev => ({
                        ...prev,
                        title: data.draft.title || prev.title,
                        description: data.draft.description || prev.description,
                        requirements: (data.draft.requirements || []).join('\n'),
                        nice_to_have: (data.draft.benefits || []).join('\n'),
                      }));
                      setInputMode('manual');
                      toast({ title: 'AI draft applied' });
                    } else {
                      setAiError(data.error?.message || 'Failed to generate draft');
                    }
                  } catch (e) {
                    setAiError('Failed to connect to AI service');
                  } finally {
                    setAiLoading(false);
                  }
                }}
                data-testid="button-generate-ai-draft"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {aiLoading ? 'Generating...' : 'Generate Draft'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={e => updateField('title', e.target.value)}
                  placeholder="e.g. Line Cook, Dock Attendant"
                  data-testid="input-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.role_category || 'general_labour'}
                    onValueChange={v => updateField('role_category', v)}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  <Select
                    value={formData.employment_type || 'full_time'}
                    onValueChange={v => updateField('employment_type', v)}
                  >
                    <SelectTrigger data-testid="select-employment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employmentTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={formData.location_text || ''}
                    onChange={e => updateField('location_text', e.target.value)}
                    placeholder="e.g. Bamfield, BC"
                    data-testid="input-location-text"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compensation</CardTitle>
              <CardDescription className="flex items-center gap-2 text-xs">
                <AlertCircle className="h-3 w-3" />
                Pay range, housing status, and work permit support are required for CanadaDirect and AdrenalineCanada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Pay Min</Label>
                    <span className="text-red-500 text-xs">*</span>
                  </div>
                  <Input
                    type="number"
                    value={formData.pay_min || ''}
                    onChange={e => updateField('pay_min', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="20"
                    data-testid="input-pay-min"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Pay Max</Label>
                    <span className="text-red-500 text-xs">*</span>
                  </div>
                  <Input
                    type="number"
                    value={formData.pay_max || ''}
                    onChange={e => updateField('pay_max', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="25"
                    data-testid="input-pay-max"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.pay_unit || 'hourly'}
                    onValueChange={v => updateField('pay_unit', v)}
                  >
                    <SelectTrigger data-testid="select-pay-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {payUnits.map(unit => (
                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="housing">Housing Provided</Label>
                </div>
                <Switch
                  id="housing"
                  checked={formData.housing_provided || false}
                  onCheckedChange={v => updateField('housing_provided', v)}
                  data-testid="switch-housing"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Housing Status</Label>
                  <Badge variant="outline" className="text-xs">Required for CanadaDirect/AdrenalineCanada</Badge>
                </div>
                <Select
                  value={formData.housing_status || 'unknown'}
                  onValueChange={v => updateField('housing_status', v)}
                >
                  <SelectTrigger data-testid="select-housing-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {housingStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.housing_status === 'unknown' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Select a housing status to publish on major portals
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Work Permit Support</Label>
                  <Badge variant="outline" className="text-xs">Required for CanadaDirect/AdrenalineCanada</Badge>
                </div>
                <Select
                  value={formData.work_permit_support || 'unknown'}
                  onValueChange={v => updateField('work_permit_support', v)}
                >
                  <SelectTrigger data-testid="select-work-permit-support">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workPermitSupports.map(support => (
                      <SelectItem key={support.value} value={support.value}>{support.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.work_permit_support === 'unknown' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Select work permit support to publish on major portals
                  </p>
                )}
                {formData.work_permit_support === 'yes_with_conditions' && (
                  <div className="space-y-1 mt-2">
                    <Label className="text-xs">Conditions (optional)</Label>
                    <Input
                      value={formData.work_permit_conditions || ''}
                      onChange={e => updateField('work_permit_conditions', e.target.value || null)}
                      placeholder="e.g. LMIA-approved positions only"
                      data-testid="input-work-permit-conditions"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={e => updateField('start_date', e.target.value || null)}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={e => updateField('end_date', e.target.value || null)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="flexible">Flexible Dates</Label>
                <Switch
                  id="flexible"
                  checked={formData.is_flexible_dates || false}
                  onCheckedChange={v => updateField('is_flexible_dates', v)}
                  data-testid="switch-flexible"
                />
              </div>

              <div className="space-y-2">
                <Label>Season Window</Label>
                <Input
                  value={formData.season_window || ''}
                  onChange={e => updateField('season_window', e.target.value)}
                  placeholder="e.g. May - September"
                  data-testid="input-season"
                />
              </div>

              <div className="space-y-2">
                <Label>Hours per Week</Label>
                <Input
                  type="number"
                  value={formData.hours_per_week || ''}
                  onChange={e => updateField('hours_per_week', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="40"
                  data-testid="input-hours"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Full Description</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Describe the role, team, and work environment..."
                  rows={6}
                  data-testid="textarea-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Responsibilities</Label>
                <Textarea
                  value={formData.responsibilities || ''}
                  onChange={e => updateField('responsibilities', e.target.value)}
                  placeholder="Key duties and responsibilities..."
                  rows={4}
                  data-testid="textarea-responsibilities"
                />
              </div>

              <div className="space-y-2">
                <Label>Requirements</Label>
                <Textarea
                  value={formData.requirements || ''}
                  onChange={e => updateField('requirements', e.target.value)}
                  placeholder="Required skills and experience..."
                  rows={4}
                  data-testid="textarea-requirements"
                />
              </div>

              <div className="space-y-2">
                <Label>Nice to Have</Label>
                <Textarea
                  value={formData.nice_to_have || ''}
                  onChange={e => updateField('nice_to_have', e.target.value)}
                  placeholder="Preferred but not required..."
                  rows={3}
                  data-testid="textarea-nice-to-have"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <h3 className="text-xl font-bold">{formData.title || 'Job Title'}</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.role_category && (
                    <Badge variant="secondary">
                      {roleCategories.find(c => c.value === formData.role_category)?.label}
                    </Badge>
                  )}
                  {formData.employment_type && (
                    <Badge variant="outline">
                      {employmentTypes.find(t => t.value === formData.employment_type)?.label}
                    </Badge>
                  )}
                  {formData.housing_provided && (
                    <Badge className="bg-green-600">Housing Included</Badge>
                  )}
                </div>
                {formData.location_text && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {formData.location_text}
                  </div>
                )}
                {(formData.pay_min || formData.pay_max) && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    {formData.pay_min && formData.pay_max 
                      ? `$${formData.pay_min} - $${formData.pay_max}`
                      : formData.pay_min 
                        ? `From $${formData.pay_min}`
                        : `Up to $${formData.pay_max}`
                    }
                    {formData.pay_unit && ` / ${payUnits.find(u => u.value === formData.pay_unit)?.label.toLowerCase()}`}
                  </div>
                )}
                {formData.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {formData.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={() => navigate('/app/jobs')}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          data-testid="button-save"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : isNew ? 'Create & Continue' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
