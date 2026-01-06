import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Tab {
  key: string;
  label: string;
}

interface DetailsDrawerProps {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onClose?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function DetailsDrawer({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
  actions,
}: DetailsDrawerProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '16px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>{subtitle}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            data-testid="button-close-drawer"
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {tabs && tabs.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '12px',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange?.(tab.key)}
              data-testid={`drawer-tab-${tab.key}`}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: activeTab === tab.key ? '#8b5cf6' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#9ca3af',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>

      {actions && (
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          gap: '12px',
        }}>
          {actions}
        </div>
      )}
    </div>
  );
}
