const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeSaltSpring() {
  console.log('Starting Playwright to scrape Salt Spring Chamber...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://saltspringchamber.com/Our-Members', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Page loaded');
    
    // Wait for member table to load
    await page.waitForSelector('table', { timeout: 30000 });
    console.log('Table found');
    
    const allMembers = [];
    
    // Get initial page
    let members = await extractMembers(page);
    allMembers.push(...members);
    console.log(`Page 1: ${members.length} members`);
    
    // Try to click through pagination
    const pageLinks = ['51-100', '101-150', '151-166'];
    
    for (const linkText of pageLinks) {
      try {
        const link = await page.$(`text="${linkText}"`);
        if (link) {
          await link.click();
          await page.waitForTimeout(2000);
          members = await extractMembers(page);
          allMembers.push(...members);
          console.log(`Page ${linkText}: ${members.length} members`);
        }
      } catch (e) {
        console.log(`Could not click ${linkText}: ${e.message}`);
      }
    }
    
    console.log(`\nTotal extracted: ${allMembers.length}`);
    fs.writeFileSync('scripts/saltspring-pw.json', JSON.stringify(allMembers, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

async function extractMembers(page) {
  return page.evaluate(() => {
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
}

scrapeSaltSpring().catch(console.error);
