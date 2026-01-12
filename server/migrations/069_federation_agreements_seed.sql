-- V3.3.1 Block 06: Federation Agreements + Cross-Tenant Access
-- Enable "Bamfield as one resort" by allowing Chamber to search and book across all federated providers

-- ============================================================================
-- CREATE BAMFIELD CHAMBER TENANT
-- ============================================================================

-- Using valid UUID format (hex only)
INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
VALUES (
  'ca000000-0000-0000-0000-000000000001',
  'Bamfield Chamber of Commerce',
  'bamfield-chamber',
  'business',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED FEDERATION AGREEMENTS
-- ============================================================================

-- Tenant UUIDs:
-- BAMFIELD_COMMUNITY: c0000000-0000-0000-0000-000000000001
-- BAMFIELD_CHAMBER: ca000000-0000-0000-0000-000000000001
-- WOODS_END_LANDING: d0000000-0000-0000-0000-000000000001
-- WOODS_END_MARINA: ff08964d-94b5-4076-850c-2d002e3fd337
-- SAVE_PARADISE_PARKING: 7d8e6df5-bf12-4965-85a9-20b4312ce6c8
-- HFN_MARINA: 00000000-0000-0000-0001-000000000001
-- EILEEN_SCOTT_PARK: 00000000-0000-0000-0002-000000000001

-- Woods End Landing → Chamber
INSERT INTO cc_federation_agreements (
  provider_tenant_id, community_id, consumer_tenant_id, scopes, status
)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'ca000000-0000-0000-0000-000000000001',
  ARRAY['availability:read', 'reservation:create', 'reservation:read'],
  'active'
)
ON CONFLICT DO NOTHING;

-- Woods End Marina → Chamber
INSERT INTO cc_federation_agreements (
  provider_tenant_id, community_id, consumer_tenant_id, scopes, status
)
VALUES (
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  'c0000000-0000-0000-0000-000000000001',
  'ca000000-0000-0000-0000-000000000001',
  ARRAY['availability:read', 'reservation:create', 'reservation:read'],
  'active'
)
ON CONFLICT DO NOTHING;

-- Save Paradise Parking → Chamber (includes incident scopes)
INSERT INTO cc_federation_agreements (
  provider_tenant_id, community_id, consumer_tenant_id, scopes, status
)
VALUES (
  '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
  'c0000000-0000-0000-0000-000000000001',
  'ca000000-0000-0000-0000-000000000001',
  ARRAY['availability:read', 'reservation:create', 'reservation:read', 'incident:create', 'incident:dispatch'],
  'active'
)
ON CONFLICT DO NOTHING;

-- HFN Marina → Chamber
INSERT INTO cc_federation_agreements (
  provider_tenant_id, community_id, consumer_tenant_id, scopes, status
)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'ca000000-0000-0000-0000-000000000001',
  ARRAY['availability:read', 'reservation:create', 'reservation:read'],
  'active'
)
ON CONFLICT DO NOTHING;

-- Eileen Scott Park → Chamber (includes incident scopes)
INSERT INTO cc_federation_agreements (
  provider_tenant_id, community_id, consumer_tenant_id, scopes, status
)
VALUES (
  '00000000-0000-0000-0002-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'ca000000-0000-0000-0000-000000000001',
  ARRAY['availability:read', 'reservation:create', 'incident:create', 'incident:dispatch'],
  'active'
)
ON CONFLICT DO NOTHING;
