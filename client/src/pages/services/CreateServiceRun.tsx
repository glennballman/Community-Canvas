import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Gavel } from 'lucide-react';

type RunMode = 'coop' | 'bidding';

interface Community {
  id: string;
  name: string;
  region: string;
  climateRegionName: string;
  remoteMultiplier: number;
}

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  itemCount: number;
  pricing: {
    discountFactor: number;
    mobilizationSurcharge: number;
    remoteMultiplier: number;
  } | null;
}

interface RunType {
  id: string;
  name: string;
  slug: string;
  description: string;
  climateRegionName: string;
  earliestWeek: number;
  latestWeek: number;
  isEmergency: boolean;
  serviceCount: number;
}

export default function CreateServiceRun() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [runMode, setRunMode] = useState<RunMode>('coop');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [tradeCategory, setTradeCategory] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorEmail, setContractorEmail] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyPostalCode, setPropertyPostalCode] = useState('');
  const [propertyCommunity, setPropertyCommunity] = useState('');
  const [unitCount, setUnitCount] = useState(1);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [runTypeId, setRunTypeId] = useState('');
  const [serviceAreaDescription, setServiceAreaDescription] = useState('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [minSlots, setMinSlots] = useState(5);
  const [maxSlots, setMaxSlots] = useState(25);
  const [biddingOpensAt, setBiddingOpensAt] = useState('');
  const [biddingClosesAt, setBiddingClosesAt] = useState('');
  const [estimatedMobilizationCost, setEstimatedMobilizationCost] = useState('');
  const [requirePhotos, setRequirePhotos] = useState(true);
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState(
    'Full refund if cancelled 14+ days before scheduled date. 50% refund if cancelled 7-13 days before. No refund within 7 days.'
  );

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const [commRes, bundleRes, runTypeRes] = await Promise.all([
          fetch('/api/service-runs/communities', { headers }),
          fetch('/api/service-runs/bundles', { headers }),
          fetch('/api/service-runs/run-types', { headers })
        ]);
        
        const [commData, bundleData, runTypeData] = await Promise.all([
          commRes.json(),
          bundleRes.json(),
          runTypeRes.json()
        ]);
        
        if (commData.success) setCommunities(commData.communities);
        if (bundleData.success) setBundles(bundleData.bundles);
        if (runTypeData.success) setRunTypes(runTypeData.runTypes);
      } catch (err) {
        console.error('Failed to load form data:', err);
        setError('Failed to load form data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token]);

  useEffect(() => {
    if (communityId && (bundleId || runTypeId)) {
      const community = communities.find(c => c.id === communityId);
      const bundle = bundles.find(b => b.id === bundleId);
      const runType = runTypes.find(rt => rt.id === runTypeId);
      
      if (community) {
        const year = targetStartDate ? new Date(targetStartDate).getFullYear() : new Date().getFullYear();
        const serviceName = bundle?.name || runType?.name || 'Service Run';
        const shortName = serviceName
          .replace(community.name, '')
          .replace('Package', '')
          .replace('Bundle', '')
          .trim();
        
        setTitle(`${community.name} ${shortName} ${year}`.trim());
      }
    }
  }, [communityId, bundleId, runTypeId, targetStartDate, communities, bundles, runTypes]);

  useEffect(() => {
    if (communityId) {
      const community = communities.find(c => c.id === communityId);
      if (community && !serviceAreaDescription) {
        setServiceAreaDescription(`All of ${community.name} and surrounding area`);
      }
    }
  }, [communityId, communities]);

  useEffect(() => {
    if (bundleId) {
      const bundle = bundles.find(b => b.id === bundleId);
      const community = communities.find(c => c.id === communityId);
      
      if (bundle?.pricing && community) {
        const baseMob = bundle.pricing.mobilizationSurcharge;
        const remoteMult = community.remoteMultiplier;
        const estimated = Math.round(baseMob * remoteMult);
        setEstimatedMobilizationCost(estimated.toString());
      }
    }
  }, [bundleId, communityId, bundles, communities]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      if (runMode === 'coop') {
        if (!tradeCategory || !serviceDescription || !propertyAddress) {
          setError('Please fill in all required fields');
          setSaving(false);
          return;
        }
        
        const res = await fetch('/api/coop-runs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            trade_category: tradeCategory,
            service_description: serviceDescription,
            property_address: propertyAddress,
            property_postal_code: propertyPostalCode,
            property_community: propertyCommunity,
            unit_count: unitCount,
            contractor_name: contractorName || null,
            contractor_email: contractorEmail || null,
            contractor_phone: contractorPhone || null,
            window_start: targetStartDate || null,
            window_end: targetEndDate || null
          })
        });
        
        const data = await res.json();
        
        if (data.coop_run) {
          navigate(`/app/service-runs/coop-${data.coop_run.id}`);
        } else {
          setError(data.error || 'Failed to create coop run');
        }
      } else {
        if (!title || !communityId || !targetStartDate || !targetEndDate) {
          setError('Please fill in all required fields');
          setSaving(false);
          return;
        }
        
        const res = await fetch('/api/service-runs/runs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            description,
            communityId,
            bundleId: bundleId || null,
            runTypeId: runTypeId || null,
            serviceAreaDescription,
            targetStartDate,
            targetEndDate,
            minSlots,
            maxSlots,
            biddingOpensAt: biddingOpensAt || null,
            biddingClosesAt: biddingClosesAt || null,
            estimatedMobilizationCost: estimatedMobilizationCost ? parseFloat(estimatedMobilizationCost) : null,
            requirePhotos,
            requireDeposit,
            depositAmount: depositAmount ? parseFloat(depositAmount) : null,
            cancellationPolicy
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          navigate(`/app/service-runs/${data.run.slug}`);
        } else {
          setError(data.error || 'Failed to create run');
        }
      }
    } catch (err) {
      console.error('Failed to create run:', err);
      setError('Failed to create run');
    } finally {
      setSaving(false);
    }
  }

  const selectedCommunity = communities.find(c => c.id === communityId);
  const selectedBundle = bundles.find(b => b.id === bundleId);

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading form...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button
          onClick={() => navigate('/app/service-runs')}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-back"
        >
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Create Service Run</h1>
          <p className="text-muted-foreground">Set up a new bundled service run for a community</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/20 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-card rounded-lg p-6 border mb-6">
        <h2 className="text-lg font-semibold mb-4">Run Type</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setRunMode('coop')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              runMode === 'coop' 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-border hover:border-muted-foreground'
            }`}
            data-testid="button-mode-coop"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Cooperative Run</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Bundle with neighbors to share mobilization costs. You already have a contractor in mind.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setRunMode('bidding')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              runMode === 'bidding' 
                ? 'border-purple-500 bg-purple-500/10' 
                : 'border-border hover:border-muted-foreground'
            }`}
            data-testid="button-mode-bidding"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">Bidding Run</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Collect signups first, then open for contractor bids. Best for finding new contractors.
            </p>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {runMode === 'coop' ? (
          <>
            <div className="bg-card rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Service Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Trade Category *
                  </label>
                  <select
                    value={tradeCategory}
                    onChange={(e) => setTradeCategory(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    required
                    data-testid="select-trade-category"
                  >
                    <option value="">Select a trade...</option>
                    <option value="Roofing">Roofing</option>
                    <option value="Septic">Septic</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Tree Service">Tree Service</option>
                    <option value="Landscaping">Landscaping</option>
                    <option value="Painting">Painting</option>
                    <option value="Pressure Washing">Pressure Washing</option>
                    <option value="Gutter Cleaning">Gutter Cleaning</option>
                    <option value="Window Cleaning">Window Cleaning</option>
                    <option value="Chimney">Chimney</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Service Description *
                  </label>
                  <textarea
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="Describe what work needs to be done..."
                    required
                    data-testid="textarea-service-description"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Your Property</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Property Address *
                  </label>
                  <input
                    type="text"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="123 Main St"
                    required
                    data-testid="input-property-address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={propertyPostalCode}
                    onChange={(e) => setPropertyPostalCode(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="V0R 1X0"
                    data-testid="input-postal-code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Community
                  </label>
                  <input
                    type="text"
                    value={propertyCommunity}
                    onChange={(e) => setPropertyCommunity(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="Tofino"
                    data-testid="input-community"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Number of Units
                  </label>
                  <input
                    type="number"
                    value={unitCount}
                    onChange={(e) => setUnitCount(parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    data-testid="input-unit-count"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Contractor (Optional)</h2>
              <p className="text-sm text-muted-foreground mb-4">
                If you have a contractor in mind, add their details. They will be invited to claim this run.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Contractor Name
                  </label>
                  <input
                    type="text"
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="ABC Roofing"
                    data-testid="input-contractor-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Contractor Email
                  </label>
                  <input
                    type="email"
                    value={contractorEmail}
                    onChange={(e) => setContractorEmail(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="contractor@example.com"
                    data-testid="input-contractor-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Contractor Phone
                  </label>
                  <input
                    type="tel"
                    value={contractorPhone}
                    onChange={(e) => setContractorPhone(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    placeholder="250-555-1234"
                    data-testid="input-contractor-phone"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Service Window (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Preferred Start Date
                  </label>
                  <input
                    type="date"
                    value={targetStartDate}
                    onChange={(e) => setTargetStartDate(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Preferred End Date
                  </label>
                  <input
                    type="date"
                    value={targetEndDate}
                    onChange={(e) => setTargetEndDate(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-card rounded-lg p-6 border">
              <h2 className="text-lg font-semibold mb-4">Location & Service Package</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Community *
                  </label>
                  <select
                    value={communityId}
                    onChange={(e) => setCommunityId(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                    required
                    data-testid="select-community"
                  >
                    <option value="">Select a community...</option>
                    {communities.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.region}) - {c.remoteMultiplier}x
                      </option>
                    ))}
                  </select>
                  {selectedCommunity && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Climate: {selectedCommunity.climateRegionName} | 
                      Remote multiplier: {selectedCommunity.remoteMultiplier}x
                    </div>
                  )}
                </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Bundle / Package
              </label>
              <select
                value={bundleId}
                onChange={(e) => {
                  setBundleId(e.target.value);
                  if (e.target.value) setRunTypeId('');
                }}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="select-bundle"
              >
                <option value="">Select a bundle...</option>
                {bundles.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.itemCount} services)
                  </option>
                ))}
              </select>
              {selectedBundle && selectedBundle.pricing && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {Math.round((1 - selectedBundle.pricing.discountFactor) * 100)}% discount | 
                  ${selectedBundle.pricing.mobilizationSurcharge} mobilization
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Or select a Run Type (seasonal template)
            </label>
            <select
              value={runTypeId}
              onChange={(e) => {
                setRunTypeId(e.target.value);
                if (e.target.value) setBundleId('');
              }}
              className="w-full bg-muted border border-border rounded-lg px-4 py-2"
              data-testid="select-run-type"
            >
              <option value="">Select a run type...</option>
              {runTypes.map(rt => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} (Weeks {rt.earliestWeek}-{rt.latestWeek}, {rt.serviceCount} services)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Run Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Run Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Bamfield Fall Shutdown 2025"
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                required
                data-testid="input-title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the service run, what's included, and any special notes..."
                rows={3}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="input-description"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Service Area
              </label>
              <input
                type="text"
                value={serviceAreaDescription}
                onChange={(e) => setServiceAreaDescription(e.target.value)}
                placeholder="e.g., All of Bamfield including water-access properties"
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="input-service-area"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Dates</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Target Start Date *
              </label>
              <input
                type="date"
                value={targetStartDate}
                onChange={(e) => setTargetStartDate(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                required
                data-testid="input-start-date"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Target End Date *
              </label>
              <input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                required
                data-testid="input-end-date"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Bidding Opens
              </label>
              <input
                type="date"
                value={biddingOpensAt}
                onChange={(e) => setBiddingOpensAt(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="input-bidding-opens"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Bidding Closes
              </label>
              <input
                type="date"
                value={biddingClosesAt}
                onChange={(e) => setBiddingClosesAt(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="input-bidding-closes"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Capacity & Pricing</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Minimum Slots
              </label>
              <input
                type="number"
                value={minSlots}
                onChange={(e) => setMinSlots(parseInt(e.target.value) || 0)}
                min={1}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="input-min-slots"
              />
              <div className="text-xs text-muted-foreground mt-1">Run needs this many to proceed</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Maximum Slots
              </label>
              <input
                type="number"
                value={maxSlots}
                onChange={(e) => setMaxSlots(parseInt(e.target.value) || 0)}
                min={1}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="input-max-slots"
              />
              <div className="text-xs text-muted-foreground mt-1">Run closes at this capacity</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Est. Mobilization Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                <input
                  type="number"
                  value={estimatedMobilizationCost}
                  onChange={(e) => setEstimatedMobilizationCost(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg pl-8 pr-4 py-2"
                  data-testid="input-mobilization"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">Split across all slots</div>
            </div>
          </div>
        </div>
          </>
        )}

        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Requirements</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePhotos}
                  onChange={(e) => setRequirePhotos(e.target.checked)}
                  className="w-5 h-5 rounded bg-muted border-border"
                  data-testid="checkbox-photos"
                />
                <span>Require property photos from residents</span>
              </label>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireDeposit}
                  onChange={(e) => setRequireDeposit(e.target.checked)}
                  className="w-5 h-5 rounded bg-muted border-border"
                  data-testid="checkbox-deposit"
                />
                <span>Require deposit to reserve slot</span>
              </label>
              
              {requireDeposit && (
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="100"
                    className="bg-muted border border-border rounded-lg pl-8 pr-4 py-2 w-32"
                    data-testid="input-deposit-amount"
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Cancellation Policy
              </label>
              <textarea
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                rows={2}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-sm"
                data-testid="input-cancellation-policy"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/app/service-runs')}
            className="px-6 py-2 bg-muted hover-elevate rounded-lg"
            data-testid="button-cancel"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg disabled:opacity-50"
            data-testid="button-submit"
          >
            {saving ? 'Creating...' : 'Create Run & Start Collecting'}
          </button>
        </div>
      </form>
    </div>
  );
}
