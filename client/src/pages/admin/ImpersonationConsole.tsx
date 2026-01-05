/**
 * IMPERSONATION CONSOLE
 * 
 * Platform admin page to start/stop impersonation sessions.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Starting impersonation MUST redirect to /app/dashboard
 * 2. Stopping impersonation MUST redirect to /admin/impersonation
 * 3. Show security notice
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { Search, AlertTriangle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
}

// ============================================================================
// TYPE ICONS
// ============================================================================

const TYPE_ICONS: Record<string, string> = {
  community: '🏔️',
  government: '🏛️',
  business: '🏢',
  individual: '👤',
  platform: '⚡',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ImpersonationConsole(): React.ReactElement {
  const { impersonation, startImpersonation, stopImpersonation } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  // --------------------------------------------------------------------------
  // Fetch tenants
  // --------------------------------------------------------------------------

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/admin/tenants', { 
        credentials: 'include',
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  async function handleImpersonate(tenantId: string) {
    if (starting) return;
    
    setStarting(tenantId);
    try {
      // This will redirect to /app/dashboard
      await startImpersonation(tenantId, 'Admin support');
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      setStarting(null);
    }
  }

  async function handleStop() {
    if (stopping) return;
    
    setStopping(true);
    try {
      // This will redirect to /admin/impersonation
      await stopImpersonation();
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      setStopping(false);
    }
  }

  // --------------------------------------------------------------------------
  // Filter tenants
  // --------------------------------------------------------------------------

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header */}
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          Impersonation Console
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
          Temporarily access tenant accounts for support and debugging
        </p>

        {/* Active Impersonation Warning */}
        {impersonation.is_impersonating && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
                <div>
                  <h3 style={{ fontWeight: 600, color: '#fcd34d', marginBottom: '4px' }}>
                    Active Impersonation Session
                  </h3>
                  <p style={{ fontSize: '14px', color: '#fcd34d', opacity: 0.8 }}>
                    Currently impersonating: <strong>{impersonation.tenant_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={handleStop}
                disabled={stopping}
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#451a03',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: stopping ? 'not-allowed' : 'pointer',
                  opacity: stopping ? 0.7 : 1,
                }}
              >
                {stopping ? 'Stopping...' : 'Stop Impersonation'}
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>
            Security Notice
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>
            All impersonation sessions are logged with full audit trail including:
          </p>
          <ul style={{ 
            fontSize: '14px', 
            color: '#9ca3af',
            marginLeft: '20px',
            listStyleType: 'disc',
          }}>
            <li style={{ marginBottom: '4px' }}>Admin identity and IP address</li>
            <li style={{ marginBottom: '4px' }}>Target tenant and individual</li>
            <li style={{ marginBottom: '4px' }}>Session start/stop times</li>
            <li>All actions performed during impersonation</li>
          </ul>
        </div>

        {/* Search */}
        <div style={{
          position: 'relative',
          marginBottom: '24px',
        }}>
          <Search 
            size={18} 
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
            }}
          />
          <input
            type="text"
            placeholder="Search tenants by name, slug, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px 16px 12px 44px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Tenant List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(168, 85, 247, 0.3)',
              borderTopColor: '#a855f7',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {TYPE_ICONS[tenant.type] || '📁'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tenant.name}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {tenant.slug} • {tenant.type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleImpersonate(tenant.id)}
                  disabled={starting === tenant.id || impersonation.is_impersonating}
                  style={{
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: starting === tenant.id || impersonation.is_impersonating 
                      ? 'not-allowed' 
                      : 'pointer',
                    opacity: starting === tenant.id || impersonation.is_impersonating ? 0.5 : 1,
                  }}
                >
                  {starting === tenant.id ? 'Starting...' : 'Impersonate'}
                </button>
              </div>
            ))}

            {filteredTenants.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '48px 0',
                color: '#9ca3af',
              }}>
                No tenants found matching "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
