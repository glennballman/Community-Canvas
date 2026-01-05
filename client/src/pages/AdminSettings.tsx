import { useState, useEffect } from "react";
import { Settings, Save, Clock, Database, Zap, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const IMPERSONATION_QA_MODE_KEY = 'impersonation_qa_mode';

export function useImpersonationQAMode() {
  const [qaMode, setQAMode] = useState(() => {
    return localStorage.getItem(IMPERSONATION_QA_MODE_KEY) === 'true';
  });

  const toggleQAMode = (enabled: boolean) => {
    localStorage.setItem(IMPERSONATION_QA_MODE_KEY, enabled ? 'true' : 'false');
    setQAMode(enabled);
  };

  return { qaMode, toggleQAMode };
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { qaMode, toggleQAMode } = useImpersonationQAMode();

  const handleQAModeToggle = (checked: boolean) => {
    toggleQAMode(checked);
    toast({
      title: checked ? "QA Mode Enabled" : "QA Mode Disabled",
      description: checked 
        ? "Reason field is now optional for impersonation" 
        : "Reason field is now required for impersonation"
    });
  };

  return (
    <div className="h-full flex flex-col font-mono">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border/50 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 text-slate-400" />
          <h1 className="text-sm font-semibold uppercase tracking-wider">Settings</h1>
        </div>
        <Button size="sm" className="gap-2" data-testid="button-save-settings">
          <Save className="w-3 h-3" />
          SAVE CHANGES
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Refresh Interval
            </CardTitle>
            <CardDescription className="text-xs">
              Configure how often data sources are scraped
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="interval" className="text-xs w-32">Interval (minutes)</Label>
              <Input 
                id="interval" 
                type="number" 
                defaultValue="5" 
                className="w-24 text-xs" 
                data-testid="input-refresh-interval"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Firecrawl Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Configure AI scraping parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Enable AI Extraction</Label>
                <p className="text-[10px] text-muted-foreground">Use Firecrawl AI to extract structured data</p>
              </div>
              <Switch defaultChecked data-testid="switch-ai-extraction" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Cache Responses</Label>
                <p className="text-[10px] text-muted-foreground">Cache scraped data to reduce API calls</p>
              </div>
              <Switch defaultChecked data-testid="switch-cache-responses" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database
            </CardTitle>
            <CardDescription className="text-xs">
              Manage stored snapshots
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Retention Period (days)</Label>
                <p className="text-[10px] text-muted-foreground">How long to keep historical data</p>
              </div>
              <Input 
                type="number" 
                defaultValue="30" 
                className="w-24 text-xs" 
                data-testid="input-retention-days"
              />
            </div>
            <Button variant="destructive" size="sm" className="text-xs" data-testid="button-clear-cache">
              Clear Cache
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Impersonation Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Configure platform impersonation behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">QA Mode (Skip Reason)</Label>
                <p className="text-[10px] text-muted-foreground">
                  When enabled, you can impersonate without typing a reason
                </p>
              </div>
              <Switch 
                checked={qaMode} 
                onCheckedChange={handleQAModeToggle}
                data-testid="switch-impersonation-qa-mode" 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
