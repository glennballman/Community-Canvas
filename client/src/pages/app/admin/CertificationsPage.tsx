/**
 * CertificationsPage - Read-only SCM Certification Ledger Viewer
 * Route: /app/admin/certifications
 * 
 * Displays the latest P2 operator certification artifact.
 * NO pricing UI/CTAs. Admin-only. Informational.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ShieldCheck, ArrowLeft, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { useLatestP2OperatorCert, type CertModule, type P2OperatorCert } from '@/lib/api/admin/useLatestP2OperatorCert';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

function StatusBadge({ status }: { status: 'PASS' | 'HELD' | 'FAIL' }) {
  const variant = status === 'PASS' ? 'default' : status === 'HELD' ? 'secondary' : 'destructive';
  return <Badge variant={variant} data-testid={`badge-status-${status.toLowerCase()}`}>{status}</Badge>;
}

function ModuleChecksTable({ mod, name }: { mod: CertModule; name: string }) {
  const passCount = mod.checks.filter(c => c.status === 'PASS').length;
  const heldCount = mod.checks.filter(c => c.status === 'HELD').length;
  const failCount = mod.checks.filter(c => c.status === 'FAIL').length;

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        Checks: {passCount} pass, {heldCount} held, {failCount} fail
      </div>
      <div className="space-y-1">
        {mod.checks.map((check, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <StatusBadge status={check.status} />
            <span className="font-mono text-xs">{check.name}</span>
            {check.detail && (
              <span className="text-muted-foreground text-xs">- {check.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CertDetails({ cert }: { cert: P2OperatorCert }) {
  const moduleEntries = Object.entries(cert.modules) as [string, CertModule][];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                P2 Operator Certification
                <StatusBadge status={cert.summary.overall_status} />
              </CardTitle>
              <CardDescription>
                Generated: {new Date(cert.generated_at).toLocaleString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Version</div>
              <div className="font-mono">{cert.cert_version}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Proof SHA256</div>
              <div className="font-mono text-xs truncate" title={cert.input?.proof_sha256 || ''}>
                {cert.input?.proof_sha256 ? `${cert.input.proof_sha256.slice(0, 16)}...` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Base URL</div>
              <div className="font-mono text-xs">{cert.input?.base_url || 'N/A'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-mono text-xs">
                {cert.input?.started_at ? new Date(cert.input.started_at).toLocaleTimeString() : 'N/A'}
                {' - '}
                {cert.input?.finished_at ? new Date(cert.input.finished_at).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Badge variant="default">{cert.summary?.pass_modules ?? 0}</Badge>
              <span className="text-muted-foreground">Pass</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary">{cert.summary?.held_modules ?? 0}</Badge>
              <span className="text-muted-foreground">Held</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="destructive">{cert.summary?.fail_modules ?? 0}</Badge>
              <span className="text-muted-foreground">Fail</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Module Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pass/Held/Fail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moduleEntries.map(([name, mod]) => (
                <TableRow key={name} data-testid={`row-module-${name}`}>
                  <TableCell className="font-medium capitalize">{name}</TableCell>
                  <TableCell className="text-right">
                    {mod.required ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={mod.status} />
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="text-green-600">{(mod.checks || []).filter(c => c.status === 'PASS').length}</span>
                    {' / '}
                    <span className="text-yellow-600">{(mod.checks || []).filter(c => c.status === 'HELD').length}</span>
                    {' / '}
                    <span className="text-red-600">{(mod.checks || []).filter(c => c.status === 'FAIL').length}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Check Details</CardTitle>
          <CardDescription>Expand modules to see individual check results</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {moduleEntries.map(([name, mod]) => (
              <AccordionItem key={name} value={name}>
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="capitalize font-medium">{name}</span>
                    <StatusBadge status={mod.status} />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ModuleChecksTable mod={mod} name={name} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>IDs and references captured during certification</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="ids">
              <AccordionTrigger className="text-sm">IDs Created</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs overflow-auto max-h-64 bg-muted p-3 rounded">
                  {JSON.stringify(cert.evidence?.ids || {}, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="assertions">
              <AccordionTrigger className="text-sm">
                Assertions ({(cert.evidence?.assertions || []).length})
              </AccordionTrigger>
              <AccordionContent>
                {(cert.evidence?.assertions || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No assertions recorded</div>
                ) : (
                  <div className="space-y-1">
                    {(cert.evidence?.assertions || []).map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Badge variant={a.pass ? 'default' : 'destructive'}>
                          {a.pass ? 'PASS' : 'FAIL'}
                        </Badge>
                        <span>{a.assert}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link to="/app/admin/usage">
          <Button variant="outline" data-testid="link-usage">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Usage Summary
          </Button>
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-medium">No Certification Available</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No certification artifact is available in this environment.
            </p>
            <p className="text-sm text-muted-foreground">
              Run QA + SCM ingest to generate artifacts.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CertificationsPage() {
  const { data: cert, isLoading, error, refetch } = useLatestP2OperatorCert();

  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cert]);

  return (
    <div className="p-6 space-y-6" data-testid="page-certifications">
      <div className="flex items-center gap-3">
        <Link to="/app/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <ShieldCheck className="h-6 w-6" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Certifications</h1>
          <p className="text-sm text-muted-foreground">SCM certification status and evidence</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !cert && <EmptyState />}

      {!isLoading && cert && <CertDetails cert={cert} />}
    </div>
  );
}
