/**
 * Playwright-based headless browser scraper for JS-heavy chamber directories
 * Handles: MembershipWorks, Wild Apricot, WordPress custom directories
 */

import { chromium } from 'playwright';
import fs from 'fs';

const RATE_LIMIT_MS = 2000;

export async function createBrowser() {
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}

export async function scrapeWithLoadMore(page, config) {
  const { url, loadMoreSelector, itemSelector, extractFn, maxClicks = 50 } = config;
  
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  
  await page.waitForTimeout(3000);
  
  let clickCount = 0;
  let previousCount = 0;
  
  while (clickCount < maxClicks) {
    const items = await page.$$(itemSelector);
    const currentCount = items.length;
    console.log(`  Found ${currentCount} items...`);
    
    if (currentCount === previousCount && clickCount > 0) {
      console.log('  No new items loaded, done.');
      break;
    }
    previousCount = currentCount;
    
    const loadMoreBtn = await page.$(loadMoreSelector);
    if (!loadMoreBtn) {
      console.log('  No more "Load More" button found.');
      break;
    }
    
    const isVisible = await loadMoreBtn.isVisible();
    if (!isVisible) {
      console.log('  "Load More" button not visible.');
      break;
    }
    
    try {
      await loadMoreBtn.click();
      clickCount++;
      console.log(`  Clicked "Load More" (${clickCount})...`);
      await page.waitForTimeout(RATE_LIMIT_MS);
    } catch (e) {
      console.log(`  Click failed: ${e.message}`);
      break;
    }
  }
  
  const finalItems = await page.$$(itemSelector);
  console.log(`  Total items after loading: ${finalItems.length}`);
  
  const members = [];
  for (const item of finalItems) {
    try {
      const data = await extractFn(item, page);
      if (data && data.name) {
        members.push(data);
      }
    } catch (e) {
      console.log(`  Error extracting item: ${e.message}`);
    }
  }
  
  return members;
}

export async function scrapeMembershipWorks(page, url, chamberId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping MembershipWorks directory: ${chamberId}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  const members = [];
  const seenNames = new Set();
  let clickCount = 0;
  const maxClicks = 100;
  
  while (clickCount < maxClicks) {
    const items = await page.$$('.mwDir-card, .mwDir-row, [class*="biz-card"], a[href*="biz/id"]');
    console.log(`  Found ${items.length} member cards...`);
    
    for (const item of items) {
      try {
        const nameEl = await item.$('h3, h4, .mwDir-title, [class*="name"], strong');
        const name = nameEl ? (await nameEl.textContent())?.trim() : null;
        
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        
        const descEl = await item.$('p, .mwDir-desc, [class*="description"]');
        const description = descEl ? (await descEl.textContent())?.trim() : '';
        
        const linkEl = await item.$('a[href*="biz/id"], a[href*="listing"]');
        const link = linkEl ? await linkEl.getAttribute('href') : '';
        
        members.push({
          name,
          description,
          link,
          chamberId
        });
      } catch (e) {
      }
    }
    
    const moreBtn = await page.$('button:has-text("More"), a:has-text("More"), .mwDir-more, [class*="load-more"]');
    if (!moreBtn) {
      console.log('  No "More" button found.');
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
  
  console.log(`\nExtracted ${members.length} unique members from ${chamberId}`);
  return members;
}

export async function scrapeWildApricot(page, url, chamberId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping Wild Apricot directory: ${chamberId}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const members = [];
  const seenNames = new Set();
  
  const pages = ['1-50', '51-100', '101-150', '151-200'];
  
  for (const pageRange of pages) {
    console.log(`  Checking page range: ${pageRange}...`);
    
    const pageLink = await page.$(`a:has-text("${pageRange}"), span:has-text("${pageRange}")`);
    if (pageLink) {
      try {
        await pageLink.click();
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log(`  Could not click ${pageRange}: ${e.message}`);
      }
    }
    
    const rows = await page.$$('table tr, .memberDirectory tr, [class*="member-row"]');
    console.log(`  Found ${rows.length} table rows...`);
    
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
        
        for (const cell of cells) {
          const text = (await cell.textContent())?.trim() || '';
          const link = await cell.$('a[href^="http"]');
          if (link) {
            const href = await link.getAttribute('href');
            if (href && !href.includes('saltspringchamber.com')) {
              website = href;
            }
          }
          if (!website && !industry && text.length > 0 && text !== name) {
            industry = text;
          }
        }
        
        members.push({
          name,
          website,
          industry,
          chamberId
        });
      } catch (e) {
      }
    }
    
    await page.waitForTimeout(1000);
  }
  
  console.log(`\nExtracted ${members.length} unique members from ${chamberId}`);
  return members;
}

export async function scrapeWordPressDirectory(page, url, chamberId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping WordPress directory: ${chamberId}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  const members = [];
  const seenNames = new Set();
  
  let pageNum = 1;
  const maxPages = 20;
  
  while (pageNum <= maxPages) {
    console.log(`  Scraping page ${pageNum}...`);
    
    const items = await page.$$('.scoc-member, .directory-item, article.member, [class*="member-card"], .listing-item');
    
    if (items.length === 0) {
      const cards = await page.$$('h2 + p, h3 + p');
      for (const card of cards) {
        try {
          const container = await card.evaluateHandle(el => el.parentElement);
          const heading = await container.$('h2, h3');
          if (!heading) continue;
          
          const name = (await heading.textContent())?.trim();
          if (!name || seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());
          
          const categoryLink = await container.$('a[href*="business-category"]');
          const category = categoryLink ? (await categoryLink.textContent())?.trim() : '';
          
          const bullets = await container.$$('li, p');
          let phone = '';
          let address = '';
          
          for (const bullet of bullets) {
            const text = (await bullet.textContent())?.trim() || '';
            if (/^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/.test(text.replace(/[^\d]/g, '').slice(-10))) {
              phone = text;
            } else if (text && !address && text.length < 100) {
              address = text;
            }
          }
          
          members.push({
            name,
            category,
            phone,
            address,
            chamberId
          });
        } catch (e) {
        }
      }
    } else {
      for (const item of items) {
        try {
          const nameEl = await item.$('h2, h3, .member-name, .listing-title');
          const name = nameEl ? (await nameEl.textContent())?.trim() : null;
          
          if (!name || seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());
          
          const categoryEl = await item.$('.category, [class*="category"]');
          const category = categoryEl ? (await categoryEl.textContent())?.trim() : '';
          
          const phoneEl = await item.$('.phone, [class*="phone"], a[href^="tel:"]');
          const phone = phoneEl ? (await phoneEl.textContent())?.trim() : '';
          
          const addressEl = await item.$('.address, [class*="address"]');
          const address = addressEl ? (await addressEl.textContent())?.trim() : '';
          
          members.push({
            name,
            category,
            phone,
            address,
            chamberId
          });
        } catch (e) {
        }
      }
    }
    
    console.log(`  Found ${members.length} total members so far...`);
    
    const nextBtn = await page.$('a.next, .pagination .next, a[rel="next"], .page-numbers.next');
    if (!nextBtn) {
      console.log('  No next page button found.');
      break;
    }
    
    const isVisible = await nextBtn.isVisible().catch(() => false);
    if (!isVisible) {
      console.log('  Next button not visible.');
      break;
    }
    
    try {
      await nextBtn.click();
      pageNum++;
      await page.waitForTimeout(RATE_LIMIT_MS);
    } catch (e) {
      console.log(`  Next page click failed: ${e.message}`);
      break;
    }
  }
  
  console.log(`\nExtracted ${members.length} unique members from ${chamberId}`);
  return members;
}

export function saveResults(members, filename) {
  fs.writeFileSync(filename, JSON.stringify(members, null, 2));
  console.log(`\nSaved ${members.length} members to ${filename}`);
}
