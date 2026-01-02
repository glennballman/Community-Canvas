import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Property {
    id: number;
    name: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
    nightlyRate?: number;
    rvScore?: number;
    crewScore?: number;
    truckerScore?: number;
    totalSpots?: number;
    hasMechanic?: boolean;
}

interface PropertyMapProps {
    properties: Property[];
    center?: [number, number];
    zoom?: number;
    onPropertyClick?: (property: Property) => void;
    selectedId?: number;
    height?: string;
}

function getMarkerColor(property: Property): string {
    if (property.hasMechanic) return '#22c55e';
    if (property.truckerScore && property.truckerScore > 50) return '#f97316';
    if (property.crewScore && property.crewScore > 50) return '#3b82f6';
    return '#6366f1';
}

function createCustomIcon(color: string, isSelected: boolean): L.DivIcon {
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                width: ${isSelected ? '32px' : '24px'};
                height: ${isSelected ? '32px' : '24px'};
                background: ${color};
                border: 3px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.8)'};
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ${isSelected ? 'transform: scale(1.2);' : ''}
            "></div>
        `,
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        popupAnchor: [0, -12]
    });
}

function MapBoundsHandler({ properties }: { properties: Property[] }) {
    const map = useMap();

    useEffect(() => {
        if (properties.length > 0) {
            const bounds = L.latLngBounds(
                properties.map(p => [p.latitude, p.longitude] as [number, number])
            );
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [properties, map]);

    return null;
}

export default function PropertyMap({
    properties,
    center = [49.2827, -123.1207],
    zoom = 7,
    onPropertyClick,
    selectedId,
    height = '500px'
}: PropertyMapProps) {
    
    return (
        <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden">
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {properties.length > 1 && <MapBoundsHandler properties={properties} />}

                {properties.map(property => (
                    <Marker
                        key={property.id}
                        position={[property.latitude, property.longitude]}
                        icon={createCustomIcon(
                            getMarkerColor(property),
                            property.id === selectedId
                        )}
                        eventHandlers={{
                            click: () => onPropertyClick?.(property)
                        }}
                    >
                        <Popup>
                            <div className="min-w-[200px]">
                                <h3 className="font-bold text-gray-900">{property.name}</h3>
                                <p className="text-gray-600 text-sm">{property.city}, {property.region}</p>
                                
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    {property.totalSpots && (
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">
                                            {property.totalSpots} spots
                                        </span>
                                    )}
                                    {property.hasMechanic && (
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                            Mechanic
                                        </span>
                                    )}
                                </div>

                                {property.nightlyRate && (
                                    <p className="mt-2 text-green-600 font-medium">
                                        ${property.nightlyRate}/night
                                    </p>
                                )}

                                <button
                                    onClick={() => onPropertyClick?.(property)}
                                    className="mt-2 text-blue-600 text-sm hover:underline"
                                    data-testid={`map-view-property-${property.id}`}
                                >
                                    View Details
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
