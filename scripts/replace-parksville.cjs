const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find and remove existing Parksville section
const parksvilleStart = content.indexOf('// PARKSVILLE & DISTRICT CHAMBER OF COMMERCE');
if (parksvilleStart === -1) {
  console.log('Parksville section not found, will append');
} else {
  // Find the end of Parksville section (next chamber header or end of array)
  const afterStart = content.slice(parksvilleStart);
  const nextSection = afterStart.indexOf('\n  // =========', 100);
  const endOfArray = afterStart.indexOf('\n];');
  
  let endPos;
  if (nextSection !== -1 && (endOfArray === -1 || nextSection < endOfArray)) {
    endPos = parksvilleStart + nextSection;
  } else {
    endPos = parksvilleStart + endOfArray;
  }
  
  content = content.slice(0, parksvilleStart) + content.slice(endPos);
  console.log('Removed existing Parksville section');
}

// Now add the cleaned data
const members = JSON.parse(fs.readFileSync('scripts/parksville-integration.json', 'utf8'));
const insertPoint = content.lastIndexOf('\n];');

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
    region: "Vancouver Island",
    memberSince: 2024,
  },\n`;
});

const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + entries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('Replaced with', members.length, 'cleaned Parksville members');
console.log('Total members now:', totalAfter);
