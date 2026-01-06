import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Package, 
  Search, 
  X,
  ChevronRight,
  Building2,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UnifiedAsset {
  id: string;
  asset_type: string;
  name: string;
  description: string | null;
  status: string | null;
  owner_type: string;
  owner_tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  city: string | null;
  region: string | null;
  location_description: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_table: string;
  source_id: string;
}

interface InventoryAuditData {
  assets: UnifiedAsset[];
  total: number;
  tenants: { id: string; name: string; slug: string }[];
  assetTypes: string[];
  tableCounts: Record<string, number | null>;
}

export default function AdminInventory() {
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<UnifiedAsset | null>(null);
  const [activeTab, setActiveTab] = useState("unified_assets");

  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tenantFilter && tenantFilter !== "all") params.set("tenant_id", tenantFilter);
    if (typeFilter && typeFilter !== "all") params.set("asset_type", typeFilter);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    return `/api/admin/inventory${qs ? `?${qs}` : ""}`;
  };

  const { data, isLoading, error } = useQuery<InventoryAuditData>({
    queryKey: ["/api/admin/inventory", search, tenantFilter, typeFilter, statusFilter],
    queryFn: async () => {
      const url = buildQueryUrl();
      const token = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(url, { 
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to fetch inventory audit data');
      }
      return res.json();
    },
  });

  const clearFilters = () => {
    setSearch("");
    setTenantFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = search || tenantFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-CA");
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    switch (status.toLowerCase()) {
      case "active":
      case "available":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{status}</Badge>;
      case "inactive":
      case "unavailable":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
      case "maintenance":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6" />
          Inventory (Audit)
        </h1>
        <p className="text-muted-foreground">
          System-wide inventory registry for QA and debugging.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="unified_assets" data-testid="tab-unified-assets">
            Unified Assets ({data?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="catalog_items" data-testid="tab-catalog-items">
            Catalog Items ({data?.tableCounts?.catalog_items ?? "N/A"})
          </TabsTrigger>
          <TabsTrigger value="cc_rental_items" data-testid="tab-rental-items">
            Rental Items ({data?.tableCounts?.cc_rental_items ?? "N/A"})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unified_assets" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
                <Select value={tenantFilter} onValueChange={setTenantFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-tenant">
                    <SelectValue placeholder="All Tenants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    {data?.tenants?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {data?.assetTypes?.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="w-4 h-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading inventory...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-400">Error loading inventory data</div>
              ) : !data?.assets?.length ? (
                <div className="text-center py-8 text-muted-foreground">No assets found</div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.assets.map((asset) => (
                        <TableRow
                          key={asset.id}
                          className="cursor-pointer hover-elevate"
                          onClick={() => setSelectedAsset(asset)}
                          data-testid={`row-asset-${asset.id}`}
                        >
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{asset.asset_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {asset.tenant_name ? (
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">{asset.tenant_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No tenant</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(asset.status)}</TableCell>
                          <TableCell>
                            {asset.city || asset.region ? (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {[asset.city, asset.region].filter(Boolean).join(", ")}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(asset.updated_at)}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog_items" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Catalog Items</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.tableCounts?.catalog_items === null ? (
                <p className="text-muted-foreground">Not present in this environment.</p>
              ) : (
                <p className="text-muted-foreground">
                  {data?.tableCounts?.catalog_items ?? 0} catalog items found. 
                  <br />
                  <span className="text-sm">View details from the Unified Assets tab where catalog items are synchronized.</span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cc_rental_items" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rental Items (cc_rental_items)</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.tableCounts?.cc_rental_items === null ? (
                <p className="text-muted-foreground">Not present in this environment.</p>
              ) : (
                <p className="text-muted-foreground">
                  {data?.tableCounts?.cc_rental_items ?? 0} rental items found.
                  <br />
                  <span className="text-sm">View details from the Unified Assets tab where rental items are synchronized.</span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedAsset?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedAsset && (
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">ID</p>
                    <p className="font-mono text-xs">{selectedAsset.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Asset Type</p>
                    <Badge variant="outline">{selectedAsset.asset_type}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedAsset.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Owner Type</p>
                    <p>{selectedAsset.owner_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tenant</p>
                    <p>{selectedAsset.tenant_name || "None"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tenant Slug</p>
                    <p className="font-mono text-xs">{selectedAsset.tenant_slug || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source Table</p>
                    <p className="font-mono text-xs">{selectedAsset.source_table}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source ID</p>
                    <p className="font-mono text-xs">{selectedAsset.source_id}</p>
                  </div>
                </div>
                
                {selectedAsset.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedAsset.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Location</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">City:</span> {selectedAsset.city || "-"}</div>
                    <div><span className="text-muted-foreground">Region:</span> {selectedAsset.region || "-"}</div>
                    {selectedAsset.location_description && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Details:</span> {selectedAsset.location_description}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Timestamps</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Created:</span> {formatDate(selectedAsset.created_at)}</div>
                    <div><span className="text-muted-foreground">Updated:</span> {formatDate(selectedAsset.updated_at)}</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Full Record (JSON)</p>
                  <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedAsset, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
