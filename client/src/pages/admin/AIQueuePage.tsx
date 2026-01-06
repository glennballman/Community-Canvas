import { useState } from 'react';
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

  const { data, isLoading } = useQuery<{ submissions: Submission[] }>({
    queryKey: ['ai-queue', search, statusFilter, showVisitorOnly],
    queryFn: async () => {
      const token = localStorage.getItem('cc_token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('status', statusFilter);
      if (showVisitorOnly) params.set('visitor_only', 'true');
      const res = await fetch(`/api/admin/moderation/submissions?${params}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const submissions = data?.submissions || [];

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch(`/api/admin/moderation/submissions/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-queue'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch(`/api/admin/moderation/submissions/${id}/decline`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
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
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            The Good News — Review Queue
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Keep it kind, keep it private, keep it real.
          </p>
        </div>

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
              data-testid="input-search-submissions"
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

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading submissions...
          </div>
        )}

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

        {!isLoading && submissions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                data-testid={`submission-card-${sub.id}`}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
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
                
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                  {sub.is_visitor ? 'Visitor' : 'Resident'} • {sub.community_name}
                </div>

                <div style={{ 
                  fontSize: '15px', 
                  lineHeight: 1.6, 
                  marginBottom: '16px',
                  fontStyle: 'italic',
                  color: '#e5e7eb',
                }}>
                  "{sub.story_raw}"
                </div>

                {sub.suggested_recipient_text && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#a78bfa', 
                    marginBottom: '16px',
                  }}>
                    Suggested recipient: {sub.suggested_recipient_text}
                  </div>
                )}

                {statusFilter === 'pending' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => setDeclineModalId(sub.id)}
                      data-testid={`button-decline-${sub.id}`}
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
                      data-testid={`button-approve-${sub.id}`}
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
                data-testid="input-decline-reason"
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
                  data-testid="button-cancel-decline"
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
                  data-testid="button-confirm-decline"
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
