import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertSnapshotSchema } from "@shared/schema";
// import Firecrawl from '@mendable/firecrawl-js'; // We will install this later if needed

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
      
      // TODO: Implement actual Firecrawl logic here
      // For now, we will simulate a refresh by creating a mock snapshot if none exists
      // or just return success.
      
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) {
         // Mock data generation for demo purposes if no API key
         console.log("No Firecrawl API key found. Using mock data.");
         
         const mockData = {
            location: location,
            real_time_status_updates: {
              bc_hydro_outages: [
                { value: "No current outages in Bamfield area", value_citation: "https://www.bchydro.com/outages" }
              ],
              water_sewer_alerts: [
                { value: "Water conservation stage 1 in effect", value_citation: "https://bamfieldwater.ca" }
              ],
              ferry_schedules: [
                { ferry_line: "BC Ferries", route: "Port Alberni to Bamfield", status: "On Time", status_citation: "https://bcferries.com" },
                { ferry_line: "Lady Rose Marine", route: "Frances Barkley", status: "Running as scheduled", status_citation: "https://ladyrosemarine.com" }
              ],
              road_conditions: [
                { road_name: "Bamfield Main", status: "Open - Graded recently, watch for dust", road_name_citation: "https://facebook.com/bamfieldroads" },
                { road_name: "Highway 4", status: "Open - Construction delays at Cameron Lake", road_name_citation: "https://drivebc.ca" }
              ],
              active_alerts: [
                 { value: "No active tsunami alerts", value_citation: "https://emergencyinfobc.gov.bc.ca" }
              ]
            }
         };
         
         await storage.createSnapshot({
            location,
            data: mockData
         });
         
         return res.json({ success: true, message: "Mock data refreshed" });
      }

      // If we had the key and logic, we would call Firecrawl here
      // const app = new Firecrawl({ apiKey });
      // const result = await app.agent({ ... });
      // await storage.createSnapshot({ location, data: result.data });

      res.json({ success: true, message: "Refresh triggered (Mock)" });

    } catch (err) {
      console.error("Refresh error:", err);
      res.status(500).json({ message: "Failed to refresh data" });
    }
  });

  // Seed data if empty
  const existing = await storage.getLatestSnapshot("Bamfield");
  if (!existing) {
     const seedData = {
        location: "Bamfield",
        real_time_status_updates: {
          bc_hydro_outages: [
            { value: "No current outages reported.", value_citation: "https://www.bchydro.com" }
          ],
          water_sewer_alerts: [
            { value: "Boil water notice rescinded.", value_citation: "https://bamfield.ca" }
          ],
          ferry_schedules: [
            { ferry_line: "BC Ferries", route: "Port Alberni - Bamfield", status: "Scheduled 8:00 AM Departure", status_citation: "https://bcferries.com" }
          ],
          road_conditions: [
            { road_name: "Bamfield Main", status: "Rough washboard sections near km 30", road_name_citation: "https://drivebc.ca" }
          ],
          active_alerts: []
        }
     };
     await storage.createSnapshot({ location: "Bamfield", data: seedData });
  }

  return httpServer;
}
