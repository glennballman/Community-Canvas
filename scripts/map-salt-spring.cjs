const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Mapping Salt Spring Chamber site...');
  
  const result = await app.mapUrl('https://www.saltspringchamber.com/Our-Members');
  
  if (result.links) {
    console.log('Found links:', result.links.length);
    // Filter for member-related pages
    const memberLinks = result.links.filter(l => 
      l.includes('details') || 
      l.includes('member') || 
      l.includes('directory')
    );
    console.log('Member-related links:', memberLinks.length);
    fs.writeFileSync('scripts/salt-spring-links.json', JSON.stringify(memberLinks, null, 2));
  }
}

main().catch(console.error);
