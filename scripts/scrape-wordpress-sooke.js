/**
 * Scrape WordPress-based Sooke Chamber directory using Playwright
 * Target: Sooke Region Chamber of Commerce
 */

import { chromium } from 'playwright';
import fs from 'fs';

const RATE_LIMIT_MS = 2000;

async function scrapeSookeChamber(page) {
  const chamberId = 'sooke-region';
  const baseUrl = 'https://sookeregionchamber.com/directory/';
  
  console.log('='.repeat(70));
  console.log('Sooke Region Chamber of Commerce');
  console.log(`URL: ${baseUrl}`);
  console.log('='.repeat(70));
  
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const members = [];
  const seenNames = new Set();
  let pageNum = 1;
  const maxPages = 20;
  
  while (pageNum <= maxPages) {
    console.log(`\nScraping page ${pageNum}...`);
    
    const items = await page.$$('.scoc-member, .listing-item, article.member, .directory-listing, h2');
    console.log(`  Found ${items.length} potential items...`);
    
    let foundMembers = false;
    
    for (const item of items) {
      try {
        const tagName = await item.evaluate(el => el.tagName.toLowerCase());
        
        let name = '';
        let category = '';
        let phone = '';
        let address = '';
        let link = '';
        
        if (tagName === 'h2') {
          name = (await item.textContent())?.trim() || '';
          
          const parent = await item.evaluateHandle(el => el.parentElement);
          
          const categoryLink = await parent.$('a[href*="business-category"]');
          if (categoryLink) {
            category = (await categoryLink.textContent())?.trim() || '';
          }
          
          const learnMore = await parent.$('a[href*="/members/"]');
          if (learnMore) {
            link = await learnMore.getAttribute('href') || '';
            foundMembers = true;
          }
          
          const bullets = await parent.$$('li');
          for (const bullet of bullets) {
            const text = (await bullet.textContent())?.trim() || '';
            const phoneMatch = text.match(/[\d\-\(\)\s]{10,}/);
            if (phoneMatch) {
              phone = phoneMatch[0].trim();
            } else if (!address && text.length < 100) {
              address = text;
            }
          }
          
        } else {
          const nameEl = await item.$('h2, h3, .title, .member-name');
          if (nameEl) {
            name = (await nameEl.textContent())?.trim() || '';
          }
          
          const categoryEl = await item.$('.category, [class*="category"]');
          if (categoryEl) {
            category = (await categoryEl.textContent())?.trim() || '';
          }
          
          const phoneEl = await item.$('.phone, [class*="phone"], a[href^="tel:"]');
          if (phoneEl) {
            phone = (await phoneEl.textContent())?.trim() || '';
          }
          
          const linkEl = await item.$('a[href*="/members/"]');
          if (linkEl) {
            link = await linkEl.getAttribute('href') || '';
            foundMembers = true;
          }
        }
        
        if (!name || name.length < 2) continue;
        if (name.includes('Directory') || name.includes('Search')) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        
        members.push({
          name,
          category,
          phone,
          address,
          link,
          chamberId
        });
        
      } catch (e) {
      }
    }
    
    console.log(`  Total members so far: ${members.length}`);
    
    if (!foundMembers && pageNum > 1) {
      console.log('  No member links found, may have reached the end.');
      break;
    }
    
    const paginationLinks = await page.$$('.pagination a, .page-numbers a, a[class*="page"]');
    let nextPageFound = false;
    
    for (const link of paginationLinks) {
      const text = (await link.textContent())?.trim() || '';
      const href = await link.getAttribute('href') || '';
      
      if (text === String(pageNum + 1) || href.includes(`page=${pageNum + 1}`) || href.includes(`page/${pageNum + 1}`)) {
        try {
          await link.click();
          pageNum++;
          nextPageFound = true;
          await page.waitForTimeout(RATE_LIMIT_MS);
          break;
        } catch (e) {
          console.log(`  Could not click next page: ${e.message}`);
        }
      }
    }
    
    if (!nextPageFound) {
      const nextBtn = await page.$('.next, a.next, [rel="next"]');
      if (nextBtn) {
        const isVisible = await nextBtn.isVisible().catch(() => false);
        if (isVisible) {
          try {
            await nextBtn.click();
            pageNum++;
            await page.waitForTimeout(RATE_LIMIT_MS);
            continue;
          } catch (e) {
            console.log(`  Next button click failed: ${e.message}`);
          }
        }
      }
      
      console.log('  No next page found.');
      break;
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: Sooke Region Chamber`);
  console.log(`  Total members: ${members.length}`);
  console.log('='.repeat(70));
  
  return members;
}

async function main() {
  console.log('Starting WordPress Sooke Chamber scraping with Playwright...\n');
  
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
    const members = await scrapeSookeChamber(page);
    
    const filename = 'scripts/sooke-region-members.json';
    fs.writeFileSync(filename, JSON.stringify(members, null, 2));
    console.log(`\nSaved to ${filename}`);
    
    console.log('\nSample members:');
    members.slice(0, 10).forEach((m, i) => {
      console.log(`  ${i+1}. ${m.name} | ${m.category || 'N/A'}`);
    });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
  
  await browser.close();
}

main().catch(console.error);
