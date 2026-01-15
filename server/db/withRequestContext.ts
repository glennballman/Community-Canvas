import { Pool, PoolClient } from 'pg';
import { Request } from 'express';
import { TenantRequest, TenantContext, getTenantContext } from '../middleware/tenantContext';

// Sentinel value for service/admin mode - bypasses RLS
const SERVICE_MODE_SENTINEL = '__SERVICE__';

export async function withRequestContext<T>(
  pool: Pool,
  req: Request,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const ctx = getTenantContext(req);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await setSessionContext(client, ctx);
    
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

export async function setSessionContext(client: PoolClient, ctx: TenantContext): Promise<void> {
  // Set session variables - empty string means regular user without that context
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.circle_id', $1, true)`, [ctx.circle_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [ctx.individual_id || '']);
}

export async function withTenantContext<T>(
  pool: Pool,
  ctx: TenantContext,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await setSessionContext(client, ctx);
    
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

// Service mode context for background jobs, migrations, etc.
export async function withServiceContext<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    // Set sentinel value to bypass RLS for service operations
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    await client.query(`SELECT set_config('app.portal_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    await client.query(`SELECT set_config('app.circle_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    await client.query(`SELECT set_config('app.individual_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    
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

// Non-transactional variant for reads
export async function withServiceContextRead<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    await client.query(`SELECT set_config('app.portal_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    await client.query(`SELECT set_config('app.circle_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    await client.query(`SELECT set_config('app.individual_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
    
    return await callback(client);
  } finally {
    client.release();
  }
}
