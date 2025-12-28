const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // Try the business subdomain which ChamberMaster typically uses
  console.log('Trying ChamberMaster business subdomain...');
  
  // First, let's check what's available on the business subdomain
  const mapResult = await app.mapUrl('https://business.qualicumbeachchamber.com', { limit: 100 });
  
  if (mapResult.links) {
    console.log('Found URLs on business subdomain:', mapResult.links.length);
    const dirUrls = mapResult.links.filter(u => u.includes('directory') || u.includes('member') || u.includes('list'));
    console.log('Directory-related:', dirUrls.slice(0, 10));
    fs.writeFileSync('scripts/qualicum-urls.json', JSON.stringify(mapResult.links, null, 2));
  }
}

main().catch(e => {
  console.log('Error:', e.message);
});
