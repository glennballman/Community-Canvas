const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeSaltSpring() {
  console.log('Starting Playwright for Salt Spring Chamber...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://saltspringchamber.com/Our-Members', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Page loaded');
    
    await page.waitForSelector('table', { timeout: 30000 });
    
    const allMembers = [];
    
    // Extract from first page
    let members = await extractMembers(page);
    allMembers.push(...members);
    console.log(`First batch: ${members.length} members`);
    
    // Try to find and click pagination links using different selectors
    const pageRanges = [
      { start: 51, end: 100 },
      { start: 101, end: 150 },
      { start: 151, end: 166 }
    ];
    
    for (const range of pageRanges) {
      try {
        // Look for links containing the range numbers
        const selector = `a:has-text("${range.start}-${range.end}")`;
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        await page.waitForTimeout(3000);
        
        members = await extractMembers(page);
        allMembers.push(...members);
        console.log(`Range ${range.start}-${range.end}: ${members.length} members`);
      } catch (e) {
        // Try evaluating and clicking via JS
        try {
          const clicked = await page.evaluate((start, end) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.includes(`${start}-`) || link.textContent.includes(`-${end}`)) {
                link.click();
                return true;
              }
            }
            return false;
          }, range.start, range.end);
          
          if (clicked) {
            await page.waitForTimeout(3000);
            members = await extractMembers(page);
            allMembers.push(...members);
            console.log(`Range ${range.start}-${range.end} (JS): ${members.length} members`);
          }
        } catch (e2) {
          console.log(`Could not get range ${range.start}-${range.end}`);
        }
      }
    }
    
    // Deduplicate
    const seen = new Set();
    const unique = allMembers.filter(m => {
      const key = m.businessName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`\nTotal unique: ${unique.length}`);
    fs.writeFileSync('scripts/saltspring-pw.json', JSON.stringify(unique, null, 2));
    
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
