/**
 * FOUNDER LAYOUT
 * 
 * Layout for Founder Solo mode: /app/founder/*
 * Uses FOUNDER_NAV as the single source of truth.
 * Shows aggregate views across all tenants the user owns.
 */

import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { ViewModeToggle } from '../components/routing/ViewModeToggle';
import { getFounderNavSections, FounderNavSection, FounderNavItem } from '../lib/routes/founderNav';

export function FounderLayout(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, initialized } = useTenant();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const sections = getFounderNavSections();

  if (loading || !initialized) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#060b15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(59, 130, 246, 0.3)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#9ca3af' }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login', { state: { from: location.pathname } });
    return <></>;
  }

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';

  return (
    <div className="flex h-screen bg-background" data-testid="founder-layout">
      {/* Sidebar */}
      <aside
        className={`${sidebarWidth} flex-shrink-0 border-r border-border bg-sidebar flex flex-col transition-all duration-200`}
        data-testid="founder-sidebar"
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          {!sidebarCollapsed && (
            <Link to="/app/founder" className="flex items-center gap-2" data-testid="link-founder-home">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Founder</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              {!sidebarCollapsed && (
                <h3 className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href || 
                    (item.href !== '/app/founder' && location.pathname.startsWith(item.href));
                  
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      data-testid={item.testId}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Menu */}
        <div className="border-t border-border p-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              data-testid="button-user-menu"
            >
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              {!sidebarCollapsed && (
                <span className="truncate">{user?.full_name || user?.email || 'User'}</span>
              )}
            </button>
            
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                <Link
                  to="/app/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setUserMenuOpen(false)}
                  data-testid="link-settings"
                >
                  <User className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background flex-shrink-0">
          <div className="flex items-center gap-4">
            <ViewModeToggle />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground px-2 py-1 bg-secondary rounded flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Founder Solo
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default FounderLayout;
