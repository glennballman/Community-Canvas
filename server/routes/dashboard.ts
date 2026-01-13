import { Router } from 'express';
import {
  getDashboardSummary, getArrivalsBoard, getDeparturesBoard,
  getHousekeepingBoard, getMaintenanceBoard, getTransportBoard,
  getIncidentsBoard, getQuickStats
} from '../services/dashboardService';

const router = Router();

router.get('/portals/:slug/summary', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;
  
  try {
    const summary = await getDashboardSummary(
      slug, 
      date ? new Date(date as string) : undefined
    );
    
    if (!summary) {
      return res.status(404).json({ error: 'Portal not found' });
    }
    
    res.json(summary);
  } catch (e: any) {
    console.error('Dashboard summary error:', e);
    res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

router.get('/portals/:slug/quick-stats', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const stats = await getQuickStats(slug);
    res.json(stats);
  } catch (e: any) {
    console.error('Quick stats error:', e);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/portals/:slug/arrivals', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;
  
  try {
    const arrivals = await getArrivalsBoard(
      slug,
      date ? new Date(date as string) : undefined
    );
    res.json({ arrivals, count: arrivals.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get arrivals' });
  }
});

router.get('/portals/:slug/departures', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;
  
  try {
    const departures = await getDeparturesBoard(
      slug,
      date ? new Date(date as string) : undefined
    );
    res.json({ departures, count: departures.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get departures' });
  }
});

router.get('/portals/:slug/housekeeping', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;
  
  try {
    const tasks = await getHousekeepingBoard(
      slug,
      date ? new Date(date as string) : undefined
    );
    res.json({ tasks, count: tasks.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get housekeeping board' });
  }
});

router.get('/portals/:slug/maintenance', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const requests = await getMaintenanceBoard(slug);
    res.json({ requests, count: requests.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get maintenance board' });
  }
});

router.get('/portals/:slug/transport', async (req, res) => {
  const { slug } = req.params;
  const { date } = req.query;
  
  try {
    const sailings = await getTransportBoard(
      slug,
      date ? new Date(date as string) : undefined
    );
    res.json({ sailings, count: sailings.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get transport board' });
  }
});

router.get('/portals/:slug/incidents', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const incidents = await getIncidentsBoard(slug);
    res.json({ incidents, count: incidents.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get incidents board' });
  }
});

export default router;
