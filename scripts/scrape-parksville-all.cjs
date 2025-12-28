const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function scrapeAll() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Scraping ALL Parksville listings...');
  
  // The /all suffix should show all members
  const result = await app.scrapeUrl('https://www.parksvillechamber.com/member-business-directory/browse-by-category/all', {
    formats: ['extract'],
    extract: {
      prompt: "Extract every single business listing from this complete chamber directory page. For each business, get the business name, category, address, phone, and website. Extract as many as possible.",
      schema: {
        type: 'object',
        properties: {
          totalCount: { type: 'number' },
          businesses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                businessName: { type: 'string' },
                category: { type: 'string' },
                streetAddress: { type: 'string' },
                city: { type: 'string' },
                phone: { type: 'string' },
                websiteUrl: { type: 'string' }
              }
            }
          }
        }
      }
    }
  });
  
  console.log('Total claimed:', result.extract?.totalCount);
  console.log('Businesses extracted:', result.extract?.businesses?.length || 0);
  
  if (result.extract?.businesses) {
    fs.writeFileSync('scripts/parksville-all-listings.json', JSON.stringify(result.extract.businesses, null, 2));
    console.log('\nSample:');
    result.extract.businesses.slice(0, 3).forEach(b => console.log(`  - ${b.businessName} (${b.category})`));
  }
}

scrapeAll().catch(console.error);
