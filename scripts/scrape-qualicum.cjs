const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Mapping Qualicum Beach Chamber...');
  const mapResult = await app.mapUrl('https://www.qualicumbeachchamber.com', { search: 'member directory' });
  
  if (mapResult.links) {
    // Filter for member pages
    const memberUrls = mapResult.links.filter(url => 
      url.includes('/member-directory/') && 
      !url.includes('/category') && 
      !url.includes('/tag') &&
      !url.includes('?') &&
      url.split('/').length > 4
    );
    
    console.log(`Found ${memberUrls.length} member URLs`);
    
    if (memberUrls.length < 20) {
      console.log('URLs:', memberUrls.slice(0, 10));
    }
    
    // Batch scrape
    const members = [];
    const batchSize = 20;
    
    for (let i = 0; i < memberUrls.length; i += batchSize) {
      const batch = memberUrls.slice(i, i + batchSize);
      console.log(`Batch ${Math.floor(i/batchSize)+1}/${Math.ceil(memberUrls.length/batchSize)}...`);
      
      const results = await app.batchScrapeUrls(batch, {
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
      });
      
      if (results.data) {
        for (const page of results.data) {
          if (page.extract?.businessName) {
            members.push({
              name: page.extract.businessName,
              category: page.extract.category || 'Unknown',
              address: page.extract.address || '',
              phone: page.extract.phone || '',
              website: page.extract.website || ''
            });
          }
        }
      }
    }
    
    // Dedupe
    const seen = new Set();
    const unique = members.filter(m => {
      const key = m.name?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    fs.writeFileSync('scripts/qualicum-raw.json', JSON.stringify(unique, null, 2));
    console.log(`\nQualicum Beach: ${unique.length} members`);
  }
}

main().catch(console.error);
