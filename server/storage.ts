import { db } from "./db";
import {
  snapshots,
  type InsertSnapshot,
  type Snapshot
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getLatestSnapshot(location: string): Promise<Snapshot | undefined>;
  createSnapshot(snapshot: InsertSnapshot): Promise<Snapshot>;
}

export class DatabaseStorage implements IStorage {
  async getLatestSnapshot(location: string): Promise<Snapshot | undefined> {
    const results = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.location, location))
      .orderBy(desc(snapshots.createdAt))
      .limit(1);
    return results[0];
  }

  async createSnapshot(insertSnapshot: InsertSnapshot): Promise<Snapshot> {
    const results = await db
      .insert(snapshots)
      .values(insertSnapshot)
      .returning();
    return results[0];
  }
}

export const storage = new DatabaseStorage();
