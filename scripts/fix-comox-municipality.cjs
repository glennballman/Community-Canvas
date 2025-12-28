const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find Comox Valley member entries and update municipality
// Match patterns like municipality: "Courtenay", in comox-valley-member sections
const lines = content.split('\n');
let inComoxSection = false;
const output = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect start of Comox Valley section
  if (line.includes('COMOX VALLEY CHAMBER OF COMMERCE')) {
    inComoxSection = true;
  }
  
  // Detect end of section (next section header or end of array)
  if (inComoxSection && (line.includes('=====') && !line.includes('COMOX VALLEY')) || line.includes('] as const')) {
    inComoxSection = false;
  }
  
  // Fix municipality in Comox section
  if (inComoxSection && line.includes('municipality: "Courtenay"')) {
    output.push(line.replace('municipality: "Courtenay"', 'municipality: "Comox Valley"'));
  } else {
    output.push(line);
  }
}

fs.writeFileSync('shared/chamber-members.ts', output.join('\n'));

// Verify
const fixed = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const courtenayCount = (fixed.match(/comox-valley-member.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*municipality: "Courtenay"/g) || []).length;
const comoxValleyCount = (fixed.match(/comox-valley-member.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*municipality: "Comox Valley"/g) || []).length;

console.log('Remaining "Courtenay" in Comox members:', courtenayCount);
console.log('"Comox Valley" in Comox members:', comoxValleyCount);
