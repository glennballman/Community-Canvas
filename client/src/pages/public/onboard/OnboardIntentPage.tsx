/**
 * ONB-01: Onboard Intent Page
 * 
 * Minimal landing page for starting a new workspace.
 * Route: /onboard
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Wrench, Home, ArrowLeftRight, HelpCircle } from 'lucide-react';

type Intent = 'provide' | 'need' | 'both' | 'unsure';

const INTENT_OPTIONS: { intent: Intent; icon: typeof Wrench; label: string; description: string }[] = [
  { intent: 'provide', icon: Wrench, label: 'Provide services', description: 'I offer work or services' },
  { intent: 'need', icon: Home, label: 'Need services', description: 'I need help with something' },
  { intent: 'both', icon: ArrowLeftRight, label: 'Both', description: 'I provide and need services' },
  { intent: 'unsure', icon: HelpCircle, label: 'Not sure yet', description: 'I\'ll figure it out' },
];

export default function OnboardIntentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Intent | null>(null);

  const handleSelect = async (intent: Intent) => {
    setLoading(intent);
    try {
      const res = await fetch('/api/public/onboard/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent })
      });
      const data = await res.json();
      
      if (data.ok && data.token) {
        navigate(`/onboard/w/${data.token}`);
      } else {
        console.error('Failed to create workspace:', data.error);
        setLoading(null);
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-onboard-intent">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl" data-testid="heading-onboard">Get Started</CardTitle>
          <CardDescription>
            What brings you here today?
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {INTENT_OPTIONS.map(({ intent, icon: Icon, label, description }) => (
            <Button
              key={intent}
              variant="outline"
              className="h-auto py-4 px-4 justify-start gap-4 text-left"
              onClick={() => handleSelect(intent)}
              disabled={loading !== null}
              data-testid={`button-intent-${intent}`}
            >
              {loading === intent ? (
                <Loader2 className="h-6 w-6 animate-spin shrink-0" />
              ) : (
                <Icon className="h-6 w-6 shrink-0" />
              )}
              <div>
                <div className="font-medium">{label}</div>
                <div className="text-sm text-muted-foreground">{description}</div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
