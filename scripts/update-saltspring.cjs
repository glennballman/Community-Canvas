const fs = require('fs');

const mergedData = JSON.parse(fs.readFileSync('scripts/saltspring-merged.json', 'utf8'));
console.log('Merged Salt Spring members:', mergedData.length);

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find and remove existing Salt Spring section
const sectionStart = content.indexOf('// ==========================================================================\n  // SALT SPRING ISLAND CHAMBER OF COMMERCE');
if (sectionStart === -1) {
  console.error('Could not find existing Salt Spring section');
  process.exit(1);
}

// Find the end of the section (next section header or end of array)
let sectionEnd = content.indexOf('// ==========================================================================', sectionStart + 100);
if (sectionEnd === -1) {
  sectionEnd = content.indexOf('] as const satisfies readonly ChamberMember[];');
}

// Remove existing section
const before = content.slice(0, sectionStart);
const after = content.slice(sectionEnd);

// Create new section with all 138 members
let entries = '// ==========================================================================\n';
entries += '  // SALT SPRING ISLAND CHAMBER OF COMMERCE\n';
entries += '  // ==========================================================================\n';

mergedData.forEach((m, i) => {
  const id = `salt-spring-member-${String(i + 1).padStart(3, '0')}`;
  entries += `  {
    id: "${id}",
    chamberId: "salt-spring-chamber",
    businessName: ${JSON.stringify(m.businessName)},
    category: "${m.category}",
    subcategory: undefined,
    description: undefined,
    website: ${m.website ? JSON.stringify(m.website) : 'undefined'},
    phone: undefined,
    email: undefined,
    address: undefined,
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: "Salt Spring Island",
    region: "Capital",
    memberSince: 2024,
  },\n`;
});

// Combine
content = before + entries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

// Count totals
const totalMembers = (content.match(/chamberId:/g) || []).length;
const saltSpringCount = (content.match(/chamberId: "salt-spring-chamber"/g) || []).length;

console.log('Salt Spring members now:', saltSpringCount);
console.log('Total members:', totalMembers);
