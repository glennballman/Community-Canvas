const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const allMembers = [];
  
  console.log('Scraping Parksville Chamber...');
  
  // Try main directory
  const result = await app.scrapeUrl('https://www.parksvillechamber.com/member-business-directory/', {
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
      prompt: 'Extract ALL business members and their categories from this directory.'
    },
    waitFor: 8000
  });
  
  const members = result.extract?.members || [];
  console.log(`Found ${members.length} from main page`);
  allMembers.push(...members);
  
  // Try browsing by category
  const browseResult = await app.scrapeUrl('https://www.parksvillechamber.com/member-business-directory/browse-by-category', {
    formats: ['extract'],
    extract: {
      schema: {
        type: 'object',
        properties: {
          categories: { type: 'array', items: { type: 'string' } },
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
      prompt: 'List all category names and any business members visible.'
    },
    waitFor: 8000
  });
  
  console.log('Categories found:', browseResult.extract?.categories?.length || 0);
  allMembers.push(...(browseResult.extract?.members || []));
  
  // Try alphabetical pages
  for (let i = 1; i <= 15; i++) {
    console.log(`Scraping page ${i}...`);
    try {
      const pageResult = await app.scrapeUrl(`https://www.parksvillechamber.com/business-member-directory/list-alpha/${i}`, {
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
      
      const pageMembers = pageResult.extract?.members || [];
      console.log(`  Found ${pageMembers.length} members`);
      if (pageMembers.length === 0) break;
      allMembers.push(...pageMembers);
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
  
  console.log(`\nTotal unique Parksville members: ${unique.length}`);
  fs.writeFileSync('scripts/parksville-members.json', JSON.stringify(unique, null, 2));
}

main().catch(console.error);
