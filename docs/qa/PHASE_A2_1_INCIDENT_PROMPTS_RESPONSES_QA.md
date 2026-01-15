# Phase A2.1: Incident Prompts & Responses QA

## Overview
This document covers the verification and testing procedures for the Incident Prompts & Responses feature (Phase A2.1), which enables "5,000 users in 15 minutes" onboarding via public link responses and incident command telemetry.

## Migration Verification

### 1. Verify Enums Exist
```sql
SELECT typname FROM pg_type 
WHERE typname LIKE 'cc_incident_%enum' 
ORDER BY typname;
```

Expected enums:
- `cc_incident_prompt_type_enum`
- `cc_incident_prompt_target_enum`
- `cc_incident_response_channel_enum`
- `cc_incident_response_state_enum`

### 2. Verify Tables Exist with RLS
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cc_incident_prompts', 'cc_incident_responses')
ORDER BY tablename;
```

Expected:
| tablename | rowsecurity |
|-----------|-------------|
| cc_incident_prompts | t |
| cc_incident_responses | t |

### 3. Verify FORCE RLS Enabled
```sql
SELECT relname, relforcerowsecurity 
FROM pg_class 
WHERE relname IN ('cc_incident_prompts', 'cc_incident_responses');
```

Expected: Both should have `relforcerowsecurity = true`

### 4. Verify RLS Policies
```sql
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename LIKE 'cc_incident_%'
ORDER BY tablename, policyname;
```

Expected policies for `cc_incident_prompts`:
- `cc_incident_prompts_service` (ALL)
- `cc_incident_prompts_tenant_select` (SELECT)
- `cc_incident_prompts_tenant_insert` (INSERT)
- `cc_incident_prompts_tenant_update` (UPDATE)

Expected policies for `cc_incident_responses`:
- `cc_incident_responses_service` (ALL)
- `cc_incident_responses_tenant_select` (SELECT)
- `cc_incident_responses_tenant_insert` (INSERT)
- `cc_incident_responses_tenant_update` (UPDATE)

### 5. Verify SECURITY DEFINER Function
```sql
SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname = 'submit_incident_response_public';
```

Expected: `prosecdef = true` (SECURITY DEFINER)

### 6. Verify Unique Indexes for Deduplication
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'cc_incident_responses' 
  AND indexname LIKE '%dedupe%';
```

Expected:
- `idx_cc_incident_responses_individual_dedupe`
- `idx_cc_incident_responses_public_dedupe`

## API Endpoint Tests

### 1. Create Public Link Prompt

**Request:**
```http
POST /api/incidents/:incidentId/prompts
Authorization: Bearer <token>
Content-Type: application/json

{
  "promptType": "headcount",
  "promptText": "How many people are in your party?",
  "targetType": "public_link",
  "publicTokenTtlMinutes": 60,
  "maxResponses": 1000
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "prompt": {
      "id": "<uuid>",
      "createdAt": "<timestamp>",
      "promptType": "headcount",
      "targetType": "public_link"
    },
    "publicToken": "<64-char-hex>",
    "responseLink": "/api/public/incident-prompts/<token>/respond"
  }
}
```

**Verification:**
- `publicToken` returned ONCE (never stored in plain text)
- `responseLink` is usable
- Token hash stored in DB (not raw token)

### 2. Public Response via Token Link

**Request:**
```http
POST /api/public/incident-prompts/:token/respond
Content-Type: application/json

{
  "responseData": { "confirmed": true },
  "adultsCount": 2,
  "childrenCount": 1,
  "locationLabel": "Cottage 3",
  "publicResponderKey": "device-fingerprint-abc123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "incidentId": "<uuid>",
  "promptId": "<uuid>",
  "responseId": "<uuid>",
  "next": {
    "type": "invite",
    "message": "Thanks — you can create an account to receive updates"
  }
}
```

### 3. Duplicate Response Rejection

**Request:** Same as above with same `publicResponderKey`

**Expected Response:**
```json
{
  "error": "You have already responded to this prompt"
}
```

Status: `409 Conflict`

### 4. Expired Token Rejection

**Setup:** Create prompt with `publicTokenTtlMinutes: 1`, wait 2 minutes

**Request:** Attempt response

**Expected Response:**
```json
{
  "error": "This prompt has expired"
}
```

Status: `410 Gone`

### 5. Max Responses Reached

**Setup:** Create prompt with `maxResponses: 1`, submit one response

**Request:** Attempt second response with different key

**Expected Response:**
```json
{
  "error": "Maximum responses reached"
}
```

Status: `429 Too Many Requests`

### 6. Operator Lists Responses with Aggregations

**Request:**
```http
GET /api/incidents/:incidentId/responses
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "responses": [...],
  "aggregations": {
    "totalResponders": 50,
    "totalAdults": 75,
    "totalChildren": 25,
    "totalPets": 10,
    "totalHeadcount": 100,
    "locationBreakdown": [
      { "label": "Cottage 3", "count": 15 },
      { "label": "Main Lodge", "count": 12 }
    ]
  }
}
```

### 7. Void Response (Moderation)

**Request:**
```http
POST /api/incidents/:incidentId/responses/:responseId/void
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Spam submission"
}
```

**Expected Response:**
```json
{
  "success": true,
  "voided": true
}
```

**Verification:**
- Response state changed to `voided`
- Response NOT deleted (audit trail preserved)
- Voided responses excluded from aggregations

### 8. Token Hash Never Exposed

**Request:**
```http
GET /api/incidents/:incidentId/prompts
Authorization: Bearer <token>
```

**Verification:**
- Response does NOT contain `public_token_hash`
- Only metadata like `target_type`, `expires_at` returned

## Activity Ledger Verification

```sql
SELECT action, entity_type, entity_id, payload, created_at
FROM cc_activity_ledger
WHERE action LIKE 'incident_%'
ORDER BY created_at DESC
LIMIT 10;
```

Expected actions logged:
- `incident_prompt.create`
- `incident_response.submit`
- `incident_response.void`

## Acceptance Criteria Checklist

- [ ] Migration 129 runs cleanly on Replit
- [ ] Public link prompt creation returns token exactly once
- [ ] Public responder endpoint inserts response without authentication
- [ ] Operator endpoints are protected and RLS-tested
- [ ] Deduplication works via partial unique indexes
- [ ] No token hashes ever returned in operator GETs
- [ ] Activity ledger logs create/submit/void with portal_id/circle_id attribution
- [ ] Expired prompts reject responses
- [ ] Max responses limit enforced
- [ ] Voided responses excluded from aggregations

## Security Notes

1. **Token Security**: Raw tokens only returned once at creation; only SHA-256 hash stored
2. **RLS Enforcement**: FORCE ROW LEVEL SECURITY on both tables
3. **Public Endpoint**: Uses SECURITY DEFINER function to safely insert without broad INSERT privileges
4. **Anti-Spam**: IP and User-Agent hashed for fingerprinting without storing PII
5. **Deduplication**: Partial unique indexes prevent duplicate submissions
