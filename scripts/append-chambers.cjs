const fs = require('fs');

const tofinoMembers = require('./tofino-integration.json');
const campbellRiverMembers = require('./campbell-river-integration.json');

// Read current file
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find the closing bracket of the array (before "as const satisfies")
const closingIndex = content.lastIndexOf('}] as const');
if (closingIndex === -1) {
  console.log('Could not find closing bracket');
  process.exit(1);
}

// Generate entries for Tofino
let tofinoEntries = '\n  // ============================================================================\n';
tofinoEntries += '  // TOFINO-LONG BEACH CHAMBER OF COMMERCE\n';
tofinoEntries += '  // ============================================================================\n';

tofinoMembers.forEach(m => {
  tofinoEntries += `  {\n`;
  tofinoEntries += `    id: "${m.id}",\n`;
  tofinoEntries += `    chamberId: "${m.chamberId}",\n`;
  tofinoEntries += `    businessName: "${m.businessName.replace(/"/g, '\\"')}",\n`;
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

campbellRiverMembers.forEach(m => {
  crEntries += `  {\n`;
  crEntries += `    id: "${m.id}",\n`;
  crEntries += `    chamberId: "${m.chamberId}",\n`;
  crEntries += `    businessName: "${m.businessName.replace(/"/g, '\\"')}",\n`;
  if (m.website) crEntries += `    website: "${m.website}",\n`;
  crEntries += `    category: "${m.category}",\n`;
  crEntries += `    naicsCode: "${m.naicsCode}",\n`;
  crEntries += `    naicsSubsector: "${m.naicsSubsector}",\n`;
  crEntries += `    naicsSector: "${m.naicsSector}",\n`;
  crEntries += `    naicsTitle: "${m.naicsTitle}",\n`;
  crEntries += `    municipality: "${m.municipality}",\n`;
  crEntries += `    region: "${m.region}",\n`;
  crEntries += `  },\n`;
});

// Insert before the closing bracket
const newContent = content.slice(0, closingIndex + 1) + ',' + tofinoEntries + crEntries.slice(0, -2) + content.slice(closingIndex + 1);

fs.writeFileSync('shared/chamber-members.ts', newContent);
console.log(`Added ${tofinoMembers.length} Tofino members and ${campbellRiverMembers.length} Campbell River members`);
