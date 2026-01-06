# P1 ADMIN PAGES BUILD SPEC

## Instructions for Replit

Build these 5 admin pages to replace the "Coming soon..." placeholders. Work autonomously through each page in order. Only stop if you hit a blocking issue requiring a decision.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   RULES:                                                                      ║
║   1. Use the EXACT copy provided (labels, tooltips, helper text)              ║
║   2. Follow the component structure specified                                 ║
║   3. Create API endpoints as documented                                       ║
║   4. Match existing app patterns (inline styles, existing components)         ║
║   5. Verify each page works before moving to the next                         ║
║   6. Do NOT add features beyond what's specified                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

# TABLE OF CONTENTS

1. [Page 1: All Communities](#page-1-all-communities)
2. [Page 2: Seed Communities](#page-2-seed-communities)
3. [Page 3: Portal Config](#page-3-portal-config)
4. [Page 4: AI Queue](#page-4-ai-queue)
5. [Page 5: Flagged Content](#page-5-flagged-content)
6. [API Endpoints](#api-endpoints)
7. [Verification Checklist](#verification-checklist)

---

# PAGE 1: ALL COMMUNITIES

**Route:** `/admin/communities`
**File:** `client/src/pages/admin/CommunitiesPage.tsx`

## Purpose
List all community/government tenants. Search, filter, click to see details.

## UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Communities                                                      │
│ Create and manage community portals across the platform.         │
├─────────────────────────────────────────────────────────────────┤
│ [Search communities...]                    [+ Seed Community]    │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [All] [Has Portal] [No Portal] [Government] [Community] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏔️ Bamfield Community                                        │ │
│ │ bamfield • Government • Portal: bamfield                     │ │
│ │ 3 members • Created Dec 2024                                 │ │
│ │                                            [View] [Edit]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏔️ Tofino                                                    │ │
│ │ tofino • Community • Portal: tofino                          │ │
│ │ 1 member • Created Jan 2025                                  │ │
│ │                                            [View] [Edit]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Showing 12 of 24 communities                    [Load more]      │
└─────────────────────────────────────────────────────────────────┘
```

## Exact Copy

**Page title:** Communities
**Subtitle:** Create and manage community portals across the platform.

**Search placeholder:** Search communities by name or slug...

**Filter chips:**
- All
- Has Portal
- No Portal  
- Government
- Community

**Button:** + Seed Community (links to /admin/communities/seed)

**Card fields:**
- Icon: 🏔️ (community) or 🏛️ (government)
- Name: tenant.name
- Meta line: `{slug} • {type} • Portal: {portal_slug || 'None'}`
- Stats line: `{member_count} members • Created {created_at formatted}`

**Card actions:**
- View → Opens public portal in new tab (if portal_slug exists)
- Edit → Opens detail panel or navigates to edit page

**Empty state:**
- Icon: 🏔️
- Title: No communities found
- Body: Try adjusting your filters or seed a new community.

**Load more:** Load more (if pagination needed)

## Component Code

```tsx
// client/src/pages/admin/CommunitiesPage.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, ExternalLink, Settings } from 'lucide-react';

type FilterType = 'all' | 'has_portal' | 'no_portal' | 'government' | 'community';

interface Community {
  id: string;
  name: string;
  slug: string;
  type: 'community' | 'government';
  portal_slug: string | null;
  member_count: number;
  created_at: string;
}

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, error } = useQuery<{ communities: Community[] }>({
    queryKey: ['admin-communities', search, filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('filter', filter);
      const res = await fetch(`/api/admin/communities?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch communities');
      return res.json();
    },
  });

  const communities = data?.communities || [];

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'has_portal', label: 'Has Portal' },
    { key: 'no_portal', label: 'No Portal' },
    { key: 'government', label: 'Government' },
    { key: 'community', label: 'Community' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Communities
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Create and manage community portals across the platform.
          </p>
        </div>

        {/* Search + Action Row */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#6b7280',
              }} 
            />
            <input
              type="text"
              placeholder="Search communities by name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
              }}
            />
          </div>
          <Link
            to="/admin/communities/seed"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Plus size={18} />
            Seed Community
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: filter === f.key ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                color: filter === f.key ? 'white' : '#9ca3af',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading communities...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px', 
            color: '#f87171',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
          }}>
            Failed to load communities. Please try again.
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && communities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏔️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
              No communities found
            </h2>
            <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
              Try adjusting your filters or seed a new community.
            </p>
            <Link
              to="/admin/communities/seed"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              <Plus size={18} />
              Seed Community
            </Link>
          </div>
        )}

        {/* Community List */}
        {!isLoading && communities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityCard({ community }: { community: Community }) {
  const icon = community.type === 'government' ? '🏛️' : '🏔️';
  const createdDate = new Date(community.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '20px' }}>{icon}</span>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>{community.name}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>
            {community.slug} • {community.type} • Portal: {community.portal_slug || 'None'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {community.member_count} members • Created {createdDate}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {community.portal_slug && (
            <a
              href={`/c/${community.portal_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#9ca3af',
                textDecoration: 'none',
                fontSize: '13px',
              }}
            >
              <ExternalLink size={14} />
              View
            </a>
          )}
          <Link
            to={`/admin/communities/${community.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'rgba(139, 92, 246, 0.2)',
              borderRadius: '6px',
              color: '#a78bfa',
              textDecoration: 'none',
              fontSize: '13px',
            }}
          >
            <Settings size={14} />
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

# PAGE 2: SEED COMMUNITIES

**Route:** `/admin/communities/seed`
**File:** `client/src/pages/admin/SeedCommunitiesPage.tsx`

## Purpose
Guided wizard to create a new community tenant from existing datasets (municipalities, regions).

## UI Structure — Multi-Step Wizard

```
Step 1: Select Source
┌─────────────────────────────────────────────────────────────────┐
│ Seed a New Community                                             │
│ Create a community portal from existing geographic data.         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Where should we pull data from?                                  │
│                                                                  │
│ ┌─────────────────────┐  ┌─────────────────────┐                │
│ │ 🗺️ BC Municipalities │  │ 🏛️ Regional Districts │               │
│ │ 162 available        │  │ 27 available         │               │
│ └─────────────────────┘  └─────────────────────┘                │
│                                                                  │
│ ┌─────────────────────┐  ┌─────────────────────┐                │
│ │ 🏔️ First Nations     │  │ ➕ Manual Entry       │               │
│ │ 203 available        │  │ Start from scratch   │               │
│ └─────────────────────┘  └─────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Step 2: Select Community
┌─────────────────────────────────────────────────────────────────┐
│ ← Back                                        Step 2 of 4        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Select a municipality                                            │
│                                                                  │
│ [Search municipalities...]                                       │
│                                                                  │
│ ○ Bamfield (unincorporated)                                      │
│ ○ Tofino (District)                                              │
│ ○ Ucluelet (District)                                            │
│ ○ Port Alberni (City)                                            │
│ ○ ...                                                            │
│                                                                  │
│                                              [Continue]          │
└─────────────────────────────────────────────────────────────────┘

Step 3: Preview & Configure
┌─────────────────────────────────────────────────────────────────┐
│ ← Back                                        Step 3 of 4        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Preview: Bamfield                                                │
│                                                                  │
│ Name           [Bamfield Community        ]                      │
│ Slug           [bamfield                  ]                      │
│ Portal Slug    [bamfield                  ]                      │
│ Type           [Government ▼              ]                      │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Data to import:                                              │ │
│ │ ✓ Geographic boundary                                        │ │
│ │ ✓ Population: 182                                            │ │
│ │ ✓ Regional District: Alberni-Clayoquot                       │ │
│ │ ✓ Nearest airport: YQU (Tofino)                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                                              [Create Community]  │
└─────────────────────────────────────────────────────────────────┘

Step 4: Success
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                          ✅                                      │
│                                                                  │
│ Bamfield Community created!                                      │
│                                                                  │
│ Portal URL: /c/bamfield                                          │
│                                                                  │
│ [View Community]  [Configure Portal]  [Seed Another]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Exact Copy

**Page title:** Seed a New Community
**Subtitle:** Create a community portal from existing geographic data.

**Step 1 — Source selection:**
- Question: Where should we pull data from?
- Cards:
  - 🗺️ BC Municipalities — "{count} available"
  - 🏛️ Regional Districts — "{count} available"
  - 🏔️ First Nations — "{count} available"
  - ➕ Manual Entry — "Start from scratch"

**Step 2 — Selection:**
- Title: Select a {source_type}
- Search placeholder: Search {source_type}...

**Step 3 — Preview:**
- Title: Preview: {name}
- Fields: Name, Slug, Portal Slug, Type (dropdown: Community, Government)
- Data import section title: Data to import:
- Checkmarks show what data will be imported

**Step 4 — Success:**
- Icon: ✅
- Title: {name} created!
- Subtitle: Portal URL: /c/{portal_slug}
- Buttons: View Community, Configure Portal, Seed Another

## Component Code

```tsx
// client/src/pages/admin/SeedCommunitiesPage.tsx

import React, { useState } from 'react';
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

export default function SeedCommunitiesPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<SourceType | null>(null);
  const [selectedOption, setSelectedOption] = useState<SourceOption | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    portal_slug: '',
    type: 'community' as 'community' | 'government',
  });
  const [createdCommunity, setCreatedCommunity] = useState<CreatedCommunity | null>(null);

  // Fetch source options
  const { data: options, isLoading: loadingOptions } = useQuery<{ options: SourceOption[] }>({
    queryKey: ['seed-options', source, search],
    queryFn: async () => {
      if (!source || source === 'manual') return { options: [] };
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/seed-sources/${source}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch options');
      return res.json();
    },
    enabled: !!source && source !== 'manual' && step === 2,
  });

  // Create community mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/communities/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source_type: source,
          source_id: selectedOption?.id,
          ...formData,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create community');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedCommunity(data.community);
      setStep(4);
    },
  });

  // Handle source selection
  function handleSourceSelect(s: SourceType) {
    setSource(s);
    if (s === 'manual') {
      setFormData({ name: '', slug: '', portal_slug: '', type: 'community' });
      setStep(3);
    } else {
      setStep(2);
    }
  }

  // Handle option selection
  function handleOptionSelect(option: SourceOption) {
    setSelectedOption(option);
    const slug = option.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    setFormData({
      name: `${option.name} Community`,
      slug,
      portal_slug: slug,
      type: option.type === 'regional_district' ? 'government' : 'community',
    });
    setStep(3);
  }

  // Reset wizard
  function handleReset() {
    setStep(1);
    setSource(null);
    setSelectedOption(null);
    setSearch('');
    setFormData({ name: '', slug: '', portal_slug: '', type: 'community' });
    setCreatedCommunity(null);
  }

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Header */}
        {step < 4 && (
          <div style={{ marginBottom: '32px' }}>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Seed a New Community
            </h1>
            <p style={{ color: '#9ca3af' }}>
              Create a community portal from existing geographic data.
            </p>
            {step > 1 && (
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                Step {step} of 4
              </p>
            )}
          </div>
        )}

        {/* Step 1: Source Selection */}
        {step === 1 && (
          <div>
            <p style={{ marginBottom: '20px', color: '#e5e7eb' }}>
              Where should we pull data from?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <SourceCard
                icon={<MapPin size={24} />}
                title="BC Municipalities"
                subtitle="162 available"
                onClick={() => handleSourceSelect('municipalities')}
              />
              <SourceCard
                icon={<Landmark size={24} />}
                title="Regional Districts"
                subtitle="27 available"
                onClick={() => handleSourceSelect('regional_districts')}
              />
              <SourceCard
                icon={<Mountain size={24} />}
                title="First Nations"
                subtitle="203 available"
                onClick={() => handleSourceSelect('first_nations')}
              />
              <SourceCard
                icon={<Plus size={24} />}
                title="Manual Entry"
                subtitle="Start from scratch"
                onClick={() => handleSourceSelect('manual')}
              />
            </div>
          </div>
        )}

        {/* Step 2: Select from list */}
        {step === 2 && source && source !== 'manual' && (
          <div>
            <p style={{ marginBottom: '16px', color: '#e5e7eb' }}>
              Select a {source.replace('_', ' ')}
            </p>
            <input
              type="text"
              placeholder={`Search ${source.replace('_', ' ')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              <p style={{ color: '#9ca3af' }}>Loading...</p>
            ) : (
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                {(options?.options || []).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionSelect(opt)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{opt.name}</div>
                    {opt.type && (
                      <div style={{ fontSize: '13px', color: '#9ca3af' }}>{opt.type}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview & Configure */}
        {step === 3 && (
          <div>
            <p style={{ marginBottom: '20px', color: '#e5e7eb', fontSize: '18px', fontWeight: 600 }}>
              Preview: {selectedOption?.name || 'New Community'}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
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
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
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

        {/* Step 4: Success */}
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

// Helper components
function SourceCard({ icon, title, subtitle, onClick }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
```

---

# PAGE 3: PORTAL CONFIG

**Route:** `/admin/communities/portals`
**File:** `client/src/pages/admin/PortalConfigPage.tsx`

## Purpose
Configure portal settings for communities: theme, sections, SEO.

## UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Portal Configuration                                             │
│ Customize how community portals look and feel.                   │
├─────────────────────────────────────────────────────────────────┤
│ Select a community: [Bamfield Community ▼]                       │
├─────────────────────────────────────────────────────────────────┤
│ [Theme] [Sections] [Area Switcher] [SEO]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Theme Tab:                                                       │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Primary Color    [#3b82f6] [█████]                           ││
│ │ Accent Color     [#f59e0b] [█████]                           ││
│ │ Background       [#0c1829] [█████]                           ││
│ │ Logo URL         [https://...]                               ││
│ │ Tagline          [Gateway to the Pacific]                    ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│                                         [Save Changes]           │
└─────────────────────────────────────────────────────────────────┘
```

## Exact Copy

**Page title:** Portal Configuration
**Subtitle:** Customize how community portals look and feel.

**Community selector label:** Select a community:

**Tabs:**
- Theme
- Sections  
- Area Switcher
- SEO

**Theme tab fields:**
- Primary Color
- Accent Color
- Background Color
- Logo URL (helper: "Recommended: 200x50px PNG with transparency")
- Tagline (helper: "A short phrase that appears below the community name")

**Sections tab:**
- Title: Homepage Sections
- Helper: Drag to reorder. Toggle visibility.
- Default sections: Hero, Businesses, Services, Events, Good News, About

**Area Switcher tab:**
- Title: Area Groups
- Helper: Let visitors switch between related communities (e.g., Bamfield ↔ Ucluelet)
- Add area button: + Add Area

**SEO tab fields:**
- Meta Title (helper: "Shown in browser tabs and search results")
- Meta Description (helper: "155 characters max")
- Social Image URL (helper: "Used when shared on social media. 1200x630px recommended.")

**Save button:** Save Changes
**Success toast:** Changes saved successfully

## Component Code

```tsx
// client/src/pages/admin/PortalConfigPage.tsx

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type TabType = 'theme' | 'sections' | 'areas' | 'seo';

interface Community {
  id: string;
  name: string;
  portal_slug: string;
}

interface PortalConfig {
  theme: {
    primary_color: string;
    accent_color: string;
    background_color: string;
    logo_url: string;
    tagline: string;
  };
  sections: Array<{ key: string; label: string; visible: boolean }>;
  area_groups: Array<{ tenant_id: string; name: string; portal_slug: string }>;
  seo: {
    meta_title: string;
    meta_description: string;
    social_image_url: string;
  };
}

const DEFAULT_CONFIG: PortalConfig = {
  theme: {
    primary_color: '#3b82f6',
    accent_color: '#f59e0b',
    background_color: '#0c1829',
    logo_url: '',
    tagline: '',
  },
  sections: [
    { key: 'hero', label: 'Hero', visible: true },
    { key: 'businesses', label: 'Businesses', visible: true },
    { key: 'services', label: 'Services', visible: true },
    { key: 'events', label: 'Events', visible: true },
    { key: 'good_news', label: 'Good News', visible: true },
    { key: 'about', label: 'About', visible: true },
  ],
  area_groups: [],
  seo: {
    meta_title: '',
    meta_description: '',
    social_image_url: '',
  },
};

export default function PortalConfigPage() {
  const queryClient = useQueryClient();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [config, setConfig] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Fetch communities
  const { data: communitiesData } = useQuery<{ communities: Community[] }>({
    queryKey: ['admin-communities-list'],
    queryFn: async () => {
      const res = await fetch('/api/admin/communities?filter=has_portal', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const communities = communitiesData?.communities || [];

  // Fetch portal config when community selected
  const { data: configData, isLoading: loadingConfig } = useQuery<{ config: PortalConfig }>({
    queryKey: ['portal-config', selectedCommunityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/communities/${selectedCommunityId}/portal-config`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json();
    },
    enabled: !!selectedCommunityId,
  });

  useEffect(() => {
    if (configData?.config) {
      setConfig({ ...DEFAULT_CONFIG, ...configData.config });
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/communities/${selectedCommunityId}/portal-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      setSaveMessage('Changes saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['portal-config', selectedCommunityId] });
    },
  });

  const tabs: { key: TabType; label: string }[] = [
    { key: 'theme', label: 'Theme' },
    { key: 'sections', label: 'Sections' },
    { key: 'areas', label: 'Area Switcher' },
    { key: 'seo', label: 'SEO' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Portal Configuration
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Customize how community portals look and feel.
          </p>
        </div>

        {/* Community Selector */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
            Select a community:
          </label>
          <select
            value={selectedCommunityId || ''}
            onChange={(e) => setSelectedCommunityId(e.target.value || null)}
            style={{
              width: '100%',
              maxWidth: '300px',
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
            }}
          >
            <option value="">Choose a community...</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedCommunityId && (
          <>
            {/* Tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              marginBottom: '24px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: activeTab === tab.key ? '#8b5cf6' : 'transparent',
                    color: activeTab === tab.key ? 'white' : '#9ca3af',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingConfig ? (
              <p style={{ color: '#9ca3af' }}>Loading configuration...</p>
            ) : (
              <>
                {/* Theme Tab */}
                {activeTab === 'theme' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <ColorField
                      label="Primary Color"
                      value={config.theme.primary_color}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, primary_color: v } })}
                    />
                    <ColorField
                      label="Accent Color"
                      value={config.theme.accent_color}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, accent_color: v } })}
                    />
                    <ColorField
                      label="Background Color"
                      value={config.theme.background_color}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, background_color: v } })}
                    />
                    <TextField
                      label="Logo URL"
                      value={config.theme.logo_url}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, logo_url: v } })}
                      helper="Recommended: 200x50px PNG with transparency"
                    />
                    <TextField
                      label="Tagline"
                      value={config.theme.tagline}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, tagline: v } })}
                      helper="A short phrase that appears below the community name"
                    />
                  </div>
                )}

                {/* Sections Tab */}
                {activeTab === 'sections' && (
                  <div>
                    <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                      Drag to reorder. Toggle visibility.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {config.sections.map((section, i) => (
                        <div
                          key={section.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                          }}
                        >
                          <span>{section.label}</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={section.visible}
                              onChange={(e) => {
                                const newSections = [...config.sections];
                                newSections[i] = { ...section, visible: e.target.checked };
                                setConfig({ ...config, sections: newSections });
                              }}
                            />
                            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Visible</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Areas Tab */}
                {activeTab === 'areas' && (
                  <div>
                    <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                      Let visitors switch between related communities (e.g., Bamfield ↔ Ucluelet)
                    </p>
                    {config.area_groups.length === 0 ? (
                      <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No area groups configured.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        {config.area_groups.map((area, i) => (
                          <div
                            key={area.tenant_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              borderRadius: '8px',
                            }}
                          >
                            <span>{area.name}</span>
                            <button
                              onClick={() => {
                                const newAreas = config.area_groups.filter((_, idx) => idx !== i);
                                setConfig({ ...config, area_groups: newAreas });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      + Add Area
                    </button>
                  </div>
                )}

                {/* SEO Tab */}
                {activeTab === 'seo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <TextField
                      label="Meta Title"
                      value={config.seo.meta_title}
                      onChange={(v) => setConfig({ ...config, seo: { ...config.seo, meta_title: v } })}
                      helper="Shown in browser tabs and search results"
                    />
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                        Meta Description
                      </label>
                      <textarea
                        value={config.seo.meta_description}
                        onChange={(e) => setConfig({ ...config, seo: { ...config.seo, meta_description: e.target.value } })}
                        maxLength={155}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '14px',
                          resize: 'vertical',
                        }}
                      />
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        {config.seo.meta_description.length}/155 characters
                      </p>
                    </div>
                    <TextField
                      label="Social Image URL"
                      value={config.seo.social_image_url}
                      onChange={(v) => setConfig({ ...config, seo: { ...config.seo, social_image_url: v } })}
                      helper="Used when shared on social media. 1200x630px recommended."
                    />
                  </div>
                )}

                {/* Save Button */}
                <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                      opacity: saveMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                  {saveMessage && (
                    <span style={{ color: '#10b981', fontSize: '14px' }}>{saveMessage}</span>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {!selectedCommunityId && (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            color: '#6b7280',
          }}>
            Select a community above to configure its portal.
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components
function TextField({ label, value, onChange, helper }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
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
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{helper}</p>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
          }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '40px',
            height: '40px',
            padding: 0,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}
```

---

# PAGE 4: AI QUEUE

**Route:** `/admin/moderation/ai-queue`
**File:** `client/src/pages/admin/AIQueuePage.tsx`

## Purpose
Review AI-flagged content (Good News submissions, Service Runs) for approval/rejection.

## UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ The Good News — Review Queue                                     │
│ Keep it kind, keep it private, keep it real.                     │
├─────────────────────────────────────────────────────────────────┤
│ [Search stories...]              [Pending ▼] [Show visitor ☐]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ New note                                    2 hours ago      │ │
│ │ Visitor • Bamfield Community                                 │ │
│ │                                                              │ │
│ │ "A kind stranger helped us change our tire on the road      │ │
│ │ to Bamfield. Wouldn't accept anything for their help."      │ │
│ │                                                              │ │
│ │ Suggested recipient: Road Angel                              │ │
│ │                                                              │ │
│ │              [Decline]  [Approve & Publish]                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ New note                                    5 hours ago      │ │
│ │ Resident • Bamfield Community                                │ │
│ │                                                              │ │
│ │ "The fire hall checked on my mom during the power outage.   │ │
│ │ So grateful for our volunteers."                            │ │
│ │                                                              │ │
│ │              [Decline]  [Approve & Publish]                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Empty state: All caught up. No notes are waiting for review.     │
└─────────────────────────────────────────────────────────────────┘
```

## Exact Copy

**Page title:** The Good News — Review Queue
**Subtitle:** Keep it kind, keep it private, keep it real.

**Search placeholder:** Search stories, keywords, or suggested names...

**Status filter dropdown:**
- Pending (default)
- Approved
- Declined
- Hidden

**Toggle:** Show visitor notes
**Toggle helper:** Visitor notes are often your best tourism signal.

**Card header:** New note
**Card meta:** {Visitor/Resident} • {community_name} • {time_ago}

**Story display:** Show story_raw in quotes

**Suggested recipient label:** Suggested recipient: {suggested_recipient_text}

**Buttons:**
- Decline (secondary)
- Approve & Publish (primary)

**Empty state:**
- Title: All caught up.
- Body: No notes are waiting for review.

**Decline modal:**
- Title: Decline this note?
- Body: This won't appear publicly. The submitter won't be notified unless you choose to follow up.
- Reason placeholder: Optional note to yourself (e.g., 'too specific', 'not a thank-you')
- Buttons: Cancel, Decline

## Component Code

```tsx
// client/src/pages/admin/AIQueuePage.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';

type StatusFilter = 'pending' | 'approved' | 'declined' | 'hidden';

interface Submission {
  id: string;
  community_tenant_id: string;
  community_name: string;
  story_raw: string;
  is_visitor: boolean;
  suggested_recipient_text: string | null;
  status: string;
  created_at: string;
}

export default function AIQueuePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [showVisitorOnly, setShowVisitorOnly] = useState(false);
  const [declineModalId, setDeclineModalId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // Fetch submissions
  const { data, isLoading } = useQuery<{ submissions: Submission[] }>({
    queryKey: ['ai-queue', search, statusFilter, showVisitorOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('status', statusFilter);
      if (showVisitorOnly) params.set('visitor_only', 'true');
      const res = await fetch(`/api/admin/moderation/submissions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const submissions = data?.submissions || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/moderation/submissions/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-queue'] });
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/moderation/submissions/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to decline');
      return res.json();
    },
    onSuccess: () => {
      setDeclineModalId(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['ai-queue'] });
    },
  });

  function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            The Good News — Review Queue
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Keep it kind, keep it private, keep it real.
          </p>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#6b7280',
              }} 
            />
            <input
              type="text"
              placeholder="Search stories, keywords, or suggested names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="hidden">Hidden</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showVisitorOnly}
              onChange={(e) => setShowVisitorOnly(e.target.checked)}
            />
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>Show visitor notes</span>
          </label>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading submissions...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && submissions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💛</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
              All caught up.
            </h2>
            <p style={{ color: '#9ca3af' }}>
              No notes are waiting for review.
            </p>
          </div>
        )}

        {/* Submissions List */}
        {!isLoading && submissions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                {/* Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#9ca3af',
                }}>
                  <span>New note</span>
                  <span>{formatTimeAgo(sub.created_at)}</span>
                </div>
                
                {/* Meta */}
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                  {sub.is_visitor ? 'Visitor' : 'Resident'} • {sub.community_name}
                </div>

                {/* Story */}
                <div style={{ 
                  fontSize: '15px', 
                  lineHeight: 1.6, 
                  marginBottom: '16px',
                  fontStyle: 'italic',
                  color: '#e5e7eb',
                }}>
                  "{sub.story_raw}"
                </div>

                {/* Suggested Recipient */}
                {sub.suggested_recipient_text && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#a78bfa', 
                    marginBottom: '16px',
                  }}>
                    Suggested recipient: {sub.suggested_recipient_text}
                  </div>
                )}

                {/* Actions */}
                {statusFilter === 'pending' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => setDeclineModalId(sub.id)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(sub.id)}
                      disabled={approveMutation.isPending}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      Approve & Publish
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Decline Modal */}
        {declineModalId && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                zIndex: 100,
              }}
              onClick={() => setDeclineModalId(null)}
            />
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#1a2744',
                borderRadius: '12px',
                padding: '24px',
                width: '400px',
                maxWidth: '90vw',
                zIndex: 101,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Decline this note?</h3>
                <button
                  onClick={() => setDeclineModalId(null)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                This won't appear publicly. The submitter won't be notified unless you choose to follow up.
              </p>
              <textarea
                placeholder="Optional note to yourself (e.g., 'too specific', 'not a thank-you')"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  marginBottom: '16px',
                  resize: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setDeclineModalId(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => declineMutation.mutate({ id: declineModalId, reason: declineReason })}
                  disabled={declineMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {declineMutation.isPending ? 'Declining...' : 'Decline'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

# PAGE 5: FLAGGED CONTENT

**Route:** `/admin/moderation/flagged`
**File:** `client/src/pages/admin/FlaggedContentPage.tsx`

## Purpose
Review user-reported content across the platform.

## UI Structure

Similar to AI Queue but for user reports:

```
┌─────────────────────────────────────────────────────────────────┐
│ Flagged Content                                                  │
│ User-reported items requiring review.                            │
├─────────────────────────────────────────────────────────────────┤
│ [Search...]                        [All Types ▼] [Pending ▼]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Empty state: No flagged content. Your community is doing great!  │
└─────────────────────────────────────────────────────────────────┘
```

## Exact Copy

**Page title:** Flagged Content
**Subtitle:** User-reported items requiring review.

**Search placeholder:** Search reports...

**Type filter:**
- All Types
- Good News
- Service Run
- Business Listing
- Profile

**Status filter:**
- Pending
- Resolved
- Dismissed

**Empty state:**
- Icon: ✅
- Title: No flagged content
- Body: Your community is doing great!

## Component Code

```tsx
// client/src/pages/admin/FlaggedContentPage.tsx

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

type ContentType = 'all' | 'good_news' | 'service_run' | 'business' | 'profile';
type StatusType = 'pending' | 'resolved' | 'dismissed';

interface FlaggedItem {
  id: string;
  content_type: string;
  content_id: string;
  content_preview: string;
  reason: string;
  reporter_email: string;
  status: string;
  created_at: string;
}

export default function FlaggedContentPage() {
  const [search, setSearch] = useState('');
  const [contentType, setContentType] = useState<ContentType>('all');
  const [status, setStatus] = useState<StatusType>('pending');

  const { data, isLoading } = useQuery<{ items: FlaggedItem[] }>({
    queryKey: ['flagged-content', search, contentType, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (contentType !== 'all') params.set('type', contentType);
      params.set('status', status);
      const res = await fetch(`/api/admin/moderation/flagged?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const items = data?.items || [];

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Flagged Content
          </h1>
          <p style={{ color: '#9ca3af' }}>
            User-reported items requiring review.
          </p>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#6b7280',
              }} 
            />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
              }}
            />
          </div>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
            }}
          >
            <option value="all">All Types</option>
            <option value="good_news">Good News</option>
            <option value="service_run">Service Run</option>
            <option value="business">Business Listing</option>
            <option value="profile">Profile</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusType)}
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
            }}
          >
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
              No flagged content
            </h2>
            <p style={{ color: '#9ca3af' }}>
              Your community is doing great!
            </p>
          </div>
        )}

        {/* Items List */}
        {!isLoading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '8px',
                }}>
                  <span style={{ 
                    fontSize: '12px', 
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: '#9ca3af',
                  }}>
                    {item.content_type}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                  {item.content_preview}
                </p>
                <p style={{ fontSize: '13px', color: '#f87171' }}>
                  Reason: {item.reason}
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  Reported by: {item.reporter_email}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

# API ENDPOINTS

Create these backend endpoints to support the pages:

## Communities

```typescript
// GET /api/admin/communities
// Query params: search, filter (all|has_portal|no_portal|government|community)
// Returns: { communities: Community[] }

// GET /api/admin/communities/:id
// Returns: { community: Community }

// GET /api/admin/communities/:id/portal-config
// Returns: { config: PortalConfig }

// PUT /api/admin/communities/:id/portal-config
// Body: PortalConfig
// Returns: { success: true }

// POST /api/admin/communities/seed
// Body: { source_type, source_id, name, slug, portal_slug, type }
// Returns: { community: CreatedCommunity }
```

## Seed Sources

```typescript
// GET /api/admin/seed-sources/:type
// Type: municipalities | regional_districts | first_nations
// Query params: search
// Returns: { options: SourceOption[] }
```

## Moderation

```typescript
// GET /api/admin/moderation/submissions
// Query params: search, status, visitor_only
// Returns: { submissions: Submission[] }

// POST /api/admin/moderation/submissions/:id/approve
// Returns: { success: true }

// POST /api/admin/moderation/submissions/:id/decline
// Body: { reason }
// Returns: { success: true }

// GET /api/admin/moderation/flagged
// Query params: search, type, status
// Returns: { items: FlaggedItem[] }
```

---

# VERIFICATION CHECKLIST

After building all pages, verify:

## Page 1: Communities
- [ ] Page loads at /admin/communities
- [ ] Search filters results
- [ ] Filter chips work
- [ ] "Seed Community" button navigates to /admin/communities/seed
- [ ] Community cards display correctly
- [ ] "View" opens portal in new tab
- [ ] "Edit" navigates to edit page

## Page 2: Seed Communities
- [ ] Page loads at /admin/communities/seed
- [ ] Source selection cards work
- [ ] Search in step 2 works
- [ ] Form fields populate from selection
- [ ] Create button makes API call
- [ ] Success screen shows with correct info
- [ ] All buttons on success screen work

## Page 3: Portal Config
- [ ] Page loads at /admin/communities/portals
- [ ] Community dropdown populates
- [ ] Selecting community loads config
- [ ] All 4 tabs render correctly
- [ ] Color pickers work
- [ ] Save button makes API call
- [ ] Success message appears

## Page 4: AI Queue
- [ ] Page loads at /admin/moderation/ai-queue
- [ ] Search works
- [ ] Status filter works
- [ ] Visitor toggle works
- [ ] Submissions display correctly
- [ ] Approve button works
- [ ] Decline opens modal
- [ ] Decline modal submits correctly
- [ ] Empty state shows when no items

## Page 5: Flagged Content
- [ ] Page loads at /admin/moderation/flagged
- [ ] Search works
- [ ] Type filter works
- [ ] Status filter works
- [ ] Items display correctly
- [ ] Empty state shows when no items

---

# ROUTE REGISTRATION

Update App.tsx to use the new pages:

```typescript
// Replace placeholders with real imports
import CommunitiesPage from './pages/admin/CommunitiesPage';
import SeedCommunitiesPage from './pages/admin/SeedCommunitiesPage';
import PortalConfigPage from './pages/admin/PortalConfigPage';
import AIQueuePage from './pages/admin/AIQueuePage';
import FlaggedContentPage from './pages/admin/FlaggedContentPage';

// In admin routes:
<Route path="communities" element={<CommunitiesPage />} />
<Route path="communities/seed" element={<SeedCommunitiesPage />} />
<Route path="communities/portals" element={<PortalConfigPage />} />
<Route path="moderation/ai-queue" element={<AIQueuePage />} />
<Route path="moderation/flagged" element={<FlaggedContentPage />} />
```

---

# EXECUTION ORDER

1. Create all 5 page components
2. Create required API endpoints
3. Register routes in App.tsx
4. Run through verification checklist
5. Report results

**BEGIN. Work autonomously through all 5 pages. Report when complete.**
