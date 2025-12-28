const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Fix new WestShore entries: change region from "Capital Regional District" to "Capital"
// Only for entries with chamberId: "westshore-chamber"
content = content.replace(
  /chamberId: "westshore-chamber",\n([^}]+?)region: "Capital Regional District",/g,
  'chamberId: "westshore-chamber",\n$1region: "Capital",'
);

// Also fix the two legacy entries
content = content.replace(
  /id: "westshore-coc-member-001"[\s\S]*?municipality: "Langford",/,
  function(match) {
    return match.replace('municipality: "Langford",', 'municipality: "West Shore",');
  }
);

content = content.replace(
  /id: "westshore-coc-member-002"[\s\S]*?municipality: "Colwood",/,
  function(match) {
    return match.replace('municipality: "Colwood",', 'municipality: "West Shore",');
  }
);

fs.writeFileSync('shared/chamber-members.ts', content);

// Verify
const capitalRegionalCount = (content.match(/region: "Capital Regional District"/g) || []).length;
const capitalCount = (content.match(/region: "Capital"/g) || []).length;
const westShoreCount = (content.match(/municipality: "West Shore"/g) || []).length;

console.log('Entries with region "Capital Regional District":', capitalRegionalCount);
console.log('Entries with region "Capital":', capitalCount);
console.log('Entries with municipality "West Shore":', westShoreCount);
