import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import { api } from "@shared/routes";
import { z } from "zod";
import { getFirecrawlApp } from './lib/firecrawl';
import fs from "fs";
import path from "path";
import { runChamberAudit } from "@shared/chamber-audit";
import { buildNAICSTree, getMembersByNAICSCode, getMembersBySector, getMembersBySubsector } from "@shared/naics-hierarchy";
import { BC_CHAMBERS_OF_COMMERCE } from "@shared/chambers-of-commerce";
import { chamberMembers as staticMembers } from "@shared/chamber-members";
import { getJsonLoadedMembers } from "@shared/chamber-member-registry";
import { getChamberProgressList, getChamberProgressSummary } from "@shared/chamber-progress";
import { createFleetRouter } from "./routes/fleet";
import { createAccommodationsRouter } from "./routes/accommodations";
import stagingRouter from "./routes/staging";
import hostAuthRouter from "./routes/hostAuth";
import hostPropertiesRouter from "./routes/hostProperties";
import authRouter from "./routes/auth";
import hostDashboardRouter from "./routes/host";
import importRouter from "./routes/import";
import civosRouter from "./routes/civos";
import { JobberService, getJobberAuthUrl, exchangeCodeForToken } from "./services/jobber";
import { CompanyCamService, getPhotoUrl } from "./services/companycam";

// Merge static members with JSON-loaded members for consistent data across the app
// IMPORTANT: This function is called per-request to ensure fresh data after JSON file updates
function getAllChamberMembers() {
  const jsonMembers = getJsonLoadedMembers();
  const jsonMemberIds = new Set(jsonMembers.map(m => m.id));
  const uniqueStaticMembers = staticMembers.filter(m => !jsonMemberIds.has(m.id));
  return [...uniqueStaticMembers, ...jsonMembers];
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register fleet management routes
  app.use('/api/v1/fleet', createFleetRouter(pool));

  // Register accommodations routes
  app.use('/api/accommodations', createAccommodationsRouter(pool));

  // Register staging network routes
  app.use('/api/staging', stagingRouter);

  // Register host authentication routes
  app.use('/api/host/auth', hostAuthRouter);

  // Register host property management routes
  app.use('/api/host', hostPropertiesRouter);

  // Register user authentication routes
  app.use('/api/auth', authRouter);

  // Register host dashboard routes (JWT auth)
  app.use('/api/host-dashboard', hostDashboardRouter);

  // Register data import routes (JWT auth)
  app.use('/api/import', importRouter);

  // Register CivOS integration routes
  app.use('/api/civos', civosRouter);

  // Jobber OAuth flow - Start authorization
  app.get('/api/v1/integrations/jobber/auth', (req, res) => {
    const clientId = process.env.JOBBER_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'JOBBER_CLIENT_ID not configured' });
    }
    
    const host = req.headers.host || 'localhost:5000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/v1/integrations/jobber/callback`;
    
    const authUrl = getJobberAuthUrl({
      clientId,
      clientSecret: '',
      redirectUri,
    });
    
    res.redirect(authUrl);
  });

  // Jobber OAuth callback - Exchange code for token
  app.get('/api/v1/integrations/jobber/callback', async (req, res) => {
    try {
      const { code, error } = req.query;
      
      if (error) {
        return res.status(400).send(`
          <html>
            <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <a href="/">Return to app</a>
            </body>
          </html>
        `);
      }
      
      if (!code) {
        return res.status(400).json({ error: 'No authorization code received' });
      }

      const clientId = process.env.JOBBER_CLIENT_ID;
      const clientSecret = process.env.JOBBER_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Jobber credentials not configured' });
      }

      const host = req.headers.host || 'localhost:5000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const redirectUri = `${protocol}://${host}/api/v1/integrations/jobber/callback`;

      const tokens = await exchangeCodeForToken(code as string, {
        clientId,
        clientSecret,
        redirectUri,
      });

      // Display the tokens to the user so they can save them
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto;">
            <h1 style="color: green;">Jobber Authorization Successful!</h1>
            <p>Copy your access token below and add it as JOBBER_ACCESS_TOKEN in your Secrets:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <label style="font-weight: bold; display: block; margin-bottom: 8px;">Access Token:</label>
              <textarea readonly style="width: 100%; height: 80px; font-family: monospace; font-size: 12px;">${tokens.access_token}</textarea>
            </div>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <label style="font-weight: bold; display: block; margin-bottom: 8px;">Refresh Token (save this too):</label>
              <textarea readonly style="width: 100%; height: 80px; font-family: monospace; font-size: 12px;">${tokens.refresh_token}</textarea>
            </div>
            <p><strong>Token expires in:</strong> ${Math.floor(tokens.expires_in / 3600)} hours</p>
            <p>After adding the secret, <a href="/trip-timeline-demo">return to the app</a> to test the integration.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Jobber OAuth callback error:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1>Token Exchange Failed</h1>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/">Return to app</a>
          </body>
        </html>
      `);
    }
  });

  // Jobber connection test endpoint
  app.get('/api/v1/integrations/jobber/test', async (req, res) => {
    try {
      const accessToken = process.env.JOBBER_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          connected: false,
          error: 'JOBBER_ACCESS_TOKEN not configured'
        });
      }

      const jobber = new JobberService({ accessToken });
      const result = await jobber.testConnection();
      
      res.json({
        connected: true,
        account: result,
      });
    } catch (error) {
      console.error('Jobber connection test error:', error);
      res.status(500).json({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Jobber integration endpoint
  app.get('/api/v1/integrations/jobber/job/:jobNumber', async (req, res) => {
    try {
      const { jobNumber } = req.params;
      
      const accessToken = process.env.JOBBER_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          error: 'Jobber not configured',
          message: 'JOBBER_ACCESS_TOKEN environment variable not set'
        });
      }

      const jobber = new JobberService({ accessToken });
      const job = await jobber.getJobByNumber(jobNumber);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error) {
      console.error('Jobber API error:', error);
      res.status(500).json({ error: 'Failed to fetch job from Jobber' });
    }
  });

  // Jobber jobs for date range
  app.get('/api/v1/integrations/jobber/jobs', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate query parameters required' });
      }
      
      const accessToken = process.env.JOBBER_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          error: 'Jobber not configured',
          message: 'JOBBER_ACCESS_TOKEN environment variable not set'
        });
      }

      const jobber = new JobberService({ accessToken });
      const jobs = await jobber.getJobsForDateRange(startDate as string, endDate as string);
      
      res.json({ jobs });
    } catch (error) {
      console.error('Jobber API error:', error);
      res.status(500).json({ error: 'Failed to fetch jobs from Jobber' });
    }
  });

  // CompanyCam integration endpoints
  app.get('/api/v1/integrations/companycam/test', async (req, res) => {
    try {
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          connected: false,
          error: 'COMPANYCAM_ACCESS_TOKEN not configured'
        });
      }

      const companycam = new CompanyCamService({ accessToken });
      const result = await companycam.testConnection();
      
      res.json(result);
    } catch (error) {
      console.error('CompanyCam connection test error:', error);
      res.status(500).json({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/v1/integrations/companycam/project/:projectId/photos', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { limit = '10' } = req.query;
      
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ error: 'CompanyCam not configured' });
      }

      const companycam = new CompanyCamService({ accessToken });
      const photos = await companycam.getProjectPhotos(projectId, 1, Number(limit));
      
      const formattedPhotos = photos.map((photo) => ({
        id: photo.id,
        url: getPhotoUrl(photo.uris, 'original') || getPhotoUrl(photo.uris, 'web'),
        thumbnailUrl: getPhotoUrl(photo.uris, 'thumbnail'),
        caption: photo.creator_name || '',
        timestamp: photo.captured_at,
        tags: photo.tags?.map((t) => t.name) || [],
        source: 'companycam',
      }));

      res.json(formattedPhotos);
    } catch (error) {
      console.error('CompanyCam API error:', error);
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  });

  app.get('/api/v1/integrations/companycam/search', async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Search query (q) is required' });
      }
      
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ error: 'CompanyCam not configured' });
      }

      const companycam = new CompanyCamService({ accessToken });
      const projects = await companycam.searchProjects(String(q));

      res.json(projects);
    } catch (error) {
      console.error('CompanyCam API error:', error);
      res.status(500).json({ error: 'Failed to search projects' });
    }
  });

  app.get('/api/v1/integrations/companycam/projects', async (req, res) => {
    try {
      const { page = '1', limit = '50' } = req.query;
      
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ error: 'CompanyCam not configured' });
      }

      const companycam = new CompanyCamService({ accessToken });
      const projects = await companycam.getProjects(Number(page), Number(limit));

      res.json(projects);
    } catch (error) {
      console.error('CompanyCam API error:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.get(api.snapshots.getLatest.path, async (req, res) => {
    try {
      const { cityName } = req.params;
      const snapshot = await storage.getLatestSnapshot(cityName);
      if (!snapshot) {
        return res.status(404).json({ message: 'No snapshot found for this location' });
      }
      res.json({
        success: true,
        data: snapshot.data,
        timestamp: snapshot.createdAt?.toISOString() || new Date().toISOString()
      });
    } catch (error) {
      console.error("Fetch snapshot error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.snapshots.refresh.path, async (req, res) => {
    try {
      const { location } = api.snapshots.refresh.input.parse(req.body);
      const apiKey = process.env.FIRECRAWL_API_KEY;

      if (!apiKey || apiKey === 'your-api-key') {
        return res.status(400).json({ message: "Firecrawl API key not configured" });
      }

      const firecrawl = await getFirecrawlApp(apiKey);

      const prompt = `Extract real-time status updates and snapshots for ${location}. 
      Structure the response into a 'categories' object where keys are standard IDs (emergency, power, water, ferry, traffic, transit, airport, weather, tides, air_quality, health, events, parking, construction, economic, fire) and values are arrays of status objects.
      
      Standard Status Object:
      {
        "label": "Name of specific service/area",
        "status": "Short status string (Operational, Outage, Delay, etc)",
        "status_citation": "URL to source",
        "details": "Brief additional context",
        "severity": "info" | "warning" | "critical"
      }

      Focus on major municipal services, transit lines, and utilities. If data for a category isn't found, return an empty array for that key.`;

      const result = await firecrawl.extract([
        "https://vancouver.ca",
        "https://www.bchydro.com/outages",
        "https://drivebc.ca",
        "https://www.bcferries.com",
        "https://translink.ca"
      ], {
        prompt,
        schema: z.object({
          location: z.string(),
          categories: z.record(z.string(), z.array(z.object({
            label: z.string(),
            status: z.string(),
            status_citation: z.string().optional(),
            details: z.string().optional(),
            severity: z.enum(["info", "warning", "critical"]).optional()
          })))
        })
      });

      if (result.success && result.data) {
        await storage.createSnapshot({
          location,
          data: {
            location,
            timestamp: new Date().toISOString(),
            categories: result.data.categories as any
          }
        });
        return res.json({ success: true, message: "Data refreshed from Firecrawl" });
      } else {
        throw new Error(result.error || "Firecrawl extraction failed");
      }

    } catch (err) {
      console.error("Refresh error:", err);
      res.status(500).json({ message: "Failed to refresh data: " + (err as Error).message });
    }
  });

  app.get("/api/admin/chamber-audit", async (req, res) => {
    try {
      const auditResults = runChamberAudit();
      res.json(auditResults);
    } catch (error) {
      console.error("Chamber audit error:", error);
      res.status(500).json({ message: "Failed to run chamber audit" });
    }
  });

  app.get("/api/naics/tree", async (req, res) => {
    try {
      const tree = buildNAICSTree();
      res.json(tree);
    } catch (error) {
      console.error("NAICS tree error:", error);
      res.status(500).json({ message: "Failed to build NAICS tree" });
    }
  });

  app.get("/api/naics/sector/:sectorCode/members", async (req, res) => {
    try {
      const { sectorCode } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = getMembersBySector(sectorCode, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error("NAICS sector members error:", error);
      res.status(500).json({ message: "Failed to get sector members" });
    }
  });

  app.get("/api/naics/subsector/:subsectorCode/members", async (req, res) => {
    try {
      const { subsectorCode } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = getMembersBySubsector(subsectorCode, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error("NAICS subsector members error:", error);
      res.status(500).json({ message: "Failed to get subsector members" });
    }
  });

  app.get("/api/naics/code/:naicsCode/members", async (req, res) => {
    try {
      const { naicsCode } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = getMembersByNAICSCode(naicsCode, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error("NAICS code members error:", error);
      res.status(500).json({ message: "Failed to get code members" });
    }
  });

  app.get("/api/chambers/locations", async (req, res) => {
    try {
      const allMembers = getAllChamberMembers();
      const memberCountByChamberId = new Map<string, number>();
      for (const member of allMembers) {
        const count = memberCountByChamberId.get(member.chamberId) || 0;
        memberCountByChamberId.set(member.chamberId, count + 1);
      }

      // Get progress status for each chamber with overrides applied
      const progressList = getChamberProgressList();
      const overrides = await storage.getChamberOverrides();
      const overridesMap = new Map(overrides.map(o => [o.chamberId, o]));
      
      // Calculate status with overrides
      const statusByChamberId = new Map<string, string>();
      for (const p of progressList) {
        const override = overridesMap.get(p.chamberId);
        if (override && p.actualMembers > 0) {
          const expectedMembers = override.expectedMembers ?? p.expectedMembers;
          const estimatedMembers = override.estimatedMembers ?? p.estimatedMembers;
          const MEMBER_THRESHOLD = 30;
          const PERCENT_COMPLETE_THRESHOLD = 80;
          const hasSufficientMembers = p.actualMembers >= MEMBER_THRESHOLD;
          const targetMembers = expectedMembers !== null ? expectedMembers : estimatedMembers;
          const percentComplete = targetMembers > 0 ? Math.floor((p.actualMembers / targetMembers) * 100) : 0;
          const hasSufficientPercentComplete = percentComplete >= PERCENT_COMPLETE_THRESHOLD;
          if (hasSufficientMembers && hasSufficientPercentComplete) {
            statusByChamberId.set(p.chamberId, 'completed');
          } else {
            statusByChamberId.set(p.chamberId, 'partial');
          }
        } else {
          statusByChamberId.set(p.chamberId, p.status);
        }
      }

      const locations = BC_CHAMBERS_OF_COMMERCE.map(chamber => ({
        id: chamber.id,
        name: chamber.name,
        lat: chamber.location.lat,
        lng: chamber.location.lng,
        memberCount: memberCountByChamberId.get(chamber.id) || 0,
        status: statusByChamberId.get(chamber.id) || 'pending',
        website: chamber.website || null,
      })).filter(c => c.memberCount > 0);

      res.json(locations);
    } catch (error) {
      console.error("Chamber locations error:", error);
      res.status(500).json({ message: "Failed to get chamber locations" });
    }
  });

  app.get("/api/config/mapbox-token", async (req, res) => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      res.json({ token });
    } else {
      res.status(404).json({ message: "Mapbox token not configured" });
    }
  });

  app.get("/api/admin/chamber-progress", async (req, res) => {
    try {
      const progressList = getChamberProgressList();
      const overrides = await storage.getChamberOverrides();
      const overridesMap = new Map(overrides.map(o => [o.chamberId, o]));
      
      // Apply overrides to progress list and recalculate status
      const adjustedProgressList = progressList.map(p => {
        const override = overridesMap.get(p.chamberId);
        if (!override) return p;
        
        const expectedMembers = override.expectedMembers ?? p.expectedMembers;
        const estimatedMembers = override.estimatedMembers ?? p.estimatedMembers;
        
        // Recalculate status based on overrides
        const MEMBER_THRESHOLD = 30;
        const PERCENT_COMPLETE_THRESHOLD = 80;
        const partialReasons: ('below_member_threshold' | 'below_percent_complete')[] = [];
        let status = p.status;
        
        if (p.actualMembers > 0) {
          const hasSufficientMembers = p.actualMembers >= MEMBER_THRESHOLD;
          const targetMembers = expectedMembers !== null ? expectedMembers : estimatedMembers;
          const percentComplete = targetMembers > 0 ? Math.floor((p.actualMembers / targetMembers) * 100) : 0;
          const hasSufficientPercentComplete = percentComplete >= PERCENT_COMPLETE_THRESHOLD;
          
          if (!hasSufficientMembers) partialReasons.push('below_member_threshold');
          if (!hasSufficientPercentComplete) partialReasons.push('below_percent_complete');
          
          if (hasSufficientMembers && hasSufficientPercentComplete) {
            status = 'completed';
          } else {
            status = 'partial';
          }
        }
        
        return {
          ...p,
          expectedMembers,
          estimatedMembers,
          status,
          partialReasons,
        };
      });
      
      // Recalculate summary based on adjusted list
      const summary = {
        total: adjustedProgressList.length,
        completed: adjustedProgressList.filter(p => p.status === 'completed').length,
        partial: adjustedProgressList.filter(p => p.status === 'partial').length,
        pending: adjustedProgressList.filter(p => p.status === 'pending').length,
        inProgress: adjustedProgressList.filter(p => p.status === 'in_progress').length,
        blocked: adjustedProgressList.filter(p => p.status === 'blocked').length,
        completedPercentage: adjustedProgressList.length > 0 ? Math.round((adjustedProgressList.filter(p => p.status === 'completed').length / adjustedProgressList.length) * 100) : 0,
        neededForThreshold: Math.max(0, Math.ceil(adjustedProgressList.length * 0.8) - adjustedProgressList.filter(p => p.status === 'completed').length),
      };
      
      res.json({ progressList: adjustedProgressList, summary });
    } catch (error) {
      console.error("Chamber progress error:", error);
      res.status(500).json({ message: "Failed to get chamber progress" });
    }
  });

  app.get("/api/admin/chamber-progress/summary", async (req, res) => {
    try {
      const summary = getChamberProgressSummary();
      res.json(summary);
    } catch (error) {
      console.error("Chamber progress summary error:", error);
      res.status(500).json({ message: "Failed to get chamber progress summary" });
    }
  });

  // Chamber overrides endpoints
  app.get("/api/admin/chamber-overrides", async (req, res) => {
    try {
      const overrides = await storage.getChamberOverrides();
      res.json(overrides);
    } catch (error) {
      console.error("Chamber overrides error:", error);
      res.status(500).json({ message: "Failed to get chamber overrides" });
    }
  });

  app.put("/api/admin/chamber-overrides/:chamberId", async (req, res) => {
    try {
      const { chamberId } = req.params;
      const { expectedMembers, estimatedMembers } = req.body;
      
      const override = await storage.upsertChamberOverride(
        chamberId,
        expectedMembers !== undefined ? expectedMembers : null,
        estimatedMembers !== undefined ? estimatedMembers : null
      );
      
      res.json(override);
    } catch (error) {
      console.error("Chamber override update error:", error);
      res.status(500).json({ message: "Failed to update chamber override" });
    }
  });

  // Allowlist of valid documentation files for security
  const ALLOWED_DOC_FILES = ['DATA_COLLECTION.md', 'ARCHITECTURE.md', 'index.md'];
  
  // Serve raw documentation files - uses strict allowlist for security
  app.get("/docs/:filename", (req, res) => {
    const { filename } = req.params;
    
    // Validate against allowlist - prevents directory traversal and arbitrary file access
    if (!ALLOWED_DOC_FILES.includes(filename)) {
      return res.status(404).json({ message: "Documentation file not found" });
    }
    
    const filePath = path.join(process.cwd(), 'docs', filename);
    
    try {
      // Verify file exists and is within docs directory
      const realPath = fs.realpathSync(filePath);
      const docsDir = fs.realpathSync(path.join(process.cwd(), 'docs'));
      
      if (!realPath.startsWith(docsDir)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const content = fs.readFileSync(realPath, 'utf-8');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
      res.send(content);
    } catch (error) {
      console.error("Doc file read error:", error);
      return res.status(404).json({ message: "Documentation file not found" });
    }
  });

  // List available documentation files
  app.get("/api/docs", (req, res) => {
    try {
      const files = ALLOWED_DOC_FILES.map(f => ({
        name: f,
        path: `/docs/${f}`,
        title: f.replace('.md', '').replace(/_/g, ' ')
      }));
      
      res.json({ files });
    } catch (error) {
      console.error("Docs list error:", error);
      res.status(500).json({ message: "Failed to list documentation files" });
    }
  });

  // List available backups
  app.get("/api/backups", (req, res) => {
    try {
      const backupsDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupsDir)) {
        return res.json({ backups: [] });
      }
      
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.tar.gz'))
        .map(f => {
          const stats = fs.statSync(path.join(backupsDir, f));
          return {
            name: f,
            size: stats.size,
            created: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      res.json({ backups: files });
    } catch (error) {
      console.error("Backups list error:", error);
      res.status(500).json({ message: "Failed to list backups" });
    }
  });

  // Download a backup file
  app.get("/api/backups/:filename", (req, res) => {
    try {
      const { filename } = req.params;
      
      // Security: only allow .tar.gz files from backups directory
      if (!filename.endsWith('.tar.gz') || filename.includes('..')) {
        return res.status(400).json({ message: "Invalid backup filename" });
      }
      
      const filePath = path.join(process.cwd(), 'backups', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Backup not found" });
      }
      
      // Verify file is within backups directory
      const realPath = fs.realpathSync(filePath);
      const backupsDir = fs.realpathSync(path.join(process.cwd(), 'backups'));
      
      if (!realPath.startsWith(backupsDir)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(realPath);
    } catch (error) {
      console.error("Backup download error:", error);
      res.status(500).json({ message: "Failed to download backup" });
    }
  });

  // ============================================================================
  // Real-Time Status API Endpoints (v1)
  // ============================================================================

  // GET /api/v1/status/summary - Dashboard status cards data
  app.get("/api/v1/status/summary", async (req, res) => {
    try {
      // Get alert counts by severity
      const alertsResult = await storage.query(`
        SELECT 
          COUNT(*) FILTER (WHERE severity::text = 'critical' OR severity::text = 'emergency') as critical,
          COUNT(*) FILTER (WHERE severity::text = 'major') as major,
          COUNT(*) FILTER (WHERE severity::text = 'warning') as warning,
          COUNT(*) FILTER (WHERE severity::text = 'advisory') as advisory,
          COUNT(*) FILTER (WHERE severity::text = 'minor' OR severity::text = 'info') as minor,
          COUNT(*) as total
        FROM alerts 
        WHERE is_active = true
      `);
      
      // Get ferry status from entities (BC Ferries routes)
      const ferriesResult = await storage.query(`
        SELECT 
          COUNT(*) FILTER (WHERE configuration->>'current_status' = 'delayed') as delays,
          COUNT(*) FILTER (WHERE configuration->>'current_status' = 'on_time') as on_time
        FROM entities 
        WHERE slug LIKE 'bcferries-route-%'
      `);
      
      // Get road events by type
      const roadsResult = await storage.query(`
        SELECT 
          COUNT(*) FILTER (WHERE severity::text = 'major' OR severity::text = 'critical') as closures,
          COUNT(*) FILTER (WHERE alert_type = 'closure' AND severity::text NOT IN ('major', 'critical')) as incidents,
          COUNT(*) FILTER (WHERE details->>'event_type' = 'CONSTRUCTION') as construction,
          COUNT(*) as total
        FROM alerts 
        WHERE is_active = true AND alert_type = 'closure'
      `);
      
      // Weather placeholder (can be enhanced with actual weather data)
      const weather = {
        temperature: -2,
        condition: 'Light Snow',
        warnings: 0
      };
      
      res.json({
        alerts: {
          critical: parseInt(alertsResult.rows[0]?.critical || '0', 10),
          major: parseInt(alertsResult.rows[0]?.major || '0', 10),
          warning: parseInt(alertsResult.rows[0]?.warning || '0', 10),
          advisory: parseInt(alertsResult.rows[0]?.advisory || '0', 10),
          minor: parseInt(alertsResult.rows[0]?.minor || '0', 10),
          total: parseInt(alertsResult.rows[0]?.total || '0', 10)
        },
        ferries: {
          status: parseInt(ferriesResult.rows[0]?.delays || '0', 10) > 0 ? 'delayed' : 'on_time',
          delays: parseInt(ferriesResult.rows[0]?.delays || '0', 10),
          onTime: parseInt(ferriesResult.rows[0]?.on_time || '0', 10)
        },
        weather,
        roads: {
          closures: parseInt(roadsResult.rows[0]?.closures || '0', 10),
          incidents: parseInt(roadsResult.rows[0]?.incidents || '0', 10),
          construction: parseInt(roadsResult.rows[0]?.construction || '0', 10),
          total: parseInt(roadsResult.rows[0]?.total || '0', 10)
        }
      });
    } catch (error) {
      console.error("Status summary error:", error);
      res.status(500).json({ message: "Failed to fetch status summary" });
    }
  });

  // GET /api/v1/status/overview - Dashboard status summary
  app.get("/api/v1/status/overview", async (req, res) => {
    try {
      const overview = await storage.query(`
        SELECT 
          (SELECT COUNT(*) FROM alerts WHERE severity = 'major' AND is_active = true) as critical_alerts,
          (SELECT COUNT(*) FROM alerts WHERE is_active = true) as total_alerts,
          (SELECT COUNT(*) FROM entity_snapshots WHERE snapshot_time > NOW() - INTERVAL '1 hour') as recent_updates,
          (SELECT MAX(completed_at) FROM pipeline_runs WHERE status = 'completed') as last_pipeline_run,
          (SELECT COUNT(*) FROM infrastructure_entities) as total_entities,
          (SELECT COUNT(DISTINCT region_id) FROM alerts WHERE is_active = true AND region_id IS NOT NULL) as regions_affected
      `);
      
      res.json(overview.rows[0]);
    } catch (error) {
      console.error("Status overview error:", error);
      res.status(500).json({ message: "Failed to fetch status overview" });
    }
  });

  // GET /api/v1/status/region/:regionId - Status for a specific region
  app.get("/api/v1/status/region/:regionId", async (req, res) => {
    try {
      const { regionId } = req.params;
      
      // Get region info
      const regionResult = await storage.query(`
        SELECT id, name, region_type, parent_id, centroid_lat, centroid_lon
        FROM geo_regions WHERE id = $1
      `, [regionId]);
      
      if (regionResult.rows.length === 0) {
        return res.status(404).json({ message: "Region not found" });
      }
      
      const region = regionResult.rows[0];
      
      // Get active alerts for this region
      const alertsResult = await storage.query(`
        SELECT id, alert_type, severity, signal_type, title, summary, 
               latitude, longitude, effective_from, effective_until, details
        FROM alerts 
        WHERE region_id = $1 AND is_active = true
        ORDER BY 
          CASE severity 
            WHEN 'emergency' THEN 1 WHEN 'critical' THEN 2 WHEN 'major' THEN 3 
            WHEN 'warning' THEN 4 WHEN 'advisory' THEN 5 WHEN 'minor' THEN 6 ELSE 7 
          END,
          created_at DESC
      `, [regionId]);
      
      // Get road events in this region
      const roadsResult = await storage.query(`
        SELECT id, alert_type, title, summary, details, latitude, longitude
        FROM alerts 
        WHERE region_id = $1 AND alert_type = 'road_event' AND is_active = true
        ORDER BY created_at DESC
        LIMIT 20
      `, [regionId]);
      
      // Get weather alerts for this region
      const weatherResult = await storage.query(`
        SELECT id, title, summary, severity, details
        FROM alerts 
        WHERE region_id = $1 AND alert_type = 'weather' AND is_active = true
        ORDER BY severity DESC, created_at DESC
        LIMIT 10
      `, [regionId]);
      
      // Get infrastructure entities in this region
      const entitiesResult = await storage.query(`
        SELECT id, name, entity_type, category, latitude, longitude, status
        FROM infrastructure_entities
        WHERE region_id = $1
        ORDER BY category, name
        LIMIT 100
      `, [regionId]);
      
      res.json({
        region,
        alerts: alertsResult.rows,
        roads: roadsResult.rows,
        weather: weatherResult.rows,
        entities: entitiesResult.rows
      });
    } catch (error) {
      console.error("Region status error:", error);
      res.status(500).json({ message: "Failed to fetch region status" });
    }
  });

  // GET /api/v1/alerts/active - All active alerts
  app.get("/api/v1/alerts/active", async (req, res) => {
    try {
      const { type, severity, region } = req.query;
      
      let query = `
        SELECT a.*, gr.name as region_name
        FROM alerts a
        LEFT JOIN geo_regions gr ON a.region_id = gr.id
        WHERE a.is_active = true
        AND (a.effective_until IS NULL OR a.effective_until > NOW())
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (type) {
        query += ` AND a.alert_type = $${paramIndex++}`;
        params.push(type);
      }
      
      if (severity) {
        query += ` AND a.severity = $${paramIndex++}::alert_severity`;
        params.push(severity);
      }
      
      if (region) {
        query += ` AND a.region_id = $${paramIndex++}`;
        params.push(region);
      }
      
      query += `
        ORDER BY 
          CASE a.severity 
            WHEN 'emergency' THEN 1
            WHEN 'critical' THEN 2 
            WHEN 'major' THEN 3 
            WHEN 'warning' THEN 4
            WHEN 'advisory' THEN 5
            WHEN 'minor' THEN 6
            ELSE 7 
          END,
          a.created_at DESC
        LIMIT 200
      `;
      
      const result = await storage.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Active alerts error:", error);
      res.status(500).json({ message: "Failed to fetch active alerts" });
    }
  });

  // GET /api/v1/alerts/count - Count of active alerts
  app.get("/api/v1/alerts/count", async (req, res) => {
    try {
      const result = await storage.query(`
        SELECT COUNT(*) as count
        FROM alerts 
        WHERE is_active = true
        AND (effective_until IS NULL OR effective_until > NOW())
      `);
      
      res.json({ count: parseInt(result.rows[0]?.count || '0', 10) });
    } catch (error) {
      console.error("Alerts count error:", error);
      res.status(500).json({ message: "Failed to count alerts" });
    }
  });

  // GET /api/v1/alerts/by-type/:alertType - Alerts filtered by type
  app.get("/api/v1/alerts/by-type/:alertType", async (req, res) => {
    try {
      const { alertType } = req.params;
      
      const result = await storage.query(`
        SELECT a.*, gr.name as region_name
        FROM alerts a
        LEFT JOIN geo_regions gr ON a.region_id = gr.id
        WHERE a.alert_type = $1 AND a.is_active = true
        ORDER BY a.created_at DESC
        LIMIT 100
      `, [alertType]);
      
      res.json(result.rows);
    } catch (error) {
      console.error("Alerts by type error:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // GET /api/v1/entities - List entities with optional filtering
  app.get("/api/v1/entities", async (req, res) => {
    try {
      const { type, region, limit = '50' } = req.query;
      const params: any[] = [];
      let paramIndex = 1;
      
      let query = `
        SELECT id, name, slug, entity_type_id, 
               latitude, longitude, primary_region_id as region_id, 
               configuration as metadata, website, description
        FROM entities
        WHERE 1=1
      `;
      
      if (type) {
        query += ` AND entity_type_id = $${paramIndex++}`;
        params.push(type);
      }
      
      if (region && region !== 'bc') {
        query += ` AND primary_region_id = $${paramIndex++}`;
        params.push(region);
      }
      
      query += ` ORDER BY name LIMIT $${paramIndex++}`;
      params.push(parseInt(limit as string, 10));
      
      const result = await storage.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Entities list error:", error);
      res.status(500).json({ message: "Failed to fetch entities" });
    }
  });

  // GET /api/v1/entities/geo - Get entities with coordinates for map
  app.get("/api/v1/entities/geo", async (req, res) => {
    try {
      const { region, category, type, limit = '15000' } = req.query;
      const params: (string | number)[] = [];
      let paramIndex = 1;
      
      let query = `
        SELECT 
          e.id, e.slug, e.name, e.entity_type_id,
          et.category_id as category, e.latitude, e.longitude,
          gr.name as region_name
        FROM entities e
        LEFT JOIN entity_types et ON e.entity_type_id = et.id
        LEFT JOIN geo_regions gr ON e.primary_region_id = gr.id
        WHERE e.latitude IS NOT NULL 
          AND e.longitude IS NOT NULL
      `;
      
      if (region && region !== 'bc') {
        query += ` AND e.primary_region_id = $${paramIndex++}`;
        params.push(region as string);
      }
      
      if (category) {
        query += ` AND et.category_id = $${paramIndex++}`;
        params.push(category as string);
      }
      
      if (type) {
        query += ` AND e.entity_type_id = $${paramIndex++}`;
        params.push(type as string);
      }
      
      query += ` LIMIT $${paramIndex++}`;
      params.push(parseInt(limit as string, 10));
      
      const result = await storage.query(query, params);
      res.json({ entities: result.rows, total: result.rows.length });
    } catch (error) {
      console.error("Geo entities error:", error);
      res.status(500).json({ message: "Failed to fetch geo entities" });
    }
  });

  // GET /api/v1/entity/:id/status - Current status for a specific entity
  app.get("/api/v1/entity/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get entity info
      const entityResult = await storage.query(`
        SELECT * FROM infrastructure_entities WHERE id = $1
      `, [id]);
      
      if (entityResult.rows.length === 0) {
        return res.status(404).json({ message: "Entity not found" });
      }
      
      // Get latest snapshot
      const snapshotResult = await storage.query(`
        SELECT * FROM entity_snapshots
        WHERE entity_id = $1
        ORDER BY snapshot_time DESC
        LIMIT 1
      `, [id]);
      
      // Get any active alerts for this entity's location
      const entity = entityResult.rows[0];
      let alerts: any[] = [];
      
      if (entity.latitude && entity.longitude) {
        const alertsResult = await storage.query(`
          SELECT id, alert_type, severity, title, summary
          FROM alerts
          WHERE is_active = true
          AND latitude IS NOT NULL
          AND (
            (latitude - $1)^2 + (longitude - $2)^2 < 0.01
          )
          LIMIT 10
        `, [entity.latitude, entity.longitude]);
        alerts = alertsResult.rows;
      }
      
      res.json({
        entity: entityResult.rows[0],
        snapshot: snapshotResult.rows[0] || null,
        nearbyAlerts: alerts
      });
    } catch (error) {
      console.error("Entity status error:", error);
      res.status(500).json({ message: "Failed to fetch entity status" });
    }
  });

  // GET /api/v1/pipelines/status - Pipeline scheduler status
  app.get("/api/v1/pipelines/status", async (req, res) => {
    try {
      // Get recent pipeline runs
      const runsResult = await storage.query(`
        SELECT data_source_id, status, started_at, completed_at, 
               records_processed, records_created, records_updated, error_message
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT 50
      `);
      
      // Group by pipeline
      const pipelineStatus: Record<string, any> = {};
      for (const run of runsResult.rows) {
        if (!pipelineStatus[run.data_source_id]) {
          pipelineStatus[run.data_source_id] = {
            lastRun: run,
            recentRuns: []
          };
        }
        pipelineStatus[run.data_source_id].recentRuns.push(run);
      }
      
      res.json(pipelineStatus);
    } catch (error) {
      console.error("Pipeline status error:", error);
      res.status(500).json({ message: "Failed to fetch pipeline status" });
    }
  });

  // POST /api/v1/pipelines/:id/run - Manually trigger a pipeline run
  app.post("/api/v1/pipelines/:id/run", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Import dynamically to avoid circular dependency
      const { runPipeline } = await import('./pipelines');
      const result = await runPipeline(id);
      
      if (result) {
        res.json({ success: true, result });
      } else {
        res.status(400).json({ success: false, message: "Pipeline not found or disabled" });
      }
    } catch (error) {
      console.error("Pipeline run error:", error);
      res.status(500).json({ message: "Failed to run pipeline" });
    }
  });

  // ==========================================
  // ROAD TRIPS API
  // ==========================================
  
  // GET /api/v1/trips - List all trips with filters
  app.get("/api/v1/trips", async (req, res) => {
    try {
      const { category, season, region, difficulty, search, sort = 'popularity', limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT t.*, COUNT(s.id) as segment_count
        FROM road_trips t
        LEFT JOIN trip_segments s ON t.id = s.trip_id
        WHERE t.is_published = true
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (category) {
        params.push(category);
        query += ` AND t.category = $${paramIndex++}`;
      }
      if (season) {
        params.push(season);
        query += ` AND $${paramIndex++} = ANY(t.seasons)`;
      }
      if (region) {
        params.push(region);
        query += ` AND t.region = $${paramIndex++}`;
      }
      if (difficulty) {
        params.push(difficulty);
        query += ` AND t.difficulty = $${paramIndex++}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (t.title ILIKE $${paramIndex} OR t.tagline ILIKE $${paramIndex} OR t.region ILIKE $${paramIndex})`;
        paramIndex++;
      }
      
      query += ` GROUP BY t.id`;
      
      switch (sort) {
        case 'rating': query += ` ORDER BY t.rating DESC, t.rating_count DESC`; break;
        case 'cost_low': query += ` ORDER BY t.cost_budget ASC`; break;
        case 'duration': query += ` ORDER BY t.duration_min_hours ASC`; break;
        case 'newest': query += ` ORDER BY t.created_at DESC`; break;
        default: query += ` ORDER BY t.popularity_score DESC, t.rating_count DESC`;
      }
      
      params.push(limit, offset);
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      
      const result = await storage.query(query, params);
      
      const countResult = await storage.query(`SELECT COUNT(*) FROM road_trips WHERE is_published = true`);
      
      res.json({
        trips: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      console.error('Error fetching trips:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });

  // GET /api/v1/trips/featured - Featured trips
  app.get("/api/v1/trips/featured", async (_req, res) => {
    try {
      const result = await storage.query(`
        SELECT * FROM road_trips 
        WHERE is_published = true AND is_featured = true 
        ORDER BY popularity_score DESC 
        LIMIT 5
      `);
      res.json({ trips: result.rows });
    } catch (error) {
      console.error('Error fetching featured trips:', error);
      res.status(500).json({ error: 'Failed to fetch featured trips' });
    }
  });

  // GET /api/v1/trips/:id - Get single trip with segments
  app.get("/api/v1/trips/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if id looks like a UUID or a slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let tripResult;
      if (isUuid) {
        tripResult = await storage.query(
          `SELECT * FROM road_trips WHERE id = $1`,
          [id]
        );
      } else {
        // Treat as slug
        tripResult = await storage.query(
          `SELECT * FROM road_trips WHERE slug = $1 OR id = $1`,
          [id]
        );
      }
      
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      const trip = tripResult.rows[0];
      
      const segmentsResult = await storage.query(
        `SELECT * FROM trip_segments WHERE trip_id = $1 ORDER BY segment_order`,
        [trip.id]
      );
      
      // Track view
      await storage.query(
        `INSERT INTO trip_analytics (trip_id, event_type) VALUES ($1, 'view')`,
        [trip.id]
      ).catch(() => {});
      
      res.json({ ...trip, segments: segmentsResult.rows });
    } catch (error) {
      console.error('Error fetching trip:', error);
      res.status(500).json({ error: 'Failed to fetch trip' });
    }
  });

  // GET /api/v1/trips/:id/conditions - Live route conditions
  app.get("/api/v1/trips/:id/conditions", async (req, res) => {
    try {
      const { id } = req.params;
      
      const tripResult = await storage.query(
        `SELECT * FROM road_trips WHERE id = $1 OR slug = $1`,
        [id]
      );
      
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      const trip = tripResult.rows[0];
      
      // Get segments to check for ferry requirements
      const segmentsResult = await storage.query(
        `SELECT details FROM trip_segments WHERE trip_id = $1`,
        [trip.id]
      );
      
      // Check if trip has ferry segments
      const hasFerry = segmentsResult.rows.some((s: any) => s.details?.mode === 'ferry');
      
      // Get region-appropriate weather based on trip destination
      const regionWeather: Record<string, { temperature: number; condition: string; wind_speed: number }> = {
        'whistler-ski-day': { temperature: -5, condition: 'Light Snow', wind_speed: 15 },
        'tofino-storm-watching': { temperature: 8, condition: 'Heavy Rain', wind_speed: 45 },
        'okanagan-wine-trail': { temperature: 12, condition: 'Partly Cloudy', wind_speed: 8 },
        'sunshine-coast-loop': { temperature: 10, condition: 'Overcast', wind_speed: 20 },
        'harrison-hot-springs': { temperature: 6, condition: 'Cloudy', wind_speed: 12 }
      };
      
      const weather = regionWeather[trip.id] || { temperature: 5, condition: 'Variable', wind_speed: 10 };
      
      const alertsResult = await storage.query(
        `SELECT * FROM alerts WHERE is_active = true ORDER BY severity DESC LIMIT 10`
      ).catch(() => ({ rows: [] }));
      
      // Determine ferry status
      let ferryStatus = null;
      if (hasFerry) {
        ferryStatus = { status: 'Operating', delays: null, next_sailing: '15 min' };
      }
      
      res.json({
        trip_id: id,
        alerts: alertsResult.rows,
        weather,
        road_status: alertsResult.rows.length > 0 ? 'Caution' : 'Clear',
        ferry_status: ferryStatus,
        overall_status: alertsResult.rows.length > 0 ? 'caution' : 'good',
        checked_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching conditions:', error);
      res.status(500).json({ error: 'Failed to fetch conditions' });
    }
  });

  // GET /api/v1/trips/:id/webcams - Get webcams for trip route
  app.get("/api/v1/trips/:id/webcams", async (req, res) => {
    try {
      const { id } = req.params;
      
      const segmentsResult = await storage.query(
        `SELECT segment_order, title, webcam_ids FROM trip_segments WHERE trip_id = $1 ORDER BY segment_order`,
        [id]
      );
      
      const allWebcamIds = segmentsResult.rows.flatMap((s: any) => s.webcam_ids || []).filter(Boolean);
      
      let webcams: any[] = [];
      if (allWebcamIds.length > 0) {
        const webcamsResult = await storage.query(
          `SELECT id, name, slug, configuration FROM entities WHERE id = ANY($1::uuid[])`,
          [allWebcamIds]
        ).catch(() => ({ rows: [] }));
        webcams = webcamsResult.rows.map((w: any) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          image_url: w.configuration?.direct_feed_url || w.configuration?.image_url || w.configuration?.url || null,
          location: w.configuration?.location || null,
          description: w.configuration?.view_description || null
        }));
      }
      
      const segmentWebcams = segmentsResult.rows.map((segment: any) => ({
        segment_order: segment.segment_order,
        segment_title: segment.title,
        webcam_ids: segment.webcam_ids || [],
        webcams: webcams.filter((w: any) => (segment.webcam_ids || []).includes(w.id))
      }));
      
      res.json({
        trip_id: id,
        total_webcams: webcams.length,
        webcams,
        by_segment: segmentWebcams
      });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).json({ error: 'Failed to fetch webcams' });
    }
  });

  // GET /api/v1/weather - Get weather data for dashboard widget
  app.get("/api/v1/weather", async (req, res) => {
    try {
      // Try to get real weather observations
      const obsResult = await storage.query(
        `SELECT station_name, temperature_c, humidity_percent, wind_speed_kph, wind_direction, conditions, observed_at
         FROM weather_observations 
         ORDER BY observed_at DESC LIMIT 1`
      ).catch(() => ({ rows: [] }));
      
      if (obsResult.rows.length > 0) {
        const obs = obsResult.rows[0];
        res.json({
          location: obs.station_name || 'Vancouver',
          temperature: Math.round(obs.temperature_c || -2),
          feelsLike: Math.round((obs.temperature_c || -2) - 3),
          condition: obs.conditions || 'Cloudy',
          humidity: obs.humidity_percent || 75,
          windSpeed: Math.round(obs.wind_speed_kph || 10),
          windDirection: obs.wind_direction || 'NW',
          observedAt: obs.observed_at,
          forecast: [
            { day: 'Today', high: 1, low: -3, condition: 'Snow', pop: 80 },
            { day: 'Wed', high: 3, low: -1, condition: 'Cloudy', pop: 30 },
            { day: 'Thu', high: 5, low: 0, condition: 'Partly Cloudy', pop: 10 },
            { day: 'Fri', high: 4, low: -2, condition: 'Rain', pop: 60 },
            { day: 'Sat', high: 6, low: 1, condition: 'Sunny', pop: 0 },
          ],
          warnings: []
        });
      } else {
        res.json({
          location: 'Vancouver',
          temperature: -2,
          feelsLike: -5,
          condition: 'Light Snow',
          humidity: 85,
          windSpeed: 15,
          windDirection: 'NW',
          observedAt: new Date().toISOString(),
          forecast: [
            { day: 'Today', high: 1, low: -3, condition: 'Snow', pop: 80 },
            { day: 'Wed', high: 3, low: -1, condition: 'Cloudy', pop: 30 },
            { day: 'Thu', high: 5, low: 0, condition: 'Partly Cloudy', pop: 10 },
            { day: 'Fri', high: 4, low: -2, condition: 'Rain', pop: 60 },
            { day: 'Sat', high: 6, low: 1, condition: 'Sunny', pop: 0 },
          ],
          warnings: []
        });
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      res.status(500).json({ error: 'Failed to fetch weather' });
    }
  });

  // GET /api/v1/ferries/status - Get ferry status for dashboard widget
  app.get("/api/v1/ferries/status", async (_req, res) => {
    try {
      const now = new Date();
      res.json({
        routes: [
          {
            id: 'tsawwassen-swartz-bay',
            name: 'Tsawwassen - Swartz Bay',
            sailings: [{
              route: 'Tsawwassen - Swartz Bay',
              departing: 'Tsawwassen',
              arriving: 'Swartz Bay',
              nextSailing: new Date(now.getTime() + 45 * 60000).toISOString(),
              status: 'on_time',
              vehicleCapacity: 65,
              passengerCapacity: 40,
              vessel: 'Spirit of British Columbia'
            }]
          },
          {
            id: 'horseshoe-bay-nanaimo',
            name: 'Horseshoe Bay - Nanaimo',
            sailings: [{
              route: 'Horseshoe Bay - Departure Bay',
              departing: 'Horseshoe Bay',
              arriving: 'Departure Bay',
              nextSailing: new Date(now.getTime() + 90 * 60000).toISOString(),
              status: 'on_time',
              vehicleCapacity: 55,
              passengerCapacity: 35,
              vessel: 'Queen of Oak Bay'
            }]
          },
          {
            id: 'horseshoe-bay-langdale',
            name: 'Horseshoe Bay - Langdale',
            sailings: [{
              route: 'Horseshoe Bay - Langdale',
              departing: 'Horseshoe Bay',
              arriving: 'Langdale',
              nextSailing: new Date(now.getTime() + 30 * 60000).toISOString(),
              status: 'on_time',
              vehicleCapacity: 45,
              passengerCapacity: 35,
              vessel: 'Queen of Surrey'
            }]
          }
        ]
      });
    } catch (error) {
      console.error('Error fetching ferry status:', error);
      res.status(500).json({ error: 'Failed to fetch ferry status' });
    }
  });

  // ==========================================
  // TRIP PLANNING FRAMEWORK API
  // ==========================================

  // GET /api/v1/planning/participants - List participant profiles
  app.get("/api/v1/planning/participants", async (req, res) => {
    try {
      const { search } = req.query;
      let query = 'SELECT * FROM participant_profiles';
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`);
        query += ' WHERE name ILIKE $1 OR email ILIKE $1';
      }

      query += ' ORDER BY name';
      const result = await storage.query(query, params);
      res.json({ participants: result.rows });
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({ error: 'Failed to fetch participants' });
    }
  });

  // POST /api/v1/planning/participants - Create participant profile
  app.post("/api/v1/planning/participants", async (req, res) => {
    try {
      const { name, email, phone, emergency_contact_name, emergency_contact_phone, country_of_origin, languages, medical_conditions, dietary_restrictions, fitness_level, swimming_ability, mobility_notes } = req.body;

      const result = await storage.query(`
        INSERT INTO participant_profiles (name, email, phone, emergency_contact_name, emergency_contact_phone, country_of_origin, languages, medical_conditions, dietary_restrictions, fitness_level, swimming_ability, mobility_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [name, email, phone, emergency_contact_name, emergency_contact_phone, country_of_origin, languages || ['English'], medical_conditions || [], dietary_restrictions || [], fitness_level || 5, swimming_ability || 'basic', mobility_notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating participant:', error);
      res.status(500).json({ error: 'Failed to create participant' });
    }
  });

  // GET /api/v1/planning/participants/:id - Get participant with skills
  app.get("/api/v1/planning/participants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const participantResult = await storage.query('SELECT * FROM participant_profiles WHERE id = $1', [id]);

      if (participantResult.rows.length === 0) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      const skillsResult = await storage.query('SELECT * FROM participant_skills WHERE participant_id = $1', [id]);

      res.json({
        participant: participantResult.rows[0],
        skills: skillsResult.rows
      });
    } catch (error) {
      console.error('Error fetching participant:', error);
      res.status(500).json({ error: 'Failed to fetch participant' });
    }
  });

  // POST /api/v1/planning/participants/:id/skills - Add skill to participant
  app.post("/api/v1/planning/participants/:id/skills", async (req, res) => {
    try {
      const { id } = req.params;
      const { skill_category, skill_type, skill_level, certification_name, certification_issuer, certification_date, certification_expiry, notes } = req.body;

      const result = await storage.query(`
        INSERT INTO participant_skills (participant_id, skill_category, skill_type, skill_level, certification_name, certification_issuer, certification_date, certification_expiry, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [id, skill_category, skill_type, skill_level, certification_name, certification_issuer, certification_date, certification_expiry, notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error adding skill:', error);
      res.status(500).json({ error: 'Failed to add skill' });
    }
  });

  // GET /api/v1/planning/vehicles - List vehicle profiles
  app.get("/api/v1/planning/vehicles", async (req, res) => {
    try {
      const { owner_id, vehicle_class } = req.query;
      let query = 'SELECT * FROM vehicle_profiles WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (owner_id) {
        params.push(owner_id);
        query += ` AND owner_id = $${paramIndex++}`;
      }
      if (vehicle_class) {
        params.push(vehicle_class);
        query += ` AND vehicle_class = $${paramIndex++}`;
      }

      query += ' ORDER BY created_at DESC';
      const result = await storage.query(query, params);
      res.json({ vehicles: result.rows });
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  });

  // GET /api/v1/planning/vehicles/:id - Get single vehicle with latest assessment
  app.get("/api/v1/planning/vehicles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const vehicleResult = await storage.query(`
        SELECT * FROM vehicle_profiles WHERE id = $1
      `, [id]);
      
      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      const assessmentResult = await storage.query(`
        SELECT * FROM vehicle_assessments 
        WHERE vehicle_id = $1 
        ORDER BY assessment_date DESC 
        LIMIT 1
      `, [id]);
      
      const vehicle = vehicleResult.rows[0];
      if (assessmentResult.rows.length > 0) {
        vehicle.latest_assessment = assessmentResult.rows[0];
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      res.status(500).json({ error: 'Failed to fetch vehicle' });
    }
  });

  // POST /api/v1/planning/vehicles - Create vehicle profile
  app.post("/api/v1/planning/vehicles", async (req, res) => {
    try {
      const { owner_type, owner_id, company_name, year, make, model, license_plate, vehicle_class, drive_type, fuel_type, ground_clearance_inches, length_feet, height_feet, passenger_capacity, ferry_class, paved_road_suitable, good_gravel_suitable, rough_gravel_suitable, four_x_four_required_suitable } = req.body;

      const result = await storage.query(`
        INSERT INTO vehicle_profiles (owner_type, owner_id, company_name, year, make, model, license_plate, vehicle_class, drive_type, fuel_type, ground_clearance_inches, length_feet, height_feet, passenger_capacity, ferry_class, paved_road_suitable, good_gravel_suitable, rough_gravel_suitable, four_x_four_required_suitable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [owner_type, owner_id, company_name, year, make, model, license_plate, vehicle_class, drive_type, fuel_type, ground_clearance_inches, length_feet, height_feet, passenger_capacity, ferry_class, paved_road_suitable ?? true, good_gravel_suitable ?? true, rough_gravel_suitable ?? false, four_x_four_required_suitable ?? false]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  });

  // POST /api/v1/planning/vehicles/:id/assess - Create vehicle assessment
  app.post("/api/v1/planning/vehicles/:id/assess", async (req, res) => {
    try {
      const { id } = req.params;
      const assessment = req.body;

      const result = await storage.query(`
        INSERT INTO vehicle_assessments (vehicle_id, assessed_by, tire_tread_condition, tires_winter_rated, chains_available, oil_level, coolant_level, brake_condition, current_mileage, has_first_aid_kit, has_fire_extinguisher, has_blankets, has_water, has_flashlight, overall_condition, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [id, assessment.assessed_by, assessment.tire_tread_condition, assessment.tires_winter_rated, assessment.chains_available, assessment.oil_level, assessment.coolant_level, assessment.brake_condition, assessment.current_mileage, assessment.has_first_aid_kit, assessment.has_fire_extinguisher, assessment.has_blankets, assessment.has_water, assessment.has_flashlight, assessment.overall_condition, assessment.notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating assessment:', error);
      res.status(500).json({ error: 'Failed to create assessment' });
    }
  });

  // GET /api/v1/planning/routes - Get available trips with difficulty info
  app.get("/api/v1/planning/routes", async (req, res) => {
    try {
      const difficulties: Record<string, { level: string; color: string; description: string }> = {
        'bamfield-adventure': {
          level: 'Challenging',
          color: 'text-orange-400 bg-orange-500/20',
          description: 'Requires intermediate driving and paddling skills, remote location'
        },
        'whistler-ski-day': {
          level: 'Moderate',
          color: 'text-yellow-400 bg-yellow-500/20',
          description: 'Winter driving skills needed, otherwise straightforward'
        },
        'tofino-storm-watching': {
          level: 'Easy-Moderate',
          color: 'text-green-400 bg-green-500/20',
          description: 'Long drive but on paved roads, no special skills required'
        },
        'sunshine-coast-loop': {
          level: 'Easy',
          color: 'text-green-400 bg-green-500/20',
          description: 'Paved roads, two ferry crossings, family-friendly'
        },
        'okanagan-wine-trail': {
          level: 'Easy',
          color: 'text-green-400 bg-green-500/20',
          description: 'Easy driving, designate a driver for wine tasting'
        },
        'harrison-hot-springs': {
          level: 'Easy',
          color: 'text-green-400 bg-green-500/20',
          description: 'Short day trip, easy highway driving'
        }
      };

      // Get trips and their skill requirements count
      const tripsResult = await storage.query('SELECT * FROM road_trips WHERE is_published = true ORDER BY title');
      const trips = tripsResult.rows.map((trip: any) => ({
        ...trip,
        difficulty: difficulties[trip.id] || { level: 'Unknown', color: 'text-gray-400 bg-gray-500/20', description: 'Difficulty not assessed' }
      }));

      res.json({ routes: trips });
    } catch (error) {
      console.error('Error fetching routes:', error);
      res.status(500).json({ error: 'Failed to fetch routes' });
    }
  });

  // GET /api/v1/planning/route-segments - Get route segments
  app.get("/api/v1/planning/route-segments", async (req, res) => {
    try {
      const { route_type, region } = req.query;
      let query = 'SELECT * FROM route_segments WHERE is_active = true';
      const params: any[] = [];
      let paramIndex = 1;

      if (route_type) {
        params.push(route_type);
        query += ` AND route_type = $${paramIndex++}`;
      }

      query += ' ORDER BY name';
      const result = await storage.query(query, params);
      res.json({ segments: result.rows });
    } catch (error) {
      console.error('Error fetching route segments:', error);
      res.status(500).json({ error: 'Failed to fetch route segments' });
    }
  });

  // GET /api/v1/planning/route-segments/:id/alternatives - Get alternatives for a segment
  app.get("/api/v1/planning/route-segments/:id/alternatives", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.query(`
        SELECT ra.*, rs.name as alternative_segment_name 
        FROM route_alternatives ra
        LEFT JOIN route_segments rs ON ra.alternative_segment_id = rs.id
        WHERE ra.primary_segment_id = $1
        ORDER BY ra.priority
      `, [id]);

      res.json({ alternatives: result.rows });
    } catch (error) {
      console.error('Error fetching alternatives:', error);
      res.status(500).json({ error: 'Failed to fetch alternatives' });
    }
  });

  // POST /api/v1/planning/assess/route - Assess vehicle for route segments
  app.post("/api/v1/planning/assess/route", async (req, res) => {
    try {
      const { vehicle_id, route_segment_ids, date } = req.body;

      const vehicleResult = await storage.query(
        `SELECT v.*, va.tires_winter_rated, va.chains_available 
         FROM vehicle_profiles v 
         LEFT JOIN vehicle_assessments va ON v.id = va.vehicle_id 
         WHERE v.id = $1 
         ORDER BY va.assessment_date DESC LIMIT 1`,
        [vehicle_id]
      );

      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      const vehicle = vehicleResult.rows[0];
      const segmentsResult = await storage.query(
        'SELECT * FROM route_segments WHERE id = ANY($1)',
        [route_segment_ids]
      );

      const assessment: any = {
        vehicle,
        segments: [],
        warnings: [],
        blockers: [],
        recommendations: []
      };

      const tripDate = new Date(date);
      const month = tripDate.getMonth();
      const isWinterPeriod = month >= 9 || month <= 3;

      for (const segment of segmentsResult.rows) {
        const segmentAssessment: any = {
          segment_id: segment.id,
          segment_name: segment.name,
          suitable: true,
          issues: []
        };

        if (segment.minimum_vehicle_class === 'truck' && !['truck', 'suv'].includes(vehicle.vehicle_class)) {
          segmentAssessment.suitable = false;
          segmentAssessment.issues.push('Vehicle type not suitable for this route');
          assessment.blockers.push(`${segment.name}: Requires truck or SUV`);
        }

        if (segment.winter_tires_required && isWinterPeriod && !vehicle.tires_winter_rated) {
          segmentAssessment.issues.push('Winter tires required');
          assessment.warnings.push(`${segment.name}: Winter tires required ${segment.winter_tires_required_dates || 'Oct 1 - Apr 30'}`);
        }

        if (segment.high_clearance_recommended && vehicle.ground_clearance_inches && vehicle.ground_clearance_inches < 8) {
          segmentAssessment.issues.push('High clearance recommended');
          assessment.warnings.push(`${segment.name}: High clearance vehicle recommended`);
        }

        if (segment.road_surface === 'rough_gravel' && !vehicle.rough_gravel_suitable) {
          segmentAssessment.suitable = false;
          segmentAssessment.issues.push('Vehicle not suitable for rough gravel');
          assessment.blockers.push(`${segment.name}: Not suitable for rough gravel roads`);
        }

        assessment.segments.push(segmentAssessment);
      }

      if (assessment.warnings.some((w: string) => w.includes('Winter tires'))) {
        assessment.recommendations.push('Ensure winter-rated tires (M+S or mountain snowflake symbol) are installed');
      }

      if (assessment.blockers.length > 0) {
        assessment.recommendations.push('Consider alternative routes or transport providers (see route alternatives)');
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error assessing route:', error);
      res.status(500).json({ error: 'Failed to assess route' });
    }
  });

  // GET /api/v1/planning/transport-providers - Get transport providers
  app.get("/api/v1/planning/transport-providers", async (req, res) => {
    try {
      const { type, region } = req.query;
      let query = 'SELECT * FROM transport_providers WHERE is_active = true';
      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        params.push(type);
        query += ` AND provider_type = $${paramIndex++}`;
      }

      if (region) {
        params.push(region);
        query += ` AND $${paramIndex++} = ANY(service_area)`;
      }

      query += ' ORDER BY name';
      const result = await storage.query(query, params);
      res.json({ providers: result.rows });
    } catch (error) {
      console.error('Error fetching providers:', error);
      res.status(500).json({ error: 'Failed to fetch providers' });
    }
  });

  // GET /api/v1/planning/transport-providers/:id/schedules - Get provider schedules
  app.get("/api/v1/planning/transport-providers/:id/schedules", async (req, res) => {
    try {
      const { id } = req.params;
      const { date } = req.query;

      let query = 'SELECT * FROM transport_schedules WHERE provider_id = $1';
      const params: any[] = [id];

      if (date) {
        params.push(date);
        query += ` AND (valid_from IS NULL OR valid_from <= $2) AND (valid_to IS NULL OR valid_to >= $2)`;
      }

      query += ' ORDER BY departure_time';
      const result = await storage.query(query, params);
      res.json({ schedules: result.rows });
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });

  // POST /api/v1/planning/service-runs - Create service run
  app.post("/api/v1/planning/service-runs", async (req, res) => {
    try {
      const { company_name, service_type, destination_region, planned_date, planned_duration_days, total_job_slots, crew_size, crew_lead_name, vehicle_id, vehicle_description, logistics_cost_total, minimum_job_value, booking_deadline, contact_email, contact_phone, booking_notes } = req.body;

      const result = await storage.query(`
        INSERT INTO service_runs (company_name, service_type, destination_region, planned_date, planned_duration_days, total_job_slots, crew_size, crew_lead_name, vehicle_id, vehicle_description, logistics_cost_total, minimum_job_value, booking_deadline, contact_email, contact_phone, booking_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [company_name, service_type, destination_region, planned_date, planned_duration_days || 1, total_job_slots, crew_size, crew_lead_name, vehicle_id, vehicle_description, logistics_cost_total, minimum_job_value, booking_deadline, contact_email, contact_phone, booking_notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating service run:', error);
      res.status(500).json({ error: 'Failed to create service run' });
    }
  });

  // GET /api/v1/planning/service-runs - Get service runs
  app.get("/api/v1/planning/service-runs", async (req, res) => {
    try {
      const { region, service_type, upcoming_only } = req.query;

      let query = `
        SELECT sr.*, 
               COUNT(srb.id) as bookings_count,
               sr.total_job_slots - COALESCE(sr.slots_filled, 0) as slots_available
        FROM service_runs sr
        LEFT JOIN service_run_bookings srb ON sr.id = srb.service_run_id AND srb.status != 'cancelled'
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (region) {
        params.push(region);
        query += ` AND sr.destination_region = $${paramIndex++}`;
      }

      if (service_type) {
        params.push(service_type);
        query += ` AND sr.service_type = $${paramIndex++}`;
      }

      if (upcoming_only === 'true') {
        query += ` AND sr.planned_date >= CURRENT_DATE`;
      }

      query += ` GROUP BY sr.id ORDER BY sr.planned_date`;

      const result = await storage.query(query, params);
      res.json({ service_runs: result.rows });
    } catch (error) {
      console.error('Error fetching service runs:', error);
      res.status(500).json({ error: 'Failed to fetch service runs' });
    }
  });

  // POST /api/v1/planning/service-runs/:id/book - Book slot on service run
  app.post("/api/v1/planning/service-runs/:id/book", async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_name, customer_email, customer_phone, customer_address, job_description, estimated_duration_hours, job_value, preferred_time } = req.body;

      const runResult = await storage.query('SELECT * FROM service_runs WHERE id = $1', [id]);

      if (runResult.rows.length === 0) {
        return res.status(404).json({ error: 'Service run not found' });
      }

      const run = runResult.rows[0];

      if (run.slots_filled >= run.total_job_slots) {
        return res.status(400).json({ error: 'No slots available' });
      }

      const logistics_share = run.logistics_cost_total / run.total_job_slots;
      const total_price = job_value + logistics_share;

      const result = await storage.query(`
        INSERT INTO service_run_bookings (service_run_id, customer_name, customer_email, customer_phone, customer_address, job_description, estimated_duration_hours, job_value, logistics_share, total_price, preferred_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [id, customer_name, customer_email, customer_phone, customer_address, job_description, estimated_duration_hours, job_value, logistics_share, total_price, preferred_time]);

      await storage.query('UPDATE service_runs SET slots_filled = slots_filled + 1 WHERE id = $1', [id]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error booking slot:', error);
      res.status(500).json({ error: 'Failed to book slot' });
    }
  });

  // POST /api/v1/planning/assess/participant-trip - Assess participant skills for trip
  app.post("/api/v1/planning/assess/participant-trip", async (req, res) => {
    try {
      const { participant_id, trip_id } = req.body;

      if (!participant_id || !trip_id) {
        return res.status(400).json({ error: 'participant_id and trip_id required' });
      }

      const skillsResult = await storage.query('SELECT * FROM participant_skills WHERE participant_id = $1', [participant_id]);
      const participantSkills = skillsResult.rows;

      const requirementsResult = await storage.query(`
        SELECT * FROM skill_requirements 
        WHERE requirement_type = 'trip' AND requirement_target_id = $1
        ORDER BY 
          CASE enforcement 
            WHEN 'required' THEN 1 
            WHEN 'recommended' THEN 2 
            ELSE 3 
          END,
          skill_category
      `, [trip_id]);

      const requirements = requirementsResult.rows;

      // If no requirements defined, trip is open to all
      if (requirements.length === 0) {
        return res.json({
          participant_id,
          trip_id,
          qualified: true,
          gaps: [],
          warnings: ['No specific skill requirements defined for this trip'],
          required_actions: []
        });
      }

      const assessment: any = {
        participant_id,
        trip_id,
        qualified: true,
        gaps: [],
        warnings: [],
        required_actions: []
      };

      const skillLevels = ['none', 'beginner', 'intermediate', 'advanced', 'expert', 'certified'];

      for (const req of requirements) {
        const hasSkill = participantSkills.find(
          (s: any) => s.skill_category === req.skill_category && s.skill_type === req.skill_type
        );

        const requiredLevelIndex = skillLevels.indexOf(req.minimum_level);
        const hasLevelIndex = hasSkill ? skillLevels.indexOf(hasSkill.skill_level) : 0;

        if (hasLevelIndex < requiredLevelIndex) {
          const gap = {
            skill_category: req.skill_category,
            skill_type: req.skill_type,
            required_level: req.minimum_level,
            current_level: hasSkill?.skill_level || 'none',
            enforcement: req.enforcement,
            resolution_options: req.resolution_options || [],
            notes: req.notes
          };

          assessment.gaps.push(gap);

          if (req.enforcement === 'required') {
            assessment.qualified = false;
            assessment.required_actions.push({ type: 'skill_upgrade', ...gap });
          } else if (req.enforcement === 'recommended') {
            assessment.warnings.push(
              `Recommended: ${req.skill_type.replace(/_/g, ' ')} (${req.minimum_level}) - you have: ${hasSkill?.skill_level || 'none'}`
            );
          } else {
            assessment.warnings.push(
              `Consider: ${req.skill_type.replace(/_/g, ' ')} training for a better experience`
            );
          }
        }
      }

      // Add summary
      if (assessment.qualified) {
        if (assessment.warnings.length > 0) {
          assessment.warnings.unshift('You meet all required skills! Some recommendations below:');
        }
      } else {
        assessment.warnings.unshift(`You need ${assessment.required_actions.length} skill(s) before this trip`);
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error assessing participant:', error);
      res.status(500).json({ error: 'Failed to assess participant' });
    }
  });

  // GET /api/v1/planning/equipment-types - Get equipment types
  app.get("/api/v1/planning/equipment-types", async (req, res) => {
    try {
      const { category } = req.query;
      let query = 'SELECT * FROM equipment_types';
      const params: any[] = [];

      if (category) {
        params.push(category);
        query += ' WHERE category = $1';
      }

      query += ' ORDER BY category, name';
      const result = await storage.query(query, params);
      res.json({ equipment: result.rows });
    } catch (error) {
      console.error('Error fetching equipment:', error);
      res.status(500).json({ error: 'Failed to fetch equipment' });
    }
  });

  // GET /api/v1/planning/participants/:id/trip-qualifications - Get all trip qualifications for a participant
  app.get("/api/v1/planning/participants/:id/trip-qualifications", async (req, res) => {
    try {
      const { id } = req.params;

      const tripsResult = await storage.query(
        "SELECT id, title, difficulty FROM road_trips WHERE is_published = true"
      );

      const skillsResult = await storage.query(
        'SELECT skill_category, skill_type, skill_level FROM participant_skills WHERE participant_id = $1',
        [id]
      );
      const participantSkills = skillsResult.rows;

      const skillLevels = ['none', 'beginner', 'intermediate', 'advanced', 'expert', 'certified'];

      const qualifications: Record<string, { qualified: boolean; gapCount: number; gaps: string[] }> = {};

      for (const trip of tripsResult.rows) {
        const reqResult = await storage.query(`
          SELECT skill_category, skill_type, minimum_level, enforcement 
          FROM skill_requirements 
          WHERE requirement_type = 'trip' AND requirement_target_id = $1 AND enforcement = 'required'
        `, [trip.id]);

        const gaps: string[] = [];

        for (const req of reqResult.rows) {
          const hasSkill = participantSkills.find(
            (s: any) => s.skill_category === req.skill_category && s.skill_type === req.skill_type
          );

          const requiredLevelIndex = skillLevels.indexOf(req.minimum_level);
          const hasLevelIndex = hasSkill ? skillLevels.indexOf(hasSkill.skill_level) : 0;

          if (hasLevelIndex < requiredLevelIndex) {
            gaps.push(req.skill_type.replace(/_/g, ' '));
          }
        }

        qualifications[trip.id] = {
          qualified: gaps.length === 0,
          gapCount: gaps.length,
          gaps
        };
      }

      res.json({ participant_id: id, qualifications });
    } catch (error) {
      console.error('Error getting qualifications:', error);
      res.status(500).json({ error: 'Failed to get qualifications' });
    }
  });

  // GET /api/v1/planning/safety-equipment-types - Get all safety equipment types
  app.get("/api/v1/planning/safety-equipment-types", async (req, res) => {
    try {
      const result = await storage.query(
        'SELECT * FROM safety_equipment_types ORDER BY sort_order, name'
      );
      res.json({ types: result.rows });
    } catch (error) {
      console.error('Error fetching equipment types:', error);
      res.status(500).json({ error: 'Failed to fetch equipment types' });
    }
  });

  // GET /api/v1/planning/vehicles/:id/safety-equipment - Get safety equipment for a vehicle
  app.get("/api/v1/planning/vehicles/:id/safety-equipment", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.query(
        'SELECT * FROM vehicle_safety_equipment WHERE vehicle_id = $1',
        [id]
      );
      res.json({ equipment: result.rows });
    } catch (error) {
      console.error('Error fetching vehicle equipment:', error);
      res.status(500).json({ error: 'Failed to fetch vehicle equipment' });
    }
  });

  // PUT /api/v1/planning/vehicles/:vehicleId/safety-equipment/:equipmentTypeId - Update safety equipment
  app.put("/api/v1/planning/vehicles/:vehicleId/safety-equipment/:equipmentTypeId", async (req, res) => {
    try {
      const { vehicleId, equipmentTypeId } = req.params;
      const { present, condition, notes } = req.body;

      const result = await storage.query(`
        INSERT INTO vehicle_safety_equipment (vehicle_id, equipment_type_id, present, condition, notes, last_checked)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
        ON CONFLICT (vehicle_id, equipment_type_id)
        DO UPDATE SET present = $3, condition = $4, notes = $5, last_checked = CURRENT_DATE
        RETURNING *
      `, [vehicleId, equipmentTypeId, present, condition || null, notes || null]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating equipment:', error);
      res.status(500).json({ error: 'Failed to update equipment' });
    }
  });

  return httpServer;
}
