/**
 * Sooke Chamber - Scrape all categories to get complete member list
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

function parseMembers(markdown) {
  const members = [];
  const sections = markdown.split(/^## /gm);
  
  for (const section of sections) {
    if (!section.trim() || !section.includes('[Learn More]')) continue;
    
    const lines = section.split('\n');
    const name = lines[0].trim();
    if (!name || name.length < 2) continue;
    
    const learnMoreMatch = section.match(/\[Learn More\]\(https?:\/\/[^\/]+\/members\/([^\/]+)\/?\)/);
    if (!learnMoreMatch) continue;
    
    const slug = learnMoreMatch[1];
    const categories = [];
    const categoryMatches = section.matchAll(/\[([^\]]+)\]\(https?:\/\/[^\/]+\/business-category\/[^)]+\)/g);
    for (const match of categoryMatches) categories.push(match[1]);
    
    let address = '', phone = '';
    const bulletLines = lines.filter(l => l.startsWith('- ') && !l.includes('['));
    for (const line of bulletLines) {
      const content = line.replace(/^- /, '').trim();
      const phoneClean = content.replace(/[^\d]/g, '');
      if (phoneClean.length >= 10 && phoneClean.length <= 12) phone = content;
      else if (content && !address) address = content;
    }
    
    members.push({ name, categories, address, phone, slug });
  }
  return members;
}

async function scrapeAllCategories() {
  console.log("Sooke Chamber - Category-based scraping");
  
  const categories = [
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
  
  const allMembers = [];
  const seenSlugs = new Set();
  
  for (const category of categories) {
    const url = `https://sookeregionchamber.com/business-category/${category}/`;
    console.log(`${category}...`);
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ["markdown"],
        waitFor: 5000,
        timeout: 60000
      });
      
      if (result.success && result.markdown) {
        const members = parseMembers(result.markdown);
        let added = 0;
        for (const m of members) {
          if (!seenSlugs.has(m.slug)) {
            seenSlugs.add(m.slug);
            allMembers.push(m);
            added++;
          }
        }
        if (added > 0) console.log(`  +${added} new`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`  Error: ${error.message.substring(0, 50)}`);
    }
  }
  
  console.log(`\nTotal unique members: ${allMembers.length}`);
  fs.writeFileSync('scripts/sooke-members-full.json', JSON.stringify(allMembers, null, 2));
  console.log("Saved to scripts/sooke-members-full.json");
  
  // Show all
  console.log("\nAll members:");
  allMembers.forEach((m, i) => {
    console.log(`${(i+1).toString().padStart(3)}. ${m.name} | ${m.categories.join(', ') || 'Uncategorized'}`);
  });
}

scrapeAllCategories().catch(console.error);
