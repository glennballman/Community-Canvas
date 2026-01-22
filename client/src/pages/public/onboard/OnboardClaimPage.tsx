/**
 * ONB-03: Onboard Claim Page
 * 
 * Allows guest to claim workspace by creating account or attaching to existing session.
 * Route: /onboard/w/:token/claim
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowLeft, 
  UserPlus,
  LogIn,
  Building2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface WorkspaceStatus {
  status: 'open' | 'claimed' | 'expired';
  claimed: boolean;
  promoted: boolean;
  next: 'claim' | 'promote' | 'view';
  claimedUserId?: string;
  claimedTenantId?: string;
}

export default function OnboardClaimPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [createTenant, setCreateTenant] = useState(true);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    loadStatus();
  }, [token]);

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}/status`);
      const data = await res.json();
      
      if (res.status === 410) {
        setError('This workspace has expired.');
        setLoading(false);
        return;
      }
      
      if (!data.ok) {
        setError(data.error || 'Workspace not found');
        setLoading(false);
        return;
      }
      
      setStatus(data);
      setLoading(false);
      
      // If already claimed and promoted, redirect to results
      if (data.claimed && data.promoted) {
        navigate(`/app/onboarding/results?workspaceToken=${token}`);
      }
    } catch (err) {
      setError('Failed to load workspace');
      setLoading(false);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaiming(true);
    setError(null);
    
    try {
      const claimRes = await fetch(`/api/public/onboard/workspaces/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || undefined,
          companyName: companyName || undefined,
          createTenant,
          tenantName: tenantName || companyName || displayName || undefined
        })
      });
      
      const claimData = await claimRes.json();
      
      if (!claimData.ok) {
        setError(claimData.error || 'Failed to claim workspace');
        setClaiming(false);
        return;
      }
      
      // Store tokens
      if (claimData.accessToken) {
        localStorage.setItem('cc_token', claimData.accessToken);
      }
      if (claimData.refreshToken) {
        localStorage.setItem('cc_refresh_token', claimData.refreshToken);
      }
      
      // If tenant was created, immediately promote
      if (claimData.tenantId) {
        const promoteRes = await fetch(`/api/public/onboard/workspaces/${token}/promote`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${claimData.accessToken}`
          },
          body: JSON.stringify({ tenantId: claimData.tenantId })
        });
        
        const promoteData = await promoteRes.json();
        
        if (promoteData.ok && promoteData.redirectTo) {
          navigate(promoteData.redirectTo);
          return;
        }
      }
      
      // Navigate to results (public route to avoid auth redirect)
      navigate(`/onboard/results?workspaceToken=${token}`);
    } catch (err) {
      console.error('Claim error:', err);
      setError('Failed to claim workspace. Please try again.');
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loader-claim">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="error-claim">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate('/onboard')} data-testid="button-start-new">
              Start New Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already claimed
  if (status?.claimed) {
    return (
      <div className="min-h-screen bg-background p-4" data-testid="page-already-claimed">
        <div className="max-w-md mx-auto space-y-4">
          <Link to={`/onboard/w/${token}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Workspace Already Claimed</h2>
              <p className="text-muted-foreground mb-4">
                This workspace has been saved to your account.
              </p>
              <Button onClick={() => navigate(`/app/onboarding/results?workspaceToken=${token}`)}>
                View Results
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-claim">
      <div className="max-w-md mx-auto space-y-4">
        <Link to={`/onboard/w/${token}`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="heading-claim">
              <UserPlus className="h-5 w-5" />
              Save Your Workspace
            </CardTitle>
            <CardDescription>
              Create an account to save your workspace and access it anytime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClaim} className="space-y-4">
              {error && (
                <div className="p-3 rounded bg-destructive/10 text-destructive text-sm" data-testid="claim-error">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Your Name (optional)</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="input-display-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name (optional)</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Your company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  data-testid="input-company-name"
                />
              </div>
              
              <div className="flex items-center gap-2 py-2">
                <Checkbox 
                  id="createTenant" 
                  checked={createTenant}
                  onCheckedChange={(checked) => setCreateTenant(checked === true)}
                  data-testid="checkbox-create-tenant"
                />
                <Label htmlFor="createTenant" className="text-sm font-normal cursor-pointer">
                  Create an organization for my workspace
                </Label>
              </div>
              
              {createTenant && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="tenantName">Organization Name</Label>
                  <Input
                    id="tenantName"
                    type="text"
                    placeholder={companyName || displayName || 'My Organization'}
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    data-testid="input-tenant-name"
                  />
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full gap-2" 
                disabled={claiming}
                data-testid="button-claim"
              >
                {claiming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {claiming ? 'Saving...' : 'Save & Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
