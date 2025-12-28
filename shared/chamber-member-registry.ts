import { ChamberMemberSchema, ChamberMemberArraySchema, type ChamberMember, type BusinessCategory } from './chamber-member-schema';
import portAlberniData from '../data/chambers/port-alberni.json';

const chamberDataFiles: Record<string, unknown[]> = {
  'port-alberni-chamber': portAlberniData as unknown[],
};

let validatedMembers: ChamberMember[] | null = null;

function loadAndValidateMembers(): ChamberMember[] {
  if (validatedMembers !== null) {
    return validatedMembers;
  }
  
  const allMembers: ChamberMember[] = [];
  
  for (const [chamberId, data] of Object.entries(chamberDataFiles)) {
    try {
      const validated = ChamberMemberArraySchema.parse(data);
      allMembers.push(...validated);
    } catch (error) {
      console.error(`Failed to validate chamber data for ${chamberId}:`, error);
    }
  }
  
  validatedMembers = allMembers;
  return validatedMembers;
}

export function getJsonLoadedMembers(): ChamberMember[] {
  return loadAndValidateMembers();
}

export function getJsonMembersByChamber(chamberId: string): ChamberMember[] {
  return loadAndValidateMembers().filter(m => m.chamberId === chamberId);
}

export function getJsonMemberCountByChamber(chamberId: string): number {
  return loadAndValidateMembers().filter(m => m.chamberId === chamberId).length;
}

export function getJsonMembersByCategory(category: BusinessCategory): ChamberMember[] {
  return loadAndValidateMembers().filter(m => m.category === category);
}
