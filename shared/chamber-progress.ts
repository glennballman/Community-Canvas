/**
 * Chamber Progress Tracking System
 * Tracks the status of chamber member database building workflow
 * 
 * Completion Criteria:
 * - COMPLETED: 30+ members AND 80%+ NAICS coverage
 * - PARTIAL: Has some data but doesn't meet both criteria
 * - PENDING: No member data yet
 * - IN_PROGRESS: Currently being worked on
 * - BLOCKED: Known impediment (no public directory, etc.)
 */

import { BC_CHAMBERS_OF_COMMERCE } from './chambers-of-commerce';
import { chamberMembers } from './chamber-members';

export type ChamberProgressStatus = 'pending' | 'in_progress' | 'partial' | 'completed' | 'blocked';

export type PartialReason = 
  | 'below_member_threshold'    // Less than 30 members
  | 'below_naics_threshold'     // Less than 80% NAICS coverage
  | 'missing_expected_count';   // No expected member count entered

export interface ChamberProgress {
  chamberId: string;
  chamberName: string;
  region: string;
  municipality: string;
  status: ChamberProgressStatus;
  actualMembers: number;
  expectedMembers: number | null;  // null means not yet entered
  naicsCoverage: number | null;    // null when expected is missing or no members
  partialReasons: PartialReason[];
  lastUpdated: string | null;
  notes: string | null;
  blockedReason: string | null;
}

export interface ChamberProgressSummary {
  total: number;
  completed: number;
  partial: number;
  pending: number;
  inProgress: number;
  blocked: number;
  completedPercentage: number;
  neededForThreshold: number;  // How many more needed to reach 80% (86 chambers)
}

// Expected member counts for chambers (can be updated via UI)
// This would typically be stored in database, but for now we use a map
const expectedMemberCounts: Record<string, number> = {
  // Large chambers with known member counts from their websites
  'greater-vancouver-board-of-trade': 5000,
  'burnaby-board-of-trade': 1100,
  'surrey-white-rock-board-of-trade': 3000,
  'richmond-chamber-of-commerce': 800,
  'delta-chamber-of-commerce': 450,
  'kelowna-chamber-of-commerce': 1200,
  'greater-victoria-chamber-of-commerce': 1500,
  'kamloops-chamber-of-commerce': 700,
  'prince-george-chamber-of-commerce': 600,
  'nanaimo-chamber-of-commerce': 800,
  'abbotsford-chamber-of-commerce': 700,
  'chilliwack-chamber-of-commerce': 600,
  'langley-chamber-of-commerce': 500,
  'mission-chamber-of-commerce': 200,
  'maple-ridge-pitt-meadows-chamber': 300,
  'tri-cities-chamber-of-commerce': 600,
  'new-westminster-chamber': 300,
  'comox-valley-chamber-of-commerce': 500,
  'campbell-river-chamber-of-commerce': 350,
  'penticton-chamber-of-commerce': 450,
  'vernon-chamber-of-commerce': 500,
  'salmon-arm-chamber-of-commerce': 300,
  'cranbrook-chamber-of-commerce': 300,
  'nelson-chamber-of-commerce': 280,
  'trail-chamber-of-commerce': 200,
  'castlegar-chamber-of-commerce': 150,
  'revelstoke-chamber-of-commerce': 200,
  'golden-chamber-of-commerce': 150,
  'fernie-chamber-of-commerce': 200,
  'whistler-chamber-of-commerce': 600,
  'squamish-chamber-of-commerce': 300,
  'powell-river-chamber-of-commerce': 200,
  'sechelt-chamber-of-commerce': 200,
  'gibsons-chamber-of-commerce': 150,
  'williams-lake-chamber-of-commerce': 250,
  'quesnel-chamber-of-commerce': 200,
  'prince-rupert-chamber-of-commerce': 200,
  'terrace-chamber-of-commerce': 250,
  'kitimat-chamber-of-commerce': 150,
  'fort-st-john-chamber-of-commerce': 350,
  'dawson-creek-chamber-of-commerce': 200,
  'parksville-qualicum-chamber': 400,
  'duncan-cowichan-chamber-of-commerce': 350,
  'ladysmith-chamber-of-commerce': 150,
  'port-alberni-chamber-of-commerce': 250,
  'tofino-long-beach-chamber-of-commerce': 200,
  'ucluelet-chamber-of-commerce': 100,
  'port-hardy-chamber-of-commerce': 150,
  'merritt-chamber-of-commerce': 150,
  'hope-chamber-of-commerce': 150,
};

// Minimum thresholds for completion
const MEMBER_THRESHOLD = 30;
const NAICS_THRESHOLD = 80;

/**
 * Calculate NAICS coverage for a chamber
 */
function calculateNaicsCoverage(chamberId: string): { total: number; withNaics: number; percentage: number | null } {
  const members = chamberMembers.filter(m => m.chamberId === chamberId);
  const total = members.length;
  
  if (total === 0) {
    return { total: 0, withNaics: 0, percentage: null };
  }
  
  const withNaics = members.filter(m => m.naicsCode && m.naicsCode.length > 0).length;
  // Use floor to be conservative - don't round up to 80% if below threshold
  const percentage = Math.floor((withNaics / total) * 100);
  
  return { total, withNaics, percentage };
}

/**
 * Determine the status and partial reasons for a chamber
 */
function determineStatus(
  actualMembers: number,
  expectedMembers: number | null,
  naicsCoverage: number | null
): { status: ChamberProgressStatus; partialReasons: PartialReason[] } {
  const partialReasons: PartialReason[] = [];
  
  // If no members at all, it's pending
  if (actualMembers === 0) {
    return { status: 'pending', partialReasons: [] };
  }
  
  // Check each criterion
  const hasSufficientMembers = actualMembers >= MEMBER_THRESHOLD;
  const hasSufficientNaics = naicsCoverage !== null && naicsCoverage >= NAICS_THRESHOLD;
  const hasExpectedCount = expectedMembers !== null && expectedMembers > 0;
  
  // Build partial reasons
  if (!hasSufficientMembers) {
    partialReasons.push('below_member_threshold');
  }
  if (naicsCoverage !== null && !hasSufficientNaics) {
    partialReasons.push('below_naics_threshold');
  }
  if (!hasExpectedCount) {
    partialReasons.push('missing_expected_count');
  }
  
  // Determine status
  // COMPLETED only if: 30+ members AND 80%+ NAICS coverage
  if (hasSufficientMembers && hasSufficientNaics) {
    return { status: 'completed', partialReasons: [] };
  }
  
  // Has some data but doesn't meet criteria
  return { status: 'partial', partialReasons };
}

/**
 * Get progress data for all chambers
 */
export function getChamberProgressList(): ChamberProgress[] {
  const progressList: ChamberProgress[] = [];
  
  for (const chamber of BC_CHAMBERS_OF_COMMERCE) {
    const naicsData = calculateNaicsCoverage(chamber.id);
    const expectedMembers = expectedMemberCounts[chamber.id] || null;
    
    const { status, partialReasons } = determineStatus(
      naicsData.total,
      expectedMembers,
      naicsData.percentage
    );
    
    progressList.push({
      chamberId: chamber.id,
      chamberName: chamber.name,
      region: chamber.region,
      municipality: chamber.municipality,
      status,
      actualMembers: naicsData.total,
      expectedMembers,
      naicsCoverage: naicsData.percentage,
      partialReasons,
      lastUpdated: naicsData.total > 0 ? new Date().toISOString() : null,
      notes: null,
      blockedReason: null,
    });
  }
  
  // Sort: in_progress first, then partial, then pending, then completed, then blocked
  const statusOrder: Record<ChamberProgressStatus, number> = {
    'in_progress': 0,
    'partial': 1,
    'pending': 2,
    'completed': 3,
    'blocked': 4,
  };
  
  progressList.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    // Within same status, sort by member count descending
    return b.actualMembers - a.actualMembers;
  });
  
  return progressList;
}

/**
 * Get summary statistics for chamber progress
 */
export function getChamberProgressSummary(): ChamberProgressSummary {
  const progressList = getChamberProgressList();
  
  const summary: ChamberProgressSummary = {
    total: progressList.length,
    completed: 0,
    partial: 0,
    pending: 0,
    inProgress: 0,
    blocked: 0,
    completedPercentage: 0,
    neededForThreshold: 0,
  };
  
  for (const p of progressList) {
    switch (p.status) {
      case 'completed':
        summary.completed++;
        break;
      case 'partial':
        summary.partial++;
        break;
      case 'pending':
        summary.pending++;
        break;
      case 'in_progress':
        summary.inProgress++;
        break;
      case 'blocked':
        summary.blocked++;
        break;
    }
  }
  
  summary.completedPercentage = Math.round((summary.completed / summary.total) * 100);
  
  // 80% threshold = 86 chambers (0.8 * 107 = 85.6, rounded up)
  const targetCount = Math.ceil(summary.total * 0.8);
  summary.neededForThreshold = Math.max(0, targetCount - summary.completed);
  
  return summary;
}

/**
 * Get partial reason display text
 */
export function getPartialReasonText(reason: PartialReason): string {
  switch (reason) {
    case 'below_member_threshold':
      return `Less than ${MEMBER_THRESHOLD} members`;
    case 'below_naics_threshold':
      return `Less than ${NAICS_THRESHOLD}% NAICS coverage`;
    case 'missing_expected_count':
      return 'Expected member count not entered';
    default:
      return reason;
  }
}

/**
 * Get status badge color class
 */
export function getStatusBadgeClass(status: ChamberProgressStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'partial':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'pending':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'blocked':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Get status display text
 */
export function getStatusDisplayText(status: ChamberProgressStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'partial':
      return 'Partial';
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'blocked':
      return 'Blocked';
    default:
      return status;
  }
}
