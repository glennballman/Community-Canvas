/**
 * Yard Handshake Microcopy
 * 
 * Rotating phrases for photo onboarding that feel like a friendly yard conversation.
 * Polite, grounded, not over-the-top.
 * 
 * Rules:
 * - Use "sweet" only if model_year >= current_year - 3
 * - Use "killer" only if model_year >= current_year - 1 OR explicitly marked "like new"
 */

type AssetType = 'vehicle' | 'trailer' | 'equipment' | 'watercraft' | 'property' | 'spot' | string;

interface YardHandshakeOptions {
  assetType: AssetType;
  modelYear?: number;
  condition?: 'like_new' | 'good' | 'fair' | 'worn' | string;
}

const currentYear = new Date().getFullYear();

const GENERIC_PHRASES = [
  "Nice rig. Want me to help fill in the specs from this photo?",
  "Good looking {type}. Can you confirm the make and model?",
  "Solid machine. Any issues we should mark as maintenance?",
  "Clean setup. Ready to add the details?",
  "Got it. Let me pull some specs from this photo.",
  "Looking good. What's the capacity on this one?",
  "Noted. Is this available for reservation right away?",
  "Sharp looking {type}. Should we add any special requirements?",
];

const VEHICLE_PHRASES = [
  "Nice rig. Want me to help fill in the specs from this photo?",
  "Good looking truck. Is that a Kenworth?",
  "Solid machine. Any issues we should mark as maintenance?",
  "Clean setup. Is the lift gate rated for 2,000 lbs?",
  "Good looking truck. What's the GVWR on this one?",
  "Nice setup. How many axles we working with?",
  "Got it. Is this rig available for long hauls?",
];

const TRAILER_PHRASES = [
  "Nice trailer. What's the max payload?",
  "Good looking rig. Is that a flatbed or enclosed?",
  "Solid setup. Any special hitching requirements?",
  "Clean trailer. Ready to add the dimensions?",
  "Got it. Is there a lift gate on this one?",
];

const EQUIPMENT_PHRASES = [
  "Nice piece of equipment. What's the operating capacity?",
  "Solid machine. Any special training required?",
  "Good looking tool. What's the fuel type?",
  "Clean gear. Ready to set the rental rates?",
  "Got it. Any attachments that come with this?",
];

const WATERCRAFT_PHRASES = [
  "Nice boat. Does the crane still run smooth?",
  "Good looking vessel. What's the passenger capacity?",
  "Solid craft. Any special certifications needed?",
  "Clean boat. Ready to set up the reservation profile?",
  "Got it. Is there safety gear included?",
];

const NEWER_VEHICLE_PHRASES = [
  "Sweet ride. Want me to grab the specs from the photo?",
  "That's a clean setup. Looks barely broken in.",
  "Nice new rig. Ready to get this one on the roster?",
];

const LIKE_NEW_PHRASES = [
  "Killer machine. Looks fresh off the lot.",
  "That's pristine. Ready to put this beauty to work?",
];

function getPhrasePool(options: YardHandshakeOptions): string[] {
  const { assetType, modelYear, condition } = options;
  
  const isNewer = modelYear && modelYear >= currentYear - 3;
  const isVeryNew = modelYear && modelYear >= currentYear - 1;
  const isLikeNew = condition === 'like_new';
  
  let pool: string[] = [];
  
  switch (assetType) {
    case 'vehicle':
      pool = [...VEHICLE_PHRASES];
      break;
    case 'trailer':
      pool = [...TRAILER_PHRASES];
      break;
    case 'equipment':
      pool = [...EQUIPMENT_PHRASES];
      break;
    case 'watercraft':
      pool = [...WATERCRAFT_PHRASES];
      break;
    default:
      pool = [...GENERIC_PHRASES];
  }
  
  if (isNewer && (assetType === 'vehicle' || assetType === 'trailer')) {
    pool = [...pool, ...NEWER_VEHICLE_PHRASES];
  }
  
  if (isVeryNew || isLikeNew) {
    pool = [...pool, ...LIKE_NEW_PHRASES];
  }
  
  return pool;
}

function formatPhrase(phrase: string, assetType: AssetType): string {
  const typeLabels: Record<string, string> = {
    vehicle: 'truck',
    trailer: 'trailer',
    equipment: 'equipment',
    watercraft: 'boat',
    property: 'property',
    spot: 'spot',
  };
  
  const label = typeLabels[assetType] || 'item';
  return phrase.replace('{type}', label);
}

/**
 * Get a random yard handshake phrase for photo onboarding
 */
export function getYardHandshakePhrase(options: YardHandshakeOptions): string {
  const pool = getPhrasePool(options);
  const index = Math.floor(Math.random() * pool.length);
  return formatPhrase(pool[index], options.assetType);
}

/**
 * Get all available phrases for testing/preview
 */
export function getAllYardHandshakePhrases(options: YardHandshakeOptions): string[] {
  return getPhrasePool(options).map(p => formatPhrase(p, options.assetType));
}
