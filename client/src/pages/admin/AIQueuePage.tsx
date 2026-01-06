import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Clock, CheckCircle, AlertTriangle, Flag } from 'lucide-react';
import { StatsStrip } from '../../components/admin/StatsStrip';
import { SplitPane } from '../../components/admin/SplitPane';
import { DetailsDrawer } from '../../components/admin/DetailsDrawer';
import { EmptySelection } from '../../components/admin/EmptySelection';
import { AIReasoningCard } from '../../components/admin/AIReasoningCard';
import { SeverityBadge } from '../../components/admin/SeverityBadge';

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
  severity?: 'low' | 'medium' | 'high';
  ai_reasons?: Array<{ type: 'identity' | 'tone' | 'claim' | 'other'; description: string }>;
  ai_confidence?: 'low' | 'medium' | 'high';
}

interface QueueStats {
  waiting: number;
  reviewed_today: number;
  high_priority: number;
  escalated: number;
}

export default function AIQueuePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [showVisitorOnly, setShowVisitorOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const { data, isLoading } = useQuery<{ submissions: Submission[]; stats: QueueStats }>({
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
  const stats = data?.stats || { waiting: 0, reviewed_today: 0, high_priority: 0, escalated: 0 };
  const selectedSubmission = submissions.find(s => s.id === selectedId);

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: string; note?: string }) => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch(`/api/admin/moderation/submissions/${id}/${action}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      return res.json();
    },
    onSuccess: () => {
      setSelectedId(null);
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
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  }

  function handleAction(action: string) {
    if (!selectedId) return;
    actionMutation.mutate({ id: selectedId, action, note: declineReason });
  }

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          AI Review Queue
        </h1>
        <p style={{ color: '#9ca3af' }}>
          A second set of eyes. You're still the grown-up in the room.
        </p>
      </div>

      <StatsStrip
        isLoading={isLoading}
        stats={[
          { label: 'Waiting', value: stats.waiting, icon: <Clock size={18} />, color: 'yellow' },
          { label: 'Reviewed today', value: stats.reviewed_today, icon: <CheckCircle size={18} />, color: 'green' },
          { label: 'High priority', value: stats.high_priority, icon: <AlertTriangle size={18} />, color: 'red' },
          { label: 'Escalated', value: stats.escalated, icon: <Flag size={18} />, color: 'purple' },
        ]}
      />

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
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>Visitor notes only</span>
        </label>
      </div>

      {!isLoading && submissions.length === 0 ? (
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
            <CheckCircle size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
            Quiet day.
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '8px' }}>
            Nothing is waiting in the AI Queue.
          </p>
          <p style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic' }}>
            That's a good sign.
          </p>
        </div>
      ) : (
        <SplitPane
          leftWidth="400px"
          left={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isLoading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                  Loading submissions...
                </div>
              )}
              {!isLoading && submissions.map((sub) => (
                <SubmissionRow
                  key={sub.id}
                  submission={sub}
                  isSelected={selectedId === sub.id}
                  onClick={() => setSelectedId(sub.id)}
                  formatTime={formatTimeAgo}
                />
              ))}
            </div>
          }
          right={
            selectedSubmission ? (
              <DetailsDrawer
                title="Review submission"
                subtitle={`${selectedSubmission.is_visitor ? 'Visitor' : 'Resident'} - ${selectedSubmission.community_name}`}
                onClose={() => setSelectedId(null)}
              >
                {selectedSubmission.ai_reasons && selectedSubmission.ai_reasons.length > 0 && (
                  <AIReasoningCard
                    reasons={selectedSubmission.ai_reasons}
                    confidence={selectedSubmission.ai_confidence}
                  />
                )}

                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}>
                  <p style={{ 
                    fontSize: '15px', 
                    lineHeight: 1.6, 
                    fontStyle: 'italic',
                    color: '#e5e7eb',
                  }}>
                    "{selectedSubmission.story_raw}"
                  </p>
                  {selectedSubmission.suggested_recipient_text && (
                    <p style={{ fontSize: '13px', color: '#a78bfa', marginTop: '12px' }}>
                      Suggested recipient: {selectedSubmission.suggested_recipient_text}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                    Internal note (optional)
                  </label>
                  <textarea
                    placeholder="e.g., 'too specific', 'not a thank-you'"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={2}
                    data-testid="input-internal-note"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      resize: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionMutation.isPending}
                    title="Publishes (or keeps visible) with your edits."
                    data-testid="button-approve"
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
                    onClick={() => handleAction('approve_hide')}
                    disabled={actionMutation.isPending}
                    title="Approves for record, but keeps it off the public feed."
                    data-testid="button-approve-hide"
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
                    onClick={() => handleAction('request_edit')}
                    disabled={actionMutation.isPending}
                    title="Sends it back to draft with an internal note."
                    data-testid="button-request-edit"
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
                    onClick={() => handleAction('decline')}
                    disabled={actionMutation.isPending}
                    title="Does not publish."
                    data-testid="button-decline"
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
                    onClick={() => handleAction('escalate')}
                    disabled={actionMutation.isPending}
                    title="Move to platform admin / safety review."
                    data-testid="button-escalate"
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
              </DetailsDrawer>
            ) : (
              <EmptySelection
                icon={<Clock size={48} />}
                title="Select an item to review"
                description="You'll see what the AI noticed, and you can approve, edit, or decline."
              />
            )
          }
        />
      )}
    </div>
  );
}

function SubmissionRow({ submission, isSelected, onClick, formatTime }: {
  submission: Submission;
  isSelected: boolean;
  onClick: () => void;
  formatTime: (d: string) => string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`submission-row-${submission.id}`}
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
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
          {submission.is_visitor ? 'Visitor' : 'Resident'} - {submission.community_name}
        </span>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {formatTime(submission.created_at)}
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
        {submission.story_raw}
      </p>
      {submission.severity && (
        <SeverityBadge level={submission.severity} />
      )}
    </button>
  );
}
