import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.CC_APP_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "CC_APP_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Debug: Log which env var is being used (masked password)
const maskedUrl = connectionString.replace(/:([^@]+)@/, ':****@');
console.log(`[DB] Using ${process.env.CC_APP_DATABASE_URL ? 'CC_APP_DATABASE_URL' : 'DATABASE_URL'}: ${maskedUrl}`);

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
