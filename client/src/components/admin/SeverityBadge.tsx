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
