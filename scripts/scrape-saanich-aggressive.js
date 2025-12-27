/**
 * Aggressive scraper for Saanich Peninsula Chamber
 * Multiple More button clicks with longer waits
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  console.log('Saanich Peninsula Chamber - Aggressive Scraper\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 2000 }
  });
  
  const page = await context.newPage();
  
  console.log('Navigating to directory...');
  await page.goto('https://www.peninsulachamber.ca/directory/', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  await page.waitForTimeout(5000);
  
  const members = [];
  const seenNames = new Set();
  let clickCount = 0;
  const maxClicks = 30;
  
  while (clickCount < maxClicks) {
    const cards = await page.$$('.mwDir-card, a[href*="biz/id"], [class*="SFcrd"]');
    console.log(`\nRound ${clickCount + 1}: Found ${cards.length} cards`);
    
    let newCount = 0;
    for (const card of cards) {
      try {
        const text = await card.textContent();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const name = lines[0];
        
        if (!name || name.length < 2) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        newCount++;
        
        const href = await card.getAttribute('href');
        members.push({
          name,
          description: lines.slice(1).join(' ').substring(0, 200),
          link: href || '',
          chamberId: 'saanich-peninsula'
        });
      } catch (e) {}
    }
    
    console.log(`  New: ${newCount}, Total: ${members.length}`);
    
    const moreBtns = await page.$$('button, a');
    let foundMore = false;
    
    for (const btn of moreBtns) {
      try {
        const text = (await btn.textContent())?.trim().toLowerCase();
        if (text === 'more' || text === 'load more' || text === 'show more') {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            await btn.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await btn.click({ force: true });
            foundMore = true;
            clickCount++;
            console.log(`  Clicked "${text}" button (${clickCount})`);
            await page.waitForTimeout(3000);
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!foundMore) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      
      const moreAfterScroll = await page.$('button:has-text("More"), a:has-text("More")');
      if (moreAfterScroll) {
        const isVisible = await moreAfterScroll.isVisible().catch(() => false);
        if (isVisible) {
          try {
            await moreAfterScroll.click({ force: true });
            clickCount++;
            console.log(`  Found and clicked More after scroll (${clickCount})`);
            await page.waitForTimeout(3000);
            continue;
          } catch (e) {}
        }
      }
      
      console.log('  No more buttons found');
      break;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FINAL: ${members.length} members extracted`);
  console.log('='.repeat(60));
  
  fs.writeFileSync('scripts/saanich-peninsula-final.json', JSON.stringify(members, null, 2));
  console.log('\nSaved to scripts/saanich-peninsula-final.json');
  
  console.log('\nAll members:');
  members.forEach((m, i) => console.log(`${(i+1).toString().padStart(3)}. ${m.name.substring(0, 60)}`));
  
  await browser.close();
}

main().catch(console.error);
