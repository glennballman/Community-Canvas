const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

async function simpleScrape() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  // Categories with /all suffix for all listings
  const categories = [
    'accommodation', 'associations-a-organizations', 'professional', 
    'food-a-beverage', 'health-a-wellness', 'construction',
    'home-a-garden', 'automotive', 'real-estate', 'financial-services',
    'shopping', 'attractions', 'retail-specialty', 'clothing',
    'personal-care', 'sports-a-recreation', 'media-a-communications',
    'transportation', 'technology', 'wasterecycling'
  ];
  
  let allMembers = [];
  
  for (const cat of categories) {
    const url = `https://www.parksvillechamber.com/member-business-directory/${cat}/all`;
    console.log(`Scraping ${cat}...`);
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ['markdown']
      });
      
      if (result.markdown) {
        // Parse markdown for business entries
        const lines = result.markdown.split('\n');
        let currentBusiness = null;
        
        for (const line of lines) {
          // Business names are usually in links like [Business Name](url)
          const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch && linkMatch[2].includes('/member-business-directory/')) {
            if (currentBusiness) {
              allMembers.push(currentBusiness);
            }
            currentBusiness = {
              name: linkMatch[1].trim(),
              url: linkMatch[2],
              category: cat.replace(/-a-/g, ' & ').replace(/-/g, ' '),
              address: '',
              phone: ''
            };
          }
          
          // Look for address/phone in subsequent lines
          if (currentBusiness) {
            const phoneMatch = line.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phoneMatch) {
              currentBusiness.phone = phoneMatch[0];
            }
            if (line.includes(', BC') || line.includes('British Columbia')) {
              currentBusiness.address = line.trim();
            }
          }
        }
        
        if (currentBusiness) {
          allMembers.push(currentBusiness);
        }
        
        console.log(`  Found entries in markdown`);
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
}

simpleScrape().catch(console.error);
