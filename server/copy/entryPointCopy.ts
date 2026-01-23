/**
 * V3.5 Universal Copy-Token Layer (Server-side)
 * 
 * Mirrors client/src/copy/entryPointCopy.ts for server-side notification generation.
 * Keep these in sync!
 */

export type EntryPointType = 
  | 'lodging'
  | 'parking'
  | 'marina'
  | 'restaurant'
  | 'equipment'
  | 'service'
  | 'activity'
  | 'generic';

export type CopyContext = {
  entryPoint: EntryPointType;
  surfaceKind?: string;
  portalTone?: 'community' | 'company';
  actorRole?: 'requester' | 'provider' | 'operator';
};

export const ENTRY_POINT_COPY: Record<EntryPointType, Record<string, string>> = {
  generic: {
    'label.noun.provider': 'provider',
    'label.noun.requester': 'requester',
    'label.noun.request': 'request',
    'label.noun.run': 'service run',
    'label.noun.community': 'community',
    'label.noun.company': 'organization',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to respond',
    'msg.invite.sent.body': 'You have received an invitation to submit a proposal for {requestTitle}.',
    'msg.request.accepted.subject': 'Your proposal was accepted',
    'msg.request.accepted.body': 'Great news! Your proposal for {requestTitle} has been accepted.',
    'msg.proposal.created.subject': 'New proposal received',
    'msg.proposal.created.body': 'A provider has submitted a proposal for {requestTitle}.',
    'msg.request.declined.subject': 'Proposal declined',
    'msg.request.declined.body': 'The proposal for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Request is now unassigned',
    'msg.request.unassigned.body': 'The request {requestTitle} is now open for new proposals.',
  },
  lodging: {
    'label.noun.provider': 'host',
    'label.noun.requester': 'guest',
    'label.noun.request': 'reservation request',
    'label.noun.run': 'stay',
    'label.noun.community': 'community',
    'label.noun.company': 'property',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to host',
    'msg.invite.sent.body': 'You have received an invitation to offer accommodation for {requestTitle}.',
    'msg.request.accepted.subject': 'Your accommodation was accepted',
    'msg.request.accepted.body': 'Great news! The guest has confirmed the reservation for {requestTitle}.',
    'msg.proposal.created.subject': 'New accommodation offer',
    'msg.proposal.created.body': 'A host has submitted an offer for {requestTitle}.',
    'msg.request.declined.subject': 'Offer declined',
    'msg.request.declined.body': 'The accommodation offer for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Reservation request reopened',
    'msg.request.unassigned.body': 'The reservation request {requestTitle} is now open for new offers.',
  },
  parking: {
    'label.noun.provider': 'lot operator',
    'label.noun.requester': 'driver',
    'label.noun.request': 'capacity request',
    'label.noun.run': 'parking session',
    'label.noun.community': 'community',
    'label.noun.company': 'parking facility',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to provide parking',
    'msg.invite.sent.body': 'You have received an invitation to offer parking for {requestTitle}.',
    'msg.request.accepted.subject': 'Your parking offer was accepted',
    'msg.request.accepted.body': 'Great news! The driver has confirmed parking for {requestTitle}.',
    'msg.proposal.created.subject': 'New parking offer',
    'msg.proposal.created.body': 'A lot operator has submitted an offer for {requestTitle}.',
    'msg.request.declined.subject': 'Parking offer declined',
    'msg.request.declined.body': 'The parking offer for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Parking request reopened',
    'msg.request.unassigned.body': 'The parking request {requestTitle} is now open for new offers.',
  },
  marina: {
    'label.noun.provider': 'marina',
    'label.noun.requester': 'boater',
    'label.noun.request': 'moorage request',
    'label.noun.run': 'moorage',
    'label.noun.community': 'marina community',
    'label.noun.company': 'marina',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to provide moorage',
    'msg.invite.sent.body': 'You have received an invitation to offer moorage for {requestTitle}.',
    'msg.request.accepted.subject': 'Your moorage offer was accepted',
    'msg.request.accepted.body': 'Great news! The boater has confirmed moorage for {requestTitle}.',
    'msg.proposal.created.subject': 'New moorage offer',
    'msg.proposal.created.body': 'A marina has submitted a moorage offer for {requestTitle}.',
    'msg.request.declined.subject': 'Moorage offer declined',
    'msg.request.declined.body': 'The moorage offer for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Moorage request reopened',
    'msg.request.unassigned.body': 'The moorage request {requestTitle} is now open for new offers.',
  },
  restaurant: {
    'label.noun.provider': 'restaurant',
    'label.noun.requester': 'guest',
    'label.noun.request': 'reservation request',
    'label.noun.run': 'dining experience',
    'label.noun.community': 'dining community',
    'label.noun.company': 'restaurant',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to host a dining reservation',
    'msg.invite.sent.body': 'You have received an invitation to offer dining for {requestTitle}.',
    'msg.request.accepted.subject': 'Your dining reservation was confirmed',
    'msg.request.accepted.body': 'Great news! The guest has confirmed the reservation for {requestTitle}.',
    'msg.proposal.created.subject': 'New dining offer',
    'msg.proposal.created.body': 'A restaurant has submitted an offer for {requestTitle}.',
    'msg.request.declined.subject': 'Dining offer declined',
    'msg.request.declined.body': 'The dining offer for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Dining request reopened',
    'msg.request.unassigned.body': 'The dining request {requestTitle} is now open for new offers.',
  },
  equipment: {
    'label.noun.provider': 'rental provider',
    'label.noun.requester': 'renter',
    'label.noun.request': 'rental request',
    'label.noun.run': 'rental period',
    'label.noun.community': 'community',
    'label.noun.company': 'rental company',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to provide equipment',
    'msg.invite.sent.body': 'You have received an invitation to offer equipment for {requestTitle}.',
    'msg.request.accepted.subject': 'Your rental offer was accepted',
    'msg.request.accepted.body': 'Great news! The renter has confirmed the rental for {requestTitle}.',
    'msg.proposal.created.subject': 'New rental offer',
    'msg.proposal.created.body': 'A rental provider has submitted an offer for {requestTitle}.',
    'msg.request.declined.subject': 'Rental offer declined',
    'msg.request.declined.body': 'The rental offer for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Rental request reopened',
    'msg.request.unassigned.body': 'The rental request {requestTitle} is now open for new offers.',
  },
  service: {
    'label.noun.provider': 'service provider',
    'label.noun.requester': 'client',
    'label.noun.request': 'service request',
    'label.noun.run': 'service run',
    'label.noun.community': 'community',
    'label.noun.company': 'service company',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to provide service',
    'msg.invite.sent.body': 'You have received an invitation to submit a proposal for {requestTitle}.',
    'msg.request.accepted.subject': 'Your proposal was accepted',
    'msg.request.accepted.body': 'Great news! Your proposal for {requestTitle} has been accepted.',
    'msg.proposal.created.subject': 'New service proposal received',
    'msg.proposal.created.body': 'A provider has submitted a proposal for {requestTitle}.',
    'msg.request.declined.subject': 'Proposal declined',
    'msg.request.declined.body': 'The proposal for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Service request is now unassigned',
    'msg.request.unassigned.body': 'The service request {requestTitle} is now open for new proposals.',
  },
  activity: {
    'label.noun.provider': 'operator',
    'label.noun.requester': 'participant',
    'label.noun.request': 'activity request',
    'label.noun.run': 'activity session',
    'label.noun.community': 'community',
    'label.noun.company': 'activity operator',
    'label.noun.reservation': 'reservation',
    'msg.invite.sent.subject': 'You have been invited to provide an activity',
    'msg.invite.sent.body': 'You have received an invitation to offer an activity for {requestTitle}.',
    'msg.request.accepted.subject': 'Your activity offer was accepted',
    'msg.request.accepted.body': 'Great news! The participant has confirmed the activity for {requestTitle}.',
    'msg.proposal.created.subject': 'New activity offer',
    'msg.proposal.created.body': 'An operator has submitted an activity offer for {requestTitle}.',
    'msg.request.declined.subject': 'Activity offer declined',
    'msg.request.declined.body': 'The activity offer for {requestTitle} was not accepted.',
    'msg.request.unassigned.subject': 'Activity request reopened',
    'msg.request.unassigned.body': 'The activity request {requestTitle} is now open for new offers.',
  },
};

/**
 * Safe mapping of string to EntryPointType with fallback to 'generic'
 */
export function ep(entryPoint?: string | null): EntryPointType {
  if (!entryPoint) return 'generic';
  
  const normalized = entryPoint.toLowerCase().trim();
  
  const validTypes: EntryPointType[] = [
    'lodging', 'parking', 'marina', 'restaurant', 
    'equipment', 'service', 'activity', 'generic'
  ];
  
  if (validTypes.includes(normalized as EntryPointType)) {
    return normalized as EntryPointType;
  }
  
  return 'generic';
}

/**
 * Resolve copy token with variable interpolation
 */
export function resolveCopy(
  key: string,
  ctx: CopyContext,
  vars?: Record<string, string | number>
): string {
  const entryPointCopy = ENTRY_POINT_COPY[ctx.entryPoint];
  const genericCopy = ENTRY_POINT_COPY.generic;
  
  let value = entryPointCopy?.[key] ?? genericCopy?.[key];
  
  if (!value) {
    return `[[${key}]]`;
  }
  
  if (vars) {
    for (const [varName, varValue] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${varName}\\}`, 'g'), String(varValue));
    }
  }
  
  return value;
}

/**
 * Create a CopyContext
 */
export function createContext(
  entryPoint?: string | null,
  options?: Partial<Omit<CopyContext, 'entryPoint'>>
): CopyContext {
  return {
    entryPoint: ep(entryPoint),
    ...options,
  };
}

/**
 * Get message templates for notifications
 */
export function getMessageTemplates(ctx: CopyContext, vars?: Record<string, string | number>) {
  return {
    inviteSent: {
      subject: resolveCopy('msg.invite.sent.subject', ctx, vars),
      body: resolveCopy('msg.invite.sent.body', ctx, vars),
    },
    requestAccepted: {
      subject: resolveCopy('msg.request.accepted.subject', ctx, vars),
      body: resolveCopy('msg.request.accepted.body', ctx, vars),
    },
    proposalCreated: {
      subject: resolveCopy('msg.proposal.created.subject', ctx, vars),
      body: resolveCopy('msg.proposal.created.body', ctx, vars),
    },
    requestDeclined: {
      subject: resolveCopy('msg.request.declined.subject', ctx, vars),
      body: resolveCopy('msg.request.declined.body', ctx, vars),
    },
    requestUnassigned: {
      subject: resolveCopy('msg.request.unassigned.subject', ctx, vars),
      body: resolveCopy('msg.request.unassigned.body', ctx, vars),
    },
  };
}
