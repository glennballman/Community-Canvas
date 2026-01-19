import { apiRequest } from '../queryClient';

export interface FolioPayPayload {
  amount_cents: number;
  payment_method?: string;
  reference?: string;
}

export interface FolioPayResponse {
  ok: boolean;
  error?: string;
  ledger_entry?: {
    id: string;
    folio_id: string;
    category: string;
    amount_cents: number;
    description: string;
  };
  new_balance?: number;
}

export interface FolioCreditPayload {
  amount_cents: number;
  incident_id: string;
  incident_type: 'illness_refund' | 'staff_damage' | 'goodwill_refund' | 'injury' | 'other';
  notes?: string;
  original_ledger_entry_id?: string;
}

export interface FolioCreditResponse {
  ok: boolean;
  error?: string;
  reversal?: {
    id: string;
    folio_id: string;
    amount_cents: number;
    incident_id: string;
  };
  new_balance?: number;
}

export async function payFolio(
  folioId: string,
  payload: FolioPayPayload
): Promise<FolioPayResponse> {
  const res = await apiRequest('POST', `/api/p2/app/folios/${folioId}/pay`, payload);
  return res.json();
}

export async function creditFolio(
  folioId: string,
  payload: FolioCreditPayload
): Promise<FolioCreditResponse> {
  const res = await apiRequest('POST', `/api/p2/app/folios/${folioId}/credit`, payload);
  return res.json();
}
