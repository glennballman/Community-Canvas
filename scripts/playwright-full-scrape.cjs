const { chromium } = require('playwright');
const fs = require('fs');

const chambers = [
  { id: 'qualicum-beach-chamber', name: 'Qualicum Beach', url: 'https://www.qualicumbeachchamber.com/member-directory/' },
  { id: 'ladysmith-chamber', name: 'Ladysmith', url: 'https://www.ladysmithcofc.com/members-directory/' },
  { id: 'port-hardy-chamber', name: 'Port Hardy', url: 'https://porthardychamber.com/business-directory/' },
  { id: 'ucluelet-chamber', name: 'Ucluelet', url: 'https://www.uclueletchamber.com/' },
  { id: 'pender-island-chamber', name: 'Pender Island', url: 'https://penderislandchamber.com/' },
  { id: 'port-renfrew-chamber', name: 'Port Renfrew', url: 'https://portrenfrewchamber.com/business-directory/' }
];

async function scrapeChamber(browser, chamber) {
  console.log(`\n=== ${chamber.name} ===`);
  const page = await browser.newPage();
  
  try {
    await page.goto(chamber.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    
    // Scroll to load lazy content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
        setTimeout(resolve, 5000); // Max 5 seconds
      });
    });
    
    await page.waitForTimeout(1000);
    
    // Get all text that looks like business names
    const businesses = await page.evaluate(() => {
      const items = [];
      
      // Look for links to business/member pages
      document.querySelectorAll('a').forEach(a => {
        const href = a.href;
        const text = a.textContent?.trim();
        
        if (text && text.length >= 4 && text.length <= 80) {
          // Check if it's a business link
          if (href.includes('/member') || href.includes('/business') || 
              href.includes('/directory/') || href.includes('/listing')) {
            // Exclude navigation
            if (!text.match(/^(home|about|contact|join|menu|search|login|events|news|gallery|skip|close|more|next|prev|back|view|all)/i)) {
              items.push({
                name: text,
                website: href,
                category: '',
                phone: '',
                address: ''
              });
            }
          }
        }
      });
      
      return items;
    });
    
    // Dedupe
    const seen = new Set();
    const unique = businesses.filter(b => {
      const key = b.name?.toLowerCase().trim();
      if (!key || seen.has(key) || key.length < 4) return false;
      // Additional filtering
      if (key.match(/^(member|business|directory|listing|category|tag|search|filter)/i)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`Found: ${unique.length} businesses`);
    if (unique.length > 0) {
      unique.slice(0, 5).forEach(b => console.log(`  - ${b.name}`));
      fs.writeFileSync(`scripts/${chamber.id}-urls.json`, JSON.stringify(unique, null, 2));
    }
    
    return unique;
    
  } catch (e) {
    console.log(`Error: ${e.message?.slice(0, 50)}`);
    return [];
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};
  
  for (const chamber of chambers) {
    results[chamber.id] = await scrapeChamber(browser, chamber);
  }
  
  await browser.close();
  
  // Summary
  console.log('\n=== SUMMARY ===');
  let total = 0;
  for (const [id, members] of Object.entries(results)) {
    console.log(`${id}: ${members.length}`);
    total += members.length;
  }
  console.log(`Total: ${total}`);
  
  fs.writeFileSync('scripts/vi-playwright-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
