-- ============================================================================
-- Migration 162: Seed CANONICAL Capabilities Only
-- IMPORTANT: Only canonical tables (cc_n3_runs, cc_bids, cc_quote_drafts, cc_folio_ledger)
-- ============================================================================

-- Platform Administration
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa) VALUES
('platform.configure', 'platform', 'configure', 'Configure platform-wide settings', 'critical', true),
('platform.users.manage', 'platform', 'users.manage', 'Manage platform users', 'critical', true)
ON CONFLICT (code) DO NOTHING;

-- Tenant Management
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa) VALUES
('tenant.configure', 'tenant', 'configure', 'Configure tenant settings', 'high', false),
('tenant.users.manage', 'tenant', 'users.manage', 'Manage tenant users', 'high', false),
('tenant.roles.manage', 'tenant', 'roles.manage', 'Manage tenant roles', 'high', false)
ON CONFLICT (code) DO NOTHING;

-- Team/User Management (own/all pattern)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('team.read', 'team', 'read', 'View team members', 'low', false, false),
('team.own.read', 'team', 'own.read', 'View own profile', 'low', false, true),
('team.create', 'team', 'create', 'Add team members', 'medium', false, false),
('team.update', 'team', 'update', 'Update any team member', 'medium', false, false),
('team.own.update', 'team', 'own.update', 'Update own profile', 'low', false, true),
('team.delete', 'team', 'delete', 'Remove team members', 'high', false, false)
ON CONFLICT (code) DO NOTHING;

-- Reservations (cc_reservations)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('reservations.read', 'reservations', 'read', 'View all reservations', 'low', false, false),
('reservations.own.read', 'reservations', 'own.read', 'View own reservations', 'low', false, true),
('reservations.create', 'reservations', 'create', 'Create reservations', 'medium', false, false),
('reservations.update', 'reservations', 'update', 'Update any reservation', 'medium', false, false),
('reservations.own.update', 'reservations', 'own.update', 'Update own reservations', 'low', false, true),
('reservations.cancel', 'reservations', 'cancel', 'Cancel any reservation', 'medium', false, false),
('reservations.own.cancel', 'reservations', 'own.cancel', 'Cancel own reservations', 'low', false, true),
('reservations.checkin', 'reservations', 'checkin', 'Check in guests', 'low', false, false),
('reservations.checkout', 'reservations', 'checkout', 'Check out guests', 'low', false, false)
ON CONFLICT (code) DO NOTHING;

-- Service Runs (cc_n3_runs - CANONICAL V3)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('service_runs.read', 'service_runs', 'read', 'View all service runs', 'low', false, false),
('service_runs.own.read', 'service_runs', 'own.read', 'View own service runs', 'low', false, true),
('service_runs.create', 'service_runs', 'create', 'Create service runs', 'medium', false, false),
('service_runs.update', 'service_runs', 'update', 'Update any service run', 'medium', false, false),
('service_runs.own.update', 'service_runs', 'own.update', 'Update own service runs', 'low', false, true),
('service_runs.complete', 'service_runs', 'complete', 'Complete any service run', 'medium', false, false),
('service_runs.own.complete', 'service_runs', 'own.complete', 'Complete own service runs', 'low', false, true),
('service_runs.dispatch', 'service_runs', 'dispatch', 'Dispatch service runs', 'medium', false, false),
('service_runs.publish', 'service_runs', 'publish', 'Publish runs to portals', 'medium', false, false)
ON CONFLICT (code) DO NOTHING;

-- Jobs (cc_jobs - Employment postings ONLY)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('jobs.read', 'jobs', 'read', 'View all job postings', 'low', false, false),
('jobs.create', 'jobs', 'create', 'Create job postings', 'medium', false, false),
('jobs.update', 'jobs', 'update', 'Update job postings', 'medium', false, false),
('jobs.delete', 'jobs', 'delete', 'Delete job postings', 'medium', false, false),
('jobs.applications.read', 'jobs', 'applications.read', 'View job applications', 'low', false, false),
('jobs.applications.manage', 'jobs', 'applications.manage', 'Manage job applications', 'medium', false, false)
ON CONFLICT (code) DO NOTHING;

-- Projects (cc_projects - Tenant-owned work)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('projects.read', 'projects', 'read', 'View all projects', 'low', false, false),
('projects.own.read', 'projects', 'own.read', 'View own projects', 'low', false, true),
('projects.create', 'projects', 'create', 'Create projects', 'medium', false, false),
('projects.update', 'projects', 'update', 'Update any project', 'medium', false, false),
('projects.own.update', 'projects', 'own.update', 'Update own projects', 'low', false, true),
('projects.complete', 'projects', 'complete', 'Mark projects complete', 'medium', false, false),
('projects.own.complete', 'projects', 'own.complete', 'Mark own projects complete', 'low', false, true)
ON CONFLICT (code) DO NOTHING;

-- Bids (cc_bids - CANONICAL)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('bids.read', 'bids', 'read', 'View all bids', 'low', false, false),
('bids.own.read', 'bids', 'own.read', 'View own bids', 'low', false, true),
('bids.create', 'bids', 'create', 'Submit bids', 'medium', false, false),
('bids.own.update', 'bids', 'own.update', 'Update own bids', 'medium', false, true),
('bids.evaluate', 'bids', 'evaluate', 'Evaluate/score bids', 'high', false, false),
('bids.award', 'bids', 'award', 'Award winning bid', 'high', false, false)
ON CONFLICT (code) DO NOTHING;

-- Folios (cc_folio_ledger - Guest accounts)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('folios.read', 'folios', 'read', 'View all folios', 'medium', false, false),
('folios.own.read', 'folios', 'own.read', 'View own folios', 'low', false, true),
('folios.charge', 'folios', 'charge', 'Post charges to folios', 'high', false, false),
('folios.adjust', 'folios', 'adjust', 'Post adjustments', 'high', false, false),
('folios.refund', 'folios', 'refund', 'Process refunds', 'high', true, false)
ON CONFLICT (code) DO NOTHING;

-- Wallets (cc_wallet_accounts)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('wallets.read', 'wallets', 'read', 'View all wallets', 'medium', false, false),
('wallets.own.read', 'wallets', 'own.read', 'View own wallet', 'low', false, true),
('wallets.credit', 'wallets', 'credit', 'Credit wallets', 'high', false, false),
('wallets.debit', 'wallets', 'debit', 'Debit wallets', 'high', false, false)
ON CONFLICT (code) DO NOTHING;

-- Assets (cc_assets)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('assets.read', 'assets', 'read', 'View all assets', 'low', false, false),
('assets.create', 'assets', 'create', 'Create assets', 'medium', false, false),
('assets.update', 'assets', 'update', 'Update assets', 'medium', false, false),
('assets.delete', 'assets', 'delete', 'Delete assets', 'high', false, false)
ON CONFLICT (code) DO NOTHING;

-- People (cc_people)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('people.read', 'people', 'read', 'View all people', 'low', false, false),
('people.create', 'people', 'create', 'Create people records', 'low', false, false),
('people.update', 'people', 'update', 'Update people records', 'low', false, false),
('people.delete', 'people', 'delete', 'Delete people records', 'medium', false, false)
ON CONFLICT (code) DO NOTHING;

-- Analytics & Audit
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa) VALUES
('analytics.view', 'analytics', 'view', 'View analytics dashboards', 'low', false),
('analytics.export', 'analytics', 'export', 'Export analytics data', 'medium', false),
('audit.view', 'audit', 'view', 'View audit logs', 'high', false),
('audit.export', 'audit', 'export', 'Export audit logs', 'critical', true)
ON CONFLICT (code) DO NOTHING;

-- Work Requests (cc_work_requests)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('work_requests.read', 'work_requests', 'read', 'View all work requests', 'low', false, false),
('work_requests.own.read', 'work_requests', 'own.read', 'View own work requests', 'low', false, true),
('work_requests.create', 'work_requests', 'create', 'Create work requests', 'low', false, false),
('work_requests.update', 'work_requests', 'update', 'Update any work request', 'medium', false, false),
('work_requests.own.update', 'work_requests', 'own.update', 'Update own work requests', 'low', false, true),
('work_requests.approve', 'work_requests', 'approve', 'Approve work requests', 'medium', false, false),
('work_requests.reject', 'work_requests', 'reject', 'Reject work requests', 'medium', false, false)
ON CONFLICT (code) DO NOTHING;

-- Contracts (cc_contracts)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('contracts.read', 'contracts', 'read', 'View all contracts', 'medium', false, false),
('contracts.own.read', 'contracts', 'own.read', 'View own contracts', 'low', false, true),
('contracts.create', 'contracts', 'create', 'Create contracts', 'high', false, false),
('contracts.update', 'contracts', 'update', 'Update contracts', 'high', false, false),
('contracts.terminate', 'contracts', 'terminate', 'Terminate contracts', 'high', true, false)
ON CONFLICT (code) DO NOTHING;

-- Estimates/Quotes (cc_estimates, cc_quote_drafts)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('estimates.read', 'estimates', 'read', 'View all estimates', 'low', false, false),
('estimates.own.read', 'estimates', 'own.read', 'View own estimates', 'low', false, true),
('estimates.create', 'estimates', 'create', 'Create estimates', 'medium', false, false),
('estimates.update', 'estimates', 'update', 'Update any estimate', 'medium', false, false),
('estimates.own.update', 'estimates', 'own.update', 'Update own estimates', 'low', false, true),
('estimates.approve', 'estimates', 'approve', 'Approve estimates', 'high', false, false),
('estimates.reject', 'estimates', 'reject', 'Reject estimates', 'medium', false, false)
ON CONFLICT (code) DO NOTHING;

-- Machine/Robot Operations
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa, supports_own) VALUES
('machines.read', 'machines', 'read', 'View all machines', 'low', false, false),
('machines.control.manual', 'machines', 'control.manual', 'Manual control of machines', 'high', false, false),
('machines.control.teleop', 'machines', 'control.teleop', 'Teleoperation of machines', 'critical', true, false),
('machines.control.autonomous', 'machines', 'control.autonomous', 'Enable autonomous mode', 'critical', true, false),
('machines.estop', 'machines', 'estop', 'Emergency stop any machine', 'low', false, false),
('machines.configure', 'machines', 'configure', 'Configure machine settings', 'high', true, false)
ON CONFLICT (code) DO NOTHING;

-- Impersonation (platform admins only)
INSERT INTO cc_capabilities (code, domain, action, description, risk_level, requires_mfa) VALUES
('impersonation.start', 'impersonation', 'start', 'Start impersonation session', 'critical', true),
('impersonation.end', 'impersonation', 'end', 'End impersonation session', 'low', false)
ON CONFLICT (code) DO NOTHING;
