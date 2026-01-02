import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    MapPin, Search, Route, Loader2, ArrowLeft, Plus, X,
    Zap, Wrench, Tent
} from 'lucide-react';
import TripRouteMap from '@/components/TripRouteMap';

interface Location {
    lat: number;
    lng: number;
    name: string;
}

interface Property {
    id: number;
    name: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
    distanceFromOriginKm: number;
    nightlyRate: number | null;
    hasPower: boolean;
    hasMechanic: boolean;
    totalSpots: number;
}

const BC_LOCATIONS: Record<string, Location> = {
    'Vancouver': { lat: 49.2827, lng: -123.1207, name: 'Vancouver' },
    'Victoria': { lat: 48.4284, lng: -123.3656, name: 'Victoria' },
    'Kelowna': { lat: 49.8880, lng: -119.4960, name: 'Kelowna' },
    'Kamloops': { lat: 50.6745, lng: -120.3273, name: 'Kamloops' },
    'Prince George': { lat: 53.9171, lng: -122.7497, name: 'Prince George' },
    'Nanaimo': { lat: 49.1659, lng: -123.9401, name: 'Nanaimo' },
    'Tofino': { lat: 49.1530, lng: -125.9066, name: 'Tofino' },
    'Whistler': { lat: 50.1163, lng: -122.9574, name: 'Whistler' },
    'Revelstoke': { lat: 51.0000, lng: -118.2000, name: 'Revelstoke' },
    'Nelson': { lat: 49.4928, lng: -117.2948, name: 'Nelson' },
    'Fernie': { lat: 49.5040, lng: -115.0631, name: 'Fernie' },
    'Osoyoos': { lat: 49.0322, lng: -119.4693, name: 'Osoyoos' },
    'Penticton': { lat: 49.4991, lng: -119.5937, name: 'Penticton' },
    'Vernon': { lat: 50.2671, lng: -119.2720, name: 'Vernon' },
    'Cranbrook': { lat: 49.5097, lng: -115.7688, name: 'Cranbrook' }
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

interface TripRoutePlannerProps {
    onBack?: () => void;
}

export function TripRoutePlanner({ onBack }: TripRoutePlannerProps) {
    const [originName, setOriginName] = useState('');
    const [destinationName, setDestinationName] = useState('');
    const [origin, setOrigin] = useState<Location | null>(null);
    const [destination, setDestination] = useState<Location | null>(null);
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedStops, setSelectedStops] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [maxDistanceKm, setMaxDistanceKm] = useState(50);

    const handleSearch = useCallback(async () => {
        const originLoc = BC_LOCATIONS[originName];
        const destLoc = BC_LOCATIONS[destinationName];
        
        if (!originLoc || !destLoc) {
            return;
        }

        setOrigin(originLoc);
        setDestination(destLoc);
        setLoading(true);
        setSearched(true);

        try {
            const res = await fetch('/api/staging/search?limit=100');
            const data = await res.json();
            
            if (data.success && data.properties) {
                const routeProps = data.properties
                    .filter((p: any) => p.latitude && p.longitude)
                    .map((p: any) => {
                        const distFromOrigin = calculateDistance(
                            originLoc.lat, originLoc.lng,
                            p.latitude, p.longitude
                        );
                        const distFromDest = calculateDistance(
                            destLoc.lat, destLoc.lng,
                            p.latitude, p.longitude
                        );
                        const routeDist = calculateDistance(
                            originLoc.lat, originLoc.lng,
                            destLoc.lat, destLoc.lng
                        );
                        
                        const minDistToRoute = Math.min(
                            distFromOrigin + distFromDest - routeDist,
                            Math.min(distFromOrigin, distFromDest)
                        );

                        return {
                            id: p.id,
                            name: p.name,
                            city: p.city,
                            region: p.region,
                            latitude: p.latitude,
                            longitude: p.longitude,
                            distanceFromOriginKm: Math.round(distFromOrigin * 10) / 10,
                            nightlyRate: p.baseNightlyRate ? parseFloat(p.baseNightlyRate) : null,
                            hasPower: p.hasPower,
                            hasMechanic: p.hasMechanic,
                            totalSpots: p.totalSpots,
                            minDistToRoute
                        };
                    })
                    .filter((p: any) => p.minDistToRoute < maxDistanceKm)
                    .sort((a: any, b: any) => a.distanceFromOriginKm - b.distanceFromOriginKm);

                setProperties(routeProps);
            }
        } catch (err) {
            console.error('Failed to search properties:', err);
        } finally {
            setLoading(false);
        }
    }, [originName, destinationName, maxDistanceKm]);

    const toggleStop = (id: number) => {
        setSelectedStops(prev => 
            prev.includes(id) 
                ? prev.filter(s => s !== id)
                : [...prev, id]
        );
    };

    const selectedProperties = properties.filter(p => selectedStops.includes(p.id));
    const totalDistance = origin && destination 
        ? calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng)
        : 0;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        )}
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Route className="w-5 h-5 text-primary" />
                                Trip Route Planner
                            </CardTitle>
                            <CardDescription>Plan your route and find stops along the way</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="origin">Start Location</Label>
                            <select
                                id="origin"
                                value={originName}
                                onChange={(e) => setOriginName(e.target.value)}
                                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                                data-testid="select-origin"
                            >
                                <option value="">Select origin...</option>
                                {Object.keys(BC_LOCATIONS).map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="destination">End Location</Label>
                            <select
                                id="destination"
                                value={destinationName}
                                onChange={(e) => setDestinationName(e.target.value)}
                                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                                data-testid="select-destination"
                            >
                                <option value="">Select destination...</option>
                                {Object.keys(BC_LOCATIONS).map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="maxDistance">Max Distance from Route (km)</Label>
                            <Input
                                id="maxDistance"
                                type="number"
                                value={maxDistanceKm}
                                onChange={(e) => setMaxDistanceKm(parseInt(e.target.value) || 50)}
                                className="mt-1"
                                data-testid="input-max-distance"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button 
                                onClick={handleSearch}
                                disabled={!originName || !destinationName || loading}
                                className="w-full"
                                data-testid="button-search-route"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4 mr-2" />
                                )}
                                Find Stops
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {searched && origin && destination && (
                <>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center justify-between">
                                <span>Route Overview</span>
                                <Badge variant="secondary">
                                    {Math.round(totalDistance)} km total
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                <MapPin className="w-4 h-4 text-green-500" />
                                <span>{origin.name}</span>
                                <span className="mx-2">→</span>
                                <MapPin className="w-4 h-4 text-red-500" />
                                <span>{destination.name}</span>
                            </div>
                            
                            <TripRouteMap
                                origin={origin}
                                destination={destination}
                                properties={properties}
                                selectedStops={selectedStops}
                                onPropertyClick={(p) => toggleStop(p.id)}
                                height="400px"
                            />

                            <div className="mt-4 flex flex-wrap gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span>Start</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span>End</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                                    <span>Available Stops</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span>Selected Stops</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {selectedStops.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Selected Stops ({selectedStops.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {selectedProperties
                                        .sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm)
                                        .map((prop, idx) => (
                                        <div key={prop.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline">{idx + 1}</Badge>
                                                <div>
                                                    <p className="font-medium">{prop.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {prop.distanceFromOriginKm} km from start
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => toggleStop(prop.id)}
                                                data-testid={`button-remove-stop-${prop.id}`}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">
                                Available Stops ({properties.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">
                                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
                                </div>
                            ) : properties.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Tent className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No stops found along this route</p>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {properties.map(prop => (
                                        <div
                                            key={prop.id}
                                            className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                                                selectedStops.includes(prop.id)
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-border hover:bg-muted'
                                            }`}
                                            onClick={() => toggleStop(prop.id)}
                                            data-testid={`stop-${prop.id}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    checked={selectedStops.includes(prop.id)}
                                                    onCheckedChange={() => toggleStop(prop.id)}
                                                />
                                                <div>
                                                    <p className="font-medium">{prop.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {prop.city} - {prop.distanceFromOriginKm} km from start
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        {prop.hasPower && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                <Zap className="w-3 h-3 mr-1" /> Power
                                                            </Badge>
                                                        )}
                                                        {prop.hasMechanic && (
                                                            <Badge className="bg-green-600 text-xs">
                                                                <Wrench className="w-3 h-3 mr-1" /> Mechanic
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {prop.nightlyRate && (
                                                    <p className="font-medium text-green-500">
                                                        ${prop.nightlyRate}/night
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    {prop.totalSpots} spots
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

export default TripRoutePlanner;
