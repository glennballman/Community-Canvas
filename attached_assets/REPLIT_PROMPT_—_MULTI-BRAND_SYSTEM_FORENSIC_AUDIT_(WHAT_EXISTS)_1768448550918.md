# ✅ REPLIT PROMPT — MULTI-BRAND SYSTEM FORENSIC AUDIT (WHAT EXISTS)

Paste this into Replit:

> Perform a **forensic audit** of the existing **Multi-Brand / Brand-Aware Entry Point system** in the Community Canvas codebase.
>
> Goal: identify **everything that already exists** for supporting multiple brands (e.g., Remote Serve, Canada Direct, Bamfield) including domain routing, theming, branded shells, and brand-scoped onboarding flows.
>
> **Do not propose improvements. Do not design UI. Only report what exists.**
>
> ## 1) DATA MODEL
>
> - Identify any tables or config structures for:
>   - brands / surfaces / tenants / portals / domains
>   - theme configuration (colors, logos, typography tokens)
>   - brand → portal mapping
>   - brand → onboarding flows
> - For each, list: table/config name, key fields, and purpose.
>
> ## 2) ROUTING / ENTRYPOINT RESOLUTION
>
> - Identify how the app determines which brand the user is in:
>   - domain-based (host header)
>   - route-based (/p/*, /c/*, etc.)
>   - session-based
> - Show exact file paths and functions where brand context is resolved.
>
> ## 3) UI SHELL / THEME APPLICATION
>
> - Locate brand-aware layout components (shells).
> - Identify how nav, logo, colors, copy change per brand.
> - List relevant files/components.
>
> ## 4) AUTH + CONTEXT
>
> - Determine whether brand context is part of ActorContext or request context.
> - Identify any constraints that enforce brand separation.
>
> ## 5) PORTAL SURFACES
>
> - Identify which portals are already branded or brand-aware:
>   - Jobs portal (CanadaDirect)
>   - Community portal (Bamfield)
>   - Contractor portal (RemoteServe)
> - List routes and pages that show brand-specific behavior.
>
> ## 6) EMBEDS / WIDGETS (IF ANY)
>
> - Find any existing work related to embeddable widgets:
>   - calendars
>   - inquiry forms
>   - branded iframes
> - Provide file paths and current status.
>
> ## 7) COMPLETE vs PARTIAL
>
> Categorize:
>
> - ✅ implemented and usable
> - ⚠️ partial
> - ❌ missing
>
> Output results as a structured report with file references.
>
> Constraints:
>
> - No refactors
> - No new feature proposals
> - Only inventory what exists