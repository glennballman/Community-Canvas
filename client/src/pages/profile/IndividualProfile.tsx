import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, FileText, Award, Wrench, ClipboardCheck, CreditCard,
  CheckCircle, AlertCircle, MapPin, Phone, Shield,
  Sailboat, Car, Package, Plus
} from 'lucide-react';

interface Individual {
  id: string | null;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
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

function formatDocumentType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function IndividualProfile() {
  const { token, loading: authLoading } = useAuth();
  
  const [individual, setIndividual] = useState<Individual | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tools, setTools] = useState<PersonalTool[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (token && !authLoading) {
      loadProfile();
    }
  }, [token, authLoading, loadProfile]);

  const profileComplete = individual?.profileScore || 0;
  const missingItems: string[] = [];
  if (!individual?.phoneVerified) missingItems.push('Verify phone');
  if (documents.filter(d => d.documentType === 'photo_id' && d.verified).length === 0) missingItems.push('Add photo ID');
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
            {/* Avatar */}
            <Avatar className="w-24 h-24" data-testid="avatar-profile">
              <AvatarImage src={individual.photoUrl} alt={individual.fullName} />
              <AvatarFallback className="text-2xl">
                {individual.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            {/* Info */}
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
                {individual.phoneVerified && (
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
            
            {/* Profile Score */}
            <div className="text-right" data-testid="profile-score-container">
              <div className="text-3xl font-bold" data-testid="text-profile-score">{profileComplete}%</div>
              <div className="text-sm text-muted-foreground">Profile Complete</div>
              <Progress value={profileComplete} className="w-32 mt-2" data-testid="progress-profile" />
            </div>
          </div>
          
          {/* Missing Items */}
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
              
              {/* Quick Actions */}
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
              
              {/* Capabilities Summary */}
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
                <Button data-testid="button-add-skill">
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
                <Button data-testid="button-add-tool">
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
                
                {/* Available waivers to sign */}
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
    </div>
  );
}
