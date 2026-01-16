#!/usr/bin/env tsx
/**
 * P2.16 Certification Decision Report Generator
 * Generates machine-readable (JSON) and human-readable (MD) certification reports
 * 
 * Usage: npx tsx scripts/scm-generate-cert-decision-report.ts
 * 
 * Outputs:
 *   docs/CERT_DECISION_P2_EMERGENCY_LEGAL_INSURANCE.md
 *   docs/CERT_DECISION_P2_EMERGENCY_LEGAL_INSURANCE.json
 */

import { db } from "../server/db";
import { eq, desc } from "drizzle-orm";
import {
  scmModules,
  scmProofRuns,
  scmModuleOverrides,
  scmCertificationStates,
} from "../shared/schema";
import * as fs from "fs";
import * as path from "path";

interface CertDecisionReportModule {
  moduleKey: string;
  title: string;
  built: boolean;
  certifiable: boolean;
  certified: boolean;
  held: boolean;
  effectiveState: string;
  proofs: {
    lastQaStatusRunId: string | null;
    lastQaStatusRunAt: string | null;
    lastQaStatusOk: boolean | null;
    lastSmokeTestRunId: string | null;
    lastSmokeTestRunAt: string | null;
    lastSmokeTestOk: boolean | null;
    docsPresent: boolean;
    missingDocs: string[];
  };
  recommendedAction: "CERTIFY_NOW" | "HOLD" | "BLOCKED";
  blockReason?: string;
}

interface CertDecisionReport {
  generatedAt: string;
  category: string;
  modules: CertDecisionReportModule[];
  summary: {
    total: number;
    built: number;
    certifiable: number;
    certified: number;
    held: number;
    blocked: number;
  };
}

async function getLatestProofRun(runType: string) {
  const [run] = await db
    .select()
    .from(scmProofRuns)
    .where(eq(scmProofRuns.runType, runType))
    .orderBy(desc(scmProofRuns.runAt))
    .limit(1);
  return run;
}

function checkDocsPresent(policy: any): { present: boolean; missing: string[] } {
  const docs = policy?.proof_artifacts?.docs || [];
  const missing: string[] = [];

  for (const docPath of docs) {
    const fullPath = path.join(process.cwd(), docPath);
    if (!fs.existsSync(fullPath)) {
      missing.push(docPath);
    }
  }

  return { present: missing.length === 0, missing };
}

async function generateReport(): Promise<CertDecisionReport> {
  console.log("Fetching SCM modules and certification states...");
  
  const modules = await db
    .select()
    .from(scmModules)
    .where(eq(scmModules.category, "emergency_legal_insurance"))
    .orderBy(scmModules.moduleKey);

  const states = await db
    .select()
    .from(scmCertificationStates)
    .orderBy(scmCertificationStates.moduleKey);
  const statesMap = new Map(states.map(s => [s.moduleKey, s]));

  const latestQaStatus = await getLatestProofRun("qa_status");
  const latestSmokeTest = await getLatestProofRun("smoke_test");

  console.log(`Found ${modules.length} modules`);
  console.log(`Found ${states.length} certification states`);
  console.log(`Latest QA status run: ${latestQaStatus?.id || "none"} (ok: ${latestQaStatus?.ok})`);
  console.log(`Latest smoke test run: ${latestSmokeTest?.id || "none"} (ok: ${latestSmokeTest?.ok})`);

  const reportModules: CertDecisionReportModule[] = [];
  const safetyCriticalModules = ["P2.5_EVIDENCE_CUSTODY", "P2.7_LEGAL_HOLDS", "P2.9_AUTHORITY_PORTAL"];

  for (const module of modules) {
    const state = statesMap.get(module.moduleKey);
    const { present: docsPresent, missing: missingDocs } = checkDocsPresent(module.certificationPolicy);

    const isBuilt = state?.isBuilt ?? true;
    const isCertifiable = state?.isCertifiable ?? false;
    const isCertified = state?.isCertified ?? false;
    const isHeld = state?.isHeld ?? false;
    const effectiveState = state?.effectiveState ?? "built";

    let recommendedAction: "CERTIFY_NOW" | "HOLD" | "BLOCKED";
    let blockReason: string | undefined;

    if (!isCertifiable) {
      recommendedAction = "BLOCKED";
      const reasons: string[] = [];
      if (!state?.lastQaStatusOk) {
        reasons.push("QA status check failed or missing");
      }
      if (!state?.lastSmokeTestOk) {
        reasons.push("Smoke test failed or missing");
      }
      if (!docsPresent) {
        reasons.push(`Missing docs: ${missingDocs.join(", ")}`);
      }
      if (!isBuilt) {
        reasons.push("Required tables not found");
      }
      blockReason = reasons.join("; ");
    } else if (isCertified) {
      recommendedAction = "CERTIFY_NOW";
    } else if (safetyCriticalModules.includes(module.moduleKey)) {
      recommendedAction = "CERTIFY_NOW";
    } else {
      recommendedAction = "HOLD";
    }

    reportModules.push({
      moduleKey: module.moduleKey,
      title: module.title,
      built: isBuilt,
      certifiable: isCertifiable,
      certified: isCertified,
      held: isHeld,
      effectiveState,
      proofs: {
        lastQaStatusRunId: state?.lastQaStatusRunId || latestQaStatus?.id || null,
        lastQaStatusRunAt: latestQaStatus?.runAt?.toISOString() || null,
        lastQaStatusOk: state?.lastQaStatusOk ?? latestQaStatus?.ok ?? null,
        lastSmokeTestRunId: state?.lastSmokeTestRunId || latestSmokeTest?.id || null,
        lastSmokeTestRunAt: latestSmokeTest?.runAt?.toISOString() || null,
        lastSmokeTestOk: state?.lastSmokeTestOk ?? latestSmokeTest?.ok ?? null,
        docsPresent: state?.docsPresent ?? docsPresent,
        missingDocs: (state?.missingDocs as string[] | null) ?? missingDocs,
      },
      recommendedAction,
      blockReason,
    });
  }

  const summary = {
    total: reportModules.length,
    built: reportModules.filter((m) => m.built).length,
    certifiable: reportModules.filter((m) => m.certifiable).length,
    certified: reportModules.filter((m) => m.certified).length,
    held: reportModules.filter((m) => m.held).length,
    blocked: reportModules.filter((m) => m.recommendedAction === "BLOCKED").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    category: "emergency_legal_insurance",
    modules: reportModules,
    summary,
  };
}

function generateMarkdown(report: CertDecisionReport): string {
  const lines: string[] = [
    "# P2 Emergency/Legal/Insurance Certification Decision Report",
    "",
    `**Generated:** ${report.generatedAt}`,
    `**Category:** ${report.category}`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Modules | ${report.summary.total} |`,
    `| Built | ${report.summary.built} |`,
    `| Certifiable | ${report.summary.certifiable} |`,
    `| Certified | ${report.summary.certified} |`,
    `| Held | ${report.summary.held} |`,
    `| Blocked | ${report.summary.blocked} |`,
    "",
    "## Module Status",
    "",
  ];

  for (const module of report.modules) {
    const stateEmoji = {
      certified: "![certified](https://img.shields.io/badge/status-certified-green)",
      certifiable: "![certifiable](https://img.shields.io/badge/status-certifiable-blue)",
      held: "![held](https://img.shields.io/badge/status-held-yellow)",
      built: "![built](https://img.shields.io/badge/status-built-gray)",
    }[module.effectiveState] || "";

    const actionEmoji = {
      CERTIFY_NOW: "CERTIFY NOW",
      HOLD: "HOLD",
      BLOCKED: "BLOCKED",
    }[module.recommendedAction];

    lines.push(`### ${module.moduleKey}`);
    lines.push("");
    lines.push(`**Title:** ${module.title}`);
    lines.push(`**Effective State:** ${module.effectiveState} ${stateEmoji}`);
    lines.push(`**Recommended Action:** ${actionEmoji}`);
    lines.push("");
    lines.push("**Flags:**");
    lines.push(`- Built: ${module.built ? "Yes" : "No"}`);
    lines.push(`- Certifiable: ${module.certifiable ? "Yes" : "No"}`);
    lines.push(`- Certified: ${module.certified ? "Yes" : "No"}`);
    lines.push(`- Held: ${module.held ? "Yes" : "No"}`);
    lines.push("");
    lines.push("**Proofs:**");
    lines.push(`- Last QA Status Run: ${module.proofs.lastQaStatusRunId || "None"} (${module.proofs.lastQaStatusOk === null ? "N/A" : module.proofs.lastQaStatusOk ? "PASS" : "FAIL"})`);
    lines.push(`- Last Smoke Test Run: ${module.proofs.lastSmokeTestRunId || "None"} (${module.proofs.lastSmokeTestOk === null ? "N/A" : module.proofs.lastSmokeTestOk ? "PASS" : "FAIL"})`);
    lines.push(`- Docs Present: ${module.proofs.docsPresent ? "Yes" : "No"}`);

    if (module.proofs.missingDocs.length > 0) {
      lines.push(`- Missing Docs: ${module.proofs.missingDocs.join(", ")}`);
    }

    if (module.blockReason) {
      lines.push("");
      lines.push(`**Block Reason:** ${module.blockReason}`);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("## Decision Guide");
  lines.push("");
  lines.push("- **CERTIFY NOW**: Module is certifiable and either safety-critical or explicitly marked for certification");
  lines.push("- **HOLD**: Module is certifiable but intentionally not certified yet (strategic flexibility)");
  lines.push("- **BLOCKED**: Module cannot be certified due to failing proofs or missing documentation");
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("This report is generated by `scripts/scm-generate-cert-decision-report.ts`.");
  lines.push("To update module states, use the `/api/scm/modules/:moduleKey/set-state` endpoint.");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("Generating Certification Decision Report...\n");

  const report = await generateReport();

  const docsDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const jsonPath = path.join(docsDir, "CERT_DECISION_P2_EMERGENCY_LEGAL_INSURANCE.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON report saved to: ${jsonPath}`);

  const mdPath = path.join(docsDir, "CERT_DECISION_P2_EMERGENCY_LEGAL_INSURANCE.md");
  const markdown = generateMarkdown(report);
  fs.writeFileSync(mdPath, markdown);
  console.log(`Markdown report saved to: ${mdPath}`);

  console.log("\n=== Summary ===");
  console.log(`Total Modules: ${report.summary.total}`);
  console.log(`Certifiable: ${report.summary.certifiable}`);
  console.log(`Certified: ${report.summary.certified}`);
  console.log(`Held: ${report.summary.held}`);
  console.log(`Blocked: ${report.summary.blocked}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to generate report:", err);
  process.exit(1);
});
