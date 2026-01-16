/**
 * OperatorHomePage - Main operator console entry point
 * Route: /app/operator
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, AlertTriangle, ClipboardList, Shield, Scale, FileCheck, Share2 } from 'lucide-react';
import { OperatorActionPanel } from '@/components/operator/OperatorActionPanel';
import { useStartEmergencyRun } from '@/lib/api/operatorP2/useStartEmergencyRun';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

const SCENARIO_TYPES = [
  { value: 'tsunami', label: 'Tsunami' },
  { value: 'wildfire', label: 'Wildfire' },
  { value: 'power_outage', label: 'Power Outage' },
  { value: 'storm', label: 'Storm' },
  { value: 'evacuation', label: 'Evacuation' },
  { value: 'multi_hazard', label: 'Multi-Hazard' },
  { value: 'other', label: 'Other' },
];

export default function OperatorHomePage() {
  const navigate = useNavigate();
  const startEmergencyRun = useStartEmergencyRun();
  
  const [scenarioType, setScenarioType] = useState('other');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [propertyProfileId, setPropertyProfileId] = useState('');
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleStartRun = async () => {
    const result = await startEmergencyRun.mutateAsync({
      scenario_type: scenarioType,
      title: title || undefined,
      notes: notes || undefined,
      templateId: templateId || undefined,
      propertyProfileId: propertyProfileId || undefined,
    });
    navigate(`/app/operator/emergency/${result.runId}`);
    return result;
  };
  
  return (
    <div className="p-6 space-y-6" data-testid="page-operator-home">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Operator Console</h1>
          <p className="text-muted-foreground text-sm">P2 Emergency, Legal, Insurance, Dispute Operations</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge variant="outline">Roles available by assignment</Badge>
        <Link to="/app/operator/audit">
          <Button variant="ghost" size="sm" data-testid="link-audit">View Audit Log</Button>
        </Link>
      </div>
      
      <Separator />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-emergency">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Emergency
            </CardTitle>
            <CardDescription>Manage emergency runs and scope grants</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/operator/emergency">
              <Button className="w-full" data-testid="button-go-emergency">
                Go to Emergency Console
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card data-testid="card-audit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5" />
              Audit
            </CardTitle>
            <CardDescription>View operator action history</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/operator/audit">
              <Button variant="outline" className="w-full" data-testid="button-go-audit">
                View Audit Log
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card data-testid="card-legal">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5" />
              Legal Holds
            </CardTitle>
            <CardDescription>Create and manage legal hold containers</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/operator/legal">
              <Button variant="outline" className="w-full" data-testid="button-go-legal">
                Go to Legal Holds
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card data-testid="card-insurance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="h-5 w-5" />
              Insurance
            </CardTitle>
            <CardDescription>Manage claim dossiers and exports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/operator/insurance">
              <Button variant="outline" className="w-full" data-testid="button-go-insurance">
                Go to Insurance
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card data-testid="card-disputes">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Disputes
            </CardTitle>
            <CardDescription>Manage dispute defense packs</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/operator/disputes">
              <Button variant="outline" className="w-full" data-testid="button-go-disputes">
                Go to Disputes
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card data-testid="card-authority">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Share2 className="h-5 w-5" />
              Authority
            </CardTitle>
            <CardDescription>Manage external access grants</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/operator/authority">
              <Button variant="outline" className="w-full" data-testid="button-go-authority">
                Go to Authority
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      <div className="max-w-xl">
        <OperatorActionPanel
          title="Quick Start: Emergency Run"
          description="Start a new emergency run from the home page"
          actionLabel="Start Emergency Run"
          onAction={handleStartRun}
          resultRenderer={(result) => {
            const r = result as { runId: string };
            return <span>Run started: <code>{r.runId}</code></span>;
          }}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scenario Type</label>
              <Select value={scenarioType} onValueChange={setScenarioType}>
                <SelectTrigger data-testid="select-scenario-type">
                  <SelectValue placeholder="Select scenario type" />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Emergency run title"
                data-testid="input-title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template ID (optional)</label>
                <Input
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="Template UUID"
                  data-testid="input-template-id"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Property Profile ID (optional)</label>
                <Input
                  value={propertyProfileId}
                  onChange={(e) => setPropertyProfileId(e.target.value)}
                  placeholder="Property UUID"
                  data-testid="input-property-id"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Initial notes about this emergency"
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
        </OperatorActionPanel>
      </div>
    </div>
  );
}
