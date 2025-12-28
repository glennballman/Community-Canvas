const fs = require('fs');

// Additional integration files
const integrations = [
  { file: 'scripts/campbell-river-integration.json', chamberId: 'campbell-river-chamber', chamberName: 'CAMPBELL RIVER CHAMBER OF COMMERCE', municipality: 'Campbell River', region: 'Strathcona' },
  { file: 'scripts/saanich-final-integration.json', chamberId: 'saanich-peninsula-chamber', chamberName: 'SAANICH PENINSULA CHAMBER OF COMMERCE', municipality: 'Saanich Peninsula', region: 'Capital' },
];

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const insertPoint = content.lastIndexOf('\n];');

let allEntries = '';

for (const integ of integrations) {
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
  
  const idPrefix = integ.chamberId.replace(/-chamber$/, '');
  
  members.forEach((m, i) => {
    const id = `${idPrefix}-member-${String(i + 1).padStart(3, '0')}`;
    const name = m.businessName || m.name;
    const category = m.category || 'other';
    
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
    municipality: "${m.municipality || integ.municipality}",
    region: "${m.region || integ.region}",
    memberSince: 2024,
  },\n`;
  });
  
  allEntries += entries;
}

const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + allEntries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('\nTotal members now:', totalAfter);
