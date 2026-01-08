/**
 * PORTAL SELECTOR
 * 
 * Dropdown for switching between portals owned by the current tenant.
 * Shows in the sidebar below the tenant switcher.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, ExternalLink } from 'lucide-react';
import { usePortal } from '../contexts/PortalContext';

export function PortalSelector() {
  const { portals, currentPortal, loading, switchPortal } = usePortal();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || portals.length === 0) {
    return null;
  }

  if (portals.length === 1) {
    return (
      <div style={{ padding: '8px 12px' }}>
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <Building2 size={14} />
          <span style={{ opacity: 0.7 }}>{portals[0].name}</span>
        </div>
        <a
          href={`/p/${portals[0].slug}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-view-my-site"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            color: '#60a5fa',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '6px',
            textDecoration: 'none',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
          }}
        >
          <ExternalLink size={12} />
          View My Public Site
        </a>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', padding: '8px 12px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-portal-selector"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={14} style={{ color: '#60a5fa' }} />
          <span style={{ fontWeight: 500 }}>
            {currentPortal?.name || 'Select Portal'}
          </span>
        </div>
        <ChevronDown 
          size={14} 
          style={{ 
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '12px',
          right: '12px',
          marginTop: '4px',
          backgroundColor: '#1a1f2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          {portals.map((portal) => (
            <button
              key={portal.id}
              onClick={() => {
                switchPortal(portal.id);
                setIsOpen(false);
              }}
              data-testid={`button-portal-${portal.slug}`}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '10px 12px',
                backgroundColor: currentPortal?.id === portal.id 
                  ? 'rgba(59, 130, 246, 0.2)' 
                  : 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (currentPortal?.id !== portal.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPortal?.id !== portal.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontWeight: 500, fontSize: '13px' }}>
                {portal.name}
              </span>
              {portal.legal_dba_name && portal.legal_dba_name !== portal.name && (
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  dba {portal.legal_dba_name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {currentPortal && (
        <a
          href={`/p/${currentPortal.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-view-my-site"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            marginTop: '8px',
            fontSize: '12px',
            color: '#60a5fa',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '6px',
            textDecoration: 'none',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
          }}
        >
          <ExternalLink size={12} />
          View My Public Site
        </a>
      )}
    </div>
  );
}
