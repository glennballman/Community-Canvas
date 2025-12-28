const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeSaltSpring() {
  console.log('Starting Playwright with scroll approach...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://saltspringchamber.com/Our-Members', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    console.log('Page loaded');
    
    // Wait for table
    await page.waitForSelector('table', { timeout: 30000 });
    
    // Scroll down to trigger loading
    let lastHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrollCount = 0;
    
    while (scrollCount < 20) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) {
        console.log('No more content to load after', scrollCount + 1, 'scrolls');
        break;
      }
      lastHeight = newHeight;
      scrollCount++;
      console.log(`Scrolled ${scrollCount} times, height: ${newHeight}`);
    }
    
    // Now try to click pagination if available
    const paginationLinks = await page.$$eval('a', links => 
      links.filter(l => l.textContent.match(/\d+-\d+/))
           .map(l => ({ text: l.textContent.trim(), visible: l.offsetParent !== null }))
    );
    
    console.log('Pagination links found:', paginationLinks);
    
    // Try clicking through each pagination
    for (const linkInfo of paginationLinks.filter(l => l.visible)) {
      try {
        await page.click(`a:has-text("${linkInfo.text}")`);
        await page.waitForTimeout(2000);
        console.log(`Clicked ${linkInfo.text}`);
      } catch (e) {
        console.log(`Failed to click ${linkInfo.text}`);
      }
    }
    
    // Extract all visible members now
    const members = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const members = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const nameLink = cells[0].querySelector('a');
          const websiteLink = cells[1].querySelector('a');
          const industry = cells[2]?.textContent?.trim() || '';
          
          if (nameLink) {
            members.push({
              businessName: nameLink.textContent.trim(),
              website: websiteLink?.href || '',
              industry: industry
            });
          }
        }
      });
      return members;
    });
    
    console.log(`\nExtracted: ${members.length} members`);
    fs.writeFileSync('scripts/saltspring-scroll.json', JSON.stringify(members, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

scrapeSaltSpring().catch(console.error);
