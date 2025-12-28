const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');
let lines = content.split('\n');

// Fix: When we see a line that's just `  {` and the previous non-empty line ends with `},`
// that's for a nested object. But if the previous non-empty line is just `},` (a closing
// of a nested object), and we see `  {` (start of array element), we need to add `},`

const fixedLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  if (trimmed === '{' && line.match(/^  \{$/)) {
    // This is start of an array element (2-space indent)
    // Check if previous non-empty line properly closes an object
    let prevIdx = i - 1;
    while (prevIdx >= 0 && lines[prevIdx].trim() === '') prevIdx--;
    
    if (prevIdx >= 0) {
      const prevLine = lines[prevIdx];
      const prevTrimmed = prevLine.trim();
      
      // If previous line is `},` (4-space - inner object close) without outer object close
      if (prevLine.match(/^    },?$/) && !prevLine.endsWith('},')) {
        // Need to add the outer object close
        fixedLines.push('  },');
      } else if (prevTrimmed === '},' && prevLine.match(/^    /)) {
        // Previous line closes an inner object but doesn't close outer
        fixedLines.push('  },');
      }
    }
  }
  
  fixedLines.push(line);
}

fs.writeFileSync('shared/chamber-members.ts', fixedLines.join('\n'));
console.log('Fixed structure');
