const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Split into array entries
// Each entry starts with "  {" and ends with "  },"
// We need to identify and remove entries with the legacy IDs

// Pattern to match legacy Salt Spring entries
const legacyPatterns = [
  /\s*\{\s*id:\s*"saltspring-coc-member-\d+",[\s\S]*?memberSince:\s*\d+,\s*\},?/g,
  /\s*\{\s*id:\s*"saltspring-member-\d+",[\s\S]*?memberSince:\s*\d+,\s*\},?/g
];

let removed = 0;
for (const pattern of legacyPatterns) {
  const matches = content.match(pattern) || [];
  removed += matches.length;
  content = content.replace(pattern, '');
}

console.log('Removed legacy entries:', removed);

// Clean up any double newlines
content = content.replace(/\n\n\n+/g, '\n\n');

fs.writeFileSync('shared/chamber-members.ts', content);

// Verify counts
const saltSpringCount = (content.match(/chamberId: "salt-spring-chamber"/g) || []).length;
const totalMembers = (content.match(/chamberId:/g) || []).length;

console.log('Salt Spring members now:', saltSpringCount);
console.log('Total members:', totalMembers);
