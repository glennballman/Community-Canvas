const fs = require('fs');

// Category to BusinessCategory and NAICS mapping
const categoryMap = {
  'lodge': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'accommodation': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'hotel': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'resort': { cat: 'hospitality', naics: '721199', desc: 'All Other Traveler Accommodation' },
  'b&b': { cat: 'hospitality', naics: '721191', desc: 'Bed-and-Breakfast Inns' },
  'restaurant': { cat: 'food-beverage', naics: '722511', desc: 'Full-Service Restaurants' },
  'cafe': { cat: 'food-beverage', naics: '722515', desc: 'Snack and Nonalcoholic Beverage Bars' },
  'food': { cat: 'food-beverage', naics: '722511', desc: 'Full-Service Restaurants' },
  'bakery': { cat: 'food-beverage', naics: '311811', desc: 'Retail Bakeries' },
  'automotive': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'tire': { cat: 'automotive', naics: '441320', desc: 'Tire Dealers' },
  'auto': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'accounting': { cat: 'financial-services', naics: '541211', desc: 'Offices of CPAs' },
  'financial': { cat: 'financial-services', naics: '523930', desc: 'Investment Advice' },
  'insurance': { cat: 'financial-services', naics: '524210', desc: 'Insurance Agencies' },
  'bank': { cat: 'financial-services', naics: '522110', desc: 'Commercial Banking' },
  'construction': { cat: 'construction', naics: '236220', desc: 'Commercial Building Construction' },
  'contractor': { cat: 'construction', naics: '238990', desc: 'Specialty Trade Contractors' },
  'electric': { cat: 'construction', naics: '238210', desc: 'Electrical Contractors' },
  'plumb': { cat: 'construction', naics: '238220', desc: 'Plumbing Contractors' },
  'health': { cat: 'healthcare', naics: '621111', desc: 'Offices of Physicians' },
  'medical': { cat: 'healthcare', naics: '621111', desc: 'Offices of Physicians' },
  'wellness': { cat: 'healthcare', naics: '621399', desc: 'Other Health Practitioners' },
  'fitness': { cat: 'healthcare', naics: '713940', desc: 'Fitness and Recreation Centers' },
  'salon': { cat: 'spa-beauty', naics: '812112', desc: 'Beauty Salons' },
  'spa': { cat: 'spa-beauty', naics: '812199', desc: 'Other Personal Care Services' },
  'beauty': { cat: 'spa-beauty', naics: '812112', desc: 'Beauty Salons' },
  'real estate': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'realty': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'property': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'legal': { cat: 'legal-services', naics: '541110', desc: 'Offices of Lawyers' },
  'lawyer': { cat: 'legal-services', naics: '541110', desc: 'Offices of Lawyers' },
  'notary': { cat: 'legal-services', naics: '541120', desc: 'Offices of Notaries' },
  'retail': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'store': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'shop': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'tourism': { cat: 'tourism', naics: '561520', desc: 'Tour Operators' },
  'tour': { cat: 'tourism', naics: '561520', desc: 'Tour Operators' },
  'travel': { cat: 'tourism', naics: '561510', desc: 'Travel Agencies' },
  'adventure': { cat: 'recreation-entertainment', naics: '487990', desc: 'Scenic Transportation' },
  'recreation': { cat: 'recreation-entertainment', naics: '713990', desc: 'Recreation Industries' },
  'sport': { cat: 'recreation-entertainment', naics: '713940', desc: 'Fitness Centers' },
  'nonprofit': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'non-profit': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'association': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'community': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'arts': { cat: 'nonprofit', naics: '711110', desc: 'Theater Companies' },
  'marketing': { cat: 'marketing-advertising', naics: '541810', desc: 'Advertising Agencies' },
  'media': { cat: 'marketing-advertising', naics: '541810', desc: 'Advertising Agencies' },
  'news': { cat: 'marketing-advertising', naics: '511110', desc: 'Newspaper Publishers' },
  'technology': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design' },
  'software': { cat: 'it-technology', naics: '541511', desc: 'Custom Computer Programming' },
  'consulting': { cat: 'professional-services', naics: '541611', desc: 'Management Consulting' },
  'professional': { cat: 'professional-services', naics: '541990', desc: 'Professional Services' },
  'marina': { cat: 'recreation-entertainment', naics: '713930', desc: 'Marinas' },
  'marine': { cat: 'transportation', naics: '488390', desc: 'Marine Cargo Handling' },
  'trucking': { cat: 'transportation', naics: '484110', desc: 'General Freight Trucking' },
  'pest': { cat: 'home-garden', naics: '561710', desc: 'Exterminating Services' },
  'landscap': { cat: 'home-garden', naics: '561730', desc: 'Landscaping Services' },
  'home': { cat: 'home-garden', naics: '444140', desc: 'Hardware Stores' },
  'garden': { cat: 'home-garden', naics: '444220', desc: 'Nursery and Garden Centers' },
  'manufacturing': { cat: 'manufacturing', naics: '332710', desc: 'Machine Shops' },
  'utilities': { cat: 'utilities', naics: '221122', desc: 'Electric Power Distribution' },
  'government': { cat: 'government', naics: '921110', desc: 'Executive Offices' },
  'education': { cat: 'education', naics: '611310', desc: 'Colleges and Universities' },
  'golf': { cat: 'recreation-entertainment', naics: '713910', desc: 'Golf Courses' }
};

function mapCategory(rawCat) {
  if (!rawCat) return { cat: 'professional-services', naics: '541990', desc: 'Professional Services' };
  const lower = rawCat.toLowerCase();
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lower.includes(key)) return value;
  }
  return { cat: 'professional-services', naics: '541990', desc: 'Professional Services' };
}

function generateId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function processMembers(chamberId, rawData) {
  const members = rawData.map(m => {
    const catInfo = mapCategory(m.category);
    return {
      id: generateId(m.name || m.businessName),
      chamberId: chamberId,
      name: m.name || m.businessName,
      category: catInfo.cat,
      naicsCode: catInfo.naics,
      naicsDescription: catInfo.desc,
      address: (m.address || '').replace(/null/gi, '').trim(),
      phone: (m.phone || '').replace(/null/gi, '').trim(),
      website: m.website || '',
      description: (m.description || '').substring(0, 200)
    };
  });
  
  const seen = new Set();
  return members.filter(m => {
    if (!m.name || m.name.length < 4) return false;
    const key = m.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Process each chamber
const chambers = [
  { id: 'port-alberni-chamber', file: 'scripts/port-alberni-details.json', expected: 200 },
  { id: 'ladysmith-chamber', file: 'scripts/ladysmith-details.json', expected: 80 },
  { id: 'sooke-chamber', file: 'scripts/sooke-chamber-raw.json', expected: 100 },
  { id: 'sidney-chamber', file: 'scripts/sidney-chamber-raw.json', expected: 100 },
  { id: 'cowichan-lake-chamber', file: 'scripts/cowichan-lake-chamber-raw.json', expected: 50 },
  { id: 'port-mcneill-chamber', file: 'scripts/port-mcneill-chamber-raw.json', expected: 40 }
];

let allMembers = [];
console.log('=== PROCESSING CHAMBERS ===\n');

for (const chamber of chambers) {
  try {
    const data = JSON.parse(fs.readFileSync(chamber.file, 'utf8'));
    const members = processMembers(chamber.id, data);
    const coverage = Math.round(members.length / chamber.expected * 100);
    
    console.log(`${chamber.id}: ${members.length} members (${coverage}% of ~${chamber.expected})`);
    
    // Only include if we have meaningful data
    if (members.length >= 5) {
      allMembers.push(...members);
      fs.writeFileSync(`scripts/${chamber.id}-integration.json`, JSON.stringify(members, null, 2));
    }
  } catch (e) {
    console.log(`${chamber.id}: Error - ${e.message}`);
  }
}

console.log(`\nTotal new members: ${allMembers.length}`);

// Save combined
fs.writeFileSync('scripts/new-vi-chambers-combined.json', JSON.stringify(allMembers, null, 2));
