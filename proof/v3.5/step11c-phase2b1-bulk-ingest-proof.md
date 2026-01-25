# STEP 11C Phase 2B-1: Bulk Invite Ingest Proof

**Date**: 2026-01-25
**Feature**: CSV/Paste bulk invite ingest with preview, dedupe, and platform detection

---

## 1. Bulk UI Sections (Paste + CSV)

### Paste List Mode
- Toggle button: "Add multiple stakeholders" expands bulk section
- Segmented buttons: "Paste list" | "Upload CSV"
- Textarea with placeholder: "Paste emails separated by commas or new lines"
- Preview button parses input and displays preview table

### CSV Upload Mode
- Hidden file input with accept=".csv"
- Button: "Choose CSV file"
- Parsing via papaparse with header detection

**Component**: `client/src/components/provider/NotifyStakeholdersModal.tsx`

---

## 2. CSV Headers Supported

The following header aliases are recognized (case-insensitive matching):

| Field   | Accepted Headers                                    |
|---------|-----------------------------------------------------|
| Email   | email, Email, E-mail, e-mail, EMAIL                 |
| Name    | name, Name, full_name, Full Name, NAME              |
| Message | message, Message, note, Note, MESSAGE               |

**Fallback**: If no email header found, first column is used as email.

---

## 3. Dedupe Within Input

When parsing paste/CSV:
1. Normalize email: `email.toLowerCase().trim()`
2. Track seen emails in Set
3. First occurrence → status: `ready`
4. Subsequent occurrences → status: `duplicate_in_input`, issue: "Duplicate in input"

**Badge shown**: Yellow outline "Duplicate"

---

## 4. Already-Invited Detection

Before showing preview:
1. Fetch existing invitations via `GET /api/provider/runs/:id/stakeholder-invites`
2. Build set of `invitee_email` for non-revoked, non-expired invitations
3. Mark matching input rows → status: `already_invited`, issue: "Already invited to this run"

**Badge shown**: Blue outline "Already invited"

---

## 5. On-Platform Badge (Email Lookup)

### Backend Endpoint
```
POST /api/provider/identity/email-lookup
Body: { emails: string[] }  (max 500)
Response: { ok: true, matches: [{ email, individual_id, display_name }] }
```

**Location**: `server/routes/provider.ts` lines 2603-2647

### Frontend Usage
After parsing, unique valid emails are sent to lookup endpoint.
Matches are stored in `existing_individual` field on each row.

**Badge shown**: Green outline "On platform"

---

## 6. Batch Submission Behavior

### Configuration
- `BATCH_SIZE = 50` (hardcoded client-side)
- Server policy `per_request_cap` enforced on each batch

### Algorithm
1. Filter rows where `status === 'ready'`
2. Chunk into batches of 50
3. For each batch:
   - POST to `/api/provider/runs/:id/stakeholder-invites`
   - Update row statuses based on response
4. Track rate limiting across batches

### Result Statuses
| Status         | Condition                                    |
|----------------|----------------------------------------------|
| created        | Invitation successfully created              |
| skipped        | Not in response (edge case)                  |
| rate_limited   | Server returned 429                          |
| error          | Server returned error or request failed      |

---

## 7. Rate Limit Handling

When server returns HTTP 429:
1. Set current batch rows → status: `rate_limited`
2. Set all remaining batches → status: `rate_limited`
3. Show toast: "Invitation limit reached. Try again later or adjust tenant policy."
4. Stop processing

**Badge shown**: Red "Limit reached"

---

## 8. Terminology Compliance

### Forbidden Terms Check
- ❌ "booking" → not used
- ❌ "contractor" → not used
- ❌ "calendar" → not used

### Approved Terms Used
- ✅ "service provider" context via `useCopy({ entryPoint: 'service' })`
- ✅ "reservation" (in copy tokens)
- ✅ "stakeholder" throughout

---

## 9. Copy Tokens Added

Location: `client/src/copy/entryPointCopy.ts` (service entry point)

```typescript
'provider.notify.bulk.title': 'Add multiple stakeholders',
'provider.notify.bulk.mode.paste': 'Paste list',
'provider.notify.bulk.mode.csv': 'Upload CSV',
'provider.notify.bulk.paste.placeholder': 'Paste emails separated by commas or new lines',
'provider.notify.bulk.csv.button': 'Choose CSV file',
'provider.notify.bulk.preview.title': 'Preview',
'provider.notify.bulk.preview.help': "We'll remove duplicates and skip anyone already invited.",
'provider.notify.bulk.badge.on_platform': 'On platform',
'provider.notify.bulk.badge.ready': 'Ready',
'provider.notify.bulk.badge.invalid': 'Invalid',
'provider.notify.bulk.badge.duplicate': 'Duplicate',
'provider.notify.bulk.badge.already_invited': 'Already invited',
'provider.notify.bulk.badge.created': 'Created',
'provider.notify.bulk.badge.rate_limited': 'Limit reached',
'provider.notify.bulk.submit': 'Send invitations',
'provider.notify.bulk.remove': 'Remove',
'provider.notify.bulk.error.csv_parse': "Couldn't read that CSV. Check headers and try again.",
'provider.notify.bulk.error.rate_limited': 'Invitation limit reached. Try again later or adjust tenant policy.',
```

---

## 10. Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added `papaparse`, `@types/papaparse` |
| `server/routes/provider.ts` | Added `POST /api/provider/identity/email-lookup` endpoint |
| `client/src/copy/entryPointCopy.ts` | Added 18 bulk invite copy tokens |
| `client/src/components/provider/NotifyStakeholdersModal.tsx` | Full bulk ingest UI implementation |

---

## 11. Test IDs Added

| Element | Test ID |
|---------|---------|
| Toggle bulk section | `button-toggle-bulk` |
| Bulk section container | `section-bulk-ingest` |
| Paste mode button | `button-mode-paste` |
| CSV mode button | `button-mode-csv` |
| Paste textarea | `input-bulk-paste` |
| Parse paste button | `button-parse-paste` |
| CSV file input | `input-csv-file` |
| Choose CSV button | `button-choose-csv` |
| Bulk message input | `input-bulk-message` |
| Preview section | `section-bulk-preview` |
| Bulk submit button | `button-bulk-submit` |
| Row elements | `bulk-row-{row_id}` |
| Remove row button | `button-remove-{row_id}` |
| Status badges | `badge-bulk-{status}` |
| On platform badge | `badge-on-platform` |

---

## Conclusion

STEP 11C Phase 2B-1 complete. Bulk invite ingest supports:
- Paste list and CSV upload modes
- Client-side parsing with papaparse
- Dedupe within input
- Already-invited detection from existing invitations
- "On platform" flagging via email lookup endpoint
- Batch submission with 50-row chunks
- Rate limit handling with graceful degradation
- Full terminology compliance
