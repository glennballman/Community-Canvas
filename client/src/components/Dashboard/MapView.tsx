import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Entity {
  id: number;
  slug: string;
  name: string;
  entity_type_id: string;
  category: string;
  latitude: number;
  longitude: number;
  region_name?: string;
  metadata?: Record<string, unknown>;
}

interface MapViewProps {
  regionId?: string;
}

const categoryColors: Record<string, string> = {
  'Emergency Services': '#ef4444',
  'Transportation': '#3b82f6',
  'Infrastructure': '#eab308',
  'Community Services': '#22c55e',
  'Business Organizations': '#a855f7',
  'Government': '#f97316',
  'Environment': '#06b6d4',
};

const typeColors: Record<string, string> = {
  'fire-station': '#ef4444',
  'hospital': '#ef4444',
  'rcmp-detachment': '#ef4444',
  'municipal-police': '#ef4444',
  'sar-team': '#ef4444',
  'coast-guard': '#ef4444',
  'airport': '#3b82f6',
  'ferry-terminal': '#3b82f6',
  'webcam': '#3b82f6',
  'bus-transit': '#3b82f6',
  'weather-station': '#eab308',
  'bc-hydro': '#eab308',
  'library': '#22c55e',
  'school': '#22c55e',
  'recreation-centre': '#22c55e',
  'community-centre': '#22c55e',
  'pharmacy': '#22c55e',
  'chamber-member': '#a855f7',
  'fishing-charter': '#a855f7',
  'municipal-office': '#f97316',
  'chamber-of-commerce': '#f97316',
};

export function MapView({ regionId }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [stats, setStats] = useState({ total: 0, visible: 0 });
  const [mapboxToken, setMapboxToken] = useState<string>('');

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch('/api/config/mapbox-token');
        const data = await res.json();
        if (data.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Failed to fetch Mapbox token:', error);
      }
    }
    fetchToken();
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [regionId]);

  async function fetchEntities() {
    setLoading(true);
    try {
      const url = regionId && regionId !== 'bc'
        ? `/api/v1/entities/geo?region=${regionId}&limit=5000`
        : `/api/v1/entities/geo?limit=5000`;
      
      const response = await fetch(url);
      const data = await response.json();
      const entityList = data.entities || data || [];
      setEntities(entityList);
      setStats({ total: entityList.length, visible: entityList.length });
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-123.1207, 49.2827],
      zoom: 6,
      minZoom: 4,
      maxZoom: 18,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!map.current || !mapLoaded || entities.length === 0) return;

    const filtered = entities.filter(e => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (selectedType !== 'all' && e.entity_type_id !== selectedType) return false;
      return e.latitude && e.longitude;
    });

    setStats(s => ({ ...s, visible: filtered.length }));

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filtered.map(entity => ({
        type: 'Feature',
        properties: {
          id: entity.id,
          name: entity.name,
          type: entity.entity_type_id,
          category: entity.category,
          region: entity.region_name,
          color: typeColors[entity.entity_type_id] || categoryColors[entity.category] || '#6b7280',
        },
        geometry: {
          type: 'Point',
          coordinates: [entity.longitude, entity.latitude],
        },
      })),
    };

    if (map.current.getLayer('clusters')) map.current.removeLayer('clusters');
    if (map.current.getLayer('cluster-count')) map.current.removeLayer('cluster-count');
    if (map.current.getLayer('unclustered-point')) map.current.removeLayer('unclustered-point');
    if (map.current.getSource('entities')) map.current.removeSource('entities');

    map.current.addSource('entities', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    map.current.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'entities',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#3b82f6',
          10, '#22c55e',
          50, '#eab308',
          100, '#f97316',
          500, '#ef4444',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          15,
          10, 20,
          50, 25,
          100, 30,
          500, 40,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    map.current.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'entities',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });

    map.current.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'entities',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    map.current.on('click', 'clusters', (e) => {
      const features = map.current!.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties?.cluster_id;
      const source = map.current!.getSource('entities') as mapboxgl.GeoJSONSource;
      
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.current!.easeTo({
          center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
          zoom: zoom!,
        });
      });
    });

    map.current.on('click', 'unclustered-point', (e) => {
      const feature = e.features![0];
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const props = feature.properties!;
      
      const typeName = props.type?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Entity';
      
      new mapboxgl.Popup({ offset: 15 })
        .setLngLat(coords)
        .setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="font-weight: 600; margin: 0 0 4px 0; color: #111;">${props.name}</h3>
            <p style="margin: 0; color: #666; font-size: 12px;">${typeName}</p>
            <p style="margin: 4px 0 0 0; color: #888; font-size: 11px;">${props.region || 'British Columbia'}</p>
          </div>
        `)
        .addTo(map.current!);
    });

    map.current.on('mouseenter', 'clusters', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'clusters', () => {
      map.current!.getCanvas().style.cursor = '';
    });
    map.current.on('mouseenter', 'unclustered-point', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'unclustered-point', () => {
      map.current!.getCanvas().style.cursor = '';
    });

  }, [mapLoaded, entities, selectedCategory, selectedType]);

  const categories = Array.from(new Set(entities.map(e => e.category).filter(Boolean))).sort();
  const types = Array.from(new Set(entities.map(e => e.entity_type_id).filter(Boolean))).sort();

  return (
    <div 
      className="relative rounded-xl border bg-card" 
      style={{ height: '840px', overflow: 'hidden', isolation: 'isolate', contain: 'layout paint' }}
      data-testid="map-view"
    >
      <div 
        ref={mapContainer} 
        className="rounded-xl"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }} 
      />

      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl z-10">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="mt-2">Loading entities...</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur rounded-xl p-4 max-w-xs border">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Map Filters
        </h3>

        <div className="mb-3">
          <label className="text-muted-foreground text-xs uppercase mb-1 block">Category</label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-3">
          <label className="text-muted-foreground text-xs uppercase mb-1 block">Entity Type</label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger data-testid="select-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(type => (
                <SelectItem key={type} value={type}>
                  {type.replace(/-/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-muted-foreground text-xs pt-2 border-t">
          Showing {stats.visible.toLocaleString()} of {stats.total.toLocaleString()} entities
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur rounded-xl p-3 border">
        <h4 className="text-xs font-semibold mb-2">Legend</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {Object.entries(categoryColors).slice(0, 6).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
              <span className="text-muted-foreground truncate">{cat.replace(' Services', '')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-4 right-16 z-10 bg-card/90 backdrop-blur rounded-xl px-4 py-2 border">
        <span className="font-semibold">{stats.visible.toLocaleString()}</span>
        <span className="text-muted-foreground text-sm ml-1">entities</span>
      </div>
    </div>
  );
}

export default MapView;
