/**
 * Member Timeline Tracking
 * Computes daily member additions and cumulative totals for charting
 */

import { chamberMembers } from './chamber-members';

export interface DailyMemberData {
  date: string;           // YYYY-MM-DD
  dateLabel: string;      // Formatted for display (e.g., "Dec 27")
  added: number;          // Members added on this day
  cumulative: number;     // Running total of all members
}

/**
 * Get date string in YYYY-MM-DD format
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for display (e.g., "Dec 27")
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Assign dates to members that don't have them
 * Spreads existing members across the last 3 days
 */
function getMemberDates(): Map<string, string> {
  const memberDates = new Map<string, string>();
  
  // Get dates for last 3 days
  const today = new Date();
  const dates: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDateISO(d));
  }
  
  // Group members by chamber for more realistic distribution
  const membersByChamber = new Map<string, string[]>();
  for (const member of chamberMembers) {
    const chamberId = member.chamberId;
    if (!membersByChamber.has(chamberId)) {
      membersByChamber.set(chamberId, []);
    }
    membersByChamber.get(chamberId)!.push(member.id);
  }
  
  // Distribute members across the 3 days
  // Day 1 (2 days ago): ~33%, Day 2 (yesterday): ~33%, Day 3 (today): ~34%
  let index = 0;
  membersByChamber.forEach((memberIds) => {
    for (const memberId of memberIds) {
      // Distribute evenly across the 3 days
      const dayIndex = index % 3;
      memberDates.set(memberId, dates[dayIndex]);
      index++;
    }
  });
  
  return memberDates;
}

/**
 * Get all dates in a range
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  while (current <= end) {
    dates.push(formatDateISO(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Get daily member addition data for charting
 * Extended date range: Dec 23, 2025 to March 30, 2026
 */
export function getMemberTimelineData(): DailyMemberData[] {
  const memberDates = getMemberDates();
  
  // Count members per day
  const dailyCounts = new Map<string, number>();
  
  for (const member of chamberMembers) {
    // Use the member's dateAdded if available, otherwise use backfilled date
    const date = (member as { dateAdded?: string }).dateAdded || memberDates.get(member.id) || formatDateISO(new Date());
    
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  }
  
  // Extended date range: Dec 23, 2025 to March 30, 2026
  const startDate = '2025-12-23';
  const endDate = '2026-03-30';
  const allDates = getDateRange(startDate, endDate);
  
  const result: DailyMemberData[] = [];
  let cumulative = 0;
  
  for (const date of allDates) {
    const added = dailyCounts.get(date) || 0;
    cumulative += added;
    result.push({
      date,
      dateLabel: formatDateLabel(date),
      added,
      cumulative,
    });
  }
  
  return result;
}

/**
 * Get timeline summary statistics
 */
export function getMemberTimelineSummary() {
  const data = getMemberTimelineData();
  const totalMembers = chamberMembers.length;
  const totalDays = data.length;
  const avgPerDay = totalDays > 0 ? Math.round(totalMembers / totalDays) : 0;
  const maxDay = data.reduce((max, d) => d.added > max.added ? d : max, { added: 0, date: '', dateLabel: '', cumulative: 0 });
  
  return {
    totalMembers,
    totalDays,
    avgPerDay,
    maxDay: maxDay.added,
    maxDayLabel: maxDay.dateLabel,
    data,
  };
}
