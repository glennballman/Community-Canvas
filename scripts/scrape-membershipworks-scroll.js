/**
 * MembershipWorks scraper using infinite scroll approach
 * More aggressive scrolling to load all members
 */

import { chromium } from 'playwright';
import fs from 'fs';

const RATE_LIMIT_MS = 1500;

async function scrollAndCollect(page, chamberId, expectedTotal) {
  const members = [];
  const seenNames = new Set();
  
  let previousHeight = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 50;
  let noNewDataCount = 0;
  
  while (scrollAttempts < maxScrollAttempts) {
    const scrollContainer = await page.$('.mwDir-list, .SFcrdlst, [id*="SFylp"], .directory-list');
    
    if (scrollContainer) {
      await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight);
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
    
    await page.waitForTimeout(RATE_LIMIT_MS);
    scrollAttempts++;
    
    const moreBtn = await page.$('button:has-text("More"), a:has-text("More"), .mwDir-more');
    if (moreBtn) {
      const isVisible = await moreBtn.isVisible().catch(() => false);
      if (isVisible) {
        try {
          await moreBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await moreBtn.click({ force: true });
          console.log(`  Clicked "More" button...`);
          await page.waitForTimeout(RATE_LIMIT_MS);
        } catch (e) {
          console.log(`  More button click issue: ${e.message.substring(0, 50)}`);
        }
      }
    }
    
    const cards = await page.$$('[class*="mwDir-card"], [class*="biz-card"], .SFcrd, a[href*="biz/id"]');
    let newCount = 0;
    
    for (const card of cards) {
      try {
        let name = '';
        
        const textContent = await card.textContent();
        const lines = textContent.split('\n').map(l => l.trim()).filter(l => l);
        
        if (lines.length > 0) {
          name = lines[0];
        }
        
        if (!name) {
          const titleEl = await card.$('h3, h4, strong, .title');
          if (titleEl) {
            name = (await titleEl.textContent())?.trim() || '';
          }
        }
        
        if (!name || name.length < 2) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        newCount++;
        
        const description = lines.length > 1 ? lines.slice(1).join(' ').substring(0, 200) : '';
        const href = await card.getAttribute('href');
        
        members.push({
          name,
          description,
          link: href || '',
          chamberId
        });
      } catch (e) {
      }
    }
    
    console.log(`  Scroll ${scrollAttempts}: Found ${cards.length} cards, ${newCount} new, Total: ${members.length}`);
    
    if (newCount === 0) {
      noNewDataCount++;
      if (noNewDataCount >= 5) {
        console.log('  No new data for 5 scrolls, likely reached end.');
        break;
      }
    } else {
      noNewDataCount = 0;
    }
    
    if (members.length >= expectedTotal) {
      console.log(`  Reached expected total (${expectedTotal})`);
      break;
    }
  }
  
  return members;
}

async function scrapeChamber(page, config) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Scraping: ${config.name}`);
  console.log(`URL: ${config.url}`);
  console.log(`Expected: ${config.expectedTotal} members`);
  console.log('='.repeat(70));
  
  await page.goto(config.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const members = await scrollAndCollect(page, config.id, config.expectedTotal);
  
  console.log(`\nFinal count: ${members.length} of ${config.expectedTotal} (${Math.round(members.length / config.expectedTotal * 100)}%)`);
  
  return members;
}

async function main() {
  console.log('MembershipWorks Infinite Scroll Scraper\n');
  
  const chambers = [
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
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  for (const chamber of chambers) {
    try {
      const members = await scrapeChamber(page, chamber);
      
      const filename = `scripts/${chamber.id}-members-scroll.json`;
      fs.writeFileSync(filename, JSON.stringify(members, null, 2));
      console.log(`Saved to ${filename}`);
      
      console.log('\nSample:');
      members.slice(0, 5).forEach((m, i) => console.log(`  ${i+1}. ${m.name}`));
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
    
    await page.waitForTimeout(3000);
  }
  
  await browser.close();
}

main().catch(console.error);
