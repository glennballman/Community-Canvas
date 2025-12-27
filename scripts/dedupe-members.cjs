const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find all member entries and track by ID
const entryPattern = /  \{[\s\S]*?id: "([^"]+)"[\s\S]*?chamberId: "([^"]+)"[\s\S]*?businessName: "([^"]+)"[\s\S]*?\},?/g;

const seen = new Map();
const duplicateRanges = [];

let match;
while ((match = entryPattern.exec(content)) !== null) {
  const key = `${match[2]}:${match[3]}`; // chamberId:businessName
  if (seen.has(key)) {
    // This is a duplicate
    duplicateRanges.push({
      start: match.index,
      end: match.index + match[0].length,
      businessName: match[3]
    });
  } else {
    seen.set(key, match.index);
  }
}

console.log(`Found ${duplicateRanges.length} duplicate entries`);

// Remove duplicates from the end (to preserve indices)
duplicateRanges.reverse().forEach(range => {
  content = content.slice(0, range.start) + content.slice(range.end);
});

fs.writeFileSync('shared/chamber-members.ts', content);

// Verify
const newContent = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const chambers = [
  'greater-victoria-chamber',
  'duncan-cowichan-chamber', 
  'westshore-chamber',
  'saanich-peninsula-chamber',
  'pender-island-chamber',
  'tofino-chamber',
  'campbell-river-chamber'
];
console.log('\nAfter deduplication:');
let total = 0;
chambers.forEach(c => {
  const count = (newContent.match(new RegExp('chamberId: "' + c + '"', 'g')) || []).length;
  console.log('  ' + c + ': ' + count);
  total += count;
});
console.log('\nTotal: ' + total);
