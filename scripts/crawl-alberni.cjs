const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Crawling Alberni Valley Chamber...');
  
  const result = await app.crawlUrl('https://albernichamber.ca/directory/', {
    limit: 250,
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
            website: { type: 'string' },
            email: { type: 'string' }
          }
        }
      }
    }
  });
  
  console.log('Pages crawled:', result.data?.length || 0);
  
  if (result.data) {
    const members = result.data
      .filter(page => page.extract?.businessName && 
        page.metadata?.sourceURL?.includes('/directory/') &&
        !page.metadata?.sourceURL?.endsWith('/directory/') &&
        !page.metadata?.sourceURL?.includes('/name'))
      .map(page => ({
        name: page.extract.businessName,
        category: page.extract.category || 'Unknown',
        address: page.extract.address || '',
        phone: page.extract.phone || '',
        website: page.extract.website || '',
        email: page.extract.email || ''
      }));
    
    const seen = new Set();
    const unique = members.filter(m => {
      const key = m.name?.toLowerCase().trim();
      if (!key || seen.has(key) || key.length < 3) return false;
      seen.add(key);
      return true;
    });
    
    fs.writeFileSync('scripts/port-alberni-raw.json', JSON.stringify(unique, null, 2));
    console.log(`Alberni Valley: ${unique.length} members`);
    unique.slice(0, 5).forEach(m => console.log(`  - ${m.name}`));
  }
}

main().catch(console.error);
