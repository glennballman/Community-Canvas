/**
 * AI Assist Routes - V3.5
 * 
 * Provides AI-powered content generation for:
 * - Work request drafts
 * - Job posting drafts
 * - Message suggestions
 * 
 * Uses Replit AI Integrations (OpenAI-compatible, no API key required).
 * Charges are billed to Replit credits.
 */
import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Initialize OpenAI client with Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Check if AI is available
function isAIAvailable(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}

// Log AI usage to cc_activity_events
async function logAIUsage(
  tenantId: string | null,
  portalId: string | null,
  individualId: string | null,
  endpoint: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  success: boolean
) {
  try {
    await db.execute(sql`
      INSERT INTO cc_activity_events (
        id, tenant_id, event_type, entity_type, entity_id,
        actor_individual_id, metadata, created_at
      ) VALUES (
        gen_random_uuid(),
        ${tenantId}::uuid,
        'ai_generation',
        'system',
        ${portalId || tenantId}::uuid,
        ${individualId}::uuid,
        ${JSON.stringify({
          endpoint,
          model,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          success,
        })}::jsonb,
        now()
      )
    `);
  } catch (e) {
    console.error('[AI] Failed to log usage:', e);
  }
}

/**
 * POST /api/p2/ai/work-request-draft
 * 
 * Generates a work request description based on provided context.
 * 
 * Request body:
 * - title: string (work request title)
 * - category: string (work category)
 * - location: string (site address/location)
 * - notes?: string (additional context)
 * 
 * Response:
 * - ok: boolean
 * - draft?: { title: string, description: string, scope: string[] }
 * - error?: { code: string, message: string }
 */
router.post('/work-request-draft', async (req: Request, res: Response) => {
  const tenantReq = req as any;
  const ctx = tenantReq.ctx;
  const tenantId = ctx?.tenant_id || null;
  const portalId = ctx?.portal_id || null;
  const individualId = ctx?.individual_id || null;

  if (!tenantId) {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
    });
  }

  if (!isAIAvailable()) {
    return res.json({
      ok: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI service temporarily unavailable. Please try again later.' }
    });
  }

  try {
    const { title, category, location, notes } = req.body;

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Title is required' }
      });
    }

    const prompt = `You are an expert at writing professional work request descriptions for service providers.

Generate a clear, professional work request based on the following:
- Title: ${title}
- Category: ${category || 'General'}
- Location: ${location || 'Not specified'}
- Additional notes: ${notes || 'None'}

Respond in JSON format with:
{
  "title": "Refined, professional title",
  "description": "Detailed description of the work needed (2-3 paragraphs)",
  "scope": ["List of specific tasks or deliverables"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const draft = JSON.parse(content);

    await logAIUsage(
      tenantId, portalId, individualId,
      'work-request-draft', 'gpt-4o-mini',
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
      true
    );

    res.json({ ok: true, draft });
  } catch (e: any) {
    console.error('[AI] Work request draft error:', e);
    
    await logAIUsage(
      tenantId, portalId, individualId,
      'work-request-draft', 'gpt-4o-mini', 0, 0, false
    );

    if (e.message?.includes('quota') || e.message?.includes('rate limit')) {
      return res.json({
        ok: false,
        error: { code: 'AI_QUOTA_EXCEEDED', message: 'AI quota exceeded. Please try again later.' }
      });
    }

    res.json({
      ok: false,
      error: { code: 'AI_ERROR', message: 'Failed to generate draft. Please try again.' }
    });
  }
});

/**
 * POST /api/p2/ai/job-posting-draft
 * 
 * Generates job posting content based on provided context.
 * 
 * Request body:
 * - title: string (job title)
 * - type: string (full-time, part-time, contract)
 * - skills?: string[] (required skills)
 * - location?: string
 * - compensation?: string
 * 
 * Response:
 * - ok: boolean
 * - draft?: { title: string, description: string, requirements: string[], benefits: string[] }
 * - error?: { code: string, message: string }
 */
router.post('/job-posting-draft', async (req: Request, res: Response) => {
  const tenantReq = req as any;
  const ctx = tenantReq.ctx;
  const tenantId = ctx?.tenant_id || null;
  const portalId = ctx?.portal_id || null;
  const individualId = ctx?.individual_id || null;

  if (!tenantId) {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
    });
  }

  if (!isAIAvailable()) {
    return res.json({
      ok: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI service temporarily unavailable. Please try again later.' }
    });
  }

  try {
    const { title, type, skills, location, compensation } = req.body;

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Job title is required' }
      });
    }

    const prompt = `You are an expert at writing compelling job postings that attract qualified candidates.

Generate a professional job posting based on the following:
- Job Title: ${title}
- Employment Type: ${type || 'Full-time'}
- Required Skills: ${Array.isArray(skills) ? skills.join(', ') : skills || 'Not specified'}
- Location: ${location || 'Not specified'}
- Compensation: ${compensation || 'Competitive'}

Respond in JSON format with:
{
  "title": "Compelling job title",
  "description": "Engaging job description (2-3 paragraphs)",
  "requirements": ["List of requirements and qualifications"],
  "benefits": ["List of benefits and perks"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const draft = JSON.parse(content);

    await logAIUsage(
      tenantId, portalId, individualId,
      'job-posting-draft', 'gpt-4o-mini',
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
      true
    );

    res.json({ ok: true, draft });
  } catch (e: any) {
    console.error('[AI] Job posting draft error:', e);
    
    await logAIUsage(
      tenantId, portalId, individualId,
      'job-posting-draft', 'gpt-4o-mini', 0, 0, false
    );

    if (e.message?.includes('quota') || e.message?.includes('rate limit')) {
      return res.json({
        ok: false,
        error: { code: 'AI_QUOTA_EXCEEDED', message: 'AI quota exceeded. Please try again later.' }
      });
    }

    res.json({
      ok: false,
      error: { code: 'AI_ERROR', message: 'Failed to generate draft. Please try again.' }
    });
  }
});

/**
 * POST /api/p2/ai/message-suggest
 * 
 * Suggests a reply based on conversation context.
 * 
 * Request body:
 * - context: string (recent conversation messages)
 * - tone?: string (professional, friendly, formal)
 * - intent?: string (respond, follow-up, clarify)
 * 
 * Response:
 * - ok: boolean
 * - suggestions?: string[] (2-3 suggested replies)
 * - error?: { code: string, message: string }
 */
router.post('/message-suggest', async (req: Request, res: Response) => {
  const tenantReq = req as any;
  const ctx = tenantReq.ctx;
  const tenantId = ctx?.tenant_id || null;
  const portalId = ctx?.portal_id || null;
  const individualId = ctx?.individual_id || null;

  if (!tenantId) {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
    });
  }

  if (!isAIAvailable()) {
    return res.json({
      ok: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI service temporarily unavailable. Please try again later.' }
    });
  }

  try {
    const { context, tone, intent } = req.body;

    if (!context) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Conversation context is required' }
      });
    }

    const prompt = `You are an assistant helping compose professional messages for a B2B service platform.

Based on this conversation context:
${context}

Generate 3 suggested reply options.
Tone: ${tone || 'professional'}
Intent: ${intent || 'respond appropriately'}

Respond in JSON format with:
{
  "suggestions": [
    "First suggested reply (1-2 sentences)",
    "Second suggested reply (1-2 sentences)",
    "Third suggested reply (1-2 sentences)"
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 512,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    await logAIUsage(
      tenantId, portalId, individualId,
      'message-suggest', 'gpt-4o-mini',
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
      true
    );

    res.json({ ok: true, suggestions: result.suggestions || [] });
  } catch (e: any) {
    console.error('[AI] Message suggest error:', e);
    
    await logAIUsage(
      tenantId, portalId, individualId,
      'message-suggest', 'gpt-4o-mini', 0, 0, false
    );

    if (e.message?.includes('quota') || e.message?.includes('rate limit')) {
      return res.json({
        ok: false,
        error: { code: 'AI_QUOTA_EXCEEDED', message: 'AI quota exceeded. Please try again later.' }
      });
    }

    res.json({
      ok: false,
      error: { code: 'AI_ERROR', message: 'Failed to generate suggestions. Please try again.' }
    });
  }
});

export default router;
