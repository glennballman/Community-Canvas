import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import FirecrawlApp from '@mendable/firecrawl-js';
import { runChamberAudit } from "@shared/chamber-audit";
import { buildNAICSTree, getMembersByNAICSCode, getMembersBySector, getMembersBySubsector } from "@shared/naics-hierarchy";
import { BC_CHAMBERS_OF_COMMERCE } from "@shared/chambers-of-commerce";
import { chamberMembers } from "@shared/chamber-members";
import { getChamberProgressList, getChamberProgressSummary } from "@shared/chamber-progress";

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

      const locations = BC_CHAMBERS_OF_COMMERCE.map(chamber => ({
        id: chamber.id,
        name: chamber.name,
        lat: chamber.location.lat,
        lng: chamber.location.lng,
        memberCount: memberCountByChamberId.get(chamber.id) || 0,
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
      const summary = getChamberProgressSummary();
      res.json({ progressList, summary });
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

  return httpServer;
}
