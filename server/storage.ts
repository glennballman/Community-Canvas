import { db, pool } from "./db";
import {
  cc_snapshots,
  chamberOverrides,
  type InsertSnapshot,
  type Snapshot,
  type ChamberOverride
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

import type { QueryResult } from "pg";

export interface IStorage {
  getLatestSnapshot(location: string): Promise<Snapshot | undefined>;
  createSnapshot(snapshot: InsertSnapshot): Promise<Snapshot>;
  getChamberOverrides(): Promise<ChamberOverride[]>;
  getChamberOverride(chamberId: string): Promise<ChamberOverride | undefined>;
  upsertChamberOverride(chamberId: string, expectedMembers: number | null, estimatedMembers: number | null): Promise<ChamberOverride>;
  query(text: string, params?: any[]): Promise<QueryResult>;
}

export class DatabaseStorage implements IStorage {
  async getLatestSnapshot(location: string): Promise<Snapshot | undefined> {
    const results = await db
      .select()
      .from(cc_snapshots)
      .where(eq(cc_snapshots.location, location))
      .orderBy(desc(cc_snapshots.createdAt))
      .limit(1);
    return results[0];
  }

  async createSnapshot(insertSnapshot: InsertSnapshot): Promise<Snapshot> {
    const results = await db
      .insert(cc_snapshots)
      .values(insertSnapshot)
      .returning();
    return results[0];
  }

  async getChamberOverrides(): Promise<ChamberOverride[]> {
    return await db.select().from(chamberOverrides);
  }

  async getChamberOverride(chamberId: string): Promise<ChamberOverride | undefined> {
    const results = await db
      .select()
      .from(chamberOverrides)
      .where(eq(chamberOverrides.chamberId, chamberId))
      .limit(1);
    return results[0];
  }

  async upsertChamberOverride(chamberId: string, expectedMembers: number | null, estimatedMembers: number | null): Promise<ChamberOverride> {
    const existing = await this.getChamberOverride(chamberId);
    if (existing) {
      const results = await db
        .update(chamberOverrides)
        .set({ 
          expectedMembers, 
          estimatedMembers,
          updatedAt: new Date()
        })
        .where(eq(chamberOverrides.chamberId, chamberId))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(chamberOverrides)
        .values({ chamberId, expectedMembers, estimatedMembers })
        .returning();
      return results[0];
    }
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    return pool.query(text, params);
  }
}

export const storage = new DatabaseStorage();
