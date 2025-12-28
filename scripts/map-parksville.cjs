const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function mapMembers() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Mapping Parksville member URLs...');
  
  const result = await app.mapUrl('https://www.parksvillechamber.com/member-business-directory', {
    limit: 500
  });
  
  if (result.links) {
    console.log(`Total URLs found: ${result.links.length}`);
    
    // Filter for member pages (have numeric ID pattern)
    const memberUrls = result.links.filter(url => 
      url.includes('/member-business-directory/') &&
      !url.includes('browse-by') &&
      !url.includes('/all') &&
      !url.includes('/visit') &&
      !url.includes('/print') &&
      /\/\d+-/.test(url)
    );
    
    console.log(`Member page URLs: ${memberUrls.length}`);
    fs.writeFileSync('scripts/parksville-member-urls.json', JSON.stringify(memberUrls, null, 2));
    
    // Show sample
    console.log('\nSample URLs:');
    memberUrls.slice(0, 5).forEach(u => console.log(`  ${u}`));
  }
}

mapMembers().catch(console.error);
