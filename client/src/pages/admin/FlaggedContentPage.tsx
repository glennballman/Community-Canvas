import { useState } from 'react';
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
      const token = localStorage.getItem('cc_token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (contentType !== 'all') params.set('type', contentType);
      params.set('status', status);
      const res = await fetch(`/api/admin/moderation/flagged?${params}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const items = data?.items || [];

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Flagged Content
          </h1>
          <p style={{ color: '#9ca3af' }}>
            User-reported items requiring review.
          </p>
        </div>

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
              data-testid="input-search-flagged"
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
            data-testid="select-content-type"
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
            data-testid="select-status"
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

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading...
          </div>
        )}

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

        {!isLoading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <div
                key={item.id}
                data-testid={`flagged-item-${item.id}`}
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
