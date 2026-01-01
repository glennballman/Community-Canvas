import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Home,
  Upload,
  Plus,
  Search,
  Star,
  ExternalLink,
  Calendar,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AccommodationProperty, AccommodationStats, ImportResult } from "../../../shared/types/accommodations";

const BC_REGIONS = [
  "Vancouver Island",
  "Victoria Metro",
  "Nanaimo Area",
  "Tofino/Ucluelet",
  "Courtenay/Comox",
  "Campbell River",
  "Parksville/Qualicum",
  "Port Alberni",
  "Duncan/Cowichan",
  "Sooke",
  "Sunshine Coast",
  "Vancouver Metro",
  "Whistler/Squamish",
  "Okanagan",
  "Kootenays",
  "Other BC"
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "discovered", label: "Discovered" },
  { value: "contacted", label: "Contacted" },
  { value: "onboarded", label: "Onboarded" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" }
];

type SortField = "name" | "crewScore" | "overallRating" | "baseNightlyRate" | "city";
type SortDirection = "asc" | "desc";

export default function Accommodations() {
  const { toast } = useToast();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [filters, setFilters] = useState({
    region: "",
    city: "",
    minCrewScore: 0,
    status: "all"
  });
  const [sortField, setSortField] = useState<SortField>("crewScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const { data: statsData, isLoading: statsLoading } = useQuery<AccommodationStats>({
    queryKey: ["/api/accommodations/stats"]
  });

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery<{ properties: AccommodationProperty[]; total: number }>({
    queryKey: ["/api/accommodations", filters]
  });

  const importMutation = useMutation({
    mutationFn: async (listings: any[]) => {
      const response = await apiRequest("POST", "/api/accommodations/import", { listings });
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      toast({
        title: "Import Complete",
        description: `Imported: ${result.imported}, Updated: ${result.updated}, Skipped: ${result.skipped}`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accommodations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accommodations/stats"] });
      setImportModalOpen(false);
      setJsonInput("");
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const listings = Array.isArray(parsed) ? parsed : parsed.listings || [parsed];
      importMutation.mutate(listings);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setJsonInput(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const resetFilters = () => {
    setFilters({ region: "", city: "", minCrewScore: 0, status: "all" });
    setCurrentPage(1);
  };

  const sortedProperties = useMemo(() => {
    if (!propertiesData?.properties) return [];
    
    let filtered = [...propertiesData.properties];
    
    if (filters.region) {
      filtered = filtered.filter(p => p.region === filters.region);
    }
    if (filters.city) {
      filtered = filtered.filter(p => 
        p.city?.toLowerCase().includes(filters.city.toLowerCase())
      );
    }
    if (filters.minCrewScore > 0) {
      filtered = filtered.filter(p => (p.crewScore || 0) >= filters.minCrewScore);
    }
    if (filters.status !== "all") {
      filtered = filtered.filter(p => p.status === filters.status);
    }

    return filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      
      if (aVal === undefined || aVal === null) aVal = sortDirection === "asc" ? Infinity : -Infinity;
      if (bVal === undefined || bVal === null) bVal = sortDirection === "asc" ? Infinity : -Infinity;
      
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [propertiesData?.properties, filters, sortField, sortDirection]);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedProperties.slice(start, start + itemsPerPage);
  }, [sortedProperties, currentPage]);

  const totalPages = Math.ceil(sortedProperties.length / itemsPerPage);

  const getCrewScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-600">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-600">{score}</Badge>;
    return <Badge variant="secondary">{score}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      onboarded: "default",
      contacted: "secondary",
      discovered: "outline",
      inactive: "destructive"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover-elevate select-none"
      onClick={() => handleSort(field)}
      data-testid={`header-${field}`}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="h-full overflow-auto p-6 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-foreground flex items-center gap-2">
              <Home className="w-5 h-5" />
              ACCOMMODATIONS
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              BC Crew Accommodation Network
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-import">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Airbnb Listings</DialogTitle>
                  <DialogDescription>
                    Upload JSON data from Apify or paste raw JSON
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Upload JSON File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="mt-2"
                      data-testid="input-file-upload"
                    />
                  </div>
                  <div>
                    <Label htmlFor="json-input">Or Paste JSON</Label>
                    <Textarea
                      id="json-input"
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder='[{"id": "123", "title": "Cozy Cabin", ...}]'
                      className="mt-2 h-48 font-mono text-xs"
                      data-testid="input-json"
                    />
                  </div>
                  <Button 
                    onClick={handleImport} 
                    disabled={!jsonInput || importMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-import"
                  >
                    {importMutation.isPending ? "Importing..." : "Import Listings"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" data-testid="button-add-property">
              <Plus className="w-4 h-4 mr-2" />
              Add Property
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Home className="w-3 h-3" />
                TOTAL PROPERTIES
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="stat-total">
                {statsLoading ? "..." : statsData?.totalProperties || 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Tracked accommodations
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Star className="w-3 h-3" />
                CREW-FRIENDLY
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400" data-testid="stat-crew-friendly">
                {statsLoading ? "..." : statsData?.crewFriendly || 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Score 50+ properties
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Home className="w-3 h-3" />
                IN NETWORK
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400" data-testid="stat-in-network">
                {statsLoading ? "..." : statsData?.inNetwork || 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Active partners
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                WITH iCAL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400" data-testid="stat-with-ical">
                {statsLoading ? "..." : statsData?.withIcal || 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Live availability
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-muted-foreground">Region</Label>
                <Select 
                  value={filters.region} 
                  onValueChange={(v) => setFilters(f => ({ ...f, region: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1" data-testid="select-region">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {BC_REGIONS.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-muted-foreground">City</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search city..."
                    value={filters.city}
                    onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}
                    className="pl-8"
                    data-testid="input-city"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">
                  Min Crew Score: {filters.minCrewScore}
                </Label>
                <Slider
                  value={[filters.minCrewScore]}
                  onValueChange={([v]) => setFilters(f => ({ ...f, minCrewScore: v }))}
                  max={100}
                  step={5}
                  className="mt-3"
                  data-testid="slider-crew-score"
                />
              </div>

              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="mt-1" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                data-testid="button-reset-filters"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-0">
            {propertiesLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading properties...</div>
            ) : sortedProperties.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No properties found</p>
                <p className="text-xs mt-2">Import data or add properties manually</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Image</TableHead>
                      <SortableHeader field="name">Property Name</SortableHeader>
                      <SortableHeader field="city">City / Region</SortableHeader>
                      <SortableHeader field="crewScore">Crew Score</SortableHeader>
                      <SortableHeader field="overallRating">Rating</SortableHeader>
                      <SortableHeader field="baseNightlyRate">$/Night</SortableHeader>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProperties.map((property) => (
                      <TableRow key={property.id} data-testid={`row-property-${property.id}`}>
                        <TableCell>
                          {property.thumbnailUrl ? (
                            <img 
                              src={property.thumbnailUrl} 
                              alt={property.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              <Home className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm max-w-[200px] truncate" title={property.name}>
                            {property.name}
                          </div>
                          {property.sourceUrl && (
                            <a 
                              href={property.sourceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              View listing <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{property.city || "-"}</div>
                          <div className="text-xs text-muted-foreground">{property.region || "-"}</div>
                        </TableCell>
                        <TableCell>
                          {getCrewScoreBadge(property.crewScore || 0)}
                        </TableCell>
                        <TableCell>
                          {property.overallRating ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm">{property.overallRating.toFixed(1)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {property.baseNightlyRate ? (
                            <span className="text-sm font-medium">${property.baseNightlyRate}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(property.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" data-testid={`button-view-${property.id}`}>
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedProperties.length)} of {sortedProperties.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <span className="text-sm px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
