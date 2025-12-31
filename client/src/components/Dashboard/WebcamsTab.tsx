import { useEffect, useState, useMemo } from 'react';
import { 
  Camera, RefreshCw, Search, MapPin, X, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Maximize2, Ship, Mountain, Car, 
  Building2, Navigation, Globe 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

interface WebcamCategory {
  source: string;
  subCategory: string;
  highway: string | null;
}

function categorizeWebcam(webcam: Webcam): WebcamCategory {
  const name = webcam.name.toLowerCase();
  const desc = (webcam.metadata?.view_description || '').toLowerCase();
  
  let highway: string | null = null;
  const hwMatch = name.match(/(?:highway|hwy|hw)\s*(\d+[a-z]?)/i) || 
                  desc.match(/(?:highway|hwy|hw)\s*(\d+[a-z]?)/i);
  if (hwMatch) {
    highway = `Highway ${hwMatch[1].toUpperCase()}`;
  }
  
  const ferryTerminals = [
    'tsawwassen', 'swartz bay', 'horseshoe bay', 'nanaimo', 'duke point',
    'langdale', 'departure bay', 'comox', 'powell river', 'texada',
    'quadra', 'cortes', 'denman', 'hornby', 'gabriola', 'salt spring',
    'pender', 'mayne', 'galiano', 'saturna', 'thetis', 'penelakut',
    'vesuvius', 'crofton', 'mill bay', 'brentwood', 'fulford harbour',
    'long harbour', 'otter bay', 'village bay', 'sturdies bay',
    'adams lake', 'ferry landing', 'ferry lineup', 'ferry terminal'
  ];
  
  for (const terminal of ferryTerminals) {
    if (name.includes(terminal) || desc.includes(terminal)) {
      let subCat = 'Other Terminal';
      if (name.includes('tsawwassen')) subCat = 'Tsawwassen';
      else if (name.includes('swartz')) subCat = 'Swartz Bay';
      else if (name.includes('horseshoe')) subCat = 'Horseshoe Bay';
      else if (name.includes('nanaimo') || name.includes('departure')) subCat = 'Nanaimo';
      else if (name.includes('duke point')) subCat = 'Duke Point';
      else if (name.includes('langdale')) subCat = 'Langdale';
      else if (name.includes('adams lake')) subCat = 'Adams Lake Ferry';
      else if (name.includes('kootenay')) subCat = 'Kootenay Lake Ferry';
      else subCat = terminal.charAt(0).toUpperCase() + terminal.slice(1);
      
      return { source: 'BC Ferries', subCategory: subCat, highway };
    }
  }
  
  const skiResorts: Record<string, string[]> = {
    'Whistler Blackcomb': ['whistler', 'blackcomb'],
    'Big White': ['big white'],
    'Silver Star': ['silver star'],
    'Sun Peaks': ['sun peaks'],
    'Revelstoke': ['revelstoke mountain', 'revelstoke resort'],
    'Kicking Horse': ['kicking horse'],
    'Fernie': ['fernie alpine'],
    'Panorama': ['panorama'],
    'Red Mountain': ['red mountain', 'rossland'],
    'Apex': ['apex'],
    'Mt Washington': ['mt washington', 'mount washington'],
    'Cypress': ['cypress mountain', 'cypress bowl'],
    'Grouse': ['grouse mountain'],
    'Seymour': ['mt seymour', 'mount seymour'],
  };
  
  for (const [resort, keywords] of Object.entries(skiResorts)) {
    for (const kw of keywords) {
      if (name.includes(kw) || desc.includes(kw)) {
        return { source: 'Ski Resorts', subCategory: resort, highway };
      }
    }
  }
  
  const passes = [
    { name: 'Coquihalla Summit', keywords: ['coquihalla', 'coq'] },
    { name: 'Rogers Pass', keywords: ['rogers pass'] },
    { name: 'Kicking Horse Pass', keywords: ['kicking horse pass'] },
    { name: 'Crowsnest Pass', keywords: ['crowsnest'] },
    { name: 'Allison Pass', keywords: ['allison pass'] },
    { name: 'Paulson Summit', keywords: ['paulson'] },
    { name: 'Kootenay Pass', keywords: ['kootenay pass'] },
    { name: 'Malahat', keywords: ['malahat'] },
  ];
  
  for (const pass of passes) {
    for (const kw of pass.keywords) {
      if (name.includes(kw) || desc.includes(kw)) {
        return { source: 'Mountain Passes', subCategory: pass.name, highway };
      }
    }
  }
  
  if (name.includes('border') || name.includes('peace arch') || 
      name.includes('pacific highway') || name.includes('aldergrove') ||
      name.includes('huntingdon') || name.includes('sumas')) {
    let crossing = 'Other';
    if (name.includes('peace arch')) crossing = 'Peace Arch';
    else if (name.includes('pacific highway')) crossing = 'Pacific Highway';
    else if (name.includes('aldergrove')) crossing = 'Aldergrove';
    else if (name.includes('huntingdon') || name.includes('sumas')) crossing = 'Huntingdon-Sumas';
    return { source: 'Border Crossings', subCategory: crossing, highway };
  }
  
  const bridges = [
    'lions gate', 'ironworkers', 'second narrows', 'alex fraser',
    'port mann', 'pattullo', 'oak street', 'knight street', 'arthur laing',
    'massey tunnel', 'george massey', 'golden ears', 'pitt river'
  ];
  
  for (const bridge of bridges) {
    if (name.includes(bridge) || desc.includes(bridge)) {
      const bridgeName = bridge.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { source: 'Bridges & Tunnels', subCategory: bridgeName, highway };
    }
  }
  
  if (highway) {
    return { source: 'DriveBC Highways', subCategory: highway, highway };
  }
  
  return { source: 'Other', subCategory: 'General', highway };
}

const SourceIcon = ({ source }: { source: string }) => {
  switch (source) {
    case 'BC Ferries': return <Ship className="w-4 h-4" />;
    case 'Ski Resorts': return <Mountain className="w-4 h-4" />;
    case 'Mountain Passes': return <Mountain className="w-4 h-4" />;
    case 'Border Crossings': return <Globe className="w-4 h-4" />;
    case 'Bridges & Tunnels': return <Building2 className="w-4 h-4" />;
    case 'DriveBC Highways': return <Navigation className="w-4 h-4" />;
    default: return <Camera className="w-4 h-4" />;
  }
};

export function WebcamsTab({ regionId }: WebcamsTabProps) {
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebcam, setSelectedWebcam] = useState<Webcam | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [selectedHighway, setSelectedHighway] = useState<string>('all');
  
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
    } catch (error) {
      console.error('Failed to fetch webcams:', error);
    } finally {
      setLoading(false);
    }
  }

  const categorizedWebcams = useMemo(() => {
    return webcams.map(w => ({
      ...w,
      _category: categorizeWebcam(w)
    }));
  }, [webcams]);

  const { sources, subCategories, highways } = useMemo(() => {
    const sourceMap = new Map<string, Set<string>>();
    const hwSet = new Set<string>();
    
    categorizedWebcams.forEach(w => {
      const { source, subCategory, highway } = w._category;
      
      if (!sourceMap.has(source)) {
        sourceMap.set(source, new Set());
      }
      sourceMap.get(source)!.add(subCategory);
      
      if (highway) hwSet.add(highway);
    });
    
    const sourceEntries = Array.from(sourceMap.entries())
      .map(([source, subs]) => ({
        source,
        subCategories: Array.from(subs).sort(),
        count: categorizedWebcams.filter(w => w._category.source === source).length
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      sources: sourceEntries,
      subCategories: selectedSource !== 'all' 
        ? sourceEntries.find(s => s.source === selectedSource)?.subCategories || []
        : [],
      highways: Array.from(hwSet).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      })
    };
  }, [categorizedWebcams, selectedSource]);

  const filteredWebcams = useMemo(() => {
    let filtered = categorizedWebcams;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(query) ||
        w.metadata?.view_description?.toLowerCase().includes(query)
      );
    }

    if (selectedSource !== 'all') {
      filtered = filtered.filter(w => w._category.source === selectedSource);
    }

    if (selectedSubCategory !== 'all') {
      filtered = filtered.filter(w => w._category.subCategory === selectedSubCategory);
    }

    if (selectedHighway !== 'all') {
      filtered = filtered.filter(w => w._category.highway === selectedHighway);
    }

    return filtered;
  }, [searchQuery, selectedSource, selectedSubCategory, selectedHighway, categorizedWebcams]);

  useEffect(() => {
    setSelectedSubCategory('all');
  }, [selectedSource]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedSource, selectedSubCategory, selectedHighway]);

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
              Real-time cameras across British Columbia
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

        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search cameras by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-webcams"
          />
        </div>

        <div className="mt-4">
          <p className="text-muted-foreground text-xs uppercase mb-2">Filter by Source</p>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedSource === 'all' ? 'default' : 'secondary'}
              className="cursor-pointer"
              onClick={() => setSelectedSource('all')}
              data-testid="filter-source-all"
            >
              <Camera className="w-3 h-3 mr-1" />
              All ({webcams.length})
            </Badge>
            {sources.map(({ source, count }) => (
              <Badge
                key={source}
                variant={selectedSource === source ? 'default' : 'secondary'}
                className="cursor-pointer"
                onClick={() => setSelectedSource(source)}
                data-testid={`filter-source-${source.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <SourceIcon source={source} />
                <span className="ml-1">{source} ({count})</span>
              </Badge>
            ))}
          </div>
        </div>

        {selectedSource !== 'all' && subCategories.length > 1 && (
          <div className="mt-3">
            <p className="text-muted-foreground text-xs uppercase mb-2 flex items-center gap-1">
              <SourceIcon source={selectedSource} />
              Select {selectedSource === 'BC Ferries' ? 'Terminal' : 
                      selectedSource === 'Ski Resorts' ? 'Resort' :
                      selectedSource === 'Mountain Passes' ? 'Pass' :
                      selectedSource === 'Bridges & Tunnels' ? 'Bridge/Tunnel' : 'Highway'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedSubCategory === 'all' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedSubCategory('all')}
              >
                All
              </Badge>
              {subCategories.map(sub => {
                const count = categorizedWebcams.filter(
                  w => w._category.source === selectedSource && w._category.subCategory === sub
                ).length;
                return (
                  <Badge
                    key={sub}
                    variant={selectedSubCategory === sub ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedSubCategory(sub)}
                  >
                    {sub} ({count})
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {(selectedSource === 'all' || selectedSource === 'DriveBC Highways') && highways.length > 0 && (
          <div className="mt-3">
            <p className="text-muted-foreground text-xs uppercase mb-2 flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Filter by Highway
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={selectedHighway === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedHighway('all')}
              >
                All
              </Badge>
              {highways.slice(0, 20).map(hw => (
                <Badge
                  key={hw}
                  variant={selectedHighway === hw ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedHighway(hw)}
                >
                  {hw.replace('Highway ', 'Hwy ')}
                </Badge>
              ))}
              {highways.length > 20 && (
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  +{highways.length - 20} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between items-center gap-4 flex-wrap">
          <div className="text-muted-foreground text-sm">
            Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredWebcams.length)} of {filteredWebcams.length}
          </div>
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
            category={webcam._category}
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
              setSelectedSource('all');
              setSelectedSubCategory('all');
              setSelectedHighway('all');
            }}
            className="mt-2"
            data-testid="button-clear-filters"
          >
            Clear all filters
          </Button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="px-4 py-2 text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          
          <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
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
  category: WebcamCategory;
  onClick: () => void;
}

function WebcamCard({ webcam, refreshKey, category, onClick }: WebcamCardProps) {
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

        <div className="absolute top-2 right-2 bg-black/60 rounded px-2 py-0.5">
          <SourceIcon source={category.source} />
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
        <p className="text-muted-foreground/70 text-xs mt-1 flex items-center gap-1">
          <SourceIcon source={category.source} />
          {category.subCategory}
        </p>
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
      >
        <ChevronLeft className="w-8 h-8" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
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
            <p className="text-muted-foreground text-sm">{webcam.metadata?.view_description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setLocalRefresh(r => r + 1)}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="relative bg-black">
          {imageUrl ? (
            <img src={imageUrl} alt={webcam.name} className="w-full max-h-[70vh] object-contain" />
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
            {Number(webcam.latitude)?.toFixed(4)}, {Number(webcam.longitude)?.toFixed(4)}
          </span>
          <span className="text-xs">Arrow keys to navigate, ESC to close</span>
        </div>
      </div>
    </div>
  );
}

export default WebcamsTab;
