const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/port-alberni-chamber-integration.json', 'utf8'));

const tsCode = data.map(m => `  {
    id: '${m.id.replace(/'/g, "\\'")}',
    chamberId: 'port-alberni-chamber',
    name: '${m.name.replace(/'/g, "\\'")}',
    category: '${m.category}' as const,
    naicsCode: '${m.naicsCode}',
    naicsTitle: '${m.naicsDescription.replace(/'/g, "\\'")}',
    naicsSector: '${m.naicsCode.substring(0,2)}',
    naicsSubsector: '${m.naicsCode.substring(0,3)}',
    ${m.address ? `address: '${m.address.replace(/'/g, "\\'")}',` : ''}
    ${m.phone ? `phone: '${m.phone.replace(/'/g, "\\'")}',` : ''}
    ${m.website ? `website: '${m.website.replace(/'/g, "\\'")}',` : 'websiteNeedsCollection: true,'}
    municipality: 'Port Alberni',
    region: 'Alberni-Clayoquot'
  }`).join(',\n');

console.log(`Generated ${data.length} Port Alberni members for integration`);
fs.writeFileSync('scripts/port-alberni-ts-code.txt', 
  `  // ============================================================================
  // PORT ALBERNI - Alberni Valley Chamber of Commerce
  // Scraped: December 2024 | Coverage: 88% (175/~200 members)
  // ============================================================================
${tsCode}`);
console.log('Saved to scripts/port-alberni-ts-code.txt');
