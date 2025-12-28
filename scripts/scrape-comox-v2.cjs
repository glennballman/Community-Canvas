const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeComoxValley() {
  console.log('Scraping Comox Valley Chamber directory...');
  
  // The main directory page at comoxvalleychamber.com/membership-directory/corporate has all members A-Z
  const url = 'https://comoxvalleychamber.com/membership-directory/corporate';
  
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
                  businessName: { type: 'string', description: 'The company or business name' },
                  memberId: { type: 'string', description: 'The member ID from the URL if visible' }
                }
              }
            }
          }
        },
        prompt: 'Extract ALL business member names from this chamber of commerce directory page. The page lists businesses alphabetically from A to Z. Get every single business name listed on this page.'
      }
    });
    
    if (result.extract?.members) {
      console.log(`Extracted: ${result.extract.members.length} members`);
      fs.writeFileSync('scripts/comox-raw.json', JSON.stringify(result.extract.members, null, 2));
      console.log('Saved to scripts/comox-raw.json');
    } else {
      console.log('No members extracted');
      console.log('Result:', JSON.stringify(result, null, 2).slice(0, 1000));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

scrapeComoxValley().catch(console.error);
