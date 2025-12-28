const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeComoxValley() {
  const allMembers = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  // Try main directory first
  console.log('Scraping Comox Valley Chamber directory...');
  
  // Scrape the main corporate directory page
  const mainUrl = 'https://comoxvalleychamber.com/membership-directory/corporate';
  
  try {
    const result = await firecrawl.scrapeUrl(mainUrl, {
      formats: ['extract'],
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
                  website: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        prompt: 'Extract ALL business member listings from this chamber of commerce directory. For each business, get the company name, address, phone number, website URL, and any description.'
      }
    });
    
    if (result.extract?.members) {
      allMembers.push(...result.extract.members);
      console.log(`Main page: ${result.extract.members.length} members`);
    }
  } catch (err) {
    console.log('Main page error:', err.message);
  }
  
  // Try alphabetical pages (ChamberMaster often has /corporate?search=A format)
  for (const letter of letters) {
    const url = `https://web.comoxvalleychamber.com/allcategories?search=${letter}`;
    console.log(`Trying ${letter}...`);
    
    try {
      const result = await firecrawl.scrapeUrl(url, {
        formats: ['extract'],
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
                    website: { type: 'string' }
                  }
                }
              }
            }
          },
          prompt: 'Extract ALL business names and contact details from this chamber directory page.'
        }
      });
      
      if (result.extract?.members?.length > 0) {
        allMembers.push(...result.extract.members);
        console.log(`  Letter ${letter}: ${result.extract.members.length} members`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (err) {
      console.log(`  ${letter}: ${err.message}`);
    }
  }
  
  console.log(`\nTotal raw members: ${allMembers.length}`);
  fs.writeFileSync('scripts/comox-raw.json', JSON.stringify(allMembers, null, 2));
  console.log('Saved to scripts/comox-raw.json');
}

scrapeComoxValley().catch(console.error);
