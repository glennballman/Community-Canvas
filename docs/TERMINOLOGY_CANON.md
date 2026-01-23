# TERMINOLOGY_CANON.md
Community Canvas / CivOS — Canonical Terminology
STATUS: LOCKED — Source of Truth (v2)

This document defines the canonical terminology for Service Requests (demand)
and Service Runs (supply). All future prompts, schemas, policies, UI, analytics,
and AI logic MUST conform to these definitions.

============================================================
CORE ENTITIES
============================================================

1) Service Request (Demand-Side)
- Created and owned by a requester (resident / business)
- Represents demand: "I need work done"

2) Service Run (Supply-Side)
- Created and owned by a service provider
- Represents availability: "I am available here/then"
- A single run may service multiple requests

============================================================
SERVICE REQUEST — MARKET MODE (WHO CAN RESPOND)
============================================================

MarketMode controls who may respond to a Service Request.

ALLOWED VALUES:

- TARGETED  
  Sent to exactly ONE specific service provider.

- INVITE_ONLY  
  Sent to a selected list of service providers.

- OPEN  
  Open to any eligible service provider.

- CLOSED  
  The request is no longer accepting responses.

IMPORTANT:
- CLOSED is explicit, never implicit.
- CLOSED does NOT mean "someone declined".

WHEN A REQUEST BECOMES CLOSED:
- Requester manually closes it
- Request is fulfilled (after completion)
- Request expires / times out

============================================================
SERVICE REQUEST — STATUS (LIFECYCLE)
============================================================

Status represents where the request is in its lifecycle.

ALLOWED STATUSES:

- DRAFT  
  Request created but not sent

- SENT / AWAITING_RESPONSE  
  Sent to provider(s), waiting for response

- PROPOSED_CHANGE  
  Provider has counter-offered terms

- AWAITING_COMMITMENT  **(NEW — LOCKED)**  
  Terms have been agreed by both parties,  
  but the service provider has not yet committed to scheduling.  
  The provider may be aggregating demand (e.g., publishing a run to
  multiple community portals to fill capacity before committing).

- UNASSIGNED  
  No provider attached (e.g., after a decline)

- ACCEPTED  
  Provider has committed to fulfill the request

- IN_PROGRESS  
  Work underway

- COMPLETED  
  Work finished

- CANCELLED  
  Requester cancelled the request

IMPORTANT RULES:
- DECLINED is NOT a status.
- DECLINED is an action only.
- Result of decline = UNASSIGNED.

============================================================
SERVICE REQUEST — STATE TRANSITIONS (AWAITING_COMMITMENT)
============================================================

PROPOSED_CHANGE → (requester accepts changes) → AWAITING_COMMITMENT
AWAITING_COMMITMENT → (provider commits) → ACCEPTED
AWAITING_COMMITMENT → (provider declines) → UNASSIGNED
AWAITING_COMMITMENT → (requester cancels) → CANCELLED
AWAITING_COMMITMENT → (timeout expires) → UNASSIGNED (with notification)

============================================================
SERVICE RUN — MARKET MODE (WHO CAN ATTACH)
============================================================

MarketMode controls whether a Service Run accepts new attachments.

ALLOWED VALUES:

- OPEN  
  Any eligible request may attach.

- INVITE_ONLY  
  Only explicitly invited requesters may attach.

- CLOSED  
  Run is not accepting any new attachments.

IMPORTANT:
- TARGETED does NOT belong on Service Runs.
- Runs are supply; they do not target demand.

WHEN A RUN BECOMES CLOSED:
- Provider manually locks it
- Capacity is full
- Run is cancelled or completed

============================================================
SERVICE RUN — STATUS (LIFECYCLE)
============================================================

ALLOWED STATUSES:

- DRAFT  
  Created but not published

- SCHEDULED  
  Published with time/location

- IN_PROGRESS  
  Run underway

- COMPLETED  
  Run finished

- CANCELLED  
  Provider cancelled the run

============================================================
UNIVERSAL RULES (NON-NEGOTIABLE)
============================================================

1) Visibility ≠ Competition  
   - Visibility controls WHERE something appears.  
   - MarketMode controls WHO may respond or attach.

2) CLOSED is NEVER implicit  
   - No entity becomes CLOSED because someone declined.

3) DECLINED is an action, not a state  
   - States are neutral and descriptive.

4) Read-only by default  
   - All state changes occur only via:
     (a) Message Action Blocks, or
     (b) Existing MarketMode-gated CTAs.

5) No parallel systems  
   - Requests and Runs are distinct entities.
   - Their states and market modes must never be conflated.

END.
