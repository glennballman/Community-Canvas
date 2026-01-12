import { Router } from 'express';
import {
  getAuthorities, getAuthorityByCode, getAuthorityById,
  getPermitTypes, getPermitTypeByCode, calculatePermitFee,
  getRequiredPermits
} from '../services/authorityService';

const router = Router();

// ============ AUTHORITY ENDPOINTS ============

// GET /api/permits/portals/:slug/authorities - List authorities
router.get('/portals/:slug/authorities', async (req, res) => {
  const { slug } = req.params;
  const { type, status, q } = req.query;
  
  try {
    const authorities = await getAuthorities(slug, {
      authorityType: type as string,
      status: status as string,
      query: q as string
    });
    
    res.json({ authorities, count: authorities.length });
  } catch (e: any) {
    console.error('Get authorities error:', e);
    res.status(500).json({ error: 'Failed to get authorities' });
  }
});

// GET /api/permits/portals/:slug/authorities/:code - Get authority with permit types
router.get('/portals/:slug/authorities/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const result = await getAuthorityByCode(slug, code);
    if (!result) {
      return res.status(404).json({ error: 'Authority not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get authority error:', e);
    res.status(500).json({ error: 'Failed to get authority' });
  }
});

// ============ PERMIT TYPE ENDPOINTS ============

// GET /api/permits/portals/:slug/types - List permit types
router.get('/portals/:slug/types', async (req, res) => {
  const { slug } = req.params;
  const { authority, category } = req.query;
  
  try {
    const permitTypes = await getPermitTypes(slug, {
      authorityCode: authority as string,
      category: category as string
    });
    
    res.json({ permitTypes, count: permitTypes.length });
  } catch (e: any) {
    console.error('Get permit types error:', e);
    res.status(500).json({ error: 'Failed to get permit types' });
  }
});

// GET /api/permits/portals/:slug/types/:permitTypeId/calculate - Calculate permit fee
// Note: This route must be before /:authorityCode/:permitCode to avoid matching "calculate" as permitCode
router.get('/portals/:slug/types/:permitTypeId/calculate', async (req, res) => {
  const { permitTypeId } = req.params;
  const { persons, days, nights } = req.query;
  
  try {
    const result = await calculatePermitFee(permitTypeId, {
      persons: persons ? parseInt(persons as string) : undefined,
      days: days ? parseInt(days as string) : undefined,
      nights: nights ? parseInt(nights as string) : undefined
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Calculate permit fee error:', e);
    res.status(500).json({ error: 'Failed to calculate permit fee' });
  }
});

// GET /api/permits/portals/:slug/types/:authorityCode/:permitCode - Get specific permit type
router.get('/portals/:slug/types/:authorityCode/:permitCode', async (req, res) => {
  const { slug, authorityCode, permitCode } = req.params;
  
  try {
    const result = await getPermitTypeByCode(slug, authorityCode, permitCode);
    if (!result) {
      return res.status(404).json({ error: 'Permit type not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get permit type error:', e);
    res.status(500).json({ error: 'Failed to get permit type' });
  }
});

// ============ LOCATION PERMIT REQUIREMENTS ============

// GET /api/permits/portals/:slug/locations/:locationId/required - Get required permits for location
router.get('/portals/:slug/locations/:locationId/required', async (req, res) => {
  const { slug, locationId } = req.params;
  
  try {
    const result = await getRequiredPermits(slug, locationId);
    if (!result.location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(result);
  } catch (e: any) {
    console.error('Get required permits error:', e);
    res.status(500).json({ error: 'Failed to get required permits' });
  }
});

export default router;
