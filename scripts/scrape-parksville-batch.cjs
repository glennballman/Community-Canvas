const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function batchScrape() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // Load URLs and clean them
  const urls = JSON.parse(fs.readFileSync('scripts/parksville-urls.json', 'utf8'));
  const cleanUrls = [...new Set(urls.map(u => u.replace('/next-listing', '').replace('/previous-listing', '')))];
  console.log(`Unique member URLs: ${cleanUrls.length}`);
  
  // Load existing
  const existing = JSON.parse(fs.readFileSync('scripts/parksville-raw.json', 'utf8'));
  const existingNames = new Set(existing.map(m => m.name?.toLowerCase().trim()));
  console.log(`Already have: ${existing.length} members`);
  
  // Batch scrape in groups of 10
  const batchSize = 10;
  let allMembers = [...existing];
  let newCount = 0;
  
  for (let i = 0; i < cleanUrls.length; i += batchSize) {
    const batch = cleanUrls.slice(i, i + batchSize);
    console.log(`\nBatch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cleanUrls.length/batchSize)}: scraping ${batch.length} URLs...`);
    
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
              description: { type: 'string' }
            }
          }
        }
      });
      
      if (results.data) {
        for (const page of results.data) {
          if (page.extract?.businessName) {
            const name = page.extract.businessName.toLowerCase().trim();
            if (!existingNames.has(name)) {
              existingNames.add(name);
              allMembers.push({
                name: page.extract.businessName,
                category: page.extract.category || 'Unknown',
                address: page.extract.address || '',
                phone: page.extract.phone || '',
                website: page.extract.website || '',
                description: page.extract.description || '',
                sourceUrl: page.metadata?.sourceURL
              });
              newCount++;
            }
          }
        }
        console.log(`  Extracted ${results.data.length} pages, ${newCount} new members total`);
      }
      
      // Save progress after each batch
      fs.writeFileSync('scripts/parksville-raw.json', JSON.stringify(allMembers, null, 2));
      
      // Small delay
      await new Promise(r => setTimeout(r, 300));
      
    } catch (e) {
      if (e.statusCode === 402) {
        console.log('\nCredits exhausted - saving progress');
        break;
      }
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log(`\n=== FINAL: ${allMembers.length} members (added ${newCount}) ===`);
  console.log(`Coverage: ${allMembers.length}/359 = ${Math.round(allMembers.length/359*100)}%`);
}

batchScrape().catch(console.error);
