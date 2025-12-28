const fs = require('fs');

let lines = fs.readFileSync('shared/chamber-members.ts', 'utf8').split('\n');
const fixedLines = [];
let lastNonEmptyLine = '';
let lastNonEmptyIdx = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Check if this is start of array element (2-space indent {)
  if (line === '  {') {
    // Find previous non-empty, non-comment line
    let prevIdx = i - 1;
    while (prevIdx >= 0 && (lines[prevIdx].trim() === '' || lines[prevIdx].trim().startsWith('//'))) {
      prevIdx--;
    }
    
    if (prevIdx >= 0) {
      const prevLine = lines[prevIdx];
      const prevTrimmed = prevLine.trim();
      
      // If previous line is an inner object close (4+ spaces) but not outer object close
      if (prevLine.match(/^    /) && (prevTrimmed === '},' || prevTrimmed === '}')) {
        // Need to add outer object close before this line
        // Insert after comments/empty lines
        fixedLines.push('  },');
      }
      // If previous line is already },  at 2-space indent, we're good
      // If previous line is something else, we might be missing the close
      else if (!prevLine.match(/^  },/) && !prevTrimmed.startsWith('//') && prevTrimmed !== '[') {
        // Check if we're right after a comment block  
        if (!lines[prevIdx].includes('//')) {
          fixedLines.push('  },');
        }
      }
    }
  }
  
  fixedLines.push(line);
}

fs.writeFileSync('shared/chamber-members.ts', fixedLines.join('\n'));
console.log('Comprehensive fix applied');
