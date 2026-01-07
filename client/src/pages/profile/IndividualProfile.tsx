import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  User, FileText, Award, Wrench, ClipboardCheck, CreditCard,
  CheckCircle, AlertCircle, MapPin, Phone, Shield,
  Sailboat, Car, Package, Plus, Loader2
} from 'lucide-react';

interface Individual {
  id: string | null;
  fullName: string;
  preferredName: string;
  email: string;
  telephone: string;
  telephoneVerified: boolean;
  emailVerified: boolean;
  photoUrl: string;
  homeCountry: string;
  homeRegion: string;
  currentCommunity: string | null;
  languages: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  profileScore: number;
}

interface Document {
  id: string;
  documentType: string;
  documentNumber: string;
  issuingAuthority: string;
  expiresAt: string | null;
  verified: boolean;
  isExpired: boolean;
}

interface Waiver {
  id: string;
  templateSlug: string;
  templateName: string;
  activityTypes: string[];
  signedAt: string;
  expiresAt: string;
  isExpired: boolean;
}

interface Skill {
  id: string;
  skillId: string;
  skillName: string;
  category: string;
  proficiencyLevel: string;
  yearsExperience: number | null;
  verified: boolean;
}

interface PersonalTool {
  id: string;
  toolId: string;
  toolName: string;
  category: string;
  currentLocation: string;
  currentCommunity: string | null;
  condition: string;
  availableForRent: boolean;
  rentalRateDaily: number | null;
}

interface PaymentMethod {
  id: string;
  paymentType: string;
  displayName: string;
  lastFour: string;
  brand: string;
  isDefault: boolean;
  isExpired: boolean;
}

interface AvailableSkill {
  id: string;
  name: string;
  slug: string;
  category: string;
  certification_required: boolean;
}

interface AvailableTool {
  id: string;
  name: string;
  slug: string;
  category: string;
  typical_daily_rental: number | null;
}

interface Community {
  id: string;
  name: string;
  region: string;
}

function formatDocumentType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function IndividualProfile() {
  const { token, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [individual, setIndividual] = useState<Individual | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tools, setTools] = useState<PersonalTool[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [saving, setSaving] = useState(false);

  // Add Skill form state
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState('competent');
  const [yearsExperience, setYearsExperience] = useState('');

  // Add Tool form state
  const [selectedToolId, setSelectedToolId] = useState('');
  const [toolCondition, setToolCondition] = useState('good');
  const [toolLocation, setToolLocation] = useState('');
  const [toolCommunityId, setToolCommunityId] = useState('');
  const [availableForRent, setAvailableForRent] = useState(false);
  const [rentalRateDaily, setRentalRateDaily] = useState('');

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/individuals/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to load profile');
      }
      
      const data = await res.json();
      if (data.success) {
        setIndividual(data.individual);
        setDocuments(data.documents || []);
        setWaivers(data.waivers || []);
        setSkills(data.skills || []);
        setTools(data.tools || []);
        setPayments(data.paymentMethods || []);
      } else {
        setError(data.message || 'Failed to load profile');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [skillsRes, toolsRes, communitiesRes] = await Promise.all([
        fetch('/api/individuals/skills'),
        fetch('/api/individuals/tools'),
        fetch('/api/individuals/communities')
      ]);
      
      const [skillsData, toolsData, communitiesData] = await Promise.all([
        skillsRes.json(),
        toolsRes.json(),
        communitiesRes.json()
      ]);
      
      if (skillsData.success) setAvailableSkills(skillsData.skills);
      if (toolsData.success) setAvailableTools(toolsData.tools);
      if (communitiesData.success) setCommunities(communitiesData.communities);
    } catch (err) {
      console.error('Error loading reference data:', err);
    }
  }, []);

  useEffect(() => {
    if (token && !authLoading) {
      loadProfile();
      loadReferenceData();
    }
  }, [token, authLoading, loadProfile, loadReferenceData]);

  const handleAddSkill = async () => {
    if (!selectedSkillId || !token) return;
    
    const parsedYears = yearsExperience ? parseInt(yearsExperience, 10) : null;
    if (yearsExperience && (isNaN(parsedYears!) || parsedYears! < 0)) {
      toast({ title: 'Please enter a valid number for years of experience', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    
    try {
      const res = await fetch('/api/individuals/my-skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          skillId: selectedSkillId,
          proficiencyLevel,
          yearsExperience: parsedYears
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Skill added successfully' });
        setShowAddSkillModal(false);
        resetSkillForm();
        loadProfile();
      } else {
        toast({ title: 'Failed to add skill', description: data.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error adding skill', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTool = async () => {
    if (!selectedToolId || !token) return;
    
    let parsedRate: number | null = null;
    if (availableForRent && rentalRateDaily) {
      parsedRate = parseFloat(rentalRateDaily);
      if (isNaN(parsedRate) || parsedRate < 0) {
        toast({ title: 'Please enter a valid rental rate', variant: 'destructive' });
        return;
      }
    }
    
    setSaving(true);
    
    try {
      const res = await fetch('/api/individuals/my-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          toolId: selectedToolId,
          condition: toolCondition,
          currentLocation: toolLocation,
          currentCommunityId: toolCommunityId || null,
          availableForRent,
          rentalRateDaily: parsedRate
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Tool added successfully' });
        setShowAddToolModal(false);
        resetToolForm();
        loadProfile();
      } else {
        toast({ title: 'Failed to add tool', description: data.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error adding tool', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetSkillForm = () => {
    setSelectedSkillId('');
    setProficiencyLevel('competent');
    setYearsExperience('');
  };

  const resetToolForm = () => {
    setSelectedToolId('');
    setToolCondition('good');
    setToolLocation('');
    setToolCommunityId('');
    setAvailableForRent(false);
    setRentalRateDaily('');
  };

  // Filter out skills already added
  const filteredAvailableSkills = availableSkills.filter(
    s => !skills.some(existing => existing.skillId === s.id)
  );

  // Filter out tools already added
  const filteredAvailableTools = availableTools.filter(
    t => !tools.some(existing => existing.toolId === t.id)
  );

  const profileComplete = individual?.profileScore || 0;
  const missingItems: string[] = [];
  if (!individual?.telephoneVerified) missingItems.push('Verify phone');
  if (documents.filter(d => d.documentType === 'photo_id' && d.verified).length === 0 &&
      documents.filter(d => d.documentType === 'drivers_license' && d.verified).length === 0) {
    missingItems.push('Add photo ID');
  }
  if (payments.filter(p => !p.isExpired).length === 0) missingItems.push('Add payment method');
  if (waivers.filter(w => !w.isExpired).length === 0) missingItems.push('Sign waiver');

  if (authLoading || loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full" data-testid="profile-loading">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4" data-testid="profile-error">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadProfile} data-testid="button-retry">Retry</Button>
      </div>
    );
  }

  if (!individual) {
    return (
      <div className="p-6 flex items-center justify-center h-full" data-testid="profile-not-found">
        <div className="text-muted-foreground">Unable to load profile</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="profile-container">
      {/* Header Card */}
      <Card data-testid="card-profile-header">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-24 h-24" data-testid="avatar-profile">
              <AvatarImage src={individual.photoUrl} alt={individual.fullName} />
              <AvatarFallback className="text-2xl">
                {individual.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold" data-testid="text-profile-name">
                {individual.fullName || 'Complete Your Profile'}
              </h1>
              <p className="text-muted-foreground" data-testid="text-profile-email">{individual.email}</p>
              
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {individual.emailVerified && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30" data-testid="badge-email-verified">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Email Verified
                  </Badge>
                )}
                {individual.telephoneVerified && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30" data-testid="badge-phone-verified">
                    <Phone className="w-3 h-3 mr-1" />
                    Phone Verified
                  </Badge>
                )}
                {individual.currentCommunity && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30" data-testid="badge-location">
                    <MapPin className="w-3 h-3 mr-1" />
                    {individual.currentCommunity}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="text-right" data-testid="profile-score-container">
              <div className="text-3xl font-bold" data-testid="text-profile-score">{profileComplete}%</div>
              <div className="text-sm text-muted-foreground">Profile Complete</div>
              <Progress value={profileComplete} className="w-32 mt-2" data-testid="progress-profile" />
            </div>
          </div>
          
          {missingItems.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg" data-testid="alert-missing-items">
              <div className="text-yellow-500 text-sm font-medium mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Complete your profile to unlock all features:
              </div>
              <div className="flex flex-wrap gap-2">
                {missingItems.map(item => (
                  <Badge key={item} variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30" data-testid={`badge-missing-${item.toLowerCase().replace(/\s+/g, '-')}`}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4" data-testid="stats-container">
        <Card data-testid="stat-documents">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold" data-testid="count-documents">{documents.length}</div>
            <div className="text-sm text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-waivers">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold" data-testid="count-waivers">{waivers.filter(w => !w.isExpired).length}</div>
            <div className="text-sm text-muted-foreground">Valid Waivers</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-skills">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold" data-testid="count-skills">{skills.length}</div>
            <div className="text-sm text-muted-foreground">Skills</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-tools">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold" data-testid="count-tools">{tools.length}</div>
            <div className="text-sm text-muted-foreground">Personal Tools</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-payments">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold" data-testid="count-payments">{payments.filter(p => !p.isExpired).length}</div>
            <div className="text-sm text-muted-foreground">Payment Methods</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card data-testid="card-profile-tabs">
        <Tabs defaultValue="overview">
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <User className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="skills" data-testid="tab-skills">
                <Award className="w-4 h-4 mr-2" />
                Skills
              </TabsTrigger>
              <TabsTrigger value="tools" data-testid="tab-tools">
                <Wrench className="w-4 h-4 mr-2" />
                My Tools
              </TabsTrigger>
              <TabsTrigger value="waivers" data-testid="tab-waivers">
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Waivers
              </TabsTrigger>
              <TabsTrigger value="payments" data-testid="tab-payments">
                <CreditCard className="w-4 h-4 mr-2" />
                Payments
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-0" data-testid="panel-overview">
              <h2 className="text-lg font-semibold">Profile Overview</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" data-testid="button-rent-equipment">
                  <Sailboat className="w-5 h-5 text-blue-500" />
                  <div className="font-medium">Rent Equipment</div>
                  <div className="text-sm text-muted-foreground">Kayaks, ATVs, tools</div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" data-testid="button-find-work">
                  <Wrench className="w-5 h-5 text-green-500" />
                  <div className="font-medium">Find Work</div>
                  <div className="text-sm text-muted-foreground">Browse service runs</div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" data-testid="button-my-bookings">
                  <Package className="w-5 h-5 text-purple-500" />
                  <div className="font-medium">My Bookings</div>
                  <div className="text-sm text-muted-foreground">Rentals & reservations</div>
                </Button>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Your Capabilities Summary</h3>
                <Card className="bg-muted/50" data-testid="card-capabilities">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Top Skills</div>
                        {skills.slice(0, 3).map(s => (
                          <div key={s.id} className="flex items-center gap-2 mb-1" data-testid={`skill-item-${s.id}`}>
                            <span>{s.skillName}</span>
                            <span className="text-xs text-muted-foreground">({s.proficiencyLevel})</span>
                            {s.verified && <CheckCircle className="w-3 h-3 text-green-500" />}
                          </div>
                        ))}
                        {skills.length === 0 && (
                          <div className="text-muted-foreground text-sm">No skills added yet</div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Your Tools</div>
                        {tools.slice(0, 3).map(t => (
                          <div key={t.id} className="flex items-center gap-2 mb-1" data-testid={`tool-item-${t.id}`}>
                            <span>{t.toolName}</span>
                            {t.currentCommunity && (
                              <span className="text-xs text-muted-foreground">({t.currentCommunity})</span>
                            )}
                          </div>
                        ))}
                        {tools.length === 0 && (
                          <div className="text-muted-foreground text-sm">No tools registered yet</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="mt-0" data-testid="panel-skills">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">My Skills</h2>
                <Button onClick={() => setShowAddSkillModal(true)} data-testid="button-add-skill">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Skill
                </Button>
              </div>
              
              <div className="space-y-3">
                {skills.map(skill => (
                  <Card key={skill.id} className="bg-muted/50" data-testid={`card-skill-${skill.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{skill.skillName}</span>
                          {skill.verified && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {skill.category} - {skill.proficiencyLevel}
                          {skill.yearsExperience && ` - ${skill.yearsExperience} years`}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" data-testid={`button-edit-skill-${skill.id}`}>Edit</Button>
                    </CardContent>
                  </Card>
                ))}
                
                {skills.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-skills">
                    No skills added yet. Add your skills to get matched with jobs!
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="mt-0" data-testid="panel-tools">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">My Personal Tools</h2>
                <Button onClick={() => setShowAddToolModal(true)} data-testid="button-add-tool">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tool
                </Button>
              </div>
              
              <div className="space-y-3">
                {tools.map(tool => (
                  <Card key={tool.id} className="bg-muted/50" data-testid={`card-tool-${tool.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tool.toolName}</span>
                          <Badge variant="outline" className={
                            tool.condition === 'excellent' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                            tool.condition === 'good' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                            'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                          }>
                            {tool.condition}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {tool.currentLocation || tool.currentCommunity || 'Location not set'}
                        </div>
                      </div>
                      <div className="text-right">
                        {tool.availableForRent ? (
                          <div>
                            <div className="text-green-500 text-sm">Available for rent</div>
                            <div className="font-medium">${tool.rentalRateDaily}/day</div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">Personal use only</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {tools.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-tools">
                    <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No tools registered yet. Add your tools to unlock more job opportunities!
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Waivers Tab */}
            <TabsContent value="waivers" className="mt-0" data-testid="panel-waivers">
              <h2 className="text-lg font-semibold mb-2">Liability Waivers</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Sign waivers once and they're valid for all activities of that type. No more re-signing!
              </p>
              
              <div className="space-y-3">
                {waivers.map(waiver => (
                  <Card key={waiver.id} className={`bg-muted/50 ${waiver.isExpired ? 'opacity-60' : ''}`} data-testid={`card-waiver-${waiver.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{waiver.templateName}</span>
                          {waiver.isExpired ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                              Valid
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Covers: {waiver.activityTypes.join(', ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Signed: {new Date(waiver.signedAt).toLocaleDateString()} - 
                          Expires: {new Date(waiver.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      {waiver.isExpired && (
                        <Button size="sm" data-testid={`button-resign-waiver-${waiver.id}`}>Re-sign</Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                <div className="border-t pt-4 mt-4">
                  <div className="text-sm text-muted-foreground mb-3">Available waivers to sign:</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto p-3 flex flex-col items-start" data-testid="button-sign-watercraft-waiver">
                      <div className="flex items-center gap-2">
                        <Sailboat className="w-4 h-4 text-blue-500" />
                        Watercraft Waiver
                      </div>
                      <div className="text-xs text-muted-foreground">Kayaks, paddleboards, canoes</div>
                    </Button>
                    <Button variant="outline" className="h-auto p-3 flex flex-col items-start" data-testid="button-sign-motorized-waiver">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-orange-500" />
                        Motorized Vehicle Waiver
                      </div>
                      <div className="text-xs text-muted-foreground">ATVs, side-by-sides, golf carts</div>
                    </Button>
                    <Button variant="outline" className="h-auto p-3 flex flex-col items-start" data-testid="button-sign-tool-waiver">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-gray-500" />
                        Power Tool Waiver
                      </div>
                      <div className="text-xs text-muted-foreground">Tools, ladders, equipment</div>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-0" data-testid="panel-documents">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Identity Documents</h2>
                <Button data-testid="button-add-document">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document
                </Button>
              </div>
              
              <div className="space-y-3">
                {documents.map(doc => (
                  <Card key={doc.id} className="bg-muted/50" data-testid={`card-document-${doc.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDocumentType(doc.documentType)}</span>
                          {doc.verified ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                              Pending
                            </Badge>
                          )}
                          {doc.isExpired && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                              Expired
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {doc.issuingAuthority}
                          {doc.expiresAt && ` - Expires: ${new Date(doc.expiresAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" data-testid={`button-view-document-${doc.id}`}>View</Button>
                    </CardContent>
                  </Card>
                ))}
                
                {documents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-documents">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No documents on file. Add your ID to enable rentals and work.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="mt-0" data-testid="panel-payments">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Payment Methods</h2>
                <Button data-testid="button-add-payment">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
              
              <div className="space-y-3">
                {payments.map(pm => (
                  <Card key={pm.id} className="bg-muted/50" data-testid={`card-payment-${pm.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pm.displayName || `${pm.brand} ending in ${pm.lastFour}`}</span>
                            {pm.isDefault && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                                Default
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            **** {pm.lastFour}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" data-testid={`button-remove-payment-${pm.id}`}>Remove</Button>
                    </CardContent>
                  </Card>
                ))}
                
                {payments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-payments">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No payment methods on file. Add one to enable rentals.
                  </div>
                )}
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Add Skill Modal */}
      <Dialog open={showAddSkillModal} onOpenChange={setShowAddSkillModal}>
        <DialogContent data-testid="modal-add-skill">
          <DialogHeader>
            <DialogTitle>Add a Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="skill-select">Select Skill</Label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger id="skill-select" data-testid="select-skill">
                  <SelectValue placeholder="Choose a skill..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredAvailableSkills.map(skill => (
                    <SelectItem key={skill.id} value={skill.id} data-testid={`option-skill-${skill.id}`}>
                      {skill.name} ({skill.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proficiency-select">Proficiency Level</Label>
              <Select value={proficiencyLevel} onValueChange={setProficiencyLevel}>
                <SelectTrigger id="proficiency-select" data-testid="select-proficiency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="competent">Competent</SelectItem>
                  <SelectItem value="proficient">Proficient</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="years-experience">Years of Experience</Label>
              <Input
                id="years-experience"
                type="number"
                min="0"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                placeholder="Optional"
                data-testid="input-years-experience"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSkillModal(false)} data-testid="button-cancel-skill">
              Cancel
            </Button>
            <Button onClick={handleAddSkill} disabled={!selectedSkillId || saving} data-testid="button-save-skill">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tool Modal */}
      <Dialog open={showAddToolModal} onOpenChange={setShowAddToolModal}>
        <DialogContent className="max-w-lg" data-testid="modal-add-tool">
          <DialogHeader>
            <DialogTitle>Add a Personal Tool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tool-select">Select Tool</Label>
              <Select value={selectedToolId} onValueChange={setSelectedToolId}>
                <SelectTrigger id="tool-select" data-testid="select-tool">
                  <SelectValue placeholder="Choose a tool..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredAvailableTools.map(tool => (
                    <SelectItem key={tool.id} value={tool.id} data-testid={`option-tool-${tool.id}`}>
                      {tool.name} ({tool.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition-select">Condition</Label>
                <Select value={toolCondition} onValueChange={setToolCondition}>
                  <SelectTrigger id="condition-select" data-testid="select-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="needs_repair">Needs Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="community-select">Current Community</Label>
                <Select value={toolCommunityId} onValueChange={setToolCommunityId}>
                  <SelectTrigger id="community-select" data-testid="select-community">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {communities.map(comm => (
                      <SelectItem key={comm.id} value={comm.id} data-testid={`option-community-${comm.id}`}>
                        {comm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location-input">Specific Location</Label>
              <Input
                id="location-input"
                value={toolLocation}
                onChange={(e) => setToolLocation(e.target.value)}
                placeholder="e.g., West Bamfield Shop, Truck Box"
                data-testid="input-tool-location"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">Available for Rent</div>
                <div className="text-sm text-muted-foreground">Allow others to rent this tool</div>
              </div>
              <Switch
                checked={availableForRent}
                onCheckedChange={setAvailableForRent}
                data-testid="switch-available-for-rent"
              />
            </div>
            
            {availableForRent && (
              <div className="space-y-2">
                <Label htmlFor="rental-rate-input">Daily Rental Rate ($)</Label>
                <Input
                  id="rental-rate-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={rentalRateDaily}
                  onChange={(e) => setRentalRateDaily(e.target.value)}
                  placeholder="e.g., 50.00"
                  data-testid="input-rental-rate"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToolModal(false)} data-testid="button-cancel-tool">
              Cancel
            </Button>
            <Button onClick={handleAddTool} disabled={!selectedToolId || saving} data-testid="button-save-tool">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Tool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
