const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function scrapeUrls(app, chamberId, urls) {
  console.log(`\nScraping ${chamberId}: ${urls.length} URLs...`);
  const members = [];
  const batchSize = 15;
  
  for (let i = 0; i < Math.min(urls.length, 100); i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`  Batch ${Math.floor(i/batchSize)+1}...`);
    
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
              website: { type: 'string' }
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
              website: page.extract.website || ''
            });
          }
        }
      }
    } catch (e) {
      if (e.statusCode === 402) throw e;
      console.log(`    Error: ${e.message?.slice(0, 40)}`);
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
  
  console.log(`  Result: ${unique.length} members`);
  return unique;
}

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // Ladysmith
  try {
    const ladysmith = JSON.parse(fs.readFileSync('scripts/ladysmith-filtered.json', 'utf8'));
    const urls = ladysmith.map(b => b.website).filter(u => u);
    const members = await scrapeUrls(app, 'ladysmith', urls);
    fs.writeFileSync('scripts/ladysmith-details.json', JSON.stringify(members, null, 2));
  } catch (e) {
    if (e.statusCode === 402) { console.log('Credits exhausted!'); return; }
    console.log('Ladysmith error:', e.message?.slice(0, 50));
  }
  
  // Try Port Renfrew with category pages
  try {
    console.log('\nTrying Port Renfrew categories...');
    const categories = [
      'https://portrenfrewchamber.com/business_category/accommodations/',
      'https://portrenfrewchamber.com/business_category/food/',
      'https://portrenfrewchamber.com/business_category/services/',
      'https://portrenfrewchamber.com/business_category/retail/'
    ];
    
    let allMembers = [];
    for (const catUrl of categories) {
      const result = await app.scrapeUrl(catUrl, {
        formats: ['extract'],
        extract: {
          prompt: 'Extract all business listings from this page.',
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
      
      if (result.extract?.businesses) {
        allMembers.push(...result.extract.businesses);
        console.log(`  ${catUrl.split('/').slice(-2)[0]}: ${result.extract.businesses.length}`);
      }
    }
    
    const seen = new Set();
    const unique = allMembers.filter(m => {
      const key = m.name?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    fs.writeFileSync('scripts/port-renfrew-details.json', JSON.stringify(unique, null, 2));
    console.log(`Port Renfrew: ${unique.length} total`);
  } catch (e) {
    if (e.statusCode === 402) { console.log('Credits exhausted!'); return; }
    console.log('Port Renfrew error:', e.message?.slice(0, 50));
  }
  
  // Try Qualicum Beach with category approach
  try {
    console.log('\nTrying Qualicum Beach categories...');
    const result = await app.scrapeUrl('https://www.qualicumbeachchamber.com/member-directory/', {
      formats: ['markdown']  // Try markdown instead of extract
    });
    
    if (result.markdown) {
      // Extract business names from markdown
      const lines = result.markdown.split('\n');
      const businesses = [];
      
      lines.forEach(line => {
        // Look for markdown links that look like business names
        const matches = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (matches) {
          matches.forEach(m => {
            const nameMatch = m.match(/\[([^\]]+)\]/);
            const urlMatch = m.match(/\(([^)]+)\)/);
            if (nameMatch && urlMatch && urlMatch[1].includes('/member-directory/')) {
              businesses.push({
                name: nameMatch[1],
                website: urlMatch[1]
              });
            }
          });
        }
      });
      
      console.log(`Qualicum Beach (from markdown): ${businesses.length}`);
      if (businesses.length > 0) {
        fs.writeFileSync('scripts/qualicum-markdown.json', JSON.stringify(businesses, null, 2));
      }
    }
  } catch (e) {
    console.log('Qualicum Beach error:', e.message?.slice(0, 50));
  }
}

main().catch(console.error);
