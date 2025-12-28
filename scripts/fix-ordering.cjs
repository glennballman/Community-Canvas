const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find pattern: (blank/comment lines)  },\n  {
// And change to:   },\n(blank/comment lines)  {

// Pattern: captures comments/blanks, then },, then  {
const pattern = /(\n(?:\s*\n|\s*\/\/[^\n]*\n)+)(  },\n)(  \{)/g;

content = content.replace(pattern, (match, commentsOrBlanks, closing, opening) => {
  return '\n  },' + commentsOrBlanks + opening;
});

fs.writeFileSync('shared/chamber-members.ts', content);
console.log('Ordering fix applied');
