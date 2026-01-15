/**
 * Messaging Routing Service
 * Phase A1 - Circle-aware message routing and recipient resolution
 * 
 * Handles dynamic resolution of circle participants to individual recipients
 * for message fan-out and notification delivery.
 * 
 * Uses serviceQuery pattern to bypass RLS safely for recipient resolution.
 */

import { serviceQuery } from '../db/tenantDb';

/**
 * Resolve all individuals who should receive messages sent to a circle.
 * 
 * Includes:
 * - Active circle members with member_type = 'individual'
 * - Active circle delegations where delegatee is an individual
 * 
 * Respects:
 * - Circle status (must be 'active')
 * - Member is_active flag
 * - Delegation status and expiry
 * 
 * Uses serviceQuery pattern (bypasses RLS safely)
 * 
 * @param circleId - UUID of the circle to resolve recipients for
 * @returns Array of distinct individual IDs who should receive the message
 */
export async function resolveCircleRecipients(circleId: string): Promise<string[]> {
  const result = await serviceQuery(`
    WITH circle_members AS (
      SELECT DISTINCT cm.individual_id
      FROM cc_circle_members cm
      JOIN cc_coordination_circles c ON c.id = cm.circle_id
      WHERE cm.circle_id = $1
        AND cm.member_type = 'individual'
        AND cm.individual_id IS NOT NULL
        AND cm.is_active = true
        AND c.status = 'active'
    ),
    circle_delegatees AS (
      SELECT DISTINCT cd.delegatee_individual_id as individual_id
      FROM cc_circle_delegations cd
      JOIN cc_coordination_circles c ON c.id = cd.circle_id
      WHERE cd.circle_id = $1
        AND cd.delegatee_member_type = 'individual'
        AND cd.delegatee_individual_id IS NOT NULL
        AND cd.status = 'active'
        AND c.status = 'active'
        AND (cd.expires_at IS NULL OR cd.expires_at > now())
    )
    SELECT individual_id FROM circle_members
    UNION
    SELECT individual_id FROM circle_delegatees
  `, [circleId]);

  return result.rows
    .map((row: any) => row.individual_id as string)
    .filter(Boolean);
}

/**
 * Resolve all circle participants in a conversation
 * 
 * @param conversationId - UUID of the conversation
 * @returns Array of { circleId, circleName } for circles participating
 */
export async function getConversationCircleParticipants(conversationId: string): Promise<{
  circleId: string;
  circleName: string;
}[]> {
  const result = await serviceQuery(`
    SELECT 
      cp.circle_id,
      c.name as circle_name
    FROM cc_conversation_participants cp
    JOIN cc_coordination_circles c ON c.id = cp.circle_id
    WHERE cp.conversation_id = $1
      AND cp.participant_type = 'circle'
      AND cp.is_active = true
      AND c.status = 'active'
  `, [conversationId]);

  return result.rows.map((row: any) => ({
    circleId: row.circle_id as string,
    circleName: row.circle_name as string,
  }));
}

/**
 * Resolve all individuals who should receive a message in a conversation.
 * Handles both direct individual participants and circle participants.
 * 
 * @param conversationId - UUID of the conversation
 * @returns Array of distinct individual IDs (deduped across all participant types)
 */
export async function resolveConversationRecipients(conversationId: string): Promise<string[]> {
  // Get direct individual participants
  const directResult = await serviceQuery(`
    SELECT DISTINCT cp.individual_id
    FROM cc_conversation_participants cp
    WHERE cp.conversation_id = $1
      AND cp.participant_type = 'individual'
      AND cp.individual_id IS NOT NULL
      AND cp.is_active = true
  `, [conversationId]);

  const directIndividuals = directResult.rows
    .map((row: any) => row.individual_id as string)
    .filter(Boolean);

  // Get circle participants and expand them
  const circleParticipants = await getConversationCircleParticipants(conversationId);
  
  const circleIndividuals: string[] = [];
  for (const circle of circleParticipants) {
    const recipients = await resolveCircleRecipients(circle.circleId);
    circleIndividuals.push(...recipients);
  }

  // Deduplicate
  const uniqueSet = new Set([...directIndividuals, ...circleIndividuals]);
  const allRecipients: string[] = [];
  uniqueSet.forEach(id => allRecipients.push(id));
  
  return allRecipients;
}

/**
 * Check if an individual is a recipient of a conversation (directly or via circle)
 * 
 * @param conversationId - UUID of the conversation
 * @param individualId - UUID of the individual to check
 * @returns True if individual should receive messages in this conversation
 */
export async function isConversationRecipient(
  conversationId: string, 
  individualId: string
): Promise<boolean> {
  // Check direct participation first (fast path)
  const directResult = await serviceQuery(`
    SELECT 1
    FROM cc_conversation_participants cp
    WHERE cp.conversation_id = $1
      AND cp.participant_type = 'individual'
      AND cp.individual_id = $2
      AND cp.is_active = true
    LIMIT 1
  `, [conversationId, individualId]);

  if (directResult.rows.length > 0) {
    return true;
  }

  // Check circle membership (slower path)
  const circleResult = await serviceQuery(`
    SELECT 1
    FROM cc_conversation_participants cp
    JOIN cc_circle_members cm ON cm.circle_id = cp.circle_id
    JOIN cc_coordination_circles c ON c.id = cp.circle_id
    WHERE cp.conversation_id = $1
      AND cp.participant_type = 'circle'
      AND cp.is_active = true
      AND cm.individual_id = $2
      AND cm.is_active = true
      AND c.status = 'active'
    LIMIT 1
  `, [conversationId, individualId]);

  if (circleResult.rows.length > 0) {
    return true;
  }

  // Check delegation
  const delegationResult = await serviceQuery(`
    SELECT 1
    FROM cc_conversation_participants cp
    JOIN cc_circle_delegations cd ON cd.circle_id = cp.circle_id
    JOIN cc_coordination_circles c ON c.id = cp.circle_id
    WHERE cp.conversation_id = $1
      AND cp.participant_type = 'circle'
      AND cp.is_active = true
      AND cd.delegatee_individual_id = $2
      AND cd.status = 'active'
      AND c.status = 'active'
      AND (cd.expires_at IS NULL OR cd.expires_at > now())
    LIMIT 1
  `, [conversationId, individualId]);

  return delegationResult.rows.length > 0;
}

/**
 * Fan-out a message to all resolved recipients.
 * Creates notifications for each individual who should receive the message.
 * Uses the existing cc_notifications/cc_notification_deliveries schema.
 * 
 * @param messageId - UUID of the message to fan-out
 * @param conversationId - UUID of the conversation
 * @param senderId - UUID of the sender (to exclude from delivery)
 * @param messagePreview - Short preview of the message content
 * @returns Object with recipient count and any circle attributions
 */
export async function fanOutMessageToRecipients(
  messageId: string,
  conversationId: string,
  senderId?: string,
  messagePreview?: string
): Promise<{
  recipientCount: number;
  circleRecipients: { circleId: string; recipientCount: number }[];
}> {
  // Get all participants including circles
  const circleParticipants = await getConversationCircleParticipants(conversationId);
  
  // Get direct individual recipients
  const directResult = await serviceQuery(`
    SELECT cp.individual_id
    FROM cc_conversation_participants cp
    WHERE cp.conversation_id = $1
      AND cp.participant_type = 'individual'
      AND cp.individual_id IS NOT NULL
      AND cp.is_active = true
      AND ($2::uuid IS NULL OR cp.individual_id != $2::uuid)
  `, [conversationId, senderId || null]);
  
  const directIndividuals = directResult.rows
    .map((row: any) => row.individual_id as string)
    .filter(Boolean);
  
  // Track circle attributions for the response
  const circleRecipients: { circleId: string; recipientCount: number }[] = [];
  
  // Track all recipients to avoid duplicates
  const deliveredTo = new Set<string>();
  
  // Helper to create notification for a recipient (idempotent via upsert)
  async function createNotification(recipientId: string, viaCircleId?: string): Promise<void> {
    // Upsert notification - uses unique index on (context_type, context_id, recipient_individual_id) for idempotency
    // This is transaction-safe because it uses ON CONFLICT with column list matching the unique index
    // Attribution derived from GUC context (current_tenant_id, current_individual_id, current_portal_id)
    const notifResult = await serviceQuery(`
      INSERT INTO cc_notifications (
        recipient_individual_id,
        category,
        priority,
        channels,
        context_type,
        context_id,
        context_data,
        body,
        short_body,
        action_url,
        sender_tenant_id,
        metadata
      )
      VALUES (
        $1,
        'message',
        'normal',
        ARRAY['in_app']::notification_channel[],
        'message',
        $2,
        $3,
        'You have a new message',
        $4,
        '/conversations/' || $5,
        current_tenant_id(),
        jsonb_build_object(
          'sender_individual_id', current_individual_id(),
          'sender_circle_id', $6::uuid,
          'sender_portal_id', current_portal_id(),
          'conversation_id', $5
        )
      )
      ON CONFLICT (context_type, context_id, recipient_individual_id) 
        WHERE context_type IS NOT NULL AND context_id IS NOT NULL AND recipient_individual_id IS NOT NULL
      DO UPDATE SET updated_at = now()
      RETURNING id
    `, [
      recipientId, 
      messageId, 
      JSON.stringify({ conversation_id: conversationId, via_circle_id: viaCircleId }),
      messagePreview || 'New message',
      conversationId,
      viaCircleId || null
    ]);
    
    const notificationId = notifResult.rows[0]?.id;
    
    if (notificationId) {
      // Create in-app delivery (unique constraint on notification_id + channel handles dedupe)
      await serviceQuery(`
        INSERT INTO cc_notification_deliveries (
          notification_id,
          channel,
          status,
          via_circle_id
        )
        VALUES ($1, 'in_app', 'pending', $2)
        ON CONFLICT (notification_id, channel) DO NOTHING
      `, [notificationId, viaCircleId || null]);
    }
  }
  
  // Resolve circle members and create notifications with circle attribution
  for (const circle of circleParticipants) {
    const recipients = await resolveCircleRecipients(circle.circleId);
    const filteredRecipients = senderId 
      ? recipients.filter(id => id !== senderId) 
      : recipients;
    
    let circleDeliveryCount = 0;
    for (const recipientId of filteredRecipients) {
      // Skip if already delivered to this recipient
      if (deliveredTo.has(recipientId)) continue;
      deliveredTo.add(recipientId);
      
      await createNotification(recipientId, circle.circleId);
      circleDeliveryCount++;
    }
    
    if (circleDeliveryCount > 0) {
      circleRecipients.push({
        circleId: circle.circleId,
        recipientCount: circleDeliveryCount,
      });
    }
  }
  
  // Create notifications for direct individual participants
  for (const recipientId of directIndividuals) {
    // Skip if already delivered via circle
    if (deliveredTo.has(recipientId)) continue;
    deliveredTo.add(recipientId);
    
    await createNotification(recipientId);
  }
  
  return {
    recipientCount: deliveredTo.size,
    circleRecipients,
  };
}

/**
 * Create or find a conversation with a circle participant
 * Used for inbound routing where external events are addressed to a circle
 * 
 * @param circleId - UUID of the circle
 * @param externalIndividualId - Optional individual ID for the external participant
 * @param externalPartyId - Optional party ID for legacy participants (uses party_id path)
 * @param subject - Optional conversation subject
 * @returns Conversation ID (existing or newly created)
 */
export async function findOrCreateCircleConversation(
  circleId: string,
  externalIndividualId?: string,
  externalPartyId?: string,
  subject?: string
): Promise<string> {
  // Try to find existing conversation with this circle and external participant
  if (externalIndividualId) {
    const existingResult = await serviceQuery(`
      SELECT c.id
      FROM cc_conversations c
      JOIN cc_conversation_participants cp1 ON cp1.conversation_id = c.id
      JOIN cc_conversation_participants cp2 ON cp2.conversation_id = c.id
      WHERE cp1.participant_type = 'circle'
        AND cp1.circle_id = $1
        AND cp1.is_active = true
        AND cp2.participant_type = 'individual'
        AND cp2.individual_id = $2
        AND cp2.is_active = true
      ORDER BY c.created_at DESC
      LIMIT 1
    `, [circleId, externalIndividualId]);

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0].id as string;
    }
  } else if (externalPartyId) {
    // Legacy path: find by party_id
    const existingResult = await serviceQuery(`
      SELECT c.id
      FROM cc_conversations c
      JOIN cc_conversation_participants cp1 ON cp1.conversation_id = c.id
      JOIN cc_conversation_participants cp2 ON cp2.conversation_id = c.id
      WHERE cp1.participant_type = 'circle'
        AND cp1.circle_id = $1
        AND cp1.is_active = true
        AND cp2.party_id = $2
        AND cp2.is_active = true
      ORDER BY c.created_at DESC
      LIMIT 1
    `, [circleId, externalPartyId]);

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0].id as string;
    }
  }

  // Create new conversation
  const convResult = await serviceQuery(`
    INSERT INTO cc_conversations (subject, status, created_at, updated_at)
    VALUES ($1, 'active', now(), now())
    RETURNING id
  `, [subject || 'Circle Conversation']);

  const conversationId = convResult.rows[0].id as string;

  // Add circle as participant
  await serviceQuery(`
    INSERT INTO cc_conversation_participants (
      conversation_id, participant_type, circle_id, is_active, joined_at
    )
    VALUES ($1, 'circle', $2, true, now())
  `, [conversationId, circleId]);

  // Add external participant if provided
  if (externalIndividualId) {
    // Proper individual participant
    await serviceQuery(`
      INSERT INTO cc_conversation_participants (
        conversation_id, participant_type, individual_id, is_active, joined_at
      )
      VALUES ($1, 'individual', $2, true, now())
    `, [conversationId, externalIndividualId]);
  } else if (externalPartyId) {
    // Legacy party participant - uses party_id without explicit participant_type
    // The constraint allows party_id IS NOT NULL as a fallback (backward compat)
    // Explicitly set participant_type to default 'individual' which the constraint OR clause bypasses
    await serviceQuery(`
      INSERT INTO cc_conversation_participants (
        conversation_id, party_id, is_active, joined_at
      )
      VALUES ($1, $2, true, now())
    `, [conversationId, externalPartyId]);
  }

  return conversationId;
}
