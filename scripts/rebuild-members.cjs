const fs = require('fs');

const content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Extract header (everything before the array starts)
const headerMatch = content.match(/^([\s\S]*?export const chamberMembers = \[)/);
if (!headerMatch) {
  console.log('Could not find header');
  process.exit(1);
}
const header = headerMatch[1];
console.log('Header extracted, length:', header.length);

// Extract footer (helper functions at the end)
const footerMatch = content.match(/(\/\/ Helper function to get members by chamber[\s\S]*$)/);
if (!footerMatch) {
  console.log('Could not find footer');
  process.exit(1);
}
const footer = footerMatch[1];
console.log('Footer extracted, length:', footer.length);

// Now extract all valid member entries
// A valid entry has: id, chamberId, businessName, category, municipality, region
const entries = [];
const entryRegex = /\{\s*id:\s*"([^"]+)"[\s\S]*?chamberId:\s*"([^"]+)"[\s\S]*?businessName:\s*"([^"]+)"[\s\S]*?municipality:\s*"([^"]+)"[\s\S]*?region:\s*"([^"]+)"/g;

let match;
let lastIndex = 0;
while ((match = entryRegex.exec(content)) !== null) {
  // Find the full entry block
  const startIdx = content.lastIndexOf('{', match.index);
  
  // Find matching closing brace
  let braceCount = 0;
  let endIdx = startIdx;
  let inString = false;
  let escape = false;
  
  for (let i = startIdx; i < content.length; i++) {
    const char = content[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
  }
  
  if (endIdx > startIdx) {
    const entry = content.slice(startIdx, endIdx);
    entries.push({
      id: match[1],
      chamberId: match[2],
      businessName: match[3],
      content: entry
    });
  }
}

console.log('Found', entries.length, 'entries');

// Deduplicate by id + chamberId + businessName
const seen = new Set();
const uniqueEntries = entries.filter(e => {
  const key = `${e.chamberId}:${e.businessName}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log('Unique entries:', uniqueEntries.length);

// Group by chamber for organization
const byChamberId = {};
uniqueEntries.forEach(e => {
  if (!byChamberId[e.chamberId]) byChamberId[e.chamberId] = [];
  byChamberId[e.chamberId].push(e);
});

console.log('Chambers:', Object.keys(byChamberId).length);

// Rebuild the file
let output = header + '\n';

// Chamber order
const chamberOrder = [
  'greater-vancouver-board-of-trade',
  'burnaby-board-of-trade',
  'surrey-white-rock-board-of-trade',
  'greater-victoria-chamber',
  'duncan-cowichan-chamber',
  'westshore-chamber',
  'saanich-peninsula-chamber',
  'pender-island-chamber',
  'tofino-chamber',
  'campbell-river-chamber'
];

// Add known chambers in order
for (const chamberId of chamberOrder) {
  if (byChamberId[chamberId]) {
    output += `  // ${chamberId.replace(/-/g, ' ').toUpperCase()}\n`;
    byChamberId[chamberId].forEach((e, i) => {
      output += '  ' + e.content;
      output += ',\n';
    });
    delete byChamberId[chamberId];
  }
}

// Add remaining chambers
for (const chamberId of Object.keys(byChamberId).sort()) {
  output += `  // ${chamberId.replace(/-/g, ' ').toUpperCase()}\n`;
  byChamberId[chamberId].forEach((e, i) => {
    output += '  ' + e.content;
    output += ',\n';
  });
}

// Remove trailing comma and close array
output = output.slice(0, -2) + '\n] as const satisfies readonly ChamberMember[];\n\n';

// Add footer
output += footer;

fs.writeFileSync('shared/chamber-members.ts', output);
console.log('File rebuilt successfully');
