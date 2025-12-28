const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function scrapeVisitPQB() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Scraping Visit Parksville Qualicum Beach directory...');
  
  const result = await app.scrapeUrl('https://www.visitparksvillequalicumbeach.com/plan/local-services-directory/', {
    formats: ['extract'],
    extract: {
      prompt: "Extract all business listings from this tourism directory. Get business name, category, address, phone, and website.",
      schema: {
        type: 'object',
        properties: {
          businesses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                businessName: { type: 'string' },
                category: { type: 'string' },
                address: { type: 'string' },
                phone: { type: 'string' },
                website: { type: 'string' }
              }
            }
          }
        }
      }
    }
  });
  
  if (result.extract?.businesses) {
    console.log('Found:', result.extract.businesses.length, 'businesses');
    fs.writeFileSync('scripts/visitpqb-businesses.json', JSON.stringify(result.extract.businesses, null, 2));
    result.extract.businesses.slice(0, 5).forEach(b => console.log(`  - ${b.businessName}`));
  }
}

scrapeVisitPQB().catch(console.error);
