import { useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Target, 
  AlertTriangle,
  Plus,
  X,
  Waves,
  Car as CarIcon,
  TreePine,
  Droplets,
  Siren
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ParticipantProfile, ParticipantSkill, SkillCategory, SkillLevel, skillLevelColors } from '../../types/tripPlanning';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface ParticipantProfileFormProps {
  participant: ParticipantProfile | null;
  onSave: (participant: ParticipantProfile) => void;
  onCancel: () => void;
}

const SKILL_TYPES: Record<SkillCategory, string[]> = {
  paddling: ['sea_kayak', 'whitewater', 'canoe', 'sup', 'self_rescue'],
  driving: ['standard', 'mountain', 'gravel_road', 'winter', 'commercial', 'towing'],
  backcountry: ['navigation', 'camping', 'wilderness_first_aid', 'bear_aware', 'leave_no_trace'],
  water_safety: ['vhf_radio', 'boating_license', 'fishing_license_salt', 'fishing_license_fresh'],
  emergency: ['cpr_first_aid', 'wilderness_first_aid', 'satellite_device', 'emergency_beacon']
};

const SKILL_TYPE_LABELS: Record<string, string> = {
  sea_kayak: 'Sea Kayaking',
  whitewater: 'Whitewater',
  canoe: 'Canoeing',
  sup: 'Stand-Up Paddleboard',
  self_rescue: 'Self-Rescue',
  standard: 'Standard Driving',
  mountain: 'Mountain Driving',
  gravel_road: 'Gravel Road',
  winter: 'Winter Driving',
  commercial: 'Commercial License',
  towing: 'Towing',
  navigation: 'Navigation (Map/Compass)',
  camping: 'Backcountry Camping',
  wilderness_first_aid: 'Wilderness First Aid',
  bear_aware: 'Bear Awareness',
  leave_no_trace: 'Leave No Trace',
  vhf_radio: 'VHF Radio',
  boating_license: 'Boating License',
  fishing_license_salt: 'Fishing License (Saltwater)',
  fishing_license_fresh: 'Fishing License (Freshwater)',
  cpr_first_aid: 'CPR/First Aid',
  satellite_device: 'Satellite Communicator',
  emergency_beacon: 'Emergency Beacon (PLB)'
};

const categoryIcons: Record<SkillCategory, typeof Waves> = {
  paddling: Waves,
  driving: CarIcon,
  backcountry: TreePine,
  water_safety: Droplets,
  emergency: Siren
};

export function ParticipantProfileForm({ participant, onSave, onCancel }: ParticipantProfileFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<ParticipantProfile>>({
    name: participant?.name || '',
    email: participant?.email || '',
    phone: participant?.phone || '',
    emergency_contact_name: participant?.emergency_contact_name || '',
    emergency_contact_phone: participant?.emergency_contact_phone || '',
    country_of_origin: participant?.country_of_origin || '',
    languages: participant?.languages || ['English'],
    medical_conditions: participant?.medical_conditions || [],
    dietary_restrictions: participant?.dietary_restrictions || [],
    fitness_level: participant?.fitness_level || 5,
    swimming_ability: participant?.swimming_ability || 'basic'
  });

  const [skills, setSkills] = useState<Partial<ParticipantSkill>[]>(
    participant?.skills || []
  );

  const [activeSection, setActiveSection] = useState<'basic' | 'skills' | 'emergency'>('basic');
  const [saving, setSaving] = useState(false);

  const [newSkill, setNewSkill] = useState<Partial<ParticipantSkill>>({
    skill_category: 'paddling',
    skill_type: 'sea_kayak',
    skill_level: 'beginner'
  });

  const handleSave = async () => {
    if (!formData.name) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your name',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/v1/planning/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to save participant');
      
      const savedParticipant = await response.json();

      for (const skill of skills) {
        if (skill.skill_category && skill.skill_type && skill.skill_level) {
          await fetch(`/api/v1/planning/participants/${savedParticipant.id}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(skill)
          });
        }
      }

      const profileResponse = await fetch(`/api/v1/planning/participants/${savedParticipant.id}`);
      const completeProfile = await profileResponse.json();

      toast({
        title: 'Profile Saved',
        description: 'Your profile has been saved successfully'
      });
      onSave(completeProfile);
    } catch (error) {
      console.error('Error saving participant:', error);
      toast({
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.skill_category && newSkill.skill_type && newSkill.skill_level) {
      const exists = skills.some(
        s => s.skill_category === newSkill.skill_category && s.skill_type === newSkill.skill_type
      );
      if (!exists) {
        setSkills([...skills, { ...newSkill }]);
      }
      setNewSkill({
        skill_category: newSkill.skill_category,
        skill_type: SKILL_TYPES[newSkill.skill_category as SkillCategory][0],
        skill_level: 'beginner'
      });
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onCancel} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CardTitle>
                {participant ? 'Edit Profile' : 'Create Your Profile'}
              </CardTitle>
            </div>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-profile">
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {(['basic', 'skills', 'emergency'] as const).map(section => (
              <Button
                key={section}
                variant={activeSection === section ? 'default' : 'outline'}
                onClick={() => setActiveSection(section)}
                data-testid={`tab-${section}`}
              >
                {section === 'basic' && <User className="w-4 h-4 mr-2" />}
                {section === 'skills' && <Target className="w-4 h-4 mr-2" />}
                {section === 'emergency' && <AlertTriangle className="w-4 h-4 mr-2" />}
                <span className="capitalize">{section}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {activeSection === 'basic' && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country of Origin</Label>
                <Input
                  id="country"
                  value={formData.country_of_origin}
                  onChange={(e) => setFormData({ ...formData, country_of_origin: e.target.value })}
                  placeholder="Canada"
                  data-testid="input-country"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Fitness Level</Label>
                  <span className="text-sm text-muted-foreground">{formData.fitness_level}/10</span>
                </div>
                <Slider
                  value={[formData.fitness_level || 5]}
                  onValueChange={(v) => setFormData({ ...formData, fitness_level: v[0] })}
                  min={1}
                  max={10}
                  step={1}
                  data-testid="slider-fitness"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sedentary</span>
                  <span>Average</span>
                  <span>Athlete</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Swimming Ability</Label>
                <Select
                  value={formData.swimming_ability}
                  onValueChange={(v) => setFormData({ ...formData, swimming_ability: v as any })}
                >
                  <SelectTrigger data-testid="select-swimming">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non-swimmer</SelectItem>
                    <SelectItem value="basic">Basic (can float, limited distance)</SelectItem>
                    <SelectItem value="strong">Strong swimmer</SelectItem>
                    <SelectItem value="lifeguard">Lifeguard/Certified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Medical Conditions (optional, for safety planning)</Label>
              <Textarea
                value={formData.medical_conditions?.join('\n')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  medical_conditions: e.target.value.split('\n').filter(Boolean) 
                })}
                placeholder="One per line: diabetes, allergies, etc."
                rows={3}
                data-testid="textarea-medical"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'skills' && (
        <Card>
          <CardHeader>
            <CardTitle>Your Skills & Certifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={newSkill.skill_category}
                      onValueChange={(v) => setNewSkill({ 
                        ...newSkill, 
                        skill_category: v as SkillCategory,
                        skill_type: SKILL_TYPES[v as SkillCategory][0]
                      })}
                    >
                      <SelectTrigger data-testid="select-skill-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(categoryIcons).map((cat) => (
                          <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Skill Type</Label>
                    <Select
                      value={newSkill.skill_type}
                      onValueChange={(v) => setNewSkill({ ...newSkill, skill_type: v })}
                    >
                      <SelectTrigger data-testid="select-skill-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILL_TYPES[newSkill.skill_category as SkillCategory]?.map(type => (
                          <SelectItem key={type} value={type}>{SKILL_TYPE_LABELS[type] || type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select
                      value={newSkill.skill_level}
                      onValueChange={(v) => setNewSkill({ ...newSkill, skill_level: v as SkillLevel })}
                    >
                      <SelectTrigger data-testid="select-skill-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                        <SelectItem value="certified">Certified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button onClick={addSkill} className="w-full" data-testid="button-add-skill">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Skill
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {skills.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No skills added yet. Add your skills above to get trip recommendations.
              </p>
            ) : (
              <div className="space-y-2">
                {skills.map((skill, index) => {
                  const Icon = categoryIcons[skill.skill_category as SkillCategory] || Target;
                  return (
                    <div key={index} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {SKILL_TYPE_LABELS[skill.skill_type!] || skill.skill_type}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">{skill.skill_category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`capitalize ${skillLevelColors[skill.skill_level as SkillLevel]}`}>
                          {skill.skill_level}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSkill(index)}
                          data-testid={`button-remove-skill-${index}`}
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'emergency' && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Emergency Contact Name</Label>
                <Input
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  placeholder="Name of emergency contact"
                  data-testid="input-emergency-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Emergency Contact Phone</Label>
                <Input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-emergency-phone"
                />
              </div>
            </div>

            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Emergency contact information is crucial for backcountry and remote trips. 
                    This person should know your itinerary and be able to contact search & rescue if needed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ParticipantProfileForm;
