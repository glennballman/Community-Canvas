const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function extractCategories() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  const categories = [
    { slug: 'accommodation', name: 'Accommodation' },
    { slug: 'associations-a-organizations', name: 'Associations & Organizations' },
    { slug: 'professional', name: 'Professional Services' },
    { slug: 'food-a-beverage', name: 'Food & Beverage' },
    { slug: 'health-a-wellness', name: 'Health & Wellness' },
    { slug: 'construction', name: 'Construction' },
    { slug: 'home-a-garden', name: 'Home & Garden' },
    { slug: 'automotive', name: 'Automotive' },
    { slug: 'real-estate', name: 'Real Estate' },
    { slug: 'financial-services', name: 'Financial Services' },
    { slug: 'shopping', name: 'Shopping' },
    { slug: 'attractions', name: 'Attractions' },
    { slug: 'retail-specialty', name: 'Retail Specialty' },
    { slug: 'clothing', name: 'Clothing' },
    { slug: 'personal-care', name: 'Personal Care' },
    { slug: 'sports-a-recreation', name: 'Sports & Recreation' },
    { slug: 'media-a-communications', name: 'Media & Communications' },
    { slug: 'transportation', name: 'Transportation' },
    { slug: 'technology', name: 'Technology' },
    { slug: 'wasterecycling', name: 'Waste & Recycling' },
  ];
  
  let allMembers = [];
  
  for (const cat of categories) {
    const url = `https://www.parksvillechamber.com/member-business-directory/${cat.slug}/all`;
    console.log(`Extracting ${cat.name}...`);
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ['extract'],
        extract: {
          prompt: "Extract all business listings from this chamber directory page. For each business, get the business name, full street address, phone number, and website URL. Skip navigation elements, filters, and category links.",
          schema: {
            type: 'object',
            properties: {
              businesses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    businessName: { type: 'string' },
                    streetAddress: { type: 'string' },
                    city: { type: 'string' },
                    phone: { type: 'string' },
                    websiteUrl: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      });
      
      if (result.extract?.businesses) {
        const members = result.extract.businesses
          .filter(b => b.businessName && !['Filter', 'Print', 'This Category', 'All'].includes(b.businessName))
          .map(b => ({
            name: b.businessName,
            address: b.streetAddress || '',
            city: b.city || 'Parksville',
            phone: b.phone || '',
            website: b.websiteUrl || '',
            category: cat.name
          }));
        allMembers.push(...members);
        console.log(`  Found ${members.length} businesses`);
      } else {
        console.log(`  No businesses found`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Dedupe by name
  const seen = new Set();
  const unique = allMembers.filter(m => {
    const key = m.name?.toLowerCase().trim();
    if (!key || seen.has(key) || key.length < 3) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\nTotal: ${allMembers.length}, Unique: ${unique.length}`);
  fs.writeFileSync('scripts/parksville-raw.json', JSON.stringify(unique, null, 2));
}

extractCategories().catch(console.error);
