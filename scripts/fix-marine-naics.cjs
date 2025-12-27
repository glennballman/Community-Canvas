/**
 * Fix marine NAICS codes based on business type
 * Port authorities, harbours, and ferry services are NOT fishing businesses
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../shared/chamber-members.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Count fixes
let fixes = 0;

// Port and Harbour Authorities -> 488310 Port and Harbor Operations
const portPatterns = [
  /Port of /i,
  /Harbour Authority/i,
  /Harbor Authority/i,
  /Port Authority/i,
];

// Ferry and Marine Transport -> 483114 Coastal and Great Lakes Passenger Transportation
const ferryPatterns = [
  /Ferry/i,
  /Seabus/i,
  /Lady Rose Marine/i,
  /Water Taxi/i,
  /Marine.*Transport/i,
  /Passenger.*Marine/i,
];

// Marina and Boat Services -> 713930 Marinas
const marinaPatterns = [
  /Marina/i,
  /Boat.*Rental/i,
  /Yacht.*Club/i,
  /Boat.*Club/i,
];

// Marine Repair and Services -> 488390 Other Support Activities for Water Transportation
const marineServicePatterns = [
  /Marine.*Service/i,
  /Marine.*Repair/i,
  /Boat.*Repair/i,
  /Ship.*Repair/i,
  /Shipyard/i,
  /Breakers Marine/i,
];

// Seafood Processing -> 311710 Seafood Product Preparation
const seafoodPatterns = [
  /Seafood/i,
  /Fish.*Processing/i,
  /Cannery/i,
];

// Parse and process each member
const memberRegex = /\{[^{}]*businessName:\s*"([^"]+)"[^{}]*category:\s*"fishing-marine"[^{}]*naicsCode:\s*"(\d+)"[^{}]*naicsSubsector:\s*"(\d+)"[^{}]*naicsSector:\s*"([^"]+)"[^{}]*naicsTitle:\s*"([^"]+)"[^{}]*\}/gs;

let match;
const replacements = [];

// Read file content as string and find all fishing-marine members
const lines = content.split('\n');
let inMember = false;
let memberStart = -1;
let memberContent = '';
let businessName = '';
let currentCategory = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('{') && !inMember) {
    inMember = true;
    memberStart = i;
    memberContent = line;
    continue;
  }
  
  if (inMember) {
    memberContent += '\n' + line;
    
    if (line.includes('businessName:')) {
      const match = line.match(/businessName:\s*"([^"]+)"/);
      if (match) businessName = match[1];
    }
    
    if (line.includes('category:')) {
      const match = line.match(/category:\s*"([^"]+)"/);
      if (match) currentCategory = match[1];
    }
    
    if (line.includes('},') || (line.trim() === '}' && lines[i+1]?.includes(']'))) {
      // End of member
      if (currentCategory === 'fishing-marine') {
        let newNaics = null;
        
        // Check patterns in priority order
        for (const pattern of portPatterns) {
          if (pattern.test(businessName)) {
            newNaics = { code: "488310", subsector: "488", sector: "48-49", title: "Port and Harbor Operations" };
            break;
          }
        }
        
        if (!newNaics) {
          for (const pattern of ferryPatterns) {
            if (pattern.test(businessName)) {
              newNaics = { code: "483114", subsector: "483", sector: "48-49", title: "Coastal and Great Lakes Passenger Transportation" };
              break;
            }
          }
        }
        
        if (!newNaics) {
          for (const pattern of marinaPatterns) {
            if (pattern.test(businessName)) {
              newNaics = { code: "713930", subsector: "713", sector: "71", title: "Marinas" };
              break;
            }
          }
        }
        
        if (!newNaics) {
          for (const pattern of marineServicePatterns) {
            if (pattern.test(businessName)) {
              newNaics = { code: "488390", subsector: "488", sector: "48-49", title: "Other Support Activities for Water Transportation" };
              break;
            }
          }
        }
        
        if (!newNaics) {
          for (const pattern of seafoodPatterns) {
            if (pattern.test(businessName)) {
              newNaics = { code: "311710", subsector: "311", sector: "31-33", title: "Seafood Product Preparation and Packaging" };
              break;
            }
          }
        }
        
        if (newNaics) {
          // Replace the NAICS fields in memberContent
          const updatedContent = memberContent
            .replace(/naicsCode:\s*"[^"]+"/g, `naicsCode: "${newNaics.code}"`)
            .replace(/naicsSubsector:\s*"[^"]+"/g, `naicsSubsector: "${newNaics.subsector}"`)
            .replace(/naicsSector:\s*"[^"]+"/g, `naicsSector: "${newNaics.sector}"`)
            .replace(/naicsTitle:\s*"[^"]+"/g, `naicsTitle: "${newNaics.title}"`);
          
          replacements.push({ original: memberContent, updated: updatedContent, businessName, newTitle: newNaics.title });
          fixes++;
        }
      }
      
      inMember = false;
      memberContent = '';
      businessName = '';
      currentCategory = '';
    }
  }
}

// Apply replacements
for (const r of replacements) {
  content = content.replace(r.original, r.updated);
  console.log(`Fixed: ${r.businessName} -> ${r.newTitle}`);
}

fs.writeFileSync(filePath, content);
console.log(`\nTotal marine businesses reclassified: ${fixes}`);
