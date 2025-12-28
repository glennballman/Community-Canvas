const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function crawlMembers() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Crawling Parksville member pages...');
  
  const result = await app.crawlUrl('https://www.parksvillechamber.com/member-business-directory', {
    limit: 500,
    includePaths: ['/member-business-directory/*'],
    excludePaths: [
      '/member-business-directory/browse-by*',
      '*/visit',
      '*/print',
      '*/all'
    ],
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
            description: { type: 'string' }
          }
        }
      }
    }
  });
  
  console.log('Crawl status:', result.status);
  console.log('Pages crawled:', result.data?.length || 0);
  
  if (result.data) {
    // Extract member info from individual pages
    const members = result.data
      .filter(page => page.extract?.businessName)
      .map(page => ({
        name: page.extract.businessName,
        category: page.extract.category || 'Unknown',
        address: page.extract.address || '',
        phone: page.extract.phone || '',
        website: page.extract.website || '',
        description: page.extract.description || '',
        sourceUrl: page.metadata?.sourceURL
      }));
    
    // Dedupe
    const seen = new Set();
    const unique = members.filter(m => {
      const key = m.name?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log('Extracted members:', unique.length);
    fs.writeFileSync('scripts/parksville-crawled.json', JSON.stringify(unique, null, 2));
    
    console.log('\nSample:');
    unique.slice(0, 5).forEach(m => console.log(`  - ${m.name} (${m.category})`));
  }
}

crawlMembers().catch(console.error);
