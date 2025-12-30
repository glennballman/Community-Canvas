/**
 * Chamber Progress Tracking System
 * Tracks the status of chamber member database building workflow
 * 
 * Completion Criteria:
 * - COMPLETED: 30+ members AND 80%+ of Expected members collected
 * - PARTIAL: Has some data but doesn't meet both criteria
 * - PENDING: No member data yet
 * - IN_PROGRESS: Currently being worked on
 * - BLOCKED: Known impediment (no public directory, etc.)
 * 
 * Note: NAICS coverage is expected to be 100% for all entries but is NOT part of completion criteria
 */

import { BC_CHAMBERS_OF_COMMERCE } from './chambers-of-commerce';
import { chamberMembers as staticMembers } from './chamber-members';
import { getJsonLoadedMembers } from './chamber-member-registry';

// Merge static members with dynamically-loaded JSON members
// This ensures new JSON files are automatically included without regenerating the static file
function getAllChamberMembers() {
  const jsonMembers = getJsonLoadedMembers();
  const jsonMemberIds = new Set(jsonMembers.map(m => m.id));
  
  // Filter out static members that have been replaced by JSON versions
  const uniqueStaticMembers = staticMembers.filter(m => !jsonMemberIds.has(m.id));
  
  return [...uniqueStaticMembers, ...jsonMembers];
}

const chamberMembers = getAllChamberMembers();

export type ChamberProgressStatus = 'pending' | 'in_progress' | 'partial' | 'completed' | 'blocked';

export type PartialReason = 
  | 'below_member_threshold'    // Less than 30 members
  | 'below_percent_complete';   // Less than 80% of target (Expected or Estimated)

export interface ChamberProgress {
  chamberId: string;
  chamberName: string;
  region: string;
  municipality: string;
  status: ChamberProgressStatus;
  actualMembers: number;
  expectedMembers: number | null;  // From official website/source
  estimatedMembers: number;        // Our calculation (actual × 1.2 or region default)
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

/**
 * Parse member count string from chamber metadata (e.g., "5,000+", "300-400", "500")
 * Returns the lower bound or single value as a number
 */
function parseMemberString(memberStr: string | undefined): number | null {
  if (!memberStr) return null;
  
  // Remove commas and trim
  const cleaned = memberStr.replace(/,/g, '').trim();
  
  // Handle range format "300-400" - take the upper value
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const upper = parseInt(parts[1].replace(/[^\d]/g, ''), 10);
    if (!isNaN(upper)) return upper;
  }
  
  // Handle "500+" format - extract number
  const num = parseInt(cleaned.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * Get region tier for default expected member count
 * Metro: 400, Regional city: 250, Small town: 120, Remote: 60
 */
function getRegionTierDefault(region: string): number {
  const metroRegions = ['Metro Vancouver', 'Capital Regional District'];
  const regionalCityRegions = ['Central Okanagan', 'Thompson-Nicola', 'Fraser Valley', 'Nanaimo'];
  
  if (metroRegions.includes(region)) return 400;
  if (regionalCityRegions.includes(region)) return 250;
  
  // Check for "Greater" or major city patterns
  if (region.includes('Greater') || region.includes('Okanagan') || region.includes('Kootenay')) return 200;
  
  // Remote/small communities
  return 120;
}

/**
 * Get expected member counts from official sources (website metadata)
 */
function getExpectedMemberCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const chamber of BC_CHAMBERS_OF_COMMERCE) {
    const parsedFromMetadata = parseMemberString(chamber.members);
    if (parsedFromMetadata !== null && parsedFromMetadata >= 40) {
      counts[chamber.id] = parsedFromMetadata;
    }
  }
  
  return counts;
}

/**
 * Get estimated member counts (our calculations)
 * Uses actual count × 1.2 or region tier default
 */
function getEstimatedMemberCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  
  // Count actual members per chamber
  const actualCounts = new Map<string, number>();
  for (const member of chamberMembers) {
    actualCounts.set(member.chamberId, (actualCounts.get(member.chamberId) || 0) + 1);
  }
  
  for (const chamber of BC_CHAMBERS_OF_COMMERCE) {
    const actualCount = actualCounts.get(chamber.id) || 0;
    
    if (actualCount > 0) {
      // Use actual count × 1.2, rounded to nearest 10, minimum 40
      counts[chamber.id] = Math.max(40, Math.ceil((actualCount * 1.2) / 10) * 10);
    } else {
      // Fall back to region tier default
      counts[chamber.id] = getRegionTierDefault(chamber.region);
    }
  }
  
  return counts;
}

// Expected = from official website sources
const expectedMemberCounts: Record<string, number> = getExpectedMemberCounts();
// Estimated = our calculations
const estimatedMemberCounts: Record<string, number> = getEstimatedMemberCounts();

// Minimum thresholds for completion
const MEMBER_THRESHOLD = 30;

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

// Minimum threshold for % Complete to be considered "completed"
const PERCENT_COMPLETE_THRESHOLD = 80;

/**
 * Determine the status and partial reasons for a chamber
 * Completion: 30+ members AND 80%+ of target (Expected if available, else Estimated)
 */
function determineStatus(
  actualMembers: number,
  expectedMembers: number | null,
  estimatedMembers: number
): { status: ChamberProgressStatus; partialReasons: PartialReason[] } {
  const partialReasons: PartialReason[] = [];
  
  // If no members at all, it's pending
  if (actualMembers === 0) {
    return { status: 'pending', partialReasons: [] };
  }
  
  // Check each criterion
  const hasSufficientMembers = actualMembers >= MEMBER_THRESHOLD;
  
  // Use Expected if available, otherwise use Estimated
  const targetMembers = expectedMembers !== null ? expectedMembers : estimatedMembers;
  const percentComplete = Math.floor((actualMembers / targetMembers) * 100);
  const hasSufficientPercentComplete = percentComplete >= PERCENT_COMPLETE_THRESHOLD;
  
  // Build partial reasons
  if (!hasSufficientMembers) {
    partialReasons.push('below_member_threshold');
  }
  if (!hasSufficientPercentComplete) {
    partialReasons.push('below_percent_complete');
  }
  
  // Determine status
  // COMPLETED only if: 30+ members AND 80%+ of target collected
  if (hasSufficientMembers && hasSufficientPercentComplete) {
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
    const estimatedMembers = estimatedMemberCounts[chamber.id] || getRegionTierDefault(chamber.region);
    
    const { status, partialReasons } = determineStatus(
      naicsData.total,
      expectedMembers,
      estimatedMembers
    );
    
    progressList.push({
      chamberId: chamber.id,
      chamberName: chamber.name,
      region: chamber.region,
      municipality: chamber.municipality,
      status,
      actualMembers: naicsData.total,
      expectedMembers,
      estimatedMembers,
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
    case 'below_percent_complete':
      return `Below ${PERCENT_COMPLETE_THRESHOLD}% of target`;
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
