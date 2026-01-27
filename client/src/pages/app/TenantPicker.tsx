/**
 * TENANT PICKER
 * 
 * The home screen at /app when no tenant is selected.
 * Shows all tenants the user has access to, grouped by type.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. NO duplicate header - this renders inside TenantAppLayout
 * 2. NO sidebar - the layout shows no sidebar when this is displayed
 * 3. Grouped by tenant type
 * 4. Click "Manage" → switch tenant and go to dashboard
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant, TenantMembership } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { ExternalLink, Plus, Search } from 'lucide-react';

// ============================================================================
// TYPE ICONS
// ============================================================================

const TYPE_ICONS: Record<string, string> = {
  community: '🏔️',
  government: '🏛️',
  business: '🏢',
  individual: '👤',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TenantPicker(): React.ReactElement {
  const navigate = useNavigate();
  const { memberships, switchTenant, impersonation } = useTenant();
  const { user } = useAuth();

  // --------------------------------------------------------------------------
  // Handle manage click
  // --------------------------------------------------------------------------
  
  async function handleManage(tenantId: string) {
    try {
      await switchTenant(tenantId);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Group memberships by type
  // --------------------------------------------------------------------------
  
  const communities = memberships.filter(
    m => m.tenant_type === 'community' || m.tenant_type === 'government'
  );
  const businesses = memberships.filter(m => m.tenant_type === 'business');
  const personal = memberships.filter(m => m.tenant_type === 'individual');

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#060b15',
      color: 'white',
    } as React.CSSProperties,

    header: {
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as React.CSSProperties,

    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,

    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    } as React.CSSProperties,

    main: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '32px 24px',
    } as React.CSSProperties,

    title: {
      fontSize: '32px',
      fontWeight: 700,
      marginBottom: '8px',
    } as React.CSSProperties,

    subtitle: {
      color: '#9ca3af',
      fontSize: '16px',
      marginBottom: '32px',
    } as React.CSSProperties,

    section: {
      marginBottom: '40px',
    } as React.CSSProperties,

    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
    } as React.CSSProperties,

    sectionIcon: {
      fontSize: '24px',
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '20px',
      fontWeight: 600,
    } as React.CSSProperties,

    sectionDesc: {
      color: '#9ca3af',
      fontSize: '14px',
      marginBottom: '16px',
      marginLeft: '36px',
    } as React.CSSProperties,

    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '16px',
      marginLeft: '36px',
    } as React.CSSProperties,

    card: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '16px',
      transition: 'all 0.15s ease',
    } as React.CSSProperties,

    cardTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12px',
    } as React.CSSProperties,

    cardName: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,

    tenantName: {
      fontWeight: 500,
      fontSize: '16px',
    } as React.CSSProperties,

    primaryBadge: {
      fontSize: '12px',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      color: '#60a5fa',
      padding: '2px 8px',
      borderRadius: '4px',
    } as React.CSSProperties,

    roleBadge: {
      fontSize: '14px',
      color: '#6b7280',
      textTransform: 'capitalize',
      marginBottom: '16px',
    } as React.CSSProperties,

    cardButtons: {
      display: 'flex',
      gap: '8px',
    } as React.CSSProperties,

    manageButton: {
      flex: 1,
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } as React.CSSProperties,

    viewButton: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: 'none',
      padding: '10px 12px',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,

    quickActions: {
      marginTop: '48px',
      paddingTop: '32px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    } as React.CSSProperties,

    quickActionsTitle: {
      fontSize: '12px',
      fontWeight: 600,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '16px',
    } as React.CSSProperties,

    quickActionsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
    } as React.CSSProperties,

    quickActionButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      textDecoration: 'none',
    } as React.CSSProperties,

    emptyState: {
      textAlign: 'center',
      padding: '64px 16px',
    } as React.CSSProperties,

    emptyIcon: {
      fontSize: '64px',
      marginBottom: '16px',
    } as React.CSSProperties,

    emptyTitle: {
      fontSize: '24px',
      fontWeight: 700,
      marginBottom: '8px',
    } as React.CSSProperties,

    emptyDesc: {
      color: '#9ca3af',
      marginBottom: '32px',
    } as React.CSSProperties,

    adminLink: {
      fontSize: '14px',
      color: '#a855f7',
      textDecoration: 'none',
    } as React.CSSProperties,

    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,

    avatar: {
      width: '32px',
      height: '32px',
      backgroundColor: '#3b82f6',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 500,
    } as React.CSSProperties,
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={{ fontSize: '24px' }}>🌐</span>
          <span style={{ fontWeight: 600 }}>Community Canvas</span>
        </div>
        <div style={styles.headerRight}>
          {/* Phase 2C-16: user from AuthContext, isPlatformAdmin camelCase */}
          {user?.isPlatformAdmin && !impersonation.active && (
            <Link to="/app/platform" style={styles.adminLink}>
              Platform Admin
            </Link>
          )}
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
              {user?.email}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <h1 style={styles.title}>Your Places</h1>
        <p style={styles.subtitle}>Choose what you want to manage</p>

        {/* Empty State */}
        {memberships.length === 0 && (
          <div style={styles.emptyState as React.CSSProperties}>
            <div style={styles.emptyIcon}>🏔️</div>
            <h2 style={styles.emptyTitle}>No places yet</h2>
            <p style={styles.emptyDesc}>
              You don't have access to any communities or businesses yet.
            </p>
            <Link
              to="/explore"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Explore Communities
            </Link>
          </div>
        )}

        {/* Communities Section */}
        {communities.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🏔️</span>
              <h2 style={styles.sectionTitle}>Communities you manage</h2>
            </div>
            <p style={styles.sectionDesc}>
              Answer the phone, coordinate services, and view opted-in availability
            </p>
            <div style={styles.grid}>
              {communities.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Businesses Section */}
        {businesses.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🏢</span>
              <h2 style={styles.sectionTitle}>Businesses you manage</h2>
            </div>
            <p style={styles.sectionDesc}>
              Publish your inventory, manage availability, and handle reservations
            </p>
            <div style={styles.grid}>
              {businesses.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Personal Section */}
        {personal.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>👤</span>
              <h2 style={styles.sectionTitle}>Personal</h2>
            </div>
            <p style={styles.sectionDesc}>
              Your personal profile and activity
            </p>
            <div style={styles.grid}>
              {personal.map((tenant) => (
                <TenantCard
                  key={tenant.tenant_id}
                  tenant={tenant}
                  onManage={() => handleManage(tenant.tenant_id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Quick Actions */}
        {memberships.length > 0 && (
          <div style={styles.quickActions}>
            <h3 style={styles.quickActionsTitle as React.CSSProperties}>Quick Actions</h3>
            <div style={styles.quickActionsRow as React.CSSProperties}>
              <Link to="/app/create-business" style={styles.quickActionButton}>
                <Plus size={16} />
                Add a Business
              </Link>
              <Link to="/explore" style={styles.quickActionButton}>
                <Search size={16} />
                Join a Community
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// TENANT CARD COMPONENT
// ============================================================================

interface TenantCardProps {
  tenant: TenantMembership;
  onManage: () => void;
}

function TenantCard({ tenant, onManage }: TenantCardProps): React.ReactElement {
  const typeIcon = TYPE_ICONS[tenant.tenant_type] || '📁';

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '16px',
        transition: 'all 0.15s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      {/* Top row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{typeIcon}</span>
          <span style={{ fontWeight: 500, fontSize: '16px' }}>
            {tenant.tenant_name}
          </span>
        </div>
        {tenant.is_primary && (
          <span style={{
            fontSize: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            padding: '2px 8px',
            borderRadius: '4px',
          }}>
            Primary
          </span>
        )}
      </div>

      {/* Role */}
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        textTransform: 'capitalize',
        marginBottom: '16px',
      } as React.CSSProperties}>
        {tenant.role}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onManage}
          style={{
            flex: 1,
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          Manage
        </button>
        {tenant.tenant_slug && (
          <Link
            to={`/c/${tenant.tenant_slug}`}
            target="_blank"
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'white',
              padding: '10px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
            title="View public page"
          >
            <ExternalLink size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}
