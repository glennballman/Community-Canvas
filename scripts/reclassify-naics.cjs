/**
 * Reclassify NAICS codes using the layered classifier
 * Run with: node scripts/reclassify-naics.cjs
 */

const fs = require('fs');
const path = require('path');

// Business name patterns for marine reclassification
const namePatterns = [
  { pattern: /\bPort of\b/i, code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  { pattern: /\bPort Authority\b/i, code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  { pattern: /Harbour Authority/i, code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  { pattern: /Harbor Authority/i, code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  { pattern: /\bFerry\b/i, code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
  { pattern: /\bSeabus\b/i, code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
  { pattern: /Lady Rose Marine/i, code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
  { pattern: /Water Taxi/i, code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" },
  { pattern: /\bMarina\b/i, code: "713930", subsector: "713", sector: "71", title: "Marinas" },
  { pattern: /Yacht Club/i, code: "713930", subsector: "713", sector: "71", title: "Marinas" },
  { pattern: /Marine.*Ventures/i, code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" },
  { pattern: /Harbour.*Ventures/i, code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" },
  { pattern: /Breakers Marine/i, code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" },
  { pattern: /Shipyard/i, code: "336611", subsector: "336", sector: "31-33", title: "Ship Building and Repairing" },
  { pattern: /Seafood/i, code: "311710", subsector: "311", sector: "31-33", title: "Seafood Product Preparation and Packaging" },
  { pattern: /Fish.*Market/i, code: "445220", subsector: "445", sector: "44-45", title: "Fish and Seafood Markets" },
  { pattern: /Landing.*Authority/i, code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  { pattern: /Sidney.*Landing/i, code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" },
  { pattern: /Apex.*Pacific/i, code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" },
];

const filePath = path.join(__dirname, '../shared/chamber-members.ts');
let content = fs.readFileSync(filePath, 'utf-8');

let fixes = 0;

// For each pattern, find matching businessName entries with fishing-marine category
for (const { pattern, code, subsector, sector, title } of namePatterns) {
  // Build regex to find the member block with this business name
  const businessNameMatch = content.match(new RegExp(`businessName:\\s*"([^"]*${pattern.source}[^"]*)"`, 'gi'));
  
  if (businessNameMatch) {
    for (const match of businessNameMatch) {
      const nameExtract = match.match(/businessName:\s*"([^"]+)"/);
      if (!nameExtract) continue;
      const businessName = nameExtract[1];
      
      // Find the full member block containing this business name
      const memberBlockRegex = new RegExp(
        `(\\{[^{}]*businessName:\\s*"${businessName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^{}]*category:\\s*"fishing-marine"[^{}]*)naicsCode:\\s*"[^"]+"([^{}]*)naicsSubsector:\\s*"[^"]+"([^{}]*)naicsSector:\\s*"[^"]+"([^{}]*)naicsTitle:\\s*"[^"]+"`,
        'g'
      );
      
      if (memberBlockRegex.test(content)) {
        content = content.replace(memberBlockRegex, 
          `$1naicsCode: "${code}"$2naicsSubsector: "${subsector}"$3naicsSector: "${sector}"$4naicsTitle: "${title}"`
        );
        console.log(`Fixed: ${businessName} -> ${title}`);
        fixes++;
      }
    }
  }
}

fs.writeFileSync(filePath, content);

// Verify remaining fishing-marine with 114
const remaining = (content.match(/category:\s*"fishing-marine"[\s\S]*?naicsSubsector:\s*"114"/g) || []).length;
console.log(`\nReclassified: ${fixes} businesses`);
console.log(`Remaining fishing-marine with NAICS 114: ${remaining}`);
