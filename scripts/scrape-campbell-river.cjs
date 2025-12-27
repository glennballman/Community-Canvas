const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Mapping Campbell River Chamber...');
  
  const mapResult = await app.mapUrl('https://campbellriverchamber.ca');
  const memberPages = mapResult.links?.filter(l => l.includes('/directory/business/')) || [];
  
  console.log(`Found ${memberPages.length} member pages`);
  
  // Extract business names from URLs
  const members = memberPages.map(url => {
    const match = url.match(/\/directory\/business\/(.+)$/);
    if (match) {
      // Convert URL slug to business name
      const name = match[1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
      return { name, url };
    }
    return null;
  }).filter(Boolean);
  
  // Deduplicate
  const seen = new Set();
  const unique = members.filter(m => {
    const key = m.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`Unique members: ${unique.length}`);
  fs.writeFileSync('scripts/campbell-river-members.json', JSON.stringify(unique, null, 2));
  
  // Also get categories by scraping a few
  console.log('\nScraping sample for categories...');
  const sampleUrls = memberPages.slice(0, 10);
  
  for (const url of sampleUrls) {
    try {
      const result = await app.scrapeUrl(url, {
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              businessName: { type: 'string' },
              category: { type: 'string' },
              address: { type: 'string' },
              phone: { type: 'string' }
            }
          },
          prompt: 'Extract the business name, category/industry, address, and phone number.'
        },
        waitFor: 3000
      });
      
      const data = result.extract;
      if (data?.businessName) {
        // Update member with category
        const member = unique.find(m => m.url === url);
        if (member) {
          member.category = data.category || 'other';
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  
  fs.writeFileSync('scripts/campbell-river-members.json', JSON.stringify(unique, null, 2));
  console.log('Done!');
}

main().catch(console.error);
