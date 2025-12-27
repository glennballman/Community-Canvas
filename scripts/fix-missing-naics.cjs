/**
 * Fix missing NAICS mappings
 * Run with: node scripts/fix-missing-naics.cjs
 */

const fs = require('fs');
const path = require('path');

const fixMappings = {
  "events": { code: "711310", subsector: "711", sector: "71", title: "Promoters of Performing Arts with Facilities" },
  "financial": { code: "522000", subsector: "522", sector: "52", title: "Credit Intermediation and Related Activities" },
  "home-improvement": { code: "236118", subsector: "236", sector: "23", title: "Residential Remodelers" },
  "seniors-services": { code: "623311", subsector: "623", sector: "62", title: "Continuing Care Retirement Communities" },
};

const filePath = path.join(__dirname, '../shared/chamber-members.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the 999999 codes with the proper mappings
// We need to find records with these categories and update their NAICS

for (const [category, naics] of Object.entries(fixMappings)) {
  // Find pattern: category: "xyz" followed eventually by naicsCode: "999999"
  const regex = new RegExp(
    `(category:\\s*["']${category}["'][\\s\\S]*?)naicsCode:\\s*"999999"[\\s\\S]*?naicsSubsector:\\s*"999"[\\s\\S]*?naicsSector:\\s*"99"[\\s\\S]*?naicsTitle:\\s*"Unclassified"`,
    'g'
  );
  
  content = content.replace(regex, (match, prefix) => {
    return `${prefix}naicsCode: "${naics.code}",
    naicsSubsector: "${naics.subsector}",
    naicsSector: "${naics.sector}",
    naicsTitle: "${naics.title}"`;
  });
}

fs.writeFileSync(filePath, content);

// Verify
const remaining = (content.match(/naicsCode: "999999"/g) || []).length;
console.log(`Fixed missing NAICS codes. Remaining unmatched: ${remaining}`);
