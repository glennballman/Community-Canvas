import { db } from "../db";
import { sql } from "drizzle-orm";

export class EntitlementService {
  /**
   * Check if tenant has a boolean entitlement
   */
  async hasEntitlement(tenantId: string, entitlementKey: string): Promise<boolean> {
    const result = await db.execute(
      sql`SELECT cc_has_entitlement(${tenantId}::uuid, ${entitlementKey}) as has_it`
    );
    return result.rows[0]?.has_it ?? false;
  }

  /**
   * Get numeric entitlement value (null = unlimited)
   */
  async getEntitlementValue(tenantId: string, entitlementKey: string): Promise<number | null> {
    const result = await db.execute(
      sql`SELECT cc_entitlement_value(${tenantId}::uuid, ${entitlementKey}) as value`
    );
    return result.rows[0]?.value ?? null;
  }

  /**
   * Get tenant's current balance
   */
  async getTenantBalance(tenantId: string): Promise<number> {
    const result = await db.execute(
      sql`SELECT cc_tenant_balance(${tenantId}::uuid) as balance`
    );
    return Number(result.rows[0]?.balance ?? 0);
  }

  /**
   * Record a value event and optionally create ledger entry
   */
  async recordValueEvent(params: {
    eventType: string;
    tenantId: string;
    actorTypeId: string;
    baseAmount: number;
    description: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    scarcityMultiplier?: number;
    urgencyMultiplier?: number;
    metadata?: Record<string, any>;
    createLedgerEntry?: boolean;
  }): Promise<string> {
    const result = await db.execute(sql`
      SELECT cc_record_value_event(
        ${params.eventType}::value_event_type,
        ${params.tenantId}::uuid,
        ${params.actorTypeId}::uuid,
        ${params.baseAmount}::numeric,
        ${params.description},
        ${params.relatedEntityType ?? null},
        ${params.relatedEntityId ?? null}::uuid,
        ${params.scarcityMultiplier ?? 1.0}::numeric,
        ${params.urgencyMultiplier ?? 1.0}::numeric,
        ${JSON.stringify(params.metadata ?? {})}::jsonb,
        ${params.createLedgerEntry ?? true}
      ) as event_id
    `);
    return result.rows[0]?.event_id;
  }
}

export const entitlementService = new EntitlementService();
