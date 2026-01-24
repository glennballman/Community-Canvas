/**
 * STEP 11C.1: Claim Invitation Modal
 * 
 * Allows stakeholder to claim invitation by signing in or creating account.
 * Enforces email matching with invitation recipient.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, UserPlus, AlertCircle, Info } from 'lucide-react';

interface ClaimInvitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onClaimed: () => void;
}

interface ClaimResponse {
  ok: boolean;
  status?: string;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
}

const COPY = {
  title: 'Claim invitation',
  help: 'Claiming links this invitation to your account for private ops access. Publishing is separate.',
  modeSignin: 'I have an account',
  modeRegister: 'Create account',
  emailLabel: 'Email',
  emailHelp: 'Use the same email this invitation was sent to.',
  passwordLabel: 'Password',
  displayNameLabel: 'Display name',
  submit: 'Claim',
  errors: {
    email_mismatch: 'This invitation can only be claimed by the email it was sent to.',
    invalid_credentials: 'Invalid email or password.',
    email_in_use: 'An account already exists for this email. Try signing in.',
    invalid_or_expired: 'This invitation link is invalid or expired.',
    password_too_short: 'Password must be at least 8 characters.',
    generic: 'Something went wrong. Please try again.'
  }
};

function getErrorMessage(error: string): string {
  if (error.includes('email_mismatch')) return COPY.errors.email_mismatch;
  if (error.includes('invalid_credentials')) return COPY.errors.invalid_credentials;
  if (error.includes('email_in_use')) return COPY.errors.email_in_use;
  if (error.includes('invalid_or_expired')) return COPY.errors.invalid_or_expired;
  if (error.includes('password_too_short')) return COPY.errors.password_too_short;
  return COPY.errors.generic;
}

export default function ClaimInvitationModal({
  open,
  onOpenChange,
  token,
  onClaimed
}: ClaimInvitationModalProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const claimMutation = useMutation<ClaimResponse, Error, void>({
    mutationFn: async () => {
      const response = await fetch(`/api/i/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          email: email.trim(),
          password,
          display_name: mode === 'register' ? displayName.trim() : undefined
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.ok) {
        if (data.accessToken) {
          localStorage.setItem('cc_token', data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem('cc_refresh_token', data.refreshToken);
        }
        setErrorMessage(null);
        onClaimed();
        onOpenChange(false);
      } else {
        setErrorMessage(getErrorMessage(data.error || ''));
      }
    },
    onError: () => {
      setErrorMessage(COPY.errors.generic);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    claimMutation.mutate();
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setErrorMessage(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" data-testid="claim-invitation-modal">
        <DialogHeader>
          <DialogTitle data-testid="modal-title">{COPY.title}</DialogTitle>
          <DialogDescription className="flex items-start gap-2 text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{COPY.help}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as 'signin' | 'register'); setErrorMessage(null); }}>
          <TabsList className="grid w-full grid-cols-2" data-testid="claim-mode-tabs">
            <TabsTrigger value="signin" data-testid="tab-signin">
              <LogIn className="w-4 h-4 mr-2" />
              {COPY.modeSignin}
            </TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">
              <UserPlus className="w-4 h-4 mr-2" />
              {COPY.modeRegister}
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {errorMessage && (
              <Alert variant="destructive" data-testid="claim-error">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="signin" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="signin-email">{COPY.emailLabel}</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">{COPY.emailHelp}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">{COPY.passwordLabel}</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  data-testid="input-password"
                />
              </div>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="register-email">{COPY.emailLabel}</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  data-testid="input-email-register"
                />
                <p className="text-xs text-muted-foreground">{COPY.emailHelp}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">{COPY.passwordLabel}</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 8 characters)"
                  required
                  minLength={8}
                  data-testid="input-password-register"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-displayname">{COPY.displayNameLabel}</Label>
                <Input
                  id="register-displayname"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name (optional)"
                  data-testid="input-displayname"
                />
              </div>
            </TabsContent>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={claimMutation.isPending}
              data-testid="button-claim-submit"
            >
              {claimMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                COPY.submit
              )}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
