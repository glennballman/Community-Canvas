import { chamberMembers } from "./chamber-members";
import { naicsSectorLabels, naicsSubsectorLabels, categoryToNAICS } from "./naics-codes";

export interface NAICSMemberSummary {
  id: string;
  businessName: string;
  chamberId: string;
  municipality?: string;
  naicsCode: string;
  naicsTitle: string;
}

export interface NAICSIndustryNode {
  code: string;
  title: string;
  memberCount: number;
}

export interface NAICSSubsectorNode {
  code: string;
  title: string;
  memberCount: number;
  industries: NAICSIndustryNode[];
}

export interface NAICSSectorNode {
  code: string;
  title: string;
  memberCount: number;
  subsectors: NAICSSubsectorNode[];
}

export interface NAICSTreeSummary {
  totalMembers: number;
  sectors: NAICSSectorNode[];
}

function getSectorCode(naicsCode: string): string {
  const twoDigit = naicsCode.substring(0, 2);
  if (twoDigit === "31" || twoDigit === "32" || twoDigit === "33") return "31-33";
  if (twoDigit === "44" || twoDigit === "45") return "44-45";
  if (twoDigit === "48" || twoDigit === "49") return "48-49";
  return twoDigit;
}

function getSubsectorCode(naicsCode: string): string {
  return naicsCode.substring(0, 3);
}

function getSectorTitle(sectorCode: string): string {
  return naicsSectorLabels[sectorCode] || `Sector ${sectorCode}`;
}

function getSubsectorTitle(subsectorCode: string): string {
  return naicsSubsectorLabels[subsectorCode] || `Subsector ${subsectorCode}`;
}

const naicsCodeToTitle: Map<string, string> = new Map();
for (const [, naicsEntry] of Object.entries(categoryToNAICS)) {
  if (!naicsCodeToTitle.has(naicsEntry.code)) {
    naicsCodeToTitle.set(naicsEntry.code, naicsEntry.title);
  }
}

function getIndustryTitle(naicsCode: string): string {
  return naicsCodeToTitle.get(naicsCode) || `Industry ${naicsCode}`;
}

let cachedTree: NAICSTreeSummary | null = null;
let cachedMembersByCode: Map<string, NAICSMemberSummary[]> | null = null;
let cachedMembersBySector: Map<string, NAICSMemberSummary[]> | null = null;
let cachedMembersBySubsector: Map<string, NAICSMemberSummary[]> | null = null;

function initializeMemberCaches(): void {
  if (cachedMembersByCode && cachedMembersBySector && cachedMembersBySubsector) return;
  
  cachedMembersByCode = new Map();
  cachedMembersBySector = new Map();
  cachedMembersBySubsector = new Map();
  
  for (const member of chamberMembers) {
    if (!member.naicsCode) continue;
    
    const summary: NAICSMemberSummary = {
      id: member.id,
      businessName: member.businessName,
      chamberId: member.chamberId,
      municipality: member.municipality,
      naicsCode: member.naicsCode,
      naicsTitle: member.naicsTitle || getIndustryTitle(member.naicsCode),
    };
    
    const code = member.naicsCode;
    const sectorCode = getSectorCode(code);
    const subsectorCode = getSubsectorCode(code);
    
    if (!cachedMembersByCode.has(code)) {
      cachedMembersByCode.set(code, []);
    }
    cachedMembersByCode.get(code)!.push(summary);
    
    if (!cachedMembersBySector.has(sectorCode)) {
      cachedMembersBySector.set(sectorCode, []);
    }
    cachedMembersBySector.get(sectorCode)!.push(summary);
    
    if (!cachedMembersBySubsector.has(subsectorCode)) {
      cachedMembersBySubsector.set(subsectorCode, []);
    }
    cachedMembersBySubsector.get(subsectorCode)!.push(summary);
  }
  
  const sortFn = (a: NAICSMemberSummary, b: NAICSMemberSummary) => 
    a.businessName.localeCompare(b.businessName);
  
  Array.from(cachedMembersByCode.values()).forEach(arr => arr.sort(sortFn));
  Array.from(cachedMembersBySector.values()).forEach(arr => arr.sort(sortFn));
  Array.from(cachedMembersBySubsector.values()).forEach(arr => arr.sort(sortFn));
}

export function buildNAICSTree(): NAICSTreeSummary {
  if (cachedTree) return cachedTree;

  const sectorMap = new Map<string, {
    memberCount: number;
    subsectors: Map<string, {
      memberCount: number;
      industries: Map<string, number>;
    }>;
  }>();

  for (const member of chamberMembers) {
    if (!member.naicsCode) continue;

    const sectorCode = getSectorCode(member.naicsCode);
    const subsectorCode = getSubsectorCode(member.naicsCode);
    const industryCode = member.naicsCode;

    if (!sectorMap.has(sectorCode)) {
      sectorMap.set(sectorCode, { memberCount: 0, subsectors: new Map() });
    }
    const sector = sectorMap.get(sectorCode)!;
    sector.memberCount++;

    if (!sector.subsectors.has(subsectorCode)) {
      sector.subsectors.set(subsectorCode, { memberCount: 0, industries: new Map() });
    }
    const subsector = sector.subsectors.get(subsectorCode)!;
    subsector.memberCount++;

    subsector.industries.set(industryCode, (subsector.industries.get(industryCode) || 0) + 1);
  }

  const sectors: NAICSSectorNode[] = [];
  const sortedSectorCodes = Array.from(sectorMap.keys()).sort();

  for (const sectorCode of sortedSectorCodes) {
    const sectorData = sectorMap.get(sectorCode)!;
    const subsectors: NAICSSubsectorNode[] = [];
    const sortedSubsectorCodes = Array.from(sectorData.subsectors.keys()).sort();

    for (const subsectorCode of sortedSubsectorCodes) {
      const subsectorData = sectorData.subsectors.get(subsectorCode)!;
      const industries: NAICSIndustryNode[] = [];
      const sortedIndustryCodes = Array.from(subsectorData.industries.keys()).sort();

      for (const industryCode of sortedIndustryCodes) {
        industries.push({
          code: industryCode,
          title: getIndustryTitle(industryCode),
          memberCount: subsectorData.industries.get(industryCode)!,
        });
      }

      subsectors.push({
        code: subsectorCode,
        title: getSubsectorTitle(subsectorCode),
        memberCount: subsectorData.memberCount,
        industries,
      });
    }

    sectors.push({
      code: sectorCode,
      title: getSectorTitle(sectorCode),
      memberCount: sectorData.memberCount,
      subsectors,
    });
  }

  cachedTree = {
    totalMembers: chamberMembers.filter(m => m.naicsCode).length,
    sectors,
  };

  return cachedTree;
}

export function getMembersByNAICSCode(
  naicsCode: string,
  page: number = 1,
  pageSize: number = 50
): { members: NAICSMemberSummary[]; total: number; page: number; pageSize: number; totalPages: number } {
  initializeMemberCaches();

  const allMembers = cachedMembersByCode!.get(naicsCode) || [];
  const total = allMembers.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const members = allMembers.slice(startIndex, startIndex + pageSize);

  return { members, total, page, pageSize, totalPages };
}

export function getMembersBySector(
  sectorCode: string,
  page: number = 1,
  pageSize: number = 50
): { members: NAICSMemberSummary[]; total: number; page: number; pageSize: number; totalPages: number } {
  initializeMemberCaches();

  const allMembers = cachedMembersBySector!.get(sectorCode) || [];
  const total = allMembers.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const members = allMembers.slice(startIndex, startIndex + pageSize);

  return { members, total, page, pageSize, totalPages };
}

export function getMembersBySubsector(
  subsectorCode: string,
  page: number = 1,
  pageSize: number = 50
): { members: NAICSMemberSummary[]; total: number; page: number; pageSize: number; totalPages: number } {
  initializeMemberCaches();

  const allMembers = cachedMembersBySubsector!.get(subsectorCode) || [];
  const total = allMembers.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const members = allMembers.slice(startIndex, startIndex + pageSize);

  return { members, total, page, pageSize, totalPages };
}

export function clearNAICSCache(): void {
  cachedTree = null;
  cachedMembersByCode = null;
  cachedMembersBySector = null;
  cachedMembersBySubsector = null;
}
