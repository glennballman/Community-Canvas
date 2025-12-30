import { ChamberMemberSchema, ChamberMemberArraySchema, type ChamberMember, type BusinessCategory } from './chamber-member-schema';
import * as fs from 'fs';
import * as path from 'path';

// Map chamber IDs to their JSON file names
const chamberJsonFiles: Record<string, string> = {
  'port-alberni-chamber': 'port-alberni.json',
  'ladysmith-chamber': 'ladysmith.json',
  'port-hardy-chamber': 'port-hardy.json',
  'tofino-chamber': 'tofino.json',
  'ucluelet-chamber': 'ucluelet.json',
  'sooke-chamber': 'sooke.json',
  'chemainus-chamber': 'chemainus.json',
  'cowichan-lake-chamber': 'cowichan-lake.json',
  'port-mcneill-chamber': 'port-mcneill.json',
  'alert-bay-chamber': 'alert-bay.json',
  'qualicum-beach-chamber': 'qualicum-beach.json',
  'port-renfrew-chamber': 'port-renfrew.json',
  'pender-island-chamber': 'pender-island.json',
};

// Load JSON files dynamically at runtime (not bundled at compile time)
// This ensures updates to JSON files are reflected after server restart
function loadAndValidateMembers(): ChamberMember[] {
  const allMembers: ChamberMember[] = [];
  const dataDir = path.join(process.cwd(), 'data', 'chambers');
  
  for (const [chamberId, fileName] of Object.entries(chamberJsonFiles)) {
    try {
      const filePath = path.join(dataDir, fileName);
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(rawData);
        const validated = ChamberMemberArraySchema.parse(data);
        allMembers.push(...validated);
      }
    } catch (error) {
      console.error(`Failed to load/validate chamber data for ${chamberId}:`, error);
    }
  }
  
  return allMembers;
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
