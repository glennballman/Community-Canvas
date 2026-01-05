import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, Users, RefreshCw, TreePine } from 'lucide-react';

interface TrustSignalsRaw {
  party_id: string;
  reliability_score?: number;
  professionalism_score?: number;
  communication_score?: number;
  community_standing_score?: number;
  response_time_avg_hours?: number;
  repeat_customer_count?: number;
  positive_feedback_count?: number;
  public_appreciation_count?: number;
  years_in_community?: number;
  confidence?: number;
  data_points?: number;
  display_attributes?: string[];
}

interface TrustDisplayData {
  badges: string[];
  stats: Array<{ label: string; value: string }>;
  highlights: string[];
  raw: TrustSignalsRaw;
}

interface TrustSignalsProps {
  partyId: string;
  compact?: boolean;
}

export function TrustSignals({ partyId, compact = false }: TrustSignalsProps) {
  const [display, setDisplay] = useState<TrustDisplayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrustSignals();
  }, [partyId]);

  async function fetchTrustSignals() {
    setLoading(true);
    try {
      const data = await api.get<{ trust_signals?: TrustSignalsRaw; raw?: TrustSignalsRaw; badges?: string[]; stats?: Array<{ label: string; value: string }>; highlights?: string[] }>(
        `/parties/${partyId}/trust-signals?format=display`
      );
      
      const raw = data.trust_signals || data.raw || {} as TrustSignalsRaw;
      
      const badges: string[] = [];
      if (raw.reliability_score && raw.reliability_score >= 80) {
        badges.push('Reliable');
      }
      if (raw.professionalism_score && raw.professionalism_score >= 80) {
        badges.push('Professional');
      }
      if (raw.community_standing_score && raw.community_standing_score >= 80) {
        badges.push('Community Verified');
      }
      if (raw.repeat_customer_count && raw.repeat_customer_count >= 3) {
        badges.push('Repeat Customers');
      }
      if (raw.years_in_community && raw.years_in_community >= 5) {
        badges.push('Established');
      }
      
      const stats: Array<{ label: string; value: string }> = [];
      
      if (raw.repeat_customer_count && raw.repeat_customer_count > 0) {
        stats.push({ label: 'Repeat Customers', value: raw.repeat_customer_count.toString() });
      }
      
      if (raw.public_appreciation_count && raw.public_appreciation_count > 0) {
        stats.push({ label: 'Appreciations', value: raw.public_appreciation_count.toString() });
      }
      
      if (raw.years_in_community) {
        stats.push({ label: 'Years in Community', value: raw.years_in_community.toString() });
      }
      
      if (raw.display_attributes?.includes('response_time') && raw.response_time_avg_hours) {
        const hours = raw.response_time_avg_hours;
        const displayValue = hours < 1 
          ? '< 1 hour' 
          : hours < 24 
            ? `${Math.round(hours)} hours` 
            : `${Math.round(hours / 24)} days`;
        stats.push({ label: 'Avg Response', value: displayValue });
      }
      
      if (raw.confidence && raw.confidence >= 70) {
        stats.push({ label: 'Data Confidence', value: `${raw.confidence}%` });
      }
      
      const highlights = (raw.display_attributes || []).filter(
        (attr: string) => !['response_time'].includes(attr)
      );
      
      setDisplay({
        badges: data.badges || badges,
        stats: data.stats || stats,
        highlights: data.highlights || highlights,
        raw
      });
    } catch (error) {
      console.error('Error fetching trust signals:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-muted rounded h-20"></div>;
  }

  if (!display) {
    return <div className="text-muted-foreground text-sm">No trust data available yet</div>;
  }

  const badgeIcons: Record<string, typeof CheckCircle> = {
    'Reliable': CheckCircle,
    'Professional': Star,
    'Community Verified': Users,
    'Repeat Customers': RefreshCw,
    'Established': TreePine
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {display.badges.map((badge, i) => (
          <Badge key={i} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {badge}
          </Badge>
        ))}
        {display.stats.slice(0, 2).map((stat, i) => (
          <span key={`stat-${i}`} className="text-xs text-muted-foreground">
            {stat.value} {stat.label.toLowerCase()}
          </span>
        ))}
      </div>
    );
  }

  return (
    <Card data-testid="card-trust-signals">
      <CardHeader>
        <CardTitle>Trust Signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {display.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {display.badges.map((badge, i) => {
              const Icon = badgeIcons[badge] || CheckCircle;
              return (
                <Badge 
                  key={i} 
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {badge}
                </Badge>
              );
            })}
          </div>
        )}

        {display.stats.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {display.stats.map((stat, i) => (
              <div key={i} className="text-center p-3 bg-muted/50 rounded">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {display.highlights.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Highlights</div>
            <div className="flex flex-wrap gap-2">
              {display.highlights.map((highlight, i) => (
                <Badge key={i} variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                  {highlight}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {display.raw.reliability_score !== undefined && (
          <div className="space-y-2 mt-4">
            <ScoreBar label="Reliability" score={display.raw.reliability_score} />
            {display.raw.professionalism_score !== undefined && (
              <ScoreBar label="Professionalism" score={display.raw.professionalism_score} />
            )}
            {display.raw.communication_score !== undefined && (
              <ScoreBar label="Communication" score={display.raw.communication_score} />
            )}
            {display.raw.community_standing_score !== undefined && (
              <ScoreBar label="Community Standing" score={display.raw.community_standing_score} />
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Trust signals are aggregated patterns. Individual feedback is private.
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-muted-foreground';
  
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all`} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
