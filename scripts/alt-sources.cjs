const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const altSources = [
  // Try ?wpbdp_view=all_listings for WordPress Business Directory sites
  { id: 'ladysmith', url: 'https://www.ladysmithcofc.com/members-directory/?wpbdp_view=all_listings' },
  { id: 'port-hardy', url: 'https://porthardychamber.com/business-directory/?wpbdp_view=all_listings' },
  
  // Try feeds
  { id: 'ladysmith-feed', url: 'https://www.ladysmithcofc.com/feed/?post_type=wpbdp_listing' },
  
  // Try alternative tourism/visitor sites
  { id: 'qualicum-tourism', url: 'https://www.visitparksvillequalicumbeach.com/directory/' },
  { id: 'port-alberni-tourism', url: 'https://alberni.ca/groups' },
  { id: 'ucluelet-tourism', url: 'https://ucluelet.ca/business-development/' }
];

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  for (const source of altSources) {
    console.log(`\n=== ${source.id} ===`);
    console.log(`URL: ${source.url}`);
    
    try {
      const result = await app.scrapeUrl(source.url, {
        formats: ['extract'],
        extract: {
          prompt: 'Extract all business listings from this directory. Get business name, category, address, phone, website.',
          schema: {
            type: 'object',
            properties: {
              businesses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    category: { type: 'string' },
                    address: { type: 'string' },
                    phone: { type: 'string' },
                    website: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      });
      
      const businesses = result.extract?.businesses || [];
      console.log(`Found: ${businesses.length} businesses`);
      
      if (businesses.length > 0) {
        fs.writeFileSync(`scripts/${source.id}-alt.json`, JSON.stringify(businesses, null, 2));
        businesses.slice(0, 3).forEach(b => console.log(`  - ${b.name}`));
      }
    } catch (e) {
      console.log(`Error: ${e.message?.slice(0, 60)}`);
    }
  }
}

main().catch(console.error);
