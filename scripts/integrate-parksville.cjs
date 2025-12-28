const fs = require('fs');

// Load raw data
const raw = JSON.parse(fs.readFileSync('scripts/parksville-raw.json', 'utf8'));
console.log(`Processing ${raw.length} Parksville members...`);

// Valid BusinessCategory values (must match shared/chamber-members.ts type)
const categoryMap = {
  'accommodations': 'hospitality',
  'accommodation': 'hospitality',
  'hotels': 'hospitality',
  'motels': 'hospitality',
  'bed & breakfast': 'hospitality',
  'automotive': 'automotive',
  'auto': 'automotive',
  'car': 'automotive',
  'vehicle': 'automotive',
  'construction': 'construction',
  'building': 'construction',
  'contractor': 'construction',
  'renovation': 'construction',
  'education': 'education',
  'school': 'education',
  'training': 'education',
  'child care': 'education',
  'childcare': 'education',
  'daycare': 'education',
  'financial': 'financial-services',
  'accounting': 'financial-services',
  'bank': 'financial-services',
  'insurance': 'financial-services',
  'investment': 'financial-services',
  'food': 'food-beverage',
  'restaurant': 'food-beverage',
  'catering': 'food-beverage',
  'cafe': 'food-beverage',
  'bakery': 'food-beverage',
  'beverage': 'food-beverage',
  'grocery': 'food-beverage',
  'health': 'healthcare',
  'medical': 'healthcare',
  'dental': 'healthcare',
  'clinic': 'healthcare',
  'pharmacy': 'healthcare',
  'wellness': 'healthcare',
  'fitness': 'healthcare',
  'home': 'home-garden',
  'garden': 'home-garden',
  'landscaping': 'home-garden',
  'cleaning': 'home-garden',
  'furniture': 'home-garden',
  'appliance': 'home-garden',
  'legal': 'legal-services',
  'lawyer': 'legal-services',
  'law firm': 'legal-services',
  'attorney': 'legal-services',
  'notary': 'legal-services',
  'manufacturing': 'manufacturing',
  'industrial': 'manufacturing',
  'media': 'marketing-advertising',
  'marketing': 'marketing-advertising',
  'advertising': 'marketing-advertising',
  'communications': 'marketing-advertising',
  'printing': 'marketing-advertising',
  'design': 'marketing-advertising',
  'non profit': 'nonprofit',
  'non-profit': 'nonprofit',
  'nonprofit': 'nonprofit',
  'charity': 'nonprofit',
  'association': 'nonprofit',
  'organization': 'nonprofit',
  'professional': 'professional-services',
  'consulting': 'professional-services',
  'business services': 'professional-services',
  'real estate': 'real-estate',
  'property': 'real-estate',
  'realty': 'real-estate',
  'recreation': 'recreation-entertainment',
  'sports': 'recreation-entertainment',
  'entertainment': 'recreation-entertainment',
  'arts': 'recreation-entertainment',
  'retail': 'retail',
  'store': 'retail',
  'shop': 'retail',
  'boutique': 'retail',
  'specialty': 'retail',
  'technology': 'it-technology',
  'it': 'it-technology',
  'computer': 'it-technology',
  'software': 'it-technology',
  'tourism': 'tourism',
  'travel': 'tourism',
  'tour': 'tourism',
  'transportation': 'transportation',
  'taxi': 'transportation',
  'trucking': 'transportation',
  'shipping': 'transportation',
  'utilities': 'utilities',
  'energy': 'utilities',
  'power': 'utilities',
  'government': 'government',
  'municipal': 'government',
  'salon': 'spa-beauty',
  'spa': 'spa-beauty',
  'beauty': 'spa-beauty',
  'hair': 'spa-beauty',
  'personal services': 'spa-beauty'
};

// NAICS code mapping by category
const naicsMap = {
  'hospitality': { code: '721110', desc: 'Hotels and Motels' },
  'automotive': { code: '441110', desc: 'New Car Dealers' },
  'construction': { code: '236220', desc: 'Commercial and Institutional Building Construction' },
  'education': { code: '611310', desc: 'Colleges and Universities' },
  'financial-services': { code: '523930', desc: 'Investment Advice' },
  'food-beverage': { code: '722511', desc: 'Full-Service Restaurants' },
  'healthcare': { code: '621111', desc: 'Offices of Physicians' },
  'home-garden': { code: '444140', desc: 'Hardware Stores' },
  'legal-services': { code: '541110', desc: 'Offices of Lawyers' },
  'manufacturing': { code: '332710', desc: 'Machine Shops' },
  'marketing-advertising': { code: '541810', desc: 'Advertising Agencies' },
  'nonprofit': { code: '813410', desc: 'Civic and Social Organizations' },
  'professional-services': { code: '541611', desc: 'Administrative Management Consulting' },
  'real-estate': { code: '531210', desc: 'Offices of Real Estate Agents' },
  'recreation-entertainment': { code: '713940', desc: 'Fitness and Recreational Sports Centers' },
  'retail': { code: '452319', desc: 'All Other General Merchandise Stores' },
  'it-technology': { code: '541512', desc: 'Computer Systems Design Services' },
  'tourism': { code: '561510', desc: 'Travel Agencies' },
  'transportation': { code: '484110', desc: 'General Freight Trucking, Local' },
  'utilities': { code: '221122', desc: 'Electric Power Distribution' },
  'government': { code: '921110', desc: 'Executive Offices' },
  'spa-beauty': { code: '812111', desc: 'Barber Shops' }
};

function mapCategory(rawCat) {
  if (!rawCat) return 'professional-services';
  const lower = rawCat.toLowerCase();
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lower.includes(key)) return value;
  }
  return 'professional-services';
}

function generateId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

// Process members
const members = raw.map(m => {
  const category = mapCategory(m.category);
  const naics = naicsMap[category] || naicsMap['professional-services'];
  
  return {
    id: generateId(m.name),
    chamberId: 'parksville',
    name: m.name,
    category: category,
    naicsCode: naics.code,
    naicsDescription: naics.desc,
    address: m.address || '',
    phone: m.phone || '',
    website: m.website || '',
    description: m.description || ''
  };
});

// Deduplicate by ID
const seen = new Set();
const unique = members.filter(m => {
  if (seen.has(m.id)) return false;
  seen.add(m.id);
  return true;
});

console.log(`Unique members: ${unique.length}`);

// Save integration file
fs.writeFileSync('scripts/parksville-integration.json', JSON.stringify(unique, null, 2));

// Count by category
const byCat = {};
unique.forEach(m => {
  byCat[m.category] = (byCat[m.category] || 0) + 1;
});
console.log('\nBy category:');
Object.entries(byCat).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

console.log('\nSample members:');
unique.slice(0, 3).forEach(m => {
  console.log(`  - ${m.name} (${m.category}, NAICS: ${m.naicsCode})`);
});
