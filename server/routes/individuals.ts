import { Router, Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { requireAuth, requireSession } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

/**
 * P0-A: Individual profile routes - locked down for PII protection
 * 
 * Security model:
 * - /me endpoint: Returns ONLY the authenticated user's own profile
 * - Mutations: Only allow self-updates via authenticated session
 * - Reference data (skills, tools, communities): Global/public reads via serviceQuery
 * 
 * RLS on cc_individuals enforces: id = app_individual_id()
 */

// GET /api/individuals/me - Get current user's individual profile (SELF ONLY)
// SECURITY: Uses individual_id from tenant context, NOT user-provided email
// Uses requireSession (not requireAuth) to allow new users without profiles to get empty scaffold
router.get('/me', requireSession, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      // User is authenticated but has no individual profile yet
      // Return empty profile scaffold - they must create one
      return res.json({
        success: true,
        individual: {
          id: null,
          fullName: '',
          preferredName: '',
          email: tenantReq.user?.email || '',
          telephone: '',
          telephoneVerified: false,
          emailVerified: false,
          photoUrl: '',
          homeCountry: 'Canada',
          homeRegion: '',
          currentCommunity: null,
          languages: ['en'],
          emergencyContactName: '',
          emergencyContactTelephone: '',
          profileScore: 0
        },
        documents: [],
        waivers: [],
        skills: [],
        tools: [],
        paymentMethods: []
      });
    }

    // Verify tenant helpers are available before calling RLS-protected queries
    if (typeof tenantReq.tenantQuery !== 'function') {
      // Tenant context not fully initialized - return scaffold
      return res.json({
        success: true,
        individual: {
          id: null,
          fullName: '',
          preferredName: '',
          email: tenantReq.user?.email || '',
          telephone: '',
          telephoneVerified: false,
          emailVerified: false,
          photoUrl: '',
          homeCountry: 'Canada',
          homeRegion: '',
          currentCommunity: null,
          languages: ['en'],
          emergencyContactName: '',
          emergencyContactTelephone: '',
          profileScore: 0
        },
        documents: [],
        waivers: [],
        skills: [],
        tools: [],
        paymentMethods: []
      });
    }

    // Use tenantQuery with individual_id from context - RLS enforces self-access
    const individualResult = await tenantReq.tenantQuery(
      'SELECT * FROM cc_individuals WHERE id = $1',
      [individualId]
    );

    if (individualResult.rows.length === 0) {
      // This shouldn't happen if individual_id is set, but handle gracefully
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const individual = individualResult.rows[0];

    // All subsequent queries are for the authenticated individual's own data
    const documentsResult = await tenantReq.tenantQuery(
      `SELECT id, document_type, document_number, issuing_authority, 
              expires_at, verified, 
              CASE WHEN expires_at < CURRENT_DATE THEN true ELSE false END as is_expired
       FROM cc_identity_documents 
       WHERE individual_id = $1
       ORDER BY created_at DESC`,
      [individual.id]
    );

    const waiversResult = await tenantReq.tenantQuery(
      `SELECT sw.id, wt.slug as template_slug, wt.name as template_name, 
              wt.activity_types, sw.signed_at, sw.expires_at,
              CASE WHEN sw.expires_at < NOW() THEN true ELSE false END as is_expired
       FROM cc_signed_waivers sw
       JOIN cc_waiver_templates wt ON wt.id = sw.waiver_template_id
       WHERE sw.individual_id = $1
       ORDER BY sw.signed_at DESC`,
      [individual.id]
    );

    const skillsResult = await tenantReq.tenantQuery(
      `SELECT cis.id, cis.skill_id, sk.name as skill_name, sk.category,
              cis.proficiency_level, cis.years_experience, cis.verified
       FROM cc_individual_skills cis
       JOIN sr_skills sk ON sk.id = cis.skill_id
       WHERE cis.individual_id = $1
       ORDER BY cis.created_at DESC`,
      [individual.id]
    );

    const toolsResult = await tenantReq.tenantQuery(
      `SELECT cit.id, cit.tool_id, t.name as tool_name, t.category,
              cit.current_location, c.name as current_community,
              cit.condition, cit.available_for_rent, cit.rental_rate_daily
       FROM cc_individual_tools cit
       JOIN sr_tools t ON t.id = cit.tool_id
       LEFT JOIN sr_communities c ON c.id = cit.current_community_id
       WHERE cit.individual_id = $1
       ORDER BY cit.created_at DESC`,
      [individual.id]
    );

    const paymentsResult = await tenantReq.tenantQuery(
      `SELECT id, payment_type, display_name, last_four, brand, is_default,
              CASE 
                WHEN expires_year < EXTRACT(YEAR FROM CURRENT_DATE) THEN true
                WHEN expires_year = EXTRACT(YEAR FROM CURRENT_DATE) 
                     AND expires_month < EXTRACT(MONTH FROM CURRENT_DATE) THEN true
                ELSE false 
              END as is_expired
       FROM cc_payment_methods
       WHERE individual_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [individual.id]
    );

    // Get current community name (reference data - use serviceQuery)
    let currentCommunity = null;
    if (individual.current_community_id) {
      const commResult = await serviceQuery(
        'SELECT name FROM sr_communities WHERE id = $1',
        [individual.current_community_id]
      );
      if (commResult.rows.length > 0) {
        currentCommunity = commResult.rows[0].name;
      }
    }

    // Calculate profile score
    let profileScore = 0;
    if (individual.full_name) profileScore += 15;
    if (individual.email_verified) profileScore += 15;
    if (individual.telephone_verified) profileScore += 10;
    if (documentsResult.rows.some((d: any) => d.document_type === 'photo_id' && d.verified)) profileScore += 20;
    if (paymentsResult.rows.some((p: any) => !p.is_expired)) profileScore += 15;
    if (waiversResult.rows.some((w: any) => !w.is_expired)) profileScore += 10;
    if (skillsResult.rows.length > 0) profileScore += 10;
    if (toolsResult.rows.length > 0) profileScore += 5;

    res.json({
      success: true,
      individual: {
        id: individual.id,
        fullName: individual.full_name,
        preferredName: individual.preferred_name || '',
        email: individual.email,
        telephone: individual.telephone || '',
        telephoneVerified: individual.telephone_verified,
        emailVerified: individual.email_verified,
        photoUrl: individual.photo_url || '',
        homeCountry: individual.home_country || 'Canada',
        homeRegion: individual.home_region || '',
        currentCommunity,
        languages: individual.languages || ['en'],
        emergencyContactName: individual.emergency_contact_name || '',
        emergencyContactTelephone: individual.emergency_contact_telephone || '',
        profileScore
      },
      documents: documentsResult.rows.map((d: any) => ({
        id: d.id,
        documentType: d.document_type,
        documentNumber: d.document_number,
        issuingAuthority: d.issuing_authority,
        expiresAt: d.expires_at,
        verified: d.verified,
        isExpired: d.is_expired
      })),
      waivers: waiversResult.rows.map((w: any) => ({
        id: w.id,
        templateSlug: w.template_slug,
        templateName: w.template_name,
        activityTypes: w.activity_types || [],
        signedAt: w.signed_at,
        expiresAt: w.expires_at,
        isExpired: w.is_expired
      })),
      skills: skillsResult.rows.map((s: any) => ({
        id: s.id,
        skillId: s.skill_id,
        skillName: s.skill_name,
        category: s.category,
        proficiencyLevel: s.proficiency_level,
        yearsExperience: s.years_experience,
        verified: s.verified
      })),
      tools: toolsResult.rows.map((t: any) => ({
        id: t.id,
        toolId: t.tool_id,
        toolName: t.tool_name,
        category: t.category,
        currentLocation: t.current_location,
        currentCommunity: t.current_community,
        condition: t.condition,
        availableForRent: t.available_for_rent,
        rentalRateDaily: t.rental_rate_daily
      })),
      paymentMethods: paymentsResult.rows.map((p: any) => ({
        id: p.id,
        paymentType: p.payment_type,
        displayName: p.display_name,
        lastFour: p.last_four,
        brand: p.brand,
        isDefault: p.is_default,
        isExpired: p.is_expired
      }))
    });
  } catch (error) {
    console.error('Error fetching individual profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/individuals/skills - Get available skills (GLOBAL reference data)
// SERVICE MODE: sr_skills is global reference data, not tenant-scoped
router.get('/skills', async (req: Request, res: Response) => {
  try {
    const result = await serviceQuery(
      'SELECT id, name, slug, category, certification_required FROM sr_skills ORDER BY category, name'
    );
    res.json({ success: true, skills: result.rows });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/individuals/tools - Get available tools (GLOBAL reference data)
// SERVICE MODE: sr_tools is global reference data, not tenant-scoped
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const result = await serviceQuery(
      'SELECT id, name, slug, category, typical_daily_rental FROM sr_tools ORDER BY category, name'
    );
    res.json({ success: true, tools: result.rows });
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/individuals/waiver-templates - Get available waiver templates (GLOBAL reference data)
// SERVICE MODE: cc_waiver_templates is global reference data
router.get('/waiver-templates', async (req: Request, res: Response) => {
  try {
    const result = await serviceQuery(
      `SELECT id, name, slug, description, activity_types, valid_days, minimum_age 
       FROM cc_waiver_templates 
       WHERE is_active = true 
       ORDER BY name`
    );
    res.json({ success: true, templates: result.rows });
  } catch (error) {
    console.error('Error fetching waiver templates:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/individuals/communities - Get communities (GLOBAL reference data)
// SERVICE MODE: sr_communities is global reference data
router.get('/communities', async (req: Request, res: Response) => {
  try {
    const result = await serviceQuery(
      'SELECT id, name, region FROM sr_communities ORDER BY region, name'
    );
    res.json({ success: true, communities: result.rows });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/individuals/my-skills - Add a skill to user's own profile (SELF ONLY)
// SECURITY: Uses individual_id from tenant context, NOT user-provided email
router.post('/my-skills', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      return res.status(401).json({ success: false, message: 'Please complete your profile first' });
    }

    const { skillId, proficiencyLevel, yearsExperience } = req.body;
    if (!skillId) {
      return res.status(400).json({ success: false, message: 'Skill ID is required' });
    }

    // Use tenantTransaction for mutation - RLS enforces individual can only modify own data
    await tenantReq.tenantTransaction(async (client) => {
      // Insert skill (individual can only modify their own skills)
      await client.query(
        `INSERT INTO cc_individual_skills (individual_id, skill_id, proficiency_level, years_experience, verified)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (individual_id, skill_id) DO UPDATE SET
           proficiency_level = EXCLUDED.proficiency_level,
           years_experience = EXCLUDED.years_experience,
           updated_at = NOW()`,
        [individualId, skillId, proficiencyLevel || 'competent', yearsExperience || null]
      );
    });

    res.json({ success: true, message: 'Skill added' });
  } catch (error) {
    console.error('Error adding skill:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/individuals/my-tools - Add a tool to user's own profile (SELF ONLY)
// SECURITY: Uses individual_id from tenant context, NOT user-provided email
router.post('/my-tools', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    
    if (!individualId) {
      return res.status(401).json({ success: false, message: 'Please complete your profile first' });
    }

    const { toolId, condition, currentLocation, currentCommunityId, availableForRent, rentalRateDaily } = req.body;
    if (!toolId) {
      return res.status(400).json({ success: false, message: 'Tool ID is required' });
    }

    // Use tenantTransaction for mutation - RLS enforces individual can only modify own data
    await tenantReq.tenantTransaction(async (client) => {
      // Insert tool
      await client.query(
        `INSERT INTO cc_individual_tools (
           individual_id, tool_id, ownership, quantity, condition, 
           current_location, current_community_id, 
           available_for_rent, rental_rate_daily
         )
         VALUES ($1, $2, 'owned', 1, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          individualId, 
          toolId, 
          condition || 'good', 
          currentLocation || null, 
          currentCommunityId || null,
          availableForRent || false,
          rentalRateDaily || null
        ]
      );
    });

    res.json({ success: true, message: 'Tool added' });
  } catch (error) {
    console.error('Error adding tool:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/individuals/bid-context/:serviceRunId - Get full context for bidding (SELF ONLY)
// SECURITY: Uses individual_id from tenant context, NOT user-provided email
router.get('/bid-context/:serviceRunId', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    const { serviceRunId } = req.params;
    
    if (!individualId) {
      return res.status(401).json({ success: false, message: 'Please complete your profile first' });
    }

    // Call the get_bid_context function - uses serviceQuery as it's a platform function
    // SERVICE MODE: Platform bidding function that may access cross-tenant reference data
    const contextResult = await serviceQuery(
      'SELECT get_bid_context($1, $2) as context',
      [individualId, serviceRunId]
    );

    res.json({
      success: true,
      context: contextResult.rows[0]?.context || null
    });
  } catch (error) {
    console.error('Error fetching bid context:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
