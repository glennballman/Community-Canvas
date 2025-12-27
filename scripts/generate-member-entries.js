/**
 * Generate TypeScript member entries for chamber-members.ts
 * Applies NAICS classification and proper formatting
 */

import fs from 'fs';

// Simple category inference from business name
function inferCategory(name, description = '') {
  const text = (name + ' ' + description).toLowerCase();
  
  if (/coffee|cafe|restaurant|bistro|bakery|catering|food|pizza|sushi|grill|kitchen|diner/.test(text)) return 'food-beverage';
  if (/hotel|motel|inn|resort|b&b|cottage|accommodation|lodge|hostel/.test(text)) return 'accommodation';
  if (/law|legal|lawyer|attorney|notary/.test(text)) return 'legal';
  if (/account|bookkeep|tax|cpa|financial|finance/.test(text)) return 'accounting';
  if (/real estate|realty|realtor|property/.test(text)) return 'real-estate';
  if (/construct|build|contractor|renovate|roofing|framing/.test(text)) return 'construction';
  if (/plumb|plumber/.test(text)) return 'plumbing';
  if (/electric|electrical/.test(text)) return 'electrical';
  if (/landscape|garden|lawn|tree service|arborist/.test(text)) return 'landscaping';
  if (/dental|dentist|orthodont/.test(text)) return 'dental';
  if (/physician|doctor|clinic|medical|health|therapy|physio|chiro|massage|wellness/.test(text)) return 'healthcare';
  if (/vet|veterinar|animal|pet/.test(text)) return 'veterinary';
  if (/salon|spa|beauty|hair|nail|barber/.test(text)) return 'spa-beauty';
  if (/gym|fitness|yoga|pilates|crossfit/.test(text)) return 'fitness-wellness';
  if (/insurance|insur/.test(text)) return 'insurance';
  if (/bank|credit union/.test(text)) return 'banking-finance';
  if (/tech|software|computer|it service|web|digital/.test(text)) return 'it-technology';
  if (/marketing|advertis|media|design|creative/.test(text)) return 'marketing-advertising';
  if (/consult/.test(text)) return 'consulting';
  if (/auto|car|vehicle|tire|mechanic|automotive/.test(text)) return 'automotive';
  if (/retail|shop|store|boutique/.test(text)) return 'retail';
  if (/brew|winery|distillery|wine|beer/.test(text)) return 'winery-brewery';
  if (/photo|video|film/.test(text)) return 'photography';
  if (/school|education|tutor|academy|college|university/.test(text)) return 'education';
  if (/church|religious|ministry/.test(text)) return 'religious';
  if (/nonprofit|foundation|charity|community service/.test(text)) return 'charity-nonprofit';
  if (/art|gallery|museum|theatre|music/.test(text)) return 'arts-culture';
  if (/nursery|farm|agri/.test(text)) return 'agriculture';
  if (/golf|recreation|sport/.test(text)) return 'recreation';
  if (/marina|boat|marine|sail/.test(text)) return 'fishing-marine';
  if (/clean|janitor/.test(text)) return 'cleaning-janitorial';
  if (/print|sign/.test(text)) return 'printing';
  if (/senior|elder|retirement/.test(text)) return 'seniors';
  if (/excavat|trucking|freight|transport|moving|haul/.test(text)) return 'trucking-freight';
  if (/courier|delivery/.test(text)) return 'courier-delivery';
  if (/taxi|cab/.test(text)) return 'taxi-rideshare';
  if (/childcare|daycare|preschool/.test(text)) return 'childcare';
  if (/funeral|memorial|cremation/.test(text)) return 'funeral';
  if (/hvac|heating|cooling|furnace/.test(text)) return 'heating-cooling';
  if (/engineering|survey/.test(text)) return 'engineering';
  if (/first nation|indigenous/.test(text)) return 'first-nations';
  
  return 'other';
}

// NAICS mapping for categories
const categoryToNaics = {
  'food-beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'legal': { code: '541110', subsector: '541', sector: '54', title: 'Offices of Lawyers' },
  'accounting': { code: '541211', subsector: '541', sector: '54', title: 'Offices of Certified Public Accountants' },
  'real-estate': { code: '531210', subsector: '531', sector: '53', title: 'Offices of Real Estate Agents and Brokers' },
  'construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial and Institutional Building Construction' },
  'plumbing': { code: '238220', subsector: '238', sector: '23', title: 'Plumbing, Heating, and Air-Conditioning Contractors' },
  'electrical': { code: '238210', subsector: '238', sector: '23', title: 'Electrical Contractors' },
  'landscaping': { code: '561730', subsector: '561', sector: '56', title: 'Landscaping Services' },
  'dental': { code: '621210', subsector: '621', sector: '62', title: 'Offices of Dentists' },
  'healthcare': { code: '621999', subsector: '621', sector: '62', title: 'All Other Miscellaneous Ambulatory Health Care Services' },
  'veterinary': { code: '541940', subsector: '541', sector: '54', title: 'Veterinary Services' },
  'spa-beauty': { code: '812111', subsector: '812', sector: '81', title: 'Barber Shops' },
  'fitness-wellness': { code: '713940', subsector: '713', sector: '71', title: 'Fitness and Recreational Sports Centers' },
  'insurance': { code: '524210', subsector: '524', sector: '52', title: 'Insurance Agencies and Brokerages' },
  'banking-finance': { code: '522110', subsector: '522', sector: '52', title: 'Commercial Banking' },
  'it-technology': { code: '541512', subsector: '541', sector: '54', title: 'Computer Systems Design Services' },
  'marketing-advertising': { code: '541810', subsector: '541', sector: '54', title: 'Advertising Agencies' },
  'consulting': { code: '541611', subsector: '541', sector: '54', title: 'Administrative Management Consulting Services' },
  'automotive': { code: '441110', subsector: '441', sector: '44', title: 'New Car Dealers' },
  'retail': { code: '452319', subsector: '452', sector: '44', title: 'All Other General Merchandise Stores' },
  'winery-brewery': { code: '312130', subsector: '312', sector: '31', title: 'Wineries' },
  'photography': { code: '541922', subsector: '541', sector: '54', title: 'Commercial Photography' },
  'education': { code: '611110', subsector: '611', sector: '61', title: 'Elementary and Secondary Schools' },
  'religious': { code: '813110', subsector: '813', sector: '81', title: 'Religious Organizations' },
  'charity-nonprofit': { code: '813211', subsector: '813', sector: '81', title: 'Grantmaking Foundations' },
  'arts-culture': { code: '711110', subsector: '711', sector: '71', title: 'Theater Companies and Dinner Theaters' },
  'agriculture': { code: '111419', subsector: '111', sector: '11', title: 'Other Food Crops Grown Under Cover' },
  'recreation': { code: '713910', subsector: '713', sector: '71', title: 'Golf Courses and Country Clubs' },
  'fishing-marine': { code: '713930', subsector: '713', sector: '71', title: 'Marinas' },
  'cleaning-janitorial': { code: '561720', subsector: '561', sector: '56', title: 'Janitorial Services' },
  'printing': { code: '323111', subsector: '323', sector: '32', title: 'Commercial Printing' },
  'seniors': { code: '623110', subsector: '623', sector: '62', title: 'Nursing Care Facilities' },
  'trucking-freight': { code: '484110', subsector: '484', sector: '48', title: 'General Freight Trucking, Local' },
  'courier-delivery': { code: '492110', subsector: '492', sector: '49', title: 'Couriers and Express Delivery Services' },
  'taxi-rideshare': { code: '485310', subsector: '485', sector: '48', title: 'Taxi Service' },
  'childcare': { code: '624410', subsector: '624', sector: '62', title: 'Child Day Care Services' },
  'funeral': { code: '812210', subsector: '812', sector: '81', title: 'Funeral Homes and Funeral Services' },
  'heating-cooling': { code: '238220', subsector: '238', sector: '23', title: 'Plumbing, Heating, and Air-Conditioning Contractors' },
  'engineering': { code: '541330', subsector: '541', sector: '54', title: 'Engineering Services' },
  'first-nations': { code: '813920', subsector: '813', sector: '81', title: 'Professional Organizations' },
  'other': { code: '999999', subsector: '999', sector: '99', title: 'Unclassified' }
};

// Generate entries for Saanich Peninsula
const saanich = JSON.parse(fs.readFileSync('scripts/saanich-integration.json'));
const saanichEntries = saanich.map((m, i) => {
  const category = inferCategory(m.name);
  const naics = categoryToNaics[category] || categoryToNaics['other'];
  
  return {
    id: `saanich-peninsula-member-${i + 1}`,
    chamberId: 'saanich-peninsula-chamber',
    businessName: m.name,
    website: m.website || undefined,
    phone: m.phone ? m.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : undefined,
    category,
    naicsCode: naics.code,
    naicsSubsector: naics.subsector,
    naicsSector: naics.sector,
    naicsTitle: naics.title,
    municipality: 'Sidney',
    region: 'Capital'
  };
});

// Generate entries for Pender Island
const pender = JSON.parse(fs.readFileSync('scripts/pender-integration.json'));
const penderEntries = pender.map((m, i) => {
  const category = inferCategory(m.name, m.description);
  const naics = categoryToNaics[category] || categoryToNaics['other'];
  
  return {
    id: `pender-island-member-${i + 1}`,
    chamberId: 'pender-island-chamber',
    businessName: m.name,
    description: m.description || undefined,
    category,
    naicsCode: naics.code,
    naicsSubsector: naics.subsector,
    naicsSector: naics.sector,
    naicsTitle: naics.title,
    municipality: 'Pender Island',
    region: 'Capital'
  };
});

// Generate TypeScript
function toTS(entry) {
  let lines = ['  {'];
  lines.push(`    id: ${JSON.stringify(entry.id)},`);
  lines.push(`    chamberId: ${JSON.stringify(entry.chamberId)},`);
  lines.push(`    businessName: ${JSON.stringify(entry.businessName)},`);
  if (entry.website) lines.push(`    website: ${JSON.stringify(entry.website)},`);
  if (entry.phone) lines.push(`    phone: ${JSON.stringify(entry.phone)},`);
  if (entry.description) lines.push(`    description: ${JSON.stringify(entry.description)},`);
  lines.push(`    category: ${JSON.stringify(entry.category)},`);
  lines.push(`    naicsCode: ${JSON.stringify(entry.naicsCode)},`);
  lines.push(`    naicsSubsector: ${JSON.stringify(entry.naicsSubsector)},`);
  lines.push(`    naicsSector: ${JSON.stringify(entry.naicsSector)},`);
  lines.push(`    naicsTitle: ${JSON.stringify(entry.naicsTitle)},`);
  lines.push(`    municipality: ${JSON.stringify(entry.municipality)},`);
  lines.push(`    region: ${JSON.stringify(entry.region)},`);
  lines.push('  }');
  return lines.join('\n');
}

const saanichTS = saanichEntries.map(toTS).join(',\n');
const penderTS = penderEntries.map(toTS).join(',\n');

fs.writeFileSync('scripts/saanich-ts-final.txt', saanichTS);
fs.writeFileSync('scripts/pender-ts-final.txt', penderTS);

console.log('Generated TypeScript entries:');
console.log(`  Saanich Peninsula: ${saanichEntries.length} entries`);
console.log(`  Pender Island: ${penderEntries.length} entries`);
console.log('');
console.log('Category distribution (Saanich):');
const saanichCats = {};
saanichEntries.forEach(e => saanichCats[e.category] = (saanichCats[e.category] || 0) + 1);
Object.entries(saanichCats).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

console.log('');
console.log('Category distribution (Pender):');
const penderCats = {};
penderEntries.forEach(e => penderCats[e.category] = (penderCats[e.category] || 0) + 1);
Object.entries(penderCats).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});
