import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Trash2, 
  Upload, 
  Key,
  Shield,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';

interface KeyHealthResponse {
  ok: boolean;
  active_key_id: string | null;
  public_key_ids: string[];
  has_private_key_configured: boolean;
  active_key_has_public_key: boolean;
  warnings: string[];
}

interface VerifyResponse {
  ok: boolean;
  verified: boolean;
  key_id?: string;
  hash?: string;
  reason?: string;
  signed_at?: string;
  signature_scope?: string;
}

function maskHash(hash: string): string {
  if (!hash) return '********';
  if (hash.length <= 12) return hash;
  return `${hash.substring(0, 8)}…${hash.substring(hash.length - 4)}`;
}

function mapReasonToSafeMessage(reason: string | undefined): string {
  if (!reason) return 'Verification failed';
  
  const reasonMap: Record<string, string> = {
    'Invalid JSON': 'The input is not valid JSON',
    'No attestation block': 'Export is missing attestation block (may be v1 unattested export)',
    'Unknown signing key': 'The signing key is not recognized',
    'Hash mismatch': 'Data integrity check failed - export may have been modified',
    'Signature verification failed': 'Cryptographic signature is invalid',
  };

  for (const [key, message] of Object.entries(reasonMap)) {
    if (reason.includes(key)) {
      return message;
    }
  }
  
  return 'Verification failed';
}

function KeyHealthPanel() {
  const { resolve } = useCopy();
  
  const { data, isLoading, error } = useQuery<KeyHealthResponse>({
    queryKey: ['/api/app/export-signing-key-health'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            {resolve('settings.key_health.title') || 'Signing Key Status'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.ok) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            {resolve('settings.key_health.title') || 'Signing Key Status'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load key health status</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="w-4 h-4" />
          {resolve('settings.key_health.title') || 'Signing Key Status'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {resolve('settings.key_health.field.active_key_id') || 'Active Key ID'}
            </Label>
            <div data-testid="text-active-key-id">
              {data.active_key_id ? (
                <Badge variant="outline" className="font-mono">{data.active_key_id}</Badge>
              ) : (
                <span className="text-muted-foreground text-sm">Not configured</span>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {resolve('settings.key_health.field.private_key_configured') || 'Private Key'}
            </Label>
            <div data-testid="text-private-key-status">
              {data.has_private_key_configured ? (
                <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400">
                  <XCircle className="w-3 h-3 mr-1" /> Not configured
                </Badge>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {resolve('settings.key_health.field.public_keys') || 'Public Keys'}
            </Label>
            <div className="flex flex-wrap gap-1" data-testid="text-public-keys">
              {data.public_key_ids.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  {resolve('settings.key_health.empty.no_public_keys') || 'None configured'}
                </span>
              ) : (
                data.public_key_ids.map((keyId) => (
                  <Badge 
                    key={keyId} 
                    variant={keyId === data.active_key_id ? 'default' : 'outline'}
                    className="font-mono text-xs"
                  >
                    {keyId}
                  </Badge>
                ))
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {resolve('settings.key_health.field.active_key_has_public_key') || 'Key Consistency'}
            </Label>
            <div data-testid="text-key-consistency">
              {data.active_key_has_public_key ? (
                <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Consistent
                </Badge>
              ) : data.active_key_id ? (
                <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Mismatch
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">N/A</span>
              )}
            </div>
          </div>
        </div>
        
        {data.warnings.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {resolve('settings.key_health.warnings.title') || 'Warnings'}
            </Label>
            <div className="space-y-1">
              {data.warnings.map((warning, idx) => (
                <Alert key={idx} variant="default" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm" data-testid={`text-warning-${idx}`}>
                    {warning}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProofVerificationPage() {
  const { toast } = useToast();
  const { resolve } = useCopy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [jsonInput, setJsonInput] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async (exportJson: string) => {
      const response = await apiRequest('POST', '/api/app/negotiation-proof-export/verify', {
        export_json: exportJson,
      });
      return response.json();
    },
    onSuccess: (data: VerifyResponse) => {
      setVerifyResult(data);
    },
    onError: () => {
      setVerifyResult({
        ok: false,
        verified: false,
        reason: 'Request failed',
      });
    },
  });

  const handleVerify = () => {
    if (!jsonInput.trim()) {
      toast({
        title: 'Input required',
        description: 'Please paste or upload an export JSON bundle',
        variant: 'destructive',
      });
      return;
    }
    setVerifyResult(null);
    verifyMutation.mutate(jsonInput);
  };

  const handleClear = () => {
    setJsonInput('');
    setVerifyResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonInput(text);
      setVerifyResult(null);
    };
    reader.onerror = () => {
      toast({
        title: 'Failed to read file',
        variant: 'destructive',
      });
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: resolve('settings.proof_verification.action.copied') || 'Copied',
        description: `${label} copied to clipboard`,
        duration: 1500,
      });
    } catch {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          {resolve('settings.proof_verification.title') || 'Proof Verification'}
        </h1>
        <p className="text-muted-foreground">
          {resolve('settings.proof_verification.description') || 'Verify the integrity of exported run proof bundles'}
        </p>
      </div>
      
      <KeyHealthPanel />
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            {resolve('settings.proof_verification.input.label') || 'Verify Export Bundle'}
          </CardTitle>
          <CardDescription>
            {resolve('settings.proof_verification.input.placeholder') || 
              'Paste an export JSON bundle from Run Proof Export (v2 attested).'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="json-input">Export JSON</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Upload
                </Button>
              </div>
            </div>
            <Textarea
              id="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"schema_version": "cc.v3_5...", ...}'
              className="font-mono text-sm min-h-[200px]"
              data-testid="input-json"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={verifyMutation.isPending || !jsonInput.trim()}
              data-testid="button-verify"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  {resolve('settings.proof_verification.action.verify') || 'Verify Proof'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!jsonInput && !verifyResult}
              data-testid="button-clear"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {resolve('settings.proof_verification.action.clear') || 'Clear'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {verifyResult && (
        <Card data-testid="card-verification-result">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {verifyResult.verified ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400" data-testid="text-verification-status">
                    {resolve('settings.proof_verification.status.verified') || 'Verified'}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="text-destructive" data-testid="text-verification-status">
                    {resolve('settings.proof_verification.status.not_verified') || 'Not Verified'}
                  </span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifyResult.verified ? (
              <>
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowValues(!showValues)}
                    data-testid="button-toggle-values"
                  >
                    {showValues ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-1" />
                        {resolve('settings.proof_verification.action.hide_values') || 'Hide Values'}
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        {resolve('settings.proof_verification.action.show_values') || 'Show Values'}
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {resolve('settings.proof_verification.field.signing_key_id') || 'Signing Key ID'}
                    </Label>
                    <div data-testid="text-signing-key-id">
                      <Badge variant="outline" className="font-mono">
                        {verifyResult.key_id}
                      </Badge>
                    </div>
                  </div>
                  
                  {verifyResult.signature_scope && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {resolve('settings.proof_verification.field.signature_scope') || 'Signature Scope'}
                      </Label>
                      <div data-testid="text-signature-scope">
                        <Badge variant="secondary">{verifyResult.signature_scope}</Badge>
                      </div>
                    </div>
                  )}
                  
                  {verifyResult.signed_at && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {resolve('settings.proof_verification.field.signed_at') || 'Signed At'}
                      </Label>
                      <div className="text-sm" data-testid="text-signed-at">
                        {new Date(verifyResult.signed_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                  
                  {verifyResult.hash && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {resolve('settings.proof_verification.field.export_hash') || 'Export Hash'}
                      </Label>
                      <div className="flex items-center gap-1" data-testid="text-export-hash">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {showValues ? verifyResult.hash : maskHash(verifyResult.hash)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleCopyValue(verifyResult.hash!, 'Export hash')}
                          data-testid="button-copy-hash"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>
                  {resolve('settings.proof_verification.field.reason') || 'Reason'}
                </AlertTitle>
                <AlertDescription data-testid="text-verification-reason">
                  {mapReasonToSafeMessage(verifyResult.reason)}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
