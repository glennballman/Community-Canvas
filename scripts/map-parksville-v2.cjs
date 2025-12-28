const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function mapSite() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Mapping Parksville Chamber site...');
  
  const result = await app.mapUrl('https://www.parksvillechamber.com', {
    search: 'member business directory'
  });
  
  if (result.links) {
    console.log(`Total URLs found: ${result.links.length}`);
    
    // Filter for member detail pages
    const memberUrls = result.links.filter(url => {
      // Member pages have numeric IDs like /12345-business-name
      return url.includes('member-business-directory') && 
             /\/\d+-[a-z]/.test(url) &&
             !url.includes('browse-by') &&
             !url.includes('/visit') &&
             !url.includes('/print');
    });
    
    console.log(`Member page URLs: ${memberUrls.length}`);
    fs.writeFileSync('scripts/parksville-urls.json', JSON.stringify(memberUrls, null, 2));
    
    if (memberUrls.length > 0) {
      console.log('\nSample:');
      memberUrls.slice(0, 5).forEach(u => console.log(`  ${u}`));
    }
  }
}

mapSite().catch(e => {
  console.error('Error:', e.message);
  if (e.statusCode) console.log('Status:', e.statusCode);
});
