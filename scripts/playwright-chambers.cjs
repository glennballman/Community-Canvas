const { chromium } = require('playwright');
const fs = require('fs');

const chambers = [
  { 
    id: 'ladysmith-chamber', 
    url: 'https://www.ladysmithcofc.com/members-directory/',
    selector: '.wpbdp-listing, .listing-title, .bd-listing-content'
  },
  { 
    id: 'port-hardy-chamber', 
    url: 'https://porthardychamber.com/business-directory/',
    selector: '.listing, article.business, .business-item'
  },
  { 
    id: 'qualicum-beach-chamber', 
    url: 'https://www.qualicumbeachchamber.com/member-directory/',
    selector: '.directory-item, .member-item, .listing'
  },
  { 
    id: 'port-alberni-chamber', 
    url: 'https://albernichamber.ca/directory/name',
    selector: '.directory-item, .member, article'
  },
  { 
    id: 'chemainus-chamber', 
    url: 'https://shopthetown.ca/business-directory/tags/chamber-member/',
    selector: '.business-card, .listing, article'
  },
  { 
    id: 'ucluelet-chamber', 
    url: 'https://ucluelet.ca/development/chamber-of-commerce/member-directory/trades-services',
    selector: '.listing, .member, article'
  },
  { 
    id: 'port-renfrew-chamber', 
    url: 'https://portrenfrewchamber.com/business-directory/',
    selector: '.listing, .business, article'
  },
  { 
    id: 'pender-island-chamber', 
    url: 'https://penderislandchamber.com/',
    selector: '.listing, .member, article, .business'
  }
];

async function scrapeChamber(browser, chamber) {
  console.log(`\n=== ${chamber.id} ===`);
  const page = await browser.newPage();
  
  try {
    await page.goto(chamber.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get page content and extract business-like text
    const content = await page.evaluate(() => {
      const body = document.body.innerText;
      // Get all links that might be business pages
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent?.trim(),
        href: a.href
      })).filter(l => 
        l.text && 
        l.text.length > 3 && 
        l.text.length < 80 &&
        !l.text.match(/^(Home|About|Contact|Join|Menu|Search|Login|Register|Newsletter|Events|News|Gallery|Links|FAQ)/i) &&
        !l.href.includes('facebook.com') && 
        !l.href.includes('twitter.com') &&
        !l.href.includes('instagram.com')
      );
      
      return { textLength: body.length, links };
    });
    
    // Filter for likely business links
    const businessLinks = content.links.filter(l => 
      (l.href.includes('/business') || 
       l.href.includes('/member') || 
       l.href.includes('/directory') ||
       l.href.includes('/listing')) &&
      !l.href.includes('/category') &&
      !l.href.includes('/tag') &&
      !l.href.includes('?')
    );
    
    console.log(`Found ${businessLinks.length} potential business links`);
    
    // Extract business names from links
    const businesses = businessLinks.map(l => ({
      name: l.text,
      website: l.href,
      category: '',
      phone: '',
      address: ''
    }));
    
    // Dedupe
    const seen = new Set();
    const unique = businesses.filter(b => {
      const key = b.name?.toLowerCase().trim();
      if (!key || seen.has(key) || key.length < 4) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`Unique businesses: ${unique.length}`);
    if (unique.length > 0) {
      unique.slice(0, 3).forEach(b => console.log(`  - ${b.name}`));
      fs.writeFileSync(`scripts/${chamber.id}-playwright.json`, JSON.stringify(unique, null, 2));
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
}

main().catch(console.error);
