const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function crawlMembers() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Crawling Parksville member pages...');
  
  const result = await app.crawlUrl('https://www.parksvillechamber.com/member-business-directory', {
    limit: 400,
    maxDepth: 3,
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
          }
        }
      }
    }
  });
  
  console.log('Crawl status:', result.status);
  console.log('Pages crawled:', result.data?.length || 0);
  
  if (result.data) {
    const members = result.data
      .filter(page => {
        const url = page.metadata?.sourceURL || '';
        return page.extract?.businessName && 
          url.includes('/member-business-directory/') &&
          !url.includes('/browse-by') &&
          !url.endsWith('/all') &&
          /\/\d+-/.test(url);  // Has numeric ID pattern like /1234-
      })
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
      if (!key || seen.has(key) || key.length < 3) return false;
      seen.add(key);
      return true;
    });
    
    console.log('Extracted members:', unique.length);
    fs.writeFileSync('scripts/parksville-crawled.json', JSON.stringify(unique, null, 2));
  }
}

crawlMembers().catch(console.error);
