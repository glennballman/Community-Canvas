const FirecrawlApp = require('@mendable/firecrawl-js').default;

async function scrapeParksville() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // First, let's try to get all listings from the main directory
  console.log('Scraping Parksville Chamber directory...');
  
  const result = await app.scrapeUrl('https://www.parksvillechamber.com/member-business-directory', {
    formats: ['extract'],
    extract: {
      schema: {
        type: 'object',
        properties: {
          totalMembers: { type: 'string' },
          businesses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                category: { type: 'string' },
                address: { type: 'string' },
                phone: { type: 'string' },
                website: { type: 'string' },
                city: { type: 'string' },
              }
            }
          },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                count: { type: 'number' }
              }
            }
          }
        }
      }
    }
  });
  
  console.log('Extract result:');
  console.log(JSON.stringify(result.extract, null, 2));
  
  return result;
}

scrapeParksville().catch(console.error);
