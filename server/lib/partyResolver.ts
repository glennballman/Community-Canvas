import { pool } from '../db';

export type PartyRole = 'owner' | 'contractor' | 'operator';

export interface ResolvedActor {
  individual_id: string;
  tenant_id: string | null;
  actor_party_id: string;
  party_kind: 'individual' | 'organization';
  display_name: string;
}

function getIndividualId(req: any): string | null {
  return req?.ctx?.individual_id || req?.user?.id || null;
}

export async function resolveActorParty(req: any, role: PartyRole): Promise<ResolvedActor | null> {
  const individual_id = getIndividualId(req);
  const tenant_id = req?.ctx?.tenant_id || null;

  if (!individual_id) {
    console.warn('resolveActorParty: No individual_id found in request');
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const individualResult = await client.query(
      `SELECT COALESCE(NULLIF(preferred_name, ''), full_name) AS display_name
       FROM cc_individuals WHERE id = $1`,
      [individual_id]
    );
    const individualDisplayName = individualResult.rows[0]?.display_name || 'Unknown User';

    if (tenant_id) {
      const orgPartyResult = await client.query(
        `SELECT id, trade_name, legal_name FROM cc_parties
         WHERE tenant_id = $1 AND party_kind = 'organization'
         ORDER BY created_at ASC LIMIT 1`,
        [tenant_id]
      );

      let org_party_id = orgPartyResult.rows[0]?.id as string | undefined;
      let org_display_name = orgPartyResult.rows[0]?.trade_name || 
                             orgPartyResult.rows[0]?.legal_name || 'Unknown Organization';

      if (!org_party_id) {
        const tenantResult = await client.query(
          `SELECT name, email, telephone, business_number,
                  address_line1, address_line2, city, province, postal_code, country
           FROM tenants WHERE id = $1`,
          [tenant_id]
        );

        const tenant = tenantResult.rows[0];
        if (!tenant?.name) {
          await client.query('ROLLBACK');
          console.error('resolveActorParty: Tenant not found or missing name');
          return null;
        }

        const createResult = await client.query(
          `INSERT INTO cc_parties (
              tenant_id, party_kind, party_type, status,
              legal_name, trade_name,
              tax_id,
              primary_contact_email, primary_contact_telephone,
              address_line1, address_line2, city, province, postal_code, country
           ) VALUES (
              $1, 'organization', $2::party_type, 'active',
              $3, $4,
              $5,
              $6, $7,
              $8, $9, $10, $11, $12, $13
           )
           RETURNING id, trade_name, legal_name`,
          [
            tenant_id,
            role,
            tenant.name,
            tenant.name,
            tenant.business_number || null,
            tenant.email || null,
            tenant.telephone || null,
            tenant.address_line1 || null,
            tenant.address_line2 || null,
            tenant.city || null,
            tenant.province || 'BC',
            tenant.postal_code || null,
            tenant.country || 'CA'
          ]
        );

        org_party_id = createResult.rows[0].id;
        org_display_name = createResult.rows[0].trade_name || createResult.rows[0].legal_name;
      }

      await client.query(
        `INSERT INTO cc_party_memberships (party_id, individual_id, role, is_active)
         VALUES ($1, $2, 'admin', true)
         ON CONFLICT (party_id, individual_id)
         DO UPDATE SET is_active = true, updated_at = now()`,
        [org_party_id, individual_id]
      );

      await client.query('COMMIT');

      return {
        individual_id,
        tenant_id,
        actor_party_id: org_party_id!,
        party_kind: 'organization',
        display_name: org_display_name
      };
    }

    const existingIndParty = await client.query(
      `SELECT id, trade_name, legal_name FROM cc_parties
       WHERE party_kind = 'individual'
         AND metadata->>'individual_id' = $1
       ORDER BY created_at ASC LIMIT 1`,
      [individual_id]
    );

    let ind_party_id = existingIndParty.rows[0]?.id as string | undefined;
    let ind_display_name = existingIndParty.rows[0]?.trade_name || 
                           existingIndParty.rows[0]?.legal_name || 
                           individualDisplayName;

    if (!ind_party_id) {
      const createResult = await client.query(
        `INSERT INTO cc_parties (
            party_kind, party_type, status, 
            legal_name, trade_name, 
            metadata
         ) VALUES (
            'individual', $1::party_type, 'active',
            $2, $2,
            jsonb_build_object('individual_id', $3)
         )
         RETURNING id, trade_name`,
        [role, individualDisplayName, individual_id]
      );

      ind_party_id = createResult.rows[0].id;
      ind_display_name = createResult.rows[0].trade_name;
    }

    await client.query('COMMIT');

    return {
      individual_id,
      tenant_id: null,
      actor_party_id: ind_party_id!,
      party_kind: 'individual',
      display_name: ind_display_name
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('resolveActorParty error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function isPartyMember(
  party_id: string, 
  individual_id: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM cc_party_memberships 
     WHERE party_id = $1 AND individual_id = $2 AND is_active = true
     LIMIT 1`,
    [party_id, individual_id]
  );
  return result.rows.length > 0;
}

export async function canUnlockContact(conversation_id: string): Promise<{
  canUnlock: boolean;
  gate: string;
  reason: string;
}> {
  const client = await pool.connect();
  try {
    const convResult = await client.query(
      `SELECT c.*, c.contact_unlocked, c.contact_unlock_gate
       FROM cc_conversations c WHERE c.id = $1`,
      [conversation_id]
    );

    if (convResult.rows.length === 0) {
      return { canUnlock: false, gate: 'none', reason: 'Conversation not found' };
    }

    const conv = convResult.rows[0];

    if (conv.contact_unlocked) {
      return { 
        canUnlock: true, 
        gate: conv.contact_unlock_gate || 'already_unlocked', 
        reason: 'Contact already unlocked' 
      };
    }

    const priorResult = await client.query(
      `SELECT 1 FROM cc_conversations
       WHERE contractor_party_id = $1 AND owner_party_id = $2
         AND state = 'completed'
         AND id != $3
       LIMIT 1`,
      [conv.contractor_party_id, conv.owner_party_id, conversation_id]
    );

    if (priorResult.rows.length > 0) {
      return { 
        canUnlock: true, 
        gate: 'prior_relationship', 
        reason: 'Prior completed work together' 
      };
    }

    const depositResult = await client.query(
      `SELECT 1 FROM cc_payment_promises pp
       JOIN cc_payment_milestones pm ON pm.payment_promise_id = pp.id
       WHERE pp.conversation_id = $1
         AND pm.trigger_type IN ('on_award', 'on_contract_sign')
         AND pm.status = 'verified'
       LIMIT 1`,
      [conversation_id]
    );

    if (depositResult.rows.length > 0) {
      return { 
        canUnlock: true, 
        gate: 'deposit_verified', 
        reason: 'Deposit has been verified' 
      };
    }

    return { 
      canUnlock: false, 
      gate: 'none', 
      reason: 'Deposit required before contact details can be shared' 
    };

  } finally {
    client.release();
  }
}
