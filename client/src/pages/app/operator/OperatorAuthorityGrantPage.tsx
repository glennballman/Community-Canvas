/**
 * OperatorAuthorityGrantPage - View/manage a specific authority grant
 * Route: /app/operator/authority/grants/:grantId
 * 
 * Note: Since revoke/fetch endpoints are not P2, this page shows
 * the grant ID and provides info about where grants were created.
 */

import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, ArrowLeft, Copy, Check, Info } from 'lucide-react';
import { useState } from 'react';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

export default function OperatorAuthorityGrantPage() {
  const { grantId } = useParams<{ grantId: string }>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCopy = async () => {
    if (grantId) {
      await navigator.clipboard.writeText(grantId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!grantId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-muted-foreground">No grant ID provided</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-operator-authority-grant">
      <div className="flex items-center gap-3">
        <Link to="/app/operator/authority">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Authority Grant</h1>
          <p className="text-sm text-muted-foreground">Grant details and management</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">Grant ID</Badge>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{grantId}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          data-testid="button-copy-grant-id"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>

      <Separator />

      <Card data-testid="card-grant-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Grant Information
          </CardTitle>
          <CardDescription>
            Grant lookup and management requires authorized API access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-md space-y-2">
            <p className="text-sm">
              Grant details are available in the workspace where the share was created.
            </p>
            <p className="text-sm text-muted-foreground">
              To view or revoke this grant, navigate to the original workspace 
              (Emergency Runs, Insurance Claims, or Disputes) where the share action was performed.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Quick Links</div>
            <div className="flex flex-wrap gap-2">
              <Link to="/app/operator/emergency">
                <Button variant="outline" size="sm" data-testid="link-emergency">
                  Emergency Runs
                </Button>
              </Link>
              <Link to="/app/operator/insurance">
                <Button variant="outline" size="sm" data-testid="link-insurance">
                  Insurance Claims
                </Button>
              </Link>
              <Link to="/app/operator/disputes">
                <Button variant="outline" size="sm" data-testid="link-disputes">
                  Disputes
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-2">
            All grant operations are recorded in the operator audit log.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
