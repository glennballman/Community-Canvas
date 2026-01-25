# STEP 11C Phase 2C-1: Stakeholder Responses
## Patent CC-13 Inventor Glenn Ballman

---

## 1. Overview & Goal

Enable authenticated stakeholders (and run-owning tenants) to submit and view "responses" on a service run:
- **confirm** - Confirm participation/agreement
- **request_change** - Request a modification  
- **question** - Ask a question about the run

Requirements achieved:
- Append-only response records (audit-grade)
- RLS-secured (stakeholder can insert/select own; tenant can select all for run)
- API endpoints for submitting and listing responses
- UI card in RunStakeholderViewPage with RadioGroup + Textarea + history
- Notifications to run-owning tenant when stakeholder responds

---

## 2. Table Schema

### Migration: `server/migrations/184_stakeholder_responses.sql`

```sql
CREATE TABLE IF NOT EXISTS cc_service_run_stakeholder_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  run_tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  stakeholder_individual_id uuid NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  response_type text NOT NULL CHECK (response_type IN ('confirm', 'request_change', 'question')),
  message text NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_stakeholder_responses_run ON cc_service_run_stakeholder_responses(run_id, responded_at DESC);
CREATE INDEX idx_stakeholder_responses_individual ON cc_service_run_stakeholder_responses(stakeholder_individual_id, responded_at DESC);
CREATE INDEX idx_stakeholder_responses_tenant ON cc_service_run_stakeholder_responses(run_tenant_id, responded_at DESC);
```

---

## 3. RLS Policies

```sql
-- Stakeholder can SELECT their own responses
CREATE POLICY stakeholder_select_own ON cc_service_run_stakeholder_responses
  FOR SELECT USING (stakeholder_individual_id = current_individual_id() OR is_service_mode());

-- Stakeholder can INSERT their own responses  
CREATE POLICY stakeholder_insert_own ON cc_service_run_stakeholder_responses
  FOR INSERT WITH CHECK (stakeholder_individual_id = current_individual_id() OR is_service_mode());

-- Tenant can SELECT all responses for runs they own
CREATE POLICY tenant_select_by_run_tenant ON cc_service_run_stakeholder_responses
  FOR SELECT USING (run_tenant_id = current_tenant_id() OR is_service_mode());

-- Service mode bypass for all operations
CREATE POLICY service_mode_all ON cc_service_run_stakeholder_responses
  FOR ALL USING (is_service_mode()) WITH CHECK (is_service_mode());
```

---

## 4. Drizzle Schema

File: `shared/schema.ts`

```typescript
export const ccServiceRunStakeholderResponses = pgTable("cc_service_run_stakeholder_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  runTenantId: uuid("run_tenant_id").notNull(),
  stakeholderIndividualId: uuid("stakeholder_individual_id").notNull(),
  responseType: text("response_type").notNull(), // 'confirm' | 'request_change' | 'question'
  message: text("message"),
  respondedAt: timestamp("responded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdx: index("idx_stakeholder_responses_run").on(table.runId, table.respondedAt),
  individualIdx: index("idx_stakeholder_responses_individual").on(table.stakeholderIndividualId, table.respondedAt),
  tenantIdx: index("idx_stakeholder_responses_tenant").on(table.runTenantId, table.respondedAt),
}));

export const insertStakeholderResponseSchema = createInsertSchema(ccServiceRunStakeholderResponses).omit({
  id: true, createdAt: true
});
export type StakeholderResponse = typeof ccServiceRunStakeholderResponses.$inferSelect;
export type InsertStakeholderResponse = z.infer<typeof insertStakeholderResponseSchema>;
```

---

## 5. API: POST /api/runs/:id/respond

File: `server/routes/stakeholder-runs.ts`

### Authorization
- Stakeholder with active row in `cc_service_run_stakeholders`
- OR tenant owner (tenant_id matches run's tenant_id)

### Request Body
```typescript
{
  response_type: 'confirm' | 'request_change' | 'question',
  message?: string  // max 2000 chars, trimmed
}
```

### Idempotency (60s window)
Before insert, checks if identical response_type + message was submitted within 60 seconds.
If so, returns existing row with `idempotent: true` flag.

### Response
```typescript
{
  ok: true,
  response: {
    id: string,
    run_id: string,
    stakeholder_individual_id: string,
    response_type: string,
    message: string | null,
    responded_at: string
  },
  idempotent?: boolean
}
```

### Notification
Creates `cc_notifications` row:
- `recipient_tenant_id` = run's tenant_id
- `category` = 'alert'
- `context_type` = 'service_run'
- `action_url` = `/app/provider/runs/${runId}`

---

## 6. API: GET /api/runs/:id/responses

### Authorization
Same as POST respond - stakeholder or tenant owner access required.

### Behavior
- **Stakeholder**: Returns only their own responses (enforced by RLS)
- **Tenant Owner**: Returns all responses for the run with stakeholder name/email

### Response
```typescript
{
  ok: true,
  responses: [{
    id: string,
    response_type: string,
    message: string | null,
    responded_at: string,
    stakeholder_individual_id: string,
    stakeholder_name?: string,     // tenant owner only
    stakeholder_email?: string     // tenant owner only
  }]
}
```

---

## 7. API: GET /api/runs/:id/view Enhancement

The existing `/api/runs/:id/view` endpoint now includes `latest_response` in the access object:

```typescript
{
  ok: true,
  run: { ... },
  access: {
    type: 'stakeholder' | 'tenant_owner',
    stakeholder_role: string | null,
    granted_at: string | null,
    latest_response: {
      id: string,
      response_type: string,
      message: string | null,
      responded_at: string
    } | null
  }
}
```

---

## 8. Notification Flow

When stakeholder submits a response:

1. Response inserted into `cc_service_run_stakeholder_responses`
2. Notification created in `cc_notifications`:
   - `recipient_tenant_id` = run-owning tenant
   - `short_body` = "New stakeholder response"
   - `body` = "A stakeholder responded on \"{runName}\"."
   - `action_url` = `/app/provider/runs/${runId}` (tenant-scoped provider view)
   - `channels` = ['in_app']

---

## 9. Frontend: Responses Card

File: `client/src/pages/app/runs/RunStakeholderViewPage.tsx`

### Components Used
- `RadioGroup` / `RadioGroupItem` - Response type selection
- `Textarea` - Optional message
- `Button` - Submit
- `Card` - Container

### Features
- Shows current latest response if exists
- RadioGroup with 3 options (confirm, request_change, question)
- Optional message textarea (max 2000 chars)
- Submit button with loading state
- Success message on submission
- History list showing previous responses (up to 10)

### Copy Tokens (service entry point)
```
stakeholder.response.title = "Your Response"
stakeholder.response.help = "Send a response to the service provider."
stakeholder.response.type.label = "Response type"
stakeholder.response.type.confirm = "Confirm"
stakeholder.response.type.request_change = "Request change"
stakeholder.response.type.question = "Ask a question"
stakeholder.response.message.label = "Message (optional)"
stakeholder.response.message.placeholder = "Add details for the service provider…"
stakeholder.response.submit = "Send Response"
stakeholder.response.history.title = "Previous Responses"
stakeholder.response.success = "Response sent."
stakeholder.response.current = "Your current response"
```

---

## 10. Test Scenarios

### Scenario A: Stakeholder submits response
1. Stakeholder navigates to `/app/runs/:id/view`
2. Selects "Confirm" response type
3. Adds optional message
4. Clicks "Send Response"
5. Response appears in current response section
6. Notification created for tenant

### Scenario B: Idempotency within 60s
1. Stakeholder submits "Confirm" with no message
2. Within 60 seconds, submits same again
3. API returns existing row with `idempotent: true`
4. No duplicate row created

### Scenario C: Tenant views stakeholder responses
1. Tenant owner calls `GET /api/runs/:id/responses`
2. Returns all responses with stakeholder names/emails
3. Useful for provider dashboard display

### Scenario D: Response history
1. Stakeholder submits multiple responses over time
2. History card shows up to 10 previous responses
3. Latest response shown prominently at top

---

## 11. Certification Checklist

| Requirement | Status |
|-------------|--------|
| Migration creates table with correct schema | PASS |
| RLS policies enforce stakeholder/tenant access | PASS |
| Drizzle schema matches migration | PASS |
| POST /api/runs/:id/respond works for stakeholders | PASS |
| POST /api/runs/:id/respond works for tenant owners | PASS |
| Idempotency prevents duplicate submissions within 60s | PASS |
| GET /api/runs/:id/responses returns stakeholder's own responses | PASS |
| GET /api/runs/:id/responses returns all for tenant owner | PASS |
| GET /api/runs/:id/view includes latest_response | PASS |
| Notification created with recipient_tenant_id | PASS |
| action_url points to /app/provider/runs/:id | PASS |
| UI shows response form with RadioGroup | PASS |
| UI shows response history | PASS |
| Copy tokens added to service entry point | PASS |
| No forbidden terminology used | PASS |

---

## 12. Files Modified

- `server/migrations/184_stakeholder_responses.sql` - New migration
- `shared/schema.ts` - Drizzle schema addition
- `server/routes/stakeholder-runs.ts` - New endpoints + enhanced /view
- `client/src/pages/app/runs/RunStakeholderViewPage.tsx` - Response UI
- `client/src/copy/entryPointCopy.ts` - Copy tokens

---

**CERTIFIED**: STEP 11C Phase 2C-1 Complete
**Date**: 2026-01-25
**Patent**: CC-13 Inventor Glenn Ballman
