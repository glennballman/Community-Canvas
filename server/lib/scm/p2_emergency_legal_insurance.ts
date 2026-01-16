import { db } from "../../db";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import {
  scmModules,
  scmProofRuns,
  scmModuleOverrides,
  scmCertificationStates,
  type ScmModule,
  type ScmCertificationState,
  type CertificationPolicy,
} from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const P2_MODULE_KEYS = [
  "P2.5_EVIDENCE_CUSTODY",
  "P2.6_INSURANCE_CLAIMS",
  "P2.7_LEGAL_HOLDS",
  "P2.8_OFFLINE_SYNC",
  "P2.9_AUTHORITY_PORTAL",
  "P2.10_DEFENSE_PACKS",
  "P2.11_ANON_INTEREST_GROUPS",
  "P2.12_EMERGENCY_TEMPLATES_RUNS",
  "P2.13_PRESERVE_RECORD_PACKS",
  "P2.14_CERT_READINESS_QA",
  "P2.15_MONETIZATION_LEDGER",
];

interface ModuleComputedState {
  moduleKey: string;
  isBuilt: boolean;
  isCertifiable: boolean;
  isCertified: boolean;
  isHeld: boolean;
  computedState: "built" | "certifiable";
  effectiveState: "built" | "certifiable" | "certified" | "held";
  lastQaStatusRunId: string | null;
  lastQaStatusOk: boolean | null;
  lastSmokeTestRunId: string | null;
  lastSmokeTestOk: boolean | null;
  docsPresent: boolean;
  missingDocs: string[];
}

export async function getLatestProofRun(
  runType: "qa_status" | "smoke_test" | "sql_verification",
  moduleKey?: string
): Promise<{ id: string; ok: boolean; runAt: Date; details: Record<string, unknown> } | null> {
  const conditions = [eq(scmProofRuns.runType, runType)];
  if (moduleKey) {
    conditions.push(eq(scmProofRuns.moduleKey, moduleKey));
  } else {
    conditions.push(isNull(scmProofRuns.moduleKey));
  }

  const [run] = await db
    .select()
    .from(scmProofRuns)
    .where(and(...conditions))
    .orderBy(desc(scmProofRuns.runAt))
    .limit(1);

  return run ? { id: run.id, ok: run.ok, runAt: run.runAt, details: run.details } : null;
}

export async function getLatestModuleOverride(
  moduleKey: string
): Promise<{ overrideState: string; setAt: Date } | null> {
  const [override] = await db
    .select()
    .from(scmModuleOverrides)
    .where(eq(scmModuleOverrides.moduleKey, moduleKey))
    .orderBy(desc(scmModuleOverrides.setAt))
    .limit(1);

  return override ? { overrideState: override.overrideState, setAt: override.setAt } : null;
}

function checkDocsPresent(policy: CertificationPolicy): { present: boolean; missing: string[] } {
  const docs = policy.proof_artifacts?.docs || [];
  const missing: string[] = [];

  for (const docPath of docs) {
    const fullPath = path.join(process.cwd(), docPath);
    if (!fs.existsSync(fullPath)) {
      missing.push(docPath);
    }
  }

  return { present: missing.length === 0, missing };
}

async function checkTablesExist(moduleKey: string): Promise<boolean> {
  const tableChecks: Record<string, string[]> = {
    P2_5_EVIDENCE_CUSTODY: ["cc_evidence_objects", "cc_evidence_events", "cc_evidence_bundles"],
    P2_6_INSURANCE_CLAIMS: ["cc_insurance_policies", "cc_insurance_claims", "cc_claim_dossiers"],
    P2_7_LEGAL_HOLDS: ["cc_legal_holds", "cc_legal_hold_targets", "cc_legal_hold_events"],
    P2_8_OFFLINE_SYNC: ["cc_offline_ingest_queue", "cc_offline_reconcile_log"],
    P2_9_AUTHORITY_PORTAL: ["cc_authority_access_grants", "cc_authority_access_tokens"],
    P2_10_DEFENSE_PACKS: ["cc_disputes", "cc_defense_packs"],
    P2_11_ANON_INTEREST_GROUPS: ["cc_interest_groups", "cc_interest_group_signals"],
    P2_12_EMERGENCY_TEMPLATES_RUNS: ["cc_emergency_templates", "cc_emergency_runs"],
    P2_13_PRESERVE_RECORD_PACKS: ["cc_record_captures", "cc_record_sources"],
    P2_14_CERT_READINESS_QA: [],
    P2_15_MONETIZATION_LEDGER: ["cc_monetization_plans", "cc_monetization_events"],
  };

  const normalizedKey = moduleKey.replace(/\./g, "_");
  const tables = tableChecks[normalizedKey] || [];

  if (tables.length === 0) return true;

  for (const tableName of tables) {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = ${tableName}
      ) as table_exists
    `);
    if (!result.rows[0]?.table_exists) {
      return false;
    }
  }

  return true;
}

export async function computeModuleState(module: ScmModule): Promise<ModuleComputedState> {
  const policy = module.certificationPolicy as CertificationPolicy;
  
  const latestQaStatus = await getLatestProofRun("qa_status");
  const latestSmokeTest = await getLatestProofRun("smoke_test");
  const { present: docsPresent, missing: missingDocs } = checkDocsPresent(policy);
  const tablesExist = await checkTablesExist(module.moduleKey);

  const isBuilt = tablesExist;

  const certifiableConditions = policy.certifiable_when || {};
  let isCertifiable = isBuilt;

  if (certifiableConditions.qa_status_endpoint_ok && (!latestQaStatus || !latestQaStatus.ok)) {
    isCertifiable = false;
  }
  if (certifiableConditions.smoke_test_script_passed && (!latestSmokeTest || !latestSmokeTest.ok)) {
    isCertifiable = false;
  }
  if (certifiableConditions.docs_present && !docsPresent) {
    isCertifiable = false;
  }

  const override = await getLatestModuleOverride(module.moduleKey);

  let isCertified = false;
  let isHeld = false;
  let effectiveState: "built" | "certifiable" | "certified" | "held";

  if (override) {
    if (override.overrideState === "certified") {
      isCertified = true;
      effectiveState = "certified";
    } else if (override.overrideState === "held") {
      isHeld = true;
      effectiveState = "held";
    } else {
      effectiveState = isCertifiable ? "certifiable" : "built";
    }
  } else {
    effectiveState = isCertifiable ? "certifiable" : "built";
  }

  const computedState = isCertifiable ? "certifiable" : "built";

  return {
    moduleKey: module.moduleKey,
    isBuilt,
    isCertifiable,
    isCertified,
    isHeld,
    computedState,
    effectiveState,
    lastQaStatusRunId: latestQaStatus?.id || null,
    lastQaStatusOk: latestQaStatus?.ok ?? null,
    lastSmokeTestRunId: latestSmokeTest?.id || null,
    lastSmokeTestOk: latestSmokeTest?.ok ?? null,
    docsPresent,
    missingDocs,
  };
}

export async function computeAllModuleStates(): Promise<ModuleComputedState[]> {
  const modules = await db
    .select()
    .from(scmModules)
    .where(eq(scmModules.category, "emergency_legal_insurance"));

  const states: ModuleComputedState[] = [];

  for (const module of modules) {
    const state = await computeModuleState(module);
    states.push(state);
  }

  return states;
}

export async function updateCertificationStates(): Promise<void> {
  const states = await computeAllModuleStates();

  for (const state of states) {
    await db
      .insert(scmCertificationStates)
      .values({
        moduleKey: state.moduleKey,
        computedState: state.computedState,
        effectiveState: state.effectiveState,
        isBuilt: state.isBuilt,
        isCertifiable: state.isCertifiable,
        isCertified: state.isCertified,
        isHeld: state.isHeld,
        lastQaStatusRunId: state.lastQaStatusRunId,
        lastQaStatusOk: state.lastQaStatusOk,
        lastSmokeTestRunId: state.lastSmokeTestRunId,
        lastSmokeTestOk: state.lastSmokeTestOk,
        docsPresent: state.docsPresent,
        missingDocs: state.missingDocs,
      })
      .onConflictDoUpdate({
        target: scmCertificationStates.moduleKey,
        set: {
          computedState: state.computedState,
          effectiveState: state.effectiveState,
          isBuilt: state.isBuilt,
          isCertifiable: state.isCertifiable,
          isCertified: state.isCertified,
          isHeld: state.isHeld,
          lastQaStatusRunId: state.lastQaStatusRunId,
          lastQaStatusOk: state.lastQaStatusOk,
          lastSmokeTestRunId: state.lastSmokeTestRunId,
          lastSmokeTestOk: state.lastSmokeTestOk,
          docsPresent: state.docsPresent,
          missingDocs: state.missingDocs,
          computedAt: sql`now()`,
        },
      });
  }
}

export async function getCertificationStates(): Promise<ScmCertificationState[]> {
  return db
    .select()
    .from(scmCertificationStates)
    .orderBy(scmCertificationStates.moduleKey);
}

export async function recordProofRun(params: {
  runType: "qa_status" | "smoke_test" | "sql_verification";
  ok: boolean;
  details: Record<string, unknown>;
  artifactRefs?: string[];
  moduleKey?: string;
  tenantId?: string;
  createdByIndividualId?: string;
}): Promise<{ id: string }> {
  const [run] = await db
    .insert(scmProofRuns)
    .values({
      runType: params.runType,
      ok: params.ok,
      details: params.details,
      artifactRefs: params.artifactRefs || [],
      moduleKey: params.moduleKey,
      tenantId: params.tenantId,
      createdByIndividualId: params.createdByIndividualId,
    })
    .returning({ id: scmProofRuns.id });

  await updateCertificationStates();

  return run;
}

export async function setModuleOverride(params: {
  moduleKey: string;
  overrideState: "built" | "held" | "certified";
  overrideReason?: string;
  setByIndividualId?: string;
}): Promise<void> {
  await db.insert(scmModuleOverrides).values({
    moduleKey: params.moduleKey,
    overrideState: params.overrideState,
    overrideReason: params.overrideReason,
    setByIndividualId: params.setByIndividualId,
  });

  await updateCertificationStates();
}

export interface CertDecisionReportModule {
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

export interface CertDecisionReport {
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

export async function generateCertDecisionReport(): Promise<CertDecisionReport> {
  const modules = await db
    .select()
    .from(scmModules)
    .where(eq(scmModules.category, "emergency_legal_insurance"))
    .orderBy(scmModules.moduleKey);

  const states = await computeAllModuleStates();
  const statesMap = new Map(states.map((s) => [s.moduleKey, s]));

  const latestQaStatus = await getLatestProofRun("qa_status");
  const latestSmokeTest = await getLatestProofRun("smoke_test");

  const reportModules: CertDecisionReportModule[] = [];

  const safetyCriticalModules = ["P2.5_EVIDENCE_CUSTODY", "P2.7_LEGAL_HOLDS", "P2.9_AUTHORITY_PORTAL"];

  for (const module of modules) {
    const state = statesMap.get(module.moduleKey);
    if (!state) continue;

    let recommendedAction: "CERTIFY_NOW" | "HOLD" | "BLOCKED";
    let blockReason: string | undefined;

    if (!state.isCertifiable) {
      recommendedAction = "BLOCKED";
      const reasons: string[] = [];
      if (!state.lastQaStatusOk) reasons.push("QA status check failed or missing");
      if (!state.lastSmokeTestOk) reasons.push("Smoke test failed or missing");
      if (!state.docsPresent) reasons.push(`Missing docs: ${state.missingDocs.join(", ")}`);
      if (!state.isBuilt) reasons.push("Required tables not found");
      blockReason = reasons.join("; ");
    } else if (state.isCertified) {
      recommendedAction = "CERTIFY_NOW";
    } else if (safetyCriticalModules.includes(module.moduleKey)) {
      recommendedAction = "CERTIFY_NOW";
    } else {
      recommendedAction = "HOLD";
    }

    reportModules.push({
      moduleKey: module.moduleKey,
      title: module.title,
      built: state.isBuilt,
      certifiable: state.isCertifiable,
      certified: state.isCertified,
      held: state.isHeld,
      effectiveState: state.effectiveState,
      proofs: {
        lastQaStatusRunId: latestQaStatus?.id || null,
        lastQaStatusRunAt: latestQaStatus?.runAt?.toISOString() || null,
        lastQaStatusOk: latestQaStatus?.ok ?? null,
        lastSmokeTestRunId: latestSmokeTest?.id || null,
        lastSmokeTestRunAt: latestSmokeTest?.runAt?.toISOString() || null,
        lastSmokeTestOk: latestSmokeTest?.ok ?? null,
        docsPresent: state.docsPresent,
        missingDocs: state.missingDocs,
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
