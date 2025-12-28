const fs = require('fs');

// Load classified members
const members = JSON.parse(fs.readFileSync('scripts/nanaimo-classified.json', 'utf8'));
console.log('Nanaimo members to integrate:', members.length);

// Read current file
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Check how many Nanaimo members already exist
const existingCount = (content.match(/greater-nanaimo-chamber/g) || []).length;
console.log('Existing Nanaimo members:', existingCount);

if (existingCount >= 100) {
  console.log('Already have enough Nanaimo members, skipping');
  process.exit(0);
}

// Find insertion point
const insertPoint = content.indexOf('] as const satisfies readonly ChamberMember[];');
if (insertPoint === -1) {
  console.error('Could not find insertion point');
  process.exit(1);
}

// Generate entries
let entries = '\n  // ==========================================================================\n';
entries += '  // GREATER NANAIMO CHAMBER OF COMMERCE\n';
entries += '  // Scraped from nanaimochamber.chambermaster.com A-Z directory\n';
entries += '  // ==========================================================================\n\n';

members.forEach((m, i) => {
  const id = `nanaimo-member-${String(i + 1).padStart(3, '0')}`;
  entries += `  {
    id: "${id}",
    chamberId: "greater-nanaimo-chamber",
    businessName: ${JSON.stringify(m.businessName)},
    category: "${m.category}",
    subcategory: undefined,
    description: undefined,
    website: ${m.website ? JSON.stringify(m.website) : 'undefined'},
    phone: ${m.phone ? JSON.stringify(m.phone) : 'undefined'},
    email: undefined,
    address: ${m.address ? JSON.stringify(m.address) : 'undefined'},
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: "Nanaimo",
    region: "Nanaimo Regional District",
    memberSince: 2024,
  },\n`;
});

// Insert before the closing bracket
const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + entries + after;

fs.writeFileSync('shared/chamber-members.ts', content);
console.log('Integration complete!');

// Verify
const newCount = (content.match(/greater-nanaimo-chamber/g) || []).length;
console.log('New Nanaimo member count:', newCount);
