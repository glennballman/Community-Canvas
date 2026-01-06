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
