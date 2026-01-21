/**
 * Canonical Work Request Status Constants
 * 
 * Single source of truth for work request status values.
 * Used by coordination signals, status filters, and UI components.
 */

export const WORK_REQUEST_STATUSES = [
  'new',
  'contacted',
  'quoted',
  'scheduled',
  'completed',
  'dropped',
  'spam',
] as const;

export type WorkRequestStatus = (typeof WORK_REQUEST_STATUSES)[number];

/**
 * Active statuses - requests that are "in play" for coordination.
 * These represent work that could benefit from route optimization or bundling.
 */
export const WORK_REQUEST_ACTIVE_STATUSES = [
  'new',
  'contacted',
  'quoted',
  'scheduled',
] as const;

export type WorkRequestActiveStatus = (typeof WORK_REQUEST_ACTIVE_STATUSES)[number];

/**
 * New statuses - fresh requests that haven't been touched yet.
 */
export const WORK_REQUEST_NEW_STATUSES = ['new'] as const;

export type WorkRequestNewStatus = (typeof WORK_REQUEST_NEW_STATUSES)[number];

/**
 * Terminal statuses - requests that have reached an end state.
 */
export const WORK_REQUEST_TERMINAL_STATUSES = [
  'completed',
  'dropped',
  'spam',
] as const;

export type WorkRequestTerminalStatus = (typeof WORK_REQUEST_TERMINAL_STATUSES)[number];
