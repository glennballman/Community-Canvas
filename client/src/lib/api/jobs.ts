import { apiRequest } from '../queryClient';

export interface Job {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  role_category: string;
  employment_type: string;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: string | null;
  schedule_tags: string[] | null;
  housing_provided: boolean;
  start_date: string | null;
  end_date: string | null;
  season_window: string | null;
  qualifications_tags: string[] | null;
  responsibilities: string | null;
  requirements: string | null;
  nice_to_have: string | null;
  hours_per_week: number | null;
  shift_details: string | null;
  is_flexible_dates: boolean;
  external_apply_url: string | null;
  status: string;
  brand_name_snapshot: string | null;
  legal_name_snapshot: string | null;
  legal_entity_id: string | null;
  noc_code: string | null;
  soc_code: string | null;
  created_at: string;
  updated_at: string;
  total_applications?: number;
  active_postings?: number;
}

export interface JobsListResponse {
  ok: boolean;
  jobs: Job[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface JobDetailResponse {
  ok: boolean;
  job: Job & {
    postings: any[] | null;
  };
}

export interface PortalDistributionPolicy {
  portal_id: string;
  portal_name: string;
  portal_slug: string;
  is_accepting_job_postings: boolean;
  requires_moderation: boolean;
  pricing_model: string;
  price_cents: number | null;
  currency: string;
  billing_unit: string;
  requires_checkout: boolean;
  default_selected: boolean;
}

export interface Destination {
  destinationType: 'portal' | 'embed' | 'external';
  id: string;
  name: string;
  slug?: string;
  defaultSelected: boolean;
  pricing: {
    pricingModel: string;
    priceCents: number | null;
    currency: string;
    billingUnit: string | null;
    requiresCheckout: boolean;
  };
  moderation: {
    requiresModeration: boolean;
  };
  state: {
    publishState: string;
    publishedAt: string | null;
  } | null;
  paymentIntent?: {
    intentId: string;
    status: string;
    amountCents: number;
  } | null;
}

export interface DestinationsResponse {
  ok: boolean;
  jobId: string;
  destinations: Destination[];
}

export interface PublishResponse {
  ok: boolean;
  jobId: string;
  publishedDestinations: any[];
  paymentRequiredDestinations?: any[];
}

export interface PaidPublicationIntent {
  intent_id: string;
  job_id: string;
  portal_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  job_title: string;
  brand_name_snapshot: string | null;
  tenant_name: string | null;
}

export interface PendingIntentsResponse {
  ok: boolean;
  intents: PaidPublicationIntent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export async function createJob(data: Partial<Job>): Promise<{ ok: boolean; job: Job }> {
  const res = await apiRequest('POST', '/api/p2/app/jobs', data);
  return res.json();
}

export async function updateJob(id: string, data: Partial<Job>): Promise<{ ok: boolean; job: Job }> {
  const res = await apiRequest('PATCH', `/api/p2/app/jobs/${id}`, data);
  return res.json();
}

export async function publishJob(
  id: string, 
  portalIds: string[], 
  embedSurfaceIds: string[] = []
): Promise<PublishResponse> {
  const res = await apiRequest('POST', `/api/p2/app/jobs/${id}/publish`, {
    portalIds,
    embedSurfaceIds
  });
  return res.json();
}

export async function markIntentPaid(
  intentId: string,
  pspProvider?: string,
  pspReference?: string
): Promise<{ ok: boolean; intentId: string; jobId: string; portalId: string }> {
  const res = await apiRequest('POST', `/api/p2/app/mod/paid-publications/${intentId}/mark-paid`, {
    pspProvider,
    pspReference
  });
  return res.json();
}

export const roleCategories = [
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'cook', label: 'Cook / Kitchen' },
  { value: 'server', label: 'Server / Waitstaff' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'marina', label: 'Marina' },
  { value: 'dock_attendant', label: 'Dock Attendant' },
  { value: 'driver', label: 'Driver' },
  { value: 'guide', label: 'Guide / Tour' },
  { value: 'retail', label: 'Retail' },
  { value: 'general_labour', label: 'General Labour' },
  { value: 'skilled_trade', label: 'Skilled Trade' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'management', label: 'Management' },
  { value: 'security', label: 'Security' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'other', label: 'Other' },
];

export const employmentTypes = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'internship', label: 'Internship' },
];

export const payUnits = [
  { value: 'hourly', label: 'Per Hour' },
  { value: 'daily', label: 'Per Day' },
  { value: 'weekly', label: 'Per Week' },
  { value: 'monthly', label: 'Per Month' },
  { value: 'annually', label: 'Per Year' },
  { value: 'fixed', label: 'Fixed Amount' },
];
