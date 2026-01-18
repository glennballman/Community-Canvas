/**
 * Entry Point Type Resolution
 * 
 * Determines the reservation type based on offer metadata.
 */

export type EntryPointType = 
  | "lodging" 
  | "parking" 
  | "marina" 
  | "activity" 
  | "equipment";

export interface OfferMetadata {
  id?: string;
  offer_type?: string;
  type?: string;
  slug?: string;
  name?: string;
}

/**
 * Derive the entry point type from offer metadata.
 * Prefer explicit offer.type if present; otherwise use slug heuristics.
 */
export function deriveEntryPointType(offer: OfferMetadata | null | undefined): EntryPointType {
  if (!offer) return "equipment";
  
  // Check explicit type first
  const typeStr = String(offer.offer_type || offer.type || "").toLowerCase();
  
  if (typeStr.includes("lodging") || typeStr.includes("room") || typeStr.includes("stay") || typeStr.includes("cabin")) {
    return "lodging";
  }
  if (typeStr.includes("parking") || typeStr.includes("stall")) {
    return "parking";
  }
  if (typeStr.includes("marina") || typeStr.includes("slip") || typeStr.includes("mooring")) {
    return "marina";
  }
  if (typeStr.includes("activity") || typeStr.includes("tour") || typeStr.includes("experience")) {
    return "activity";
  }
  if (typeStr.includes("equipment") || typeStr.includes("rental")) {
    return "equipment";
  }
  
  // Fallback: check slug
  const slugStr = String(offer.slug || "").toLowerCase();
  
  if (slugStr.includes("lodging") || slugStr.includes("cabin") || slugStr.includes("room")) {
    return "lodging";
  }
  if (slugStr.includes("parking")) {
    return "parking";
  }
  if (slugStr.includes("marina") || slugStr.includes("slip")) {
    return "marina";
  }
  if (slugStr.includes("activity") || slugStr.includes("tour")) {
    return "activity";
  }
  
  return "equipment";
}

/**
 * Get display label for entry point type
 */
export function getEntryPointLabel(type: EntryPointType): string {
  const labels: Record<EntryPointType, string> = {
    lodging: "Lodging",
    parking: "Parking",
    marina: "Marina",
    activity: "Activity",
    equipment: "Equipment",
  };
  return labels[type];
}

/**
 * Get input fields required for each type
 */
export interface InputFieldConfig {
  hasDateRange: boolean;
  hasTimeRange: boolean;
  hasGuests: boolean;
  hasQuantity: boolean;
  hasVehicleLength: boolean;
  hasVesselLength: boolean;
  hasPower: boolean;
}

export function getInputFieldConfig(type: EntryPointType): InputFieldConfig {
  const configs: Record<EntryPointType, InputFieldConfig> = {
    lodging: {
      hasDateRange: true,
      hasTimeRange: false,
      hasGuests: true,
      hasQuantity: false,
      hasVehicleLength: false,
      hasVesselLength: false,
      hasPower: false,
    },
    parking: {
      hasDateRange: true,
      hasTimeRange: false,
      hasGuests: false,
      hasQuantity: false,
      hasVehicleLength: true,
      hasVesselLength: false,
      hasPower: false,
    },
    marina: {
      hasDateRange: true,
      hasTimeRange: false,
      hasGuests: false,
      hasQuantity: false,
      hasVehicleLength: false,
      hasVesselLength: true,
      hasPower: true,
    },
    activity: {
      hasDateRange: false,
      hasTimeRange: false,
      hasGuests: false,
      hasQuantity: true,
      hasVehicleLength: false,
      hasVesselLength: false,
      hasPower: false,
    },
    equipment: {
      hasDateRange: true,
      hasTimeRange: false,
      hasGuests: false,
      hasQuantity: true,
      hasVehicleLength: false,
      hasVesselLength: false,
      hasPower: false,
    },
  };
  return configs[type];
}
