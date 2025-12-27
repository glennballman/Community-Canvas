/**
 * Parse the raw scraped content from Saanich Peninsula Chamber directory
 * Extract member data from the markdown format
 */

const fs = require('fs');

// Read the raw content
const rawContent = fs.readFileSync('scripts/saanich-peninsula-raw.txt', 'utf8');

// Parse member entries using the link pattern
const memberPattern = /\[(?:!\[[^\]]*\]\([^)]+\))?\\*\\*([^\\]+)\\*\\*.*?\]\(https:\/\/peninsulachamber\.ca\/directory\/#!biz\/id\/([a-f0-9]+)\)/gm;

// Alternative pattern for members without images
const simplePattern = /\[([^\[]+?)\\n\\n([^\]]*?)\]\(https:\/\/peninsulachamber\.ca\/directory\/#!biz\/id\/([a-f0-9]+)\)/gm;

const members = [];
const seenIds = new Set();

// Try to extract using the pattern from the raw content
const lines = rawContent.split(/\]\s*\[/);

for (const block of lines) {
  // Try to extract member ID from the link
  const idMatch = block.match(/biz\/id\/([a-f0-9]{24})/);
  if (idMatch && !seenIds.has(idMatch[1])) {
    seenIds.add(idMatch[1]);
    
    // Extract name - usually the first line before address
    const parts = block.split('\\n\\n').map(p => p.trim()).filter(p => p);
    let name = '';
    let address = '';
    let website = '';
    let phone = '';
    
    for (const part of parts) {
      // Skip image tags
      if (part.startsWith('![')) continue;
      
      // Phone pattern
      if (/^[\d\s\-\(\)\.]+$/.test(part) && part.replace(/\D/g, '').length >= 10) {
        phone = part;
        continue;
      }
      
      // Website pattern
      if (part.startsWith('http')) {
        website = part;
        continue;
      }
      
      // First non-image text is usually the name
      if (!name) {
        name = part.replace(/\*\*/g, '');
        continue;
      }
      
      // Address comes after name
      if (!address && !part.startsWith('http')) {
        address = part;
      }
    }
    
    if (name && name.length > 1) {
      members.push({
        id: idMatch[1],
        name: name,
        address: address,
        website: website,
        phone: phone
      });
    }
  }
}

console.log("=".repeat(70));
console.log("Parsed Saanich Peninsula Chamber Members");
console.log("=".repeat(70));
console.log(`Found ${members.length} unique members from scraped content\n`);

// Save results
fs.writeFileSync('scripts/saanich-peninsula-parsed.json', JSON.stringify(members, null, 2));

// Show sample
console.log("Sample members:");
members.slice(0, 20).forEach((m, i) => {
  console.log(`${i+1}. ${m.name}`);
  if (m.address) console.log(`   Address: ${m.address}`);
  if (m.phone) console.log(`   Phone: ${m.phone}`);
});
