import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface BundleItem {
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  serviceDescription: string;
  quantity: number;
  sortOrder: number;
}

interface BundlePricing {
  basePrice: number;
  discountFactor: number;
  mobilizationSurcharge: number;
  remoteMultiplier: number;
  notes: string;
}

interface BundleSeasonality {
  climateRegionId: string;
  climateRegionName: string;
  earliestWeek: number;
  latestWeek: number;
  hardStop: boolean;
  notes: string;
}

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  context: string;
  isSubscription: boolean;
  billingPeriod: string;
  itemCount: number;
  pricing: BundlePricing | null;
}

interface BundleDetail extends Bundle {
  items: BundleItem[];
  seasonality: BundleSeasonality[];
}

interface Community {
  id: string;
  name: string;
  region: string;
  climateRegionName: string;
  remoteMultiplier: number;
}

interface RunType {
  id: string;
  slug: string;
  name: string;
  description: string;
  climateRegionName: string;
  earliestWeek: number;
  latestWeek: number;
  hardStop: boolean;
  isEmergency: boolean;
  priorityWeight: number;
  serviceCount: number;
}

interface Stats {
  bundles: number;
  communities: number;
  currentWeek: number;
}

export default function BundlesBrowser() {
  const { token } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<BundleDetail | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'bundles' | 'calendar'>('bundles');

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const [statsRes, bundlesRes, communitiesRes, runTypesRes] = await Promise.all([
        fetch('/api/service-runs/stats', { headers }),
        fetch('/api/service-runs/bundles', { headers }),
        fetch('/api/service-runs/communities', { headers }),
        fetch('/api/service-runs/run-types', { headers })
      ]);
      
      const [statsData, bundlesData, communitiesData, runTypesData] = await Promise.all([
        statsRes.json().catch(() => ({})),
        bundlesRes.json().catch(() => ({})),
        communitiesRes.json().catch(() => ({})),
        runTypesRes.json().catch(() => ({}))
      ]);
      
      setStats(statsData?.stats || null);
      setBundles(Array.isArray(bundlesData?.bundles) ? bundlesData.bundles : []);
      setCommunities(Array.isArray(communitiesData?.communities) ? communitiesData.communities : []);
      setRunTypes(Array.isArray(runTypesData?.runTypes) ? runTypesData.runTypes : []);
    } catch (err) {
      console.error('Failed to load bundles:', err);
      setError('Unable to load bundles. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadBundleDetail(slug: string) {
    setDetailLoading(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/service-runs/bundles/${slug}`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setSelectedBundle(data.bundle);
      }
    } catch (err) {
      console.error('Failed to load bundle detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  function formatDiscount(factor: number): string {
    const discount = Math.round((1 - factor) * 100);
    return `${discount}% off`;
  }

  function isInSeason(seasonality: BundleSeasonality[], currentWeek: number): boolean {
    if (!seasonality || seasonality.length === 0) return true;
    
    return seasonality.some(s => {
      if (s.earliestWeek <= s.latestWeek) {
        return currentWeek >= s.earliestWeek && currentWeek <= s.latestWeek;
      } else {
        return currentWeek >= s.earliestWeek || currentWeek <= s.latestWeek;
      }
    });
  }

  function getSeasonBadge(seasonality: BundleSeasonality[], currentWeek: number) {
    if (!seasonality || seasonality.length === 0) {
      return <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Year-round</span>;
    }
    
    const inSeason = isInSeason(seasonality, currentWeek);
    const s = seasonality[0];
    
    if (inSeason) {
      return (
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/50">
          In Season (Weeks {s.earliestWeek}-{s.latestWeek})
        </span>
      );
    } else {
      return (
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
          Weeks {s.earliestWeek}-{s.latestWeek}
          {s.hardStop && ' (Hard Stop)'}
        </span>
      );
    }
  }

  function weekToMonth(week: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = Math.floor((week - 1) / 4.33);
    return months[Math.min(11, Math.max(0, monthIndex))];
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
            data-testid="button-retry"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Service Bundles</h1>
          <p className="text-muted-foreground">Pre-configured service packages for seasonal property care</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-card rounded-lg px-4 py-2 text-center border">
            <div className="text-lg font-bold text-blue-400">Week {stats?.currentWeek}</div>
            <div className="text-xs text-muted-foreground">Current</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold" data-testid="text-bundle-count">{bundles.length}</div>
          <div className="text-sm text-muted-foreground">Bundles</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{bundles.filter(b => b.isSubscription).length}</div>
          <div className="text-sm text-muted-foreground">Subscriptions</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{communities.length}</div>
          <div className="text-sm text-muted-foreground">Communities</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{runTypes.length}</div>
          <div className="text-sm text-muted-foreground">Run Types</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewTab('bundles')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewTab === 'bundles' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover-elevate'
          }`}
          data-testid="button-tab-bundles"
        >
          Bundles
        </button>
        <button
          onClick={() => setViewTab('calendar')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewTab === 'calendar' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover-elevate'
          }`}
          data-testid="button-tab-calendar"
        >
          Seasonal Calendar
        </button>
      </div>

      {viewTab === 'bundles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card rounded-lg p-4 flex items-center gap-4 border">
              <select
                value={selectedCommunity}
                onChange={(e) => setSelectedCommunity(e.target.value)}
                className="bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="select-community"
              >
                <option value="">All Communities</option>
                {communities.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.region})</option>
                ))}
              </select>
              <span className="text-muted-foreground text-sm">
                Showing {bundles.length} bundles
              </span>
            </div>

            {bundles.length === 0 ? (
              <div className="bg-card rounded-lg p-12 text-center border">
                <p className="text-muted-foreground">No service bundles available.</p>
              </div>
            ) : bundles.map(bundle => (
              <div
                key={bundle.id}
                onClick={() => loadBundleDetail(bundle.slug)}
                className={`bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border ${
                  selectedBundle?.slug === bundle.slug 
                    ? 'border-primary' 
                    : ''
                }`}
                data-testid={`card-bundle-${bundle.slug}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{bundle.name}</h3>
                      {bundle.isSubscription && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/50">
                          Subscription
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{bundle.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="text-sm bg-muted px-2 py-1 rounded">
                    {bundle.itemCount} services
                  </span>
                  
                  {bundle.pricing && (
                    <>
                      <span className="text-sm bg-green-500/20 px-2 py-1 rounded text-green-400">
                        {formatDiscount(bundle.pricing.discountFactor)}
                      </span>
                      <span className="text-sm bg-muted px-2 py-1 rounded">
                        ${bundle.pricing.mobilizationSurcharge} mob.
                      </span>
                      {bundle.pricing.remoteMultiplier > 1 && (
                        <span className="text-sm bg-yellow-500/20 px-2 py-1 rounded text-yellow-400">
                          {bundle.pricing.remoteMultiplier}x remote
                        </span>
                      )}
                    </>
                  )}
                  
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded capitalize">
                    {bundle.context}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            {selectedBundle ? (
              <div className="bg-card rounded-lg p-4 sticky top-4 border">
                {detailLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    <div className="pb-4 border-b mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold">{selectedBundle.name}</h3>
                      </div>
                      <p className="text-muted-foreground text-sm">{selectedBundle.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedBundle.isSubscription && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/50">
                            {selectedBundle.billingPeriod} Subscription
                          </span>
                        )}
                        {selectedBundle.seasonality && selectedBundle.seasonality.length > 0 && (
                          getSeasonBadge(selectedBundle.seasonality, stats?.currentWeek || 1)
                        )}
                      </div>
                    </div>

                    {selectedBundle.pricing && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Pricing</h4>
                        <div className="bg-muted rounded p-3">
                          {selectedBundle.pricing.basePrice > 0 ? (
                            <div className="text-2xl font-bold text-green-400 mb-1">
                              ${selectedBundle.pricing.basePrice.toLocaleString()}
                              {selectedBundle.isSubscription && (
                                <span className="text-sm font-normal text-muted-foreground">/{selectedBundle.billingPeriod}</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-lg font-bold text-green-400 mb-1">
                              {formatDiscount(selectedBundle.pricing.discountFactor)} bundle discount
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Mobilization:</span>
                              <span>${selectedBundle.pricing.mobilizationSurcharge}</span>
                            </div>
                            {selectedBundle.pricing.remoteMultiplier > 1 && (
                              <div className="flex justify-between">
                                <span>Remote Multiplier:</span>
                                <span>{selectedBundle.pricing.remoteMultiplier}x</span>
                              </div>
                            )}
                          </div>
                          {selectedBundle.pricing.notes && (
                            <div className="text-xs text-muted-foreground mt-2 italic">
                              {selectedBundle.pricing.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedBundle.seasonality && selectedBundle.seasonality.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Seasonality</h4>
                        <div className="space-y-2">
                          {selectedBundle.seasonality.map((s, i) => (
                            <div key={i} className="bg-muted rounded p-2 text-sm">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span>{s.climateRegionName}</span>
                                <span className="text-muted-foreground">
                                  {weekToMonth(s.earliestWeek)} - {weekToMonth(s.latestWeek)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Weeks {s.earliestWeek}-{s.latestWeek}
                                {s.hardStop && (
                                  <span className="text-red-400 ml-2">Hard Stop</span>
                                )}
                              </div>
                              {s.notes && (
                                <div className="text-xs text-muted-foreground mt-1 italic">{s.notes}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Included Services ({selectedBundle.items.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selectedBundle.items
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((item, i) => (
                            <div key={i} className="bg-muted rounded p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm">{item.serviceName}</span>
                                {item.quantity > 1 && (
                                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                    x{item.quantity}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {item.serviceDescription}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-2">
                      <button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded text-sm"
                        data-testid="button-create-run"
                      >
                        Create Service Run with Bundle
                      </button>
                      <button 
                        className="w-full bg-muted hover-elevate py-2 rounded text-sm"
                        data-testid="button-get-quote"
                      >
                        Get Quote for My Property
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg p-8 text-center text-muted-foreground sticky top-4 border">
                <p>Select a bundle to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewTab === 'calendar' && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg p-4 border">
            <h3 className="text-lg font-semibold mb-4">Coastal Wet Region - Seasonal Calendar</h3>
            
            <div className="flex mb-2">
              <div className="w-48 shrink-0" />
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                <div key={month} className="flex-1 text-center text-xs text-muted-foreground">{month}</div>
              ))}
            </div>

            <div className="flex mb-4 relative">
              <div className="w-48 shrink-0 text-xs text-muted-foreground">Current Week ({stats?.currentWeek})</div>
              <div className="flex-1 relative h-2 bg-muted rounded">
                <div 
                  className="absolute top-0 h-full w-1 bg-blue-500 rounded"
                  style={{ left: `${((stats?.currentWeek || 1) / 52) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {runTypes.map(rt => {
                const startPercent = ((rt.earliestWeek - 1) / 52) * 100;
                let widthPercent: number;
                if (rt.earliestWeek <= rt.latestWeek) {
                  widthPercent = ((rt.latestWeek - rt.earliestWeek + 1) / 52) * 100;
                } else {
                  widthPercent = ((52 - rt.earliestWeek + rt.latestWeek + 1) / 52) * 100;
                }
                
                const colors = rt.isEmergency 
                  ? 'bg-red-500/40 border-red-500' 
                  : rt.hardStop 
                    ? 'bg-yellow-500/40 border-yellow-500'
                    : 'bg-green-500/40 border-green-500';
                
                return (
                  <div key={rt.id} className="flex items-center">
                    <div className="w-48 shrink-0 pr-4">
                      <div className="text-sm truncate">{rt.name.replace(' Run', '')}</div>
                      <div className="text-xs text-muted-foreground">
                        {rt.isEmergency && 'Emergency'}
                        {rt.hardStop && !rt.isEmergency && 'Hard Stop'}
                        {!rt.isEmergency && !rt.hardStop && `${rt.serviceCount} services`}
                      </div>
                    </div>
                    <div className="flex-1 relative h-6 bg-muted rounded">
                      <div 
                        className={`absolute top-0 h-full rounded border ${colors}`}
                        style={{ 
                          left: `${startPercent}%`, 
                          width: `${Math.min(widthPercent, 100 - startPercent)}%` 
                        }}
                      />
                      {rt.earliestWeek > rt.latestWeek && (
                        <div 
                          className={`absolute top-0 h-full rounded border ${colors}`}
                          style={{ 
                            left: 0, 
                            width: `${(rt.latestWeek / 52) * 100}%` 
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-6 mt-6 pt-4 border-t flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500/40 border border-green-500 rounded" />
                <span className="text-sm text-muted-foreground">Standard Window</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500/40 border border-yellow-500 rounded" />
                <span className="text-sm text-muted-foreground">Hard Stop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500/40 border border-red-500 rounded" />
                <span className="text-sm text-muted-foreground">Emergency</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded" />
                <span className="text-sm text-muted-foreground">Current Week</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runTypes.map(rt => (
              <div key={rt.id} className="bg-card rounded-lg p-4 border" data-testid={`card-runtype-${rt.slug}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold">{rt.name}</h4>
                  {rt.isEmergency && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                      Emergency
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{rt.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-muted px-2 py-1 rounded">
                    Weeks {rt.earliestWeek}-{rt.latestWeek}
                  </span>
                  <span className="bg-muted px-2 py-1 rounded">
                    {rt.serviceCount} services
                  </span>
                  <span className="bg-muted px-2 py-1 rounded">
                    Priority {rt.priorityWeight}
                  </span>
                  {rt.hardStop && (
                    <span className="bg-yellow-500/20 px-2 py-1 rounded text-yellow-400">
                      Hard Stop
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
