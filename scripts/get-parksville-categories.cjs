const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function getCategories() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Getting all Parksville categories...');
  
  const result = await app.scrapeUrl('https://www.parksvillechamber.com/member-business-directory', {
    formats: ['extract'],
    extract: {
      prompt: "Extract ALL category names and their URLs from this chamber directory page. Include all browsable categories.",
      schema: {
        type: 'object',
        properties: {
          totalMemberCount: { type: 'string' },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                memberCount: { type: 'number' }
              }
            }
          }
        }
      }
    }
  });
  
  console.log('Total claimed:', result.extract?.totalMemberCount);
  console.log('\nCategories found:');
  if (result.extract?.categories) {
    result.extract.categories.forEach(c => {
      console.log(`  ${c.name}: ${c.memberCount || '?'} members - ${c.url}`);
    });
  }
}

getCategories().catch(console.error);
