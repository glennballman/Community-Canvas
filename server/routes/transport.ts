import { Router } from 'express';
import { 
  getLocations, getLocationByCode, getLocationById,
  getLocationTypes, getAuthorities 
} from '../services/locationService';
import {
  getOperators, getOperatorByCode, getOperatorById,
  getAssets, getAssetById, getOperatorRoutes, findOperatorsForRoute
} from '../services/operatorService';

const router = Router();

router.get('/portals/:slug/locations', async (req, res) => {
  const { slug } = req.params;
  const { type, authority, capability, q, lat, lon, radius, status } = req.query;
  
  try {
    const result = await getLocations({
      portalSlug: slug,
      locationType: type as string,
      authorityType: authority as string,
      capability: capability as string,
      query: q as string,
      nearLat: lat ? parseFloat(lat as string) : undefined,
      nearLon: lon ? parseFloat(lon as string) : undefined,
      radiusKm: radius ? parseFloat(radius as string) : undefined,
      status: status as string
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get locations error:', e);
    res.status(500).json({ error: 'Failed to get locations' });
  }
});

router.get('/portals/:slug/locations/types', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const types = await getLocationTypes(slug);
    res.json({ types });
  } catch (e: any) {
    console.error('Get location types error:', e);
    res.status(500).json({ error: 'Failed to get types' });
  }
});

router.get('/portals/:slug/locations/authorities', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const authorities = await getAuthorities(slug);
    res.json({ authorities });
  } catch (e: any) {
    console.error('Get authorities error:', e);
    res.status(500).json({ error: 'Failed to get authorities' });
  }
});

router.get('/portals/:slug/locations/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const location = await getLocationByCode(slug, code);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ location });
  } catch (e: any) {
    console.error('Get location error:', e);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

router.get('/locations/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const location = await getLocationById(id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ location });
  } catch (e: any) {
    console.error('Get location error:', e);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// ============ OPERATOR ENDPOINTS ============

router.get('/portals/:slug/operators', async (req, res) => {
  const { slug } = req.params;
  const { type, status, q } = req.query;
  
  try {
    const result = await getOperators({
      portalSlug: slug,
      operatorType: type as string,
      status: status as string,
      query: q as string
    });
    
    res.json(result);
  } catch (e: any) {
    console.error('Get operators error:', e);
    res.status(500).json({ error: 'Failed to get operators' });
  }
});

router.get('/portals/:slug/operators/:code', async (req, res) => {
  const { slug, code } = req.params;
  
  try {
    const operator = await getOperatorByCode(slug, code);
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ operator });
  } catch (e: any) {
    console.error('Get operator error:', e);
    res.status(500).json({ error: 'Failed to get operator' });
  }
});

router.get('/operators/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const operator = await getOperatorById(id);
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ operator });
  } catch (e: any) {
    console.error('Get operator error:', e);
    res.status(500).json({ error: 'Failed to get operator' });
  }
});

router.get('/operators/:id/assets', async (req, res) => {
  const { id } = req.params;
  
  try {
    const assets = await getAssets(id);
    res.json({ assets });
  } catch (e: any) {
    console.error('Get assets error:', e);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

router.get('/operators/:id/routes', async (req, res) => {
  const { id } = req.params;
  
  try {
    const routes = await getOperatorRoutes(id);
    res.json({ routes });
  } catch (e: any) {
    console.error('Get routes error:', e);
    res.status(500).json({ error: 'Failed to get routes' });
  }
});

router.get('/assets/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const asset = await getAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ asset });
  } catch (e: any) {
    console.error('Get asset error:', e);
    res.status(500).json({ error: 'Failed to get asset' });
  }
});

router.get('/portals/:slug/route-options', async (req, res) => {
  const { slug } = req.params;
  const { from, to } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to location codes required' });
  }
  
  try {
    const operators = await findOperatorsForRoute(slug, from as string, to as string);
    res.json({ 
      from, 
      to, 
      operators,
      count: operators.length 
    });
  } catch (e: any) {
    console.error('Find route options error:', e);
    res.status(500).json({ error: 'Failed to find route options' });
  }
});

export default router;
