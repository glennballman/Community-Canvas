const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

// Load existing members
const existing = JSON.parse(fs.readFileSync('scripts/parksville-raw.json', 'utf8'));
const existingNames = new Set(existing.map(m => m.name?.toLowerCase().trim()));
console.log(`Starting with ${existing.length} existing members`);

// Categories to scrape - focus on ones not yet done
const categories = [
  'Accommodations',
  'Automotive',
  'Business Services',
  'Education & Child Care',
  'Events',
  'Financial Services',
  'Food & Beverage',
  'Government & Community Services',
  'Health & Wellness',
  'Home & Garden',
  'Legal Services',
  'Manufacturing',
  'Media & Communications',
  'Non Profit',
  'Personal Services',
  'Professional Services',
  'Real Estate',
  'Recreation & Sports',
  'Retail',
  'Tourism',
  'Transportation',
  'Utilities'
];

async function scrapeCategory(app, category) {
  const url = `https://www.parksvillechamber.com/member-business-directory/browse-by-category/${encodeURIComponent(category)}`;
  
  try {
    const result = await app.scrapeUrl(url, {
      formats: ['extract'],
      extract: {
        prompt: `Extract ALL business listings from this Parksville Chamber category page. Get every business name, full address, phone number, website URL, and any description. Be thorough - extract every single listing visible.`,
        schema: {
          type: 'object',
          properties: {
            totalInCategory: { type: 'number' },
            businesses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  businessName: { type: 'string' },
                  streetAddress: { type: 'string' },
                  city: { type: 'string' },
                  phone: { type: 'string' },
                  websiteUrl: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      }
    });
    
    return result.extract?.businesses || [];
  } catch (e) {
    if (e.statusCode === 402) {
      console.log('Credits exhausted!');
      return null;
    }
    console.log(`  Error: ${e.message}`);
    return [];
  }
}

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  let allNew = [];
  
  for (const category of categories) {
    console.log(`\nScraping: ${category}...`);
    const businesses = await scrapeCategory(app, category);
    
    if (businesses === null) {
      console.log('\nCredits exhausted - saving progress');
      break;
    }
    
    // Filter out duplicates
    const newOnes = businesses.filter(b => {
      const name = b.businessName?.toLowerCase().trim();
      if (!name || existingNames.has(name)) return false;
      existingNames.add(name);
      return true;
    }).map(b => ({
      name: b.businessName,
      category: category,
      address: [b.streetAddress, b.city].filter(Boolean).join(', '),
      phone: b.phone || '',
      website: b.websiteUrl || '',
      description: b.description || ''
    }));
    
    console.log(`  Found ${businesses.length} total, ${newOnes.length} new`);
    allNew.push(...newOnes);
    
    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Merge with existing
  const merged = [...existing, ...allNew];
  fs.writeFileSync('scripts/parksville-raw.json', JSON.stringify(merged, null, 2));
  console.log(`\n=== TOTAL: ${merged.length} members (was ${existing.length}, added ${allNew.length}) ===`);
  console.log(`Coverage: ${merged.length}/359 = ${Math.round(merged.length/359*100)}%`);
}

main().catch(console.error);
