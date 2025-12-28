const fs = require('fs');

// Manual mapping from actual scraped categories to correct BusinessCategory and NAICS
const exactMappings = {
  // Accommodation
  'bed & breakfast': { cat: 'accommodation', naics: '721191', desc: 'Bed-and-Breakfast Inns' },
  'bed and breakfast': { cat: 'accommodation', naics: '721191', desc: 'Bed-and-Breakfast Inns' },
  'hotel': { cat: 'accommodation', naics: '721110', desc: 'Hotels' },
  'motel': { cat: 'accommodation', naics: '721110', desc: 'Hotels' },
  'hotel resort': { cat: 'accommodation', naics: '721110', desc: 'Hotels' },
  'hostel': { cat: 'accommodation', naics: '721310', desc: 'Rooming and Boarding Houses' },
  'guesthouse': { cat: 'accommodation', naics: '721199', desc: 'All Other Traveler Accommodation' },
  'lodge': { cat: 'accommodation', naics: '721199', desc: 'All Other Traveler Accommodation' },
  'resort': { cat: 'accommodation', naics: '721110', desc: 'Hotels' },
  'campground': { cat: 'accommodation', naics: '721211', desc: 'RV Parks and Campgrounds' },
  'camping': { cat: 'accommodation', naics: '721211', desc: 'RV Parks and Campgrounds' },
  'campground and rv park': { cat: 'accommodation', naics: '721211', desc: 'RV Parks and Campgrounds' },
  
  // Food & Beverage
  'restaurant': { cat: 'restaurant', naics: '722511', desc: 'Full-Service Restaurants' },
  'cafe': { cat: 'restaurant', naics: '722515', desc: 'Snack and Nonalcoholic Beverage Bars' },
  'bistro': { cat: 'restaurant', naics: '722511', desc: 'Full-Service Restaurants' },
  'pizza': { cat: 'restaurant', naics: '722513', desc: 'Limited-Service Restaurants' },
  'sports bar & grill': { cat: 'restaurant', naics: '722511', desc: 'Full-Service Restaurants' },
  'fresh bakery / deli / cafe': { cat: 'food-beverage', naics: '311811', desc: 'Retail Bakeries' },
  'food & beverage': { cat: 'food-beverage', naics: '722511', desc: 'Full-Service Restaurants' },
  
  // Brewery/Winery
  'brewery': { cat: 'winery-brewery', naics: '312120', desc: 'Breweries' },
  'breweries': { cat: 'winery-brewery', naics: '312120', desc: 'Breweries' },
  'cider': { cat: 'winery-brewery', naics: '312120', desc: 'Breweries' },
  
  // Retail
  'retail': { cat: 'retail', naics: '452319', desc: 'All Other General Merchandise Stores' },
  'convenience store': { cat: 'grocery', naics: '445120', desc: 'Convenience Stores' },
  'liquor store': { cat: 'retail', naics: '445310', desc: 'Beer, Wine, and Liquor Stores' },
  'gift shop': { cat: 'retail', naics: '453220', desc: 'Gift, Novelty, and Souvenir Stores' },
  'bookstore': { cat: 'retail', naics: '451211', desc: 'Book Stores' },
  'surf shop': { cat: 'retail', naics: '451110', desc: 'Sporting Goods Stores' },
  'fashion boutique': { cat: 'retail', naics: '448120', desc: 'Women\'s Clothing Stores' },
  'clothing and lifestyle': { cat: 'retail', naics: '448140', desc: 'Family Clothing Stores' },
  'baby & children\'s clothing shop': { cat: 'retail', naics: '448130', desc: 'Children\'s Clothing Stores' },
  'furniture & mattresses': { cat: 'retail', naics: '442110', desc: 'Furniture Stores' },
  'pet store': { cat: 'pets', naics: '453910', desc: 'Pet and Pet Supplies Stores' },
  'marine supply store': { cat: 'retail', naics: '451110', desc: 'Sporting Goods Stores' },
  'fishing, hunting, outdoor store': { cat: 'retail', naics: '451110', desc: 'Sporting Goods Stores' },
  'kitchen and gift shop': { cat: 'retail', naics: '442299', desc: 'All Other Home Furnishings Stores' },
  'local and sustainable goods': { cat: 'retail', naics: '452319', desc: 'General Merchandise Stores' },
  'esthetics, accessories, gifts': { cat: 'retail', naics: '453220', desc: 'Gift Stores' },
  
  // Automotive
  'automotive': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'automotive services': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'car dealership': { cat: 'automotive', naics: '441110', desc: 'New Car Dealers' },
  'automotive dealership': { cat: 'automotive', naics: '441110', desc: 'New Car Dealers' },
  'tires, mufflers, brakes, alignments': { cat: 'automotive', naics: '811198', desc: 'All Other Automotive Repair' },
  'fluid maintenance and automotive services': { cat: 'automotive', naics: '811111', desc: 'General Automotive Repair' },
  'boat dealership': { cat: 'retail', naics: '441222', desc: 'Boat Dealers' },
  
  // Financial
  'financial services': { cat: 'banking-finance', naics: '523930', desc: 'Investment Advice' },
  'financial institution': { cat: 'banking-finance', naics: '522110', desc: 'Commercial Banking' },
  'banking': { cat: 'banking-finance', naics: '522110', desc: 'Commercial Banking' },
  'accounting/bookkeeping': { cat: 'accounting', naics: '541211', desc: 'Offices of Certified Public Accountants' },
  'tax planning and wealth management': { cat: 'banking-finance', naics: '523930', desc: 'Investment Advice' },
  
  // Professional Services
  'notary public': { cat: 'legal', naics: '541120', desc: 'Offices of Notaries' },
  'real estate': { cat: 'real-estate', naics: '531210', desc: 'Offices of Real Estate Agents' },
  'real estate agent': { cat: 'real-estate', naics: '531210', desc: 'Offices of Real Estate Agents' },
  'commercial real estate appraisal services': { cat: 'real-estate', naics: '531320', desc: 'Offices of Real Estate Appraisers' },
  'home inspection': { cat: 'consulting', naics: '531390', desc: 'Other Real Estate Activities' },
  'consultancy': { cat: 'consulting', naics: '541611', desc: 'Administrative Management Consulting' },
  'business coaching': { cat: 'consulting', naics: '611430', desc: 'Professional Management Development Training' },
  'business services': { cat: 'consulting', naics: '561499', desc: 'All Other Business Support Services' },
  'professional services': { cat: 'consulting', naics: '541990', desc: 'All Other Professional Services' },
  
  // Construction/Trades
  'excavation services': { cat: 'construction', naics: '238910', desc: 'Site Preparation Contractors' },
  'electrical services': { cat: 'electrical', naics: '238210', desc: 'Electrical Contractors' },
  'electrical systems': { cat: 'electrical', naics: '238210', desc: 'Electrical Contractors' },
  'granite countertops and installation': { cat: 'manufacturing', naics: '327991', desc: 'Cut Stone and Stone Product Manufacturing' },
  'custom cabinetry': { cat: 'manufacturing', naics: '337110', desc: 'Wood Kitchen Cabinet Manufacturing' },
  'fencing services': { cat: 'construction', naics: '238990', desc: 'All Other Specialty Trade Contractors' },
  'roofing services': { cat: 'roofing', naics: '238160', desc: 'Roofing Contractors' },
  
  // Healthcare
  'healthcare': { cat: 'healthcare', naics: '621111', desc: 'Offices of Physicians' },
  'mental health services': { cat: 'healthcare', naics: '621330', desc: 'Offices of Mental Health Practitioners' },
  'hearing clinic': { cat: 'healthcare', naics: '621340', desc: 'Offices of Physical, Occupational and Speech Therapists' },
  'orthotics': { cat: 'healthcare', naics: '339113', desc: 'Surgical Appliance and Supplies Manufacturing' },
  'mobile registered massage therapy': { cat: 'spa-beauty', naics: '621399', desc: 'Offices of All Other Miscellaneous Health Practitioners' },
  'optometry': { cat: 'optometry', naics: '621320', desc: 'Offices of Optometrists' },
  'veterinary clinic': { cat: 'veterinary', naics: '541940', desc: 'Veterinary Services' },
  
  // Fitness/Recreation
  'fitness and wellness center': { cat: 'fitness-wellness', naics: '713940', desc: 'Fitness and Recreational Sports Centers' },
  'crossfit gym': { cat: 'fitness-wellness', naics: '713940', desc: 'Fitness and Recreational Sports Centers' },
  'wellness': { cat: 'fitness-wellness', naics: '621399', desc: 'Offices of All Other Miscellaneous Health Practitioners' },
  'sports': { cat: 'recreation', naics: '711211', desc: 'Sports Teams and Clubs' },
  'sports & recreation': { cat: 'recreation', naics: '713990', desc: 'All Other Amusement and Recreation Industries' },
  'golf club': { cat: 'recreation', naics: '713910', desc: 'Golf Courses and Country Clubs' },
  'drag racing association': { cat: 'recreation', naics: '711212', desc: 'Racetracks' },
  
  // Tourism/Hospitality
  'fishing charter': { cat: 'hospitality', naics: '487210', desc: 'Scenic and Sightseeing Transportation, Water' },
  'sport fishing': { cat: 'hospitality', naics: '487210', desc: 'Scenic and Sightseeing Transportation, Water' },
  'historic site': { cat: 'arts-culture', naics: '712120', desc: 'Historical Sites' },
  'national park': { cat: 'government', naics: '712190', desc: 'Nature Parks and Other Similar Institutions' },
  'arts and culture': { cat: 'arts-culture', naics: '711110', desc: 'Theater Companies and Dinner Theaters' },
  'entertainment': { cat: 'entertainment', naics: '711310', desc: 'Promoters of Performing Arts' },
  
  // Media/IT
  'radio station': { cat: 'media', naics: '515112', desc: 'Radio Stations' },
  'news': { cat: 'media', naics: '511110', desc: 'Newspaper Publishers' },
  'web design': { cat: 'it-technology', naics: '541511', desc: 'Custom Computer Programming Services' },
  'digital signage solutions': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design Services' },
  'office equipment, digital technology, it management': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design Services' },
  'automation': { cat: 'it-technology', naics: '541512', desc: 'Computer Systems Design Services' },
  'printing & signs': { cat: 'printing', naics: '323111', desc: 'Commercial Printing' },
  
  // Education
  'educational services': { cat: 'education', naics: '611710', desc: 'Educational Support Services' },
  'educational institution': { cat: 'education', naics: '611310', desc: 'Colleges, Universities, and Professional Schools' },
  'literacy and education': { cat: 'education', naics: '611710', desc: 'Educational Support Services' },
  'music instruction': { cat: 'education', naics: '611610', desc: 'Fine Arts Schools' },
  'non-profit music performance school': { cat: 'education', naics: '611610', desc: 'Fine Arts Schools' },
  
  // Nonprofit
  'non-profit': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'nonprofit': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'non-profit organization': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'nonprofit organization': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'not for profit charitable organization': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'community service': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'social enterprise': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'community member': { cat: 'charity-nonprofit', naics: '813410', desc: 'Civic and Social Organizations' },
  'annual agricultural fair': { cat: 'charity-nonprofit', naics: '711320', desc: 'Promoters of Events Without Facilities' },
  'networking and advocacy': { cat: 'charity-nonprofit', naics: '813910', desc: 'Business Associations' },
  
  // Government/First Nations
  'government organization': { cat: 'government', naics: '921110', desc: 'Executive Offices' },
  'first nation': { cat: 'first-nations', naics: '921150', desc: 'American Indian and Alaska Native Tribal Governments' },
  'first nations government': { cat: 'first-nations', naics: '921150', desc: 'American Indian and Alaska Native Tribal Governments' },
  
  // Other Services
  'childcare': { cat: 'childcare', naics: '624410', desc: 'Child Day Care Services' },
  'employment services': { cat: 'consulting', naics: '561310', desc: 'Employment Placement Agencies' },
  'career centre': { cat: 'consulting', naics: '561310', desc: 'Employment Placement Agencies' },
  'pest control': { cat: 'home-services', naics: '561710', desc: 'Exterminating and Pest Control Services' },
  'cleaning services': { cat: 'cleaning-janitorial', naics: '561720', desc: 'Janitorial Services' },
  'exterior cleaning services': { cat: 'cleaning-janitorial', naics: '561790', desc: 'Other Services to Buildings and Dwellings' },
  'first aid services': { cat: 'healthcare', naics: '621399', desc: 'Offices of All Other Miscellaneous Health Practitioners' },
  'funeral services': { cat: 'funeral', naics: '812210', desc: 'Funeral Homes and Funeral Services' },
  'hair salon': { cat: 'spa-beauty', naics: '812111', desc: 'Barber Shops' },
  'beauty and personal care': { cat: 'spa-beauty', naics: '812112', desc: 'Beauty Salons' },
  'cannabis dispensary': { cat: 'cannabis', naics: '453998', desc: 'All Other Miscellaneous Store Retailers' },
  'retail pharmacy': { cat: 'pharmacy', naics: '446110', desc: 'Pharmacies and Drug Stores' },
  'airport': { cat: 'aviation', naics: '488119', desc: 'Other Airport Operations' },
  
  // Transportation/Marine
  'transport': { cat: 'trucking-freight', naics: '484110', desc: 'General Freight Trucking, Local' },
  'transportation': { cat: 'trucking-freight', naics: '484110', desc: 'General Freight Trucking, Local' },
  'marine services': { cat: 'fishing-marine', naics: '488390', desc: 'Other Support Activities for Water Transportation' },
  'sourcing and supply chain management': { cat: 'trucking-freight', naics: '541614', desc: 'Process, Physical Distribution, and Logistics Consulting' },
  
  // Fuel/Utilities
  'fuel station': { cat: 'retail', naics: '447190', desc: 'Other Gasoline Stations' },
  'fuels': { cat: 'retail', naics: '447190', desc: 'Other Gasoline Stations' },
  'landfill services': { cat: 'environmental', naics: '562212', desc: 'Solid Waste Landfill' },
  
  // Manufacturing
  'manufacturing': { cat: 'manufacturing', naics: '332710', desc: 'Machine Shops' },
  'manufacturer': { cat: 'manufacturing', naics: '332710', desc: 'Machine Shops' },
  
  // Equipment
  'equipment rentals': { cat: 'retail', naics: '532310', desc: 'General Rental Centers' },
  'equipment sales, service, rental, clothing': { cat: 'retail', naics: '532310', desc: 'General Rental Centers' },
  
  // Grocery
  'seafood, groceries': { cat: 'grocery', naics: '445220', desc: 'Fish and Seafood Markets' },
  'campground and farm': { cat: 'agriculture', naics: '111998', desc: 'All Other Miscellaneous Crop Farming' },
  'farm': { cat: 'agriculture', naics: '111998', desc: 'All Other Miscellaneous Crop Farming' },
  
  // Directory (shouldn't be businesses)
  'business directory': { cat: 'other', naics: '519130', desc: 'Internet Publishing and Broadcasting' },
  'local business directory': { cat: 'other', naics: '519130', desc: 'Internet Publishing and Broadcasting' },
  
  // Default
  'unknown': { cat: 'other', naics: '541990', desc: 'All Other Professional Services' }
};

function mapCategory(rawCat, businessName) {
  const catLower = (rawCat || '').toLowerCase().trim();
  const nameLower = (businessName || '').toLowerCase();
  
  // Try exact match first
  if (exactMappings[catLower]) {
    return exactMappings[catLower];
  }
  
  // Try partial matches on category
  for (const [key, value] of Object.entries(exactMappings)) {
    if (catLower.includes(key) || key.includes(catLower)) {
      return value;
    }
  }
  
  // Try keyword matching on business name for common cases
  if (nameLower.includes('hotel') || nameLower.includes('inn') || nameLower.includes('lodge')) {
    return { cat: 'accommodation', naics: '721110', desc: 'Hotels' };
  }
  if (nameLower.includes('restaurant') || nameLower.includes('cafe') || nameLower.includes('bistro')) {
    return { cat: 'restaurant', naics: '722511', desc: 'Full-Service Restaurants' };
  }
  if (nameLower.includes('pharmacy') || nameLower.includes('drug')) {
    return { cat: 'pharmacy', naics: '446110', desc: 'Pharmacies and Drug Stores' };
  }
  if (nameLower.includes('credit union') || nameLower.includes('bank')) {
    return { cat: 'banking-finance', naics: '522110', desc: 'Commercial Banking' };
  }
  if (nameLower.includes('insurance')) {
    return { cat: 'insurance', naics: '524210', desc: 'Insurance Agencies' };
  }
  if (nameLower.includes('law') || nameLower.includes('legal')) {
    return { cat: 'legal', naics: '541110', desc: 'Offices of Lawyers' };
  }
  
  // Default
  return { cat: 'other', naics: '541990', desc: 'All Other Professional Services' };
}

function generateId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

// Process Port Alberni data
const data = JSON.parse(fs.readFileSync('scripts/port-alberni-details.json', 'utf8'));

const members = data.map(m => {
  const catInfo = mapCategory(m.category, m.name);
  const id = generateId(m.name);
  const addr = (m.address || '').replace(/null/gi, '').replace(/^\/$/, '').trim();
  const ph = (m.phone || '').replace(/null/gi, '').replace(/^\/$/, '').trim();
  const ws = m.website || '';
  
  return {
    id,
    chamberId: 'port-alberni-chamber',
    businessName: m.name,
    category: catInfo.cat,
    subcategory: m.category || '',
    naicsCode: catInfo.naics,
    naicsTitle: catInfo.desc,
    naicsSector: catInfo.naics.substring(0,2),
    naicsSubsector: catInfo.naics.substring(0,3),
    address: addr,
    phone: ph,
    website: ws,
    websiteNeedsCollection: !ws,
    municipality: 'Port Alberni',
    region: 'Alberni-Clayoquot'
  };
});

// Log category distribution for validation
const catDist = {};
members.forEach(m => {
  catDist[m.category] = (catDist[m.category] || 0) + 1;
});
console.log('Category distribution:');
Object.entries(catDist).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

// Generate TypeScript
const tsCode = members.map(m => `  {
    id: '${m.id.replace(/'/g, "\\'")}',
    chamberId: 'port-alberni-chamber',
    businessName: '${m.businessName.replace(/'/g, "\\'")}',
    category: '${m.category}',
    subcategory: '${m.subcategory.replace(/'/g, "\\'")}',
    naicsCode: '${m.naicsCode}',
    naicsTitle: '${m.naicsTitle.replace(/'/g, "\\'")}',
    naicsSector: '${m.naicsSector}',
    naicsSubsector: '${m.naicsSubsector}',${m.address ? `\n    address: '${m.address.replace(/'/g, "\\'")}',` : ''}${m.phone ? `\n    phone: '${m.phone.replace(/'/g, "\\'")}',` : ''}${m.website && !m.websiteNeedsCollection ? `\n    website: '${m.website.replace(/'/g, "\\'")}',` : '\n    websiteNeedsCollection: true,'}
    municipality: 'Port Alberni',
    region: 'Alberni-Clayoquot'
  }`).join(',\n');

fs.writeFileSync('scripts/port-alberni-ts-final.txt', 
  `  // ============================================================================
  // PORT ALBERNI - Alberni Valley Chamber of Commerce
  // Scraped: December 2024 | Coverage: 88% (175/~200 members)
  // ============================================================================
${tsCode}`);

console.log(`\nGenerated ${members.length} Port Alberni entries with accurate NAICS codes`);
