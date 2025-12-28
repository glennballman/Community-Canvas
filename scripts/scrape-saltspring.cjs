const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeSaltSpring() {
  console.log('Scraping Salt Spring Island Chamber directory...');
  const allMembers = [];
  
  // Try main directory page
  const urls = [
    'https://saltspringdirectory.com/',
    'https://saltspringdirectory.com/category/accommodations/',
    'https://saltspringdirectory.com/category/food-drink/',
    'https://saltspringdirectory.com/category/services/',
    'https://saltspringdirectory.com/category/shops-galleries/',
    'https://saltspringdirectory.com/category/arts-culture/',
    'https://saltspringdirectory.com/category/outdoor-recreation/',
    'https://saltspringdirectory.com/category/health-wellness/'
  ];
  
  for (const url of urls) {
    console.log(`Scraping: ${url}`);
    
    try {
      const result = await firecrawl.scrapeUrl(url, {
        formats: ['extract'],
        timeout: 90000,
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
          prompt: 'Extract ALL business names and details from this directory page. Get every business listing visible.'
        }
      });
      
      if (result.extract?.members?.length > 0) {
        allMembers.push(...result.extract.members);
        console.log(`  Found: ${result.extract.members.length} members`);
      } else {
        console.log('  No members found');
      }
      
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
  
  console.log(`\nTotal raw: ${allMembers.length}`);
  fs.writeFileSync('scripts/saltspring-raw.json', JSON.stringify(allMembers, null, 2));
  console.log('Saved to scripts/saltspring-raw.json');
}

scrapeSaltSpring().catch(console.error);
