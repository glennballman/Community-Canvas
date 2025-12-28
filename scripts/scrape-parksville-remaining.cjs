const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function scrapeRemaining() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // These categories failed due to credits last time
  const categories = [
    { slug: 'attractions', name: 'Attractions' },
    { slug: 'retail-specialty', name: 'Retail Specialty' },
    { slug: 'clothing', name: 'Clothing' },
    { slug: 'personal-care', name: 'Personal Care' },
    { slug: 'sports-a-recreation', name: 'Sports & Recreation' },
    { slug: 'media-a-communications', name: 'Media & Communications' },
    { slug: 'transportation', name: 'Transportation' },
    { slug: 'technology', name: 'Technology' },
    { slug: 'wasterecycling', name: 'Waste & Recycling' },
    { slug: 'governmentutilities', name: 'Government & Utilities' },
    { slug: 'seniors', name: 'Seniors Services' },
    { slug: 'pets-animals', name: 'Pets & Animals' },
  ];
  
  // Load existing data
  let allMembers = [];
  if (fs.existsSync('scripts/parksville-raw.json')) {
    allMembers = JSON.parse(fs.readFileSync('scripts/parksville-raw.json', 'utf8'));
    console.log('Starting with', allMembers.length, 'existing members');
  }
  
  const existingNames = new Set(allMembers.map(m => m.name?.toLowerCase().trim()));
  
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
          .filter(b => !existingNames.has(b.businessName?.toLowerCase().trim()))
          .map(b => ({
            name: b.businessName,
            address: b.streetAddress || '',
            city: b.city || 'Parksville',
            phone: b.phone || '',
            website: b.websiteUrl || '',
            category: cat.name
          }));
        
        for (const m of members) {
          existingNames.add(m.name?.toLowerCase().trim());
        }
        
        allMembers.push(...members);
        console.log(`  Found ${members.length} new businesses`);
      } else {
        console.log(`  No businesses found`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      if (e.message.includes('402') || e.message.includes('Insufficient')) {
        console.log('Out of credits again, saving progress');
        break;
      }
    }
  }
  
  console.log(`\nTotal unique: ${allMembers.length}`);
  fs.writeFileSync('scripts/parksville-raw.json', JSON.stringify(allMembers, null, 2));
}

scrapeRemaining().catch(console.error);
