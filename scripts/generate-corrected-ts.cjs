const fs = require('fs');

// Corrected category mapping using EXACT BusinessCategory values
const categoryMap = {
  'lodge': { cat: 'accommodation', naics: '721110', desc: 'Hotels and Motels' },
  'accommodation': { cat: 'accommodation', naics: '721110', desc: 'Hotels and Motels' },
  'hotel': { cat: 'accommodation', naics: '721110', desc: 'Hotels and Motels' },
  'resort': { cat: 'accommodation', naics: '721199', desc: 'All Other Traveler Accommodation' },
  'b&b': { cat: 'accommodation', naics: '721191', desc: 'Bed-and-Breakfast Inns' },
  'motel': { cat: 'accommodation', naics: '721110', desc: 'Hotels and Motels' },
  'cabin': { cat: 'accommodation', naics: '721310', desc: 'Rooming and Boarding Houses' },
  'restaurant': { cat: 'restaurant', naics: '722511', desc: 'Full-Service Restaurants' },
  'cafe': { cat: 'restaurant', naics: '722515', desc: 'Snack and Nonalcoholic Beverage Bars' },
  'food': { cat: 'food-beverage', naics: '722511', desc: 'Full-Service Restaurants' },
  'bakery': { cat: 'food-beverage', naics: '311811', desc: 'Retail Bakeries' },
  'brewery': { cat: 'winery-brewery', naics: '312120', desc: 'Breweries' },
  'winery': { cat: 'winery-brewery', naics: '312130', desc: 'Wineries' },
  'distillery': { cat: 'winery-brewery', naics: '312140', desc: 'Distilleries' },
  'automotive': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'tire': { cat: 'automotive', naics: '441320', desc: 'Tire Dealers' },
  'auto': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'accounting': { cat: 'accounting', naics: '541211', desc: 'Offices of CPAs' },
  'financial': { cat: 'banking-finance', naics: '523930', desc: 'Investment Advice' },
  'insurance': { cat: 'insurance', naics: '524210', desc: 'Insurance Agencies' },
  'bank': { cat: 'banking-finance', naics: '522110', desc: 'Commercial Banking' },
  'credit union': { cat: 'banking-finance', naics: '522130', desc: 'Credit Unions' },
  'construction': { cat: 'construction', naics: '236220', desc: 'Commercial Building Construction' },
  'contractor': { cat: 'construction', naics: '238990', desc: 'Specialty Trade Contractors' },
  'electric': { cat: 'electrical', naics: '238210', desc: 'Electrical Contractors' },
  'plumb': { cat: 'plumbing', naics: '238220', desc: 'Plumbing Contractors' },
  'hvac': { cat: 'heating-cooling', naics: '238220', desc: 'HVAC Contractors' },
  'heating': { cat: 'heating-cooling', naics: '238220', desc: 'HVAC Contractors' },
  'health': { cat: 'healthcare', naics: '621111', desc: 'Offices of Physicians' },
  'medical': { cat: 'medical', naics: '621111', desc: 'Offices of Physicians' },
  'clinic': { cat: 'medical', naics: '621111', desc: 'Offices of Physicians' },
  'wellness': { cat: 'fitness-wellness', naics: '621399', desc: 'Other Health Practitioners' },
  'fitness': { cat: 'fitness-wellness', naics: '713940', desc: 'Fitness and Recreation Centers' },
  'gym': { cat: 'fitness-wellness', naics: '713940', desc: 'Fitness and Recreation Centers' },
  'yoga': { cat: 'fitness-wellness', naics: '713940', desc: 'Fitness and Recreation Centers' },
  'salon': { cat: 'spa-beauty', naics: '812112', desc: 'Beauty Salons' },
  'spa': { cat: 'spa-beauty', naics: '812199', desc: 'Other Personal Care Services' },
  'beauty': { cat: 'spa-beauty', naics: '812112', desc: 'Beauty Salons' },
  'real estate': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'realty': { cat: 'real-estate', naics: '531210', desc: 'Real Estate Agents' },
  'property': { cat: 'property-management', naics: '531311', desc: 'Residential Property Managers' },
  'legal': { cat: 'legal', naics: '541110', desc: 'Offices of Lawyers' },
  'lawyer': { cat: 'legal', naics: '541110', desc: 'Offices of Lawyers' },
  'notary': { cat: 'legal', naics: '541120', desc: 'Offices of Notaries' },
  'retail': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'store': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'shop': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'tourism': { cat: 'hospitality', naics: '561520', desc: 'Tour Operators' },
  'tour': { cat: 'hospitality', naics: '561520', desc: 'Tour Operators' },
  'travel': { cat: 'hospitality', naics: '561510', desc: 'Travel Agencies' },
  'adventure': { cat: 'recreation', naics: '487990', desc: 'Scenic Transportation' },
  'recreation': { cat: 'recreation', naics: '713990', desc: 'Recreation Industries' },
  'sport': { cat: 'recreation', naics: '713940', desc: 'Fitness Centers' },
  'nonprofit': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'non-profit': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'association': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'community': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic Organizations' },
  'arts': { cat: 'arts-culture', naics: '711110', desc: 'Theater Companies' },
  'gallery': { cat: 'arts-culture', naics: '453920', desc: 'Art Dealers' },
  'museum': { cat: 'arts-culture', naics: '712110', desc: 'Museums' },
  'marketing': { cat: 'marketing-advertising', naics: '541810', desc: 'Advertising Agencies' },
  'media': { cat: 'media', naics: '541810', desc: 'Advertising Agencies' },
  'news': { cat: 'media', naics: '511110', desc: 'Newspaper Publishers' },
  'technology': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design' },
  'software': { cat: 'it-technology', naics: '541511', desc: 'Custom Computer Programming' },
  'web': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design' },
  'consulting': { cat: 'consulting', naics: '541611', desc: 'Management Consulting' },
  'marina': { cat: 'fishing-marine', naics: '713930', desc: 'Marinas' },
  'marine': { cat: 'fishing-marine', naics: '488390', desc: 'Marine Cargo Handling' },
  'fishing': { cat: 'fishing-marine', naics: '114111', desc: 'Finfish Fishing' },
  'trucking': { cat: 'trucking-freight', naics: '484110', desc: 'General Freight Trucking' },
  'freight': { cat: 'trucking-freight', naics: '484110', desc: 'General Freight Trucking' },
  'pest': { cat: 'home-services', naics: '561710', desc: 'Exterminating Services' },
  'landscap': { cat: 'landscaping', naics: '561730', desc: 'Landscaping Services' },
  'lawn': { cat: 'landscaping', naics: '561730', desc: 'Landscaping Services' },
  'tree': { cat: 'landscaping', naics: '561730', desc: 'Landscaping Services' },
  'home': { cat: 'home-services', naics: '444140', desc: 'Hardware Stores' },
  'garden': { cat: 'retail', naics: '444220', desc: 'Nursery and Garden Centers' },
  'hardware': { cat: 'hardware-supplies', naics: '444130', desc: 'Hardware Stores' },
  'manufacturing': { cat: 'manufacturing', naics: '332710', desc: 'Machine Shops' },
  'utilities': { cat: 'utilities', naics: '221122', desc: 'Electric Power Distribution' },
  'government': { cat: 'government', naics: '921110', desc: 'Executive Offices' },
  'education': { cat: 'education', naics: '611310', desc: 'Colleges and Universities' },
  'school': { cat: 'education', naics: '611110', desc: 'Elementary and Secondary Schools' },
  'golf': { cat: 'recreation', naics: '713910', desc: 'Golf Courses' },
  'cleaning': { cat: 'cleaning-janitorial', naics: '561720', desc: 'Janitorial Services' },
  'dental': { cat: 'dental', naics: '621210', desc: 'Offices of Dentists' },
  'dentist': { cat: 'dental', naics: '621210', desc: 'Offices of Dentists' },
  'veterinary': { cat: 'veterinary', naics: '541940', desc: 'Veterinary Services' },
  'vet': { cat: 'veterinary', naics: '541940', desc: 'Veterinary Services' },
  'pet': { cat: 'pets', naics: '453910', desc: 'Pet and Pet Supplies Stores' },
  'pharmacy': { cat: 'pharmacy', naics: '446110', desc: 'Pharmacies and Drug Stores' },
  'photo': { cat: 'photography', naics: '541921', desc: 'Photography Studios' },
  'print': { cat: 'printing', naics: '323111', desc: 'Commercial Printing' },
  'sign': { cat: 'printing', naics: '339950', desc: 'Sign Manufacturing' },
  'security': { cat: 'security', naics: '561612', desc: 'Security Guards Services' },
  'roofing': { cat: 'roofing', naics: '238160', desc: 'Roofing Contractors' },
  'storage': { cat: 'storage', naics: '531130', desc: 'Self-Storage Facilities' },
  'telecom': { cat: 'telecommunications', naics: '517311', desc: 'Telecommunications Resellers' },
  'taxi': { cat: 'taxi-rideshare', naics: '485310', desc: 'Taxi Service' },
  'transit': { cat: 'transit', naics: '485111', desc: 'Mixed Mode Transit Systems' },
  'towing': { cat: 'towing', naics: '488410', desc: 'Motor Vehicle Towing' },
  'funeral': { cat: 'funeral', naics: '812210', desc: 'Funeral Homes' },
  'grocery': { cat: 'grocery', naics: '445110', desc: 'Supermarkets' },
  'optometry': { cat: 'optometry', naics: '621320', desc: 'Offices of Optometrists' },
  'eye': { cat: 'optometry', naics: '621320', desc: 'Offices of Optometrists' },
  'logging': { cat: 'forestry-logging', naics: '113310', desc: 'Logging' },
  'forestry': { cat: 'forestry-logging', naics: '113110', desc: 'Timber Tract Operations' },
  'engineering': { cat: 'engineering', naics: '541330', desc: 'Engineering Services' },
  'survery': { cat: 'engineering', naics: '541370', desc: 'Surveying Services' },
  'environmental': { cat: 'environmental', naics: '541620', desc: 'Environmental Consulting' },
  'mining': { cat: 'mining', naics: '212111', desc: 'Bituminous Coal Mining' },
  'church': { cat: 'religious', naics: '813110', desc: 'Religious Organizations' },
  'religious': { cat: 'religious', naics: '813110', desc: 'Religious Organizations' },
  'childcare': { cat: 'childcare', naics: '624410', desc: 'Child Day Care Services' },
  'daycare': { cat: 'childcare', naics: '624410', desc: 'Child Day Care Services' },
  'first nation': { cat: 'first-nations', naics: '921150', desc: 'First Nations Government' },
  'indigenous': { cat: 'first-nations', naics: '921150', desc: 'First Nations Government' },
  'senior': { cat: 'seniors', naics: '623110', desc: 'Nursing Care Facilities' },
  'cannabis': { cat: 'cannabis', naics: '453998', desc: 'Cannabis Retailers' }
};

function mapCategory(rawCat, businessName) {
  if (!rawCat && !businessName) return { cat: 'other', naics: '541990', desc: 'All Other Professional Services' };
  const lower = (rawCat + ' ' + businessName).toLowerCase();
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lower.includes(key)) return value;
  }
  return { cat: 'other', naics: '541990', desc: 'All Other Professional Services' };
}

function generateId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

const data = JSON.parse(fs.readFileSync('scripts/port-alberni-details.json', 'utf8'));

const tsCode = data.map(m => {
  const catInfo = mapCategory(m.category, m.name);
  const id = generateId(m.name);
  const addr = (m.address || '').replace(/null/gi, '').trim();
  const ph = (m.phone || '').replace(/null/gi, '').trim();
  
  return `  {
    id: '${id.replace(/'/g, "\\'")}',
    chamberId: 'port-alberni-chamber',
    businessName: '${(m.name || '').replace(/'/g, "\\'")}',
    category: '${catInfo.cat}',
    subcategory: '${(m.category || '').replace(/'/g, "\\'")}',
    naicsCode: '${catInfo.naics}',
    naicsTitle: '${catInfo.desc.replace(/'/g, "\\'")}',
    naicsSector: '${catInfo.naics.substring(0,2)}',
    naicsSubsector: '${catInfo.naics.substring(0,3)}',${addr ? `\n    address: '${addr.replace(/'/g, "\\'").substring(0, 100)}',` : ''}${ph ? `\n    phone: '${ph.replace(/'/g, "\\'")}',` : ''}${m.website ? `\n    website: '${m.website.replace(/'/g, "\\'")}',` : '\n    websiteNeedsCollection: true,'}
    municipality: 'Port Alberni',
    region: 'Alberni-Clayoquot'
  }`;
}).join(',\n');

fs.writeFileSync('scripts/port-alberni-ts-corrected.txt', 
  `  // ============================================================================
  // PORT ALBERNI - Alberni Valley Chamber of Commerce
  // Scraped: December 2024 | Coverage: 88% (175/~200 members)
  // ============================================================================
${tsCode}`);

console.log(`Generated ${data.length} corrected Port Alberni entries`);
