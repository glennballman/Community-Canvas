/**
 * AuthoritySharePreviewCard - Preview what will be shared and enforce least-privilege
 * Used before sharing to select scope and expiry
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Copy, Check, Shield, Share2 } from 'lucide-react';

export type AuthoritySubjectType = 'emergency_run' | 'insurance_dossier' | 'defense_pack';

const SCOPE_OPTIONS: Record<AuthoritySubjectType, Array<{ value: string; label: string; warning?: boolean }>> = {
  emergency_run: [
    { value: 'run_only', label: 'Run Only (least privilege)' },
    { value: 'record_pack_only', label: 'Record Pack Only' },
    { value: 'run_and_record_pack', label: 'Run + Record Pack' },
    { value: 'all_related', label: 'All Related Records', warning: true },
  ],
  insurance_dossier: [
    { value: 'dossier_only', label: 'Dossier Only (least privilege)' },
    { value: 'dossier_and_inputs', label: 'Dossier + Inputs' },
    { value: 'all_related', label: 'All Related Records', warning: true },
  ],
  defense_pack: [
    { value: 'defense_pack_only', label: 'Defense Pack Only (least privilege)' },
    { value: 'pack_and_inputs', label: 'Pack + Inputs' },
    { value: 'all_related', label: 'All Related Records', warning: true },
  ],
};

const EXPIRY_OPTIONS = [
  { value: 'none', label: 'No expiry' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const DEFAULT_SCOPES: Record<AuthoritySubjectType, string> = {
  emergency_run: 'run_only',
  insurance_dossier: 'dossier_only',
  defense_pack: 'defense_pack_only',
};

interface AuthoritySharePreviewCardProps {
  subjectType: AuthoritySubjectType;
  subjectId: string;
  defaultScope?: string;
  onScopeChange?: (scope: string) => void;
  onExpiryChange?: (expiry: string) => void;
  showDrillWarning?: boolean;
  meta?: { title?: string; summary?: string };
  onDrillAcknowledge?: (acknowledged: boolean) => void;
  onBroadScopeAcknowledge?: (acknowledged: boolean) => void;
}

export function AuthoritySharePreviewCard({
  subjectType,
  subjectId,
  defaultScope,
  onScopeChange,
  onExpiryChange,
  showDrillWarning = false,
  meta,
  onDrillAcknowledge,
  onBroadScopeAcknowledge,
}: AuthoritySharePreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [scope, setScope] = useState(defaultScope || DEFAULT_SCOPES[subjectType]);
  const [expiry, setExpiry] = useState('none');
  const [drillAck, setDrillAck] = useState(false);
  const [broadScopeAck, setBroadScopeAck] = useState(false);

  const scopeOptions = SCOPE_OPTIONS[subjectType] || [];
  const selectedOption = scopeOptions.find(opt => opt.value === scope);
  const isBroadScope = selectedOption?.warning;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(subjectId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScopeChange = (newScope: string) => {
    setScope(newScope);
    onScopeChange?.(newScope);
    const newOption = scopeOptions.find(opt => opt.value === newScope);
    if (!newOption?.warning) {
      setBroadScopeAck(false);
      onBroadScopeAcknowledge?.(false);
    }
  };

  const handleExpiryChange = (newExpiry: string) => {
    setExpiry(newExpiry);
    onExpiryChange?.(newExpiry);
  };

  const handleDrillAck = (checked: boolean) => {
    setDrillAck(checked);
    onDrillAcknowledge?.(checked);
  };

  const handleBroadScopeAck = (checked: boolean) => {
    setBroadScopeAck(checked);
    onBroadScopeAcknowledge?.(checked);
  };

  const subjectLabel = {
    emergency_run: 'Emergency Run',
    insurance_dossier: 'Insurance Dossier',
    defense_pack: 'Defense Pack',
  }[subjectType];

  return (
    <Card data-testid="authority-share-preview-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4" />
          Share Preview
        </CardTitle>
        <CardDescription>Configure what will be shared with external authority</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Subject</div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{subjectLabel}</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[200px]">
              {subjectId}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              data-testid="button-copy-subject-id"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {meta?.title && (
            <div className="text-sm">{meta.title}</div>
          )}
          {meta?.summary && (
            <div className="text-xs text-muted-foreground">{meta.summary}</div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Access Scope</label>
          <Select value={scope} onValueChange={handleScopeChange}>
            <SelectTrigger data-testid="select-scope">
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              {scopeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className={opt.warning ? 'text-destructive' : ''}>
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Access Expiry</label>
          <Select value={expiry} onValueChange={handleExpiryChange}>
            <SelectTrigger data-testid="select-expiry">
              <SelectValue placeholder="Select expiry" />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showDrillWarning && (
          <div className="p-3 border border-yellow-500/50 bg-yellow-500/10 rounded-md space-y-2">
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Drill Artifact</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This is a DRILL artifact. Sharing is disabled by default.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="drill-ack"
                checked={drillAck}
                onCheckedChange={(checked) => handleDrillAck(!!checked)}
                data-testid="checkbox-drill-acknowledge"
              />
              <label htmlFor="drill-ack" className="text-xs">
                I understand this is a drill
              </label>
            </div>
          </div>
        )}

        {isBroadScope && (
          <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-md space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <Shield className="h-4 w-4" />
              <span className="font-medium">Broad Scope Warning</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sharing all related records exposes more data. Consider using a more restrictive scope.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="broad-scope-ack"
                checked={broadScopeAck}
                onCheckedChange={(checked) => handleBroadScopeAck(!!checked)}
                data-testid="checkbox-broad-scope-acknowledge"
              />
              <label htmlFor="broad-scope-ack" className="text-xs">
                I intend to share all related records
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function calculateExpiresAt(expiry: string): string | undefined {
  if (expiry === 'none') return undefined;
  const now = new Date();
  const days = parseInt(expiry.replace('d', ''), 10);
  if (isNaN(days)) return undefined;
  now.setDate(now.getDate() + days);
  return now.toISOString();
}
