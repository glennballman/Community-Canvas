const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const chambers = [
  { id: 'greater-nanaimo-chamber', url: 'https://www.nanaimochamber.bc.ca' },
  { id: 'campbell-river-chamber', url: 'https://www.campbellriverchamber.ca' },
  { id: 'kelowna-chamber', url: 'https://www.kelownachamber.org' }
];

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  for (const chamber of chambers) {
    console.log(`\nMapping ${chamber.id}...`);
    
    const mapResult = await app.mapUrl(chamber.url);
    const memberPages = mapResult.links?.filter(l => 
      l.toLowerCase().includes('member') || 
      l.toLowerCase().includes('directory')
    ) || [];
    
    console.log('Member pages:', memberPages.length);
    memberPages.slice(0, 3).forEach(p => console.log('  ' + p));
    
    if (memberPages.length > 0) {
      // Try the first directory-like page
      const directoryUrl = memberPages.find(p => p.includes('directory') || p.includes('list')) ||
                          memberPages[0];
      
      console.log('Trying:', directoryUrl);
      
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
          prompt: 'Extract ALL business members from this directory.'
        },
        waitFor: 8000
      });
      
      const members = result.extract?.members || [];
      console.log(`Found ${members.length} members`);
      fs.writeFileSync(`scripts/${chamber.id}-members.json`, JSON.stringify(members, null, 2));
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
