import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertSnapshotSchema } from "@shared/schema";
import FirecrawlApp from '@mendable/firecrawl-js';

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.snapshots.getLatest.path, async (req, res) => {
    try {
      const { location } = api.snapshots.getLatest.input.parse(req.query);
      const snapshot = await storage.getLatestSnapshot(location);
      if (!snapshot) {
        return res.status(404).json({ message: 'No snapshot found for this location' });
      }
      res.json(snapshot);
    } catch (error) {
       if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.snapshots.create.path, async (req, res) => {
    try {
      const input = insertSnapshotSchema.parse(req.body);
      const snapshot = await storage.createSnapshot(input);
      res.status(201).json(snapshot);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
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

      const prompt = `Extract real-time status updates and 15-minute snapshots for ${location}, covering BC Hydro outages, local water/sewer service alerts, and ferry schedules for BC Ferries and the Lady Rose Marine Services. Include the ventilation index, current weather conditions, tide tables, and active alerts for tsunamis, earthquakes, and forest fires. Monitor road conditions for Bamfield Main, Highway 4 (Coombs to Port Alberni), and the logging road from Youbou. Collect all available status strings and URLs.`;

      const result = await firecrawl.extract([
        "https://www.bchydro.com/outages",
        "https://drivebc.ca",
        "https://www.bcferries.com",
        "https://ladyrosemarine.com"
      ], {
        prompt,
        schema: z.object({
          location: z.string(),
          real_time_status_updates: z.object({
            bc_hydro_outages: z.array(z.object({
              value: z.string(),
              value_citation: z.string().optional()
            })),
            water_sewer_alerts: z.array(z.object({
              value: z.string(),
              value_citation: z.string().optional()
            })),
            ferry_schedules: z.array(z.object({
              ferry_line: z.string(),
              route: z.string(),
              status: z.string(),
              status_citation: z.string().optional()
            })),
            road_conditions: z.array(z.object({
              road_name: z.string(),
              status: z.string(),
              road_name_citation: z.string().optional()
            })),
            active_alerts: z.array(z.object({
              value: z.string(),
              value_citation: z.string().optional()
            }))
          })
        })
      });

      if (result.success && result.data) {
        await storage.createSnapshot({
          location,
          data: result.data as any
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

  return httpServer;
}
