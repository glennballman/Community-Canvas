/**
 * APP ROUTES
 * 
 * Three route trees:
 * 1. /c/:slug/* - Public portal (no auth)
 * 2. /app/* - Tenant app (auth required)
 * 3. /admin/* - Platform admin (admin only)
 * 
 * DO NOT MODIFY THIS STRUCTURE.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context
import { TenantProvider } from './contexts/TenantContext';

// Global Components
import { ImpersonationBanner } from './components/ImpersonationBanner';

// Layouts
import { TenantAppLayout } from './layouts/TenantAppLayout';
import { PlatformAdminLayout } from './layouts/PlatformAdminLayout';
import { PublicPortalLayout } from './layouts/PublicPortalLayout';

// Pages - App
import { TenantPicker } from './pages/app/TenantPicker';
import { Dashboard } from './pages/app/Dashboard';

// Pages - Admin
import { ImpersonationConsole } from './pages/admin/ImpersonationConsole';

// Placeholder pages - replace with real implementations later
function AvailabilityConsole() {
  return <div style={{ padding: '32px' }}><h1>Availability Console</h1><p>Coming soon...</p></div>;
}
function ServiceRunsPage() {
  return <div style={{ padding: '32px' }}><h1>Service Runs</h1><p>Coming soon...</p></div>;
}
function DirectoryPage() {
  return <div style={{ padding: '32px' }}><h1>Directory</h1><p>Coming soon...</p></div>;
}
function ContentPage() {
  return <div style={{ padding: '32px' }}><h1>Content</h1><p>Coming soon...</p></div>;
}
function CatalogPage() {
  return <div style={{ padding: '32px' }}><h1>Catalog</h1><p>Coming soon...</p></div>;
}
function BookingsPage() {
  return <div style={{ padding: '32px' }}><h1>Bookings</h1><p>Coming soon...</p></div>;
}
function CustomersPage() {
  return <div style={{ padding: '32px' }}><h1>Customers</h1><p>Coming soon...</p></div>;
}
function ConversationsPage() {
  return <div style={{ padding: '32px' }}><h1>Conversations</h1><p>Coming soon...</p></div>;
}
function SettingsPage() {
  return <div style={{ padding: '32px' }}><h1>Settings</h1><p>Coming soon...</p></div>;
}
function AdminDashboard() {
  return <div style={{ padding: '32px' }}><h1>Admin Dashboard</h1><p>Coming soon...</p></div>;
}
function TenantsPage() {
  return <div style={{ padding: '32px' }}><h1>Tenants</h1><p>Coming soon...</p></div>;
}
function UsersPage() {
  return <div style={{ padding: '32px' }}><h1>Users</h1><p>Coming soon...</p></div>;
}
function PortalOverview() {
  return <div style={{ padding: '32px' }}><h1>Welcome to this community!</h1></div>;
}
function LoginPage() {
  // This should redirect to your actual auth flow
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#060b15', 
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Sign In</h1>
        <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
          Authentication page placeholder
        </p>
        <a 
          href="/api/auth/login" 
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          Sign In with Google
        </a>
      </div>
    </div>
  );
}
function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#060b15',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '64px', fontWeight: 700, marginBottom: '16px' }}>404</h1>
        <p style={{ color: '#9ca3af', marginBottom: '24px' }}>Page not found</p>
        <a href="/app" style={{ color: '#60a5fa' }}>Go to My Places</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        {/* GLOBAL: Impersonation banner - appears on all pages when active */}
        <ImpersonationBanner />

        <Routes>
          {/* ========================================== */}
          {/* PUBLIC PORTAL - /c/:slug/*                */}
          {/* ========================================== */}
          <Route path="/c/:slug" element={<PublicPortalLayout />}>
            <Route index element={<PortalOverview />} />
            {/* Add more portal routes as needed */}
          </Route>

          {/* ========================================== */}
          {/* TENANT APP - /app/*                       */}
          {/* ========================================== */}
          <Route path="/app" element={<TenantAppLayout />}>
            {/* Index = Tenant Picker (shows when no tenant selected) */}
            <Route index element={<TenantPicker />} />
            
            {/* Dashboard (content varies by tenant type) */}
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Community tenant routes */}
            <Route path="availability" element={<AvailabilityConsole />} />
            <Route path="service-runs" element={<ServiceRunsPage />} />
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="content" element={<ContentPage />} />
            
            {/* Business tenant routes */}
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            
            {/* Shared routes */}
            <Route path="conversations" element={<ConversationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ========================================== */}
          {/* PLATFORM ADMIN - /admin/*                 */}
          {/* ========================================== */}
          <Route path="/admin" element={<PlatformAdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="impersonation" element={<ImpersonationConsole />} />
            {/* Add more admin routes as needed */}
          </Route>

          {/* ========================================== */}
          {/* AUTH & REDIRECTS                          */}
          {/* ========================================== */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </TenantProvider>
    </BrowserRouter>
  );
}
