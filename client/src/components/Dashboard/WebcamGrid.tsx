import { useEffect, useState } from 'react';
import { Camera, RefreshCw, X, Maximize2, MapPin } from 'lucide-react';

interface Webcam {
  id: number;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  region_id: string;
  metadata: {
    direct_feed_url: string;
    view_description: string;
    source_provider: string;
    live_feed_status: string;
  };
}

interface WebcamGridProps {
  regionId?: string;
  columns?: 2 | 3 | 4 | 6;
  maxWebcams?: number;
}

export function WebcamGrid({ regionId, columns = 4, maxWebcams = 8 }: WebcamGridProps) {
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebcam, setSelectedWebcam] = useState<Webcam | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchWebcams();
  }, [regionId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchWebcams() {
    setLoading(true);
    try {
      const url = regionId && regionId !== 'bc'
        ? `/api/v1/entities?type=webcam&region=${regionId}&limit=${maxWebcams}`
        : `/api/v1/entities?type=webcam&limit=${maxWebcams}`;

      const response = await fetch(url);
      const data = await response.json();
      const webcamData = Array.isArray(data) ? data : (data.entities || []);
      setWebcams(webcamData);
    } catch (error) {
      console.error('Failed to fetch webcams:', error);
    } finally {
      setLoading(false);
    }
  }

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5" /> Live Webcams
          </h3>
        </div>
        <div className={`grid ${gridCols[columns]} gap-4`}>
          {Array(maxWebcams).fill(0).map((_, i) => (
            <div key={i} className="aspect-video bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" /> Live Webcams
          <span className="text-sm font-normal text-muted-foreground">
            ({webcams.length} cameras)
          </span>
        </h3>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-sm text-blue-500 hover:text-blue-400 flex items-center gap-1"
          data-testid="button-refresh-webcams"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className={`grid ${gridCols[columns]} gap-4`}>
        {webcams.map(webcam => (
          <WebcamCard
            key={webcam.id}
            webcam={webcam}
            refreshKey={refreshKey}
            onClick={() => setSelectedWebcam(webcam)}
          />
        ))}
      </div>

      {selectedWebcam && (
        <WebcamModal
          webcam={selectedWebcam}
          refreshKey={refreshKey}
          onClose={() => setSelectedWebcam(null)}
        />
      )}
    </div>
  );
}

interface WebcamCardProps {
  webcam: Webcam;
  refreshKey: number;
  onClick: () => void;
}

function WebcamCard({ webcam, refreshKey, onClick }: WebcamCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [refreshKey]);

  const imageUrl = webcam.metadata?.direct_feed_url 
    ? `${webcam.metadata.direct_feed_url}?t=${refreshKey}`
    : null;

  return (
    <div
      className="group relative bg-muted rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
      onClick={onClick}
      data-testid={`webcam-card-${webcam.id}`}
    >
      <div className="aspect-video relative">
        {imageLoading && !imageError && (
          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        )}

        {imageError || !imageUrl ? (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground text-xs mt-1">Unavailable</p>
            </div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={webcam.name}
            className={`w-full h-full object-cover transition-opacity ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setImageLoading(false)}
            onError={() => { setImageError(true); setImageLoading(false); }}
          />
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-white text-xs font-medium">LIVE</span>
        </div>

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <h4 className="text-white text-sm font-medium truncate">
          {webcam.name}
        </h4>
        {webcam.metadata?.view_description && (
          <p className="text-gray-300 text-xs truncate">
            {webcam.metadata.view_description}
          </p>
        )}
      </div>
    </div>
  );
}

interface WebcamModalProps {
  webcam: Webcam;
  refreshKey: number;
  onClose: () => void;
}

function WebcamModal({ webcam, refreshKey, onClose }: WebcamModalProps) {
  const [localRefresh, setLocalRefresh] = useState(refreshKey);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalRefresh(r => r + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const imageUrl = webcam.metadata?.direct_feed_url
    ? `${webcam.metadata.direct_feed_url}?t=${localRefresh}`
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="modal-webcam"
    >
      <div
        className="max-w-5xl w-full bg-card rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="font-semibold">{webcam.name}</h3>
            <p className="text-muted-foreground text-sm">{webcam.metadata?.view_description}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocalRefresh(r => r + 1)}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
              data-testid="button-modal-refresh"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-modal-close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="relative bg-black">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={webcam.name}
              className="w-full"
            />
          ) : (
            <div className="aspect-video flex items-center justify-center">
              <span className="text-muted-foreground">Image unavailable</span>
            </div>
          )}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-white text-sm font-medium">LIVE</span>
            <span className="text-gray-300 text-xs">Refreshes every 10s</span>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Source: {webcam.metadata?.source_provider || 'DriveBC'}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {webcam.latitude?.toFixed(4)}, {webcam.longitude?.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WebcamGrid;
