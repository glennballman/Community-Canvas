const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Crawling Qualicum Beach Chamber directory...');
  
  const result = await app.crawlUrl('https://www.qualicumbeachchamber.com/member-directory/', {
    limit: 200,
    maxDepth: 2,
    scrapeOptions: {
      formats: ['extract'],
      extract: {
        schema: {
          type: 'object',
          properties: {
            businessName: { type: 'string' },
            category: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            website: { type: 'string' }
          }
        }
      }
    }
  });
  
  console.log('Crawl complete. Pages:', result.data?.length || 0);
  
  if (result.data) {
    const members = result.data
      .filter(page => page.extract?.businessName && 
        page.metadata?.sourceURL?.includes('/member-directory/') &&
        !page.metadata?.sourceURL?.includes('/category') &&
        !page.metadata?.sourceURL?.includes('/tag'))
      .map(page => ({
        name: page.extract.businessName,
        category: page.extract.category || 'Unknown',
        address: page.extract.address || '',
        phone: page.extract.phone || '',
        website: page.extract.website || '',
        sourceUrl: page.metadata?.sourceURL
      }));
    
    const seen = new Set();
    const unique = members.filter(m => {
      const key = m.name?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    fs.writeFileSync('scripts/qualicum-raw.json', JSON.stringify(unique, null, 2));
    console.log(`Qualicum Beach: ${unique.length} unique members`);
    unique.slice(0, 5).forEach(m => console.log(`  - ${m.name}`));
  }
}

main().catch(console.error);
