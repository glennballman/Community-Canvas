const { chromium } = require('playwright');
const fs = require('fs');

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  console.log('Loading Salt Spring Member Directory...');
  await page.goto('https://www.saltspringchamber.com/Our-Members', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  // Wait for Wild Apricot widget to load
  await page.waitForTimeout(5000);
  
  // Click "Show all" or expand to get all members
  try {
    // Look for pagination or "show all" 
    const showAll = await page.$('select[name*="pageSize"], .pageSize select, a:has-text("All")');
    if (showAll) {
      console.log('Found page size selector');
      await showAll.selectOption({ label: 'All' }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  } catch (e) {}
  
  // Scroll to trigger lazy loading
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
  
  await page.waitForTimeout(3000);
  
  // Now extract members from the member directory widget
  const members = await page.evaluate(() => {
    const items = [];
    
    // Wild Apricot specific selectors
    const memberItems = document.querySelectorAll(
      '.memberDirectoryItem, .memberDetails, ' +
      '[class*="memberDirectory"] a[href*="details"], ' +
      '.WaGadgetMemberDirectory a[href*="details"], ' +
      '.memberName a, .businessName a'
    );
    
    console.log('Member items found:', memberItems.length);
    
    memberItems.forEach(el => {
      let name = el.textContent?.trim() || '';
      // Clean up name
      name = name.replace(/\s+/g, ' ').trim();
      if (name && name.length > 2 && name.length < 100) {
        items.push({ name });
      }
    });
    
    // Also try extracting from any visible member list
    document.querySelectorAll('.memberDirectoryList li, .memberList li').forEach(li => {
      const name = li.textContent?.trim();
      if (name && name.length > 2) {
        items.push({ name });
      }
    });
    
    // Check for category-based listing
    document.querySelectorAll('h2, h3').forEach(h => {
      const category = h.textContent?.trim();
      const list = h.nextElementSibling;
      if (list && list.tagName === 'UL') {
        list.querySelectorAll('li').forEach(li => {
          const name = li.textContent?.trim();
          if (name && name.length > 2) {
            items.push({ name, category });
          }
        });
      }
    });
    
    return items;
  });
  
  console.log(`Found ${members.length} raw members`);
  
  // Deduplicate
  const seen = new Set();
  const unique = members.filter(m => {
    const key = m.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`Unique: ${unique.length}`);
  
  // Save
  fs.writeFileSync('scripts/salt-spring-wa.json', JSON.stringify(unique, null, 2));
  
  // Also save the final page HTML for analysis
  const html = await page.content();
  fs.writeFileSync('scripts/salt-spring-wa-final.html', html);
  
  await browser.close();
}

scrape().catch(console.error);
