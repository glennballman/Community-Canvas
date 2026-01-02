import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Location {
    lat: number;
    lng: number;
    name?: string;
}

interface Property {
    id: number;
    name: string;
    city: string;
    latitude: number;
    longitude: number;
    distanceFromOriginKm: number;
    isSelected?: boolean;
}

interface TripRouteMapProps {
    origin: Location;
    destination: Location;
    properties: Property[];
    selectedStops: number[];
    onPropertyClick?: (property: Property) => void;
    height?: string;
}

const originIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
        width: 30px; height: 30px;
        background: #22c55e;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">A</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

const destinationIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
        width: 30px; height: 30px;
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">B</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

function createPropertyIcon(isSelected: boolean): L.DivIcon {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width: ${isSelected ? '28px' : '20px'};
            height: ${isSelected ? '28px' : '20px'};
            background: ${isSelected ? '#3b82f6' : '#6366f1'};
            border: 3px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.7)'};
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ${isSelected ? 'transform: scale(1.2);' : ''}
        "></div>`,
        iconSize: [isSelected ? 28 : 20, isSelected ? 28 : 20],
        iconAnchor: [isSelected ? 14 : 10, isSelected ? 14 : 10]
    });
}

function FitBoundsHandler({ origin, destination, properties }: {
    origin: Location;
    destination: Location;
    properties: Property[];
}) {
    const map = useMap();

    useEffect(() => {
        const points: [number, number][] = [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
            ...properties.map(p => [p.latitude, p.longitude] as [number, number])
        ];
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
    }, [origin, destination, properties, map]);

    return null;
}

export default function TripRouteMap({
    origin,
    destination,
    properties,
    selectedStops,
    onPropertyClick,
    height = '400px'
}: TripRouteMapProps) {
    const routePositions: [number, number][] = [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
    ];

    const selectedProperties = properties.filter(p => selectedStops.includes(p.id));
    const stopsRoute: [number, number][] = [
        [origin.lat, origin.lng],
        ...selectedProperties
            .sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm)
            .map(p => [p.latitude, p.longitude] as [number, number]),
        [destination.lat, destination.lng]
    ];

    return (
        <div style={{ height }} className="rounded-lg overflow-hidden">
            <MapContainer
                center={[origin.lat, origin.lng]}
                zoom={7}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitBoundsHandler 
                    origin={origin} 
                    destination={destination} 
                    properties={properties} 
                />

                <Polyline
                    positions={routePositions}
                    pathOptions={{ 
                        color: '#6b7280', 
                        weight: 3, 
                        dashArray: '10, 10',
                        opacity: 0.5
                    }}
                />

                {selectedStops.length > 0 && (
                    <Polyline
                        positions={stopsRoute}
                        pathOptions={{ 
                            color: '#3b82f6', 
                            weight: 4,
                            opacity: 0.8
                        }}
                    />
                )}

                <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
                    <Popup>
                        <strong>Start:</strong> {origin.name || 'Origin'}
                    </Popup>
                </Marker>

                <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
                    <Popup>
                        <strong>End:</strong> {destination.name || 'Destination'}
                    </Popup>
                </Marker>

                {properties.map(property => (
                    <Marker
                        key={property.id}
                        position={[property.latitude, property.longitude]}
                        icon={createPropertyIcon(selectedStops.includes(property.id))}
                        eventHandlers={{
                            click: () => onPropertyClick?.(property)
                        }}
                    >
                        <Popup>
                            <div className="min-w-[150px]">
                                <strong className="text-gray-900">{property.name}</strong>
                                <br />
                                <span className="text-gray-600">{property.city}</span>
                                <br />
                                <span className="text-blue-600">
                                    {property.distanceFromOriginKm.toFixed(1)} km from start
                                </span>
                                {selectedStops.includes(property.id) && (
                                    <div className="mt-1 text-green-600 font-medium">
                                        Selected Stop
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
