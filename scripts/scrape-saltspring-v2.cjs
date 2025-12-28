const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeSaltSpring() {
  console.log('Scraping Salt Spring Chamber via main member listing...');
  const allMembers = [];
  
  // Use the official chamber page with member listings
  const url = 'https://saltspringchamber.com/Our-Members';
  
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
                  website: { type: 'string' },
                  industry: { type: 'string' }
                }
              }
            }
          }
        },
        prompt: 'Extract ALL business names, websites, and industry/category from this member directory table. There should be around 166 businesses listed. Extract every single one from the table including pagination pages 1-50, 51-100, 101-150, 151-166.'
      }
    });
    
    if (result.extract?.members?.length > 0) {
      allMembers.push(...result.extract.members);
      console.log(`  Found: ${result.extract.members.length} members`);
    }
    
  } catch (err) {
    console.log('Error:', err.message);
  }
  
  console.log(`\nTotal: ${allMembers.length}`);
  fs.writeFileSync('scripts/saltspring-raw.json', JSON.stringify(allMembers, null, 2));
  console.log('Saved to scripts/saltspring-raw.json');
}

scrapeSaltSpring().catch(console.error);
