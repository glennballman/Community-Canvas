const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function scrapeCategories() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // Based on the first scrape, here are the category URLs
  const categories = [
    { name: 'Accommodation', url: 'https://www.parksvillechamber.com/member-business-directory/accommodation/all' },
    { name: 'Associations', url: 'https://www.parksvillechamber.com/member-business-directory/associations-a-organizations/all' },
    { name: 'Professional', url: 'https://www.parksvillechamber.com/member-business-directory/professional/all' },
    { name: 'Shopping', url: 'https://www.parksvillechamber.com/member-business-directory/shopping/all' },
    { name: 'Food & Beverage', url: 'https://www.parksvillechamber.com/member-business-directory/food-a-beverage/all' },
    { name: 'Health & Wellness', url: 'https://www.parksvillechamber.com/member-business-directory/health-a-wellness/all' },
    { name: 'Construction', url: 'https://www.parksvillechamber.com/member-business-directory/construction/all' },
    { name: 'Home & Garden', url: 'https://www.parksvillechamber.com/member-business-directory/home-a-garden/all' },
    { name: 'Automotive', url: 'https://www.parksvillechamber.com/member-business-directory/automotive/all' },
    { name: 'Real Estate', url: 'https://www.parksvillechamber.com/member-business-directory/real-estate/all' },
    { name: 'Financial Services', url: 'https://www.parksvillechamber.com/member-business-directory/financial-services/all' },
    { name: 'Media', url: 'https://www.parksvillechamber.com/member-business-directory/media-a-communications/all' },
    { name: 'Attractions', url: 'https://www.parksvillechamber.com/member-business-directory/attractions/all' },
    { name: 'Retail Specialty', url: 'https://www.parksvillechamber.com/member-business-directory/retail-specialty/all' },
    { name: 'Clothing', url: 'https://www.parksvillechamber.com/member-business-directory/clothing/all' },
    { name: 'Personal Care', url: 'https://www.parksvillechamber.com/member-business-directory/personal-care/all' },
    { name: 'Technology', url: 'https://www.parksvillechamber.com/member-business-directory/technology/all' },
    { name: 'Transportation', url: 'https://www.parksvillechamber.com/member-business-directory/transportation/all' },
    { name: 'Waste', url: 'https://www.parksvillechamber.com/member-business-directory/wasterecycling/all' },
    { name: 'Sports', url: 'https://www.parksvillechamber.com/member-business-directory/sports-a-recreation/all' },
  ];
  
  let allMembers = [];
  
  for (const cat of categories) {
    console.log(`Scraping ${cat.name}...`);
    try {
      const result = await app.scrapeUrl(cat.url, {
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
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
      
      if (result.extract?.businesses) {
        const members = result.extract.businesses.map(b => ({
          ...b,
          category: cat.name
        }));
        allMembers.push(...members);
        console.log(`  Found ${members.length} businesses`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Dedupe by name
  const seen = new Set();
  const unique = allMembers.filter(m => {
    const key = m.name?.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\nTotal: ${allMembers.length}, Unique: ${unique.length}`);
  fs.writeFileSync('scripts/parksville-raw.json', JSON.stringify(unique, null, 2));
  
  return unique;
}

scrapeCategories().catch(console.error);
