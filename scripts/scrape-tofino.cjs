const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const allMembers = [];
  
  console.log('Scraping Tofino Chamber...');
  
  // Main list page should have all members
  const result = await app.scrapeUrl('https://business.tofinochamber.org/list', {
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
                category: { type: 'string' },
                website: { type: 'string' },
                address: { type: 'string' },
                phone: { type: 'string' }
              }
            }
          }
        }
      },
      prompt: 'Extract ALL business members from this directory. Include every business name, category, website, address and phone number.'
    },
    waitFor: 8000
  });
  
  const members = result.extract?.members || [];
  console.log(`Found ${members.length} members from main list`);
  
  // Also try a few alphabetical pages
  const letters = ['a', 's', 't', 'w'];
  for (const letter of letters) {
    console.log(`Scraping letter ${letter}...`);
    const letterResult = await app.scrapeUrl(`https://business.tofinochamber.org/list/searchalpha/${letter}`, {
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
        prompt: 'Extract ALL business names and categories from this directory page.'
      },
      waitFor: 5000
    });
    
    const letterMembers = letterResult.extract?.members || [];
    console.log(`  Found ${letterMembers.length} members`);
    allMembers.push(...letterMembers);
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allMembers.filter(m => {
    if (!m.name || seen.has(m.name.toLowerCase())) return false;
    seen.add(m.name.toLowerCase());
    return true;
  });
  
  console.log(`\nTotal unique members: ${unique.length}`);
  fs.writeFileSync('scripts/tofino-members.json', JSON.stringify(unique, null, 2));
}

main().catch(console.error);
