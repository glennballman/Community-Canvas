const fs = require('fs');

// Load the cleaned data
const members = JSON.parse(fs.readFileSync('scripts/nanaimo-cleaned.json', 'utf8'));
console.log('Members to classify:', members.length);

// Import the NAICS classifier (we'll use a simplified version since we can't easily import TS)
// Based on shared/naics-classifier.ts logic

const categoryKeywords = {
  'Accommodation': ['hotel', 'motel', 'inn', 'resort', 'lodge', 'hostel', 'b&b', 'bed and breakfast', 'airbnb', 'vacation rental', 'cabin', 'cottage', 'suites', 'guest house'],
  'Arts & Culture': ['art', 'gallery', 'museum', 'theatre', 'theater', 'music', 'dance', 'cultural', 'artist', 'performer', 'entertainment', 'studio', 'creative'],
  'Automotive': ['auto', 'car', 'vehicle', 'tire', 'mechanic', 'repair', 'collision', 'body shop', 'detailing', 'oil change', 'transmission', 'brake', 'muffler', 'automotive', 'rv', 'trailer', 'motorcycle', 'boat', 'marine'],
  'Construction': ['construction', 'contractor', 'builder', 'roofing', 'plumbing', 'electrical', 'hvac', 'heating', 'cooling', 'excavation', 'paving', 'concrete', 'framing', 'drywall', 'flooring', 'painting', 'renovations', 'remodeling', 'demolition', 'landscaping', 'fencing', 'siding'],
  'Education': ['school', 'college', 'university', 'academy', 'institute', 'learning', 'training', 'tutoring', 'education', 'daycare', 'preschool', 'childcare', 'montessori'],
  'Finance & Insurance': ['bank', 'credit union', 'mortgage', 'loan', 'financial', 'insurance', 'investment', 'accounting', 'bookkeeping', 'tax', 'cpa', 'wealth', 'advisor', 'securities', 'brokerage'],
  'Food & Beverage': ['restaurant', 'cafe', 'coffee', 'bakery', 'catering', 'food', 'pizza', 'sushi', 'pub', 'bar', 'brewery', 'winery', 'distillery', 'grill', 'diner', 'bistro', 'kitchen', 'eatery', 'takeout', 'delivery', 'grocery', 'market', 'deli', 'butcher'],
  'Government': ['city of', 'regional district', 'government', 'ministry', 'federal', 'provincial', 'municipal', 'first nation', 'band office'],
  'Health & Wellness': ['health', 'medical', 'clinic', 'doctor', 'dentist', 'dental', 'pharmacy', 'chiropractor', 'physiotherapy', 'massage', 'spa', 'wellness', 'fitness', 'gym', 'yoga', 'pilates', 'optometrist', 'veterinary', 'vet', 'hospital', 'nursing', 'care home', 'seniors', 'hearing', 'vision', 'therapy', 'counselling', 'psychology', 'naturopath', 'acupuncture'],
  'Legal Services': ['law', 'lawyer', 'attorney', 'legal', 'notary', 'paralegal', 'barrister', 'solicitor'],
  'Manufacturing': ['manufacturing', 'factory', 'industrial', 'machine', 'fabrication', 'production', 'processing', 'assembly', 'welding', 'metal', 'steel', 'plastics', 'woodworking', 'millwork', 'cabinet'],
  'Non-Profit': ['society', 'foundation', 'charity', 'non-profit', 'nonprofit', 'volunteer', 'community', 'association', 'club', 'legion', 'rotary', 'lions', 'kiwanis'],
  'Professional Services': ['consulting', 'consultant', 'management', 'marketing', 'advertising', 'design', 'graphic', 'web', 'architect', 'engineer', 'surveyor', 'planning', 'hr', 'human resources', 'recruiting', 'staffing', 'translation', 'coaching', 'training'],
  'Real Estate': ['real estate', 'realtor', 'realty', 'property', 'land', 'homes', 'housing', 'apartment', 'strata', 'development', 'developer'],
  'Retail': ['store', 'shop', 'retail', 'boutique', 'clothing', 'fashion', 'shoes', 'jewelry', 'furniture', 'appliance', 'hardware', 'home', 'garden', 'pet', 'toy', 'gift', 'book', 'sporting', 'outdoor', 'electronics', 'computer', 'phone', 'wireless', 'florist', 'flower'],
  'Technology': ['technology', 'software', 'it', 'computer', 'tech', 'digital', 'cyber', 'data', 'cloud', 'network', 'telecom', 'communications', 'internet', 'app', 'developer', 'programming', 'automation'],
  'Tourism & Recreation': ['tour', 'tourism', 'adventure', 'outdoor', 'recreation', 'fishing', 'charter', 'whale', 'kayak', 'paddleboard', 'hiking', 'camping', 'golf', 'ski', 'attraction', 'amusement', 'entertainment', 'event', 'venue'],
  'Transportation': ['transport', 'trucking', 'freight', 'shipping', 'courier', 'delivery', 'logistics', 'moving', 'storage', 'taxi', 'limo', 'bus', 'ferry', 'airline', 'aviation', 'helicopter'],
  'Utilities': ['hydro', 'power', 'electric', 'gas', 'water', 'sewer', 'utility', 'energy', 'solar', 'wind', 'renewable'],
};

const naicsMapping = {
  'Accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'Arts & Culture': { code: '711110', subsector: '711', sector: '71', title: 'Arts and Cultural Services' },
  'Automotive': { code: '811111', subsector: '811', sector: '81', title: 'General Automotive Repair' },
  'Construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial and Institutional Building Construction' },
  'Education': { code: '611110', subsector: '611', sector: '61', title: 'Educational Services' },
  'Finance & Insurance': { code: '522310', subsector: '522', sector: '52', title: 'Financial Services' },
  'Food & Beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'Government': { code: '921110', subsector: '921', sector: '92', title: 'Government Services' },
  'Health & Wellness': { code: '621111', subsector: '621', sector: '62', title: 'Health Care Services' },
  'Legal Services': { code: '541110', subsector: '541', sector: '54', title: 'Offices of Lawyers' },
  'Manufacturing': { code: '332310', subsector: '332', sector: '33', title: 'Manufacturing' },
  'Non-Profit': { code: '813410', subsector: '813', sector: '81', title: 'Civic and Social Organizations' },
  'Professional Services': { code: '541611', subsector: '541', sector: '54', title: 'Professional Services' },
  'Real Estate': { code: '531210', subsector: '531', sector: '53', title: 'Real Estate Services' },
  'Retail': { code: '452210', subsector: '452', sector: '44', title: 'Retail Trade' },
  'Technology': { code: '541511', subsector: '541', sector: '54', title: 'Information Technology Services' },
  'Tourism & Recreation': { code: '487110', subsector: '487', sector: '48', title: 'Tourism and Recreation Services' },
  'Transportation': { code: '484110', subsector: '484', sector: '48', title: 'Transportation Services' },
  'Utilities': { code: '221310', subsector: '221', sector: '22', title: 'Utilities' },
};

function classifyBusiness(name) {
  const lowerName = name.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        const naics = naicsMapping[category];
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
  
  // Default to Professional Services if no match
  return {
    category: 'Professional Services',
    naicsCode: '541990',
    naicsSubsector: '541',
    naicsSector: '54',
    naicsTitle: 'All Other Professional Services'
  };
}

// Classify all members
const classified = members.map(m => {
  const classification = classifyBusiness(m.businessName);
  return {
    ...m,
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

fs.writeFileSync('scripts/nanaimo-classified.json', JSON.stringify(classified, null, 2));
console.log('\nSaved to scripts/nanaimo-classified.json');
