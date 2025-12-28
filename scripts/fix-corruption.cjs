const fs = require('fs');

let lines = fs.readFileSync('shared/chamber-members.ts', 'utf8').split('\n');
const originalLength = lines.length;

// Find and remove lines that are just "  }," or "  }" when preceded by another closing brace
const toRemove = new Set();
for (let i = 1; i < lines.length; i++) {
  const current = lines[i].trim();
  const prev = lines[i-1].trim();
  
  // If current line is just },  and previous line was also },
  if ((current === '},' || current === '}') && (prev === '},' || prev === '}')) {
    toRemove.add(i);
    console.log(`Removing orphan brace at line ${i + 1}`);
  }
  
  // Also remove empty lines between consecutive closing braces
  if (current === '' && i > 1) {
    const prevNonEmpty = lines.slice(0, i).reverse().find(l => l.trim() !== '');
    const nextNonEmpty = lines.slice(i + 1).find(l => l.trim() !== '');
    if (prevNonEmpty && nextNonEmpty) {
      if ((prevNonEmpty.trim() === '},' || prevNonEmpty.trim() === '}') &&
          (nextNonEmpty.trim() === '},' || nextNonEmpty.trim() === '}')) {
        // This empty line is between two closing braces - suspicious
      }
    }
  }
}

// Remove identified lines
const newLines = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync('shared/chamber-members.ts', newLines.join('\n'));

console.log(`\nRemoved ${toRemove.size} corrupted lines`);
console.log(`File: ${originalLength} -> ${newLines.length} lines`);
