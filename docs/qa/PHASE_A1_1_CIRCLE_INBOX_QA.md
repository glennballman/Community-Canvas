# Phase A1.1 Circle Inbox UI - QA Checklist

## Overview
This document provides manual QA steps for validating Phase A1.1: Circle Inbox UI surface.

## Prerequisites
- User must be logged in
- User must have access to at least one circle (membership in `cc_circle_members`)
- Optional: Create test circles and conversations for testing

## Test Cases

### 1. Context Indicator Display
**Location:** `/app/messages` - Conversations list header

**Steps:**
1. Navigate to `/app/messages`
2. Observe the header area next to "Conversations" title

**Expected:**
- Context indicator shows current tenant name (if set)
- Shows "(imp)" suffix if impersonating
- Shows circle badge (violet) if acting as a circle
- Settings gear icon links to `/app/circles`

---

### 2. Circles Page - List View
**Location:** `/app/circles`

**Steps:**
1. Navigate to `/app/circles` (or click gear icon from messages)
2. View the circles list

**Expected:**
- Page title: "My Circles"
- Lists all circles user is a member of
- Each circle shows: name, role badge, description (if any)
- "Act as this circle" button for each circle
- "Active" badge on currently active circle

---

### 3. Switch Circle Context
**Location:** `/app/circles`

**Steps:**
1. Navigate to `/app/circles`
2. Click "Act as this circle" on a circle
3. Observe redirect

**Expected:**
- Toast: "Circle switched"
- Redirect to `/app/messages`
- Context indicator shows circle name in violet badge
- Circle conversations now visible in list

---

### 4. Clear Circle Context
**Location:** `/app/circles`

**Steps:**
1. While acting as a circle, navigate to `/app/circles`
2. Click "Clear" button on "Currently Acting As" card

**Expected:**
- Toast: "Circle cleared"
- Redirect to `/app/messages`
- Context indicator no longer shows circle badge
- Circle conversations no longer visible

---

### 5. Conversations List - Circle Label
**Location:** `/app/messages`

**Steps:**
1. Switch to a circle with conversations
2. View the conversations list

**Expected:**
- Circle conversations show purple "Circle" tag prefix
- Traditional party conversations do NOT show the tag
- Both types sorted by most recent activity

---

### 6. Mixed Conversation Types
**Location:** `/app/messages`

**Steps:**
1. As a user with both party conversations AND circle membership
2. Switch to a circle that has conversations
3. View the combined list

**Expected:**
- List shows BOTH:
  - Traditional party-based conversations (work requests)
  - Circle conversations (with "Circle" tag)
- Sorted by most recent activity (not grouped by type)

---

### 7. RLS Enforcement
**Steps:**
1. While NOT acting as a circle, view conversations
2. Verify circle conversations are NOT visible
3. Switch to circle
4. Verify circle conversations appear

**Expected:**
- Circle conversations ONLY visible when `acting_as_circle = true`
- This is UX-enforced in frontend AND RLS-enforced in backend

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/me/context` | GET | Get current user context including circle |
| `/api/me/circles` | GET | List user's circle memberships |
| `/api/me/switch-circle` | POST | Switch to a specific circle |
| `/api/me/clear-circle` | POST | Clear circle context |
| `/api/conversations` | GET | Unified conversations list (includes circle) |

---

### 8. New Circle Conversation
**Location:** `/app/messages` (while acting as circle)

**Steps:**
1. Switch to a circle context via `/app/circles`
2. Navigate to `/app/messages`
3. Verify "New Circle Conversation" button appears below the filter
4. Click the button
5. Fill in subject and first message
6. Click "Create Conversation"

**Expected:**
- Dialog shows circle name: "Posting as: [Circle Name]"
- Toast: "Conversation created"
- New conversation appears in the list with "Circle" tag
- Dialog closes and form resets

---

## Known Limitations

1. **Circle conversations structure**: Circle conversations use `cc_conversations` table with `participant_type='circle'` pattern, which is different from legacy work-request conversations.

2. **Reply flow**: Circle conversation replies use the same message input as regular conversations but fan out notifications to all circle members.

3. **Unread counts**: Circle conversation unread counts depend on the notification fan-out system working correctly.
