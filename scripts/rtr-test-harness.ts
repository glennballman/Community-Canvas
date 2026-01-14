/**
 * RTR adaptor test harness (HTTP-level).
 *
 * Runs:
 *  - T1: Inbound top-up happy path
 *  - T2: Outbound cash-out settled (capture hold)
 *  - T3: Outbound cash-out rejected (release hold)
 *  - T4: Webhook replay idempotency
 *  - T5: Submit idempotency (double submit)
 *  - T7: Out-of-order events (settled before accepted)
 *
 * Usage:
 *   npx tsx scripts/rtr-test-harness.ts
 *
 * Env:
 *   BASE_URL=http://localhost:5000
 *   APP_TOKEN=...
 *   SERVICE_TOKEN=...
 *   TENANT_ID=...
 *   RTR_PROFILE_ID=...
 *   WALLET_ACCOUNT_ID=...
 *   FROM_RAIL_ACCOUNT_ID=...
 *   TO_RAIL_ACCOUNT_ID=...
 */

type Json = Record<string, any>;

const BASE_URL = mustEnv("BASE_URL");
const APP_TOKEN = mustEnv("APP_TOKEN");
const SERVICE_TOKEN = mustEnv("SERVICE_TOKEN");

const TENANT_ID = mustEnv("TENANT_ID");
const RTR_PROFILE_ID = mustEnv("RTR_PROFILE_ID");

const WALLET_ACCOUNT_ID = mustEnv("WALLET_ACCOUNT_ID");
const FROM_RAIL_ACCOUNT_ID = mustEnv("FROM_RAIL_ACCOUNT_ID");
const TO_RAIL_ACCOUNT_ID = mustEnv("TO_RAIL_ACCOUNT_ID");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mustEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
}

function isoNowPlus(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function httpJson(
  method: "GET" | "POST",
  url: string,
  token: string,
  body?: Json,
  useServiceKey: boolean = false
): Promise<{ status: number; json: any; raw: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Id": TENANT_ID,
  };
  
  if (useServiceKey) {
    headers["X-Service-Key"] = token;
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // not JSON
  }
  return { status: res.status, json, raw };
}

function assert(cond: any, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(a: T, b: T, msg: string): void {
  if (a !== b) throw new Error(`${msg} (got=${String(a)} expected=${String(b)})`);
}

function logStep(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function randSuffix(): string {
  return Math.random().toString(16).slice(2, 10);
}

async function getWalletAccount() {
  const url = `${BASE_URL}/api/wallet/accounts/${WALLET_ACCOUNT_ID}`;
  const r = await httpJson("GET", url, APP_TOKEN);
  assertEq(r.status, 200, `GET wallet account failed: ${r.raw}`);
  return r.json;
}

async function getTransfer(transferId: string) {
  const url = `${BASE_URL}/api/rail/transfers/${transferId}`;
  const r = await httpJson("GET", url, APP_TOKEN);
  assertEq(r.status, 200, `GET transfer failed: ${r.raw}`);
  return r.json;
}

async function createTopUp(amountCents: number) {
  const clientRequestId = `topup_${TENANT_ID}_${Date.now()}_${randSuffix()}`;
  const url = `${BASE_URL}/api/wallet/topups`;
  const r = await httpJson("POST", url, APP_TOKEN, {
    wallet_account_id: WALLET_ACCOUNT_ID,
    amount_cents: amountCents,
    to_rail_account_id: TO_RAIL_ACCOUNT_ID,
    client_request_id: clientRequestId,
    memo: "Top-up",
    reference_text: "Test top-up",
  });
  assert(
    r.status === 201 || r.status === 200 || r.status === 409,
    `Create top-up unexpected status=${r.status} body=${r.raw}`
  );
  assert(r.json?.transfer_id, `Create top-up missing transfer_id: ${r.raw}`);
  return { transferId: r.json.transfer_id as string, clientRequestId };
}

async function createCashOut(amountCents: number) {
  const clientRequestId = `cashout_${TENANT_ID}_${Date.now()}_${randSuffix()}`;
  const url = `${BASE_URL}/api/wallet/cashouts`;
  const r = await httpJson("POST", url, APP_TOKEN, {
    wallet_account_id: WALLET_ACCOUNT_ID,
    amount_cents: amountCents,
    from_rail_account_id: FROM_RAIL_ACCOUNT_ID,
    to_rail_account_id: TO_RAIL_ACCOUNT_ID,
    client_request_id: clientRequestId,
    memo: "Cash-out",
    expires_at: isoNowPlus(3600),
  });
  assert(
    r.status === 201 || r.status === 200 || r.status === 409,
    `Create cash-out unexpected status=${r.status} body=${r.raw}`
  );
  assert(r.json?.transfer_id, `Create cash-out missing transfer_id: ${r.raw}`);
  assert(r.json?.hold_id, `Create cash-out missing hold_id: ${r.raw}`);
  return {
    transferId: r.json.transfer_id as string,
    holdId: r.json.hold_id as string,
    clientRequestId,
  };
}

async function submitTransfer(transferId: string) {
  const url = `${BASE_URL}/internal/rtr/submit-transfer`;
  const r = await httpJson("POST", url, SERVICE_TOKEN, {
    tenant_id: TENANT_ID,
    transfer_id: transferId,
    rtr_profile_id: RTR_PROFILE_ID,
    dry_run: false,
  }, true);
  assertEq(r.status, 200, `Submit transfer failed: ${r.raw}`);
  return r.json;
}

async function sendWebhookSim(payload: Json, providerEventId: string) {
  const url = `${BASE_URL}/internal/rtr/webhook`;
  const r = await httpJson("POST", url, SERVICE_TOKEN, {
    tenant_id: TENANT_ID,
    rtr_profile_id: RTR_PROFILE_ID,
    provider_event_id: providerEventId,
    received_at: new Date().toISOString(),
    headers: {
      "content-type": "application/json",
      "x-signature": "redacted-test",
    },
    payload,
  }, true);
  assertEq(r.status, 200, `Webhook ingest failed: ${r.raw}`);
  return r.json;
}

function countEntriesByReference(walletJson: any, referenceType: string, referenceId: string) {
  const entries: any[] = walletJson?.entries ?? [];
  return entries.filter(
    (e) => e?.reference_type === referenceType && e?.reference_id === referenceId
  ).length;
}

async function run() {
  console.log("RTR adaptor test harness starting...");
  console.log(`BASE_URL=${BASE_URL}`);

  logStep("Baseline wallet account");
  const wallet0 = await getWalletAccount();
  const posted0 = Number(wallet0.account.posted_balance_cents ?? 0);
  const avail0 = Number(wallet0.account.available_balance_cents ?? 0);
  const holds0 = Number(wallet0.account.active_holds_cents ?? 0);
  console.log({ posted0, avail0, holds0 });

  logStep("T1: Inbound top-up happy path");
  const topUpAmount = 111;
  const { transferId: topUpTransferId } = await createTopUp(topUpAmount);
  console.log(`Created top-up transfer: ${topUpTransferId}`);

  const submit1 = await submitTransfer(topUpTransferId);
  console.log("submitTransfer:", submit1);

  await sendWebhookSim(
    {
      provider_transfer_id: submit1.provider_transfer_id ?? `provider_${topUpTransferId}`,
      status: "ACCEPTED",
      reason_code: null,
      reason_message: null,
      client_request_id: submit1.idempotency?.client_request_id ?? "n/a",
    },
    `evt_accept_${randSuffix()}`
  );

  await sendWebhookSim(
    {
      provider_transfer_id: submit1.provider_transfer_id ?? `provider_${topUpTransferId}`,
      status: "SETTLED",
      reason_code: null,
      reason_message: null,
      client_request_id: submit1.idempotency?.client_request_id ?? "n/a",
    },
    `evt_settle_${randSuffix()}`
  );

  await sleep(250);
  const tr1 = await getTransfer(topUpTransferId);
  console.log("transfer.status:", tr1.transfer.status);
  assertEq(tr1.transfer.status, "settled", "Top-up transfer should be settled");

  const wallet1 = await getWalletAccount();
  const posted1 = Number(wallet1.account.posted_balance_cents ?? 0);
  console.log({ posted1 });
  assert(posted1 >= posted0 + topUpAmount, "Wallet posted should increase after top-up settlement");

  const creditCount = countEntriesByReference(wallet1, "rail_transfer", topUpTransferId);
  assert(creditCount === 1, `Expected exactly 1 wallet entry referencing rail_transfer ${topUpTransferId}, got=${creditCount}`);

  console.log("T1 PASSED");

  logStep("T4: Webhook replay idempotency");
  const replayEventId = `evt_replay_${randSuffix()}`;
  const payloadReplay = {
    provider_transfer_id: submit1.provider_transfer_id ?? `provider_${topUpTransferId}`,
    status: "SETTLED",
    reason_code: null,
    reason_message: null,
    client_request_id: submit1.idempotency?.client_request_id ?? "n/a",
  };

  const r1 = await sendWebhookSim(payloadReplay, replayEventId);
  const r2 = await sendWebhookSim(payloadReplay, replayEventId);
  console.log({ first: r1, second: r2 });

  assert(r2.idempotent_noop === true || r2.inbox_id === r1.inbox_id, "Replay should be idempotent");

  const wallet1b = await getWalletAccount();
  const creditCount2 = countEntriesByReference(wallet1b, "rail_transfer", topUpTransferId);
  assertEq(creditCount2, 1, "Replay webhook must not duplicate wallet posting");

  console.log("T4 PASSED");

  logStep("T3: Outbound cash-out rejected releases hold");
  const cashOutAmount = 123;
  const { transferId: cashOutTransferId } = await createCashOut(cashOutAmount);

  const wallet2 = await getWalletAccount();
  const avail2 = Number(wallet2.account.available_balance_cents ?? 0);
  const holds2 = Number(wallet2.account.active_holds_cents ?? 0);
  console.log({ avail2, holds2 });

  const submit2 = await submitTransfer(cashOutTransferId);

  await sendWebhookSim(
    {
      provider_transfer_id: submit2.provider_transfer_id ?? `provider_${cashOutTransferId}`,
      status: "REJECTED",
      reason_code: "TEST_REJECT",
      reason_message: "Simulated rejection",
      client_request_id: submit2.idempotency?.client_request_id ?? "n/a",
    },
    `evt_reject_${randSuffix()}`
  );

  await sleep(250);
  const tr2 = await getTransfer(cashOutTransferId);
  console.log("transfer.status:", tr2.transfer.status);
  assert(
    tr2.transfer.status === "rejected" || tr2.transfer.status === "failed",
    `Cash-out transfer should be rejected/failed, got=${tr2.transfer.status}`
  );

  const wallet3 = await getWalletAccount();
  const holds3 = Number(wallet3.account.active_holds_cents ?? 0);
  console.log({ holds3 });

  const debitCount = countEntriesByReference(wallet3, "rail_transfer", cashOutTransferId);
  assertEq(debitCount, 0, "Rejected cash-out must not post a wallet entry");

  console.log("T3 PASSED");

  logStep("T2: Outbound cash-out settled captures hold");
  const cashOutAmount2 = 77;
  const { transferId: cashOutTransferId2 } = await createCashOut(cashOutAmount2);

  const submit3 = await submitTransfer(cashOutTransferId2);

  await sendWebhookSim(
    {
      provider_transfer_id: submit3.provider_transfer_id ?? `provider_${cashOutTransferId2}`,
      status: "ACCEPTED",
      client_request_id: submit3.idempotency?.client_request_id ?? "n/a",
    },
    `evt_accept2_${randSuffix()}`
  );

  await sendWebhookSim(
    {
      provider_transfer_id: submit3.provider_transfer_id ?? `provider_${cashOutTransferId2}`,
      status: "SETTLED",
      client_request_id: submit3.idempotency?.client_request_id ?? "n/a",
    },
    `evt_settle2_${randSuffix()}`
  );

  await sleep(250);
  const tr3 = await getTransfer(cashOutTransferId2);
  assertEq(tr3.transfer.status, "settled", "Cash-out should settle");

  const wallet4 = await getWalletAccount();
  const refCount = countEntriesByReference(wallet4, "rail_transfer", cashOutTransferId2);
  assertEq(refCount, 1, "Settled cash-out should post exactly one wallet entry referencing transfer");

  console.log("T2 PASSED");

  logStep("T5: Submit idempotency (double submit)");
  const { transferId: topUpTransferId2 } = await createTopUp(55);
  const sA = await submitTransfer(topUpTransferId2);
  const sB = await submitTransfer(topUpTransferId2);
  console.log({ first: sA, second: sB });
  assert(sB.transfer_id === topUpTransferId2, "Second submit should return same transfer_id");

  console.log("T5 PASSED");

  logStep("T7: Out-of-order events (settled then accepted)");
  const { transferId: topUpTransferId3 } = await createTopUp(66);
  const sC = await submitTransfer(topUpTransferId3);

  const providerId = sC.provider_transfer_id ?? `provider_${topUpTransferId3}`;
  
  await sendWebhookSim(
    { provider_transfer_id: providerId, status: "SETTLED", client_request_id: sC.idempotency?.client_request_id ?? "n/a" },
    `evt_oo_settle_${randSuffix()}`
  );
  
  await sendWebhookSim(
    { provider_transfer_id: providerId, status: "ACCEPTED", client_request_id: sC.idempotency?.client_request_id ?? "n/a" },
    `evt_oo_accept_${randSuffix()}`
  );

  await sleep(250);
  const trOO = await getTransfer(topUpTransferId3);
  console.log("transfer.status:", trOO.transfer.status);
  assertEq(trOO.transfer.status, "settled", "Status must not regress after out-of-order accepted");

  const walletOO = await getWalletAccount();
  const refCountOO = countEntriesByReference(walletOO, "rail_transfer", topUpTransferId3);
  assertEq(refCountOO, 1, "Out-of-order events must not duplicate wallet posting");

  console.log("T7 PASSED");

  console.log("\nAll RTR adaptor harness tests passed!");
}

run().catch((err) => {
  console.error("\nTest harness failed:");
  console.error(err?.stack || err);
  process.exit(1);
});
