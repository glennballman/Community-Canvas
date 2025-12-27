/**
 * Migration script to apply NAICS codes to all chamber members
 * Run with: npx tsx scripts/apply-naics-codes.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import NAICS mapping
import { categoryToNAICS, defaultNAICS, type NAICSCode } from '../shared/naics-codes';

const filePath = path.join(__dirname, '../shared/chamber-members.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');

// Track statistics
let processed = 0;
let matched = 0;
let unmatched = 0;
const unmatchedCategories = new Set<string>();

// Regular expression to match each chamber member object
// This looks for objects with category: "value" or category: 'value' patterns
const memberRegex = /(\{[^{}]*?category:\s*["']([^"']+)["'][^{}]*?)(municipality:)/gs;

// Function to get NAICS fields as a string
function getNAICSFields(category: string, subcategory?: string): string {
  // Try to match subcategory first (more specific), then category
  const lookupKey = subcategory || category;
  let naics: NAICSCode = categoryToNAICS[lookupKey];
  
  // If subcategory didn't match, try category
  if (!naics && subcategory) {
    naics = categoryToNAICS[category];
  }
  
  if (!naics) {
    unmatched++;
    unmatchedCategories.add(lookupKey);
    naics = defaultNAICS;
  } else {
    matched++;
  }
  
  processed++;
  
  return `naicsCode: "${naics.code}",
    naicsSubsector: "${naics.subsector}",
    naicsSector: "${naics.sector}",
    naicsTitle: "${naics.title}",
    `;
}

// Process the content more carefully
// Look for each member object pattern
const lines = content.split('\n');
const newLines: string[] = [];
let inMemberObject = false;
let currentCategory = '';
let currentSubcategory = '';
let insertAfterLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect start of a member object (after the opening {)
  if (line.includes('id: "') && line.includes('-member-')) {
    inMemberObject = true;
    currentCategory = '';
    currentSubcategory = '';
  }
  
  // Extract category
  const categoryMatch = line.match(/category:\s*["']([^"']+)["']/);
  if (categoryMatch && inMemberObject) {
    currentCategory = categoryMatch[1];
  }
  
  // Extract subcategory
  const subcategoryMatch = line.match(/subcategory:\s*["']([^"']+)["']/);
  if (subcategoryMatch && inMemberObject) {
    currentSubcategory = subcategoryMatch[1];
  }
  
  // Detect description line - we'll insert NAICS after it
  if (line.includes('description:') && inMemberObject) {
    insertAfterLine = i;
  }
  
  // Detect crossReference - if present, insert before it
  if (line.includes('crossReference:') && inMemberObject && insertAfterLine === -1) {
    // Insert NAICS before crossReference
    const indent = line.match(/^(\s*)/)?.[1] || '    ';
    const naicsFields = getNAICSFields(currentCategory, currentSubcategory);
    newLines.push(indent + naicsFields.split('\n').map(l => l.trim()).filter(l => l).join('\n' + indent));
    newLines.push(line);
    continue;
  }
  
  // Detect municipality (which comes after description/crossReference)
  if (line.includes('municipality:') && inMemberObject) {
    // Insert NAICS before municipality if we haven't already
    if (insertAfterLine >= 0 || currentCategory) {
      const indent = line.match(/^(\s*)/)?.[1] || '    ';
      const naicsFields = getNAICSFields(currentCategory, currentSubcategory);
      // Insert each NAICS field on its own line
      newLines.push(`${indent}naicsCode: "${categoryToNAICS[currentSubcategory || currentCategory]?.code || categoryToNAICS[currentCategory]?.code || defaultNAICS.code}",`);
      newLines.push(`${indent}naicsSubsector: "${categoryToNAICS[currentSubcategory || currentCategory]?.subsector || categoryToNAICS[currentCategory]?.subsector || defaultNAICS.subsector}",`);
      newLines.push(`${indent}naicsSector: "${categoryToNAICS[currentSubcategory || currentCategory]?.sector || categoryToNAICS[currentCategory]?.sector || defaultNAICS.sector}",`);
      newLines.push(`${indent}naicsTitle: "${categoryToNAICS[currentSubcategory || currentCategory]?.title || categoryToNAICS[currentCategory]?.title || defaultNAICS.title}",`);
    }
    insertAfterLine = -1;
  }
  
  // Detect end of member object
  if (line.includes('},') && inMemberObject) {
    inMemberObject = false;
    currentCategory = '';
    currentSubcategory = '';
  }
  
  newLines.push(line);
}

// Write the updated content
fs.writeFileSync(filePath, newLines.join('\n'));

console.log('NAICS Migration Complete!');
console.log(`Total processed: ${processed}`);
console.log(`Matched: ${matched}`);
console.log(`Unmatched: ${unmatched}`);
if (unmatchedCategories.size > 0) {
  console.log('Unmatched categories:');
  unmatchedCategories.forEach(cat => console.log(`  - ${cat}`));
}
