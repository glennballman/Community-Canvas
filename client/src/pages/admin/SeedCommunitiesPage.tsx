import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, MapPin, Landmark, Mountain, Plus } from 'lucide-react';

type SourceType = 'municipalities' | 'regional_districts' | 'first_nations' | 'manual';
type Step = 1 | 2 | 3 | 4;

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

export default function SeedCommunitiesPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [selectedOption, setSelectedOption] = useState<SourceOption | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createdCommunity, setCreatedCommunity] = useState<CreatedCommunity | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    portal_slug: '',
    type: 'community' as 'community' | 'government',
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
    queryKey: ['seed-options', sourceType, searchTerm],
    queryFn: async () => {
      if (!sourceType || sourceType === 'manual') return { options: [] };
      const token = localStorage.getItem('cc_token');
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/admin/communities/seed/${sourceType}?${params}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch options');
      return res.json();
    },
    enabled: !!sourceType && sourceType !== 'manual' && step === 2,
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
          source_type: sourceType,
          source_id: selectedOption?.id,
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
      setStep(4);
    },
  });

  function handleSourceSelect(source: SourceType) {
    setSourceType(source);
    if (source === 'manual') {
      setFormData({ name: '', slug: '', portal_slug: '', type: 'community' });
      setStep(3);
    } else {
      setStep(2);
    }
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
      setSourceType(null);
      setSearchTerm('');
    } else if (step === 3) {
      if (sourceType === 'manual') {
        setStep(1);
        setSourceType(null);
      } else {
        setStep(2);
      }
      setSelectedOption(null);
    }
  }

  function handleReset() {
    setStep(1);
    setSourceType(null);
    setSelectedOption(null);
    setSearchTerm('');
    setCreatedCommunity(null);
    setFormData({ name: '', slug: '', portal_slug: '', type: 'community' });
  }

  const sourceLabels: Record<SourceType, string> = {
    municipalities: 'municipality',
    regional_districts: 'regional district',
    first_nations: 'First Nation',
    manual: 'community',
  };

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {step > 1 && step < 4 && (
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
                Create a community portal from existing geographic data.
              </p>
            </div>

            <p style={{ marginBottom: '24px', fontSize: '15px' }}>
              Where should we pull data from?
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '16px',
            }}>
              <SourceCard
                icon={<MapPin size={24} />}
                title="BC Municipalities"
                subtitle={`${counts.municipalities} available`}
                onClick={() => handleSourceSelect('municipalities')}
              />
              <SourceCard
                icon={<Landmark size={24} />}
                title="Regional Districts"
                subtitle={`${counts.regional_districts} available`}
                onClick={() => handleSourceSelect('regional_districts')}
              />
              <SourceCard
                icon={<Mountain size={24} />}
                title="First Nations"
                subtitle={`${counts.first_nations} available`}
                onClick={() => handleSourceSelect('first_nations')}
              />
              <SourceCard
                icon={<Plus size={24} />}
                title="Manual Entry"
                subtitle="Start from scratch"
                onClick={() => handleSourceSelect('manual')}
              />
            </div>
          </>
        )}

        {step === 2 && sourceType && sourceType !== 'manual' && (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                Select a {sourceLabels[sourceType]}
              </h2>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Step 2 of 4</span>
            </div>

            <input
              type="text"
              placeholder={`Search ${sourceLabels[sourceType]}s...`}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {options.map((option) => (
                  <label
                    key={option.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
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
                Preview: {formData.name || 'New Community'}
              </h2>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Step 3 of 4</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField
                label="Name"
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
              />
              <FormField
                label="Slug"
                value={formData.slug}
                onChange={(v) => setFormData({ ...formData, slug: v })}
              />
              <FormField
                label="Portal Slug"
                value={formData.portal_slug}
                onChange={(v) => setFormData({ ...formData, portal_slug: v })}
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

            {selectedOption && (
              <div style={{ 
                marginTop: '24px',
                padding: '16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
              }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
                  Data to import:
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
              disabled={createMutation.isPending || !formData.name || !formData.slug}
              data-testid="button-create-community"
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

        {step === 4 && createdCommunity && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              color: '#10b981',
            }}>
              ✅
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              {createdCommunity.name} created!
            </h1>
            <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
              Portal URL: /c/{createdCommunity.portal_slug}
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
                View Community
              </a>
              <button
                onClick={() => navigate(`/admin/communities/${createdCommunity.id}`)}
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

function SourceCard({ icon, title, subtitle, onClick }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`source-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        padding: '24px 16px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: 'white',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ color: '#a78bfa', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#9ca3af' }}>{subtitle}</div>
    </button>
  );
}

function FormField({ label, value, onChange }: {
  label: string;
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
