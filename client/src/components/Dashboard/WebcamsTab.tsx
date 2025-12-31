import { useEffect, useState } from 'react';
import { Camera, RefreshCw, Search, MapPin, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Webcam {
  id: number;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  region_id: string;
  region_name?: string;
  metadata: {
    direct_feed_url: string;
    view_description: string;
    source_provider: string;
    highway?: string;
  };
}

interface WebcamsTabProps {
  regionId?: string;
}

export function WebcamsTab({ regionId }: WebcamsTabProps) {
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  const [filteredWebcams, setFilteredWebcams] = useState<Webcam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebcam, setSelectedWebcam] = useState<Webcam | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHighway, setSelectedHighway] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  
  const [columns, setColumns] = useState<3 | 4 | 6>(4);

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
      const url = `/api/v1/entities?type=webcam&limit=1500`;
      const response = await fetch(url);
      const data = await response.json();
      const webcamList = data.entities || data || [];
      setWebcams(webcamList);
      setFilteredWebcams(webcamList);
    } catch (error) {
      console.error('Failed to fetch webcams:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = webcams;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(query) ||
        w.metadata?.view_description?.toLowerCase().includes(query) ||
        w.metadata?.highway?.toLowerCase().includes(query)
      );
    }

    if (selectedHighway !== 'all') {
      filtered = filtered.filter(w =>
        w.metadata?.highway === selectedHighway ||
        w.name.toLowerCase().includes(selectedHighway.toLowerCase())
      );
    }

    if (selectedRegion !== 'all') {
      filtered = filtered.filter(w => w.region_id === selectedRegion);
    }

    setFilteredWebcams(filtered);
    setPage(1);
  }, [searchQuery, selectedHighway, selectedRegion, webcams]);

  const highways = Array.from(new Set(webcams.map(w => w.metadata?.highway).filter((h): h is string => Boolean(h)))).sort();
  const regions = Array.from(new Set(webcams.map(w => w.region_name).filter((r): r is string => Boolean(r)))).sort();

  const totalPages = Math.ceil(filteredWebcams.length / pageSize);
  const paginatedWebcams = filteredWebcams.slice((page - 1) * pageSize, page * pageSize);

  const gridCols = {
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-xl p-4 border animate-pulse">
          <div className="h-10 bg-muted rounded w-64 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="aspect-video bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-4 border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Live Webcams
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredWebcams.length} of {webcams.length})
              </span>
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Real-time highway and traffic cameras across BC
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRefreshKey(k => k + 1)}
              size="sm"
              data-testid="button-refresh-webcams"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh All
            </Button>
            
            <div className="flex bg-muted rounded-lg p-1">
              {[3, 4, 6].map(cols => (
                <button
                  key={cols}
                  onClick={() => setColumns(cols as 3 | 4 | 6)}
                  className={`px-3 py-1 rounded text-sm ${
                    columns === cols 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`button-columns-${cols}`}
                >
                  {cols}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search cameras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-webcams"
            />
          </div>

          <Select value={selectedHighway} onValueChange={setSelectedHighway}>
            <SelectTrigger className="w-[180px]" data-testid="select-highway">
              <SelectValue placeholder="All Highways" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Highways</SelectItem>
              {highways.map(hw => (
                <SelectItem key={hw} value={hw!}>{hw}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px]" data-testid="select-webcam-region">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map(region => (
                <SelectItem key={region} value={region!}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[140px]" data-testid="select-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 per page</SelectItem>
              <SelectItem value="24">24 per page</SelectItem>
              <SelectItem value="48">48 per page</SelectItem>
              <SelectItem value="96">96 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`grid ${gridCols[columns]} gap-4`}>
        {paginatedWebcams.map(webcam => (
          <WebcamCard
            key={webcam.id}
            webcam={webcam}
            refreshKey={refreshKey}
            onClick={() => setSelectedWebcam(webcam)}
          />
        ))}
      </div>

      {filteredWebcams.length === 0 && (
        <div className="bg-card rounded-xl p-12 text-center border">
          <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">No webcams match your filters</p>
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setSelectedHighway('all');
              setSelectedRegion('all');
            }}
            className="mt-2"
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(1)}
            disabled={page === 1}
            data-testid="button-page-first"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            data-testid="button-page-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="px-4 py-2 text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            data-testid="button-page-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            data-testid="button-page-last"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {selectedWebcam && (
        <WebcamModal
          webcam={selectedWebcam}
          refreshKey={refreshKey}
          onClose={() => setSelectedWebcam(null)}
          onNext={() => {
            const idx = filteredWebcams.findIndex(w => w.id === selectedWebcam.id);
            if (idx < filteredWebcams.length - 1) {
              setSelectedWebcam(filteredWebcams[idx + 1]);
            }
          }}
          onPrev={() => {
            const idx = filteredWebcams.findIndex(w => w.id === selectedWebcam.id);
            if (idx > 0) {
              setSelectedWebcam(filteredWebcams[idx - 1]);
            }
          }}
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
      className="group relative bg-card rounded-lg overflow-hidden cursor-pointer border hover:ring-2 hover:ring-primary transition-all"
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
              <Camera className="w-8 h-8 mx-auto text-muted-foreground" />
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

      <div className="p-3">
        <h4 className="text-sm font-medium truncate">
          {webcam.name}
        </h4>
        {webcam.metadata?.view_description && (
          <p className="text-muted-foreground text-xs truncate mt-0.5">
            {webcam.metadata.view_description}
          </p>
        )}
        {webcam.region_name && (
          <p className="text-muted-foreground/70 text-xs mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {webcam.region_name}
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
  onNext: () => void;
  onPrev: () => void;
}

function WebcamModal({ webcam, refreshKey, onClose, onNext, onPrev }: WebcamModalProps) {
  const [localRefresh, setLocalRefresh] = useState(refreshKey);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalRefresh(r => r + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev]);

  const imageUrl = webcam.metadata?.direct_feed_url
    ? `${webcam.metadata.direct_feed_url}?t=${localRefresh}`
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onClick={onClose}
      data-testid="webcam-modal"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
        data-testid="button-modal-prev"
      >
        <ChevronLeft className="w-8 h-8" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
        data-testid="button-modal-next"
      >
        <ChevronRight className="w-8 h-8" />
      </Button>

      <div
        className="max-w-6xl w-full mx-4 bg-card rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b gap-4">
          <div>
            <h3 className="font-semibold">{webcam.name}</h3>
            <p className="text-muted-foreground text-sm">
              {webcam.metadata?.view_description}
              {webcam.region_name && ` • ${webcam.region_name}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLocalRefresh(r => r + 1)}
              data-testid="button-modal-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-modal-close"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="relative bg-black">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={webcam.name}
              className="w-full max-h-[70vh] object-contain"
            />
          ) : (
            <div className="aspect-video flex items-center justify-center">
              <span className="text-muted-foreground">Image unavailable</span>
            </div>
          )}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-white text-sm font-medium">LIVE</span>
            <span className="text-gray-300 text-xs">Auto-refresh 10s</span>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between gap-4 flex-wrap text-sm text-muted-foreground">
          <span>Source: {webcam.metadata?.source_provider || 'DriveBC'}</span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {webcam.latitude?.toFixed(4)}, {webcam.longitude?.toFixed(4)}
          </span>
          <span className="text-xs">Arrow keys to navigate, ESC to close</span>
        </div>
      </div>
    </div>
  );
}

export default WebcamsTab;
