import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import FirecrawlApp from '@mendable/firecrawl-js';
import fs from "fs";
import path from "path";
import { runChamberAudit } from "@shared/chamber-audit";
import { buildNAICSTree, getMembersByNAICSCode, getMembersBySector, getMembersBySubsector } from "@shared/naics-hierarchy";
import { BC_CHAMBERS_OF_COMMERCE } from "@shared/chambers-of-commerce";
import { chamberMembers as staticMembers } from "@shared/chamber-members";
import { getJsonLoadedMembers } from "@shared/chamber-member-registry";
import { getChamberProgressList, getChamberProgressSummary } from "@shared/chamber-progress";

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

      const firecrawl = new FirecrawlApp({ apiKey });

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
      const { region, category, type, limit = '5000' } = req.query;
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

  return httpServer;
}
