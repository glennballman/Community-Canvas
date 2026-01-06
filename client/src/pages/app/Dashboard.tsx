/**
 * DASHBOARD
 * 
 * Shows different content based on tenant type:
 * - Community/Government: Service runs, opted-in businesses, activity
 * - Business: Revenue, bookings, customers
 * - Individual: Personal activity
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Check tenant TYPE to determine which dashboard to show
 * 2. Community dashboard does NOT show revenue
 * 3. Business dashboard does NOT show service runs
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { 
  ExternalLink,
  Phone,
  Wrench,
  Palette,
  Package,
  Calendar,
  MessageSquare,
} from 'lucide-react';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Dashboard(): React.ReactElement {
  const { currentTenant } = useTenant();

  if (!currentTenant) {
    return (
      <div style={{ padding: '32px', color: '#9ca3af' }}>
        <p>No tenant selected. Please select a place to manage.</p>
        <Link to="/app" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
          Go to My Places
        </Link>
      </div>
    );
  }

  // Determine which dashboard to show based on tenant type
  const isCommunity = 
    currentTenant.tenant_type === 'community' || 
    currentTenant.tenant_type === 'government';

  if (isCommunity) {
    return <CommunityDashboard tenant={currentTenant} />;
  }

  return <BusinessDashboard tenant={currentTenant} />;
}

// ============================================================================
// COMMUNITY DASHBOARD
// ============================================================================

interface DashboardProps {
  tenant: {
    tenant_id: string;
    tenant_name: string;
    tenant_type: string;
    portal_slug?: string;
    role: string;
  };
}

function CommunityDashboard({ tenant }: DashboardProps): React.ReactElement {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
              {tenant.tenant_name}
            </h1>
            <p style={{ color: '#9ca3af' }}>Community Dashboard</p>
          </div>
          {tenant.portal_slug && (
            <Link
              to={`/c/${tenant.portal_slug}`}
              target="_blank"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              <ExternalLink size={16} />
              View Public Portal
            </Link>
          )}
        </div>

        {/* Stats Grid - COMMUNITY SPECIFIC (no revenue!) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <StatCard
            icon="⏳"
            label="Pending Service Runs"
            value="2"
            sublabel="awaiting review"
            color="#f59e0b"
          />
          <StatCard
            icon="🔧"
            label="Active Service Runs"
            value="3"
            sublabel="in progress"
            color="#10b981"
          />
          <StatCard
            icon="🏪"
            label="Opted-in Businesses"
            value="5"
            sublabel="sharing availability"
            color="#3b82f6"
          />
          <StatCard
            icon="💛"
            label="Good News Posts"
            value="12"
            sublabel="this month"
            color="#ec4899"
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <QuickAction
            icon={<Phone size={24} />}
            title="Availability Console"
            description="Answer calls with real-time availability"
            to="/app/availability"
          />
          <QuickAction
            icon={<Wrench size={24} />}
            title="Review Service Runs"
            description="2 runs awaiting approval"
            to="/app/service-runs"
            badge={2}
          />
          <QuickAction
            icon={<Palette size={24} />}
            title="Edit Public Portal"
            description="Update branding and content"
            to="/app/content"
          />
        </div>

        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ActivityItem
              icon="🔧"
              text="New service run created: Chimney Sweep"
              time="2 hours ago"
            />
            <ActivityItem
              icon="👤"
              text="Joe Smith joined the Septic Pump run"
              time="5 hours ago"
            />
            <ActivityItem
              icon="💛"
              text="New Good News post submitted"
              time="Yesterday"
            />
            <ActivityItem
              icon="🏪"
              text="Bamfield Kayaks updated their availability"
              time="Yesterday"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BUSINESS DASHBOARD
// ============================================================================

function BusinessDashboard({ tenant }: DashboardProps): React.ReactElement {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
            {tenant.tenant_name}
          </h1>
          <p style={{ color: '#9ca3af' }}>Business Dashboard</p>
        </div>

        {/* Stats Grid - BUSINESS SPECIFIC (has revenue!) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <StatCard
            icon="💰"
            label="Total Revenue"
            value="$12,450"
            sublabel="+12% from last month"
            color="#10b981"
          />
          <StatCard
            icon="📅"
            label="Active Bookings"
            value="24"
            sublabel="+3 from last month"
            color="#3b82f6"
          />
          <StatCard
            icon="👥"
            label="Customers"
            value="156"
            sublabel="+8 from last month"
            color="#8b5cf6"
          />
          <StatCard
            icon="📈"
            label="Conversion Rate"
            value="3.2%"
            sublabel="+0.4% from last month"
            color="#f59e0b"
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <QuickAction
            icon={<Package size={24} />}
            title="Manage Inventory"
            description="Add or update your offerings"
            to="/app/inventory"
          />
          <QuickAction
            icon={<Calendar size={24} />}
            title="View Bookings"
            description="5 bookings this week"
            to="/app/bookings"
          />
          <QuickAction
            icon={<MessageSquare size={24} />}
            title="Conversations"
            description="2 unread messages"
            to="/app/conversations"
            badge={2}
          />
        </div>

        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ActivityItem
              icon="📅"
              text="New booking: John Smith - Single Kayak"
              time="1 hour ago"
            />
            <ActivityItem
              icon="💬"
              text="New message from Jane Doe"
              time="3 hours ago"
            />
            <ActivityItem
              icon="✅"
              text="Booking completed: Bob Wilson"
              time="Yesterday"
            />
            <ActivityItem
              icon="⭐"
              text="New review: 5 stars from Sarah"
              time="2 days ago"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}

function StatCard({ icon, label, value, sublabel, color }: StatCardProps): React.ReactElement {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
      </div>
      <div style={{ 
        fontSize: '28px', 
        fontWeight: 700, 
        marginBottom: '4px',
        color,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280' }}>
        {sublabel}
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  badge?: number;
}

function QuickAction({ icon, title, description, to, badge }: QuickActionProps): React.ReactElement {
  return (
    <Link
      to={to}
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '20px',
        textDecoration: 'none',
        color: 'white',
        display: 'block',
        transition: 'all 0.15s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ color: '#60a5fa' }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 500 }}>{title}</span>
            {badge && (
              <span style={{
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '12px',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 500,
              }}>
                {badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

interface ActivityItemProps {
  icon: string;
  text: string;
  time: string;
}

function ActivityItem({ icon, text, time }: ActivityItemProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '14px', marginBottom: '2px' }}>{text}</p>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{time}</span>
      </div>
    </div>
  );
}
