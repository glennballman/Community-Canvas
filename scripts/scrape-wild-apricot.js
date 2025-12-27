/**
 * Scrape Wild Apricot-based chamber directories using Playwright
 * Target: Salt Spring Island Chamber of Commerce
 */

import { chromium } from 'playwright';
import fs from 'fs';

const RATE_LIMIT_MS = 2000;

async function scrapeSaltSpringChamber(page) {
  const chamberId = 'salt-spring-island';
  const url = 'https://saltspringchamber.com/Our-Members';
  
  console.log('='.repeat(70));
  console.log('Salt Spring Island Chamber of Commerce');
  console.log(`URL: ${url}`);
  console.log('Expected members: 166');
  console.log('='.repeat(70));
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const members = [];
  const seenNames = new Set();
  
  const pageRanges = ['1-50', '51-100', '101-150', '151-166'];
  
  for (const range of pageRanges) {
    console.log(`\nLoading page range: ${range}...`);
    
    const pageLink = await page.$(`a:has-text("${range}"), span.waText:has-text("${range}")`);
    
    if (pageLink) {
      try {
        await pageLink.click();
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log(`  Could not click range ${range}: ${e.message}`);
        continue;
      }
    }
    
    const rows = await page.$$('table tbody tr, .memberListRow, [class*="memberRow"]');
    console.log(`  Found ${rows.length} rows...`);
    
    for (const row of rows) {
      try {
        const nameLink = await row.$('a[href*="PublicProfile"]');
        if (!nameLink) continue;
        
        const name = (await nameLink.textContent())?.trim();
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        
        const cells = await row.$$('td');
        let website = '';
        let industry = '';
        let contact = '';
        
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const text = (await cell.textContent())?.trim() || '';
          
          const websiteLink = await cell.$('a[href^="http"]:not([href*="saltspringchamber"])');
          if (websiteLink) {
            website = await websiteLink.getAttribute('href') || '';
          }
          
          if (i === cells.length - 1 && text && !text.includes('http')) {
            industry = text;
          }
        }
        
        const contactSpan = await row.$('br + text, td:first-child');
        if (contactSpan) {
          const fullText = (await contactSpan.textContent())?.trim() || '';
          const parts = fullText.split('\n');
          if (parts.length > 1) {
            contact = parts[parts.length - 1].trim();
          }
        }
        
        members.push({
          name,
          website,
          industry,
          contact,
          chamberId
        });
        
      } catch (e) {
      }
    }
    
    console.log(`  Total members so far: ${members.length}`);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: Salt Spring Island Chamber`);
  console.log(`  Total members: ${members.length}`);
  console.log(`  Expected: 166`);
  console.log(`  Coverage: ${Math.round(members.length / 166 * 100)}%`);
  console.log('='.repeat(70));
  
  return members;
}

async function main() {
  console.log('Starting Wild Apricot chamber scraping with Playwright...\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    const members = await scrapeSaltSpringChamber(page);
    
    const filename = 'scripts/salt-spring-island-members.json';
    fs.writeFileSync(filename, JSON.stringify(members, null, 2));
    console.log(`\nSaved to ${filename}`);
    
    console.log('\nSample members:');
    members.slice(0, 10).forEach((m, i) => {
      console.log(`  ${i+1}. ${m.name} | ${m.industry || 'N/A'}`);
    });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
  
  await browser.close();
}

main().catch(console.error);
