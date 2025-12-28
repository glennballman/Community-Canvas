const fs = require('fs');

// Integration files to recover
const integrations = [
  { file: 'scripts/nanaimo-integration.json', chamberId: 'nanaimo-chamber', chamberName: 'GREATER NANAIMO CHAMBER OF COMMERCE', municipality: 'Nanaimo', region: 'Vancouver Island' },
  { file: 'scripts/comox-integration.json', chamberId: 'comox-valley-chamber', chamberName: 'COMOX VALLEY CHAMBER OF COMMERCE', municipality: 'Comox Valley', region: 'Vancouver Island' },
  { file: 'scripts/westshore-integration.json', chamberId: 'westshore-chamber', chamberName: 'WESTSHORE CHAMBER OF COMMERCE', municipality: 'West Shore', region: 'Capital' },
  { file: 'scripts/saltspring-merged.json', chamberId: 'salt-spring-chamber', chamberName: 'SALT SPRING ISLAND CHAMBER OF COMMERCE', municipality: 'Salt Spring Island', region: 'Capital' },
];

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Find insertion point - look for the closing bracket of the array
const insertPoint = content.lastIndexOf('\n];');
if (insertPoint === -1) {
  console.error('Could not find insertion point (array closing bracket)');
  process.exit(1);
}

let allEntries = '';

for (const integ of integrations) {
  // Check if already integrated
  const existingCount = (content.match(new RegExp(`chamberId: "${integ.chamberId}"`, 'g')) || []).length;
  if (existingCount > 50) {
    console.log(`${integ.chamberName} already has ${existingCount} entries, skipping`);
    continue;
  }
  
  if (!fs.existsSync(integ.file)) {
    console.log(`${integ.file} not found, skipping`);
    continue;
  }
  
  const members = JSON.parse(fs.readFileSync(integ.file, 'utf8'));
  console.log(`Adding ${members.length} members from ${integ.chamberName}`);
  
  let entries = '\n  // ==========================================================================\n';
  entries += `  // ${integ.chamberName}\n`;
  entries += '  // ==========================================================================\n';
  
  const idPrefix = integ.chamberId.replace(/-chamber$/, '').replace(/-/g, '-');
  
  members.forEach((m, i) => {
    const id = `${idPrefix}-member-${String(i + 1).padStart(3, '0')}`;
    const name = m.businessName || m.name;
    const category = m.category || 'other';
    const municipality = m.municipality || integ.municipality;
    const region = m.region || integ.region;
    
    entries += `  {
    id: "${id}",
    chamberId: "${integ.chamberId}",
    businessName: ${JSON.stringify(name)},
    category: "${category}",
    subcategory: undefined,
    description: undefined,
    website: ${m.website ? JSON.stringify(m.website) : 'undefined'},
    phone: ${m.phone ? JSON.stringify(m.phone) : 'undefined'},
    email: undefined,
    address: ${m.address ? JSON.stringify(m.address) : 'undefined'},
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: "${municipality}",
    region: "${region}",
    memberSince: 2024,
  },\n`;
  });
  
  allEntries += entries;
}

// Insert all entries before the closing ];
const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + allEntries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('\nTotal members after recovery:', totalAfter);
