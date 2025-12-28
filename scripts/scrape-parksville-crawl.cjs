const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function crawlParksville() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Crawling Parksville directory...');
  
  const result = await app.crawlUrl('https://www.parksvillechamber.com/member-business-directory', {
    limit: 400,
    includePaths: ['/member-business-directory/*'],
    excludePaths: ['/member-business-directory/browse-by*', '/visit'],
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
            city: { type: 'string' },
            description: { type: 'string' }
          }
        }
      }
    }
  });
  
  console.log('Crawl result status:', result.status);
  console.log('Total pages:', result.data?.length || 0);
  
  if (result.data) {
    const members = result.data
      .filter(page => page.extract?.businessName)
      .map(page => ({
        name: page.extract.businessName,
        category: page.extract.category,
        address: page.extract.address,
        phone: page.extract.phone,
        website: page.extract.website,
        city: page.extract.city,
        description: page.extract.description,
        sourceUrl: page.metadata?.sourceURL
      }));
    
    console.log('Extracted members:', members.length);
    fs.writeFileSync('scripts/parksville-crawl.json', JSON.stringify(members, null, 2));
    
    // Show sample
    console.log('\nSample:');
    members.slice(0, 3).forEach(m => console.log(`- ${m.name} (${m.category})`));
  }
}

crawlParksville().catch(console.error);
