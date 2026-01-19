import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Info, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getProposalRisk, type RiskAdvisory } from '@/lib/api/proposals';
import { useState } from 'react';

interface RiskBannerProps {
  proposalId: string;
}

export function RiskBanner({ proposalId }: RiskBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: riskData, isLoading } = useQuery({
    queryKey: ['/api/p2/public/proposals', proposalId, 'risk'],
    queryFn: () => getProposalRisk(proposalId),
    enabled: !!proposalId,
  });
  
  if (isLoading || !riskData?.ok) {
    return null;
  }
  
  const { riskScore, advisories } = riskData;
  
  if (riskScore < 0.25) {
    return null;
  }
  
  const severityConfig = riskScore >= 0.6 
    ? { bg: 'bg-orange-500/10 border-orange-500/30', icon: AlertTriangle, iconColor: 'text-orange-500', label: 'Elevated Risk' }
    : { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Info, iconColor: 'text-yellow-500', label: 'Advisory' };
  
  const Icon = severityConfig.icon;
  
  return (
    <Card className={`p-4 ${severityConfig.bg}`} data-testid="risk-banner">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full" data-testid="risk-banner-toggle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${severityConfig.iconColor}`} />
              <span className="font-medium">{severityConfig.label}</span>
              <Badge variant="outline" className="ml-2">
                Risk Score: {(riskScore * 100).toFixed(0)}%
              </Badge>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="mt-4 space-y-3" data-testid="risk-advisories">
            {advisories.map((advisory, index) => (
              <AdvisoryItem key={index} advisory={advisory} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function AdvisoryItem({ advisory }: { advisory: RiskAdvisory }) {
  const severityBadge = advisory.severity === 'high' 
    ? 'destructive'
    : advisory.severity === 'medium' 
      ? 'secondary' 
      : 'outline';
  
  return (
    <div className="pl-7 border-l-2 border-muted" data-testid="risk-advisory-item">
      <div className="flex items-start gap-2 mb-1">
        <Badge variant={severityBadge} className="text-xs capitalize">
          {advisory.severity}
        </Badge>
        <span className="text-sm font-medium">{advisory.reason}</span>
      </div>
      <p className="text-sm text-muted-foreground">{advisory.mitigation}</p>
    </div>
  );
}
