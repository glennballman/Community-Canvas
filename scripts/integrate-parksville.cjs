const fs = require('fs');

const members = JSON.parse(fs.readFileSync('scripts/parksville-integration.json', 'utf8'));
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

const insertPoint = content.lastIndexOf('\n];');
if (insertPoint === -1) {
  console.error('Could not find insertion point');
  process.exit(1);
}

let entries = '\n  // ==========================================================================\n';
entries += '  // PARKSVILLE & DISTRICT CHAMBER OF COMMERCE\n';
entries += '  // ==========================================================================\n';

members.forEach((m, i) => {
  const id = `parksville-member-${String(i + 1).padStart(3, '0')}`;
  
  entries += `  {
    id: "${id}",
    chamberId: "parksville-chamber",
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
    municipality: "${m.municipality}",
    region: "${m.region}",
    memberSince: 2024,
  },\n`;
});

const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + entries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('Added', members.length, 'Parksville members');
console.log('Total members now:', totalAfter);
