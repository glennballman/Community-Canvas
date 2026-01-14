import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Shield, RefreshCw, AlertCircle, AlertTriangle, Activity, Building2, 
    MapPin, Wrench, Zap, CheckCircle, Clock, Server, TrendingUp
} from 'lucide-react';

interface Signal {
    id: number;
    signalCode: string;
    signalName: string;
    category: string;
    severity: string;
    property: {
        id: number;
        name: string;
        city: string;
    } | null;
    region: string;
    coordinates: { lat: number | null; lng: number | null };
    data: any;
    message: string;
    detectedAt: string;
    expiresAt: string;
}

interface Stats {
    signals: {
        active: number;
        critical: number;
        high: number;
        resolved24h: number;
        regionsAffected: number;
    };
    capacity: {
        properties: number;
        spots: number;
        withMechanic: number;
    };
}

interface RegionCapacity {
    region: string;
    properties: number;
    spots: number;
    poweredSpots: number;
    avgRvScore: number;
    avgCrewScore: number;
}

export default function CivOSDashboard() {
    const [signals, setSignals] = useState<Signal[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [regions, setRegions] = useState<RegionCapacity[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [selectedSeverity, setSelectedSeverity] = useState('all');
    const [autoRefresh, setAutoRefresh] = useState(true);

    const loadData = useCallback(async () => {
        try {
            let signalUrl = '/api/civos/signals?limit=50';
            if (selectedRegion && selectedRegion !== 'all') signalUrl += `&region=${encodeURIComponent(selectedRegion)}`;
            if (selectedSeverity && selectedSeverity !== 'all') signalUrl += `&severity=${selectedSeverity}`;

            const [signalsRes, statsRes, capacityRes] = await Promise.all([
                fetch(signalUrl),
                fetch('/api/civos/stats'),
                fetch('/api/civos/capacity')
            ]);

            const [signalsData, statsData, capacityData] = await Promise.all([
                signalsRes.json(),
                statsRes.json(),
                capacityRes.json()
            ]);

            if (signalsData.success) setSignals(signalsData.signals);
            if (statsData.success) setStats(statsData.stats);
            if (capacityData.success) setRegions(capacityData.capacity.byRegion || []);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedRegion, selectedSeverity]);

    useEffect(() => {
        loadData();
        
        let interval: ReturnType<typeof setInterval> | undefined;
        if (autoRefresh) {
            interval = setInterval(loadData, 30000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loadData, autoRefresh]);

    async function generateSignals() {
        setGenerating(true);
        const token = localStorage.getItem('accessToken');
        
        try {
            const res = await fetch('/api/civos/signals/generate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                loadData();
            }
        } catch (err) {
            console.error('Failed to generate signals:', err);
        } finally {
            setGenerating(false);
        }
    }

    async function resolveSignal(signalId: number) {
        const token = localStorage.getItem('accessToken');
        
        try {
            await fetch(`/api/civos/signals/${signalId}/resolve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ reason: 'Manually resolved from dashboard' })
            });
            loadData();
        } catch (err) {
            console.error('Failed to resolve signal:', err);
        }
    }

    function getSeverityBadge(severity: string) {
        switch (severity) {
            case 'critical':
                return <Badge variant="destructive" className="animate-pulse">{severity}</Badge>;
            case 'high':
                return <Badge className="bg-orange-600">{severity}</Badge>;
            case 'medium':
                return <Badge className="bg-yellow-600">{severity}</Badge>;
            case 'low':
                return <Badge className="bg-green-600">{severity}</Badge>;
            default:
                return <Badge variant="outline">{severity}</Badge>;
        }
    }

    function getCategoryIcon(category: string) {
        switch (category) {
            case 'capacity':
                return <TrendingUp className="w-4 h-4" />;
            case 'emergency':
                return <AlertCircle className="w-4 h-4" />;
            case 'infrastructure':
                return <Wrench className="w-4 h-4" />;
            case 'community':
                return <Building2 className="w-4 h-4" />;
            default:
                return <Activity className="w-4 h-4" />;
        }
    }

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                                <Shield className="w-6 h-6" />
                                Community Canvas Operations Dashboard
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                Real-time staging network signals for emergency operations
                            </p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={autoRefresh}
                                    onCheckedChange={(checked) => setAutoRefresh(checked === true)}
                                    data-testid="checkbox-auto-refresh"
                                />
                                Auto-refresh (30s)
                            </label>
                            <Button
                                onClick={generateSignals}
                                disabled={generating}
                                data-testid="button-generate-signals"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                                {generating ? 'Generating...' : 'Generate Signals'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                        <Card data-testid="card-stat-active">
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground text-xs uppercase">Active Signals</p>
                                <p className="text-3xl font-bold">{stats.signals.active}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-destructive" data-testid="card-stat-critical">
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground text-xs uppercase">Critical</p>
                                <p className="text-3xl font-bold text-destructive">{stats.signals.critical}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-orange-500" data-testid="card-stat-high">
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground text-xs uppercase">High</p>
                                <p className="text-3xl font-bold text-orange-500">{stats.signals.high}</p>
                            </CardContent>
                        </Card>
                        <Card data-testid="card-stat-properties">
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground text-xs uppercase">Properties</p>
                                <p className="text-3xl font-bold text-blue-500">{stats.capacity.properties}</p>
                            </CardContent>
                        </Card>
                        <Card data-testid="card-stat-spots">
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground text-xs uppercase">Total Spots</p>
                                <p className="text-3xl font-bold text-green-500">{stats.capacity.spots.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card data-testid="card-stat-mechanic">
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground text-xs uppercase">With Mechanic</p>
                                <p className="text-3xl font-bold text-purple-500">{stats.capacity.withMechanic}</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                                <CardTitle className="text-lg">
                                    Active Signals ({signals.length})
                                </CardTitle>
                                <div className="flex gap-2 flex-wrap">
                                    <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                                        <SelectTrigger className="w-32" data-testid="select-severity">
                                            <SelectValue placeholder="Severity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Severities</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                                        <SelectTrigger className="w-40" data-testid="select-region">
                                            <SelectValue placeholder="Region" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Regions</SelectItem>
                                            {regions.map(r => (
                                                <SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="divide-y max-h-[600px] overflow-y-auto">
                                    {loading ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Loading signals...
                                        </div>
                                    ) : signals.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            No active signals. Click "Generate Signals" to create capacity signals.
                                        </div>
                                    ) : (
                                        signals.map(signal => (
                                            <div key={signal.id} className="p-4 hover-elevate" data-testid={`signal-row-${signal.id}`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <div className="flex-shrink-0 mt-1">
                                                            {getCategoryIcon(signal.category)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-muted-foreground text-sm uppercase">
                                                                    {signal.category}
                                                                </span>
                                                                <span className="font-medium">
                                                                    {signal.signalName}
                                                                </span>
                                                                {getSeverityBadge(signal.severity)}
                                                            </div>
                                                            <p className="text-sm mt-1">{signal.message}</p>
                                                            {signal.property && (
                                                                <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {signal.property.name}, {signal.property.city}
                                                                </p>
                                                            )}
                                                            <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(signal.detectedAt).toLocaleString()}
                                                                {signal.expiresAt && (
                                                                    <span className="ml-2">
                                                                        Expires: {new Date(signal.expiresAt).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => resolveSignal(signal.id)}
                                                        className="flex-shrink-0"
                                                        data-testid={`button-resolve-${signal.id}`}
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Resolve
                                                    </Button>
                                                </div>

                                                {signal.data && (
                                                    <div className="mt-3 bg-muted rounded p-2 text-xs ml-7">
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            {signal.data.total_spots !== undefined && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Total:</span>{' '}
                                                                    <span className="font-medium">{signal.data.total_spots}</span>
                                                                </div>
                                                            )}
                                                            {signal.data.available_spots !== undefined && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Available:</span>{' '}
                                                                    <span className="text-green-500 font-medium">{signal.data.available_spots}</span>
                                                                </div>
                                                            )}
                                                            {signal.data.utilization_percent !== undefined && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Utilization:</span>{' '}
                                                                    <span className="text-yellow-500 font-medium">{signal.data.utilization_percent}%</span>
                                                                </div>
                                                            )}
                                                            {signal.data.has_mechanic && (
                                                                <div className="text-green-500 flex items-center gap-1">
                                                                    <Wrench className="w-3 h-3" /> Mechanic
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Regional Capacity</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y max-h-[400px] overflow-y-auto">
                                    {regions.map(region => (
                                        <div 
                                            key={region.region} 
                                            className={`p-3 cursor-pointer hover-elevate ${selectedRegion === region.region ? 'bg-muted' : ''}`}
                                            onClick={() => setSelectedRegion(selectedRegion === region.region ? 'all' : region.region)}
                                            data-testid={`region-row-${region.region}`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <p className="font-medium">{region.region}</p>
                                                    <p className="text-muted-foreground text-sm">
                                                        {region.properties} properties
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-blue-500 font-medium">{region.spots} spots</p>
                                                    <p className="text-yellow-500 text-sm flex items-center gap-1 justify-end">
                                                        <Zap className="w-3 h-3" /> {region.poweredSpots}
                                                    </p>
                                                </div>
                                            </div>
                                            {(region.avgRvScore > 0 || region.avgCrewScore > 0) && (
                                                <div className="mt-2 flex gap-4 text-xs">
                                                    {region.avgRvScore > 0 && (
                                                        <span className="text-muted-foreground">
                                                            RV: <span className="text-green-500">{Math.round(region.avgRvScore)}</span>
                                                        </span>
                                                    )}
                                                    {region.avgCrewScore > 0 && (
                                                        <span className="text-muted-foreground">
                                                            Crew: <span className="text-blue-500">{Math.round(region.avgCrewScore)}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Server className="w-5 h-5" />
                                    CivOS API Endpoints
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="bg-muted rounded p-2 font-mono">
                                    <Badge className="bg-green-600 mr-2">GET</Badge>
                                    /api/civos/signals
                                </div>
                                <div className="bg-muted rounded p-2 font-mono">
                                    <Badge className="bg-green-600 mr-2">GET</Badge>
                                    /api/civos/capacity
                                </div>
                                <div className="bg-muted rounded p-2 font-mono">
                                    <Badge className="bg-green-600 mr-2">GET</Badge>
                                    /api/civos/properties
                                </div>
                                <div className="bg-muted rounded p-2 font-mono">
                                    <Badge className="bg-green-600 mr-2">GET</Badge>
                                    /api/civos/export
                                </div>
                                <p className="text-muted-foreground text-xs mt-2">
                                    These endpoints are publicly accessible for CivOS integration.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
