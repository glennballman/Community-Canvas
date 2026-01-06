import { useState } from 'react';
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
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Communities
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Create and manage community portals across the platform.
          </p>
        </div>

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
            Seed Community
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

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading communities...
          </div>
        )}

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
      data-testid={`community-card-${community.id}`}
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
              data-testid={`view-portal-${community.id}`}
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
            data-testid={`edit-community-${community.id}`}
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
