# AI Services Inventory - V3.5

**Inventory Date**: 2026-01-20  
**Build Checkpoint**: 4ee59f8

## Summary

No LLM/AI services currently exist in the Community Canvas codebase. The term "AI" appears in:
- N3 evaluator/monitor (rule-based, not LLM)
- SQL migration comments
- Generic pattern matching strings

## Current State: None

| Component | Status |
|-----------|--------|
| AI Endpoints | Not implemented |
| LLM Provider | Not configured |
| AI Audit Logging | Not implemented |
| UI Assist Buttons | Not implemented |

## Environment Variables

No AI-related secrets configured:
- `OPENAI_API_KEY` - Not present
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Not present (Replit-managed)

## Planned Implementation (V3.5)

### Provider
- **Replit AI Integrations** (OpenAI-compatible, no API key required)
- Billed to Replit credits
- Models: gpt-4o-mini (default for drafts)

### Endpoints

| Endpoint | Purpose | Scoping |
|----------|---------|---------|
| `POST /api/p2/ai/work-request-draft` | Generate work request description | tenant_id, portal_id |
| `POST /api/p2/ai/job-posting-draft` | Generate job posting content | tenant_id, portal_id |
| `POST /api/p2/ai/message-suggest` | Suggest conversation reply | tenant_id, portal_id |

### Audit Logging
- Uses existing `cc_activity_events` table
- Event type: `ai_generation`
- Captures: endpoint, model, token usage, tenant/portal context

### UI Surfaces

| Page | Component | Action |
|------|-----------|--------|
| Work Request Create | AssistButton | Opens modal with AI-generated draft |
| Job Posting Create | AssistButton | Opens modal with AI-generated content |
| ConversationView | AssistButton in composer | Opens modal with reply suggestions |

### Graceful Degradation
- If provider unavailable: `{ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'AI service temporarily unavailable' } }`
- If quota exceeded: `{ ok: false, error: { code: 'AI_QUOTA_EXCEEDED', message: 'AI quota exceeded' } }`

## V3.6 Roadmap

- Fine-tuned models for domain-specific content
- RAG integration with tenant knowledge base
- AI-powered search across work requests/jobs
- Automated categorization and tagging
