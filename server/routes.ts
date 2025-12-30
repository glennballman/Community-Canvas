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
function getAllChamberMembers() {
  const jsonMembers = getJsonLoadedMembers();
  const jsonMemberIds = new Set(jsonMembers.map(m => m.id));
  const uniqueStaticMembers = staticMembers.filter(m => !jsonMemberIds.has(m.id));
  return [...uniqueStaticMembers, ...jsonMembers];
}

const chamberMembers = getAllChamberMembers();

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
      const memberCountByChamberId = new Map<string, number>();
      for (const member of chamberMembers) {
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

  return httpServer;
}
