const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Fix pattern 1: inner object closes but outer doesn't before next entry
// Pattern: `    },\n  {` should be `    },\n  },\n  {`
content = content.replace(/(\n    },)(\n  \{)/g, '$1\n  },$2');

// Fix pattern 2: when we removed a closing brace incorrectly
// Look for `},\n  {` where the first }, is at 4-space indent - need to add 2-space },
// Actually the above regex already handles this

fs.writeFileSync('shared/chamber-members.ts', content);
console.log('Fixed file');

// Verify by trying to count valid entries
const matches = content.match(/chamberId:/g);
console.log('Chamber entries found:', matches ? matches.length : 0);
