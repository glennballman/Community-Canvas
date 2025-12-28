const fs = require('fs');

// Valid BusinessCategory mapping from source categories
const categoryMap = {
  'Accommodation': 'accommodation',
  'Associations & Organizations': 'charity-nonprofit',
  'Professional Services': 'consulting',
  'Food & Beverage': 'food-beverage',
  'Health & Wellness': 'healthcare',
  'Construction': 'construction',
  'Home & Garden': 'hardware-supplies',
  'Automotive': 'automotive',
  'Real Estate': 'real-estate',
  'Financial Services': 'banking-finance',
  'Shopping': 'retail',
  'Attractions': 'recreation',
  'Retail Specialty': 'retail',
  'Clothing': 'retail',
  'Personal Care': 'salon-spa',
  'Sports & Recreation': 'recreation',
  'Media & Communications': 'media-marketing',
  'Transportation': 'transportation',
  'Technology': 'technology',
  'Waste & Recycling': 'environmental',
};

// NAICS mapping
const naicsMap = {
  'accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'charity-nonprofit': { code: '813410', subsector: '813', sector: '81', title: 'Civic and Social Organizations' },
  'consulting': { code: '541611', subsector: '541', sector: '54', title: 'Management Consulting' },
  'food-beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'healthcare': { code: '621999', subsector: '621', sector: '62', title: 'Health Care Services' },
  'construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial Building Construction' },
  'hardware-supplies': { code: '444130', subsector: '444', sector: '44', title: 'Hardware Stores' },
  'automotive': { code: '441110', subsector: '441', sector: '44', title: 'New Car Dealers' },
  'real-estate': { code: '531210', subsector: '531', sector: '53', title: 'Real Estate Agents and Brokers' },
  'banking-finance': { code: '522110', subsector: '522', sector: '52', title: 'Commercial Banking' },
  'retail': { code: '452210', subsector: '452', sector: '45', title: 'Department Stores' },
  'recreation': { code: '712190', subsector: '712', sector: '71', title: 'Nature Parks and Attractions' },
  'salon-spa': { code: '812111', subsector: '812', sector: '81', title: 'Barber Shops' },
  'media-marketing': { code: '541810', subsector: '541', sector: '54', title: 'Advertising Agencies' },
  'transportation': { code: '484110', subsector: '484', sector: '48', title: 'General Freight Trucking' },
  'technology': { code: '541512', subsector: '541', sector: '54', title: 'Computer Systems Design' },
  'environmental': { code: '562111', subsector: '562', sector: '56', title: 'Solid Waste Collection' },
};

// Filter out bad entries
const badNames = [
  'nanoose economic development',
  'filter',
  'print',
  'this category',
  'all',
  'browse by',
];

const rawData = JSON.parse(fs.readFileSync('scripts/parksville-raw.json', 'utf8'));

const cleaned = rawData.filter(m => {
  const nameLower = m.name?.toLowerCase().trim() || '';
  // Skip navigation artifacts
  for (const bad of badNames) {
    if (nameLower.includes(bad)) return false;
  }
  // Skip very short names
  if (nameLower.length < 3) return false;
  // Skip if URL contains browse-by or governmentutilities (navigation)
  if (m.website?.includes('browse-by') || m.website?.includes('governmentutilities')) return false;
  return true;
});

const processed = cleaned.map(m => {
  const cat = categoryMap[m.category] || 'other';
  const naics = naicsMap[cat] || {};
  
  return {
    businessName: m.name,
    category: cat,
    website: m.website || null,
    phone: m.phone || null,
    address: m.address ? `${m.address}, ${m.city}, BC` : null,
    naicsCode: naics.code || null,
    naicsSubsector: naics.subsector || null,
    naicsSector: naics.sector || null,
    naicsTitle: naics.title || null,
    municipality: m.city || 'Parksville',
    region: 'Vancouver Island'
  };
});

fs.writeFileSync('scripts/parksville-integration.json', JSON.stringify(processed, null, 2));
console.log('Cleaned from', rawData.length, 'to', processed.length, 'members');
console.log('Sample:', JSON.stringify(processed[0], null, 2));
