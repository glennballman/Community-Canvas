import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Globe, Users, Clock } from 'lucide-react';
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

  const { data, isLoading } = useQuery<{ communities: Community[]; stats: CommunityStats }>({
    queryKey: ['admin-communities', search, filter],
    queryFn: async () => {
      const token = localStorage.getItem('cc_token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('filter', filter);
      const res = await fetch(`/api/admin/communities?${params}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          Communities
        </h1>
        <p style={{ color: '#9ca3af' }}>
          Create and care for community portals. Keep them warm, accurate, and current.
        </p>
      </div>

      <StatsStrip
        isLoading={isLoading}
        stats={[
          { label: 'Total Communities', value: stats.total, helper: 'All community tenants in the system.', icon: <Globe size={18} /> },
          { label: 'Live Portals', value: stats.live, helper: 'Public and visible.', color: 'green', icon: <Globe size={18} /> },
          { label: 'Draft Portals', value: stats.draft, helper: 'Not public yet.', color: 'yellow', icon: <Globe size={18} /> },
          { label: 'Needs Review', value: stats.needs_review, helper: 'Missing slug, branding, or homepage sections.', color: 'red', icon: <Globe size={18} /> },
        ]}
      />

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
            placeholder="Search by name, slug, or region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-communities"
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
          data-testid="button-seed-community"
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`filter-${f.key}`}
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
              subtitle={`${selectedCommunity.slug} - ${selectedCommunity.type}`}
              tabs={drawerTabs}
              activeTab={drawerTab}
              onTabChange={(tab) => setDrawerTab(tab as DrawerTab)}
              onClose={() => setSelectedId(null)}
              actions={
                <>
                  <button
                    data-testid="button-save-changes"
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
                    data-testid="button-discard"
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
              icon={<Globe size={48} />}
              title="Select a community to view details"
              description="You'll be able to edit portal settings, governance, and visibility from here."
            />
          )
        }
      />
    </div>
  );
}

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
      data-testid={`community-row-${community.id}`}
      style={{
        width: '100%',
        padding: '12px 16px',
        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
        border: isSelected ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>{community.name}</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            {community.slug} {community.region && `- ${community.region}`}
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
          data-testid="input-community-name"
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
          data-testid="input-portal-slug"
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
          <input type="checkbox" defaultChecked={community.status === 'live'} data-testid="checkbox-portal-public" />
          <span style={{ fontSize: '14px' }}>Portal is public</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked={community.status !== 'hidden'} data-testid="checkbox-portal-visible" />
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
            data-testid="link-portal-preview"
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
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/c/${community.portal_slug}`)}
            data-testid="button-copy-portal-link"
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
          data-testid="link-edit-homepage"
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
        data-testid="button-manage-roles"
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
