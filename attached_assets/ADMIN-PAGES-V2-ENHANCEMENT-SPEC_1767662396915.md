# ADMIN PAGES V2 ENHANCEMENT SPEC

## Instructions for Replit

This spec enhances the 5 admin pages built in P1. The pages work — now we're making them **feel professional and trustworthy**.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   RULES:                                                                      ║
║   1. Do NOT break existing functionality                                      ║
║   2. Use the EXACT copy provided                                              ║
║   3. Follow the component patterns specified                                  ║
║   4. Test each enhancement before moving to next                              ║
║   5. Preserve all existing features while adding new ones                     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

# TABLE OF CONTENTS

1. [Shared Components](#shared-components)
2. [Communities Page Enhancements](#communities-page-enhancements)
3. [Seed Communities Enhancements](#seed-communities-enhancements)
4. [Portal Config Enhancements](#portal-config-enhancements)
5. [AI Queue Enhancements](#ai-queue-enhancements)
6. [Flagged Content Enhancements](#flagged-content-enhancements)
7. [API Enhancements](#api-enhancements)
8. [Verification Checklist](#verification-checklist)

---

# SHARED COMPONENTS

Create these reusable components first. They'll be used across multiple pages.

## 1. StatsStrip Component

A horizontal row of summary cards at the top of admin pages.

```tsx
// client/src/components/admin/StatsStrip.tsx

import React from 'react';

interface StatCard {
  label: string;
  value: number | string;
  helper?: string;
  color?: 'default' | 'green' | 'yellow' | 'red' | 'purple';
  icon?: React.ReactNode;
}

interface StatsStripProps {
  stats: StatCard[];
  isLoading?: boolean;
}

export function StatsStrip({ stats, isLoading }: StatsStripProps) {
  const colorMap = {
    default: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      gap: '16px',
      marginBottom: '24px',
    }}>
      {stats.map((stat, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '8px',
          }}>
            {stat.icon && (
              <span style={{ color: colorMap[stat.color || 'default'] }}>
                {stat.icon}
              </span>
            )}
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>
              {stat.label}
            </span>
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: colorMap[stat.color || 'default'],
          }}>
            {isLoading ? '—' : stat.value}
          </div>
          {stat.helper && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              {stat.helper}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## 2. SplitPane Component

A two-column layout with list on left, details on right.

```tsx
// client/src/components/admin/SplitPane.tsx

import React from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: string;
}

export function SplitPane({ left, right, leftWidth = '400px' }: SplitPaneProps) {
  return (
    <div style={{
      display: 'flex',
      gap: '24px',
      minHeight: '500px',
    }}>
      <div style={{
        width: leftWidth,
        flexShrink: 0,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 300px)',
      }}>
        {left}
      </div>
      <div style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '24px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 300px)',
      }}>
        {right}
      </div>
    </div>
  );
}
```

## 3. DetailsDrawer Component

The right-side panel content when an item is selected.

```tsx
// client/src/components/admin/DetailsDrawer.tsx

import React from 'react';
import { X } from 'lucide-react';

interface Tab {
  key: string;
  label: string;
}

interface DetailsDrawerProps {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onClose?: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function DetailsDrawer({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
  actions,
}: DetailsDrawerProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '16px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>{subtitle}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '12px',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange?.(tab.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: activeTab === tab.key ? '#8b5cf6' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#9ca3af',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>

      {/* Actions */}
      {actions && (
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          gap: '12px',
        }}>
          {actions}
        </div>
      )}
    </div>
  );
}
```

## 4. EmptySelection Component

Shown in right panel when nothing is selected.

```tsx
// client/src/components/admin/EmptySelection.tsx

import React from 'react';

interface EmptySelectionProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

export function EmptySelection({ icon, title, description }: EmptySelectionProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
      padding: '32px',
    }}>
      {icon && (
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#9ca3af' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '300px' }}>
        {description}
      </p>
    </div>
  );
}
```

## 5. AIReasoningCard Component

Shows what the AI flagged and why (for moderation).

```tsx
// client/src/components/admin/AIReasoningCard.tsx

import React from 'react';
import { Brain, AlertCircle, Eye, MessageSquare } from 'lucide-react';

interface AIReason {
  type: 'identity' | 'tone' | 'claim' | 'other';
  description: string;
}

interface AIReasoningCardProps {
  reasons: AIReason[];
  confidence?: 'low' | 'medium' | 'high';
}

const reasonIcons = {
  identity: <Eye size={14} />,
  tone: <MessageSquare size={14} />,
  claim: <AlertCircle size={14} />,
  other: <AlertCircle size={14} />,
};

const reasonLabels = {
  identity: 'Possible identifying detail',
  tone: 'Tone concern',
  claim: 'Potentially contentious claim',
  other: 'Other concern',
};

export function AIReasoningCard({ reasons, confidence = 'medium' }: AIReasoningCardProps) {
  const confidenceColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  return (
    <div style={{
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
      }}>
        <Brain size={16} style={{ color: '#a78bfa' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa' }}>
          What the AI noticed
        </span>
        <span style={{
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: confidenceColors[confidence],
          color: 'white',
          marginLeft: 'auto',
        }}>
          {confidence} confidence
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {reasons.map((reason, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '13px',
              color: '#e5e7eb',
            }}
          >
            <span style={{ color: '#9ca3af', marginTop: '2px' }}>
              {reasonIcons[reason.type]}
            </span>
            <div>
              <span style={{ color: '#9ca3af' }}>{reasonLabels[reason.type]}:</span>{' '}
              {reason.description}
            </div>
          </div>
        ))}
      </div>
      <p style={{ 
        fontSize: '11px', 
        color: '#6b7280', 
        marginTop: '12px',
        fontStyle: 'italic',
      }}>
        You're still the grown-up in the room. Trust your judgment.
      </p>
    </div>
  );
}
```

## 6. SeverityBadge Component

Visual indicator for item priority.

```tsx
// client/src/components/admin/SeverityBadge.tsx

import React from 'react';

interface SeverityBadgeProps {
  level: 'low' | 'medium' | 'high';
}

const config = {
  low: {
    label: 'Needs a quick look',
    bg: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
  },
  medium: {
    label: 'Sensitive',
    bg: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
  },
  high: {
    label: 'High priority',
    bg: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
};

export function SeverityBadge({ level }: SeverityBadgeProps) {
  const { label, bg, color } = config[level];
  
  return (
    <span style={{
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '4px',
      backgroundColor: bg,
      color: color,
      fontWeight: 500,
    }}>
      {label}
    </span>
  );
}
```

---

# COMMUNITIES PAGE ENHANCEMENTS

**File:** `client/src/pages/admin/CommunitiesPage.tsx`

## Changes Required

1. Add StatsStrip at top
2. Convert to SplitPane layout
3. Add DetailsDrawer with tabs
4. Improve copy to match spec

## Updated Copy

**Subtitle (update existing):**
```
"Create and care for community portals. Keep them warm, accurate, and current."
```

**Button tooltip:**
```
"Starts a new community tenant and portal draft."
```

**Stats cards:**
```
Total Communities - "All community tenants in the system."
Live Portals - "Public and visible."
Draft Portals - "Not public yet."
Needs Review - "Missing slug, branding, or homepage sections."
```

**Empty selection state:**
```
Title: "Select a community to view details"
Body: "You'll be able to edit portal settings, governance, and visibility from here."
```

**Details drawer tabs:**
```
Overview | Portal | Governance | Activity
```

## Enhanced Component Code

```tsx
// client/src/pages/admin/CommunitiesPage.tsx - ENHANCED VERSION

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, ExternalLink, Settings, Globe, Users, Clock } from 'lucide-react';
import { StatsStrip } from '../../components/admin/StatsStrip';
import { SplitPane } from '../../components/admin/SplitPane';
import { DetailsDrawer } from '../../components/admin/DetailsDrawer';
import { EmptySelection } from '../../components/admin/EmptySelection';

type FilterType = 'all' | 'live' | 'draft' | 'hidden' | 'needs_review';
type DrawerTab = 'overview' | 'portal' | 'governance' | 'activity';

interface Community {
  id: string;
  name: string;
  slug: string;
  type: 'community' | 'government';
  portal_slug: string | null;
  status: 'live' | 'draft' | 'hidden';
  member_count: number;
  created_at: string;
  needs_review?: boolean;
  region?: string;
}

interface CommunityStats {
  total: number;
  live: number;
  draft: number;
  needs_review: number;
}

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  // Fetch communities
  const { data, isLoading } = useQuery<{ communities: Community[]; stats: CommunityStats }>({
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
  const stats = data?.stats || { total: 0, live: 0, draft: 0, needs_review: 0 };
  const selectedCommunity = communities.find(c => c.id === selectedId);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'draft', label: 'Draft' },
    { key: 'hidden', label: 'Hidden' },
    { key: 'needs_review', label: 'Needs Review' },
  ];

  const drawerTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'portal', label: 'Portal' },
    { key: 'governance', label: 'Governance' },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          Communities
        </h1>
        <p style={{ color: '#9ca3af' }}>
          Create and care for community portals. Keep them warm, accurate, and current.
        </p>
      </div>

      {/* Stats Strip */}
      <StatsStrip
        isLoading={isLoading}
        stats={[
          { label: 'Total Communities', value: stats.total, helper: 'All community tenants in the system.', icon: <Globe size={18} /> },
          { label: 'Live Portals', value: stats.live, helper: 'Public and visible.', color: 'green', icon: <Globe size={18} /> },
          { label: 'Draft Portals', value: stats.draft, helper: 'Not public yet.', color: 'yellow', icon: <Globe size={18} /> },
          { label: 'Needs Review', value: stats.needs_review, helper: 'Missing slug, branding, or homepage sections.', color: 'red', icon: <Globe size={18} /> },
        ]}
      />

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
            placeholder="Search by name, slug, or region…"
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
          title="Starts a new community tenant and portal draft."
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
          Create Community
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

      {/* Split Pane */}
      <SplitPane
        leftWidth="450px"
        left={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isLoading && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                Loading communities...
              </div>
            )}
            {!isLoading && communities.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <p style={{ color: '#9ca3af', marginBottom: '8px' }}>
                  No communities match that search.
                </p>
                <button
                  onClick={() => { setSearch(''); setFilter('all'); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {!isLoading && communities.map((community) => (
              <CommunityRow
                key={community.id}
                community={community}
                isSelected={selectedId === community.id}
                onClick={() => {
                  setSelectedId(community.id);
                  setDrawerTab('overview');
                }}
              />
            ))}
          </div>
        }
        right={
          selectedCommunity ? (
            <DetailsDrawer
              title={selectedCommunity.name}
              subtitle={`${selectedCommunity.slug} • ${selectedCommunity.type}`}
              tabs={drawerTabs}
              activeTab={drawerTab}
              onTabChange={(tab) => setDrawerTab(tab as DrawerTab)}
              onClose={() => setSelectedId(null)}
              actions={
                <>
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Save changes
                  </button>
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                </>
              }
            >
              {drawerTab === 'overview' && (
                <OverviewTab community={selectedCommunity} />
              )}
              {drawerTab === 'portal' && (
                <PortalTab community={selectedCommunity} />
              )}
              {drawerTab === 'governance' && (
                <GovernanceTab community={selectedCommunity} />
              )}
              {drawerTab === 'activity' && (
                <ActivityTab community={selectedCommunity} />
              )}
            </DetailsDrawer>
          ) : (
            <EmptySelection
              icon="🏔️"
              title="Select a community to view details"
              description="You'll be able to edit portal settings, governance, and visibility from here."
            />
          )
        }
      />
    </div>
  );
}

// Sub-components

function CommunityRow({ community, isSelected, onClick }: {
  community: Community;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusColors = {
    live: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
    draft: { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
    hidden: { bg: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' },
  };
  const status = statusColors[community.status] || statusColors.draft;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 16px',
        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
        border: isSelected ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>{community.name}</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            {community.slug} {community.region && `• ${community.region}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: status.bg,
            color: status.color,
          }}>
            {community.status}
          </span>
          {community.needs_review && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
            }}>
              Needs review
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function OverviewTab({ community }: { community: Community }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#9ca3af' }}>Basics</h3>
      
      <div>
        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
          Community name
        </label>
        <input
          type="text"
          defaultValue={community.name}
          placeholder="e.g., Bamfield"
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

      <div>
        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
          Portal slug
        </label>
        <input
          type="text"
          defaultValue={community.portal_slug || ''}
          placeholder="bamfield"
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
          Used in the public URL. Lowercase, dashes only.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked={community.status === 'live'} />
          <span style={{ fontSize: '14px' }}>Portal is public</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked={community.status !== 'hidden'} />
          <span style={{ fontSize: '14px' }}>Portal is visible</span>
        </label>
      </div>
    </div>
  );
}

function PortalTab({ community }: { community: Community }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        padding: '16px',
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Public portal</h4>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
          This is what visitors see. Small updates make a big difference.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={`/c/${community.portal_slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '13px',
            }}
          >
            Open portal preview
          </a>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Copy portal link
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        padding: '16px',
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Homepage sections</h4>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
          Choose what the community wants to highlight.
        </p>
        <Link
          to={`/admin/communities/portals?id=${community.id}`}
          title="Opens Portal Config."
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '13px',
          }}
        >
          Edit homepage sections
        </Link>
      </div>
    </div>
  );
}

function GovernanceTab({ community }: { community: Community }) {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Community managers</h4>
      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
        Trusted volunteers who can review notes and keep content tidy.
      </p>
      <div style={{ fontSize: '14px', marginBottom: '12px' }}>
        <Users size={16} style={{ display: 'inline', marginRight: '8px', color: '#9ca3af' }} />
        {community.member_count} members
      </div>
      <button
        title="Opens members/roles for this community."
        style={{
          padding: '8px 16px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Manage roles
      </button>
    </div>
  );
}

function ActivityTab({ community }: { community: Community }) {
  return (
    <div>
      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Recent changes</h4>
      <div style={{ color: '#6b7280', fontSize: '13px' }}>
        <Clock size={14} style={{ display: 'inline', marginRight: '8px' }} />
        Created {new Date(community.created_at).toLocaleDateString()}
      </div>
      <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '16px', fontStyle: 'italic' }}>
        Activity log coming soon...
      </p>
    </div>
  );
}
```

---

# SEED COMMUNITIES ENHANCEMENTS

**File:** `client/src/pages/admin/SeedCommunitiesPage.tsx`

## Changes Required

1. Add Step 3: "Prefill" between Details and Review
2. Update copy to match spec
3. Add local words field

## New Step 3: Prefill

Insert between current Step 2 (Details) and Step 3 (Preview):

```tsx
// Add to SeedCommunitiesPage.tsx - New prefill state
const [prefillOptions, setPrefillOptions] = useState({
  homepageSections: true,
  directoryCategories: true,
  contentTone: true,
  localWords: '',
});

// New step component
function PrefillStep({ options, onChange }: {
  options: typeof prefillOptions;
  onChange: (opts: typeof prefillOptions) => void;
}) {
  return (
    <div>
      <p style={{ marginBottom: '20px', color: '#e5e7eb', fontSize: '18px', fontWeight: 600 }}>
        What should we prefill?
      </p>
      
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
            checked={options.homepageSections}
            onChange={(e) => onChange({ ...options, homepageSections: e.target.checked })}
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
            checked={options.directoryCategories}
            onChange={(e) => onChange({ ...options, directoryCategories: e.target.checked })}
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
            checked={options.contentTone}
            onChange={(e) => onChange({ ...options, contentTone: e.target.checked })}
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

      <div>
        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
          A few local words (optional)
        </label>
        <input
          type="text"
          value={options.localWords}
          onChange={(e) => onChange({ ...options, localWords: e.target.value })}
          placeholder="e.g., boardwalk, inlet, West Road…"
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
    </div>
  );
}
```

## Updated Copy

**Subtitle:**
```
"A gentle setup flow. Nothing goes public until you say so."
```

**Step 1 title:**
```
"Choose a starting point"
```

**Dataset card:**
```
Title: "Use a seed dataset"
Body: "Start from a known place and refine."
```

**Blank card:**
```
Title: "Start blank"  
Body: "Create a clean community tenant with no prefill."
```

**Step 2 helper:**
```
"Seed data is a starting draft. You can change everything later."
```

**New toggles in Step 2:**
```
☑️ Create public portal draft (default on)
   Helper: "Creates portal config, but keeps it hidden."

☑️ Keep portal hidden for now (default on)
   Helper: "Recommended. Turn it live when it feels ready."
```

**Success screen:**
```
Headline: "Community created."
Body: "Next: portal branding and homepage sections."
Toast: "Done. Community seeded successfully."
```

---

# PORTAL CONFIG ENHANCEMENTS

**File:** `client/src/pages/admin/PortalConfigPage.tsx`

## Changes Required

1. Add Preview tab
2. Update copy to match spec
3. Add section reordering (drag to reorder)

## Updated Copy

**Subtitle:**
```
"Make it feel like the town. Keep it simple and true."
```

**Theme tab - Short welcome line:**
```
Placeholder: "A small town that looks out for each other."
```

**Homepage tab helper:**
```
"Turn sections on/off and order them. Keep it readable over coffee."
```

**Section templates:**
```
"Welcome"
"Essentials"
"The Good News"
"Today's Availability"
"Visitor Tips"
"Community Calendar"
"Directory Highlights"
```

**SEO tab helper:**
```
"Simple is better. We don't do clickbait."
```

## New Preview Tab

```tsx
function PreviewTab({ community }: { community: Community }) {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: '8px',
      padding: '24px',
      textAlign: 'center',
    }}>
      <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Preview</h4>
      <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>
        See it the way visitors see it.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <a
          href={`/c/${community.portal_slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '10px 20px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          Open preview
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/c/${community.portal_slug}`)}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Copy preview link
        </button>
      </div>
    </div>
  );
}
```

---

# AI QUEUE ENHANCEMENTS

**File:** `client/src/pages/admin/AIQueuePage.tsx`

## Changes Required

1. Add StatsStrip at top
2. Convert to SplitPane layout
3. Add AIReasoningCard in review drawer
4. Add SeverityBadge to rows
5. Add more action buttons
6. Update copy to match spec

## Updated Copy

**Subtitle:**
```
"A second set of eyes. You're still the grown-up in the room."
```

**Stats cards:**
```
Waiting - (count)
Reviewed today - (count)
High priority - (count)  
Escalated - (count)
```

**Severity badges:**
```
Low: "Needs a quick look"
Medium: "Sensitive"
High: "High priority"
```

**Empty selection:**
```
Title: "Select an item to review"
Body: "You'll see what the AI noticed, and you can approve, edit, or decline."
```

**Empty state:**
```
Headline: "Quiet day."
Body: "Nothing is waiting in the AI Queue."
Subtext: "That's a good sign."
```

**Action buttons (expanded):**
```
Approve - "Publishes (or keeps visible) with your edits."
Approve & hide - "Approves for record, but keeps it off the public feed."
Request edit - "Sends it back to draft with an internal note."
Decline - "Does not publish."
Escalate - "Move to platform admin / safety review."
```

**Resolve toast:**
```
"Done. Marked as resolved."
```

## Enhanced Component Snippet

```tsx
// Add to AIQueuePage.tsx - Enhanced review drawer actions

function ReviewActions({ item, onAction }: { 
  item: Submission; 
  onAction: (action: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        onClick={() => onAction('approve')}
        title="Publishes (or keeps visible) with your edits."
        style={{
          padding: '10px 16px',
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Approve
      </button>
      
      <button
        onClick={() => onAction('approve_hide')}
        title="Approves for record, but keeps it off the public feed."
        style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Approve & hide
      </button>

      <button
        onClick={() => onAction('request_edit')}
        title="Sends it back to draft with an internal note."
        style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Request edit
      </button>

      <button
        onClick={() => onAction('decline')}
        title="Does not publish."
        style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Decline
      </button>

      <button
        onClick={() => onAction('escalate')}
        title="Move to platform admin / safety review."
        style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          color: '#a78bfa',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Escalate
      </button>
    </div>
  );
}
```

---

# FLAGGED CONTENT ENHANCEMENTS

**File:** `client/src/pages/admin/FlaggedContentPage.tsx`

## Changes Required

1. Convert to SplitPane layout
2. Add review drawer with context
3. Add reason filter
4. Update copy and actions

## Updated Copy

**Subtitle:**
```
"Handle it quietly. Fix what matters. Move on."
```

**Reason filter options:**
```
Spam
Personal info
Unkind
Other
```

**Empty state:**
```
Headline: "Nothing flagged."
Body: "That usually means the tone is healthy."
```

**Action buttons:**
```
Hide from public - "Removes from public view immediately."
Edit for privacy - "Remove names, addresses, or overly specific details."
Dismiss report - "Marks as resolved with no changes."
Escalate - "For threats, harassment, or anything safety-related."
```

**Resolve toast:**
```
"Resolved. Thanks—kept it tidy."
```

---

# API ENHANCEMENTS

## Communities Endpoint Updates

```typescript
// GET /api/admin/communities should now return stats
{
  communities: [...],
  stats: {
    total: 24,
    live: 12,
    draft: 8,
    needs_review: 4
  }
}
```

## AI Queue Endpoint Updates

```typescript
// GET /api/admin/moderation/submissions should include:
{
  submissions: [
    {
      id: "...",
      // existing fields...
      severity: "low" | "medium" | "high",
      ai_reasons: [
        { type: "identity", description: "Contains a specific address" },
        { type: "tone", description: "May read as negative" }
      ]
    }
  ],
  stats: {
    waiting: 5,
    reviewed_today: 12,
    high_priority: 2,
    escalated: 0
  }
}

// POST /api/admin/moderation/submissions/:id/approve-hide
// POST /api/admin/moderation/submissions/:id/request-edit
// POST /api/admin/moderation/submissions/:id/escalate
```

---

# VERIFICATION CHECKLIST

After implementing all enhancements:

## Shared Components
- [ ] StatsStrip renders with loading state
- [ ] SplitPane responsive on smaller screens
- [ ] DetailsDrawer tabs switch correctly
- [ ] EmptySelection displays centered
- [ ] AIReasoningCard shows reasons properly
- [ ] SeverityBadge shows correct colors

## Communities Page
- [ ] Stats strip shows 4 cards with real data
- [ ] Split pane layout works
- [ ] Clicking row opens details drawer
- [ ] All 4 tabs render content
- [ ] Save/Discard buttons functional
- [ ] Empty selection state shows when nothing selected

## Seed Communities
- [ ] New Prefill step (Step 3) renders
- [ ] Checkboxes for prefill options work
- [ ] Local words field saves
- [ ] Updated copy throughout
- [ ] Step count updated to 5

## Portal Config
- [ ] Preview tab added (5 tabs total)
- [ ] Preview opens portal in new tab
- [ ] Copy link button works
- [ ] Updated copy and helpers

## AI Queue
- [ ] Stats strip shows 4 metrics
- [ ] Split pane with list left, drawer right
- [ ] AIReasoningCard shows in drawer
- [ ] SeverityBadge on each row
- [ ] 5 action buttons all functional
- [ ] Updated empty states and copy

## Flagged Content
- [ ] Split pane layout
- [ ] Reason filter added
- [ ] Review drawer with context
- [ ] 4 action buttons functional
- [ ] Updated copy

---

# EXECUTION ORDER

1. Create shared components first (StatsStrip, SplitPane, DetailsDrawer, EmptySelection, AIReasoningCard, SeverityBadge)
2. Update Communities page
3. Update Seed Communities page
4. Update Portal Config page
5. Update AI Queue page
6. Update Flagged Content page
7. Update API endpoints
8. Run verification checklist

**Work autonomously. Report when complete with verification results.**
