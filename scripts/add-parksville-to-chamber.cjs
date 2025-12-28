const fs = require('fs');

// Load integration data
const members = JSON.parse(fs.readFileSync('scripts/parksville-integration.json', 'utf8'));
console.log(`Adding ${members.length} Parksville members...`);

// Read current file
const content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find the closing of chamberMembers array (the ];)
const endMarker = '] as const satisfies ChamberMember[];';
const insertPoint = content.lastIndexOf(endMarker);

if (insertPoint === -1) {
  console.error('Could not find insertion point');
  process.exit(1);
}

// Generate member entries
const entries = members.map(m => {
  // Escape any quotes in strings
  const name = m.name.replace(/"/g, '\\"');
  const desc = (m.description || '').replace(/"/g, '\\"').substring(0, 200);
  const addr = (m.address || '').replace(/"/g, '\\"');
  
  return `  {
    id: "${m.id}",
    chamberId: "parksville-chamber",
    name: "${name}",
    category: "${m.category}",
    naicsCode: "${m.naicsCode}",
    naicsDescription: "${m.naicsDescription}",
    address: "${addr}",
    phone: "${m.phone || ''}",
    website: "${m.website || ''}",
    description: "${desc}"
  }`;
}).join(',\n');

// Insert before the end marker
const newContent = content.substring(0, insertPoint) + 
  '\n  // Parksville & District Chamber of Commerce (307 members, 86% coverage)\n' +
  entries + ',\n' +
  content.substring(insertPoint);

fs.writeFileSync('shared/chamber-members.ts', newContent);
console.log('Done! Added Parksville members.');

// Verify
const updated = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const count = (updated.match(/"parksville-chamber"/g) || []).length;
console.log(`Total Parksville entries now: ${count}`);
