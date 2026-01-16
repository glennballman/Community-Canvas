/**
 * P2.12 Offline Playbook Export
 * Generates downloadable emergency playbook packages for low-signal environments
 */

import { createHash } from 'crypto';
import archiver from 'archiver';
import { Writable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { serviceQuery } from '../../db/tenantDb.js';
import { getTemplateById, getPropertyProfile } from './bindings.js';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'community-canvas-cc_media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 storage is not configured');
    }
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));
  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface PlaybookExportResult {
  r2Key: string;
  url: string;
  playbookSha256: string;
  verificationSha256: string;
}

interface EmergencyRun {
  id: string;
  run_type: string;
  status: string;
  template_id: string | null;
  property_profile_id: string | null;
  coordination_bundle_id: string | null;
  started_at: Date;
  summary: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Export an offline playbook package for an emergency run
 * Creates a ZIP containing playbook.json and verification.json
 */
export async function exportPlaybook(
  tenantId: string,
  runId: string,
  actorIndividualId: string | null
): Promise<PlaybookExportResult> {
  const runResult = await serviceQuery<EmergencyRun>(
    `SELECT id, run_type, status, template_id, property_profile_id,
            coordination_bundle_id, started_at, summary, metadata
     FROM cc_emergency_runs
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, runId]
  );

  if (runResult.rows.length === 0) {
    throw new Error('Emergency run not found');
  }

  const run = runResult.rows[0];

  const template = run.template_id ? await getTemplateById(tenantId, run.template_id) : null;
  const property = run.property_profile_id
    ? await getPropertyProfile(tenantId, run.property_profile_id)
    : null;

  const templateJson = template?.template_json as Record<string, unknown> | undefined;

  const playbook = {
    export_version: '1.0',
    exported_at: new Date().toISOString(),
    run_id: runId,
    run_type: run.run_type,
    status: run.status,
    started_at: run.started_at,
    summary: run.summary,

    template: template
      ? {
          id: template.id,
          type: template.template_type,
          title: template.title,
          version: template.version,
          sections: templateJson?.sections || [],
          checklists: templateJson?.checklists || [],
          contacts: templateJson?.contacts || [],
          maps_coords: templateJson?.maps_coords || [],
          device_instructions: templateJson?.device_instructions || [],
          what_to_do_now: templateJson?.what_to_do_now || [],
        }
      : null,

    property: property
      ? {
          id: property.id,
          label: property.property_label,
          address: property.address,
          coordinates:
            property.lat && property.lon ? { lat: property.lat, lon: property.lon } : null,
          hazard_overrides: property.hazard_overrides,
          emergency_contacts: property.contacts,
          dependencies: property.dependencies,
        }
      : null,

    merged_contacts: mergeContacts(templateJson?.contacts, property?.contacts),
    merged_checklists: mergeChecklists(templateJson?.checklists, property?.hazard_overrides),
  };

  const playbookJson = JSON.stringify(playbook, null, 2);
  const playbookSha256 = sha256Hex(playbookJson);

  const bundleResult = await serviceQuery<{ manifest_sha256: string }>(
    `SELECT manifest_sha256 FROM cc_evidence_bundles WHERE id = $1::uuid`,
    [run.coordination_bundle_id]
  );

  const verification = {
    verification_version: '1.0',
    generated_at: new Date().toISOString(),
    run_id: runId,
    tenant_id: tenantId,
    playbook_sha256: playbookSha256,
    template_sha256: template?.template_sha256 || null,
    coordination_bundle_sha256: bundleResult.rows[0]?.manifest_sha256 || null,
    coordination_bundle_id: run.coordination_bundle_id,
  };

  const verificationJson = JSON.stringify(verification, null, 2);
  const verificationSha256 = sha256Hex(verificationJson);

  const zipBuffer = await createZipBuffer({
    'playbook.json': playbookJson,
    'verification.json': verificationJson,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const r2Key = `emergency/playbooks/${tenantId}/${runId}/${timestamp}.zip`;

  const url = await uploadBuffer(r2Key, zipBuffer, 'application/zip');

  await serviceQuery(
    `INSERT INTO cc_emergency_run_events (tenant_id, run_id, event_type, actor_individual_id, event_payload)
     VALUES ($1::uuid, $2::uuid, 'playbook_exported', $3, $4::jsonb)`,
    [
      tenantId,
      runId,
      actorIndividualId,
      JSON.stringify({
        r2_key: r2Key,
        playbook_sha256: playbookSha256,
        verification_sha256: verificationSha256,
      }),
    ]
  );

  return {
    r2Key,
    url,
    playbookSha256,
    verificationSha256,
  };
}

function mergeContacts(templateContacts: unknown, propertyContacts: unknown): unknown[] {
  const contacts: unknown[] = [];

  if (Array.isArray(templateContacts)) {
    contacts.push(...templateContacts);
  }

  if (propertyContacts && typeof propertyContacts === 'object') {
    const pc = propertyContacts as Record<string, unknown>;
    if (pc.owner) contacts.push({ role: 'owner', ...pc.owner });
    if (pc.operator) contacts.push({ role: 'operator', ...pc.operator });
    if (pc.onsite_lead) contacts.push({ role: 'onsite_lead', ...pc.onsite_lead });
    if (pc.emergency_line) contacts.push({ role: 'emergency_line', phone: pc.emergency_line });
    if (Array.isArray(pc.neighbors)) {
      pc.neighbors.forEach((n, i) => contacts.push({ role: `neighbor_${i + 1}`, ...n }));
    }
  }

  return contacts;
}

function mergeChecklists(templateChecklists: unknown, hazardOverrides: unknown): unknown[] {
  const checklists: unknown[] = [];

  if (Array.isArray(templateChecklists)) {
    checklists.push(...templateChecklists);
  }

  if (hazardOverrides && typeof hazardOverrides === 'object') {
    const ho = hazardOverrides as Record<string, unknown>;
    if (ho.muster_points) {
      checklists.push({
        category: 'property_specific',
        title: 'Muster Points',
        items: Array.isArray(ho.muster_points)
          ? ho.muster_points.map((p) => ({ action: `Go to: ${p}`, priority: 'high' }))
          : [{ action: `Go to: ${ho.muster_points}`, priority: 'high' }],
      });
    }
    if (ho.generator_location) {
      checklists.push({
        category: 'property_specific',
        title: 'Generator',
        items: [{ action: `Generator at: ${ho.generator_location}`, priority: 'medium' }],
      });
    }
  }

  return checklists;
}

async function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', reject);
    writable.on('finish', () => resolve(Buffer.concat(chunks)));

    archive.pipe(writable);

    for (const [name, content] of Object.entries(files)) {
      archive.append(content, { name });
    }

    archive.finalize();
  });
}
