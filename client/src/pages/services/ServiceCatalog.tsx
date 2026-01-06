import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  serviceCount: number;
}

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  typicalDurationMinHours: number;
  typicalDurationMaxHours: number;
  crewMin: number;
  crewTypical: number;
  crewMax: number;
  canBeEmergency: boolean;
  weatherDependent: boolean;
  revisitCycle: string;
  category: {
    name: string;
    slug: string;
    icon: string;
  };
}

interface ServiceDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  typicalDurationMinHours: number;
  typicalDurationMaxHours: number;
  crewMin: number;
  crewTypical: number;
  crewMax: number;
  noise: string;
  disruption: string;
  failureRiskIfDelayed: string;
  canBeEmergency: boolean;
  requiresOwnerPresent: boolean;
  canBeDoneVacant: boolean;
  weatherDependent: boolean;
  revisitCycle: string;
  category: {
    name: string;
    slug: string;
    icon: string;
  };
  seasonality: Array<{
    climateRegionName: string;
    earliestWeek: number;
    latestWeek: number;
    hardStop: boolean;
    rainSensitive: boolean;
    snowSensitive: boolean;
    windSensitive: boolean;
  }>;
  pricing: {
    pricingModel: string;
    basePrice: number;
    unitDescriptor: string;
    remoteMultiplier: number;
    minimumCharge: number;
  } | null;
  certifications: Array<{
    name: string;
    authority: string;
    isRequired: boolean;
  }>;
  accessRequirements: Array<{
    name: string;
    description: string;
  }>;
  mobilizationClass: {
    name: string;
    baseCost: number;
  } | null;
}

interface Stats {
  categories: number;
  services: number;
  bundles: number;
  communities: number;
  climateRegions: number;
  currentWeek: number;
}

function formatCrew(count: number): string {
  return count === 1 ? '1 Crew Member' : `${count} Crew Members`;
}

export default function ServiceCatalog() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, categoriesRes] = await Promise.all([
        fetch('/api/service-runs/stats'),
        fetch('/api/service-runs/categories')
      ]);
      
      const statsData = await statsRes.json().catch(() => ({}));
      const categoriesData = await categoriesRes.json().catch(() => ({}));
      
      setStats(statsData?.stats || null);
      setCategories(Array.isArray(categoriesData?.categories) ? categoriesData.categories : []);
    } catch (err) {
      console.error('Failed to load catalog:', err);
      setError('Unable to load service catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadServices = useCallback(async () => {
    try {
      let url = '/api/service-runs/services?';
      if (selectedCategory) url += `category=${selectedCategory}&`;
      if (search) url += `search=${encodeURIComponent(search)}`;
      
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      
      setServices(Array.isArray(data?.services) ? data.services : []);
    } catch (err) {
      console.error('Failed to load services:', err);
      setServices([]);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  async function loadServiceDetail(slug: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/service-runs/services/${slug}`);
      const data = await res.json();
      
      if (data.success) {
        setSelectedService(data.service);
      }
    } catch (err) {
      console.error('Failed to load service detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  const revisitCycleLabels: Record<string, string> = {
    annual: 'Annually',
    biannual: 'Twice a year',
    quarterly: 'Quarterly',
    monthly: 'Monthly',
    weekly: 'Weekly',
    ad_hoc: 'As needed'
  };

  const riskColors: Record<string, string> = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-red-400'
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
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
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Service Catalog</h1>
          <p className="text-muted-foreground">Browse {stats?.services || 0} services across {stats?.categories || 0} categories</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-card rounded-lg px-4 py-2 text-center border">
            <div className="text-lg font-bold text-blue-500">Week {stats?.currentWeek}</div>
            <div className="text-xs text-muted-foreground">Current</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats?.categories}</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats?.services}</div>
          <div className="text-sm text-muted-foreground">Services</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats?.bundles}</div>
          <div className="text-sm text-muted-foreground">Bundles</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats?.climateRegions}</div>
          <div className="text-sm text-muted-foreground">Climate Zones</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats?.communities}</div>
          <div className="text-sm text-muted-foreground">Communities</div>
        </div>
      </div>

      <div className="bg-card rounded-lg p-4 mb-6 border">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[250px]">
            <input
              type="text"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border rounded-lg px-4 py-2 placeholder:text-muted-foreground"
              data-testid="input-search"
            />
          </div>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="bg-background border rounded-lg px-4 py-2"
            data-testid="select-category"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>
                {cat.icon} {cat.name} ({cat.serviceCount})
              </option>
            ))}
          </select>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              data-testid="button-view-grid"
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              data-testid="button-view-list"
            >
              List
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!selectedCategory && !search && (
          <div className="lg:col-span-3">
            <h2 className="text-lg font-semibold mb-4">Browse by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className="bg-card rounded-lg p-4 text-left hover-elevate transition-colors border"
                  data-testid={`button-category-${cat.slug}`}
                >
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-sm text-muted-foreground">{cat.serviceCount} services</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {(selectedCategory || search) && (
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-blue-500 hover:text-blue-400"
                    data-testid="button-back"
                  >
                    All Categories
                  </button>
                )}
                <h2 className="text-lg font-semibold">
                  {selectedCategory 
                    ? categories.find(c => c.slug === selectedCategory)?.name 
                    : `Search Results`
                  } 
                  <span className="text-muted-foreground font-normal ml-2">({services.length})</span>
                </h2>
              </div>
            </div>

            {services.length === 0 ? (
              <div className="bg-card rounded-lg p-12 text-center border">
                <p className="text-muted-foreground">No services found matching your criteria.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(service => (
                  <div
                    key={service.id}
                    onClick={() => loadServiceDetail(service.slug)}
                    className={`bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border ${
                      selectedService?.slug === service.slug 
                        ? 'border-primary' 
                        : ''
                    }`}
                    data-testid={`card-service-${service.slug}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{service.icon || service.category.icon}</span>
                        <h3 className="font-medium">{service.name}</h3>
                      </div>
                      {service.canBeEmergency && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                          Emergency
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{service.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-muted px-2 py-1 rounded">
                        {service.typicalDurationMinHours}-{service.typicalDurationMaxHours}h
                      </span>
                      <span className="bg-muted px-2 py-1 rounded">
                        {formatCrew(service.crewTypical)}
                      </span>
                      {service.weatherDependent && (
                        <span className="bg-yellow-500/20 px-2 py-1 rounded text-yellow-600 dark:text-yellow-400">
                          Weather
                        </span>
                      )}
                      {service.revisitCycle && service.revisitCycle !== 'ad_hoc' && (
                        <span className="bg-blue-500/20 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                          {revisitCycleLabels[service.revisitCycle]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-lg overflow-hidden border">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Service</th>
                      <th className="text-left px-4 py-3 font-medium">Duration</th>
                      <th className="text-left px-4 py-3 font-medium">Crew</th>
                      <th className="text-left px-4 py-3 font-medium">Cycle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {services.map(service => (
                      <tr 
                        key={service.id}
                        onClick={() => loadServiceDetail(service.slug)}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          selectedService?.slug === service.slug ? 'bg-muted' : ''
                        }`}
                        data-testid={`row-service-${service.slug}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{service.icon || service.category.icon}</span>
                            <div>
                              <div className="font-medium">{service.name}</div>
                              <div className="text-muted-foreground text-xs truncate max-w-xs">{service.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {service.typicalDurationMinHours}-{service.typicalDurationMaxHours}h
                        </td>
                        <td className="px-4 py-3">{formatCrew(service.crewTypical)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-sm">
                          {revisitCycleLabels[service.revisitCycle] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(selectedCategory || search) && (
          <div className="lg:col-span-1">
            {selectedService ? (
              <div className="bg-card rounded-lg p-4 sticky top-4 border">
                {detailLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    <div className="pb-4 border-b mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{selectedService.icon || selectedService.category.icon}</span>
                        <h3 className="text-xl font-bold">{selectedService.name}</h3>
                      </div>
                      <p className="text-muted-foreground text-sm">{selectedService.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedService.canBeEmergency && (
                          <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded border border-destructive/50">
                            Emergency Available
                          </span>
                        )}
                        {selectedService.weatherDependent && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-500/50">
                            Weather Dependent
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-muted rounded p-2 text-center">
                        <div className="text-lg font-bold">
                          {selectedService.typicalDurationMinHours}-{selectedService.typicalDurationMaxHours}
                        </div>
                        <div className="text-xs text-muted-foreground">Hours</div>
                      </div>
                      <div className="bg-muted rounded p-2 text-center">
                        <div className="text-lg font-bold">
                          {selectedService.crewMin === selectedService.crewMax 
                            ? formatCrew(selectedService.crewMin)
                            : `${selectedService.crewMin}-${selectedService.crewMax}`
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">Crew Members</div>
                      </div>
                      <div className="bg-muted rounded p-2 text-center">
                        <div className={`text-lg font-bold ${riskColors[selectedService.failureRiskIfDelayed]}`}>
                          {selectedService.failureRiskIfDelayed.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">Risk</div>
                      </div>
                    </div>

                    {selectedService.pricing && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Pricing</h4>
                        <div className="bg-muted rounded p-3">
                          <div className="text-2xl font-bold text-green-500">
                            ${selectedService.pricing.basePrice.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {selectedService.pricing.unitDescriptor || selectedService.pricing.pricingModel}
                          </div>
                          {selectedService.pricing.minimumCharge > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Minimum: ${selectedService.pricing.minimumCharge.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedService.seasonality.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Seasonality</h4>
                        <div className="space-y-2">
                          {selectedService.seasonality.map((s, i) => (
                            <div key={i} className="bg-muted rounded p-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span>{s.climateRegionName}</span>
                                <span className="text-muted-foreground">
                                  Weeks {s.earliestWeek}-{s.latestWeek}
                                </span>
                              </div>
                              {(s.rainSensitive || s.snowSensitive || s.windSensitive) && (
                                <div className="flex gap-2 mt-1 text-xs">
                                  {s.rainSensitive && <span className="text-blue-500">Rain</span>}
                                  {s.snowSensitive && <span className="text-blue-300">Snow</span>}
                                  {s.windSensitive && <span className="text-muted-foreground">Wind</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedService.certifications.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Required Certifications</h4>
                        <div className="space-y-1">
                          {selectedService.certifications.map((c, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span>{c.name}</span>
                              <span className="text-muted-foreground text-xs">{c.authority}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedService.mobilizationClass && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Mobilization</h4>
                        <div className="bg-muted rounded p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="capitalize">
                              {selectedService.mobilizationClass.name.replace(/_/g, ' ')}
                            </span>
                            <span className="text-muted-foreground">
                              ${selectedService.mobilizationClass.baseCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Operations</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted rounded p-2">
                          <span className="text-muted-foreground">Noise: </span>
                          <span className="capitalize">{selectedService.noise}</span>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <span className="text-muted-foreground">Disruption: </span>
                          <span className="capitalize">{selectedService.disruption}</span>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <span className="text-muted-foreground">Owner Present: </span>
                          <span>{selectedService.requiresOwnerPresent ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <span className="text-muted-foreground">Vacant OK: </span>
                          <span>{selectedService.canBeDoneVacant ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-2">
                      <button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded text-sm"
                        data-testid="button-add-to-run"
                      >
                        Add to Service Run
                      </button>
                      <button 
                        className="w-full bg-muted hover:bg-muted/80 py-2 rounded text-sm"
                        data-testid="button-find-compatible"
                      >
                        Find Compatible Services
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg p-8 text-center text-muted-foreground sticky top-4 border">
                <div className="text-4xl mb-3">Select a service to view details</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
