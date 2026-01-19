import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import PropertyMap from '@/components/PropertyMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, List, Filter, X, Wrench, Zap, Droplets } from 'lucide-react';

interface Property {
    id: number;
    name: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
    totalSpots: number;
    nightlyRate: number | null;
    rvScore: number;
    crewScore: number;
    truckerScore: number;
    hasMechanic: boolean;
    hasPower: boolean;
    hasWater: boolean;
    petsAllowed: boolean;
}

export default function MapSearch() {
    const [, navigate] = useLocation();
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    
    const [region, setRegion] = useState('all');
    const [needsPower, setNeedsPower] = useState(false);
    const [hasMechanic, setHasMechanic] = useState(false);
    const [petsAllowed, setPetsAllowed] = useState(false);
    const [vehicleLength, setVehicleLength] = useState('');
    
    const [showFilters, setShowFilters] = useState(false);

    const loadProperties = useCallback(async () => {
        try {
            let url = '/api/staging/search?limit=100';
            if (region && region !== 'all') url += `&region=${encodeURIComponent(region)}`;
            if (needsPower) url += '&needsPower=true';
            if (hasMechanic) url += '&hasMechanic=true';
            if (petsAllowed) url += '&petsAllowed=true';
            if (vehicleLength) url += `&vehicleLengthFt=${vehicleLength}`;

            const res = await fetch(url);
            const data = await res.json();
            
            if (data.success) {
                const withCoords = data.properties.filter(
                    (p: any) => p.latitude && p.longitude
                );
                setProperties(withCoords);
            }
        } catch (err) {
            console.error('Failed to load properties:', err);
        } finally {
            setLoading(false);
        }
    }, [region, needsPower, hasMechanic, petsAllowed, vehicleLength]);

    useEffect(() => {
        loadProperties();
    }, [loadProperties]);

    const handlePropertyClick = (property: Property) => {
        setSelectedProperty(property);
    };

    const regions = [
        'Vancouver Island',
        'Okanagan',
        'Kootenays',
        'Sea-to-Sky',
        'Fraser Valley',
        'Sunshine Coast',
        'Northern BC',
        'BC Interior'
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="bg-card border-b px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/staging">
                            <Button variant="ghost" size="sm" data-testid="link-list-view">
                                <List className="h-4 w-4 mr-1" /> List View
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <MapPin className="h-5 w-5" /> Map Search
                        </h1>
                        <span className="text-muted-foreground">
                            {properties.length} properties
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        data-testid="toggle-filters"
                    >
                        <Filter className="h-4 w-4 mr-1" />
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </Button>
                </div>

                {showFilters && (
                    <div className="mt-4 flex flex-wrap gap-4 items-center">
                        <Select value={region} onValueChange={setRegion}>
                            <SelectTrigger className="w-48" data-testid="select-region">
                                <SelectValue placeholder="All Regions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Regions</SelectItem>
                                {regions.map(r => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Input
                            type="number"
                            value={vehicleLength}
                            onChange={(e) => setVehicleLength(e.target.value)}
                            placeholder="Vehicle length (ft)"
                            className="w-40"
                            data-testid="input-vehicle-length"
                        />

                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={needsPower}
                                onCheckedChange={(checked) => setNeedsPower(!!checked)}
                                data-testid="checkbox-power"
                            />
                            <Zap className="h-4 w-4" /> Power
                        </label>

                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={hasMechanic}
                                onCheckedChange={(checked) => setHasMechanic(!!checked)}
                                data-testid="checkbox-mechanic"
                            />
                            <Wrench className="h-4 w-4" /> Mechanic
                        </label>

                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={petsAllowed}
                                onCheckedChange={(checked) => setPetsAllowed(!!checked)}
                                data-testid="checkbox-pets"
                            />
                            Pets
                        </label>
                    </div>
                )}
            </div>

            <div className="flex-1 flex">
                <div className="flex-1 relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-card">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <PropertyMap
                            properties={properties}
                            onPropertyClick={handlePropertyClick}
                            selectedId={selectedProperty?.id}
                            height="100%"
                        />
                    )}

                    <Card className="absolute bottom-4 left-4 bg-card/90 backdrop-blur">
                        <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground mb-2">Legend</p>
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span>Has Mechanic</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                    <span>Trucker Friendly</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span>Crew Friendly</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                    <span>General</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {selectedProperty && (
                    <div className="w-96 bg-card border-l overflow-y-auto">
                        <div className="p-4">
                            <div className="flex justify-between items-start gap-2 mb-4">
                                <h2 className="text-xl font-bold">
                                    {selectedProperty.name}
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedProperty(null)}
                                    data-testid="close-sidebar"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <p className="text-muted-foreground mb-4 flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {selectedProperty.city}, {selectedProperty.region}
                            </p>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {selectedProperty.rvScore > 0 && (
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-xs text-muted-foreground">RV</p>
                                        <p className="text-lg font-bold text-green-500">
                                            {selectedProperty.rvScore}
                                        </p>
                                    </div>
                                )}
                                {selectedProperty.crewScore > 0 && (
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-xs text-muted-foreground">Crew</p>
                                        <p className="text-lg font-bold text-blue-500">
                                            {selectedProperty.crewScore}
                                        </p>
                                    </div>
                                )}
                                {selectedProperty.truckerScore > 0 && (
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-xs text-muted-foreground">Trucker</p>
                                        <p className="text-lg font-bold text-orange-500">
                                            {selectedProperty.truckerScore}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Spots</span>
                                    <span>{selectedProperty.totalSpots}</span>
                                </div>
                                {selectedProperty.nightlyRate && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Nightly Rate</span>
                                        <span className="text-green-500 font-medium">
                                            ${selectedProperty.nightlyRate}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {selectedProperty.hasMechanic && (
                                    <Badge className="bg-green-600">
                                        <Wrench className="h-3 w-3 mr-1" /> Mechanic
                                    </Badge>
                                )}
                                {selectedProperty.hasPower && (
                                    <Badge className="bg-yellow-600">
                                        <Zap className="h-3 w-3 mr-1" /> Power
                                    </Badge>
                                )}
                                {selectedProperty.hasWater && (
                                    <Badge className="bg-blue-600">
                                        <Droplets className="h-3 w-3 mr-1" /> Water
                                    </Badge>
                                )}
                                {selectedProperty.petsAllowed && (
                                    <Badge variant="secondary">Pet Friendly</Badge>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Link href={`/staging/${selectedProperty.id}`}>
                                    <Button className="w-full" data-testid="view-details">
                                        View Details
                                    </Button>
                                </Link>
                                <Link href={`/staging/${selectedProperty.id}/reserve`}>
                                    <Button variant="outline" className="w-full" data-testid="book-now">
                                        Reserve Now
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
