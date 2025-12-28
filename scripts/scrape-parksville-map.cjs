const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function mapParksville() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Mapping Parksville Chamber directory URLs...');
  
  const mapResult = await app.mapUrl('https://www.parksvillechamber.com/member-business-directory', {
    search: 'member business',
    limit: 1000
  });
  
  if (mapResult.links) {
    console.log(`Found ${mapResult.links.length} URLs`);
    
    // Filter for member listing URLs
    const memberUrls = mapResult.links.filter(url => 
      url.includes('/member-business-directory/') && 
      !url.includes('browse-by') &&
      /\/\d+-/.test(url)  // Has a numeric ID
    );
    
    console.log(`Filtered to ${memberUrls.length} member URLs`);
    fs.writeFileSync('scripts/parksville-urls.json', JSON.stringify(memberUrls, null, 2));
    
    // Show sample URLs
    console.log('\nSample URLs:');
    memberUrls.slice(0, 5).forEach(u => console.log(u));
  }
  
  return mapResult;
}

mapParksville().catch(console.error);
