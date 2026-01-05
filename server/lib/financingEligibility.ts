import { pool } from '../db';

export interface EligibilitySignals {
  owner_type: string | null;
  contractor_trust_score: number;
  has_signed_contract: boolean;
  has_verified_scope: boolean;
  has_structured_bom: boolean;
  has_payment_milestones: boolean;
  materials_total: number;
  eligible_products: string[];
  can_request_financing: boolean;
  reasons: string[];
}

export async function computeFinancingEligibility(
  opportunity_id: string,
  contractor_party_id: string
): Promise<EligibilitySignals> {
  const client = await pool.connect();
  try {
    const oppResult = await client.query(
      `SELECT o.*, 
              t.name as owner_name,
              t.business_type
       FROM opportunities o
       LEFT JOIN tenants t ON o.owner_tenant_id = t.id
       WHERE o.id = $1`,
      [opportunity_id]
    );

    if (oppResult.rows.length === 0) {
      return {
        owner_type: null,
        contractor_trust_score: 0,
        has_signed_contract: false,
        has_verified_scope: false,
        has_structured_bom: false,
        has_payment_milestones: false,
        materials_total: 0,
        eligible_products: [],
        can_request_financing: false,
        reasons: ['Opportunity not found']
      };
    }

    const opp = oppResult.rows[0];

    const trustResult = await client.query(
      `SELECT * FROM trust_signals WHERE party_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [contractor_party_id]
    );
    const trustScore = trustResult.rows[0]?.overall_score || 50;

    const contractResult = await client.query(
      `SELECT 1 FROM conversations 
       WHERE opportunity_id = $1 AND contractor_party_id = $2 
       AND state IN ('contracted', 'in_progress', 'completed') LIMIT 1`,
      [opportunity_id, contractor_party_id]
    );
    const hasSignedContract = contractResult.rows.length > 0;

    const milestoneResult = await client.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM payment_milestones pm
       JOIN payment_promises pp ON pm.payment_promise_id = pp.id
       JOIN conversations c ON pp.conversation_id = c.id
       WHERE c.opportunity_id = $1 AND c.contractor_party_id = $2`,
      [opportunity_id, contractor_party_id]
    );
    const hasMilestones = parseInt(milestoneResult.rows[0]?.count || '0') > 0;
    const milestonesTotal = parseFloat(milestoneResult.rows[0]?.total || '0');

    let ownerType = opp.owner_type;
    if (!ownerType) {
      const ownerName = (opp.owner_name || '').toLowerCase();
      if (ownerName.includes('first nation') || ownerName.includes('band') || ownerName.includes('indigenous')) {
        ownerType = 'first_nation';
      } else if (ownerName.includes('government') || ownerName.includes('ministry') || ownerName.includes('canada')) {
        ownerType = 'government';
      } else if (ownerName.includes('city of') || ownerName.includes('district') || ownerName.includes('municipality')) {
        ownerType = 'municipal';
      }
    }

    const hasVerifiedScope = (opp.description?.length > 100) && (opp.budget_ceiling > 0 || milestonesTotal > 0);

    const hasStructuredBom = hasMilestones && milestonesTotal > 25000;

    const productsResult = await client.query(
      `SELECT id, product_code, product_name, product_category, advance_percent, fee_percent, min_amount, max_amount
       FROM financing_products
       WHERE is_active = true
         AND ($1::text IS NULL OR $1 = ANY(eligible_counterparties))
         AND min_contractor_trust_score <= $2
         AND (min_amount IS NULL OR min_amount <= $3)
         AND (max_amount IS NULL OR max_amount >= $3)`,
      [ownerType, trustScore, milestonesTotal]
    );

    const eligibleProducts = productsResult.rows.map(p => p.id);

    const reasons: string[] = [];
    let canRequest = true;

    if (!ownerType || !['government', 'first_nation', 'municipal'].includes(ownerType)) {
      reasons.push('Financing currently available for government, First Nations, and municipal projects');
      canRequest = false;
    }

    if (trustScore < 50) {
      reasons.push('Contractor trust score below minimum threshold');
      canRequest = false;
    }

    if (!hasSignedContract) {
      reasons.push('Signed contract or awarded status required');
      canRequest = false;
    }

    if (!hasVerifiedScope) {
      reasons.push('Verified scope and budget required');
      canRequest = false;
    }

    if (eligibleProducts.length === 0) {
      reasons.push('No financing products currently available for this configuration');
      canRequest = false;
    }

    if (canRequest) {
      reasons.push('Eligible for financing');
    }

    return {
      owner_type: ownerType,
      contractor_trust_score: trustScore,
      has_signed_contract: hasSignedContract,
      has_verified_scope: hasVerifiedScope,
      has_structured_bom: hasStructuredBom,
      has_payment_milestones: hasMilestones,
      materials_total: milestonesTotal,
      eligible_products: eligibleProducts,
      can_request_financing: canRequest,
      reasons
    };

  } finally {
    client.release();
  }
}

export function formatFinancingSuggestion(eligibility: EligibilitySignals): {
  show_financing: boolean;
  headline: string;
  details: string;
  advance_estimate: number;
  fee_estimate: number;
} | null {
  if (!eligibility.can_request_financing || eligibility.eligible_products.length === 0) {
    return null;
  }

  const advancePercent = 70;
  const feePercent = 2.5;
  const advanceEstimate = eligibility.materials_total * (advancePercent / 100);
  const feeEstimate = advanceEstimate * (feePercent / 100);

  return {
    show_financing: true,
    headline: 'Materials Financing Available',
    details: `Advance up to ${advancePercent}% ($${advanceEstimate.toLocaleString()}) of materials cost. Estimated fee: $${feeEstimate.toLocaleString()}`,
    advance_estimate: advanceEstimate,
    fee_estimate: feeEstimate
  };
}
