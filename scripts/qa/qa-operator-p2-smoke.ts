/**
 * QA Operator P2 Smoke Test
 * 
 * Certifies the P2 Operator Spine by running end-to-end tests:
 * - Emergency Run (start, grant, export, record pack, share authority, revoke, resolve)
 * - Legal Hold (create, target, release)
 * - Insurance (optional, if QA_CLAIM_ID provided)
 * - Dispute (optional, if QA_DISPUTE_ID provided)
 * - Audit events verification
 * - Monetization events verification
 * 
 * Outputs:
 * - artifacts/qa/p2-smoke-proof.json (machine-readable)
 * - artifacts/qa/p2-smoke-proof.md (human-readable report)
 * 
 * Auth: Provide QA_JWT or QA_COOKIE env var
 */

import fs from "fs";
import path from "path";
import { writeProofArtifacts, type ProofData } from "./qa-proof-writer";

type P2Ok<T extends object> = { ok: true } & T;
type P2Err = { ok: false; error: string };
type P2Resp<T extends object> = P2Ok<T> | P2Err;

interface StepResult {
  step: string;
  ok: boolean | string;
  [key: string]: unknown;
}

const BASE = process.env.QA_BASE_URL || "http://localhost:5000";
const JWT = process.env.QA_JWT;
const COOKIE = process.env.QA_COOKIE;

const CLAIM_ID = process.env.QA_CLAIM_ID;
const DISPUTE_ID = process.env.QA_DISPUTE_ID;
const GRANTEE_ID = process.env.QA_GRANTEE_INDIVIDUAL_ID;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function p2<T extends object>(method: string, urlPath: string, body?: unknown): Promise<P2Ok<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (JWT) headers["Authorization"] = `Bearer ${JWT}`;
  if (COOKIE) headers["Cookie"] = COOKIE;

  const url = `${BASE}${urlPath}`;
  console.log(`  ${method} ${urlPath}`);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as P2Resp<T>;
  assert(json && typeof (json as { ok?: unknown }).ok === "boolean", `Invalid response envelope from ${urlPath}`);
  if (json.ok === false) throw new Error(`${urlPath} failed: ${json.error}`);
  return json;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureArtifactsDir(): string {
  const dir = path.resolve("artifacts/qa");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function main() {
  console.log("=== P2 Operator Smoke Test ===\n");

  assert(JWT || COOKIE, "Provide QA_JWT or QA_COOKIE env var");
  const artifactsDir = ensureArtifactsDir();

  const proof: ProofData = {
    startedAt: nowIso(),
    baseUrl: BASE,
    steps: [],
    ids: {},
    assertions: [],
    monetization: {},
    audit: {},
  };

  try {
    // ========================================
    // EMERGENCY RUN SPINE
    // ========================================
    console.log("\n[1] Emergency Run Spine");

    // Start run
    const start = await p2<{ runId: string }>(
      "POST",
      "/api/operator/p2/emergency/runs/start",
      { runType: "storm", summary: "QA smoke test run" }
    );
    proof.steps.push({ step: "emergency.start", ok: true, runId: start.runId });
    proof.ids.runId = start.runId;
    console.log(`    Created run: ${start.runId}`);

    // Grant scope (optional - needs grantee ID)
    if (GRANTEE_ID) {
      try {
        await p2(
          "POST",
          `/api/operator/p2/emergency/runs/${start.runId}/grants`,
          {
            granteeIndividualId: GRANTEE_ID,
            grantType: "tool_access",
            scopeJson: { note: "qa" },
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          }
        );
        proof.steps.push({ step: "emergency.grantScope", ok: true });
      } catch (e: unknown) {
        proof.steps.push({ step: "emergency.grantScope", ok: "failed", error: String(e) });
      }
    } else {
      proof.steps.push({ step: "emergency.grantScope", ok: "skipped_missing_QA_GRANTEE_INDIVIDUAL_ID" });
    }

    // Export playbook
    try {
      await p2("POST", `/api/operator/p2/emergency/runs/${start.runId}/export-playbook`, { format: "zip_json" });
      proof.steps.push({ step: "emergency.exportPlaybook", ok: true });
    } catch (e: unknown) {
      proof.steps.push({ step: "emergency.exportPlaybook", ok: "failed", error: String(e) });
    }

    // Generate record pack
    try {
      await p2("POST", `/api/operator/p2/emergency/runs/${start.runId}/generate-record-pack`, { sealBundle: true });
      proof.steps.push({ step: "emergency.generateRecordPack", ok: true });
    } catch (e: unknown) {
      proof.steps.push({ step: "emergency.generateRecordPack", ok: "failed", error: String(e) });
    }

    // Share authority
    let emergencyGrantId: string | undefined;
    try {
      const share = await p2<{ grantId?: string; accessUrl?: string; expiresAt?: string }>(
        "POST",
        `/api/operator/p2/emergency/runs/${start.runId}/share-authority`,
        { scope: "run_only", returnGrantId: true }
      );
      proof.steps.push({ step: "emergency.shareAuthority", ok: true, grantId: share.grantId, accessUrl: share.accessUrl });
      emergencyGrantId = share.grantId;
      if (emergencyGrantId) proof.ids.emergencyGrantId = emergencyGrantId;
    } catch (e: unknown) {
      proof.steps.push({ step: "emergency.shareAuthority", ok: "failed", error: String(e) });
    }

    // Grant fetch + revoke (if grantId returned)
    if (emergencyGrantId) {
      try {
        const g1 = await p2<{ status: string; scopes: unknown }>(
          "GET",
          `/api/operator/p2/authority/grants/${emergencyGrantId}`
        );
        proof.steps.push({ step: "authority.getGrant", ok: true, status: g1.status, scopes: g1.scopes });

        await p2("POST", `/api/operator/p2/authority/grants/${emergencyGrantId}/revoke`, {
          reason: "QA smoke test revoke",
        });
        proof.steps.push({ step: "authority.revokeGrant", ok: true });

        const g2 = await p2<{ status: string }>(
          "GET",
          `/api/operator/p2/authority/grants/${emergencyGrantId}`
        );
        proof.steps.push({ step: "authority.getGrantAfterRevoke", ok: true, status: g2.status });
        proof.assertions.push({
          assert: "grant_status_revoked",
          pass: String(g2.status).toLowerCase().includes("revok"),
        });
      } catch (e: unknown) {
        proof.steps.push({ step: "authority.revoke", ok: "failed", error: String(e) });
      }
    } else {
      proof.steps.push({ step: "authority.revoke", ok: "skipped_no_grantId_returned" });
    }

    // Resolve run
    try {
      await p2("POST", `/api/operator/p2/emergency/runs/${start.runId}/resolve`, { summary: "QA resolved" });
      proof.steps.push({ step: "emergency.resolve", ok: true });
    } catch (e: unknown) {
      proof.steps.push({ step: "emergency.resolve", ok: "failed", error: String(e) });
    }

    // ========================================
    // LEGAL HOLD SPINE
    // ========================================
    console.log("\n[2] Legal Hold Spine");

    let holdId: string | undefined;
    try {
      const hold = await p2<{ holdId: string }>("POST", "/api/operator/p2/legal/holds", {
        holdType: "regulatory",
        title: "QA hold",
        reason: "QA smoke test",
      });
      holdId = hold.holdId;
      proof.steps.push({ step: "legal.createHold", ok: true, holdId: hold.holdId });
      proof.ids.holdId = hold.holdId;
      console.log(`    Created hold: ${hold.holdId}`);

      // Add target
      await p2("POST", `/api/operator/p2/legal/holds/${hold.holdId}/targets`, {
        targetType: "emergency_run",
        targetId: start.runId,
        note: "QA links run to hold",
      });
      proof.steps.push({ step: "legal.addTarget", ok: true });

      // Release hold
      await p2("POST", `/api/operator/p2/legal/holds/${hold.holdId}/release`, { reason: "QA release" });
      proof.steps.push({ step: "legal.releaseHold", ok: true });
    } catch (e: unknown) {
      proof.steps.push({ step: "legal.spine", ok: "failed", error: String(e) });
    }

    // ========================================
    // INSURANCE SPINE (optional)
    // ========================================
    console.log("\n[3] Insurance Spine");

    if (CLAIM_ID) {
      try {
        const dos = await p2<{ dossierId: string }>(
          "POST",
          `/api/operator/p2/insurance/claims/${CLAIM_ID}/assemble`,
          {}
        );
        proof.ids.dossierId = dos.dossierId;
        proof.steps.push({ step: "insurance.assembleDossier", ok: true, dossierId: dos.dossierId });
        console.log(`    Assembled dossier: ${dos.dossierId}`);

        await p2("POST", `/api/operator/p2/insurance/dossiers/${dos.dossierId}/export`, { format: "zip_json" });
        proof.steps.push({ step: "insurance.exportDossier", ok: true });

        const s = await p2<{ grantId?: string }>(
          "POST",
          `/api/operator/p2/insurance/dossiers/${dos.dossierId}/share-authority`,
          { scope: "dossier_only" }
        );
        proof.steps.push({ step: "insurance.shareAuthority", ok: true, grantId: s.grantId });
      } catch (e: unknown) {
        proof.steps.push({ step: "insurance", ok: "failed", error: String(e) });
      }
    } else {
      proof.steps.push({ step: "insurance", ok: "skipped_missing_QA_CLAIM_ID" });
      console.log("    Skipped (no QA_CLAIM_ID)");
    }

    // ========================================
    // DISPUTE SPINE (optional)
    // ========================================
    console.log("\n[4] Dispute Spine");

    if (DISPUTE_ID) {
      try {
        const pack = await p2<{ defensePackId: string }>(
          "POST",
          `/api/operator/p2/disputes/${DISPUTE_ID}/assemble-defense-pack`,
          {}
        );
        proof.ids.defensePackId = pack.defensePackId;
        proof.steps.push({
          step: "dispute.assembleDefensePack",
          ok: true,
          defensePackId: pack.defensePackId,
        });
        console.log(`    Assembled defense pack: ${pack.defensePackId}`);

        await p2("POST", `/api/operator/p2/defense-packs/${pack.defensePackId}/export`, { format: "zip_json" });
        proof.steps.push({ step: "dispute.exportDefensePack", ok: true });

        const s = await p2<{ grantId?: string }>(
          "POST",
          `/api/operator/p2/defense-packs/${pack.defensePackId}/share-authority`,
          { scope: "defense_pack_only" }
        );
        proof.steps.push({ step: "dispute.shareAuthority", ok: true, grantId: s.grantId });
      } catch (e: unknown) {
        proof.steps.push({ step: "dispute", ok: "failed", error: String(e) });
      }
    } else {
      proof.steps.push({ step: "dispute", ok: "skipped_missing_QA_DISPUTE_ID" });
      console.log("    Skipped (no QA_DISPUTE_ID)");
    }

    // ========================================
    // MONETIZATION USAGE SNAPSHOT
    // ========================================
    console.log("\n[5] Monetization Usage");

    try {
      const period = new Date().toISOString().slice(0, 7);
      const usage = await p2<{ period: string; counts: Array<{ eventType: string; count: number }> }>(
        "GET",
        `/api/operator/p2/monetization/usage?period=${period}&includeDrills=0`
      );
      proof.monetization = usage;
      proof.steps.push({
        step: "monetization.usage",
        ok: true,
        period: usage.period,
        countRows: usage.counts.length,
      });
      console.log(`    Period: ${usage.period}, Event types: ${usage.counts.length}`);
    } catch (e: unknown) {
      proof.steps.push({ step: "monetization.usage", ok: "failed", error: String(e) });
    }

    // ========================================
    // AUDIT EVENTS SNAPSHOT
    // ========================================
    console.log("\n[6] Audit Events");

    try {
      const audit = await p2<{ events: unknown[] }>("GET", `/api/operator/p2/audit/events?limit=200`);
      proof.audit = audit;
      proof.steps.push({ step: "audit.events", ok: true, count: (audit.events || []).length });
      console.log(`    Retrieved ${(audit.events || []).length} audit events`);
    } catch (e: unknown) {
      proof.steps.push({ step: "audit.events", ok: "failed", error: String(e) });
    }

  } catch (e: unknown) {
    console.error("\nFatal error:", e);
    proof.steps.push({ step: "fatal", ok: false, error: String(e) });
  }

  proof.finishedAt = nowIso();

  // Write artifacts
  writeProofArtifacts(artifactsDir, proof);

  // Summary
  const passed = proof.steps.filter((s) => s.ok === true).length;
  const failed = proof.steps.filter((s) => s.ok === false || s.ok === "failed").length;
  const skipped = proof.steps.filter(
    (s) => typeof s.ok === "string" && s.ok.startsWith("skipped")
  ).length;

  console.log("\n=== SUMMARY ===");
  console.log(`Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`);
  console.log(`Artifacts: ${artifactsDir}/p2-smoke-proof.{json,md}`);

  if (failed > 0) {
    console.log("\nFailed steps:");
    proof.steps
      .filter((s) => s.ok === false || s.ok === "failed")
      .forEach((s) => console.log(`  - ${s.step}: ${s.error || "unknown error"}`));
    process.exit(1);
  }

  console.log("\n✅ P2 Operator Smoke Test PASSED");
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
