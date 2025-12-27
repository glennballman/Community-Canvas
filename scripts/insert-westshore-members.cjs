/**
 * Insert WestShore Chamber members into chamber-members.ts
 * Adds 133 verified members before the Duncan Cowichan section
 */

const fs = require('fs');
const path = require('path');

// Read the westshore members output
const westshoreMembersContent = fs.readFileSync(
  path.join(__dirname, 'westshore-members-output.ts'),
  'utf8'
);

// Extract just the member entries (skip header comments)
const memberLines = westshoreMembersContent
  .split('\n')
  .filter(line => line.trim().startsWith('{ name:'))
  .join('\n');

// Create the WestShore section with proper formatting
const westshoreSectionHeader = `
  // ============================================================================
  // WestShore Chamber of Commerce - Langford, Colwood, Metchosin, View Royal, Highlands
  // Source: Official WestShore Chamber Directory (web.westshore.bc.ca)
  // Platform: MemberClicks/Personify
  // 133 verified members
  // ============================================================================
`;

const westshoreSectionFooter = `
`;

const westshoreSectionComplete = westshoreSectionHeader + '\n' + memberLines + '\n' + westshoreSectionFooter;

// Read the main chamber-members.ts file
const chamberMembersPath = path.join(__dirname, '..', 'shared', 'chamber-members.ts');
const chamberMembersContent = fs.readFileSync(chamberMembersPath, 'utf8');

// Find the Duncan Cowichan section and insert WestShore before it
const insertionPoint = '  // Duncan Cowichan Chamber of Commerce';
const insertionIndex = chamberMembersContent.indexOf(insertionPoint);

if (insertionIndex === -1) {
  console.error('ERROR: Could not find Duncan Cowichan section');
  process.exit(1);
}

// Insert the WestShore section before Duncan Cowichan
const newContent = 
  chamberMembersContent.slice(0, insertionIndex) +
  westshoreSectionComplete + '\n' +
  chamberMembersContent.slice(insertionIndex);

// Write back to the file
fs.writeFileSync(chamberMembersPath, newContent);

console.log('='.repeat(70));
console.log('WestShore Chamber Members Insertion Complete');
console.log('='.repeat(70));
console.log('\n✓ Added 133 WestShore Chamber members to chamber-members.ts');
console.log('✓ Inserted before Duncan Cowichan Chamber section');
console.log('\nVerification:');

// Count WestShore entries in the file
const westshoreCount = (newContent.match(/chamberId: "westshore"/g) || []).length;
console.log(`✓ Found ${westshoreCount} WestShore Chamber entries in file`);

// Count total members
const totalMembers = (newContent.match(/chamberId: "/g) || []).length;
console.log(`✓ Total chamber members in file: ${totalMembers}`);
