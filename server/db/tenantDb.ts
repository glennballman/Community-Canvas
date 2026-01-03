import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Request, Response, NextFunction } from 'express';
import { TenantContext, getTenantContext } from '../middleware/tenantContext';
import { pool } from '../db';

const SERVICE_MODE_SENTINEL = '__SERVICE__';

async function setSessionVars(client: PoolClient, ctx: TenantContext): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [ctx.individual_id || '']);
}

async function setServiceMode(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
}

export async function tenantQuery<T extends QueryResultRow = any>(
  req: Request,
  text: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const ctx = getTenantContext(req);
  const client = await pool.connect();
  
  try {
    await setSessionVars(client, ctx);
    return await client.query<T>(text, values);
  } finally {
    client.release();
  }
}

export async function serviceQuery<T extends QueryResultRow = any>(
  text: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  
  try {
    await setServiceMode(client);
    return await client.query<T>(text, values);
  } finally {
    client.release();
  }
}

export async function withTenantTransaction<T>(
  req: Request,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const ctx = getTenantContext(req);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await setSessionVars(client, ctx);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withServiceTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await setServiceMode(client);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

declare global {
  namespace Express {
    interface Request {
      tenantQuery: <T extends QueryResultRow = any>(text: string, values?: any[]) => Promise<QueryResult<T>>;
      tenantTransaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
    }
  }
}

export function attachTenantDb(req: Request, res: Response, next: NextFunction): void {
  req.tenantQuery = <T extends QueryResultRow = any>(text: string, values?: any[]) => 
    tenantQuery<T>(req, text, values);
  req.tenantTransaction = <T>(callback: (client: PoolClient) => Promise<T>) => 
    withTenantTransaction<T>(req, callback);
  next();
}
