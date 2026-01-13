BEGIN;

-- ============ ROLES ============
-- Role definitions with permission sets

CREATE TABLE IF NOT EXISTS cc_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  portal_id uuid REFERENCES cc_portals(id) ON DELETE CASCADE,
  -- NULL portal_id = system-wide role
  
  -- Identity
  name text NOT NULL,
  code varchar(30) NOT NULL,
  description text,
  
  -- Type
  role_type varchar DEFAULT 'custom' CHECK (role_type IN (
    'system',          -- Built-in system roles (cannot modify)
    'template',        -- Template roles (can clone)
    'custom'           -- Custom portal-specific roles
  )),
  
  -- Hierarchy
  hierarchy_level integer DEFAULT 0,
  -- Higher = more access (admin=100, manager=50, staff=25, user=10, guest=0)
  
  -- Permissions (array of permission codes)
  permissions text[] DEFAULT ARRAY[]::text[],
  
  -- UI
  color varchar(20),
  icon varchar(50),
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, code)
);

CREATE INDEX IF NOT EXISTS idx_roles_portal ON cc_roles(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roles_code ON cc_roles(code);
CREATE INDEX IF NOT EXISTS idx_roles_type ON cc_roles(role_type);

ALTER TABLE cc_roles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLE ASSIGNMENTS ============
-- Assign roles to users within portals

CREATE TABLE IF NOT EXISTS cc_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  user_id uuid NOT NULL REFERENCES cc_auth_accounts(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES cc_roles(id) ON DELETE CASCADE,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE CASCADE,
  
  -- Scope restrictions (optional)
  property_id uuid REFERENCES cc_properties(id) ON DELETE CASCADE,
  -- If set, role only applies to this property
  
  -- Assignment info
  assigned_by uuid REFERENCES cc_auth_accounts(id),
  assigned_at timestamptz DEFAULT now(),
  
  -- Expiry (for temporary assignments)
  expires_at timestamptz,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  
  -- Notes
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, role_id, portal_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON cc_user_roles(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_roles_portal ON cc_user_roles(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON cc_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_property ON cc_user_roles(property_id) WHERE property_id IS NOT NULL;

ALTER TABLE cc_user_roles ENABLE ROW LEVEL SECURITY;

-- ============ PERMISSION DEFINITIONS ============
-- Master list of all permissions

CREATE TABLE IF NOT EXISTS cc_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  code varchar(50) NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  
  -- Grouping
  category varchar(30) NOT NULL,
  -- 'portal', 'property', 'reservation', 'transport', 'enforcement', 'identity', 'system'
  
  -- Resource type this permission applies to
  resource_type varchar(50),
  
  -- Action type
  action varchar(20) NOT NULL CHECK (action IN (
    'view', 'create', 'update', 'delete', 'manage', 'approve', 'execute'
  )),
  
  -- Flags
  is_dangerous boolean DEFAULT false,  -- Requires extra confirmation
  requires_mfa boolean DEFAULT false,  -- Requires MFA for this action
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON cc_permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON cc_permissions(resource_type);

-- ============ SEED SYSTEM ROLES ============

DO $$
BEGIN
  -- Super Admin (system-wide)
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Super Admin', 'super_admin', 'Full system access', 'system', 100,
    ARRAY['*'],  -- Wildcard = all permissions
    '#dc2626'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Portal Admin
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Portal Admin', 'portal_admin', 'Full portal management', 'template', 90,
    ARRAY[
      'portal.manage', 'portal.settings',
      'users.view', 'users.create', 'users.update', 'users.delete', 'users.roles',
      'properties.view', 'properties.create', 'properties.update', 'properties.delete',
      'reservations.view', 'reservations.create', 'reservations.update', 'reservations.delete',
      'transport.view', 'transport.manage',
      'enforcement.view', 'enforcement.manage', 'citations.create', 'citations.manage',
      'identity.view', 'identity.verify',
      'reports.view', 'reports.export',
      'billing.view', 'billing.manage'
    ],
    '#7c3aed'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Property Manager
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Property Manager', 'property_manager', 'Manage assigned properties', 'template', 50,
    ARRAY[
      'properties.view', 'properties.update',
      'units.view', 'units.update',
      'reservations.view', 'reservations.create', 'reservations.update',
      'housekeeping.view', 'housekeeping.create', 'housekeeping.update',
      'maintenance.view', 'maintenance.create', 'maintenance.update',
      'guests.view',
      'reports.view'
    ],
    '#2563eb'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Front Desk Staff
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Front Desk', 'front_desk', 'Check-in/out and guest services', 'template', 30,
    ARRAY[
      'reservations.view', 'reservations.checkin', 'reservations.checkout',
      'guests.view', 'guests.update',
      'housekeeping.view',
      'maintenance.view', 'maintenance.create',
      'transport.view'
    ],
    '#0891b2'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Housekeeping Staff
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Housekeeping', 'housekeeping', 'Housekeeping task management', 'template', 25,
    ARRAY[
      'housekeeping.view', 'housekeeping.update',
      'units.view',
      'maintenance.create'
    ],
    '#65a30d'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Maintenance Staff
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Maintenance', 'maintenance', 'Maintenance request handling', 'template', 25,
    ARRAY[
      'maintenance.view', 'maintenance.update',
      'units.view',
      'properties.view'
    ],
    '#ea580c'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Transport Operator
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Transport Operator', 'transport_operator', 'Transport operations', 'template', 40,
    ARRAY[
      'transport.view', 'transport.update',
      'sailings.view', 'sailings.update',
      'freight.view', 'freight.update',
      'passengers.view', 'passengers.checkin'
    ],
    '#0d9488'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Enforcement Officer
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Enforcement Officer', 'enforcement_officer', 'Compliance and citations', 'template', 45,
    ARRAY[
      'enforcement.view', 'enforcement.create', 'enforcement.update',
      'citations.view', 'citations.create',
      'incidents.view', 'incidents.create', 'incidents.update',
      'identity.view'
    ],
    '#be123c'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
  
  -- Guest (registered user)
  INSERT INTO cc_roles (name, code, description, role_type, hierarchy_level, permissions, color)
  VALUES (
    'Guest', 'guest', 'Registered guest user', 'template', 10,
    ARRAY[
      'reservations.view.own',
      'profile.view.own', 'profile.update.own',
      'transport.view', 'transport.book',
      'permits.view.own', 'permits.apply'
    ],
    '#64748b'
  ) ON CONFLICT (portal_id, code) DO NOTHING;
END $$;

-- ============ SEED PERMISSIONS ============

INSERT INTO cc_permissions (code, name, description, category, resource_type, action) VALUES
-- Portal permissions
('portal.view', 'View Portal', 'View portal details', 'portal', 'portal', 'view'),
('portal.manage', 'Manage Portal', 'Full portal management', 'portal', 'portal', 'manage'),
('portal.settings', 'Portal Settings', 'Modify portal settings', 'portal', 'portal', 'update'),

-- User permissions
('users.view', 'View Users', 'View user list', 'portal', 'user', 'view'),
('users.create', 'Create Users', 'Create new users', 'portal', 'user', 'create'),
('users.update', 'Update Users', 'Update user details', 'portal', 'user', 'update'),
('users.delete', 'Delete Users', 'Delete users', 'portal', 'user', 'delete'),
('users.roles', 'Manage User Roles', 'Assign roles to users', 'portal', 'user', 'manage'),

-- Property permissions
('properties.view', 'View Properties', 'View property list', 'property', 'property', 'view'),
('properties.create', 'Create Properties', 'Create new properties', 'property', 'property', 'create'),
('properties.update', 'Update Properties', 'Update property details', 'property', 'property', 'update'),
('properties.delete', 'Delete Properties', 'Delete properties', 'property', 'property', 'delete'),

-- Unit permissions
('units.view', 'View Units', 'View unit list', 'property', 'unit', 'view'),
('units.update', 'Update Units', 'Update unit details', 'property', 'unit', 'update'),

-- Reservation permissions
('reservations.view', 'View Reservations', 'View all reservations', 'reservation', 'reservation', 'view'),
('reservations.view.own', 'View Own Reservations', 'View own reservations only', 'reservation', 'reservation', 'view'),
('reservations.create', 'Create Reservations', 'Create new reservations', 'reservation', 'reservation', 'create'),
('reservations.update', 'Update Reservations', 'Update reservations', 'reservation', 'reservation', 'update'),
('reservations.delete', 'Cancel Reservations', 'Cancel reservations', 'reservation', 'reservation', 'delete'),
('reservations.checkin', 'Check In Guests', 'Perform guest check-in', 'reservation', 'reservation', 'execute'),
('reservations.checkout', 'Check Out Guests', 'Perform guest check-out', 'reservation', 'reservation', 'execute'),

-- Housekeeping permissions
('housekeeping.view', 'View Housekeeping', 'View housekeeping tasks', 'property', 'housekeeping', 'view'),
('housekeeping.create', 'Create Housekeeping Tasks', 'Create housekeeping tasks', 'property', 'housekeeping', 'create'),
('housekeeping.update', 'Update Housekeeping Tasks', 'Update housekeeping tasks', 'property', 'housekeeping', 'update'),

-- Maintenance permissions
('maintenance.view', 'View Maintenance', 'View maintenance requests', 'property', 'maintenance', 'view'),
('maintenance.create', 'Create Maintenance Requests', 'Create maintenance requests', 'property', 'maintenance', 'create'),
('maintenance.update', 'Update Maintenance Requests', 'Update maintenance requests', 'property', 'maintenance', 'update'),

-- Transport permissions
('transport.view', 'View Transport', 'View transport operations', 'transport', 'transport', 'view'),
('transport.manage', 'Manage Transport', 'Full transport management', 'transport', 'transport', 'manage'),
('transport.book', 'Book Transport', 'Book transport requests', 'transport', 'transport', 'create'),
('sailings.view', 'View Sailings', 'View sailing schedules', 'transport', 'sailing', 'view'),
('sailings.update', 'Update Sailings', 'Update sailing info', 'transport', 'sailing', 'update'),
('freight.view', 'View Freight', 'View freight manifests', 'transport', 'freight', 'view'),
('freight.update', 'Update Freight', 'Update freight manifests', 'transport', 'freight', 'update'),
('passengers.view', 'View Passengers', 'View passenger lists', 'transport', 'passenger', 'view'),
('passengers.checkin', 'Check In Passengers', 'Check in passengers', 'transport', 'passenger', 'execute'),

-- Enforcement permissions
('enforcement.view', 'View Enforcement', 'View compliance data', 'enforcement', 'enforcement', 'view'),
('enforcement.create', 'Create Checks', 'Create compliance checks', 'enforcement', 'enforcement', 'create'),
('enforcement.update', 'Update Enforcement', 'Update enforcement records', 'enforcement', 'enforcement', 'update'),
('enforcement.manage', 'Manage Enforcement', 'Full enforcement management', 'enforcement', 'enforcement', 'manage'),
('citations.view', 'View Citations', 'View citations', 'enforcement', 'citation', 'view'),
('citations.create', 'Issue Citations', 'Issue new citations', 'enforcement', 'citation', 'create'),
('citations.manage', 'Manage Citations', 'Manage citations and appeals', 'enforcement', 'citation', 'manage'),
('incidents.view', 'View Incidents', 'View incident reports', 'enforcement', 'incident', 'view'),
('incidents.create', 'Report Incidents', 'Create incident reports', 'enforcement', 'incident', 'create'),
('incidents.update', 'Update Incidents', 'Update incident reports', 'enforcement', 'incident', 'update'),

-- Identity permissions
('identity.view', 'View Identities', 'View verified identities', 'identity', 'identity', 'view'),
('identity.verify', 'Verify Identities', 'Verify identity documents', 'identity', 'identity', 'approve'),

-- Permit permissions
('permits.view', 'View Permits', 'View all permits', 'enforcement', 'permit', 'view'),
('permits.view.own', 'View Own Permits', 'View own permits', 'enforcement', 'permit', 'view'),
('permits.apply', 'Apply for Permits', 'Apply for permits', 'enforcement', 'permit', 'create'),
('permits.approve', 'Approve Permits', 'Approve permit applications', 'enforcement', 'permit', 'approve'),

-- Guest permissions
('guests.view', 'View Guests', 'View guest information', 'reservation', 'guest', 'view'),
('guests.update', 'Update Guests', 'Update guest information', 'reservation', 'guest', 'update'),

-- Profile permissions
('profile.view.own', 'View Own Profile', 'View own profile', 'portal', 'profile', 'view'),
('profile.update.own', 'Update Own Profile', 'Update own profile', 'portal', 'profile', 'update'),

-- Report permissions
('reports.view', 'View Reports', 'View reports', 'portal', 'report', 'view'),
('reports.export', 'Export Reports', 'Export report data', 'portal', 'report', 'execute'),

-- Billing permissions
('billing.view', 'View Billing', 'View billing information', 'portal', 'billing', 'view'),
('billing.manage', 'Manage Billing', 'Manage billing settings', 'portal', 'billing', 'manage')

ON CONFLICT (code) DO NOTHING;

COMMIT;
