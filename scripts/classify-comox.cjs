const fs = require('fs');

// Load raw data
const raw = JSON.parse(fs.readFileSync('scripts/comox-raw.json', 'utf8'));
console.log('Raw entries:', raw.length);

// Junk patterns
const junkPatterns = [
  /^join now$/i,
  /^sort by/i,
  /^search/i,
  /^member login/i,
  /^directory$/i,
  /^contact us$/i,
  /^about$/i,
  /^home$/i,
  /^\(\d{3}\)/,
  /^\d{3}[-.\s]\d{3}/,
  /^\+\d+$/,
  /^[A-Z]$/,
  /^view map$/i,
  /^more info$/i,
  /^corporate members$/i,
  /^individual members$/i,
  /^V\d[A-Z]\s?\d[A-Z]\d$/i,
];

// Clean
const cleaned = raw.filter(m => {
  if (!m.businessName) return false;
  const name = m.businessName.trim();
  if (name.length < 3) return false;
  for (const pattern of junkPatterns) {
    if (pattern.test(name)) return false;
  }
  if (/^[\d\s\-\(\)\.+]+$/.test(name)) return false;
  return true;
});

console.log('After cleaning:', cleaned.length);

// Deduplicate
const seen = new Set();
const unique = cleaned.filter(m => {
  const key = m.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log('After deduplication:', unique.length);

// Category mapping (same as Nanaimo)
const categoryMapping = {
  'accommodation': ['hotel', 'motel', 'inn', 'resort', 'lodge', 'hostel', 'b&b', 'bed and breakfast', 'vacation rental', 'cabin', 'cottage', 'suites', 'guest house'],
  'accounting': ['accounting', 'accountant', 'cpa', 'bookkeeping', 'tax service', 'payroll'],
  'agriculture': ['farm', 'nursery', 'agricultural', 'greenhouse', 'garden center', 'shellfish', 'oyster'],
  'arts-culture': ['art', 'gallery', 'museum', 'theatre', 'theater', 'artist', 'studio', 'creative', 'music', 'dance'],
  'automotive': ['auto', 'car', 'vehicle', 'tire', 'mechanic', 'collision', 'body shop', 'detailing', 'oil change', 'transmission', 'brake', 'muffler', 'automotive', 'rv', 'trailer', 'motorcycle'],
  'banking-finance': ['bank', 'credit union', 'mortgage', 'financial', 'investment', 'wealth', 'advisor', 'securities', 'brokerage', 'financing', 'capital', 'scotia'],
  'cannabis': ['cannabis', 'marijuana', 'dispensary'],
  'charity-nonprofit': ['society', 'foundation', 'charity', 'non-profit', 'nonprofit', 'volunteer', 'association', 'club', 'legion', 'rotary', 'lions', 'kiwanis', 'inclusion'],
  'childcare': ['daycare', 'preschool', 'childcare', 'montessori', 'child care'],
  'cleaning-janitorial': ['cleaning', 'janitorial', 'maid', 'housekeeping'],
  'construction': ['construction', 'contractor', 'builder', 'excavation', 'paving', 'concrete', 'framing', 'drywall', 'demolition', 'millwork'],
  'consulting': ['consulting', 'consultant', 'management consultant', 'business advisor'],
  'courier-delivery': ['courier', 'delivery', 'shipping', 'express'],
  'dental': ['dental', 'dentist', 'orthodontist', 'denturist'],
  'education': ['school', 'college', 'university', 'academy', 'institute', 'learning', 'training', 'tutoring', 'education'],
  'electrical': ['electrical', 'electrician'],
  'engineering': ['engineering', 'engineer', 'surveyor', 'surveying'],
  'entertainment': ['entertainment', 'event', 'venue', 'concert', 'show', 'performance'],
  'environmental': ['environmental', 'recycling', 'waste management', 'green business', 'eco', 'solar', 'energy'],
  'first-nations': ['first nation', 'indigenous', 'band office', 'treaty'],
  'fishing-marine': ['fishing', 'marine', 'boat', 'yacht', 'charter fishing', 'seafood'],
  'fitness-wellness': ['fitness', 'gym', 'yoga', 'pilates', 'wellness', 'health club', 'crossfit', 'physiotherapy'],
  'food-beverage': ['bakery', 'catering', 'food', 'bistro', 'kitchen', 'barbecue'],
  'forestry-logging': ['forestry', 'logging', 'lumber', 'sawmill', 'timber'],
  'funeral': ['funeral', 'memorial', 'cremation', 'cemetery'],
  'government': ['city of', 'regional district', 'government', 'ministry', 'federal', 'provincial', 'municipal', 'town of'],
  'grocery': ['grocery', 'supermarket', 'market', 'deli', 'butcher', 'food store'],
  'hardware-supplies': ['hardware', 'building supplies', 'lumber yard'],
  'healthcare': ['health', 'medical', 'clinic', 'hospital', 'nursing', 'care home', 'therapy', 'counselling', 'psychology', 'naturopath', 'acupuncture'],
  'heating-cooling': ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'sheet metal'],
  'home-services': ['renovations', 'remodeling', 'handyman', 'home improvement'],
  'hospitality': ['tour', 'tourism', 'adventure', 'whale watching', 'kayak', 'paddleboard'],
  'insurance': ['insurance', 'insure'],
  'it-technology': ['technology', 'software', 'it ', 'computer', 'tech', 'digital', 'cyber', 'data', 'cloud', 'network', 'telecom', 'internet', 'app', 'developer', 'programming', 'web design', 'web development', 'electronic'],
  'landscaping': ['landscaping', 'lawn', 'tree service', 'arborist', 'garden maintenance'],
  'legal': ['law', 'lawyer', 'attorney', 'legal', 'notary', 'paralegal', 'barrister', 'solicitor'],
  'manufacturing': ['manufacturing', 'factory', 'industrial', 'fabrication', 'production', 'processing', 'assembly', 'welding', 'metal', 'steel', 'plastics', 'woodworking'],
  'marketing-advertising': ['marketing', 'advertising', 'pr', 'public relations', 'branding', 'design', 'graphic'],
  'media': ['newspaper', 'radio', 'tv', 'television', 'media', 'publishing', 'magazine'],
  'medical': ['doctor', 'physician', 'specialist', 'medical center', 'walk-in'],
  'mining': ['mining', 'mineral', 'quarry', 'aggregate'],
  'optometry': ['optometrist', 'optometry', 'eyewear', 'optical', 'vision'],
  'pets': ['veterinary', 'vet', 'pet', 'grooming', 'kennel', 'animal'],
  'pharmacy': ['pharmacy', 'pharma', 'drugstore'],
  'photography': ['photography', 'photographer', 'videographer', 'photo studio'],
  'plumbing': ['plumbing', 'plumber'],
  'printing': ['printing', 'print shop', 'signage', 'sign shop', 'signs'],
  'property-management': ['property management', 'strata', 'building management', 'reit'],
  'real-estate': ['real estate', 'realtor', 'realty', 'property', 'homes', 'housing', 'development'],
  'recreation': ['recreation', 'sports', 'arena', 'pool', 'golf'],
  'religious': ['church', 'religious', 'temple', 'mosque', 'synagogue', 'faith'],
  'restaurant': ['restaurant', 'cafe', 'coffee', 'pizza', 'sushi', 'pub', 'bar', 'grill', 'diner', 'eatery', 'takeout'],
  'retail': ['store', 'shop', 'retail', 'boutique', 'clothing', 'fashion', 'shoes', 'jewelry', 'furniture', 'appliance', 'gift', 'book', 'sporting', 'electronics', 'florist', 'flower'],
  'roofing': ['roofing', 'roofer'],
  'security': ['security', 'alarm', 'surveillance'],
  'seniors': ['senior', 'retirement', 'elder care', 'assisted living', 'berwick'],
  'spa-beauty': ['spa', 'salon', 'beauty', 'hair', 'nail', 'esthetic', 'massage'],
  'storage': ['storage', 'warehouse', 'self-storage'],
  'taxi-rideshare': ['taxi', 'cab', 'rideshare', 'limo', 'limousine', 'shuttle'],
  'telecommunications': ['phone', 'wireless', 'cable', 'internet provider'],
  'towing': ['towing', 'tow truck'],
  'transit': ['transit', 'bus service'],
  'trucking-freight': ['trucking', 'freight', 'hauling', 'moving'],
  'utilities': ['hydro', 'power', 'electric utility', 'gas utility', 'water utility'],
  'veterinary': ['veterinary', 'veterinarian', 'animal hospital'],
  'winery-brewery': ['winery', 'brewery', 'distillery', 'wine', 'beer', 'spirits'],
};

// NAICS mappings
const naicsForCategory = {
  'accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'accounting': { code: '541211', subsector: '541', sector: '54', title: 'Offices of Certified Public Accountants' },
  'agriculture': { code: '111419', subsector: '111', sector: '11', title: 'Agriculture and Farming' },
  'arts-culture': { code: '711110', subsector: '711', sector: '71', title: 'Theatre and Dance Companies' },
  'automotive': { code: '811111', subsector: '811', sector: '81', title: 'General Automotive Repair' },
  'banking-finance': { code: '522110', subsector: '522', sector: '52', title: 'Commercial Banking' },
  'cannabis': { code: '453998', subsector: '453', sector: '44', title: 'Cannabis Stores' },
  'charity-nonprofit': { code: '813410', subsector: '813', sector: '81', title: 'Civic and Social Organizations' },
  'childcare': { code: '624410', subsector: '624', sector: '62', title: 'Child Day Care Services' },
  'cleaning-janitorial': { code: '561720', subsector: '561', sector: '56', title: 'Janitorial Services' },
  'construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial Building Construction' },
  'consulting': { code: '541611', subsector: '541', sector: '54', title: 'Administrative Management Consulting' },
  'courier-delivery': { code: '492110', subsector: '492', sector: '49', title: 'Couriers and Express Delivery' },
  'dental': { code: '621210', subsector: '621', sector: '62', title: 'Offices of Dentists' },
  'education': { code: '611110', subsector: '611', sector: '61', title: 'Elementary and Secondary Schools' },
  'electrical': { code: '238210', subsector: '238', sector: '23', title: 'Electrical Contractors' },
  'engineering': { code: '541330', subsector: '541', sector: '54', title: 'Engineering Services' },
  'entertainment': { code: '711310', subsector: '711', sector: '71', title: 'Promoters of Events' },
  'environmental': { code: '541620', subsector: '541', sector: '54', title: 'Environmental Consulting' },
  'first-nations': { code: '813920', subsector: '813', sector: '81', title: 'Professional Organizations' },
  'fishing-marine': { code: '114111', subsector: '114', sector: '11', title: 'Finfish Fishing' },
  'fitness-wellness': { code: '713940', subsector: '713', sector: '71', title: 'Fitness and Recreation Centres' },
  'food-beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'forestry-logging': { code: '113110', subsector: '113', sector: '11', title: 'Timber Tract Operations' },
  'funeral': { code: '812210', subsector: '812', sector: '81', title: 'Funeral Homes and Services' },
  'government': { code: '921110', subsector: '921', sector: '92', title: 'Executive Offices' },
  'grocery': { code: '445110', subsector: '445', sector: '44', title: 'Supermarkets and Grocery Stores' },
  'hardware-supplies': { code: '444130', subsector: '444', sector: '44', title: 'Hardware Stores' },
  'healthcare': { code: '621999', subsector: '621', sector: '62', title: 'Miscellaneous Health Practitioners' },
  'heating-cooling': { code: '238220', subsector: '238', sector: '23', title: 'Plumbing and HVAC Contractors' },
  'home-services': { code: '236118', subsector: '236', sector: '23', title: 'Residential Remodelers' },
  'hospitality': { code: '561520', subsector: '561', sector: '56', title: 'Tour Operators' },
  'insurance': { code: '524210', subsector: '524', sector: '52', title: 'Insurance Agencies and Brokerages' },
  'it-technology': { code: '541512', subsector: '541', sector: '54', title: 'Computer Systems Design Services' },
  'landscaping': { code: '561730', subsector: '561', sector: '56', title: 'Landscaping Services' },
  'legal': { code: '541110', subsector: '541', sector: '54', title: 'Offices of Lawyers' },
  'manufacturing': { code: '332710', subsector: '332', sector: '33', title: 'Machine Shops' },
  'marketing-advertising': { code: '541810', subsector: '541', sector: '54', title: 'Advertising Agencies' },
  'media': { code: '511110', subsector: '511', sector: '51', title: 'Newspaper Publishers' },
  'medical': { code: '621111', subsector: '621', sector: '62', title: 'Offices of Physicians' },
  'mining': { code: '212210', subsector: '212', sector: '21', title: 'Iron Ore Mining' },
  'optometry': { code: '621320', subsector: '621', sector: '62', title: 'Offices of Optometrists' },
  'pets': { code: '541940', subsector: '541', sector: '54', title: 'Veterinary Services' },
  'pharmacy': { code: '446110', subsector: '446', sector: '44', title: 'Pharmacies and Drug Stores' },
  'photography': { code: '541921', subsector: '541', sector: '54', title: 'Photography Studios' },
  'plumbing': { code: '238220', subsector: '238', sector: '23', title: 'Plumbing and HVAC Contractors' },
  'printing': { code: '323111', subsector: '323', sector: '32', title: 'Commercial Printing' },
  'property-management': { code: '531311', subsector: '531', sector: '53', title: 'Residential Property Managers' },
  'real-estate': { code: '531210', subsector: '531', sector: '53', title: 'Offices of Real Estate Agents' },
  'recreation': { code: '713990', subsector: '713', sector: '71', title: 'Recreation Industries' },
  'religious': { code: '813110', subsector: '813', sector: '81', title: 'Religious Organizations' },
  'restaurant': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'retail': { code: '452210', subsector: '452', sector: '44', title: 'Department Stores' },
  'roofing': { code: '238160', subsector: '238', sector: '23', title: 'Roofing Contractors' },
  'security': { code: '561612', subsector: '561', sector: '56', title: 'Security Guards and Patrol Services' },
  'seniors': { code: '623110', subsector: '623', sector: '62', title: 'Nursing Care Facilities' },
  'spa-beauty': { code: '812111', subsector: '812', sector: '81', title: 'Barber Shops' },
  'storage': { code: '493110', subsector: '493', sector: '49', title: 'General Warehousing' },
  'taxi-rideshare': { code: '485310', subsector: '485', sector: '48', title: 'Taxi Service' },
  'telecommunications': { code: '517311', subsector: '517', sector: '51', title: 'Wired Telecommunications Carriers' },
  'towing': { code: '488410', subsector: '488', sector: '48', title: 'Motor Vehicle Towing' },
  'transit': { code: '485111', subsector: '485', sector: '48', title: 'Mixed Mode Transit Systems' },
  'trucking-freight': { code: '484110', subsector: '484', sector: '48', title: 'General Freight Trucking, Local' },
  'utilities': { code: '221310', subsector: '221', sector: '22', title: 'Water Supply and Irrigation Systems' },
  'veterinary': { code: '541940', subsector: '541', sector: '54', title: 'Veterinary Services' },
  'winery-brewery': { code: '312130', subsector: '312', sector: '31', title: 'Wineries' },
  'other': { code: '541990', subsector: '541', sector: '54', title: 'All Other Professional Services' },
};

function classifyBusiness(name) {
  const lowerName = name.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryMapping)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        const naics = naicsForCategory[category];
        return {
          category,
          naicsCode: naics?.code,
          naicsSubsector: naics?.subsector,
          naicsSector: naics?.sector,
          naicsTitle: naics?.title
        };
      }
    }
  }
  
  const naics = naicsForCategory['other'];
  return {
    category: 'other',
    naicsCode: naics.code,
    naicsSubsector: naics.subsector,
    naicsSector: naics.sector,
    naicsTitle: naics.title
  };
}

// Classify all members
const classified = unique.map(m => {
  const classification = classifyBusiness(m.businessName);
  return {
    businessName: m.businessName.trim(),
    address: '',
    phone: '',
    website: '',
    municipality: 'Courtenay',
    region: 'Comox Valley Regional District',
    ...classification
  };
});

// Count by category
const byCat = {};
classified.forEach(m => {
  byCat[m.category] = (byCat[m.category] || 0) + 1;
});

console.log('\nClassification breakdown:');
Object.entries(byCat).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

fs.writeFileSync('scripts/comox-integration.json', JSON.stringify(classified, null, 2));
console.log('\nSaved to scripts/comox-integration.json');
