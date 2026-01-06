import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Flag, EyeOff, Edit3, X, AlertTriangle } from 'lucide-react';
import { SplitPane } from '../../components/admin/SplitPane';
import { DetailsDrawer } from '../../components/admin/DetailsDrawer';
import { EmptySelection } from '../../components/admin/EmptySelection';

type ContentType = 'all' | 'good_news' | 'service_run' | 'business' | 'profile';
type StatusType = 'pending' | 'resolved' | 'dismissed';
type ReasonFilter = 'all' | 'spam' | 'personal_info' | 'unkind' | 'other';

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [contentType, setContentType] = useState<ContentType>('all');
  const [status, setStatus] = useState<StatusType>('pending');
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: FlaggedItem[] }>({
    queryKey: ['flagged-content', search, contentType, status, reasonFilter],
    queryFn: async () => {
      const token = localStorage.getItem('cc_token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (contentType !== 'all') params.set('type', contentType);
      params.set('status', status);
      if (reasonFilter !== 'all') params.set('reason', reasonFilter);
      const res = await fetch(`/api/admin/moderation/flagged?${params}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const items = data?.items || [];
  const selectedItem = items.find(i => i.id === selectedId);

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch(`/api/admin/moderation/flagged/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      return res.json();
    },
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['flagged-content'] });
    },
  });

  function handleAction(action: string) {
    if (!selectedId) return;
    actionMutation.mutate({ id: selectedId, action });
  }

  const reasonLabels: Record<string, string> = {
    spam: 'Spam',
    personal_info: 'Personal info',
    unkind: 'Unkind',
    other: 'Other',
  };

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          Flagged Content
        </h1>
        <p style={{ color: '#9ca3af' }}>
          Handle it quietly. Fix what matters. Move on.
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
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
          data-testid="select-reason"
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
          }}
        >
          <option value="all">All Reasons</option>
          <option value="spam">Spam</option>
          <option value="personal_info">Personal info</option>
          <option value="unkind">Unkind</option>
          <option value="other">Other</option>
        </select>
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

      {!isLoading && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 16px' }}>
          <div style={{ 
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Flag size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
            Nothing flagged.
          </h2>
          <p style={{ color: '#9ca3af' }}>
            That usually means the tone is healthy.
          </p>
        </div>
      ) : (
        <SplitPane
          leftWidth="400px"
          left={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isLoading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                  Loading...
                </div>
              )}
              {!isLoading && items.map((item) => (
                <FlaggedRow
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          }
          right={
            selectedItem ? (
              <DetailsDrawer
                title="Review flagged content"
                subtitle={`${selectedItem.content_type} - reported ${new Date(selectedItem.created_at).toLocaleDateString()}`}
                onClose={() => setSelectedId(null)}
              >
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}>
                  <p style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '12px' }}>
                    {selectedItem.content_preview}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '6px',
                    marginBottom: '12px',
                  }}>
                    <AlertTriangle size={16} style={{ color: '#f87171' }} />
                    <span style={{ fontSize: '14px', color: '#f87171' }}>
                      Reported for: {reasonLabels[selectedItem.reason] || selectedItem.reason}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>
                    Reporter: {selectedItem.reporter_email}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleAction('hide')}
                    disabled={actionMutation.isPending}
                    title="Removes from public view immediately."
                    data-testid="button-hide"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <EyeOff size={16} />
                    Hide from public
                  </button>

                  <button
                    onClick={() => handleAction('edit_privacy')}
                    disabled={actionMutation.isPending}
                    title="Remove names, addresses, or overly specific details."
                    data-testid="button-edit-privacy"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={16} />
                    Edit for privacy
                  </button>

                  <button
                    onClick={() => handleAction('dismiss')}
                    disabled={actionMutation.isPending}
                    title="Marks as resolved with no changes."
                    data-testid="button-dismiss"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                    Dismiss report
                  </button>

                  <button
                    onClick={() => handleAction('escalate')}
                    disabled={actionMutation.isPending}
                    title="For threats, harassment, or anything safety-related."
                    data-testid="button-escalate"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <AlertTriangle size={16} />
                    Escalate
                  </button>
                </div>
              </DetailsDrawer>
            ) : (
              <EmptySelection
                icon={<Flag size={48} />}
                title="Select a report to review"
                description="You'll see the content and can take action from here."
              />
            )
          }
        />
      )}
    </div>
  );
}

function FlaggedRow({ item, isSelected, onClick }: {
  item: FlaggedItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const reasonColors: Record<string, string> = {
    spam: '#6b7280',
    personal_info: '#f59e0b',
    unkind: '#ef4444',
    other: '#9ca3af',
  };

  return (
    <button
      onClick={onClick}
      data-testid={`flagged-row-${item.id}`}
      style={{
        width: '100%',
        padding: '12px 16px',
        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
        border: isSelected ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        textAlign: 'left',
        cursor: 'pointer',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ 
          fontSize: '11px', 
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: '2px 8px',
          borderRadius: '4px',
          color: '#9ca3af',
        }}>
          {item.content_type}
        </span>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>
      <p style={{ 
        fontSize: '14px', 
        lineHeight: 1.4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const,
        marginBottom: '8px',
      }}>
        {item.content_preview}
      </p>
      <span style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: `${reasonColors[item.reason] || '#6b7280'}20`,
        color: reasonColors[item.reason] || '#6b7280',
      }}>
        {item.reason}
      </span>
    </button>
  );
}
