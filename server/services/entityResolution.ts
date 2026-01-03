import { pool } from "../db";

function jaccardTokens(a: string, b: string): number {
  const tokensA = a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const tokensB = b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  
  const setB = new Set(tokensB);
  const intersection = tokensA.filter(x => setB.has(x)).length;
  const unionSet = new Set(tokensA.concat(tokensB));
  const unionSize = unionSet.size;
  
  return intersection / unionSize;
}

export async function proposeLinksForExternalRecord(externalRecordId: string): Promise<number> {
  const r = await pool.query(
    `SELECT id, name, geom, community_id, source::text, record_type::text FROM external_records WHERE id = $1`,
    [externalRecordId]
  );
  if (r.rows.length === 0) return 0;

  const rec = r.rows[0];
  const name = String(rec.name || "");
  let linksCreated = 0;

  const candidates = await pool.query(
    `
    SELECT id, name, geom, community_id
    FROM entities
    WHERE
      ( $1::uuid IS NOT NULL AND community_id = $1 )
      OR ( $2::geography IS NOT NULL AND geom IS NOT NULL AND ST_DWithin(geom, $2::geography, 5000) )
    LIMIT 200
    `,
    [rec.community_id, rec.geom]
  );

  for (const e of candidates.rows) {
    const sim = jaccardTokens(name, e.name || "");
    if (sim < 0.35) continue;

    const confidence = Math.min(1, 0.6 * sim + 0.4 * 0.7);

    const reasons = {
      name_jaccard: Math.round(sim * 100) / 100,
      geo_hint: rec.geom ? 0.7 : 0.2,
      rule: "v1_geo_name"
    };

    await pool.query(
      `
      INSERT INTO entity_links (external_record_id, entity_id, status, confidence, reasons, resolver_version)
      VALUES ($1, $2, 'suggested'::link_status, $3, $4, 'v1')
      ON CONFLICT (external_record_id, entity_id) DO UPDATE SET
        confidence = GREATEST(entity_links.confidence, EXCLUDED.confidence),
        reasons = EXCLUDED.reasons,
        resolver_version = EXCLUDED.resolver_version
      `,
      [externalRecordId, e.id, confidence, JSON.stringify(reasons)]
    );
    linksCreated++;
  }

  return linksCreated;
}

export async function createEntityFromRecord(externalRecordId: string, entityType: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT id, name, description, address, city, region, country, latitude, longitude, community_id
     FROM external_records WHERE id = $1`,
    [externalRecordId]
  );
  if (r.rows.length === 0) return null;

  const rec = r.rows[0];

  const entityResult = await pool.query(
    `
    INSERT INTO entities (
      entity_type_id, name, description, address_line1, city, province, country,
      latitude, longitude, community_id, visibility
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'private'
    )
    RETURNING id
    `,
    [
      entityType,
      rec.name,
      rec.description,
      rec.address,
      rec.city,
      rec.region || 'BC',
      rec.country,
      rec.latitude,
      rec.longitude,
      rec.community_id
    ]
  );

  const entityId = entityResult.rows[0].id;

  await pool.query(
    `
    INSERT INTO entity_links (external_record_id, entity_id, status, confidence, reasons, resolver_version)
    VALUES ($1, $2, 'accepted'::link_status, 1.0, '{"rule":"auto_create"}'::jsonb, 'v1')
    ON CONFLICT (external_record_id, entity_id) DO UPDATE SET
      status = 'accepted',
      confidence = 1.0,
      decided_at = NOW()
    `,
    [externalRecordId, entityId]
  );

  return entityId;
}

export async function acceptLink(linkId: string, decidedBy?: string): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE entity_links SET
      status = 'accepted'::link_status,
      decided_at = NOW(),
      decided_by = $2
    WHERE id = $1 AND status = 'suggested'
    RETURNING id
    `,
    [linkId, decidedBy || null]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function rejectLink(linkId: string, decidedBy?: string): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE entity_links SET
      status = 'rejected'::link_status,
      decided_at = NOW(),
      decided_by = $2
    WHERE id = $1 AND status = 'suggested'
    RETURNING id
    `,
    [linkId, decidedBy || null]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function runResolutionBatch(limit: number = 100): Promise<{ processed: number; linksCreated: number }> {
  const records = await pool.query(
    `
    SELECT r.id FROM external_records r
    LEFT JOIN entity_links l ON l.external_record_id = r.id
    WHERE l.id IS NULL
    ORDER BY r.created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  let processed = 0;
  let linksCreated = 0;

  for (const row of records.rows) {
    const created = await proposeLinksForExternalRecord(row.id);
    linksCreated += created;
    processed++;
  }

  return { processed, linksCreated };
}
