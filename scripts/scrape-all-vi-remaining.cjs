const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

// All 14 remaining VI chambers with their directory URLs
const chambers = [
  { 
    id: 'qualicum-beach-chamber', 
    name: 'Qualicum Beach',
    url: 'https://qualicumbeachchamber.com/member-directory/',
    expectedMembers: 150
  },
  { 
    id: 'port-alberni-chamber', 
    name: 'Alberni Valley',
    url: 'https://albernichamber.ca/directory/name',
    expectedMembers: 200
  },
  { 
    id: 'sooke-chamber', 
    name: 'Sooke',
    url: 'https://sookeregionchamber.com/directory/',
    expectedMembers: 100
  },
  { 
    id: 'sidney-chamber', 
    name: 'Sidney BIA',
    url: 'https://distinctlysidney.ca/',
    expectedMembers: 100
  },
  { 
    id: 'ladysmith-chamber', 
    name: 'Ladysmith',
    url: 'https://www.ladysmithcofc.com/members-directory/',
    expectedMembers: 80
  },
  { 
    id: 'ucluelet-chamber', 
    name: 'Ucluelet',
    url: 'https://ucluelet.ca/development/chamber-of-commerce/member-directory/',
    expectedMembers: 60
  },
  { 
    id: 'port-hardy-chamber', 
    name: 'Port Hardy',
    url: 'https://porthardychamber.com/business-directory/',
    expectedMembers: 60
  },
  { 
    id: 'chemainus-chamber', 
    name: 'Chemainus',
    url: 'https://shopthetown.ca/business-directory/',
    expectedMembers: 80
  },
  { 
    id: 'cowichan-lake-chamber', 
    name: 'Cowichan Lake',
    url: 'https://cowichanlake.ca/business-directory/',
    expectedMembers: 130
  },
  { 
    id: 'port-mcneill-chamber', 
    name: 'Port McNeill',
    url: 'https://www.portmcneill.net/',
    expectedMembers: 40
  },
  { 
    id: 'pender-island-chamber', 
    name: 'Pender Island',
    url: 'https://penderislandchamber.com/',
    expectedMembers: 30
  },
  { 
    id: 'alert-bay-chamber', 
    name: 'Alert Bay',
    url: 'https://myvancouverislandnorth.ca/our-communities/alert-bay/',
    expectedMembers: 20
  },
  { 
    id: 'port-renfrew-chamber', 
    name: 'Port Renfrew',
    url: 'https://portrenfrewchamber.com/business-directory/',
    expectedMembers: 40
  }
];

async function scrapeChamber(app, chamber) {
  console.log(`\n=== Scraping ${chamber.name} (${chamber.id}) ===`);
  console.log(`URL: ${chamber.url}`);
  
  try {
    // First try to map the site
    const mapResult = await app.mapUrl(chamber.url, { search: 'business member directory' });
    
    let businessUrls = [];
    if (mapResult.links) {
      // Filter for business/member pages
      businessUrls = mapResult.links.filter(url => 
        (url.includes('/business') || url.includes('/member') || url.includes('/directory') || url.includes('/listing')) &&
        !url.includes('/join') && !url.includes('/contact') && !url.includes('/about') &&
        !url.includes('/category') && !url.includes('/tag') && !url.includes('?')
      ).slice(0, 300); // Limit to 300 pages
      console.log(`Found ${businessUrls.length} potential member URLs`);
    }
    
    // If we found URLs, batch scrape them
    if (businessUrls.length > 10) {
      const members = [];
      const batchSize = 20;
      
      for (let i = 0; i < businessUrls.length; i += batchSize) {
        const batch = businessUrls.slice(i, i + batchSize);
        console.log(`  Scraping batch ${Math.floor(i/batchSize)+1}/${Math.ceil(businessUrls.length/batchSize)}...`);
        
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
                members.push({
                  name: page.extract.businessName,
                  category: page.extract.category || 'Unknown',
                  address: page.extract.address || '',
                  phone: page.extract.phone || '',
                  website: page.extract.website || '',
                  description: page.extract.description || '',
                  sourceUrl: page.metadata?.sourceURL
                });
              }
            }
          }
        } catch (e) {
          if (e.statusCode === 402) throw e;
          console.log(`    Batch error: ${e.message}`);
        }
        
        await new Promise(r => setTimeout(r, 200));
      }
      
      return members;
    } else {
      // Scrape the main directory page directly
      const result = await app.scrapeUrl(chamber.url, {
        formats: ['extract'],
        extract: {
          prompt: `Extract ALL business listings from this chamber of commerce directory. Get every business name, category, address, phone, website, and description. Be thorough and extract every single listing.`,
          schema: {
            type: 'object',
            properties: {
              totalCount: { type: 'number' },
              businesses: {
                type: 'array',
                items: {
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
            }
          }
        }
      });
      
      if (result.extract?.businesses) {
        return result.extract.businesses.map(b => ({
          name: b.businessName,
          category: b.category || 'Unknown',
          address: b.address || '',
          phone: b.phone || '',
          website: b.website || '',
          description: b.description || ''
        }));
      }
    }
    
    return [];
  } catch (e) {
    if (e.statusCode === 402) {
      console.log('CREDITS EXHAUSTED');
      throw e;
    }
    console.log(`Error scraping ${chamber.name}: ${e.message}`);
    return [];
  }
}

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const allResults = {};
  
  for (const chamber of chambers) {
    try {
      const members = await scrapeChamber(app, chamber);
      
      // Deduplicate
      const seen = new Set();
      const unique = members.filter(m => {
        const key = m.name?.toLowerCase().trim();
        if (!key || seen.has(key) || key.length < 3) return false;
        seen.add(key);
        return true;
      });
      
      allResults[chamber.id] = {
        name: chamber.name,
        members: unique,
        count: unique.length,
        expected: chamber.expectedMembers,
        coverage: Math.round(unique.length / chamber.expectedMembers * 100)
      };
      
      console.log(`\n${chamber.name}: ${unique.length} members (${allResults[chamber.id].coverage}% of expected ${chamber.expectedMembers})`);
      
      // Save progress after each chamber
      fs.writeFileSync('scripts/vi-chambers-progress.json', JSON.stringify(allResults, null, 2));
      
    } catch (e) {
      if (e.statusCode === 402) {
        console.log('\n*** CREDITS EXHAUSTED - Saving progress ***');
        fs.writeFileSync('scripts/vi-chambers-progress.json', JSON.stringify(allResults, null, 2));
        break;
      }
    }
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  let total = 0;
  for (const [id, data] of Object.entries(allResults)) {
    console.log(`${data.name}: ${data.count} members (${data.coverage}%)`);
    total += data.count;
  }
  console.log(`\nTotal new members: ${total}`);
}

main().catch(console.error);
