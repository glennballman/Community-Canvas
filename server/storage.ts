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
    const [snapshot] = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.location, location))
      .orderBy(desc(snapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  async createSnapshot(insertSnapshot: InsertSnapshot): Promise<Snapshot> {
    const [snapshot] = await db
      .insert(snapshots)
      .values(insertSnapshot)
      .returning();
    return snapshot;
  }
}

export const storage = new DatabaseStorage();
