const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const chambers = [
  { id: 'qualicum-beach-chamber', name: 'Qualicum Beach', url: 'https://www.qualicumbeachchamber.com/member-directory/' },
  { id: 'port-alberni-chamber', name: 'Alberni Valley', url: 'https://albernichamber.ca/directory/name' },
  { id: 'ladysmith-chamber', name: 'Ladysmith', url: 'https://www.ladysmithcofc.com/members-directory/' },
  { id: 'chemainus-chamber', name: 'Chemainus', url: 'https://shopthetown.ca/business-directory/tags/chamber-member/' },
  { id: 'cowichan-lake-chamber', name: 'Cowichan Lake', url: 'https://cowichanlake.ca/business-directory/' },
  { id: 'port-hardy-chamber', name: 'Port Hardy', url: 'https://porthardychamber.com/business-directory/' },
  { id: 'port-mcneill-chamber', name: 'Port McNeill', url: 'https://portmcneill.ca/business/business-directory/' },
  { id: 'ucluelet-chamber', name: 'Ucluelet', url: 'https://ucluelet.ca/development/chamber-of-commerce/member-directory/trades-services' },
  { id: 'pender-island-chamber', name: 'Pender Island', url: 'https://penderislandchamber.com/' },
  { id: 'port-renfrew-chamber', name: 'Port Renfrew', url: 'https://portrenfrewchamber.com/business-directory/' },
  { id: 'sooke-chamber', name: 'Sooke', url: 'https://sookeregionchamber.com/directory/' },
  { id: 'sidney-chamber', name: 'Sidney', url: 'https://distinctlysidney.ca/' }
];

async function extractFromPage(app, chamber) {
  console.log(`\n=== ${chamber.name} ===`);
  console.log(`URL: ${chamber.url}`);
  
  try {
    const result = await app.scrapeUrl(chamber.url, {
      formats: ['extract'],
      extract: {
        prompt: `This is a chamber of commerce or business directory page. Extract EVERY business listing you can find. Look for business names, categories, addresses, phone numbers, and websites. Extract as many businesses as possible - there should be many listings on this page. Be very thorough.`,
        schema: {
          type: 'object',
          properties: {
            totalBusinessesFound: { type: 'number' },
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
    return businesses.map(b => ({
      ...b,
      chamberId: chamber.id
    }));
  } catch (e) {
    if (e.statusCode === 402) throw e;
    console.log(`Error: ${e.message}`);
    return [];
  }
}

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const allResults = {};
  
  for (const chamber of chambers) {
    try {
      const businesses = await extractFromPage(app, chamber);
      
      // Dedupe
      const seen = new Set();
      const unique = businesses.filter(b => {
        const key = b.name?.toLowerCase().trim();
        if (!key || seen.has(key) || key.length < 3) return false;
        seen.add(key);
        return true;
      });
      
      allResults[chamber.id] = unique;
      console.log(`Unique: ${unique.length}`);
      
      // Save individual file
      fs.writeFileSync(`scripts/${chamber.id}-raw.json`, JSON.stringify(unique, null, 2));
      
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      if (e.statusCode === 402) {
        console.log('\n*** CREDITS EXHAUSTED ***');
        break;
      }
    }
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  let total = 0;
  for (const [id, members] of Object.entries(allResults)) {
    console.log(`${id}: ${members.length}`);
    total += members.length;
  }
  console.log(`Total: ${total}`);
  
  fs.writeFileSync('scripts/all-vi-extracted.json', JSON.stringify(allResults, null, 2));
}

main().catch(console.error);
