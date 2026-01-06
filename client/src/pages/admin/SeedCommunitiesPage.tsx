import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, MapPin, Landmark, Mountain, FileText } from 'lucide-react';

type SourceType = 'dataset' | 'blank';
type DatasetType = 'municipalities' | 'regional_districts' | 'first_nations';
type Step = 1 | 2 | 3 | 4 | 5;

interface SourceOption {
  id: string;
  name: string;
  type?: string;
  population?: number;
  regional_district?: string;
}

interface CreatedCommunity {
  id: string;
  name: string;
  slug: string;
  portal_slug: string;
}

interface SourceCounts {
  municipalities: number;
  regional_districts: number;
  first_nations: number;
}

interface PrefillOptions {
  homepageSections: boolean;
  directoryCategories: boolean;
  contentTone: boolean;
  localWords: string;
  createPortalDraft: boolean;
  keepPortalHidden: boolean;
}

export default function SeedCommunitiesPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [datasetType, setDatasetType] = useState<DatasetType | null>(null);
  const [selectedOption, setSelectedOption] = useState<SourceOption | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createdCommunity, setCreatedCommunity] = useState<CreatedCommunity | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    portal_slug: '',
    type: 'community' as 'community' | 'government',
  });
  const [prefillOptions, setPrefillOptions] = useState<PrefillOptions>({
    homepageSections: true,
    directoryCategories: true,
    contentTone: true,
    localWords: '',
    createPortalDraft: true,
    keepPortalHidden: true,
  });

  const { data: countsData } = useQuery<{ counts: SourceCounts }>({
    queryKey: ['seed-source-counts'],
    queryFn: async () => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch('/api/admin/communities/seed/counts', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch counts');
      return res.json();
    },
  });

  const counts = countsData?.counts || { municipalities: 162, regional_districts: 27, first_nations: 203 };

  const { data: optionsData, isLoading: loadingOptions } = useQuery<{ options: SourceOption[] }>({
    queryKey: ['seed-options', datasetType, searchTerm],
    queryFn: async () => {
      if (!datasetType) return { options: [] };
      const token = localStorage.getItem('cc_token');
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/admin/communities/seed/${datasetType}?${params}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch options');
      return res.json();
    },
    enabled: !!datasetType && step === 2,
  });

  const options = optionsData?.options || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch('/api/admin/communities', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          portal_slug: formData.portal_slug,
          type: formData.type,
          source_type: sourceType === 'dataset' ? datasetType : 'manual',
          source_id: selectedOption?.id,
          prefill: prefillOptions,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create community');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedCommunity(data.community);
      setStep(5);
    },
  });

  function handleSourceSelect(source: SourceType) {
    setSourceType(source);
    if (source === 'blank') {
      setFormData({ name: '', slug: '', portal_slug: '', type: 'community' });
      setStep(3);
    }
  }

  function handleDatasetSelect(dataset: DatasetType) {
    setDatasetType(dataset);
    setStep(2);
  }

  function handleOptionSelect(option: SourceOption) {
    setSelectedOption(option);
    const slug = option.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    setFormData({
      name: `${option.name} Community`,
      slug: slug,
      portal_slug: slug,
      type: 'government',
    });
    setStep(3);
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
      setDatasetType(null);
      setSearchTerm('');
    } else if (step === 3) {
      if (sourceType === 'blank') {
        setStep(1);
        setSourceType(null);
      } else {
        setStep(2);
      }
      setSelectedOption(null);
    } else if (step === 4) {
      setStep(3);
    }
  }

  function handleReset() {
    setStep(1);
    setSourceType(null);
    setDatasetType(null);
    setSelectedOption(null);
    setSearchTerm('');
    setCreatedCommunity(null);
    setFormData({ name: '', slug: '', portal_slug: '', type: 'community' });
    setPrefillOptions({
      homepageSections: true,
      directoryCategories: true,
      contentTone: true,
      localWords: '',
      createPortalDraft: true,
      keepPortalHidden: true,
    });
  }

  const datasetLabels: Record<DatasetType, string> = {
    municipalities: 'municipality',
    regional_districts: 'regional district',
    first_nations: 'First Nation',
  };

  const totalSteps = sourceType === 'blank' ? 4 : 5;

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {step > 1 && step < 5 && (
          <button
            onClick={handleBack}
            data-testid="button-back"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              marginBottom: '24px',
              fontSize: '14px',
            }}
          >
            <ArrowLeft size={18} />
            Back
          </button>
        )}

        {step === 1 && (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                Seed a New Community
              </h1>
              <p style={{ color: '#9ca3af' }}>
                A gentle setup flow. Nothing goes public until you say so.
              </p>
            </div>

            <p style={{ marginBottom: '24px', fontSize: '18px', fontWeight: 600, color: '#e5e7eb' }}>
              Choose a starting point
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <button
                onClick={() => handleSourceSelect('dataset')}
                data-testid="source-dataset"
                style={{
                  padding: '20px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Use a seed dataset</div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                  Start from a known place and refine.
                </div>
              </button>

              <button
                onClick={() => handleSourceSelect('blank')}
                data-testid="source-blank"
                style={{
                  padding: '20px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Start blank</div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                  Create a clean community tenant with no prefill.
                </div>
              </button>
            </div>

            {sourceType === 'dataset' && (
              <>
                <p style={{ marginBottom: '16px', fontSize: '15px', color: '#9ca3af' }}>
                  Which dataset?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <DatasetCard
                    icon={<MapPin size={20} />}
                    title="Municipalities"
                    count={counts.municipalities}
                    onClick={() => handleDatasetSelect('municipalities')}
                  />
                  <DatasetCard
                    icon={<Landmark size={20} />}
                    title="Regional Districts"
                    count={counts.regional_districts}
                    onClick={() => handleDatasetSelect('regional_districts')}
                  />
                  <DatasetCard
                    icon={<Mountain size={20} />}
                    title="First Nations"
                    count={counts.first_nations}
                    onClick={() => handleDatasetSelect('first_nations')}
                  />
                </div>
              </>
            )}
          </>
        )}

        {step === 2 && datasetType && (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                Select a {datasetLabels[datasetType]}
              </h2>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Step 2 of {totalSteps}</span>
            </div>

            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
              Seed data is a starting draft. You can change everything later.
            </p>

            <input
              type="text"
              placeholder={`Search ${datasetLabels[datasetType]}s...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-options"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            />

            {loadingOptions ? (
              <p style={{ color: '#9ca3af' }}>Loading options...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {options.map((option) => (
                  <label
                    key={option.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: selectedOption?.id === option.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: selectedOption?.id === option.id ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="option"
                      checked={selectedOption?.id === option.id}
                      onChange={() => setSelectedOption(option)}
                    />
                    <span>
                      {option.name}
                      {option.type && <span style={{ color: '#6b7280' }}> ({option.type})</span>}
                    </span>
                  </label>
                ))}
                {options.length === 0 && (
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No results found.</p>
                )}
              </div>
            )}

            {selectedOption && (
              <button
                onClick={() => handleOptionSelect(selectedOption)}
                data-testid="button-continue"
                style={{
                  marginTop: '24px',
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            )}
          </>
        )}

        {step === 3 && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                Details
              </h2>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Step 3 of {totalSteps}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField
                label="Community name"
                placeholder="e.g., Bamfield"
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
              />
              <FormField
                label="Portal slug"
                placeholder="bamfield"
                helper="Used in the public URL. Lowercase, dashes only."
                value={formData.slug}
                onChange={(v) => setFormData({ ...formData, slug: v, portal_slug: v })}
              />
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'community' | 'government' })}
                  data-testid="select-type"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                  }}
                >
                  <option value="community">Community</option>
                  <option value="government">Government</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={prefillOptions.createPortalDraft}
                  onChange={(e) => setPrefillOptions({ ...prefillOptions, createPortalDraft: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Create public portal draft</div>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Creates portal config, but keeps it hidden.
                  </div>
                </div>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={prefillOptions.keepPortalHidden}
                  onChange={(e) => setPrefillOptions({ ...prefillOptions, keepPortalHidden: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Keep portal hidden for now</div>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Recommended. Turn it live when it feels ready.
                  </div>
                </div>
              </label>
            </div>

            <button
              onClick={() => sourceType === 'blank' ? setStep(4) : setStep(4)}
              disabled={!formData.name || !formData.slug}
              data-testid="button-continue-details"
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '12px 20px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: !formData.name || !formData.slug ? 'not-allowed' : 'pointer',
                opacity: !formData.name || !formData.slug ? 0.5 : 1,
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                What should we prefill?
              </h2>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Step 4 of {totalSteps}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={prefillOptions.homepageSections}
                  onChange={(e) => setPrefillOptions({ ...prefillOptions, homepageSections: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Homepage sections</div>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Welcome, essentials, and local highlights.
                  </div>
                </div>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={prefillOptions.directoryCategories}
                  onChange={(e) => setPrefillOptions({ ...prefillOptions, directoryCategories: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Starter directory categories</div>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Fire hall, fuel, grocery, lodging, parking, rentals.
                  </div>
                </div>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={prefillOptions.contentTone}
                  onChange={(e) => setPrefillOptions({ ...prefillOptions, contentTone: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Basic content tone</div>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Warm, plainspoken copy that fits small towns.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                A few local words (optional)
              </label>
              <input
                type="text"
                value={prefillOptions.localWords}
                onChange={(e) => setPrefillOptions({ ...prefillOptions, localWords: e.target.value })}
                placeholder="e.g., boardwalk, inlet, West Road..."
                data-testid="input-local-words"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Helps the default copy feel local.
              </p>
            </div>

            {selectedOption && (
              <div style={{ 
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
              }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
                  Data to import from {selectedOption.name}:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <ImportItem text="Geographic boundary" />
                  {selectedOption.population && (
                    <ImportItem text={`Population: ${selectedOption.population.toLocaleString()}`} />
                  )}
                  {selectedOption.regional_district && (
                    <ImportItem text={`Regional District: ${selectedOption.regional_district}`} />
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-create-community"
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Community'}
            </button>

            {createMutation.error && (
              <p style={{ color: '#f87171', marginTop: '12px', fontSize: '14px' }}>
                {createMutation.error.message}
              </p>
            )}
          </div>
        )}

        {step === 5 && createdCommunity && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              color: '#10b981',
            }}>
              <Check size={48} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Community created.
            </h1>
            <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
              Next: portal branding and homepage sections.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href={`/c/${createdCommunity.portal_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-view-community"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                View Portal
              </a>
              <button
                onClick={() => navigate(`/admin/communities/portals?id=${createdCommunity.id}`)}
                data-testid="button-configure-portal"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Configure Portal
              </button>
              <button
                onClick={handleReset}
                data-testid="button-seed-another"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Seed Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DatasetCard({ icon, title, count, onClick }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`dataset-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        padding: '16px 12px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: 'white',
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      <div style={{ color: '#a78bfa', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '2px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{count}</div>
    </button>
  );
}

function FormField({ label, placeholder, helper, value, onChange }: {
  label: string;
  placeholder?: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        style={{
          width: '100%',
          padding: '10px 12px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
        }}
      />
      {helper && (
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          {helper}
        </p>
      )}
    </div>
  );
}

function ImportItem({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
      <Check size={16} style={{ color: '#10b981' }} />
      <span>{text}</span>
    </div>
  );
}
