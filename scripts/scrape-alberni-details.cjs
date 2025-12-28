const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  const businesses = JSON.parse(fs.readFileSync('scripts/port-alberni-filtered.json', 'utf8'));
  const urls = businesses.map(b => b.website).filter(u => u);
  
  console.log(`Scraping ${urls.length} Port Alberni business pages...`);
  
  const members = [];
  const batchSize = 25;
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`Batch ${Math.floor(i/batchSize)+1}/${Math.ceil(urls.length/batchSize)}...`);
    
    try {
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
              website: { type: 'string' },
              email: { type: 'string' },
              description: { type: 'string' }
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
              website: page.extract.website || '',
              email: page.extract.email || '',
              description: page.extract.description || ''
            });
          }
        }
      }
      
      // Save progress
      fs.writeFileSync('scripts/port-alberni-details.json', JSON.stringify(members, null, 2));
      
    } catch (e) {
      if (e.statusCode === 402) {
        console.log('Credits exhausted!');
        break;
      }
      console.log(`Error: ${e.message?.slice(0, 50)}`);
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
  
  fs.writeFileSync('scripts/port-alberni-final.json', JSON.stringify(unique, null, 2));
  console.log(`\nPort Alberni: ${unique.length} members with full details`);
}

main().catch(console.error);
