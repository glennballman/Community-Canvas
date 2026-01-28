# Identity Model (PROMPT-13 Lock)

| Table | Purpose | Auth Role |
|-------|---------|-----------|
| `cc_users` | Authentication account (email, password, session) | Session holder only |
| `cc_individuals` | Person profile (name, contact info) | Profile data only |
| `cc_principals` | Authorization actor (human/service/machine) | ALL auth decisions |

**Rules:**
1. `cc_users.is_platform_admin` is FORBIDDEN for authorization (use grants)
2. Session resolves to principal via `resolvePrincipalFromSession()` only
3. If principal missing: create idempotently AFTER ensuring individual exists
4. No capability computation without principal context - fail closed
