const fs = require('fs');

// Load integration files
const saanich = JSON.parse(fs.readFileSync('scripts/saanich-final-integration.json', 'utf8'));
const pender = JSON.parse(fs.readFileSync('scripts/pender-integration.json', 'utf8'));
const campbell = JSON.parse(fs.readFileSync('scripts/campbell-river-integration.json', 'utf8'));
const tofino = JSON.parse(fs.readFileSync('scripts/tofino-integration.json', 'utf8'));

console.log('Saanich members:', saanich.length);
console.log('Pender members:', pender.length);
console.log('Campbell River members:', campbell.length);
console.log('Tofino members:', tofino.length);

// Read current file
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find where to insert (before the closing bracket)
const insertPoint = content.indexOf('] as const satisfies readonly ChamberMember[];');

if (insertPoint === -1) {
  console.log('Could not find insertion point');
  process.exit(1);
}

// Generate entries for each chamber
function generateEntries(members, chamberId, prefix) {
  let entries = '';
  members.forEach((m, i) => {
    const id = `${prefix}-${String(i + 1).padStart(3, '0')}`;
    entries += `  {
    id: "${id}",
    chamberId: "${chamberId}",
    businessName: ${JSON.stringify(m.businessName)},
    category: "${m.category}",
    subcategory: ${m.subcategory ? JSON.stringify(m.subcategory) : 'undefined'},
    description: ${m.description ? JSON.stringify(m.description) : 'undefined'},
    website: ${m.website ? JSON.stringify(m.website) : 'undefined'},
    phone: ${m.phone ? JSON.stringify(m.phone) : 'undefined'},
    email: ${m.email ? JSON.stringify(m.email) : 'undefined'},
    address: ${m.address ? JSON.stringify(m.address) : 'undefined'},
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: ${JSON.stringify(m.municipality)},
    region: ${JSON.stringify(m.region)},
    memberSince: ${m.memberSince || 2024},
  },\n`;
  });
  return entries;
}

// Build new entries
let newEntries = '\n  // ==========================================================================\n';
newEntries += '  // RE-INTEGRATED CHAMBERS (from saved integration files)\n';
newEntries += '  // ==========================================================================\n\n';

// Add Saanich Peninsula
newEntries += '  // SAANICH PENINSULA CHAMBER\n';
newEntries += generateEntries(saanich, 'saanich-peninsula-chamber', 'saanich-member');

// Add Pender Island
newEntries += '\n  // PENDER ISLAND CHAMBER\n';
newEntries += generateEntries(pender, 'pender-island-chamber', 'pender-member');

// Add Campbell River (only add if more than 3 already there)
const existingCampbell = (content.match(/campbell-river-chamber/g) || []).length;
if (existingCampbell < 50) {
  newEntries += '\n  // CAMPBELL RIVER & DISTRICT CHAMBER\n';
  newEntries += generateEntries(campbell, 'campbell-river-chamber', 'campbell-river-member');
}

// Add Tofino (only add new ones if less than 400 exist)
const existingTofino = (content.match(/tofino-chamber/g) || []).length;
if (existingTofino < 400) {
  newEntries += '\n  // TOFINO-LONG BEACH CHAMBER (ADDITIONAL)\n';
  // Get existing tofino member IDs to avoid duplicates
  const tofinoIds = new Set();
  const idMatches = content.matchAll(/id: "(tofino-member-\d+)"/g);
  for (const match of idMatches) {
    tofinoIds.add(match[1]);
  }
  
  // Only add members not already present
  const newTofino = tofino.filter((m, i) => !tofinoIds.has(`tofino-member-${String(i + 1).padStart(3, '0')}`));
  if (newTofino.length > 0) {
    const startNum = tofinoIds.size + 1;
    newTofino.forEach((m, i) => {
      const id = `tofino-member-${String(startNum + i).padStart(3, '0')}`;
      newEntries += `  {
    id: "${id}",
    chamberId: "tofino-chamber",
    businessName: ${JSON.stringify(m.businessName)},
    category: "${m.category}",
    subcategory: ${m.subcategory ? JSON.stringify(m.subcategory) : 'undefined'},
    description: ${m.description ? JSON.stringify(m.description) : 'undefined'},
    website: ${m.website ? JSON.stringify(m.website) : 'undefined'},
    phone: ${m.phone ? JSON.stringify(m.phone) : 'undefined'},
    email: ${m.email ? JSON.stringify(m.email) : 'undefined'},
    address: ${m.address ? JSON.stringify(m.address) : 'undefined'},
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: ${JSON.stringify(m.municipality)},
    region: ${JSON.stringify(m.region)},
    memberSince: ${m.memberSince || 2024},
  },\n`;
    });
  }
}

// Insert before the closing bracket
const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + newEntries + after;

// Write back
fs.writeFileSync('shared/chamber-members.ts', content);
console.log('Re-integration complete');
