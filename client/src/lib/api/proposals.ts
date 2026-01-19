import { apiRequest } from '../queryClient';

export interface ProposalParticipant {
  id: string;
  display_name: string;
  role: string;
  folio: {
    folio_id: string;
    folio_number: string;
    status: string;
    summary: {
      folioId: string;
      participantName: string;
      totalCharges: number;
      totalReversals: number;
      netBalance: number;
      entryCount: number;
    } | null;
  } | null;
}

export interface ProposalAllocation {
  participant_id: string;
  display_name: string;
  role: string;
  claims: Array<{
    claim_id: string;
    units: Array<{
      unit_id: string;
      unit_type: string;
      unit_label: string | null;
    }>;
    container_path: string[];
    time_start: string;
    time_end: string;
    claim_status: string;
  }>;
}

export interface ProposalIncident {
  id: string;
  incident_type: string;
  affected_participant_id: string;
  notes: string;
  created_at: string;
}

export interface Proposal {
  id: string;
  title: string;
  status: string;
  time_start: string;
  time_end: string;
  portal_id: string;
  tenant_id: string;
  group_size: number;
  created_at: string;
}

export interface ProposalResponse {
  ok: boolean;
  error?: string;
  proposal: Proposal;
  participants: ProposalParticipant[];
  allocations: ProposalAllocation[];
  unassigned_units?: Array<{
    claim_id: string;
    units: Array<{
      unit_id: string;
      unit_type: string;
      unit_label: string | null;
    }>;
    container_path: string[];
    time_start: string;
    time_end: string;
    claim_status: string;
  }>;
  incidents?: ProposalIncident[];
  n3_advisories?: any[];
}

export interface InvitePayload {
  contact: {
    email?: string;
    phone?: string;
    display_name?: string;
  };
  role: 'party_member' | 'co_planner' | 'kid_planner' | 'handoff_recipient' | 'partner_invite';
  note?: string;
}

export interface InviteResponse {
  ok: boolean;
  error?: string;
  invitation?: {
    id: string;
    token: string;
    role: string;
    view_url: string;
  };
}

export interface AssignUnitsPayload {
  participant_id: string;
  unit_ids: string[];
  time_start?: string;
  time_end?: string;
}

export interface AssignUnitsResponse {
  ok: boolean;
  error?: string;
  claim?: {
    id: string;
    participant_id: string;
    unit_ids: string[];
    status: string;
  };
}

export async function getProposal(proposalId: string): Promise<ProposalResponse> {
  const res = await fetch(`/api/p2/app/proposals/${proposalId}`);
  return res.json();
}

export async function inviteProposalMember(
  proposalId: string,
  payload: InvitePayload
): Promise<InviteResponse> {
  const res = await apiRequest('POST', `/api/p2/app/proposals/${proposalId}/invite`, payload);
  return res.json();
}

export async function assignUnits(
  proposalId: string,
  payload: AssignUnitsPayload
): Promise<AssignUnitsResponse> {
  const res = await apiRequest('POST', `/api/p2/app/proposals/${proposalId}/assign`, payload);
  return res.json();
}

// P-UI-10: Availability → Proposal Handoff

export interface CartSelection {
  container_id: string;
  unit_type: string;
  requested_units: number;
  time_start?: string;
  time_end?: string;
}

export interface FromCartPayload {
  portal_id: string;
  time_start: string;
  time_end: string;
  selections: CartSelection[];
}

export interface FromCartResponse {
  ok: boolean;
  error?: string;
  proposalId?: string;
  holdToken?: string;
  viewUrl?: string;
  claims?: Array<{ claimId: string; unitIds: string[]; containerId: string }>;
  folio_id?: string;
}

export async function createProposalFromCart(payload: FromCartPayload): Promise<FromCartResponse> {
  const res = await apiRequest('POST', '/api/p2/app/proposals/from-cart', payload);
  return res.json();
}

export interface ReleasePayload {
  holdToken: string;
}

export interface ReleaseResponse {
  ok: boolean;
  error?: string;
  released_claims?: number;
  proposal_status?: string;
}

export async function releaseProposal(proposalId: string, payload: ReleasePayload): Promise<ReleaseResponse> {
  const res = await apiRequest('POST', `/api/p2/app/proposals/${proposalId}/release`, payload);
  return res.json();
}

export interface ConfirmPayload {
  holdToken: string;
  contact: {
    email?: string;
    phone?: string;
  };
  primary_name: string;
}

export interface ConfirmResponse {
  ok: boolean;
  error?: string;
  confirmed_claims?: number;
  proposal_status?: string;
  view_url?: string;
}

export async function confirmProposal(proposalId: string, payload: ConfirmPayload): Promise<ConfirmResponse> {
  const res = await apiRequest('POST', `/api/p2/app/proposals/${proposalId}/confirm`, payload);
  return res.json();
}

export interface HandoffPayload {
  email: string;
  note?: string;
}

export interface HandoffResponse {
  ok: boolean;
  error?: string;
  invitation_id?: string;
  handoffUrl?: string;
  token?: string;
  recipient_email?: string;
}

export async function forwardToApprover(proposalId: string, payload: HandoffPayload): Promise<HandoffResponse> {
  const res = await apiRequest('POST', `/api/p2/app/proposals/${proposalId}/handoff`, payload);
  return res.json();
}

export interface RiskAdvisory {
  reason: string;
  mitigation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RiskResponse {
  ok: boolean;
  error?: string;
  riskScore: number;
  advisories: RiskAdvisory[];
  evaluatedRuns: number;
}

export async function getProposalRisk(proposalId: string): Promise<RiskResponse> {
  const res = await fetch(`/api/p2/app/proposals/${proposalId}/risk`);
  return res.json();
}
