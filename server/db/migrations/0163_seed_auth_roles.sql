-- ============================================================================
-- Migration 163: Seed System Roles
-- Roles are CONVENIENCE BUNDLES ONLY - they MUST resolve to capabilities
-- ============================================================================

-- Platform Admin
INSERT INTO cc_roles (id, code, name, description, is_system_role)
VALUES ('10000000-0000-0000-0000-000000000001', 'platform_admin', 'Platform Administrator', 'Full platform access', true)
ON CONFLICT DO NOTHING;

-- Tenant Owner
INSERT INTO cc_roles (id, code, name, description, is_system_role)
VALUES ('10000000-0000-0000-0000-000000000002', 'tenant_owner', 'Tenant Owner', 'Full tenant access including billing', true)
ON CONFLICT DO NOTHING;

-- Tenant Admin
INSERT INTO cc_roles (id, code, name, description, is_system_role)
VALUES ('10000000-0000-0000-0000-000000000003', 'tenant_admin', 'Tenant Administrator', 'Full tenant access except billing', true)
ON CONFLICT DO NOTHING;

-- Reservation Manager (Cloudbeds: front_desk)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system, external_role_code)
VALUES ('10000000-0000-0000-0000-000000000004', 'reservation_manager', 'Reservation Manager', 'Manage reservations', true, 'cloudbeds', 'front_desk')
ON CONFLICT DO NOTHING;

-- Operations Supervisor (Jobber: manager)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system, external_role_code)
VALUES ('10000000-0000-0000-0000-000000000010', 'operations_supervisor', 'Operations Supervisor', 'Supervise operations and manage team', true, 'jobber', 'manager')
ON CONFLICT DO NOTHING;

-- Operations Full (Jobber: dispatcher)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system, external_role_code)
VALUES ('10000000-0000-0000-0000-000000000005', 'operations_full', 'Operations Full', 'Full operations access including dispatch', true, 'jobber', 'dispatcher')
ON CONFLICT DO NOTHING;

-- Field Worker Full (Jobber: worker)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system, external_role_code)
VALUES ('10000000-0000-0000-0000-000000000006', 'field_worker_full', 'Field Worker Full', 'Complete own work with full access', true, 'jobber', 'worker')
ON CONFLICT DO NOTHING;

-- Field Worker Limited (Jobber: limited_worker)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system, external_role_code)
VALUES ('10000000-0000-0000-0000-000000000011', 'field_worker_limited', 'Field Worker Limited', 'Complete own work with limited access', true, 'jobber', 'limited_worker')
ON CONFLICT DO NOTHING;

-- Finance Manager
INSERT INTO cc_roles (id, code, name, description, is_system_role)
VALUES ('10000000-0000-0000-0000-000000000007', 'finance_manager', 'Finance Manager', 'Manage billing and folios', true)
ON CONFLICT DO NOTHING;

-- Viewer (Read-only)
INSERT INTO cc_roles (id, code, name, description, is_system_role)
VALUES ('10000000-0000-0000-0000-000000000008', 'viewer', 'Viewer', 'Read-only access', true)
ON CONFLICT DO NOTHING;

-- Machine Operator (Robotics)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system)
VALUES ('10000000-0000-0000-0000-000000000012', 'machine_operator', 'Machine Operator', 'Operate machines with supervision', true, 'robotics')
ON CONFLICT DO NOTHING;

-- Machine Supervisor (Robotics)
INSERT INTO cc_roles (id, code, name, description, is_system_role, external_system)
VALUES ('10000000-0000-0000-0000-000000000013', 'machine_supervisor', 'Machine Supervisor', 'Supervise and authorize autonomous operations', true, 'robotics')
ON CONFLICT DO NOTHING;

-- Wire role → capability bundles
-- Platform Admin gets everything
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM cc_capabilities
ON CONFLICT DO NOTHING;

-- Tenant Owner (no platform)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM cc_capabilities WHERE domain != 'platform'
ON CONFLICT DO NOTHING;

-- Tenant Admin (no platform, no billing)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM cc_capabilities 
WHERE domain != 'platform' AND code NOT LIKE '%billing%'
ON CONFLICT DO NOTHING;

-- Reservation Manager
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM cc_capabilities 
WHERE domain IN ('reservations', 'people', 'assets') OR code IN ('team.own.read', 'team.own.update', 'analytics.view')
ON CONFLICT DO NOTHING;

-- Operations Supervisor (manager)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000010', id FROM cc_capabilities 
WHERE domain IN ('service_runs', 'projects', 'bids', 'people', 'work_requests', 'estimates', 'contracts', 'team') 
   OR code IN ('analytics.view', 'analytics.export')
ON CONFLICT DO NOTHING;

-- Operations Full (dispatcher)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000005', id FROM cc_capabilities 
WHERE domain IN ('service_runs', 'projects', 'bids', 'people', 'work_requests', 'estimates') 
   OR code IN ('team.own.read', 'team.own.update', 'analytics.view')
ON CONFLICT DO NOTHING;

-- Field Worker Full (own resources + some all)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000006', id FROM cc_capabilities 
WHERE code LIKE '%.own.%' OR code IN ('service_runs.read', 'projects.read', 'people.read')
ON CONFLICT DO NOTHING;

-- Field Worker Limited (own resources only)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000011', id FROM cc_capabilities WHERE code LIKE '%.own.%'
ON CONFLICT DO NOTHING;

-- Finance Manager
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000007', id FROM cc_capabilities 
WHERE domain IN ('folios', 'wallets') OR code IN ('team.own.read', 'analytics.view', 'reservations.read', 'projects.read')
ON CONFLICT DO NOTHING;

-- Viewer (read-only)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000008', id FROM cc_capabilities WHERE code LIKE '%.read' OR code LIKE '%.own.read'
ON CONFLICT DO NOTHING;

-- Machine Operator
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000012', id FROM cc_capabilities 
WHERE code IN ('machines.read', 'machines.control.manual', 'machines.estop', 'team.own.read')
ON CONFLICT DO NOTHING;

-- Machine Supervisor
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT '10000000-0000-0000-0000-000000000013', id FROM cc_capabilities 
WHERE domain = 'machines' OR code IN ('team.read', 'team.own.read', 'team.own.update', 'analytics.view')
ON CONFLICT DO NOTHING;
