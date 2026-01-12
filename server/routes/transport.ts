import { Router } from 'express';
import { 
  getLocations, getLocationByCode, getLocationById,
  getLocationTypes, getAuthorities 
} from '../services/locationService';

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

export default router;
