const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find and remove existing Parksville section
const parksvilleStart = content.indexOf('// PARKSVILLE & DISTRICT CHAMBER OF COMMERCE');
if (parksvilleStart === -1) {
  console.log('Parksville section not found');
  process.exit(0);
}

// Find the end of Parksville section
const beforeSection = content.lastIndexOf('\n  // =====', parksvilleStart - 1);
const startPos = beforeSection !== -1 ? beforeSection + 1 : parksvilleStart;

const afterStart = content.slice(parksvilleStart);
const nextSection = afterStart.indexOf('\n  // =========', 100);
const endOfArray = afterStart.indexOf('\n];');

let endPos;
if (nextSection !== -1 && (endOfArray === -1 || nextSection < endOfArray)) {
  endPos = parksvilleStart + nextSection;
} else {
  endPos = parksvilleStart + endOfArray;
}

content = content.slice(0, startPos) + content.slice(endPos);
fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('Removed Parksville section');
console.log('Total members now:', totalAfter);
