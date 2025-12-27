const fs = require('fs');

// Simple NAICS classification based on keywords
const classifyBusiness = (name, category) => {
  const combined = `${name} ${category}`.toLowerCase();
  
  // Category-based classifications
  const categoryMappings = {
    'accommodation': { code: '721110', category: 'accommodation', sector: '72', subsector: '721', title: 'Hotels and Motels' },
    'hotel': { code: '721110', category: 'accommodation', sector: '72', subsector: '721', title: 'Hotels and Motels' },
    'inn': { code: '721110', category: 'accommodation', sector: '72', subsector: '721', title: 'Hotels and Motels' },
    'b&b': { code: '721191', category: 'accommodation', sector: '72', subsector: '721', title: 'Bed-and-Breakfast Inns' },
    'bed and breakfast': { code: '721191', category: 'accommodation', sector: '72', subsector: '721', title: 'Bed-and-Breakfast Inns' },
    'resort': { code: '721110', category: 'hospitality', sector: '72', subsector: '721', title: 'Resort Hotels' },
    'restaurant': { code: '722511', category: 'restaurant', sector: '72', subsector: '722', title: 'Full-Service Restaurants' },
    'cafe': { code: '722515', category: 'restaurant', sector: '72', subsector: '722', title: 'Snack and Coffee Shops' },
    'coffee': { code: '722515', category: 'restaurant', sector: '72', subsector: '722', title: 'Snack and Coffee Shops' },
    'bakery': { code: '311811', category: 'food', sector: '31-33', subsector: '311', title: 'Retail Bakeries' },
    'pub': { code: '722410', category: 'restaurant', sector: '72', subsector: '722', title: 'Drinking Places' },
    'bar': { code: '722410', category: 'restaurant', sector: '72', subsector: '722', title: 'Drinking Places' },
    'brewery': { code: '312120', category: 'winery-brewery', sector: '31-33', subsector: '312', title: 'Breweries' },
    'winery': { code: '312130', category: 'winery-brewery', sector: '31-33', subsector: '312', title: 'Wineries' },
    'tour': { code: '561520', category: 'tourism', sector: '56', subsector: '561', title: 'Tour Operators' },
    'surf': { code: '611620', category: 'recreation', sector: '61', subsector: '611', title: 'Sports Instruction' },
    'kayak': { code: '532292', category: 'recreation', sector: '53', subsector: '532', title: 'Recreational Goods Rental' },
    'whale': { code: '487210', category: 'tourism', sector: '48-49', subsector: '487', title: 'Scenic and Sightseeing Transportation, Water' },
    'fishing': { code: '487210', category: 'fishing-marine', sector: '48-49', subsector: '487', title: 'Charter Fishing' },
    'charter': { code: '487210', category: 'fishing-marine', sector: '48-49', subsector: '487', title: 'Charter Boats' },
    'gallery': { code: '453920', category: 'arts-culture', sector: '44-45', subsector: '453', title: 'Art Dealers' },
    'art': { code: '453920', category: 'arts-culture', sector: '44-45', subsector: '453', title: 'Art Dealers' },
    'spa': { code: '812199', category: 'spa-beauty', sector: '81', subsector: '812', title: 'Other Personal Care Services' },
    'salon': { code: '812111', category: 'spa-beauty', sector: '81', subsector: '812', title: 'Barber Shops' },
    'hair': { code: '812111', category: 'spa-beauty', sector: '81', subsector: '812', title: 'Barber Shops' },
    'barber': { code: '812111', category: 'spa-beauty', sector: '81', subsector: '812', title: 'Barber Shops' },
    'real estate': { code: '531210', category: 'real-estate', sector: '53', subsector: '531', title: 'Offices of Real Estate Agents' },
    'realty': { code: '531210', category: 'real-estate', sector: '53', subsector: '531', title: 'Offices of Real Estate Agents' },
    'construction': { code: '236220', category: 'construction', sector: '23', subsector: '236', title: 'Commercial and Institutional Building Construction' },
    'contractor': { code: '238990', category: 'construction', sector: '23', subsector: '238', title: 'All Other Specialty Trade Contractors' },
    'plumb': { code: '238220', category: 'construction', sector: '23', subsector: '238', title: 'Plumbing, Heating, and Air-Conditioning Contractors' },
    'electric': { code: '238210', category: 'construction', sector: '23', subsector: '238', title: 'Electrical Contractors' },
    'roofing': { code: '238160', category: 'construction', sector: '23', subsector: '238', title: 'Roofing Contractors' },
    'landscap': { code: '561730', category: 'landscaping', sector: '56', subsector: '561', title: 'Landscaping Services' },
    'insurance': { code: '524210', category: 'insurance', sector: '52', subsector: '524', title: 'Insurance Agencies and Brokerages' },
    'bank': { code: '522110', category: 'banking-finance', sector: '52', subsector: '522', title: 'Commercial Banking' },
    'credit union': { code: '522130', category: 'banking-finance', sector: '52', subsector: '522', title: 'Credit Unions' },
    'law': { code: '541110', category: 'legal', sector: '54', subsector: '541', title: 'Offices of Lawyers' },
    'legal': { code: '541110', category: 'legal', sector: '54', subsector: '541', title: 'Offices of Lawyers' },
    'attorney': { code: '541110', category: 'legal', sector: '54', subsector: '541', title: 'Offices of Lawyers' },
    'accountant': { code: '541211', category: 'accounting', sector: '54', subsector: '541', title: 'Offices of Certified Public Accountants' },
    'accounting': { code: '541211', category: 'accounting', sector: '54', subsector: '541', title: 'Offices of Certified Public Accountants' },
    'dentist': { code: '621210', category: 'healthcare', sector: '62', subsector: '621', title: 'Offices of Dentists' },
    'dental': { code: '621210', category: 'healthcare', sector: '62', subsector: '621', title: 'Offices of Dentists' },
    'medical': { code: '621111', category: 'healthcare', sector: '62', subsector: '621', title: 'Offices of Physicians' },
    'clinic': { code: '621111', category: 'healthcare', sector: '62', subsector: '621', title: 'Offices of Physicians' },
    'pharmacy': { code: '446110', category: 'pharmacy', sector: '44-45', subsector: '446', title: 'Pharmacies and Drug Stores' },
    'veterinar': { code: '541940', category: 'healthcare', sector: '54', subsector: '541', title: 'Veterinary Services' },
    'pet': { code: '453910', category: 'retail', sector: '44-45', subsector: '453', title: 'Pet and Pet Supplies Stores' },
    'grocery': { code: '445110', category: 'grocery', sector: '44-45', subsector: '445', title: 'Supermarkets and Other Grocery Stores' },
    'market': { code: '445110', category: 'grocery', sector: '44-45', subsector: '445', title: 'Supermarkets and Other Grocery Stores' },
    'retail': { code: '453998', category: 'retail', sector: '44-45', subsector: '453', title: 'All Other Miscellaneous Store Retailers' },
    'shop': { code: '453998', category: 'retail', sector: '44-45', subsector: '453', title: 'All Other Miscellaneous Store Retailers' },
    'store': { code: '453998', category: 'retail', sector: '44-45', subsector: '453', title: 'All Other Miscellaneous Store Retailers' },
    'media': { code: '515112', category: 'media', sector: '51', subsector: '515', title: 'Radio Stations' },
    'radio': { code: '515112', category: 'media', sector: '51', subsector: '515', title: 'Radio Stations' },
    'newspaper': { code: '511110', category: 'media', sector: '51', subsector: '511', title: 'Newspaper Publishers' },
    'photography': { code: '541922', category: 'creative', sector: '54', subsector: '541', title: 'Commercial Photography' },
    'photo': { code: '541922', category: 'creative', sector: '54', subsector: '541', title: 'Commercial Photography' },
    'design': { code: '541430', category: 'creative', sector: '54', subsector: '541', title: 'Graphic Design Services' },
    'print': { code: '323111', category: 'manufacturing', sector: '31-33', subsector: '323', title: 'Commercial Printing' },
    'auto': { code: '441110', category: 'automotive', sector: '44-45', subsector: '441', title: 'New Car Dealers' },
    'car': { code: '441110', category: 'automotive', sector: '44-45', subsector: '441', title: 'New Car Dealers' },
    'marine': { code: '441222', category: 'marine', sector: '44-45', subsector: '441', title: 'Boat Dealers' },
    'boat': { code: '441222', category: 'marine', sector: '44-45', subsector: '441', title: 'Boat Dealers' },
    'transport': { code: '484110', category: 'transportation', sector: '48-49', subsector: '484', title: 'General Freight Trucking' },
    'trucking': { code: '484110', category: 'transportation', sector: '48-49', subsector: '484', title: 'General Freight Trucking' },
    'taxi': { code: '485310', category: 'taxi-rideshare', sector: '48-49', subsector: '485', title: 'Taxi Service' },
    'school': { code: '611110', category: 'education', sector: '61', subsector: '611', title: 'Elementary and Secondary Schools' },
    'daycare': { code: '624410', category: 'education', sector: '62', subsector: '624', title: 'Child Day Care Services' },
    'childcare': { code: '624410', category: 'education', sector: '62', subsector: '624', title: 'Child Day Care Services' },
    'church': { code: '813110', category: 'non-profit', sector: '81', subsector: '813', title: 'Religious Organizations' },
    'nonprofit': { code: '813219', category: 'non-profit', sector: '81', subsector: '813', title: 'Other Grantmaking and Giving Services' },
    'association': { code: '813910', category: 'associations', sector: '81', subsector: '813', title: 'Business Associations' },
    'lodge': { code: '721110', category: 'accommodation', sector: '72', subsector: '721', title: 'Hotels and Motels' },
    'cabin': { code: '721214', category: 'accommodation', sector: '72', subsector: '721', title: 'Recreational and Vacation Camps' },
    'campground': { code: '721211', category: 'accommodation', sector: '72', subsector: '721', title: 'RV Parks and Campgrounds' },
    'yoga': { code: '713940', category: 'fitness-wellness', sector: '71', subsector: '713', title: 'Fitness and Recreational Sports Centers' },
    'gym': { code: '713940', category: 'fitness-wellness', sector: '71', subsector: '713', title: 'Fitness and Recreational Sports Centers' },
    'fitness': { code: '713940', category: 'fitness-wellness', sector: '71', subsector: '713', title: 'Fitness and Recreational Sports Centers' },
  };
  
  // Check each mapping
  for (const [keyword, mapping] of Object.entries(categoryMappings)) {
    if (combined.includes(keyword)) {
      return mapping;
    }
  }
  
  // Default
  return { code: '999999', category: 'other', sector: '99', subsector: '999', title: 'Unclassified' };
};

// Process Tofino
console.log('Processing Tofino members...');
const tofinoData = require('./tofino-full-members.json');
const tofinoMembers = tofinoData.map((m, i) => {
  const classification = classifyBusiness(m.name, m.category || '');
  return {
    id: `tofino-member-${i + 1}`,
    chamberId: 'tofino-chamber',
    businessName: m.name,
    category: classification.category,
    naicsCode: classification.code,
    naicsSubsector: classification.subsector,
    naicsSector: classification.sector,
    naicsTitle: classification.title,
    municipality: 'Tofino',
    region: 'Alberni-Clayoquot'
  };
});

// Process Campbell River
console.log('Processing Campbell River members...');
const campbellRiverData = require('./campbell-river-members.json');
const campbellRiverMembers = campbellRiverData.map((m, i) => {
  const classification = classifyBusiness(m.name, m.category || '');
  return {
    id: `campbell-river-member-${i + 1}`,
    chamberId: 'campbell-river-chamber',
    businessName: m.name,
    website: m.url || undefined,
    category: classification.category,
    naicsCode: classification.code,
    naicsSubsector: classification.subsector,
    naicsSector: classification.sector,
    naicsTitle: classification.title,
    municipality: 'Campbell River',
    region: 'Strathcona'
  };
});

// Save integration files
fs.writeFileSync('scripts/tofino-integration.json', JSON.stringify(tofinoMembers, null, 2));
fs.writeFileSync('scripts/campbell-river-integration.json', JSON.stringify(campbellRiverMembers, null, 2));

console.log(`Tofino: ${tofinoMembers.length} members`);
console.log(`Campbell River: ${campbellRiverMembers.length} members`);

// Count classifications
const allMembers = [...tofinoMembers, ...campbellRiverMembers];
const cats = {};
allMembers.forEach(m => {
  cats[m.category] = (cats[m.category] || 0) + 1;
});
console.log('\nCategory distribution:');
Object.entries(cats).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => {
  console.log(`  ${k}: ${v} (${(v/allMembers.length*100).toFixed(1)}%)`);
});
