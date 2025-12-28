const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeWestShore() {
  console.log('Scraping WestShore Chamber directory...');
  const allMembers = [];
  
  // Try all categories page
  const url = 'https://web.westshore.bc.ca/allcategories';
  
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
                  phone: { type: 'string' }
                }
              }
            }
          }
        },
        prompt: 'Extract ALL business names from this chamber of commerce directory. Get every single business name listed on this page.'
      }
    });
    
    if (result.extract?.members?.length > 0) {
      allMembers.push(...result.extract.members);
      console.log(`All categories page: ${result.extract.members.length} members`);
    }
  } catch (err) {
    console.log('All categories error:', err.message);
  }
  
  // Also try main category pages
  const categories = [
    'Professional-Services',
    'Retail-Sales-and-Service',
    'Industry-and-Builders',
    'Government,-Education,-or-Association-',
    'Dining,-Food-Beverage',
    'Sports-Recreation',
    'Tourism-Lodging'
  ];
  
  for (const cat of categories) {
    const catUrl = `https://web.westshore.bc.ca/${cat}`;
    console.log(`Trying ${cat}...`);
    
    try {
      const result = await firecrawl.scrapeUrl(catUrl, {
        formats: ['extract'],
        timeout: 60000,
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
                    phone: { type: 'string' }
                  }
                }
              }
            }
          },
          prompt: 'Extract ALL business names from this page. Get every business listing.'
        }
      });
      
      if (result.extract?.members?.length > 0) {
        allMembers.push(...result.extract.members);
        console.log(`  ${cat}: ${result.extract.members.length} members`);
      }
      
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (err) {
      console.log(`  ${cat}: ${err.message}`);
    }
  }
  
  console.log(`\nTotal raw: ${allMembers.length}`);
  fs.writeFileSync('scripts/westshore-raw.json', JSON.stringify(allMembers, null, 2));
  console.log('Saved to scripts/westshore-raw.json');
}

scrapeWestShore().catch(console.error);
