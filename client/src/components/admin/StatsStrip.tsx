import { ReactNode } from 'react';

interface StatCard {
  label: string;
  value: number | string;
  helper?: string;
  color?: 'default' | 'green' | 'yellow' | 'red' | 'purple';
  icon?: ReactNode;
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
          data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
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
