/**
 * P2.12 Template & Property Binding
 * Creates sealed evidence bundles when binding templates/properties to runs
 */

import { createHash } from 'crypto';
import { serviceQuery } from '../../db/tenantDb.js';

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalizeJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

export interface TemplateSnapshot {
  id: string;
  template_type: string;
  title: string;
  version: number;
  template_json: unknown;
  template_sha256: string;
}

export interface PropertySnapshot {
  id: string;
  property_label: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  hazard_overrides: unknown;
  contacts: unknown;
  dependencies: unknown;
}

export interface BindingResult {
  bundleId: string;
  manifestSha256: string;
}

/**
 * Get active template by type (latest active version)
 */
export async function getActiveTemplate(
  tenantId: string,
  templateType: string
): Promise<TemplateSnapshot | null> {
  const result = await serviceQuery<TemplateSnapshot>(
    `SELECT id, template_type, title, version, template_json, template_sha256
     FROM cc_emergency_templates
     WHERE tenant_id = $1::uuid AND template_type = $2 AND status = 'active'
     ORDER BY version DESC LIMIT 1`,
    [tenantId, templateType]
  );

  return result.rows[0] || null;
}

/**
 * Get template by ID
 */
export async function getTemplateById(
  tenantId: string,
  templateId: string
): Promise<TemplateSnapshot | null> {
  const result = await serviceQuery<TemplateSnapshot>(
    `SELECT id, template_type, title, version, template_json, template_sha256
     FROM cc_emergency_templates
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, templateId]
  );

  return result.rows[0] || null;
}

/**
 * Get property profile by ID
 */
export async function getPropertyProfile(
  tenantId: string,
  profileId: string
): Promise<PropertySnapshot | null> {
  const result = await serviceQuery<PropertySnapshot>(
    `SELECT id, property_label, address, lat, lon, hazard_overrides, contacts, dependencies
     FROM cc_property_emergency_profiles
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, profileId]
  );

  return result.rows[0] || null;
}

/**
 * Create a sealed coordination bundle containing template and property snapshots
 * This establishes legal defensibility: "this is what we told people at the time"
 */
export async function createCoordinationBundle(
  tenantId: string,
  runId: string,
  runType: string,
  template: TemplateSnapshot | null,
  property: PropertySnapshot | null,
  summary: string | null
): Promise<BindingResult> {
  const now = new Date();

  const manifest = {
    algorithm_version: 'emergency_coordination_v1',
    run_id: runId,
    run_type: runType,
    created_at: now.toISOString(),
    summary,
    template_snapshot: template
      ? {
          id: template.id,
          template_type: template.template_type,
          title: template.title,
          version: template.version,
          template_sha256: template.template_sha256,
          template_json: template.template_json,
        }
      : null,
    property_snapshot: property
      ? {
          id: property.id,
          property_label: property.property_label,
          address: property.address,
          coordinates: property.lat && property.lon ? { lat: property.lat, lon: property.lon } : null,
          hazard_overrides: property.hazard_overrides,
          contacts: property.contacts,
          dependencies: property.dependencies,
        }
      : null,
  };

  const manifestSha256 = sha256Hex(canonicalizeJson(manifest));

  const result = await serviceQuery<{ id: string }>(
    `INSERT INTO cc_evidence_bundles (
       tenant_id, bundle_type, title,
       bundle_status, manifest_json, manifest_sha256, sealed_at
     )
     VALUES ($1::uuid, 'emergency_coordination', $2,
             'sealed', $3::jsonb, $4, $5)
     RETURNING id`,
    [
      tenantId,
      `Emergency Coordination: ${runType} - ${now.toISOString().split('T')[0]}`,
      JSON.stringify(manifest),
      manifestSha256,
      now.toISOString(),
    ]
  );

  return {
    bundleId: result.rows[0].id,
    manifestSha256,
  };
}

/**
 * Bind template to run - logs event
 */
export async function bindTemplateToRun(
  tenantId: string,
  runId: string,
  templateId: string,
  actorIndividualId: string | null
): Promise<void> {
  await serviceQuery(
    `UPDATE cc_emergency_runs SET template_id = $3::uuid WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, runId, templateId]
  );

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'template_bound', $3, $4::jsonb)`,
    [tenantId, runId, actorIndividualId, JSON.stringify({ template_id: templateId })]
  );
}

/**
 * Bind property profile to run - logs event
 */
export async function bindPropertyToRun(
  tenantId: string,
  runId: string,
  propertyProfileId: string,
  actorIndividualId: string | null
): Promise<void> {
  await serviceQuery(
    `UPDATE cc_emergency_runs SET property_profile_id = $3::uuid WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, runId, propertyProfileId]
  );

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'property_bound', $3, $4::jsonb)`,
    [tenantId, runId, actorIndividualId, JSON.stringify({ property_profile_id: propertyProfileId })]
  );
}
