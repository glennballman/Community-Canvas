const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const allMembers = [];
  
  console.log('Scraping all Tofino letters...');
  
  // All letters
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  for (const letter of letters) {
    console.log(`Scraping letter ${letter}...`);
    try {
      const result = await app.scrapeUrl(`https://business.tofinochamber.org/list/searchalpha/${letter}`, {
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
                    name: { type: 'string' },
                    category: { type: 'string' }
                  }
                }
              }
            }
          },
          prompt: 'Extract ALL business names and their categories from this directory page.'
        },
        waitFor: 5000
      });
      
      const members = result.extract?.members || [];
      console.log(`  Found ${members.length} members`);
      allMembers.push(...members);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1200));
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allMembers.filter(m => {
    if (!m.name || seen.has(m.name.toLowerCase())) return false;
    seen.add(m.name.toLowerCase());
    return true;
  });
  
  console.log(`\nTotal unique Tofino members: ${unique.length}`);
  fs.writeFileSync('scripts/tofino-full-members.json', JSON.stringify(unique, null, 2));
}

main().catch(console.error);
