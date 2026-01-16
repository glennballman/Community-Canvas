/**
 * UsageSummaryPage - Shows protected actions recorded this period
 * Route: /app/admin/usage
 * 
 * Displays event counts from the monetization ledger (P2.15).
 * NO dollars, NO upgrade banners, NO plan comparisons.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { useMonetizationUsage, type UsageCount } from '@/lib/api/operatorP2/useMonetizationUsage';
import { getEventTypeLabel } from '@/lib/monetization/eventTypeLabels';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  
  return options;
}

export default function UsageSummaryPage() {
  const periodOptions = generatePeriodOptions();
  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0]?.value || '');
  const [includeDrills, setIncludeDrills] = useState(false);
  
  const { data, isLoading, error, refetch } = useMonetizationUsage(selectedPeriod, includeDrills);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator');
        const pageText = document.body.innerText;
        if (pageText.includes('$')) {
          console.error('[UsageSummaryPage] Currency symbol detected. This page must not display any dollar amounts.');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data]);
  
  const isAccessDenied = error?.message?.toLowerCase().includes('access denied');

  return (
    <div className="p-6 space-y-6" data-testid="page-usage-summary">
      <div className="flex items-center gap-3">
        <Link to="/app/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <BarChart3 className="h-6 w-6" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Usage Summary</h1>
          <p className="text-sm text-muted-foreground">Shows protected actions recorded this period.</p>
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

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label htmlFor="period-select" className="text-sm">Period:</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48" data-testid="select-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            id="include-drills"
            checked={includeDrills}
            onCheckedChange={setIncludeDrills}
            data-testid="switch-include-drills"
          />
          <Label htmlFor="include-drills" className="text-sm">Include drills</Label>
        </div>
      </div>

      <Separator />

      {isAccessDenied ? (
        <Card data-testid="card-access-denied">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Admin access required to view usage summary.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact your tenant administrator for access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card data-testid="card-error">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium">Failed to load usage data</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry">
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card data-testid="card-loading">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading usage data...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="card-usage-table">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Recorded Events
              <Badge variant="outline">{data?.period}</Badge>
            </CardTitle>
            <CardDescription>
              Counts are based on the monetization event ledger.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.counts || data.counts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
                No events recorded this period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead className="text-right w-24">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.counts.map((item: UsageCount) => (
                    <TableRow key={item.eventType} data-testid={`row-event-${item.eventType}`}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {getEventTypeLabel(item.eventType)}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-info">
        <CardHeader>
          <CardTitle className="text-base">About Recorded Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This page shows protected actions recorded this period.
          </p>
          <p>
            Exports and authority shares may be recorded as billable events under your plan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
