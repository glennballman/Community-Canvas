import { pool } from '../db';

/**
 * TRUST SIGNALS - SMALL TOWN PHILOSOPHY
 * 
 * What we compute and show (if contractor allows):
 * - Jobs completed count
 * - Repeat customer rate (best signal)
 * - Response time (DEFAULT HIDDEN - weaponizable)
 * - Community verifications
 * - Credentials
 * - Positive appreciations
 * 
 * What we NEVER show publicly:
 * - Complaint counts
 * - Negative narratives
 * - Dispute rates
 * - Write-off history
 * - Private feedback content
 * 
 * Schema notes:
 * - cc_trust_signals uses UNIQUE(party_id, model)
 * - Use model = 'v1_agg' consistently
 * - Use existing column names (response_time_avg_hours, not avg_response_hours)
 */

const MODEL_NAME = 'v1_agg';

export interface TrustSignalSummary {
  party_id: string;
  model: string;
  
  jobs_completed: number;
  jobs_in_progress: number;
  completion_rate: number | null;
  
  repeat_customer_count: number;
  total_unique_customers: number;
  repeat_customer_rate: number | null;
  
  response_time_avg_hours: number | null;
  
  verified_communities: string[];
  years_in_community: number | null;
  
  has_insurance: boolean;
  licenses: string[];
  certifications: string[];
  
  positive_feedback_count: number;
  public_appreciation_count: number;
  appreciation_highlights: string[];
  
  member_since: string | null;
  platform_verified: boolean;
  
  display_preferences: Record<string, boolean>;
}

export async function computeTrustSignals(party_id: string): Promise<TrustSignalSummary> {
  const client = await pool.connect();
  try {
    const partyResult = await client.query(
      `SELECT created_at, party_type FROM cc_parties WHERE id = $1`,
      [party_id]
    );
    
    const memberSince = partyResult.rows[0]?.created_at;

    const completedResult = await client.query(
      `SELECT 
         COUNT(*) FILTER (WHERE state = 'completed') as completed,
         COUNT(*) FILTER (WHERE state = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE state IN ('completed', 'cancelled', 'closed')) as total_finished,
         COUNT(DISTINCT owner_party_id) as unique_customers
       FROM cc_conversations
       WHERE contractor_party_id = $1`,
      [party_id]
    );
    
    const completed = parseInt(completedResult.rows[0]?.completed || '0');
    const inProgress = parseInt(completedResult.rows[0]?.in_progress || '0');
    const totalFinished = parseInt(completedResult.rows[0]?.total_finished || '0');
    const uniqueCustomers = parseInt(completedResult.rows[0]?.unique_customers || '0');
    
    const completionRate = totalFinished > 0 
      ? (completed / totalFinished) * 100 
      : null;

    const repeatResult = await client.query(
      `SELECT COUNT(*) as repeat_count
       FROM (
         SELECT owner_party_id
         FROM cc_conversations
         WHERE contractor_party_id = $1 AND state = 'completed'
         GROUP BY owner_party_id
         HAVING COUNT(*) > 1
       ) repeat_customers`,
      [party_id]
    );
    
    const repeatCount = parseInt(repeatResult.rows[0]?.repeat_count || '0');
    const repeatRate = uniqueCustomers > 0 
      ? (repeatCount / uniqueCustomers) * 100 
      : null;

    const responseResult = await client.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (first_response - conv_created)) / 3600) as avg_hours
       FROM (
         SELECT c.created_at as conv_created,
                MIN(m.created_at) as first_response
         FROM cc_conversations c
         JOIN cc_messages m ON m.conversation_id = c.id
         WHERE c.contractor_party_id = $1
           AND m.sender_party_id = $1
         GROUP BY c.id, c.created_at
       ) response_times
       WHERE first_response IS NOT NULL`,
      [party_id]
    );
    
    const responseTimeAvg = responseResult.rows[0]?.avg_hours 
      ? parseFloat(parseFloat(responseResult.rows[0].avg_hours).toFixed(2))
      : null;

    const communityResult = await client.query(
      `SELECT community_name FROM cc_community_verifications
       WHERE party_id = $1 AND is_active = true`,
      [party_id]
    );
    
    const verifiedCommunities = communityResult.rows.map(r => r.community_name);

    const credentialResult = await client.query(
      `SELECT credential_type, credential_name 
       FROM cc_credential_verifications
       WHERE party_id = $1 AND is_current = true`,
      [party_id]
    );
    
    const hasInsurance = credentialResult.rows.some(
      r => r.credential_type.includes('insurance')
    );
    const licenses = credentialResult.rows
      .filter(r => r.credential_type.includes('license'))
      .map(r => r.credential_name);
    const certifications = credentialResult.rows
      .filter(r => !r.credential_type.includes('license') && !r.credential_type.includes('insurance'))
      .map(r => r.credential_name);

    const positiveFeedbackResult = await client.query(
      `SELECT COUNT(*) as count
       FROM cc_contractor_feedback
       WHERE to_party_id = $1 
         AND sentiment = 'positive'
         AND contractor_deleted_at IS NULL`,
      [party_id]
    );
    
    const positiveFeedbackCount = parseInt(positiveFeedbackResult.rows[0]?.count || '0');

    const appreciationResult = await client.query(
      `SELECT COUNT(*) as count
       FROM cc_public_appreciations
       WHERE to_party_id = $1 
         AND is_public = true 
         AND hidden_by_contractor = false`,
      [party_id]
    );
    
    const appreciationCount = parseInt(appreciationResult.rows[0]?.count || '0');

    const highlightsResult = await client.query(
      `SELECT theme FROM cc_appreciation_themes
       WHERE party_id = $1
       ORDER BY mention_count DESC
       LIMIT 5`,
      [party_id]
    );
    
    const highlights = highlightsResult.rows.map(r => r.theme);

    const prefsResult = await client.query(
      `SELECT display_preferences FROM cc_trust_signals 
       WHERE party_id = $1 AND model = $2`,
      [party_id, MODEL_NAME]
    );
    
    const displayPreferences = prefsResult.rows[0]?.display_preferences || {
      show_repeat_customers: true,
      show_public_appreciations: true,
      show_credentials: true,
      show_response_time: false,
      show_years_in_community: true,
      show_completion_rate: true
    };

    const platformVerified = completed >= 5 && repeatCount >= 1;

    return {
      party_id,
      model: MODEL_NAME,
      jobs_completed: completed,
      jobs_in_progress: inProgress,
      completion_rate: completionRate ? parseFloat(completionRate.toFixed(1)) : null,
      repeat_customer_count: repeatCount,
      total_unique_customers: uniqueCustomers,
      repeat_customer_rate: repeatRate ? parseFloat(repeatRate.toFixed(1)) : null,
      response_time_avg_hours: responseTimeAvg,
      verified_communities: verifiedCommunities,
      years_in_community: null,
      has_insurance: hasInsurance,
      licenses,
      certifications,
      positive_feedback_count: positiveFeedbackCount,
      public_appreciation_count: appreciationCount,
      appreciation_highlights: highlights,
      member_since: memberSince ? memberSince.toISOString().split('T')[0] : null,
      platform_verified: platformVerified,
      display_preferences: displayPreferences
    };

  } finally {
    client.release();
  }
}

export async function saveTrustSignals(signals: TrustSignalSummary): Promise<void> {
  const partyResult = await pool.query(
    `SELECT party_type FROM cc_parties WHERE id = $1`,
    [signals.party_id]
  );
  const partyType = partyResult.rows[0]?.party_type || 'contractor';

  await pool.query(
    `INSERT INTO cc_trust_signals (
      party_id, party_type, model,
      response_time_avg_hours, completion_rate,
      repeat_customer_count, positive_feedback_count, public_appreciation_count,
      years_in_community, jobs_completed, jobs_in_progress, total_unique_customers,
      has_insurance, licenses, certifications, verified_communities,
      member_since, platform_verified, appreciation_highlights,
      display_preferences, computed_at, computation_version, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, now(), 1, now())
    ON CONFLICT (party_id, model) DO UPDATE SET
      response_time_avg_hours = EXCLUDED.response_time_avg_hours,
      completion_rate = EXCLUDED.completion_rate,
      repeat_customer_count = EXCLUDED.repeat_customer_count,
      positive_feedback_count = EXCLUDED.positive_feedback_count,
      public_appreciation_count = EXCLUDED.public_appreciation_count,
      jobs_completed = EXCLUDED.jobs_completed,
      jobs_in_progress = EXCLUDED.jobs_in_progress,
      total_unique_customers = EXCLUDED.total_unique_customers,
      has_insurance = EXCLUDED.has_insurance,
      licenses = EXCLUDED.licenses,
      certifications = EXCLUDED.certifications,
      verified_communities = EXCLUDED.verified_communities,
      platform_verified = EXCLUDED.platform_verified,
      appreciation_highlights = EXCLUDED.appreciation_highlights,
      computed_at = now(),
      computation_version = cc_trust_signals.computation_version + 1,
      last_updated = now()`,
    [
      signals.party_id,
      partyType,
      signals.model,
      signals.response_time_avg_hours,
      signals.completion_rate,
      signals.repeat_customer_count,
      signals.positive_feedback_count,
      signals.public_appreciation_count,
      signals.years_in_community,
      signals.jobs_completed,
      signals.jobs_in_progress,
      signals.total_unique_customers,
      signals.has_insurance,
      signals.licenses,
      signals.certifications,
      signals.verified_communities,
      signals.member_since,
      signals.platform_verified,
      signals.appreciation_highlights,
      signals.display_preferences
    ]
  );
}

export interface TrustDisplayInfo {
  public_signals: Record<string, any>;
  hidden_signals: string[];
  confidence_level: 'new' | 'establishing' | 'established';
  badges: string[];
}

export function formatTrustDisplay(signals: TrustSignalSummary): TrustDisplayInfo {
  const prefs = signals.display_preferences;
  const publicSignals: Record<string, any> = {};
  const hiddenSignals: string[] = [];

  if (prefs.show_completion_rate && signals.completion_rate !== null) {
    publicSignals.completion_rate = `${signals.completion_rate}%`;
  } else if (signals.completion_rate !== null) {
    hiddenSignals.push('completion_rate');
  }

  if (prefs.show_repeat_customers && signals.repeat_customer_count > 0) {
    publicSignals.repeat_customers = signals.repeat_customer_count;
    if (signals.repeat_customer_rate !== null) {
      publicSignals.repeat_rate = `${signals.repeat_customer_rate}%`;
    }
  } else if (signals.repeat_customer_count > 0) {
    hiddenSignals.push('repeat_customers');
  }

  if (prefs.show_response_time && signals.response_time_avg_hours !== null) {
    publicSignals.avg_response_time = signals.response_time_avg_hours < 24
      ? `${signals.response_time_avg_hours.toFixed(1)} hours`
      : `${(signals.response_time_avg_hours / 24).toFixed(1)} days`;
  } else if (signals.response_time_avg_hours !== null) {
    hiddenSignals.push('response_time');
  }

  if (prefs.show_credentials) {
    if (signals.has_insurance) publicSignals.insured = true;
    if (signals.licenses.length > 0) publicSignals.licenses = signals.licenses;
    if (signals.certifications.length > 0) publicSignals.certifications = signals.certifications;
  } else {
    if (signals.has_insurance) hiddenSignals.push('insurance');
    if (signals.licenses.length > 0) hiddenSignals.push('licenses');
    if (signals.certifications.length > 0) hiddenSignals.push('certifications');
  }

  if (prefs.show_years_in_community && signals.verified_communities.length > 0) {
    publicSignals.verified_in = signals.verified_communities;
  } else if (signals.verified_communities.length > 0) {
    hiddenSignals.push('cc_community_verifications');
  }

  if (prefs.show_public_appreciations && signals.public_appreciation_count > 0) {
    publicSignals.appreciations = signals.public_appreciation_count;
    if (signals.appreciation_highlights.length > 0) {
      publicSignals.known_for = signals.appreciation_highlights;
    }
  } else if (signals.public_appreciation_count > 0) {
    hiddenSignals.push('appreciations');
  }

  const dataPoints = signals.jobs_completed + signals.positive_feedback_count;
  let confidence: 'new' | 'establishing' | 'established';
  if (dataPoints < 3) {
    confidence = 'new';
  } else if (dataPoints < 10) {
    confidence = 'establishing';
  } else {
    confidence = 'established';
  }

  const badges: string[] = [];
  if (signals.platform_verified) badges.push('Platform Verified');
  if (signals.has_insurance) badges.push('Insured');
  if (signals.repeat_customer_count >= 3) badges.push('Repeat Business');
  if (signals.verified_communities.length >= 2) badges.push('Community Trusted');
  if (signals.jobs_completed >= 10) badges.push('Experienced');

  return {
    public_signals: publicSignals,
    hidden_signals: hiddenSignals,
    confidence_level: confidence,
    badges
  };
}
