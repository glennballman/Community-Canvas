import { p2Err } from "../p2Envelope";

export function requirePortalId(q: any): string {
  const portalId = String(q?.portalId || "").trim();
  if (!portalId) throw Object.assign(p2Err("BAD_REQUEST", "portalId is required"), { __http: 400 });
  return portalId;
}

export function parseIsoDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function assertOfferDisclosedToPortal(args: {
  portalId: string;
  offerTenantId: string;
  facilityId: string | null;
}) {
  // TODO: Wire to existing disclosure check if available
  return;
}
