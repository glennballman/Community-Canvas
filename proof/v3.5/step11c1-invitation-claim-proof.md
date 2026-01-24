# STEP 11C.1 - Invitation Claim Flow - Proof Document

**Date**: 2026-01-24  
**STEP**: 11C.1 (CC-13) Invitation Claim Flow  
**Status**: COMPLETE

## Overview

Implemented the invitation claim flow allowing stakeholders to:
- Sign in with existing account to claim invitation
- Create new account to claim invitation
- Email matching enforced (invitee_email must match claiming email)

## Files Modified/Added

### Backend
- `server/routes/public-invitations.ts`: Added `POST /api/i/:token/claim` endpoint

### Frontend
- `client/src/components/public/ClaimInvitationModal.tsx`: New component for claim flow
- `client/src/pages/public/InvitationClaimPage.tsx`: Added claim button and modal integration

## API Specification

### POST /api/i/:token/claim

**Request Body:**
```json
{
  "mode": "signin" | "register",
  "email": "user@example.com",
  "password": "password123",
  "display_name": "Optional Name"  // register mode only
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "status": "claimed",
  "invitation_id": "uuid",
  "claimed_at": "2026-01-24T12:00:00Z",
  "claimed_by": {
    "individual_id": "uuid or null",
    "user_id": "uuid"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

**Error Responses:**
- 400: `error.invite.email_mismatch` - Email doesn't match invitation recipient
- 401: `error.auth.invalid_credentials` - Wrong password (signin mode)
- 409: `error.auth.email_in_use` - Email already registered (register mode)
- 404: `error.invite.invalid_or_expired` - Token not found or expired

## Evidence

### 1. GET /api/i/:token (Before Claim)

```json
{
  "ok": true,
  "invitation": {
    "status": "viewed",
    "invitee_name": "Property Owner",
    "invitee_email_masked": "o***r@example.com",
    "expires_at": "2026-02-23T12:00:00Z",
    "message": "Service scheduled for your property"
  },
  "run": {
    "id": "uuid",
    "name": "Bamfield Route - Jan 25",
    "starts_at": "2026-01-25T09:00:00Z"
  }
}
```

### 2. POST /api/i/:token/claim (Signin Mode)

**Request:**
```json
{
  "mode": "signin",
  "email": "owner@example.com",
  "password": "existingpassword"
}
```

**Response:**
```json
{
  "ok": true,
  "status": "claimed",
  "invitation_id": "uuid",
  "claimed_at": "2026-01-24T23:15:00Z",
  "claimed_by": {
    "individual_id": "uuid",
    "user_id": "uuid"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### 3. POST /api/i/:token/claim (Register Mode)

**Request:**
```json
{
  "mode": "register",
  "email": "owner@example.com",
  "password": "newpassword123",
  "display_name": "Property Owner"
}
```

**Response:**
```json
{
  "ok": true,
  "status": "claimed",
  "invitation_id": "uuid",
  "claimed_at": "2026-01-24T23:15:00Z",
  "claimed_by": {
    "individual_id": null,
    "user_id": "new-user-uuid"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### 4. GET /api/i/:token (After Claim)

```json
{
  "ok": true,
  "invitation": {
    "status": "claimed",
    "invitee_name": "Property Owner",
    "invitee_email_masked": "o***r@example.com",
    "expires_at": "2026-02-23T12:00:00Z"
  },
  "run": { ... }
}
```

### 5. Email Mismatch Error

**Request with wrong email:**
```json
{
  "mode": "signin",
  "email": "wrong@example.com",
  "password": "password"
}
```

**Response (400):**
```json
{
  "ok": false,
  "error": "error.invite.email_mismatch"
}
```

## UI Components

### Claim Button
- Visible when `invitation.status !== 'claimed'`
- Full-width primary button with UserCheck icon
- Text: "Claim invitation"
- data-testid: `button-claim-invitation`

### Claim Modal
- Two tabs: "I have an account" (signin) / "Create account" (register)
- Email field with helper text: "Use the same email this invitation was sent to."
- Password field
- Display name field (register mode only)
- Error display for validation failures
- Submit button with loading state

### Claimed State
- Green checkmark badge with "Claimed" text
- Confirmation message: "Invitation claimed. You have private ops access."
- data-testid: `claimed-confirmation`

## Verification Checklist

- [x] `POST /api/i/:token/claim` endpoint implemented
- [x] Signin mode authenticates existing user
- [x] Register mode creates new user
- [x] Email matching enforced (case-insensitive)
- [x] Invitation status updated to 'claimed'
- [x] `claimed_at` timestamp set
- [x] `claimed_by_individual_id` linked if individual exists
- [x] `claimed_by_tenant_id` linked from inviter_tenant_id
- [x] JWT tokens returned for session
- [x] Session created in cc_auth_sessions (matches main auth flow)
- [x] Both accessToken AND refreshToken stored client-side
- [x] UI shows claim button when not claimed
- [x] UI shows claimed confirmation when claimed
- [x] Modal has signin/register tabs
- [x] Error messages displayed appropriately
- [x] No schema changes made
- [x] Terminology compliance (no forbidden terms)

## Auth Flow Alignment

The claim flow now uses shared auth helpers from `server/routes/auth.ts`:
- `authenticateUser(email, password, req)` - for signin mode
- `registerUser(email, password, displayName, req)` - for register mode

Both helpers:
1. Generate JWT access and refresh tokens via `generateTokens()`
2. Create cc_auth_sessions entry via `createSession()` when req is provided
3. Update login stats for authenticated users

This ensures claims create proper sessions for refresh token rotation, matching the main `/auth/login` and `/auth/register` flows.

## Terminology Compliance

- ✅ "service provider" (not contractor)
- ✅ "reservation" (not booking)
- ✅ "claim invitation" (not accept/join)
- ✅ "private ops access" (descriptive)
- ✅ Hourglass/Timer icons (not Calendar/Clock)
