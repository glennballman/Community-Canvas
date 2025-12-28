const fs = require('fs');

// Load existing Chamber scrape
const chamberData = JSON.parse(fs.readFileSync('scripts/saltspring-pw.json', 'utf8'));
console.log('Chamber data:', chamberData.length);

// Load alternative sources
const altData = JSON.parse(fs.readFileSync('scripts/saltspring-alt.json', 'utf8'));
console.log('Alternative sources:', altData.length);

// Category mapping
const naicsForCategory = {
  'accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'accounting': { code: '541211', subsector: '541', sector: '54', title: 'Offices of Certified Public Accountants' },
  'agriculture': { code: '111419', subsector: '111', sector: '11', title: 'Agriculture and Farming' },
  'arts-culture': { code: '711110', subsector: '711', sector: '71', title: 'Theatre and Dance Companies' },
  'automotive': { code: '811111', subsector: '811', sector: '81', title: 'General Automotive Repair' },
  'banking-finance': { code: '522110', subsector: '522', sector: '52', title: 'Commercial Banking' },
  'charity-nonprofit': { code: '813410', subsector: '813', sector: '81', title: 'Civic and Social Organizations' },
  'construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial Building Construction' },
  'consulting': { code: '541611', subsector: '541', sector: '54', title: 'Administrative Management Consulting' },
  'dental': { code: '621210', subsector: '621', sector: '62', title: 'Offices of Dentists' },
  'fitness-wellness': { code: '713940', subsector: '713', sector: '71', title: 'Fitness and Recreation Centres' },
  'food-beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'government': { code: '921110', subsector: '921', sector: '92', title: 'Executive Offices' },
  'grocery': { code: '445110', subsector: '445', sector: '44', title: 'Supermarkets and Grocery Stores' },
  'healthcare': { code: '621999', subsector: '621', sector: '62', title: 'Miscellaneous Health Practitioners' },
  'hospitality': { code: '561520', subsector: '561', sector: '56', title: 'Tour Operators' },
  'it-technology': { code: '541512', subsector: '541', sector: '54', title: 'Computer Systems Design Services' },
  'landscaping': { code: '561730', subsector: '561', sector: '56', title: 'Landscaping Services' },
  'manufacturing': { code: '332710', subsector: '332', sector: '33', title: 'Machine Shops' },
  'pets': { code: '541940', subsector: '541', sector: '54', title: 'Veterinary Services' },
  'photography': { code: '541921', subsector: '541', sector: '54', title: 'Photography Studios' },
  'real-estate': { code: '531210', subsector: '531', sector: '53', title: 'Offices of Real Estate Agents' },
  'recreation': { code: '713990', subsector: '713', sector: '71', title: 'Recreation Industries' },
  'restaurant': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'retail': { code: '452210', subsector: '452', sector: '44', title: 'Department Stores' },
  'spa-beauty': { code: '812111', subsector: '812', sector: '81', title: 'Barber Shops' },
  'taxi-rideshare': { code: '485310', subsector: '485', sector: '48', title: 'Taxi Service' },
  'transit': { code: '485111', subsector: '485', sector: '48', title: 'Mixed Mode Transit Systems' },
  'winery-brewery': { code: '312130', subsector: '312', sector: '31', title: 'Wineries' },
  'other': { code: '541990', subsector: '541', sector: '54', title: 'All Other Professional Services' },
};

// Chamber industry to category mapping
const industryToCategory = {
  'Accommodation': 'accommodation',
  'Agriculture': 'agriculture',
  'Arts + Culture': 'arts-culture',
  'Business Services': 'consulting',
  'Community + Government': 'government',
  'Construction + Trades': 'construction',
  'Entrepreneur': 'consulting',
  'Environmental + Sustainability': 'environmental',
  'Events + Hospitality': 'hospitality',
  'Food + Drink': 'food-beverage',
  'Health + Wellness': 'healthcare',
  'Home + Garden': 'home-services',
  'Media + Marketing': 'marketing-advertising',
  'Professional Services': 'consulting',
  'Real Estate': 'real-estate',
  'Recreation': 'recreation',
  'Retail': 'retail',
  'Spirituality + Personal Growth': 'healthcare',
  'Transportation': 'transit',
};

// Normalize chamber data
const normalizedChamber = chamberData.map(m => {
  const industries = m.industry ? m.industry.split(',').map(i => i.trim()) : [];
  let category = 'other';
  for (const ind of industries) {
    if (industryToCategory[ind]) {
      category = industryToCategory[ind];
      break;
    }
  }
  return {
    businessName: m.businessName,
    website: m.website || '',
    category: category,
    source: 'chamber'
  };
});

// Normalize alt data
const normalizedAlt = altData.map(m => ({
  businessName: m.name,
  website: m.website || '',
  category: m.category,
  source: 'alt'
}));

// Combine and deduplicate
const all = [...normalizedChamber, ...normalizedAlt];
const seen = new Set();
const unique = all.filter(m => {
  const key = m.businessName.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/saltspringisland/g, 'saltspring')
    .replace(/ssi/g, 'saltspring');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log('Combined unique:', unique.length);

// Add NAICS
const withNaics = unique.map(m => {
  const naics = naicsForCategory[m.category] || naicsForCategory['other'];
  return {
    businessName: m.businessName,
    website: m.website,
    category: m.category,
    naicsCode: naics.code,
    naicsSubsector: naics.subsector,
    naicsSector: naics.sector,
    naicsTitle: naics.title,
    municipality: 'Salt Spring Island',
    region: 'Capital'
  };
});

// Count by category
const byCat = {};
withNaics.forEach(m => {
  byCat[m.category] = (byCat[m.category] || 0) + 1;
});

console.log('\nCategory breakdown:');
Object.entries(byCat).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

fs.writeFileSync('scripts/saltspring-merged.json', JSON.stringify(withNaics, null, 2));
console.log('\nSaved merged data to scripts/saltspring-merged.json');
