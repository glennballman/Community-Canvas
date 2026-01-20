import { Pool } from 'pg';

interface UnreadParams {
  tenantId: string | null;
  individualId: string | null;
  partyId: string | null;
}

/**
 * Shared CTE for user participations across individual, party, and circle modes.
 * Used by both getUnreadTotal and getUnreadByConversation.
 */
function buildUserParticipationsCTE(): string {
  return `
    WITH user_participations AS (
      -- Direct participation (individual or party)
      SELECT DISTINCT
        p.id AS participant_id,
        p.conversation_id,
        p.joined_at
      FROM cc_conversation_participants p
      WHERE p.is_active = true
        AND (
          (p.individual_id IS NOT NULL AND p.individual_id = $1)
          OR
          (p.party_id IS NOT NULL AND p.party_id = $2)
        )

      UNION

      -- Circle-derived participation (tenant-scoped, non-optional)
      SELECT DISTINCT
        p.id AS participant_id,
        p.conversation_id,
        p.joined_at
      FROM cc_conversation_participants p
      JOIN cc_circle_members cm
        ON cm.circle_id = p.circle_id
       AND cm.individual_id = $1
       AND cm.is_active = true
       AND cm.tenant_id = $3::uuid
      WHERE p.is_active = true
        AND p.circle_id IS NOT NULL
    )
  `;
}

/**
 * Get total unread message count across all conversations for a user.
 * Returns 0 if tenantId or individualId is missing.
 */
export async function getUnreadTotal(
  db: Pool,
  params: UnreadParams
): Promise<number> {
  const { tenantId, individualId, partyId } = params;

  // Require both user and tenant context for security
  if (!tenantId || !individualId) {
    return 0;
  }

  const sql = `
    ${buildUserParticipationsCTE()}
    SELECT COUNT(*)::int AS unread
    FROM cc_messages m
    JOIN user_participations up ON m.conversation_id = up.conversation_id
    WHERE m.read_at IS NULL
      AND m.deleted_at IS NULL
      AND m.sender_participant_id IS DISTINCT FROM up.participant_id
      AND m.created_at >= COALESCE(up.joined_at, '1970-01-01'::timestamptz)
  `;

  const result = await db.query(sql, [individualId, partyId, tenantId]);
  return result.rows[0]?.unread || 0;
}

/**
 * Get unread message count per conversation for a user.
 * Returns empty map if tenantId or individualId is missing.
 */
export async function getUnreadByConversation(
  db: Pool,
  params: UnreadParams
): Promise<Record<string, number>> {
  const { tenantId, individualId, partyId } = params;

  // Require both user and tenant context for security
  if (!tenantId || !individualId) {
    return {};
  }

  const sql = `
    ${buildUserParticipationsCTE()}
    SELECT m.conversation_id, COUNT(*)::int AS unread
    FROM cc_messages m
    JOIN user_participations up ON m.conversation_id = up.conversation_id
    WHERE m.read_at IS NULL
      AND m.deleted_at IS NULL
      AND m.sender_participant_id IS DISTINCT FROM up.participant_id
      AND m.created_at >= COALESCE(up.joined_at, '1970-01-01'::timestamptz)
    GROUP BY m.conversation_id
  `;

  const result = await db.query(sql, [individualId, partyId, tenantId]);
  
  const unreadMap: Record<string, number> = {};
  for (const row of result.rows) {
    unreadMap[row.conversation_id] = row.unread;
  }
  return unreadMap;
}
