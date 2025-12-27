/**
 * Salt Spring Island Chamber - Full Member Directory Scraper
 * Uses Playwright to handle Wild Apricot pagination
 */
const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeAllPages() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  console.log('Loading Salt Spring Chamber directory...');
  
  // Load directory page
  await page.goto('https://www.saltspringchamber.com/Member-Directory', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  const allMembers = [];
  let pageNum = 1;
  let hasMore = true;
  
  while (hasMore && pageNum <= 20) {
    console.log(`Scraping page ${pageNum}...`);
    
    // Extract members from current page
    const members = await page.evaluate(() => {
      const items = [];
      
      // Try different selectors for Wild Apricot
      const selectors = [
        '.memberItem',
        '.wa-member-directory-item',
        '.member-item',
        '.business-card',
        '.directory-item',
        '[data-itemid]',
        '.memberCard',
        'article[class*="member"]',
        'div[class*="member"]'
      ];
      
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          console.log(`Found ${els.length} elements with ${sel}`);
          els.forEach(el => {
            const nameEl = el.querySelector('h2, h3, h4, .name, .title, a[href*="details"]');
            const name = nameEl ? nameEl.textContent.trim() : '';
            if (name && name.length > 2 && name !== 'Read more') {
              items.push({
                name: name,
                category: el.querySelector('.category, .industry')?.textContent?.trim() || 'other',
                website: el.querySelector('a[href^="http"]')?.href || ''
              });
            }
          });
        }
      }
      
      // If specific selectors don't work, try general links
      if (items.length === 0) {
        document.querySelectorAll('.waWidget a, .member-name a').forEach(a => {
          const name = a.textContent.trim();
          if (name && name.length > 2) {
            items.push({ name, category: 'other', website: a.href || '' });
          }
        });
      }
      
      return items;
    });
    
    console.log(`  Found ${members.length} members on page ${pageNum}`);
    allMembers.push(...members);
    
    // Try to find and click next page
    const nextButton = await page.$('a[aria-label="Next"], .pagination .next, a:has-text("Next"), .pager .next');
    
    if (nextButton) {
      const isDisabled = await nextButton.evaluate(el => 
        el.classList.contains('disabled') || 
        el.getAttribute('aria-disabled') === 'true' ||
        el.style.display === 'none'
      );
      
      if (!isDisabled) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        pageNum++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allMembers.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
  
  console.log(`\nTotal unique members: ${unique.length}`);
  
  // Save results
  fs.writeFileSync('scripts/salt-spring-full.json', JSON.stringify(unique, null, 2));
  console.log('Saved to scripts/salt-spring-full.json');
  
  await browser.close();
  return unique;
}

scrapeAllPages().catch(console.error);
