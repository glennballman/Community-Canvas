const { chromium } = require('playwright');
const fs = require('fs');

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Loading Salt Spring Our Members page...');
  await page.goto('https://www.saltspringchamber.com/Our-Members', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  // Wait for dynamic content
  await page.waitForTimeout(5000);
  
  // Try to scroll to load all content
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }
  
  // Wait for any lazy loading
  await page.waitForTimeout(3000);
  
  // Get all text content to analyze structure
  const pageContent = await page.content();
  fs.writeFileSync('scripts/salt-spring-our-members.html', pageContent);
  
  // Extract member data
  const members = await page.evaluate(() => {
    const items = [];
    
    // Try various selectors for member cards
    const memberCards = document.querySelectorAll('[class*="member"], [class*="directory"], article, .card');
    console.log('Found member cards:', memberCards.length);
    
    memberCards.forEach(card => {
      const name = card.querySelector('h2, h3, h4, .name, .title')?.textContent?.trim();
      if (name && name.length > 2) {
        items.push({
          name,
          category: card.querySelector('.category, .industry, .type')?.textContent?.trim() || 'other'
        });
      }
    });
    
    // Also look for list items
    document.querySelectorAll('li a, .member-list a').forEach(a => {
      const name = a.textContent.trim();
      if (name && name.length > 2 && !name.includes('Login') && !name.includes('Home')) {
        items.push({ name, category: 'other' });
      }
    });
    
    return items;
  });
  
  console.log(`Found ${members.length} members`);
  
  // Deduplicate
  const seen = new Set();
  const unique = members.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
  
  console.log(`Unique: ${unique.length}`);
  fs.writeFileSync('scripts/salt-spring-members-new.json', JSON.stringify(unique, null, 2));
  
  await browser.close();
}

scrape().catch(console.error);
