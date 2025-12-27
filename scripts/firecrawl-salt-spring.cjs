const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Scraping Salt Spring Chamber with Firecrawl...');
  
  const result = await app.scrapeUrl('https://www.saltspringchamber.com/Our-Members', {
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
                name: { type: 'string', description: 'Business name' },
                category: { type: 'string', description: 'Industry or business category' },
                website: { type: 'string', description: 'Business website URL' }
              }
            }
          }
        }
      },
      prompt: 'Extract ALL business members from this chamber of commerce member directory. Include every business name visible on the page with their category if available.'
    },
    waitFor: 8000
  });
  
  console.log('Result:', JSON.stringify(result.extract, null, 2).substring(0, 3000));
  
  if (result.extract?.members) {
    fs.writeFileSync('scripts/salt-spring-firecrawl.json', JSON.stringify(result.extract.members, null, 2));
    console.log('Saved', result.extract.members.length, 'members');
  }
}

main().catch(console.error);
