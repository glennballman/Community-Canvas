/**
 * Reservation Semantics Layer
 * 
 * Human-friendly labels for reservation start/end times based on asset reservation_mode.
 * The system stores start_date/end_date in 15-minute TIMESTAMPTZ,
 * but humans think in Arriving/Departing, Check-in/Check-out, etc.
 */

export type ReservationMode = 'check_in_out' | 'arrive_depart' | 'pickup_return' | 'start_end';

export interface ReservationLabels {
  startLabel: string;
  endLabel: string;
  durationLabel: string;
}

/**
 * Get semantic labels for start/end times based on reservation_mode
 */
export function getReservationLabels(reservationMode: ReservationMode | string | null | undefined): ReservationLabels {
  switch (reservationMode) {
    case 'check_in_out':
      return {
        startLabel: 'Checking in',
        endLabel: 'Checking out',
        durationLabel: 'Nights',
      };
    case 'arrive_depart':
      return {
        startLabel: 'Arriving',
        endLabel: 'Departing',
        durationLabel: 'Duration',
      };
    case 'pickup_return':
      return {
        startLabel: 'Pickup',
        endLabel: 'Return',
        durationLabel: 'Rental period',
      };
    case 'start_end':
    default:
      return {
        startLabel: 'Start',
        endLabel: 'End',
        durationLabel: 'Duration',
      };
  }
}

/**
 * Duration presets for equipment/kayak rentals
 */
export interface DurationPreset {
  label: string;
  hours: number;
  value: string;
}

export const EQUIPMENT_PRESETS: DurationPreset[] = [
  { label: 'Half-day (4h)', hours: 4, value: '4h' },
  { label: 'Full day (8h)', hours: 8, value: '8h' },
  { label: 'Overnight (24h)', hours: 24, value: '24h' },
];

export const ACCOMMODATION_PRESETS: DurationPreset[] = [
  { label: '1 night', hours: 24, value: '1n' },
  { label: '2 nights', hours: 48, value: '2n' },
  { label: 'Weekend (3 nights)', hours: 72, value: '3n' },
  { label: 'Week (7 nights)', hours: 168, value: '7n' },
];

/**
 * Get appropriate presets based on reservation_mode
 */
export function getDurationPresets(reservationMode: ReservationMode | string | null | undefined): DurationPreset[] {
  switch (reservationMode) {
    case 'check_in_out':
      return ACCOMMODATION_PRESETS;
    case 'pickup_return':
      return EQUIPMENT_PRESETS;
    case 'arrive_depart':
      return []; // Parking/moorage typically doesn't use presets
    case 'start_end':
    default:
      return [];
  }
}

/**
 * Snap a date to the nearest 15-minute increment
 */
export function snapTo15Minutes(date: Date, direction: 'floor' | 'ceil' = 'floor'): Date {
  const snapped = new Date(date);
  const minutes = direction === 'floor' 
    ? Math.floor(snapped.getMinutes() / 15) * 15
    : Math.ceil(snapped.getMinutes() / 15) * 15;
  
  if (minutes >= 60) {
    snapped.setHours(snapped.getHours() + 1);
    snapped.setMinutes(0, 0, 0);
  } else {
    snapped.setMinutes(minutes, 0, 0);
  }
  return snapped;
}

/**
 * Calculate end_date from start_date and a preset
 */
export function calculateEndFromPreset(startsAt: Date, preset: DurationPreset): Date {
  const end = new Date(startsAt);
  end.setHours(end.getHours() + preset.hours);
  return snapTo15Minutes(end, 'ceil');
}

/**
 * Apply default times from asset profile to a date
 */
export function applyDefaultTime(date: Date, timeString: string | null | undefined): Date {
  if (!timeString) return date;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return snapTo15Minutes(result);
}
