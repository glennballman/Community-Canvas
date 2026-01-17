/**
 * SCM Ingest: P2 Operator Certification
 * 
 * Converts QA proof artifacts into certification decision outputs.
 * 
 * Input: artifacts/qa/p2-smoke-proof.json
 * Output:
 *   - artifacts/qa/scm/p2-operator-cert.json (machine cert)
 *   - artifacts/qa/scm/p2-operator-cert.md (human cert report)
 * 
 * Rules:
 *   - Never "guess" PASS for skipped modules
 *   - Insurance/Dispute are HELD if steps were skipped due to missing IDs
 *   - Emergency/Legal/Authority/Monetization must PASS for overall PASS
 *   - Exit code 1 on overall FAIL
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

type Status = "PASS" | "HELD" | "FAIL";

interface Step {
  step: string;
  ok: boolean | string;
  [k: string]: unknown;
}

interface Check {
  name: string;
  status: Status;
  detail: string;
}

interface ModuleResult {
  status: Status;
  required: boolean;
  checks: Check[];
}

interface Assertion {
  assert: string;
  pass: boolean;
}

function sha256File(p: string): string {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function isPass(ok: unknown): boolean {
  return ok === true;
}

function isHeld(ok: unknown): boolean {
  return typeof ok === "string" && ok.toLowerCase().includes("skipped");
}

function stepStatus(step: Step | undefined): Status {
  if (!step) return "FAIL";
  if (isPass(step.ok)) return "PASS";
  if (isHeld(step.ok)) return "HELD";
  return "FAIL";
}

function moduleFromSteps(
  steps: Step[],
  required: boolean,
  requiredStepNames: string[]
): ModuleResult {
  const checks: Check[] = requiredStepNames.map((name) => {
    const st = stepStatus(steps.find((s) => s.step === name));
    return { name, status: st, detail: st === "FAIL" ? "Missing or failed step" : "" };
  });

  const statuses: Status[] = checks.map((c) => c.status);
  let status: Status = "PASS";
  if (statuses.includes("FAIL")) status = "FAIL";
  else if (statuses.includes("HELD")) status = "HELD";

  if (!required) {
    const hasFail = statuses.includes("FAIL");
    const hasHeld = statuses.includes("HELD");
    if (!hasFail && hasHeld) status = "HELD";
  }

  return { status, required, checks };
}

function main(): void {
  const proofPath = path.resolve("artifacts/qa/p2-smoke-proof.json");
  if (!fs.existsSync(proofPath)) {
    console.error("Missing proof file:", proofPath);
    process.exit(1);
  }

  const proofSha = sha256File(proofPath);
  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));

  const steps: Step[] = Array.isArray(proof.steps) ? proof.steps : [];
  const assertions: Assertion[] = Array.isArray(proof.assertions) ? proof.assertions : [];
  const ids: Record<string, string> = proof.ids || {};

  const emergency = moduleFromSteps(steps, true, [
    "emergency.start",
    "emergency.exportPlaybook",
    "emergency.generateRecordPack",
    "emergency.shareAuthority",
    "emergency.resolve"
  ]);

  // Authority: required, but may be HELD if share succeeded without returning a grantId
  const authorityBase = moduleFromSteps(steps, true, [
    "authority.getGrant",
    "authority.revokeGrant",
    "authority.getGrantAfterRevoke"
  ]);

  const shareStep = steps.find((s) => s.step === "emergency.shareAuthority");
  const shareStatus = shareStep ? stepStatus(shareStep) : "FAIL";

  // Detect "no grantId returned" situation:
  // - share step passed
  // - proof.ids.emergencyGrantId missing (or empty)
  const hasEmergencyGrantId =
    proof?.ids?.emergencyGrantId && String(proof.ids.emergencyGrantId).trim().length > 0;

  let authority = authorityBase;

  // If share passed but no grantId exists, authority checks can't run → HELD, not FAIL.
  if (shareStatus === "PASS" && !hasEmergencyGrantId) {
    authority = {
      status: "HELD" as Status,
      required: true,
      checks: [
        ...authorityBase.checks.map((c) =>
          c.status === "FAIL"
            ? { ...c, status: "HELD" as Status, detail: "Skipped: share succeeded but no grantId returned" }
            : c
        ),
        {
          name: "authority.grantIdPresent",
          status: "HELD" as Status,
          detail: "No grantId returned from emergency.shareAuthority"
        }
      ]
    };
  }

  const legal = moduleFromSteps(steps, true, [
    "legal.createHold",
    "legal.addTarget",
    "legal.releaseHold"
  ]);

  const insurance = moduleFromSteps(steps, false, [
    "insurance.assembleDossier",
    "insurance.exportDossier",
    "insurance.shareAuthority"
  ]);

  const dispute = moduleFromSteps(steps, false, [
    "dispute.assembleDefensePack",
    "dispute.exportDefensePack",
    "dispute.shareAuthority"
  ]);

  const monetization = moduleFromSteps(steps, true, ["monetization.usage"]);
  const audit = moduleFromSteps(steps, false, ["audit.events"]);

  const failedAssertions = assertions.filter((a) => a && a.pass === false);

  const modules = { emergency, authority, legal, insurance, dispute, monetization, audit };

  const passModules = Object.values(modules).filter((m) => m.status === "PASS").length;
  const heldModules = Object.values(modules).filter((m) => m.status === "HELD").length;
  const failModules = Object.values(modules).filter((m) => m.status === "FAIL").length;

  let overall: Status = "PASS";

  const requiredFail = Object.values(modules).some((m) => m.required && m.status !== "PASS");
  if (requiredFail) overall = "FAIL";
  else if (failModules > 0) overall = "FAIL";
  else if (heldModules > 0) overall = "HELD";
  else overall = "PASS";

  if (failedAssertions.length > 0) overall = "FAIL";

  const cert = {
    cert_version: "1.0.0",
    generated_at: new Date().toISOString(),
    input: {
      proof_path: "artifacts/qa/p2-smoke-proof.json",
      proof_sha256: proofSha,
      base_url: proof.baseUrl || proof.base_url || "",
      started_at: proof.startedAt || proof.started_at || "",
      finished_at: proof.finishedAt || proof.finished_at || ""
    },
    summary: {
      overall_status: overall,
      pass_modules: passModules,
      held_modules: heldModules,
      fail_modules: failModules
    },
    modules,
    evidence: {
      ids,
      steps,
      assertions,
      monetization_snapshot: proof.monetization || {},
      audit_snapshot: proof.audit || {}
    }
  };

  const outDir = path.resolve("artifacts/qa/scm");
  ensureDir(outDir);

  const jsonOut = path.join(outDir, "p2-operator-cert.json");
  fs.writeFileSync(jsonOut, JSON.stringify(cert, null, 2), "utf8");

  const mdLines: string[] = [];
  mdLines.push(`# P2 Operator Certification`);
  mdLines.push(``);
  mdLines.push(`- **Overall**: ${overall}`);
  mdLines.push(`- Proof SHA256: \`${proofSha}\``);
  mdLines.push(`- Started: ${cert.input.started_at}`);
  mdLines.push(`- Finished: ${cert.input.finished_at}`);
  mdLines.push(`- Base URL: ${cert.input.base_url}`);
  mdLines.push(``);
  mdLines.push(`## Module Results`);
  mdLines.push(``);
  mdLines.push(`| Module | Required | Status |`);
  mdLines.push(`|---|---:|---|`);
  for (const [name, mod] of Object.entries(modules)) {
    mdLines.push(`| ${name} | ${mod.required ? "YES" : "NO"} | ${mod.status} |`);
  }
  mdLines.push(``);
  mdLines.push(`## IDs`);
  mdLines.push("```json");
  mdLines.push(JSON.stringify(ids, null, 2));
  mdLines.push("```");
  mdLines.push(``);
  mdLines.push(`## Failed Assertions`);
  if (failedAssertions.length === 0) mdLines.push(`- None`);
  else {
    for (const a of failedAssertions) mdLines.push(`- ${a.assert || "assertion"}: FAIL`);
  }
  mdLines.push(``);
  mdLines.push(`## Checks (details)`);
  for (const [name, mod] of Object.entries(modules)) {
    mdLines.push(`### ${name} (${mod.status})`);
    mdLines.push(``);
    for (const c of mod.checks) {
      mdLines.push(`- ${c.status}: ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    }
    mdLines.push(``);
  }

  fs.writeFileSync(path.join(outDir, "p2-operator-cert.md"), mdLines.join("\n"), "utf8");

  console.log("Wrote SCM cert artifacts to artifacts/qa/scm/");
  console.log(" -", jsonOut);
  console.log(" -", path.join(outDir, "p2-operator-cert.md"));

  if (overall === "FAIL") process.exit(1);
}

main();
