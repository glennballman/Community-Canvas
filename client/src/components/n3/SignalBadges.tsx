/**
 * N3 Signal Badges Component
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 */

import { Badge } from '@/components/ui/badge';
import { Waves, Cloud, AlertTriangle, Thermometer } from 'lucide-react';

interface SignalFinding {
  signalType: string;
  riskLevel: string;
  message: string;
}

interface SignalBadgesProps {
  findings: SignalFinding[];
  compact?: boolean;
}

function getRiskColor(level: string): string {
  switch (level) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-yellow-500 text-black';
    case 'low':
      return 'bg-blue-400 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

function getSignalIcon(type: string) {
  switch (type) {
    case 'tide':
      return <Waves className="h-3 w-3" />;
    case 'weather':
      return <Cloud className="h-3 w-3" />;
    default:
      return <AlertTriangle className="h-3 w-3" />;
  }
}

export function SignalBadges({ findings, compact = false }: SignalBadgesProps) {
  if (compact) {
    const groupedByType: Record<string, SignalFinding[]> = {};
    for (const f of findings) {
      if (!groupedByType[f.signalType]) {
        groupedByType[f.signalType] = [];
      }
      groupedByType[f.signalType].push(f);
    }

    const maxLevel = (findings: SignalFinding[]): string => {
      const levels = ['critical', 'high', 'medium', 'low', 'none'];
      let max = 'none';
      for (const f of findings) {
        const idx = levels.indexOf(f.riskLevel);
        const currIdx = levels.indexOf(max);
        if (idx < currIdx) max = f.riskLevel;
      }
      return max;
    };

    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(groupedByType).map(([type, typeFindings]) => (
          <Badge
            key={type}
            variant="outline"
            className={`${getRiskColor(maxLevel(typeFindings))} gap-1`}
            data-testid={`signal-badge-${type}`}
          >
            {getSignalIcon(type)}
            <span className="capitalize">{type}</span>
            <span className="ml-1 opacity-75">({typeFindings.length})</span>
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {findings.map((finding, idx) => (
        <Badge
          key={idx}
          variant="outline"
          className={`${getRiskColor(finding.riskLevel)} gap-1`}
          title={finding.message}
          data-testid={`signal-badge-${finding.signalType}-${idx}`}
        >
          {getSignalIcon(finding.signalType)}
          <span className="capitalize">{finding.signalType}</span>
          <span className="text-xs opacity-75 ml-1">{finding.riskLevel}</span>
        </Badge>
      ))}
    </div>
  );
}

interface RiskScoreBadgeProps {
  score: number;
  level: string;
}

export function RiskScoreBadge({ score, level }: RiskScoreBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={`${getRiskColor(level)} font-mono`}
      data-testid="risk-score-badge"
    >
      {(score * 100).toFixed(0)}% {level}
    </Badge>
  );
}
