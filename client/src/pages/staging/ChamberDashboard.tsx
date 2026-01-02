import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Zap, Droplets, Users, MapPin, TrendingUp } from 'lucide-react';

interface Opportunity {
  id: number;
  chamber_name: string;
  business_name: string;
  business_type: string;
  opportunity_status: string;
  estimated_spots: number;
  has_power_potential: boolean;
  has_water_potential: boolean;
  primary_contact_name: string;
  contact_notes: string;
  property_id?: number;
}

interface Stats {
  total_opportunities: string;
  potential: string;
  contacted: string;
  interested: string;
  active: string;
  declined: string;
  total_potential_spots: string;
  active_spots: string;
  chambers_represented: string;
}

export default function ChamberDashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      const [oppsRes, statsRes] = await Promise.all([
        fetch(`/api/staging/chamber/opportunities${filter !== 'all' ? `?status=${filter}` : ''}`),
        fetch('/api/staging/chamber/stats')
      ]);
      
      const oppsData = await oppsRes.json();
      const statsData = await statsRes.json();
      
      if (oppsData.success) setOpportunities(oppsData.opportunities);
      if (statsData.success) setStats(statsData.stats);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, newStatus: string) {
    try {
      await fetch(`/api/staging/chamber/opportunities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityStatus: newStatus })
      });
      loadData();
    } catch (err) {
      console.error('Failed to update:', err);
    }
  }

  async function convertToProperty(id: number) {
    if (!confirm('Convert this opportunity to an active property?')) return;
    
    try {
      const res = await fetch(`/api/staging/chamber/opportunities/${id}/convert`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(`Created property: ${data.property.name}`);
        loadData();
      }
    } catch (err) {
      console.error('Failed to convert:', err);
    }
  }

  const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    potential: 'secondary',
    contacted: 'outline',
    interested: 'default',
    active: 'default',
    declined: 'destructive'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/staging">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Chamber Integration Dashboard</h1>
            <p className="text-muted-foreground">Manage parking opportunities from Chamber members</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Building2 className="h-4 w-4" />
                  Total Opportunities
                </div>
                <p className="text-2xl font-bold" data-testid="stat-total">{stats.total_opportunities}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Potential Spots
                </div>
                <p className="text-2xl font-bold text-blue-500" data-testid="stat-potential-spots">{stats.total_potential_spots || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Zap className="h-4 w-4" />
                  Active Spots
                </div>
                <p className="text-2xl font-bold text-green-500" data-testid="stat-active-spots">{stats.active_spots || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="h-4 w-4" />
                  Interested
                </div>
                <p className="text-2xl font-bold text-yellow-500" data-testid="stat-interested">{stats.interested}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <MapPin className="h-4 w-4" />
                  Chambers
                </div>
                <p className="text-2xl font-bold text-purple-500" data-testid="stat-chambers">{stats.chambers_represented}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'potential', 'contacted', 'interested', 'active', 'declined'].map(status => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
              data-testid={`filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opportunities ({opportunities.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Business</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Chamber</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Est. Spots</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Utilities</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map(opp => (
                    <tr key={opp.id} className="border-b hover:bg-muted/50" data-testid={`row-opportunity-${opp.id}`}>
                      <td className="py-3 px-2">
                        <p className="font-medium">{opp.business_name}</p>
                        {opp.primary_contact_name && (
                          <p className="text-sm text-muted-foreground">{opp.primary_contact_name}</p>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">{opp.chamber_name}</td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">{opp.business_type}</td>
                      <td className="py-3 px-2 text-center">{opp.estimated_spots || '-'}</td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {opp.has_power_potential && <Zap className="h-4 w-4 text-yellow-500" />}
                          {opp.has_water_potential && <Droplets className="h-4 w-4 text-blue-500" />}
                          {!opp.has_power_potential && !opp.has_water_potential && '-'}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={statusVariants[opp.opportunity_status] || 'secondary'}>
                          {opp.opportunity_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {opp.opportunity_status === 'potential' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus(opp.id, 'contacted')}
                              data-testid={`button-contact-${opp.id}`}
                            >
                              Mark Contacted
                            </Button>
                          )}
                          {opp.opportunity_status === 'contacted' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus(opp.id, 'interested')}
                              data-testid={`button-interested-${opp.id}`}
                            >
                              Mark Interested
                            </Button>
                          )}
                          {opp.opportunity_status === 'interested' && !opp.property_id && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => convertToProperty(opp.id)}
                              data-testid={`button-convert-${opp.id}`}
                            >
                              Convert to Property
                            </Button>
                          )}
                          {opp.property_id && (
                            <Link href={`/staging/${opp.property_id}`}>
                              <Button variant="outline" size="sm" data-testid={`button-view-property-${opp.id}`}>
                                View Property
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {opportunities.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No opportunities found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
