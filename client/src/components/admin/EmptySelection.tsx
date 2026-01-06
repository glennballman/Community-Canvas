import { ReactNode } from 'react';

interface EmptySelectionProps {
  icon?: ReactNode;
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
