const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeWestShore() {
  console.log('Scraping WestShore Chamber directory...');
  
  const url = 'https://web.westshore.bc.ca/directory/';
  
  try {
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['extract'],
      timeout: 120000,
      extract: {
        schema: {
          type: 'object',
          properties: {
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  businessName: { type: 'string' },
                  address: { type: 'string' },
                  phone: { type: 'string' },
                  category: { type: 'string' }
                }
              }
            }
          }
        },
        prompt: 'Extract ALL business member names and contact details from this chamber of commerce directory page. Get every single business listed.'
      }
    });
    
    if (result.extract?.members) {
      console.log(`Extracted: ${result.extract.members.length} members`);
      fs.writeFileSync('scripts/westshore-raw.json', JSON.stringify(result.extract.members, null, 2));
      console.log('Saved to scripts/westshore-raw.json');
    } else {
      console.log('No members extracted from main page');
      // Try alternate URL patterns
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

scrapeWestShore().catch(console.error);
