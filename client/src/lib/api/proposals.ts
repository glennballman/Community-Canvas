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
