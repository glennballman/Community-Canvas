import { chamberMembers } from './chamber-members';
import { BC_CHAMBERS_OF_COMMERCE } from './chambers-of-commerce';

export interface MissingFieldEntry {
  memberId: string;
  businessName: string;
  chamberId: string;
  field: string;
}

export interface AuditResult {
  timestamp: string;
  summary: {
    totalMembers: number;
    sumByChamberId: number;
    countMatch: boolean;
    totalChambers: number;
    chambersWithMembers: number;
    chambersWithoutMembers: number;
    naicsCoverage: number;
    orphanedIds: number;
    duplicateIds: number;
    missingRequiredFields: number;
  };
  memberCountReconciliation: {
    totalFromFile: number;
    sumByChamber: number;
    discrepancy: number;
    byChamberId: Record<string, number>;
  };
  orphanedChamberIds: Array<{ chamberId: string; memberCount: number }>;
  duplicateMemberIds: Array<{ id: string; count: number }>;
  missingRequiredFields: MissingFieldEntry[];
  chambersWithoutMembers: string[];
  naicsAnalysis: {
    overall: { total: number; withNaics: number; percentage: number };
    byChamberId: Record<string, { total: number; withNaics: number; percentage: number }>;
    belowThreshold: Array<{ chamberId: string; percentage: number; total: number; withNaics: number }>;
  };
  issues: Array<{
    type: string;
    chamberId?: string;
    memberCount?: number;
    id?: string;
    count?: number;
    field?: string;
    file?: string;
    jsonCount?: number;
    tsCount?: number;
    missing?: number;
  }>;
}

export function runChamberAudit(): AuditResult {
  const results: AuditResult = {
    timestamp: new Date().toISOString(),
    summary: {
      totalMembers: 0,
      sumByChamberId: 0,
      countMatch: false,
      totalChambers: 0,
      chambersWithMembers: 0,
      chambersWithoutMembers: 0,
      naicsCoverage: 0,
      orphanedIds: 0,
      duplicateIds: 0,
      missingRequiredFields: 0,
    },
    memberCountReconciliation: {
      totalFromFile: 0,
      sumByChamber: 0,
      discrepancy: 0,
      byChamberId: {},
    },
    orphanedChamberIds: [],
    duplicateMemberIds: [],
    missingRequiredFields: [],
    chambersWithoutMembers: [],
    naicsAnalysis: {
      overall: { total: 0, withNaics: 0, percentage: 0 },
      byChamberId: {},
      belowThreshold: [],
    },
    issues: [],
  };

  const totalMembers = chamberMembers.length;
  results.memberCountReconciliation.totalFromFile = totalMembers;
  results.summary.totalMembers = totalMembers;

  const memberIdCounts: Record<string, number> = {};
  const chamberCounts: Record<string, number> = {};
  const naicsByChamber: Record<string, { total: number; withNaics: number }> = {};
  let totalWithNaics = 0;

  chamberMembers.forEach((member) => {
    memberIdCounts[member.id] = (memberIdCounts[member.id] || 0) + 1;
    chamberCounts[member.chamberId] = (chamberCounts[member.chamberId] || 0) + 1;

    if (!naicsByChamber[member.chamberId]) {
      naicsByChamber[member.chamberId] = { total: 0, withNaics: 0 };
    }
    naicsByChamber[member.chamberId].total++;

    if (member.naicsCode && member.naicsCode.length > 0) {
      naicsByChamber[member.chamberId].withNaics++;
      totalWithNaics++;
    }

    if (!member.id || member.id === 'undefined') {
      results.missingRequiredFields.push({
        memberId: member.id || 'unknown',
        businessName: member.businessName || 'unknown',
        chamberId: member.chamberId || 'unknown',
        field: 'id',
      });
    }
    if (!member.businessName) {
      results.missingRequiredFields.push({
        memberId: member.id || 'unknown',
        businessName: 'missing',
        chamberId: member.chamberId || 'unknown',
        field: 'businessName',
      });
    }
    if (!member.chamberId) {
      results.missingRequiredFields.push({
        memberId: member.id || 'unknown',
        businessName: member.businessName || 'unknown',
        chamberId: 'missing',
        field: 'chamberId',
      });
    }
  });

  results.summary.missingRequiredFields = results.missingRequiredFields.length;

  results.memberCountReconciliation.byChamberId = chamberCounts;
  const sumByChamber = Object.values(chamberCounts).reduce((a, b) => a + b, 0);
  results.memberCountReconciliation.sumByChamber = sumByChamber;
  results.summary.sumByChamberId = sumByChamber;
  results.memberCountReconciliation.discrepancy = totalMembers - sumByChamber;
  results.summary.countMatch = results.memberCountReconciliation.discrepancy === 0;

  Object.entries(memberIdCounts).forEach(([id, count]) => {
    if (count > 1) {
      results.duplicateMemberIds.push({ id, count });
    }
  });
  results.summary.duplicateIds = results.duplicateMemberIds.length;

  const registryChamberIds = new Set(BC_CHAMBERS_OF_COMMERCE.map((c) => c.id));
  results.summary.totalChambers = registryChamberIds.size;

  const memberChamberIds = new Set(Object.keys(chamberCounts));
  memberChamberIds.forEach((id) => {
    if (!registryChamberIds.has(id)) {
      results.orphanedChamberIds.push({
        chamberId: id,
        memberCount: chamberCounts[id],
      });
    }
  });
  results.summary.orphanedIds = results.orphanedChamberIds.length;

  registryChamberIds.forEach((id) => {
    if (!chamberCounts[id] || chamberCounts[id] === 0) {
      results.chambersWithoutMembers.push(id);
    }
  });
  results.summary.chambersWithoutMembers = results.chambersWithoutMembers.length;
  results.summary.chambersWithMembers = registryChamberIds.size - results.summary.chambersWithoutMembers;

  Object.entries(naicsByChamber).forEach(([chamberId, data]) => {
    const percentage = data.total > 0 ? Math.round((data.withNaics / data.total) * 100) : 0;
    results.naicsAnalysis.byChamberId[chamberId] = {
      total: data.total,
      withNaics: data.withNaics,
      percentage,
    };

    if (percentage < 80 && data.total > 0) {
      results.naicsAnalysis.belowThreshold.push({
        chamberId,
        percentage,
        total: data.total,
        withNaics: data.withNaics,
      });
    }
  });

  results.naicsAnalysis.belowThreshold.sort((a, b) => a.percentage - b.percentage);

  results.naicsAnalysis.overall = {
    total: totalMembers,
    withNaics: totalWithNaics,
    percentage: totalMembers > 0 ? Math.round((totalWithNaics / totalMembers) * 100) : 0,
  };
  results.summary.naicsCoverage = results.naicsAnalysis.overall.percentage;

  if (results.orphanedChamberIds.length > 0) {
    results.orphanedChamberIds.forEach((o) => {
      results.issues.push({
        type: 'ORPHANED_CHAMBER_ID',
        chamberId: o.chamberId,
        memberCount: o.memberCount,
      });
    });
  }

  if (results.duplicateMemberIds.length > 0) {
    results.duplicateMemberIds.forEach((d) => {
      results.issues.push({
        type: 'DUPLICATE_MEMBER_ID',
        id: d.id,
        count: d.count,
      });
    });
  }

  if (results.missingRequiredFields.length > 0) {
    const fieldCounts: Record<string, number> = {};
    results.missingRequiredFields.forEach((m) => {
      fieldCounts[m.field] = (fieldCounts[m.field] || 0) + 1;
    });
    Object.entries(fieldCounts).forEach(([field, count]) => {
      results.issues.push({
        type: 'MISSING_REQUIRED_FIELD',
        field,
        count,
      });
    });
  }

  return results;
}
