/**
 * Job Application Conversations Service
 * M-1A: Enables threaded applicant ↔ operator messaging for job applications
 * 
 * Reuses: cc_conversations, cc_messages, cc_conversation_participants
 * Features: unread counters, contact redaction gates
 */

import { serviceQuery, withServiceTransaction } from '../db/tenantDb';

export interface JobApplicationConversationParams {
  jobId: string;
  applicationId: string;
  applicantIndividualId: string;
  applicantPartyId?: string;
  operatorPartyId: string;
  operatorIndividualId?: string;
  tenantId: string;
}

export interface ConversationResult {
  id: string;
  created: boolean;
  job_id: string;
  job_application_id: string;
  state: string;
}

/**
 * Find or create a conversation for a job application.
 * Uses existing cc_conversations with job linkage.
 * 
 * One conversation per application (enforced by unique constraint).
 * Inserts participants into cc_conversation_participants.
 * Uses existing contact redaction gates (contact_unlocked = false by default).
 */
export async function findOrCreateJobApplicationConversation(
  params: JobApplicationConversationParams
): Promise<ConversationResult> {
  const {
    jobId,
    applicationId,
    applicantIndividualId,
    applicantPartyId,
    operatorPartyId,
    operatorIndividualId,
    tenantId,
  } = params;

  return withServiceTransaction(async (client) => {
    // Check for existing conversation
    const existing = await client.query(
      `SELECT id, job_id, job_application_id, state 
       FROM cc_conversations 
       WHERE job_application_id = $1`,
      [applicationId]
    );

    if (existing.rows.length > 0) {
      return {
        id: existing.rows[0].id,
        created: false,
        job_id: existing.rows[0].job_id,
        job_application_id: existing.rows[0].job_application_id,
        state: existing.rows[0].state,
      };
    }

    // Resolve or create applicant party if not provided
    let resolvedApplicantPartyId = applicantPartyId;
    if (!resolvedApplicantPartyId) {
      // Check if individual has a party
      const partyResult = await client.query(
        `SELECT p.id FROM cc_parties p
         JOIN cc_party_individuals pi ON pi.party_id = p.id
         WHERE pi.individual_id = $1
         LIMIT 1`,
        [applicantIndividualId]
      );

      if (partyResult.rows.length > 0) {
        resolvedApplicantPartyId = partyResult.rows[0].id;
      } else {
        // Auto-create applicant party
        const newParty = await client.query(
          `INSERT INTO cc_parties (tenant_id, party_type, status, trade_name, metadata)
           VALUES ($1, 'contractor', 'pending', 'Job Applicant', $2::jsonb)
           RETURNING id`,
          [
            tenantId,
            JSON.stringify({ auto_created: true, source: 'job_application', created_at: new Date().toISOString() })
          ]
        );
        resolvedApplicantPartyId = newParty.rows[0].id;

        // Link individual to party
        await client.query(
          `INSERT INTO cc_party_individuals (party_id, individual_id, role, is_primary)
           VALUES ($1, $2, 'applicant', true)
           ON CONFLICT DO NOTHING`,
          [resolvedApplicantPartyId, applicantIndividualId]
        );
      }
    }

    // Create the conversation with job linkage
    // work_request_id is NULL for job-based conversations
    const convResult = await client.query(
      `INSERT INTO cc_conversations (
        work_request_id,
        job_id,
        job_application_id,
        contractor_party_id,
        owner_party_id,
        contractor_actor_party_id,
        owner_actor_party_id,
        state,
        contact_unlocked,
        unread_owner,
        unread_contractor
      ) VALUES (
        NULL,
        $1, $2, $3, $4, $3, $4,
        'interest',
        false,
        0, 0
      )
      RETURNING id, job_id, job_application_id, state`,
      [jobId, applicationId, resolvedApplicantPartyId, operatorPartyId]
    );

    const conversation = convResult.rows[0];

    // Insert participants
    // Applicant as contractor side
    await client.query(
      `INSERT INTO cc_conversation_participants (
        conversation_id, individual_id, party_id, role, is_active
      ) VALUES ($1, $2, $3, 'applicant', true)
      ON CONFLICT DO NOTHING`,
      [conversation.id, applicantIndividualId, resolvedApplicantPartyId]
    );

    // Operator as owner side
    if (operatorIndividualId) {
      await client.query(
        `INSERT INTO cc_conversation_participants (
          conversation_id, individual_id, party_id, role, is_active
        ) VALUES ($1, $2, $3, 'operator', true)
        ON CONFLICT DO NOTHING`,
        [conversation.id, operatorIndividualId, operatorPartyId]
      );
    } else {
      // Party-only participant
      await client.query(
        `INSERT INTO cc_conversation_participants (
          conversation_id, party_id, role, is_active
        ) VALUES ($1, $2, 'operator', true)
        ON CONFLICT DO NOTHING`,
        [conversation.id, operatorPartyId]
      );
    }

    return {
      id: conversation.id,
      created: true,
      job_id: conversation.job_id,
      job_application_id: conversation.job_application_id,
      state: conversation.state,
    };
  });
}

/**
 * Get conversation for a job application (if exists)
 */
export async function getJobApplicationConversation(
  applicationId: string
): Promise<ConversationResult | null> {
  const result = await serviceQuery(
    `SELECT id, job_id, job_application_id, state
     FROM cc_conversations
     WHERE job_application_id = $1`,
    [applicationId]
  );

  if (result.rows.length === 0) return null;

  return {
    id: result.rows[0].id,
    created: false,
    job_id: result.rows[0].job_id,
    job_application_id: result.rows[0].job_application_id,
    state: result.rows[0].state,
  };
}

/**
 * List conversations for a job (operator view)
 */
export async function listJobConversations(
  jobId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ conversations: any[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const countResult = await serviceQuery(
    `SELECT COUNT(*) as total FROM cc_conversations WHERE job_id = $1`,
    [jobId]
  );

  const result = await serviceQuery(
    `SELECT 
      c.id,
      c.job_application_id,
      c.state,
      c.contact_unlocked,
      c.message_count,
      c.unread_owner,
      c.last_message_at,
      c.created_at,
      a.application_number,
      a.status as application_status,
      i.given_name as applicant_given_name,
      i.family_name as applicant_family_name
     FROM cc_conversations c
     JOIN cc_job_applications a ON a.id = c.job_application_id
     LEFT JOIN cc_individuals i ON i.id = a.applicant_individual_id
     WHERE c.job_id = $1
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [jobId, limit, offset]
  );

  return {
    conversations: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
}

/**
 * Increment unread counter when a message is sent
 */
export async function incrementJobConversationUnread(
  conversationId: string,
  senderRole: 'applicant' | 'operator'
): Promise<void> {
  const counterField = senderRole === 'applicant' ? 'unread_owner' : 'unread_contractor';
  
  await serviceQuery(
    `UPDATE cc_conversations 
     SET ${counterField} = ${counterField} + 1,
         updated_at = now()
     WHERE id = $1`,
    [conversationId]
  );
}
