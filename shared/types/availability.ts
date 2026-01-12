import { z } from 'zod';

export const AvailabilitySignalSchema = z.enum([
  'available', 'limited', 'waitlist', 'call_to_confirm', 'unavailable'
]);

export const ScarcityBandSchema = z.enum([
  'available', 'limited', 'scarce', 'call_to_confirm', 'unavailable'
]);

export const NextActionSchema = z.enum([
  'book_request', 'call_provider', 'waitlist', 'unavailable'
]);

export const SourceVisibilitySchema = z.enum(['disclosed', 'truth_only']);

export const ParticipationModeSchema = z.enum([
  'inventory_hidden', 'requests_only', 'manual_confirm', 'instant_confirm'
]);

export type AvailabilitySignal = z.infer<typeof AvailabilitySignalSchema>;
export type ScarcityBand = z.infer<typeof ScarcityBandSchema>;
export type NextAction = z.infer<typeof NextActionSchema>;
export type SourceVisibility = z.infer<typeof SourceVisibilitySchema>;
export type ParticipationMode = z.infer<typeof ParticipationModeSchema>;
