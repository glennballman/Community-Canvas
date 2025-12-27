const fs = require('fs');

const tofinoMembers = require('./tofino-integration.json');
const campbellRiverMembers = require('./campbell-river-integration.json');

// Read current file
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find the closing bracket pattern
const closingPattern = /(\s*}\s*)\]\s*as\s*const\s*satisfies\s*readonly\s*ChamberMember\[\];/;
const match = content.match(closingPattern);

if (!match) {
  console.log('Could not find closing pattern');
  process.exit(1);
}

console.log('Found closing pattern');

// Generate entries for Tofino
let tofinoEntries = '\n  // ============================================================================\n';
tofinoEntries += '  // TOFINO-LONG BEACH CHAMBER OF COMMERCE\n';
tofinoEntries += '  // ============================================================================\n';

tofinoMembers.forEach(m => {
  tofinoEntries += `  {\n`;
  tofinoEntries += `    id: "${m.id}",\n`;
  tofinoEntries += `    chamberId: "${m.chamberId}",\n`;
  tofinoEntries += `    businessName: "${m.businessName.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}",\n`;
  tofinoEntries += `    category: "${m.category}",\n`;
  tofinoEntries += `    naicsCode: "${m.naicsCode}",\n`;
  tofinoEntries += `    naicsSubsector: "${m.naicsSubsector}",\n`;
  tofinoEntries += `    naicsSector: "${m.naicsSector}",\n`;
  tofinoEntries += `    naicsTitle: "${m.naicsTitle}",\n`;
  tofinoEntries += `    municipality: "${m.municipality}",\n`;
  tofinoEntries += `    region: "${m.region}",\n`;
  tofinoEntries += `  },\n`;
});

// Generate entries for Campbell River
let crEntries = '  // ============================================================================\n';
crEntries += '  // CAMPBELL RIVER & DISTRICT CHAMBER OF COMMERCE\n';
crEntries += '  // ============================================================================\n';

campbellRiverMembers.forEach((m, i) => {
  crEntries += `  {\n`;
  crEntries += `    id: "${m.id}",\n`;
  crEntries += `    chamberId: "${m.chamberId}",\n`;
  crEntries += `    businessName: "${m.businessName.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}",\n`;
  if (m.website) crEntries += `    website: "${m.website}",\n`;
  crEntries += `    category: "${m.category}",\n`;
  crEntries += `    naicsCode: "${m.naicsCode}",\n`;
  crEntries += `    naicsSubsector: "${m.naicsSubsector}",\n`;
  crEntries += `    naicsSector: "${m.naicsSector}",\n`;
  crEntries += `    naicsTitle: "${m.naicsTitle}",\n`;
  crEntries += `    municipality: "${m.municipality}",\n`;
  crEntries += `    region: "${m.region}",\n`;
  crEntries += `  }`;
  // Add comma except for last entry
  if (i < campbellRiverMembers.length - 1) {
    crEntries += ',';
  }
  crEntries += '\n';
});

// Insert before the closing bracket
const allEntries = tofinoEntries + crEntries;
const newContent = content.replace(closingPattern, `$1,${allEntries}] as const satisfies readonly ChamberMember[];`);

fs.writeFileSync('shared/chamber-members.ts', newContent);
console.log(`Added ${tofinoMembers.length} Tofino members and ${campbellRiverMembers.length} Campbell River members`);
