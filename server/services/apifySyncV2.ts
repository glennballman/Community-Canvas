import crypto from "crypto";
import { pool } from "../db";

function md5(input: any) {
  return crypto.createHash("md5").update(JSON.stringify(input)).digest("hex");
}

function getNested(obj: any, path: string) {
  return path.split(".").reduce((cur, key) => (cur == null ? cur : cur[key]), obj);
}

function extractCoordinates(data: any): { lat: number | null; lng: number | null } {
  const formats = [
    { lat: "coordinates.lat", lng: "coordinates.lng" },
    { lat: "coordinates.latitude", lng: "coordinates.longitude" },
    { lat: "location.lat", lng: "location.lng" },
    { lat: "lat", lng: "lng" },
    { lat: "latitude", lng: "longitude" },
    { lat: "geoLocation.lat", lng: "geoLocation.lng" }
  ];

  for (const f of formats) {
    const lat = getNested(data, f.lat);
    const lng = getNested(data, f.lng);
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  return { lat: null, lng: null };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

type DatasetRow = {
  id: string;
  slug: string;
  source: string;
  record_type: string;
  region?: string | null;
};

export async function upsertExternalRecord(args: {
  dataset: DatasetRow;
  record: any;
}): Promise<"inserted" | "updated" | "skipped"> {
  const { dataset, record } = args;

  const externalId = String(
    record.id || record.listingId || record.roomId || record.productId || record.sku || ""
  ).trim();
  if (!externalId) return "skipped";

  const hash = md5(record);
  const coords = extractCoordinates(record);

  const name = String(record.title || record.name || record.productName || "Unknown").slice(0, 500);
  const description = String(record.description || "").slice(0, 20000);

  const city = String(record.location?.city || record.city || record.address?.city || "").slice(0, 200);
  const region = String(record.location?.region || record.region || dataset.region || "").slice(0, 200);
  const url = String(record.url || record.listingUrl || record.productUrl || "").slice(0, 2000);
  const address = String(record.address?.full || record.address || "").slice(0, 500);

  const existing = await pool.query(
    `SELECT id, sync_hash FROM external_records WHERE source = $1::external_source AND external_id = $2`,
    [dataset.source, externalId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.sync_hash === hash) {
      await pool.query(`UPDATE external_records SET last_seen_at = NOW() WHERE id = $1`, [row.id]);
      return "skipped";
    }

    await pool.query(
      `
      UPDATE external_records SET
        dataset_id = $1,
        record_type = $2::external_record_type,
        name = $3,
        description = $4,
        external_url = $5,
        latitude = $6,
        longitude = $7,
        city = $8,
        region = $9,
        address = $10,
        community_id = resolve_community($6, $7, $8, $9),
        raw_data = $11,
        sync_hash = $12,
        last_seen_at = NOW(),
        last_changed_at = NOW(),
        updated_at = NOW()
      WHERE source = $13::external_source AND external_id = $14
      `,
      [
        dataset.id,
        dataset.record_type,
        name,
        description,
        url,
        coords.lat,
        coords.lng,
        city,
        region,
        address,
        JSON.stringify(record),
        hash,
        dataset.source,
        externalId
      ]
    );

    await upsertContactPointsFromRecord(row.id, record);
    return "updated";
  }

  const inserted = await pool.query(
    `
    INSERT INTO external_records (
      dataset_id, source, record_type,
      external_id, external_url,
      name, description, address,
      latitude, longitude, city, region, country,
      community_id, raw_data, sync_hash, pii_risk, do_not_contact
    ) VALUES (
      $1, $2::external_source, $3::external_record_type,
      $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12, 'Canada',
      resolve_community($9, $10, $11, $12),
      $13, $14, 'unknown', false
    )
    RETURNING id
    `,
    [
      dataset.id,
      dataset.source,
      dataset.record_type,
      externalId,
      url,
      name,
      description,
      address,
      coords.lat,
      coords.lng,
      city,
      region,
      JSON.stringify(record),
      hash
    ]
  );

  const externalRecordId = inserted.rows[0].id;
  await upsertContactPointsFromRecord(externalRecordId, record);

  return "inserted";
}

async function upsertContactPointsFromRecord(externalRecordId: string, record: any) {
  const emails: string[] = [];
  const phones: string[] = [];

  const maybeEmail =
    record.email ||
    record.host?.email ||
    record.contactEmail ||
    record.contact?.email ||
    null;

  const maybePhone =
    record.phone ||
    record.host?.phone ||
    record.contactPhone ||
    record.contact?.phone ||
    null;

  if (typeof maybeEmail === "string" && maybeEmail.includes("@")) emails.push(maybeEmail);
  if (typeof maybePhone === "string" && maybePhone.length >= 7) phones.push(maybePhone);

  for (const e of emails) {
    const norm = normalizeEmail(e);
    await pool.query(
      `
      INSERT INTO external_contact_points (
        external_record_id, contact_type, contact_value, normalized_value,
        is_verified, consent, do_not_contact, is_primary
      ) VALUES ($1, 'email'::contact_type, $2, $3, false, 'unknown'::consent_basis, true, false)
      ON CONFLICT (contact_type, normalized_value) DO NOTHING
      `,
      [externalRecordId, e, norm]
    );
  }

  for (const p of phones) {
    const norm = normalizePhone(p);
    await pool.query(
      `
      INSERT INTO external_contact_points (
        external_record_id, contact_type, contact_value, normalized_value,
        is_verified, consent, do_not_contact, is_primary
      ) VALUES ($1, 'phone'::contact_type, $2, $3, false, 'unknown'::consent_basis, true, false)
      ON CONFLICT (contact_type, normalized_value) DO NOTHING
      `,
      [externalRecordId, p, norm]
    );
  }
}

export async function syncDataset(datasetSlug: string, records: any[]): Promise<{
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errored: number;
}> {
  const datasetResult = await pool.query(
    `SELECT id, slug, source::text, record_type::text, region FROM apify_datasets WHERE slug = $1`,
    [datasetSlug]
  );

  if (datasetResult.rows.length === 0) {
    throw new Error(`Dataset not found: ${datasetSlug}`);
  }

  const dataset = datasetResult.rows[0] as DatasetRow;

  const historyResult = await pool.query(
    `INSERT INTO apify_sync_history (dataset_id, triggered_by) VALUES ($1, 'api') RETURNING id`,
    [dataset.id]
  );
  const historyId = historyResult.rows[0].id;

  let inserted = 0, updated = 0, skipped = 0, errored = 0;
  const startTime = Date.now();

  for (const record of records) {
    try {
      const result = await upsertExternalRecord({ dataset, record });
      if (result === "inserted") inserted++;
      else if (result === "updated") updated++;
      else skipped++;
    } catch (err) {
      console.error("Error upserting record:", err);
      errored++;
    }
  }

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  await pool.query(
    `
    UPDATE apify_sync_history SET
      status = 'completed',
      completed_at = NOW(),
      records_processed = $1,
      records_inserted = $2,
      records_updated = $3,
      records_skipped = $4,
      records_errored = $5,
      duration_seconds = $6
    WHERE id = $7
    `,
    [records.length, inserted, updated, skipped, errored, durationSeconds, historyId]
  );

  await pool.query(
    `UPDATE apify_datasets SET last_sync_at = NOW(), last_sync_record_count = $1 WHERE id = $2`,
    [records.length, dataset.id]
  );

  return { processed: records.length, inserted, updated, skipped, errored };
}
