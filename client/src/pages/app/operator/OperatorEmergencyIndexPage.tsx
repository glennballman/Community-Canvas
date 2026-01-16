/**
 * OperatorEmergencyIndexPage - Emergency runs index
 * Route: /app/operator/emergency
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
import { AlertTriangle, ArrowLeft, Search, Info } from 'lucide-react';
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

export default function OperatorEmergencyIndexPage() {
  const navigate = useNavigate();
  const startEmergencyRun = useStartEmergencyRun();
  
  const [scenarioType, setScenarioType] = useState('other');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [propertyProfileId, setPropertyProfileId] = useState('');
  const [openRunId, setOpenRunId] = useState('');
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-emergency');
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
  
  const handleOpenRun = () => {
    if (openRunId.trim()) {
      navigate(`/app/operator/emergency/${openRunId.trim()}`);
    }
  };
  
  return (
    <div className="p-6 space-y-6" data-testid="page-operator-emergency-index">
      <div className="flex items-center gap-4">
        <Link to="/app/operator">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Emergency Runs</h1>
            <p className="text-muted-foreground text-sm">Start, manage, and monitor emergency operations</p>
          </div>
        </div>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <OperatorActionPanel
          title="Start New Run"
          description="Create a new emergency run with scope grants"
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
        
        <Card data-testid="card-open-run">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Open Existing Run
            </CardTitle>
            <CardDescription>Navigate to an existing run by ID</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Run ID</label>
              <Input
                value={openRunId}
                onChange={(e) => setOpenRunId(e.target.value)}
                placeholder="Enter run UUID"
                data-testid="input-open-run-id"
              />
            </div>
            <Button
              onClick={handleOpenRun}
              disabled={!openRunId.trim()}
              data-testid="button-open-run"
            >
              Open Run
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      <Card data-testid="card-info">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About Emergency Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Emergency runs create a tamper-evident audit trail with scope grants for emergency 
            responders. Use the "Open Existing Run" field above to navigate to a specific run 
            by its ID after creation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
