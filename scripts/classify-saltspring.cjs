const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scripts/saltspring-pw.json', 'utf8'));
console.log('Salt Spring raw entries:', raw.length);

// Map industries to our category system
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

const naicsForCategory = {
  'accommodation': { code: '721110', subsector: '721', sector: '72', title: 'Hotels and Motels' },
  'agriculture': { code: '111419', subsector: '111', sector: '11', title: 'Agriculture and Farming' },
  'arts-culture': { code: '711110', subsector: '711', sector: '71', title: 'Theatre and Dance Companies' },
  'automotive': { code: '811111', subsector: '811', sector: '81', title: 'General Automotive Repair' },
  'consulting': { code: '541611', subsector: '541', sector: '54', title: 'Administrative Management Consulting' },
  'construction': { code: '236220', subsector: '236', sector: '23', title: 'Commercial Building Construction' },
  'environmental': { code: '541620', subsector: '541', sector: '54', title: 'Environmental Consulting' },
  'food-beverage': { code: '722511', subsector: '722', sector: '72', title: 'Full-Service Restaurants' },
  'government': { code: '921110', subsector: '921', sector: '92', title: 'Executive Offices' },
  'healthcare': { code: '621999', subsector: '621', sector: '62', title: 'Miscellaneous Health Practitioners' },
  'home-services': { code: '236118', subsector: '236', sector: '23', title: 'Residential Remodelers' },
  'hospitality': { code: '561520', subsector: '561', sector: '56', title: 'Tour Operators' },
  'legal': { code: '541110', subsector: '541', sector: '54', title: 'Offices of Lawyers' },
  'marketing-advertising': { code: '541810', subsector: '541', sector: '54', title: 'Advertising Agencies' },
  'real-estate': { code: '531210', subsector: '531', sector: '53', title: 'Offices of Real Estate Agents' },
  'recreation': { code: '713990', subsector: '713', sector: '71', title: 'Recreation Industries' },
  'retail': { code: '452210', subsector: '452', sector: '44', title: 'Department Stores' },
  'transit': { code: '485111', subsector: '485', sector: '48', title: 'Mixed Mode Transit Systems' },
  'other': { code: '541990', subsector: '541', sector: '54', title: 'All Other Professional Services' },
};

function classifyMember(member) {
  const industries = member.industry.split(',').map(i => i.trim());
  
  // Take the first matching category
  for (const ind of industries) {
    if (industryToCategory[ind]) {
      const cat = industryToCategory[ind];
      const naics = naicsForCategory[cat] || naicsForCategory['other'];
      return {
        category: cat,
        naicsCode: naics.code,
        naicsSubsector: naics.subsector,
        naicsSector: naics.sector,
        naicsTitle: naics.title
      };
    }
  }
  
  // Default to other
  const naics = naicsForCategory['other'];
  return {
    category: 'other',
    naicsCode: naics.code,
    naicsSubsector: naics.subsector,
    naicsSector: naics.sector,
    naicsTitle: naics.title
  };
}

const classified = raw.map(m => {
  const classification = classifyMember(m);
  return {
    businessName: m.businessName,
    website: m.website || '',
    sourceIndustry: m.industry,
    municipality: 'Salt Spring Island',
    region: 'Capital',
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

fs.writeFileSync('scripts/saltspring-integration.json', JSON.stringify(classified, null, 2));
console.log('\nSaved to scripts/saltspring-integration.json');
