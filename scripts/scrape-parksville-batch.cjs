const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function scrapeBatch() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // Batch scrape the main directory with all listings
  console.log('Batch scraping Parksville directory...');
  
  const batchResult = await app.batchScrapeUrls([
    'https://www.parksvillechamber.com/member-business-directory/accommodation/all',
    'https://www.parksvillechamber.com/member-business-directory/associations-a-organizations/all',
    'https://www.parksvillechamber.com/member-business-directory/professional/all',
    'https://www.parksvillechamber.com/member-business-directory/food-a-beverage/all',
    'https://www.parksvillechamber.com/member-business-directory/health-a-wellness/all',
    'https://www.parksvillechamber.com/member-business-directory/construction/all',
    'https://www.parksvillechamber.com/member-business-directory/home-a-garden/all',
    'https://www.parksvillechamber.com/member-business-directory/automotive/all',
    'https://www.parksvillechamber.com/member-business-directory/real-estate/all',
    'https://www.parksvillechamber.com/member-business-directory/financial-services/all',
    'https://www.parksvillechamber.com/member-business-directory/shopping/all',
    'https://www.parksvillechamber.com/member-business-directory/attractions/all',
    'https://www.parksvillechamber.com/member-business-directory/retail-specialty/all',
    'https://www.parksvillechamber.com/member-business-directory/clothing/all',
    'https://www.parksvillechamber.com/member-business-directory/personal-care/all',
    'https://www.parksvillechamber.com/member-business-directory/sports-a-recreation/all',
    'https://www.parksvillechamber.com/member-business-directory/media-a-communications/all',
    'https://www.parksvillechamber.com/member-business-directory/transportation/all',
    'https://www.parksvillechamber.com/member-business-directory/technology/all',
    'https://www.parksvillechamber.com/member-business-directory/wasterecycling/all',
  ], {
    formats: ['extract'],
    extract: {
      schema: {
        type: 'object',
        properties: {
          categoryName: { type: 'string' },
          businesses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: { type: 'string' },
                phone: { type: 'string' },
                website: { type: 'string' },
                city: { type: 'string' },
              }
            }
          }
        }
      }
    }
  });
  
  console.log('Batch ID:', batchResult.id);
  console.log('Status:', batchResult.status);
  fs.writeFileSync('scripts/parksville-batch-id.txt', batchResult.id);
  
  // Poll for completion
  let status = batchResult.status;
  let data = null;
  while (status !== 'completed' && status !== 'failed') {
    await new Promise(r => setTimeout(r, 5000));
    const check = await app.checkBatchScrapeStatus(batchResult.id);
    status = check.status;
    console.log('Status:', status, '- Completed:', check.completed || 0);
    if (status === 'completed') {
      data = check.data;
    }
  }
  
  if (data) {
    let allMembers = [];
    for (const page of data) {
      if (page.extract?.businesses) {
        const category = page.extract.categoryName || 'Unknown';
        for (const b of page.extract.businesses) {
          allMembers.push({ ...b, category });
        }
      }
    }
    
    // Dedupe
    const seen = new Set();
    const unique = allMembers.filter(m => {
      const key = m.name?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`Total: ${allMembers.length}, Unique: ${unique.length}`);
    fs.writeFileSync('scripts/parksville-raw.json', JSON.stringify(unique, null, 2));
  }
}

scrapeBatch().catch(console.error);
