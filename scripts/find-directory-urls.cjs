const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const chambers = [
  { id: 'burnaby-board-of-trade', url: 'https://www.bbot.ca' },
  { id: 'abbotsford-chamber', url: 'https://www.abbotsfordchamber.com' },
  { id: 'comox-valley-chamber', url: 'https://www.comoxvalleychamber.com' },
  { id: 'parksville-chamber', url: 'https://www.parksvillechamber.com' },
  { id: 'tofino-chamber', url: 'https://www.tofinochamber.org' }
];

async function findDirectoryUrl(app, chamber) {
  console.log(`\nMapping ${chamber.id}...`);
  
  try {
    const result = await app.mapUrl(chamber.url);
    
    if (result.links) {
      // Find member-related pages
      const memberPages = result.links.filter(l => 
        l.toLowerCase().includes('member') || 
        l.toLowerCase().includes('directory') ||
        l.toLowerCase().includes('business')
      );
      console.log(`  Member pages found: ${memberPages.length}`);
      memberPages.forEach(p => console.log(`    ${p}`));
      return memberPages;
    }
    return [];
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return [];
  }
}

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  for (const chamber of chambers) {
    await findDirectoryUrl(app, chamber);
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
