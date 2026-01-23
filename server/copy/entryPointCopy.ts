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

/**
 * Required token keys that every entry point must define
 * Kept in sync with client/src/copy/entryPointCopy.ts
 */
export const REQUIRED_TOKEN_KEYS = [
  'label.noun.provider',
  'label.noun.requester',
  'label.noun.request',
  'label.noun.run',
  'label.noun.community',
  'label.noun.company',
  'label.noun.reservation',
  'state.market.TARGETED.label',
  'state.market.OPEN.label',
  'state.market.INVITE_ONLY.label',
  'state.visibility.PRIVATE.label',
  'state.request.UNASSIGNED.label',
  'ui.market.locked_notice',
  'ui.publish.ask_requester.title',
  'ui.publish.ask_requester.body',
  'ui.publish.just_publish.notice',
  'ui.ai.suggestion.route_zones.title',
  'ui.ai.suggestion.route_zones.body',
  'msg.invite.sent.subject',
  'msg.invite.sent.body',
  'msg.request.accepted.subject',
  'msg.request.accepted.body',
  'msg.proposal.created.subject',
  'msg.proposal.created.body',
  'msg.request.declined.subject',
  'msg.request.declined.body',
  'msg.request.unassigned.subject',
  'msg.request.unassigned.body',
  'cta.proposal.review',
  'cta.request.open_to_bids',
  'cta.request.invite_another_provider',
] as const;

export type CopyTokenKey = typeof REQUIRED_TOKEN_KEYS[number];

export const ENTRY_POINT_COPY: Record<EntryPointType, Record<string, string>> = {
  generic: {
    'label.noun.provider': 'provider',
    'label.noun.requester': 'requester',
    'label.noun.request': 'request',
    'label.noun.run': 'service run',
    'label.noun.community': 'community',
    'label.noun.company': 'organization',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Provider selected — not open for responses',
    'ui.publish.ask_requester.title': 'Submit for approval',
    'ui.publish.ask_requester.body': 'Your proposal will be sent to the requester for review.',
    'ui.publish.just_publish.notice': 'This will be published immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested zones',
    'ui.ai.suggestion.route_zones.body': 'Based on your service area, these zones may be relevant.',
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
    'cta.proposal.review': 'Review Proposal',
    'cta.request.open_to_bids': 'Open for Responses',
    'cta.request.invite_another_provider': 'Invite Another Provider',
  },

  lodging: {
    'label.noun.provider': 'host',
    'label.noun.requester': 'guest',
    'label.noun.request': 'reservation request',
    'label.noun.run': 'stay',
    'label.noun.community': 'community',
    'label.noun.company': 'property',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Host selected — not open for responses',
    'ui.publish.ask_requester.title': 'Send to guest for approval',
    'ui.publish.ask_requester.body': 'Your offer will be sent to the guest for confirmation.',
    'ui.publish.just_publish.notice': 'This reservation will be confirmed immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested areas',
    'ui.ai.suggestion.route_zones.body': 'Based on guest preferences, these areas may be suitable.',
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
    'cta.proposal.review': 'Review Offer',
    'cta.request.open_to_bids': 'Open for Offers',
    'cta.request.invite_another_provider': 'Invite Another Host',
  },

  parking: {
    'label.noun.provider': 'lot operator',
    'label.noun.requester': 'driver',
    'label.noun.request': 'capacity request',
    'label.noun.run': 'parking session',
    'label.noun.community': 'community',
    'label.noun.company': 'parking facility',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Lot operator selected — not open for responses',
    'ui.publish.ask_requester.title': 'Send to driver for confirmation',
    'ui.publish.ask_requester.body': 'Your offer will be sent to the driver for confirmation.',
    'ui.publish.just_publish.notice': 'This reservation will be confirmed immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested parking areas',
    'ui.ai.suggestion.route_zones.body': 'Based on capacity needs, these parking areas may be suitable.',
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
    'cta.proposal.review': 'Review Offer',
    'cta.request.open_to_bids': 'Open for Offers',
    'cta.request.invite_another_provider': 'Invite Another Operator',
  },

  marina: {
    'label.noun.provider': 'marina',
    'label.noun.requester': 'boater',
    'label.noun.request': 'moorage request',
    'label.noun.run': 'moorage',
    'label.noun.community': 'marina community',
    'label.noun.company': 'marina',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Marina selected — not open for responses',
    'ui.publish.ask_requester.title': 'Send to boater for confirmation',
    'ui.publish.ask_requester.body': 'Your moorage offer will be sent to the boater for confirmation.',
    'ui.publish.just_publish.notice': 'This moorage reservation will be confirmed immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested moorage areas',
    'ui.ai.suggestion.route_zones.body': 'Based on vessel size and needs, these slips may be suitable.',
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
    'cta.proposal.review': 'Review Offer',
    'cta.request.open_to_bids': 'Open for Offers',
    'cta.request.invite_another_provider': 'Invite Another Marina',
  },

  restaurant: {
    'label.noun.provider': 'restaurant',
    'label.noun.requester': 'guest',
    'label.noun.request': 'reservation request',
    'label.noun.run': 'dining experience',
    'label.noun.community': 'dining community',
    'label.noun.company': 'restaurant',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Restaurant selected — not open for responses',
    'ui.publish.ask_requester.title': 'Send to guest for confirmation',
    'ui.publish.ask_requester.body': 'Your offer will be sent to the guest for confirmation.',
    'ui.publish.just_publish.notice': 'This reservation will be confirmed immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested dining options',
    'ui.ai.suggestion.route_zones.body': 'Based on guest preferences, these restaurants may be suitable.',
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
    'cta.proposal.review': 'Review Offer',
    'cta.request.open_to_bids': 'Open for Offers',
    'cta.request.invite_another_provider': 'Invite Another Restaurant',
  },

  equipment: {
    'label.noun.provider': 'rental provider',
    'label.noun.requester': 'renter',
    'label.noun.request': 'rental request',
    'label.noun.run': 'rental period',
    'label.noun.community': 'community',
    'label.noun.company': 'rental company',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Rental provider selected — not open for responses',
    'ui.publish.ask_requester.title': 'Send to renter for confirmation',
    'ui.publish.ask_requester.body': 'Your rental offer will be sent to the renter for confirmation.',
    'ui.publish.just_publish.notice': 'This rental reservation will be confirmed immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested rental options',
    'ui.ai.suggestion.route_zones.body': 'Based on equipment needs, these providers may be suitable.',
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
    'cta.proposal.review': 'Review Offer',
    'cta.request.open_to_bids': 'Open for Offers',
    'cta.request.invite_another_provider': 'Invite Another Provider',
  },

  service: {
    'label.noun.provider': 'service provider',
    'label.noun.requester': 'client',
    'label.noun.request': 'service request',
    'label.noun.run': 'service run',
    'label.noun.community': 'community',
    'label.noun.company': 'service company',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Provider selected — not open for responses',
    'ui.publish.ask_requester.title': 'Submit for approval',
    'ui.publish.ask_requester.body': 'Your proposal will be sent to the client for review.',
    'ui.publish.just_publish.notice': 'This will be scheduled immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested service areas',
    'ui.ai.suggestion.route_zones.body': 'Based on your service area, these zones may be relevant.',
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
    'cta.proposal.review': 'Review Proposal',
    'cta.request.open_to_bids': 'Open for Proposals',
    'cta.request.invite_another_provider': 'Invite Another Provider',
  },

  activity: {
    'label.noun.provider': 'operator',
    'label.noun.requester': 'participant',
    'label.noun.request': 'activity request',
    'label.noun.run': 'activity session',
    'label.noun.community': 'community',
    'label.noun.company': 'activity operator',
    'label.noun.reservation': 'reservation',
    'state.market.TARGETED.label': 'Targeted',
    'state.market.OPEN.label': 'Open',
    'state.market.INVITE_ONLY.label': 'Invite Only',
    'state.visibility.PRIVATE.label': 'Private',
    'state.request.UNASSIGNED.label': 'Unassigned',
    'ui.market.locked_notice': 'Operator selected — not open for responses',
    'ui.publish.ask_requester.title': 'Send to participant for confirmation',
    'ui.publish.ask_requester.body': 'Your activity offer will be sent to the participant for confirmation.',
    'ui.publish.just_publish.notice': 'This activity reservation will be confirmed immediately.',
    'ui.ai.suggestion.route_zones.title': 'Suggested activities',
    'ui.ai.suggestion.route_zones.body': 'Based on participant preferences, these activities may be suitable.',
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
    'cta.proposal.review': 'Review Offer',
    'cta.request.open_to_bids': 'Open for Offers',
    'cta.request.invite_another_provider': 'Invite Another Operator',
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

/**
 * Get nouns for UI display
 */
export function getNouns(ctx: CopyContext) {
  return {
    provider: resolveCopy('label.noun.provider', ctx),
    requester: resolveCopy('label.noun.requester', ctx),
    request: resolveCopy('label.noun.request', ctx),
    run: resolveCopy('label.noun.run', ctx),
    community: resolveCopy('label.noun.community', ctx),
    company: resolveCopy('label.noun.company', ctx),
    reservation: resolveCopy('label.noun.reservation', ctx),
  };
}

/**
 * Get state labels
 */
export function getStateLabels(ctx: CopyContext) {
  return {
    marketTargeted: resolveCopy('state.market.TARGETED.label', ctx),
    marketOpen: resolveCopy('state.market.OPEN.label', ctx),
    marketInviteOnly: resolveCopy('state.market.INVITE_ONLY.label', ctx),
    visibilityPrivate: resolveCopy('state.visibility.PRIVATE.label', ctx),
    requestUnassigned: resolveCopy('state.request.UNASSIGNED.label', ctx),
  };
}

/**
 * Get UI notices
 */
export function getUINotices(ctx: CopyContext, vars?: Record<string, string | number>) {
  return {
    marketLocked: resolveCopy('ui.market.locked_notice', ctx, vars),
    publishAskRequesterTitle: resolveCopy('ui.publish.ask_requester.title', ctx, vars),
    publishAskRequesterBody: resolveCopy('ui.publish.ask_requester.body', ctx, vars),
    publishJustPublishNotice: resolveCopy('ui.publish.just_publish.notice', ctx, vars),
    aiSuggestionRouteZonesTitle: resolveCopy('ui.ai.suggestion.route_zones.title', ctx, vars),
    aiSuggestionRouteZonesBody: resolveCopy('ui.ai.suggestion.route_zones.body', ctx, vars),
  };
}

/**
 * Get CTAs
 */
export function getCTAs(ctx: CopyContext) {
  return {
    proposalReview: resolveCopy('cta.proposal.review', ctx),
    requestOpenToBids: resolveCopy('cta.request.open_to_bids', ctx),
    requestInviteAnotherProvider: resolveCopy('cta.request.invite_another_provider', ctx),
  };
}
