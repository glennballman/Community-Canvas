const fs = require('fs');

const members = JSON.parse(fs.readFileSync('scripts/comox-integration.json', 'utf8'));
console.log('Comox Valley members to integrate:', members.length);

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Check for existing
const existingCount = (content.match(/comox-valley-chamber/g) || []).length;
console.log('Existing Comox Valley members:', existingCount);

if (existingCount > 50) {
  console.log('Already integrated, skipping');
  process.exit(0);
}

// Find insertion point
const insertPoint = content.indexOf('] as const satisfies readonly ChamberMember[];');
if (insertPoint === -1) {
  console.error('Could not find insertion point');
  process.exit(1);
}

let entries = '\n  // ==========================================================================\n';
entries += '  // COMOX VALLEY CHAMBER OF COMMERCE\n';
entries += '  // ==========================================================================\n';

members.forEach((m, i) => {
  const id = `comox-valley-member-${String(i + 1).padStart(3, '0')}`;
  entries += `  {
    id: "${id}",
    chamberId: "comox-valley-chamber",
    businessName: ${JSON.stringify(m.businessName)},
    category: "${m.category}",
    subcategory: undefined,
    description: undefined,
    website: undefined,
    phone: undefined,
    email: undefined,
    address: undefined,
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: "Courtenay",
    region: "Comox Valley Regional District",
    memberSince: 2024,
  },\n`;
});

// Insert
const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + entries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('Total members after integration:', totalAfter);
