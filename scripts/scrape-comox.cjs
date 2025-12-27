const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Scraping Comox Valley Chamber...');
  
  // Map the site first
  const mapResult = await app.mapUrl('https://www.comoxvalleychamber.com');
  const memberPages = mapResult.links?.filter(l => 
    l.toLowerCase().includes('member') || 
    l.toLowerCase().includes('directory') ||
    l.toLowerCase().includes('business')
  ) || [];
  
  console.log('Member-related pages:', memberPages.length);
  memberPages.slice(0, 5).forEach(p => console.log('  ' + p));
  
  // Find the directory URL
  const directoryUrl = memberPages.find(p => p.includes('directory')) || 
                       memberPages.find(p => p.includes('member')) ||
                       'https://www.comoxvalleychamber.com/member-directory/';
  
  console.log('\nScraping:', directoryUrl);
  
  const result = await app.scrapeUrl(directoryUrl, {
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
      prompt: 'Extract ALL business members from this chamber directory.'
    },
    waitFor: 8000
  });
  
  const members = result.extract?.members || [];
  console.log(`Found ${members.length} members`);
  fs.writeFileSync('scripts/comox-members.json', JSON.stringify(members, null, 2));
}

main().catch(console.error);
