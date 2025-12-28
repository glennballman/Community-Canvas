const fs = require('fs');

// Category mapping for NAICS codes
const categoryMap = {
  'accommodations': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'accommodation': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'hotel': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'resort': { cat: 'hospitality', naics: '721110', desc: 'Hotels and Motels' },
  'restaurant': { cat: 'food-beverage', naics: '722511', desc: 'Full-Service Restaurants' },
  'food': { cat: 'food-beverage', naics: '722511', desc: 'Full-Service Restaurants' },
  'cafe': { cat: 'food-beverage', naics: '722515', desc: 'Snack and Nonalcoholic Beverage Bars' },
  'retail': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'construction': { cat: 'construction', naics: '236220', desc: 'Commercial Building Construction' },
  'contractor': { cat: 'construction', naics: '238990', desc: 'Specialty Trade Contractors' },
  'health': { cat: 'healthcare', naics: '621111', desc: 'Offices of Physicians' },
  'medical': { cat: 'healthcare', naics: '621111', desc: 'Offices of Physicians' },
  'wellness': { cat: 'healthcare', naics: '621399', desc: 'Offices of Health Practitioners' },
  'salon': { cat: 'spa-beauty', naics: '812111', desc: 'Barber Shops' },
  'spa': { cat: 'spa-beauty', naics: '812199', desc: 'Other Personal Care Services' },
  'beauty': { cat: 'spa-beauty', naics: '812112', desc: 'Beauty Salons' },
  'automotive': { cat: 'automotive', naics: '441110', desc: 'New Car Dealers' },
  'auto': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'plumb': { cat: 'construction', naics: '238220', desc: 'Plumbing and HVAC Contractors' },
  'electric': { cat: 'construction', naics: '238210', desc: 'Electrical Contractors' },
  'real estate': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'realty': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'property': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'legal': { cat: 'legal-services', naics: '541110', desc: 'Offices of Lawyers' },
  'lawyer': { cat: 'legal-services', naics: '541110', desc: 'Offices of Lawyers' },
  'accounting': { cat: 'financial-services', naics: '541211', desc: 'Offices of CPAs' },
  'financial': { cat: 'financial-services', naics: '523930', desc: 'Investment Advice' },
  'insurance': { cat: 'financial-services', naics: '524210', desc: 'Insurance Agencies' },
  'tour': { cat: 'tourism', naics: '561520', desc: 'Tour Operators' },
  'travel': { cat: 'tourism', naics: '561510', desc: 'Travel Agencies' },
  'adventure': { cat: 'recreation-entertainment', naics: '487990', desc: 'Scenic Transportation' },
  'fitness': { cat: 'healthcare', naics: '713940', desc: 'Fitness Centers' },
  'sport': { cat: 'recreation-entertainment', naics: '713940', desc: 'Fitness Centers' },
  'nonprofit': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'non-profit': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'association': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'community': { cat: 'nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'marketing': { cat: 'marketing-advertising', naics: '541810', desc: 'Advertising Agencies' },
  'media': { cat: 'marketing-advertising', naics: '541810', desc: 'Advertising Agencies' },
  'technology': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design' },
  'consulting': { cat: 'professional-services', naics: '541611', desc: 'Management Consulting' },
  'professional': { cat: 'professional-services', naics: '541990', desc: 'Professional Services' }
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

function processChamber(id, data, minForGood = 30) {
  const members = data.map(m => {
    const catInfo = mapCategory(m.category);
    return {
      id: generateId(m.name),
      chamberId: id,
      name: m.name,
      category: catInfo.cat,
      naicsCode: catInfo.naics,
      naicsDescription: catInfo.desc,
      address: m.address || '',
      phone: m.phone || '',
      website: m.website || '',
      description: (m.description || '').substring(0, 200)
    };
  });
  
  // Dedupe
  const seen = new Set();
  const unique = members.filter(m => {
    const key = m.id;
    if (!key || seen.has(key) || m.name.length < 4) return false;
    seen.add(key);
    return true;
  });
  
  const status = unique.length >= minForGood ? 'GOOD' : (unique.length > 10 ? 'PARTIAL' : 'MINIMAL');
  return { members: unique, count: unique.length, status };
}

// Process all chambers
const results = {};

// Port Alberni - has detailed data
try {
  const data = JSON.parse(fs.readFileSync('scripts/port-alberni-details.json', 'utf8'));
  results['port-alberni-chamber'] = processChamber('port-alberni-chamber', data, 150);
} catch(e) { console.log('Port Alberni:', e.message); }

// Sooke
try {
  const data = JSON.parse(fs.readFileSync('scripts/sooke-chamber-raw.json', 'utf8'));
  results['sooke-chamber'] = processChamber('sooke-chamber', data, 80);
} catch(e) { console.log('Sooke:', e.message); }

// Sidney
try {
  const data = JSON.parse(fs.readFileSync('scripts/sidney-chamber-raw.json', 'utf8'));
  results['sidney-chamber'] = processChamber('sidney-chamber', data, 80);
} catch(e) { console.log('Sidney:', e.message); }

// Cowichan Lake
try {
  const data = JSON.parse(fs.readFileSync('scripts/cowichan-lake-chamber-raw.json', 'utf8'));
  results['cowichan-lake-chamber'] = processChamber('cowichan-lake-chamber', data, 50);
} catch(e) { console.log('Cowichan Lake:', e.message); }

// Port McNeill
try {
  const data = JSON.parse(fs.readFileSync('scripts/port-mcneill-chamber-raw.json', 'utf8'));
  results['port-mcneill-chamber'] = processChamber('port-mcneill-chamber', data, 30);
} catch(e) { console.log('Port McNeill:', e.message); }

// Use filtered Playwright data for Qualicum Beach
try {
  const data = JSON.parse(fs.readFileSync('scripts/port-alberni-filtered.json', 'utf8'))
    .filter(b => b.name && !b.name.match(/^(Skip|Member|Business|Join|Contact)/i));
  // Port Alberni is already processed above
} catch(e) {}

// Summary
console.log('\n=== VI CHAMBERS CONSOLIDATION ===\n');
let totalNew = 0;
for (const [id, result] of Object.entries(results)) {
  console.log(`${id}: ${result.count} members [${result.status}]`);
  totalNew += result.count;
  
  // Save integration file
  fs.writeFileSync(`scripts/${id}-integration.json`, JSON.stringify(result.members, null, 2));
}
console.log(`\nTotal new members: ${totalNew}`);

// Save combined
fs.writeFileSync('scripts/vi-chambers-final.json', JSON.stringify(results, null, 2));
