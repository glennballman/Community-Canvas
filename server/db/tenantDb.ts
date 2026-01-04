import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Request, Response, NextFunction } from 'express';
import { TenantContext, getTenantContext } from '../middleware/tenantContext';
import { pool } from '../db';

const SERVICE_MODE_SENTINEL = '__SERVICE__';

export interface ActorContext {
  tenant_id: string;
  portal_id?: string;
  individual_id?: string;
  platform_staff_id?: string;
  impersonation_session_id?: string;
  actor_type: 'tenant' | 'platform' | 'service';
}

async function setSessionVars(client: PoolClient, ctx: TenantContext): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [ctx.individual_id || '']);
  await client.query(`SELECT set_config('app.platform_staff_id', $1, true)`, ['']);
  await client.query(`SELECT set_config('app.impersonation_session_id', $1, true)`, ['']);
}

async function setActorSessionVars(client: PoolClient, actor: ActorContext): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [actor.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [actor.portal_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [actor.individual_id || '']);
  await client.query(`SELECT set_config('app.platform_staff_id', $1, true)`, [actor.platform_staff_id || '']);
  await client.query(`SELECT set_config('app.impersonation_session_id', $1, true)`, [actor.impersonation_session_id || '']);
}

async function clearSessionVars(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', '', false)`);
  await client.query(`SELECT set_config('app.portal_id', '', false)`);
  await client.query(`SELECT set_config('app.individual_id', '', false)`);
  await client.query(`SELECT set_config('app.platform_staff_id', '', false)`);
  await client.query(`SELECT set_config('app.impersonation_session_id', '', false)`);
}

async function setServiceMode(client: PoolClient): Promise<void> {
  // Clear any stale session vars from previous tenant context first
  await clearSessionVars(client);
  // Now set service mode sentinel with session-scope (false = session-level, not tx-local)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [SERVICE_MODE_SENTINEL]);
  await client.query(`SELECT set_config('app.portal_id', $1, false)`, [SERVICE_MODE_SENTINEL]);
  await client.query(`SELECT set_config('app.individual_id', $1, false)`, [SERVICE_MODE_SENTINEL]);
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
    // Clear session vars before returning connection to pool
    await clearSessionVars(client).catch(() => {});
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
    // Clear session vars before returning connection to pool
    await clearSessionVars(client).catch(() => {});
    client.release();
  }
}

/**
 * Execute a query with no tenant context (public/anonymous access).
 * RLS policies evaluate with empty context, so only rows where
 * tenant_id IS NULL (shared assets) will be visible via RLS SELECT policy.
 * Use this for public catalog reads where tenant-owned data must be hidden.
 */
export async function publicQuery<T extends QueryResultRow = any>(
  text: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  
  try {
    // Clear any session variables - RLS will see empty tenant context
    await clearSessionVars(client);
    return await client.query<T>(text, values);
  } finally {
    // Clear again for safety before returning connection to pool
    await clearSessionVars(client).catch(() => {});
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
    // Clear session vars before returning connection to pool
    await clearSessionVars(client).catch(() => {});
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
    // Clear session vars before returning connection to pool
    await clearSessionVars(client).catch(() => {});
    client.release();
  }
}

export async function actorQuery<T extends QueryResultRow = any>(
  actor: ActorContext,
  text: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  
  try {
    await clearSessionVars(client);
    await setActorSessionVars(client, actor);
    return await client.query<T>(text, values);
  } finally {
    await clearSessionVars(client).catch(() => {});
    client.release();
  }
}

export async function withActorTransaction<T>(
  actor: ActorContext,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await clearSessionVars(client);
    await client.query('BEGIN');
    await setActorSessionVars(client, actor);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await clearSessionVars(client).catch(() => {});
    client.release();
  }
}

declare global {
  namespace Express {
    interface Request {
      tenantQuery: <T extends QueryResultRow = any>(text: string, values?: any[]) => Promise<QueryResult<T>>;
      tenantTransaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
      actorContext?: ActorContext;
    }
  }
}

export function attachTenantDb(req: Request, res: Response, next: NextFunction): void {
  req.tenantQuery = <T extends QueryResultRow = any>(text: string, values?: any[]) => {
    if (req.actorContext) {
      return actorQuery<T>(req.actorContext, text, values);
    }
    return tenantQuery<T>(req, text, values);
  };
  req.tenantTransaction = <T>(callback: (client: PoolClient) => Promise<T>) => {
    if (req.actorContext) {
      return withActorTransaction<T>(req.actorContext, callback);
    }
    return withTenantTransaction<T>(req, callback);
  };
  next();
}
