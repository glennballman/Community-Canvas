const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  console.log('Launching Playwright for Ladysmith Chamber...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.ladysmithcofc.com/members-directory/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Get all business listings
    const businesses = await page.evaluate(() => {
      const items = [];
      // Look for common patterns in business directories
      const cards = document.querySelectorAll('.wpbdp-listing, .listing, .member, article, .business-card, .directory-item');
      
      cards.forEach(card => {
        const nameEl = card.querySelector('h2, h3, h4, .title, .name, a');
        const catEl = card.querySelector('.category, .categories, .tags');
        const phoneEl = card.querySelector('.phone, [href^="tel:"]');
        const addrEl = card.querySelector('.address, .location');
        
        if (nameEl?.textContent?.trim()) {
          items.push({
            name: nameEl.textContent.trim(),
            category: catEl?.textContent?.trim() || '',
            phone: phoneEl?.textContent?.trim() || phoneEl?.getAttribute('href')?.replace('tel:', '') || '',
            address: addrEl?.textContent?.trim() || ''
          });
        }
      });
      
      // Also try getting from any visible list
      if (items.length === 0) {
        document.querySelectorAll('a').forEach(a => {
          const href = a.href;
          if (href.includes('/member') || href.includes('/business') || href.includes('/listing')) {
            const text = a.textContent?.trim();
            if (text && text.length > 3 && text.length < 100 && !text.includes('Join') && !text.includes('Contact')) {
              items.push({ name: text, category: '', phone: '', address: '' });
            }
          }
        });
      }
      
      return items;
    });
    
    console.log(`Found ${businesses.length} businesses`);
    
    // Dedupe
    const seen = new Set();
    const unique = businesses.filter(b => {
      const key = b.name?.toLowerCase().trim();
      if (!key || seen.has(key) || key.length < 3) return false;
      seen.add(key);
      return true;
    });
    
    fs.writeFileSync('scripts/ladysmith-playwright.json', JSON.stringify(unique, null, 2));
    console.log(`Unique: ${unique.length}`);
    unique.slice(0, 5).forEach(b => console.log(`  - ${b.name}`));
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await browser.close();
}

main().catch(console.error);
