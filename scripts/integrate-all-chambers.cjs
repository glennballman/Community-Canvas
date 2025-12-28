const fs = require('fs');

// Load all integration files
const integrations = [
  { file: 'scripts/saanich-final-integration.json', chamberId: 'saanich-peninsula-chamber', prefix: 'saanich-member', municipality: 'Sidney', region: 'Capital Regional District' },
  { file: 'scripts/pender-integration.json', chamberId: 'pender-island-chamber', prefix: 'pender-member', municipality: 'Pender Island', region: 'Capital Regional District' },
  { file: 'scripts/campbell-river-integration.json', chamberId: 'campbell-river-chamber', prefix: 'campbell-river-member', municipality: 'Campbell River', region: 'Strathcona Regional District' },
  { file: 'scripts/tofino-integration.json', chamberId: 'tofino-chamber', prefix: 'tofino-member', municipality: 'Tofino', region: 'Alberni-Clayoquot Regional District' },
  { file: 'scripts/nanaimo-integration.json', chamberId: 'greater-nanaimo-chamber', prefix: 'nanaimo-member', municipality: 'Nanaimo', region: 'Nanaimo Regional District' },
];

// Read current file
let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');
const totalBefore = (content.match(/chamberId:/g) || []).length;
console.log('Members before integration:', totalBefore);

// Find insertion point
const insertPoint = content.indexOf('] as const satisfies readonly ChamberMember[];');
if (insertPoint === -1) {
  console.error('Could not find insertion point');
  process.exit(1);
}

let allEntries = '\n  // ==========================================================================\n';
allEntries += '  // RE-INTEGRATED CHAMBERS\n';
allEntries += '  // ==========================================================================\n';

for (const { file, chamberId, prefix, municipality, region } of integrations) {
  try {
    const members = JSON.parse(fs.readFileSync(file, 'utf8'));
    
    // Check if already integrated
    const existingCount = (content.match(new RegExp(chamberId, 'g')) || []).length;
    if (existingCount > 50) {
      console.log(`${chamberId}: Already has ${existingCount} members, skipping`);
      continue;
    }
    
    console.log(`Integrating ${chamberId}: ${members.length} members`);
    
    allEntries += `\n  // ${chamberId.toUpperCase().replace(/-/g, ' ')}\n`;
    
    members.forEach((m, i) => {
      const id = `${prefix}-${String(i + 1).padStart(3, '0')}`;
      allEntries += `  {
    id: "${id}",
    chamberId: "${chamberId}",
    businessName: ${JSON.stringify(m.businessName)},
    category: "${m.category || 'other'}",
    subcategory: undefined,
    description: undefined,
    website: ${m.website ? JSON.stringify(m.website) : 'undefined'},
    phone: ${m.phone ? JSON.stringify(m.phone) : 'undefined'},
    email: ${m.email ? JSON.stringify(m.email) : 'undefined'},
    address: ${m.address ? JSON.stringify(m.address) : 'undefined'},
    naicsCode: ${m.naicsCode ? JSON.stringify(m.naicsCode) : 'undefined'},
    naicsSubsector: ${m.naicsSubsector ? JSON.stringify(m.naicsSubsector) : 'undefined'},
    naicsSector: ${m.naicsSector ? JSON.stringify(m.naicsSector) : 'undefined'},
    naicsTitle: ${m.naicsTitle ? JSON.stringify(m.naicsTitle) : 'undefined'},
    municipality: "${m.municipality || municipality}",
    region: "${m.region || region}",
    memberSince: ${m.memberSince || 2024},
  },\n`;
    });
    
  } catch (err) {
    console.log(`Skipping ${file}: ${err.message}`);
  }
}

// Insert before the closing bracket
const before = content.slice(0, insertPoint);
const after = content.slice(insertPoint);
content = before + allEntries + after;

fs.writeFileSync('shared/chamber-members.ts', content);

const totalAfter = (content.match(/chamberId:/g) || []).length;
console.log('\nMembers after integration:', totalAfter);
console.log('Added:', totalAfter - totalBefore);
