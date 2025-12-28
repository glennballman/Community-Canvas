const fs = require('fs');

// NAICS mapping based on category
const naicsMap = {
  'Accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'Associations & Organizations': { code: '813410', subsector: '813', sector: '81', title: 'Civic and Social Organizations' },
  'Professional Services': { code: '541990', subsector: '541', sector: '54', title: 'Professional Services' },
  'Food & Beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'Health & Wellness': { code: '621999', subsector: '621', sector: '62', title: 'Health Care Services' },
  'Construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial Building Construction' },
  'Home & Garden': { code: '444130', subsector: '444', sector: '44', title: 'Hardware Stores' },
  'Automotive': { code: '441110', subsector: '441', sector: '44', title: 'New Car Dealers' },
  'Real Estate': { code: '531210', subsector: '531', sector: '53', title: 'Real Estate Agents and Brokers' },
  'Financial Services': { code: '522110', subsector: '522', sector: '52', title: 'Commercial Banking' },
  'Shopping': { code: '452210', subsector: '452', sector: '45', title: 'Department Stores' },
  'Attractions': { code: '712190', subsector: '712', sector: '71', title: 'Nature Parks and Attractions' },
  'Retail Specialty': { code: '453998', subsector: '453', sector: '45', title: 'Specialty Retail Stores' },
  'Clothing': { code: '448140', subsector: '448', sector: '44', title: 'Family Clothing Stores' },
  'Personal Care': { code: '812111', subsector: '812', sector: '81', title: 'Barber Shops' },
  'Sports & Recreation': { code: '713940', subsector: '713', sector: '71', title: 'Fitness and Recreation' },
  'Media & Communications': { code: '519130', subsector: '519', sector: '51', title: 'Internet Publishing' },
  'Transportation': { code: '484110', subsector: '484', sector: '48', title: 'General Freight Trucking' },
  'Technology': { code: '541512', subsector: '541', sector: '54', title: 'Computer Systems Design' },
  'Waste & Recycling': { code: '562111', subsector: '562', sector: '56', title: 'Solid Waste Collection' },
};

// Category mapping for our schema
const categoryMap = {
  'Accommodation': 'accommodation',
  'Associations & Organizations': 'community',
  'Professional Services': 'professional-services',
  'Food & Beverage': 'restaurant',
  'Health & Wellness': 'healthcare',
  'Construction': 'construction',
  'Home & Garden': 'retail',
  'Automotive': 'automotive',
  'Real Estate': 'real-estate',
  'Financial Services': 'financial',
  'Shopping': 'retail',
  'Attractions': 'recreation',
  'Retail Specialty': 'retail',
  'Clothing': 'retail',
  'Personal Care': 'personal-services',
  'Sports & Recreation': 'recreation',
  'Media & Communications': 'media',
  'Transportation': 'transportation',
  'Technology': 'technology',
  'Waste & Recycling': 'utilities',
};

const rawData = JSON.parse(fs.readFileSync('scripts/parksville-raw.json', 'utf8'));

const processed = rawData.map(m => {
  const naics = naicsMap[m.category] || { code: null, subsector: null, sector: null, title: null };
  const cat = categoryMap[m.category] || 'other';
  
  return {
    businessName: m.name,
    category: cat,
    website: m.website || null,
    phone: m.phone || null,
    address: m.address ? `${m.address}, ${m.city}, BC` : null,
    naicsCode: naics.code,
    naicsSubsector: naics.subsector,
    naicsSector: naics.sector,
    naicsTitle: naics.title,
    municipality: m.city || 'Parksville',
    region: 'Vancouver Island'
  };
});

fs.writeFileSync('scripts/parksville-integration.json', JSON.stringify(processed, null, 2));
console.log('Processed', processed.length, 'members');
console.log('Sample:', JSON.stringify(processed[0], null, 2));
