const fs = require('fs');

// Load integration data
const members = JSON.parse(fs.readFileSync('scripts/parksville-integration.json', 'utf8'));
console.log(`Adding ${members.length} Parksville members...`);

// Read current file
const content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find line 80072 which has the ]; closing the array
const lines = content.split('\n');
const insertLineNum = 80071; // Insert before the ];

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

// Insert after line 80071 (before the ];)
const before = lines.slice(0, insertLineNum);
const after = lines.slice(insertLineNum);

const newLines = [
  ...before,
  '  // Parksville & District Chamber of Commerce (307 members, 86% coverage)',
  entries + ','
];
const newContent = newLines.join('\n') + '\n' + after.join('\n');

fs.writeFileSync('shared/chamber-members.ts', newContent);
console.log('Done! Added Parksville members.');

// Verify
const updated = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const count = (updated.match(/"parksville-chamber"/g) || []).length;
console.log(`Total Parksville entries now: ${count}`);
