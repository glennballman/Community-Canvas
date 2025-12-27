/**
 * Scrape MembershipWorks-based chamber directories using Playwright
 * Targets: Saanich Peninsula, Pender Island
 */

import { chromium } from 'playwright';
import fs from 'fs';

const RATE_LIMIT_MS = 2000;

const CHAMBERS = [
  {
    id: 'saanich-peninsula',
    name: 'Saanich Peninsula Chamber of Commerce',
    url: 'https://www.peninsulachamber.ca/directory/',
    expectedTotal: 300
  },
  {
    id: 'pender-island',
    name: 'Pender Island Chamber of Commerce', 
    url: 'https://penderislandchamber.com/explore/',
    expectedTotal: 80
  }
];

async function scrapeMembershipWorksChamber(page, chamber) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Scraping: ${chamber.name}`);
  console.log(`URL: ${chamber.url}`);
  console.log('='.repeat(70));
  
  await page.goto(chamber.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const members = [];
  const seenNames = new Set();
  let clickCount = 0;
  const maxClicks = 100;
  let noNewItemsCount = 0;
  
  while (clickCount < maxClicks) {
    const cards = await page.$$('[class*="mwDir-card"], [class*="biz-card"], .mw-dir-card, a[href*="biz/id"]');
    
    if (cards.length === 0) {
      const altCards = await page.$$('.member-card, .directory-listing, article, .listing');
      if (altCards.length > 0) {
        console.log(`  Found ${altCards.length} alternative member cards`);
      }
    }
    
    console.log(`  Found ${cards.length} member cards...`);
    
    let newCount = 0;
    for (const card of cards) {
      try {
        let name = '';
        let description = '';
        let link = '';
        let categories = [];
        
        const titleEl = await card.$('h3, h4, strong, .title, [class*="name"]');
        if (titleEl) {
          name = (await titleEl.textContent())?.trim() || '';
        }
        
        if (!name) {
          const text = (await card.textContent())?.trim() || '';
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length > 0) {
            name = lines[0].trim();
          }
        }
        
        if (!name || name.length < 2) continue;
        
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        newCount++;
        
        const descEl = await card.$('p, .description, [class*="desc"]');
        if (descEl) {
          description = (await descEl.textContent())?.trim() || '';
        }
        
        const href = await card.getAttribute('href');
        if (href) {
          link = href;
        } else {
          const linkEl = await card.$('a[href*="biz/id"], a[href*="listing"]');
          if (linkEl) {
            link = await linkEl.getAttribute('href') || '';
          }
        }
        
        members.push({
          name,
          description,
          link,
          categories,
          chamberId: chamber.id
        });
        
      } catch (e) {
      }
    }
    
    console.log(`  New members this round: ${newCount}, Total: ${members.length}`);
    
    if (newCount === 0) {
      noNewItemsCount++;
      if (noNewItemsCount >= 3) {
        console.log('  No new items for 3 consecutive checks, done.');
        break;
      }
    } else {
      noNewItemsCount = 0;
    }
    
    const moreBtn = await page.$('button:has-text("More"), a:has-text("More"), .mwDir-more, [class*="load-more"], .more-button');
    
    if (!moreBtn) {
      console.log('  Looking for alternative pagination...');
      
      const scrollable = await page.$('.mwDir-list, .directory-list, .member-list');
      if (scrollable) {
        await scrollable.evaluate(el => el.scrollTop = el.scrollHeight);
        await page.waitForTimeout(RATE_LIMIT_MS);
        clickCount++;
        continue;
      }
      
      console.log('  No "More" button or scroll container found.');
      break;
    }
    
    const isVisible = await moreBtn.isVisible().catch(() => false);
    if (!isVisible) {
      console.log('  "More" button not visible.');
      break;
    }
    
    try {
      await moreBtn.click();
      clickCount++;
      console.log(`  Clicked "More" (${clickCount})...`);
      await page.waitForTimeout(RATE_LIMIT_MS);
    } catch (e) {
      console.log(`  Click failed: ${e.message}`);
      break;
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${chamber.name}`);
  console.log(`  Total members: ${members.length}`);
  console.log(`  Expected: ${chamber.expectedTotal}`);
  console.log(`  Coverage: ${Math.round(members.length / chamber.expectedTotal * 100)}%`);
  console.log('='.repeat(70));
  
  return members;
}

async function main() {
  console.log('Starting MembershipWorks chamber scraping with Playwright...\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  const allResults = {};
  
  for (const chamber of CHAMBERS) {
    try {
      const members = await scrapeMembershipWorksChamber(page, chamber);
      allResults[chamber.id] = members;
      
      const filename = `scripts/${chamber.id}-members.json`;
      fs.writeFileSync(filename, JSON.stringify(members, null, 2));
      console.log(`Saved to ${filename}`);
      
    } catch (error) {
      console.error(`Error scraping ${chamber.name}: ${error.message}`);
      allResults[chamber.id] = { error: error.message };
    }
    
    await page.waitForTimeout(3000);
  }
  
  await browser.close();
  
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  
  for (const [id, result] of Object.entries(allResults)) {
    if (Array.isArray(result)) {
      console.log(`${id}: ${result.length} members`);
      if (result.length > 0) {
        console.log('  Sample:');
        result.slice(0, 5).forEach((m, i) => {
          console.log(`    ${i+1}. ${m.name}`);
        });
      }
    } else {
      console.log(`${id}: ERROR - ${result.error}`);
    }
  }
}

main().catch(console.error);
