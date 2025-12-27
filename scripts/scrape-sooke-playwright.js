/**
 * Scrape Sooke Chamber by visiting each category page with Playwright
 */

import { chromium } from 'playwright';
import fs from 'fs';

const CATEGORIES = [
  'accomodation', 'acupuncture', 'advertising', 'antiques-handcrafts-gifts',
  'artisinal-arts-art-shows', 'automotive', 'bakery', 'banking', 'boating',
  'brewery', 'business-consulting', 'business-to-business-services', 'cafe',
  'cannabis', 'carpentry', 'catering', 'childcare', 'cleaning',
  'computer-technology-services', 'building-supplies-construction', 'contractors',
  'coaching', 'dance', 'delivery-services', 'dentist', 'electrical-repairs-upgrades',
  'employment', 'fashion', 'finance', 'accounting-tax-consultants', 'fine-arts',
  'food', 'forest-management', 'grocery', 'salons', 'health-wellness', 'health-care',
  'heating', 'hotel-resort', 'house-interior-exterior-decoration',
  'investment-insurance', 'jewelry', 'landscaping', 'lawyer', 'marketing',
  'media-communications', 'medical-aesthetic', 'mortgage', 'museum', 'music',
  'community-support', 'optometrists', 'pet-care-services', 'photography',
  'plumbing', 'professional-services', 'real-estate', 'renovation', 'rentals',
  'repairs', 'restaurant', 'retail', 'roofing', 'sailing', 'school', 'security',
  'sooke-region-chamber-of-commerce', 'fitness', 'recreation', 'tree-care-gardening', 'trucking'
];

async function main() {
  console.log('Sooke Chamber - Playwright Category Scraper\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  const members = [];
  const seenNames = new Set();
  
  for (const category of CATEGORIES) {
    const url = `https://sookeregionchamber.com/business-category/${category}/`;
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const items = await page.$$('h2');
      let added = 0;
      
      for (const item of items) {
        try {
          const name = (await item.textContent())?.trim();
          if (!name || name.length < 2) continue;
          if (name.includes('Directory') || name.includes('Business')) continue;
          if (seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());
          added++;
          
          const parent = await item.evaluateHandle(el => el.parentElement);
          
          const categoryLink = await parent.$('a[href*="business-category"]');
          const catName = categoryLink ? (await categoryLink.textContent())?.trim() : category;
          
          const learnMore = await parent.$('a[href*="/members/"]');
          const link = learnMore ? await learnMore.getAttribute('href') : '';
          
          const bullets = await parent.$$('li');
          let phone = '';
          for (const b of bullets) {
            const text = (await b.textContent())?.trim() || '';
            const phoneMatch = text.match(/[\d\-\(\)\s]{10,}/);
            if (phoneMatch) {
              phone = phoneMatch[0].trim();
              break;
            }
          }
          
          members.push({
            name,
            category: catName,
            phone,
            link,
            chamberId: 'sooke-region'
          });
        } catch (e) {}
      }
      
      if (added > 0) {
        console.log(`${category}: +${added} (Total: ${members.length})`);
      }
      
      await page.waitForTimeout(500);
      
    } catch (e) {
      if (!e.message.includes('404')) {
        console.log(`${category}: error`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FINAL: ${members.length} unique members`);
  console.log('='.repeat(60));
  
  fs.writeFileSync('scripts/sooke-playwright-final.json', JSON.stringify(members, null, 2));
  console.log('\nSaved to scripts/sooke-playwright-final.json');
  
  console.log('\nSample:');
  members.slice(0, 15).forEach((m, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${m.name} | ${m.category}`);
  });
  
  await browser.close();
}

main().catch(console.error);
