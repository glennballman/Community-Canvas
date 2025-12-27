const fs = require('fs');

const tofinoMembers = require('./tofino-integration.json');
const campbellRiverMembers = require('./campbell-river-integration.json');

// Read current file
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find the exact closing string
const searchString = '},] as const satisfies readonly ChamberMember[];';
const insertIndex = content.indexOf(searchString);

if (insertIndex === -1) {
  console.log('Could not find closing string');
  process.exit(1);
}

console.log('Found closing at index:', insertIndex);

// Generate entries for Tofino
let newEntries = '\n  // ============================================================================\n';
newEntries += '  // TOFINO-LONG BEACH CHAMBER OF COMMERCE\n';
newEntries += '  // ============================================================================\n';

tofinoMembers.forEach(m => {
  const name = m.businessName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  newEntries += `  {\n`;
  newEntries += `    id: "${m.id}",\n`;
  newEntries += `    chamberId: "${m.chamberId}",\n`;
  newEntries += `    businessName: "${name}",\n`;
  newEntries += `    category: "${m.category}",\n`;
  newEntries += `    naicsCode: "${m.naicsCode}",\n`;
  newEntries += `    naicsSubsector: "${m.naicsSubsector}",\n`;
  newEntries += `    naicsSector: "${m.naicsSector}",\n`;
  newEntries += `    naicsTitle: "${m.naicsTitle}",\n`;
  newEntries += `    municipality: "${m.municipality}",\n`;
  newEntries += `    region: "${m.region}",\n`;
  newEntries += `  },\n`;
});

// Generate entries for Campbell River
newEntries += '  // ============================================================================\n';
newEntries += '  // CAMPBELL RIVER & DISTRICT CHAMBER OF COMMERCE\n';
newEntries += '  // ============================================================================\n';

campbellRiverMembers.forEach((m, i) => {
  const name = m.businessName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  newEntries += `  {\n`;
  newEntries += `    id: "${m.id}",\n`;
  newEntries += `    chamberId: "${m.chamberId}",\n`;
  newEntries += `    businessName: "${name}",\n`;
  if (m.website) newEntries += `    website: "${m.website}",\n`;
  newEntries += `    category: "${m.category}",\n`;
  newEntries += `    naicsCode: "${m.naicsCode}",\n`;
  newEntries += `    naicsSubsector: "${m.naicsSubsector}",\n`;
  newEntries += `    naicsSector: "${m.naicsSector}",\n`;
  newEntries += `    naicsTitle: "${m.naicsTitle}",\n`;
  newEntries += `    municipality: "${m.municipality}",\n`;
  newEntries += `    region: "${m.region}",\n`;
  newEntries += `  }`;
  // Add comma for all except last
  if (i < campbellRiverMembers.length - 1) {
    newEntries += ',';
  }
  newEntries += '\n';
});

// Insert the new entries - replace },] with the entries plus }]
const before = content.slice(0, insertIndex + 2); // includes '},
const after = content.slice(insertIndex + 2); // '] as const...'
const newContent = before + newEntries + after;

fs.writeFileSync('shared/chamber-members.ts', newContent);
console.log(`Added ${tofinoMembers.length} Tofino members and ${campbellRiverMembers.length} Campbell River members`);

// Verify member count
const newFileContent = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const tofinoCount = (newFileContent.match(/chamberId: "tofino-chamber"/g) || []).length;
const crCount = (newFileContent.match(/chamberId: "campbell-river-chamber"/g) || []).length;
console.log(`Verification - Tofino: ${tofinoCount}, Campbell River: ${crCount}`);
