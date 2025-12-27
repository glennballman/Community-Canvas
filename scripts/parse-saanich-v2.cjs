/**
 * Parse Saanich Peninsula Chamber members from raw scraped content
 * Better parsing of the MembershipWorks markdown format
 */

const fs = require('fs');

const rawContent = fs.readFileSync('scripts/saanich-peninsula-raw.txt', 'utf8');

// Find all biz/id links and extract data around them
const bizIdPattern = /biz\/id\/([a-f0-9]{24})/g;
const allIds = [];
let match;
while ((match = bizIdPattern.exec(rawContent)) !== null) {
  if (!allIds.includes(match[1])) {
    allIds.push(match[1]);
  }
}

console.log(`Found ${allIds.length} unique member IDs in raw content`);

// Now parse each member entry - they follow a pattern in the markdown
// Format: [optional-image]\n\nBusiness Name\n\nAddress\n\nWebsite\n\nPhone](link)
const members = [];

// Split by the link pattern to get chunks
const chunks = rawContent.split(/\]\(https:\/\/peninsulachamber\.ca\/directory\/#!biz\/id\/[a-f0-9]{24}\)/);

for (let i = 0; i < chunks.length - 1; i++) {
  const chunk = chunks[i];
  
  // Get the last markdown link portion - it contains member data
  const linkStart = chunk.lastIndexOf('[');
  if (linkStart === -1) continue;
  
  const memberData = chunk.substring(linkStart + 1);
  
  // Split by \\n\\n to get fields
  const fields = memberData.split(/\\n\\n|\\\\n\\\\n/).map(f => f.trim()).filter(f => f);
  
  let name = '';
  let address = '';
  let website = '';
  let phone = '';
  
  for (const field of fields) {
    // Skip image markdown
    if (field.startsWith('![') || field.startsWith('[![')) continue;
    
    // Website
    if (field.startsWith('http://') || field.startsWith('https://')) {
      website = field;
      continue;
    }
    
    // Phone - various formats
    const phoneMatch = field.match(/^[+]?[\d\s\-\(\)\.]{10,}$/);
    if (phoneMatch) {
      phone = field;
      continue;
    }
    
    // First text field is typically the name
    if (!name) {
      name = field.replace(/^\*\*/, '').replace(/\*\*$/, '');
      continue;
    }
    
    // Address comes after name
    if (!address) {
      address = field;
    }
  }
  
  // Extract the ID from what comes after this chunk
  const nextPart = rawContent.substring(rawContent.indexOf(chunks[i]) + chunks[i].length);
  const idMatch = nextPart.match(/biz\/id\/([a-f0-9]{24})/);
  
  if (name && name.length > 2 && idMatch) {
    members.push({
      id: idMatch[1],
      name: name,
      address: address,
      website: website,
      phone: phone
    });
  }
}

console.log(`\nParsed ${members.length} members\n`);

// Dedupe by name
const uniqueMembers = [];
const seenNames = new Set();
for (const m of members) {
  const normName = m.name.toLowerCase().trim();
  if (!seenNames.has(normName)) {
    seenNames.add(normName);
    uniqueMembers.push(m);
  }
}

console.log(`Unique members after dedup: ${uniqueMembers.length}\n`);

// Show first 25
console.log("First 25 members:");
uniqueMembers.slice(0, 25).forEach((m, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${m.name}`);
  if (m.address) console.log(`    Address: ${m.address}`);
});

// Save
fs.writeFileSync('scripts/saanich-peninsula-parsed.json', JSON.stringify(uniqueMembers, null, 2));
console.log("\nSaved to scripts/saanich-peninsula-parsed.json");
