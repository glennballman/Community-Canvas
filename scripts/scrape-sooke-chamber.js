/**
 * Scrape Sooke Region Chamber of Commerce member directory
 * Platform: WordPress with custom directory plugin
 * URL: https://sookeregionchamber.com/directory/
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeAllPages() {
  console.log("=".repeat(70));
  console.log("Sooke Region Chamber of Commerce - Member Directory Scrape");
  console.log("=".repeat(70));
  
  const allMembers = [];
  const seenNames = new Set();
  
  // First, get all category pages to ensure we capture all members
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
  
  // Scrape by category to get complete coverage
  for (const category of categories.slice(0, 10)) { // Start with first 10
    const url = `https://sookeregionchamber.com/business-category/${category}/`;
    console.log(`\nScraping category: ${category}`);
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ["markdown"],
        waitFor: 3000
      });
      
      if (result.success && result.markdown) {
        // Parse member entries
        const memberMatches = result.markdown.matchAll(/## ([^\n]+)\n\n(?:- \[([^\]]+)\][^\n]*\n)?(?:- ([^\n]*)\n)?(?:- ([^\n]*)\n)?\n\[Learn More\]\(https:\/\/www\.sookeregionchamber\.com\/members\/([^\/]+)\/\)/g);
        
        for (const match of memberMatches) {
          const name = match[1];
          const categoryText = match[2] || '';
          const address = match[3] || '';
          const phone = match[4] || '';
          const slug = match[5];
          
          if (!seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            allMembers.push({
              name: name,
              category: categoryText,
              address: address,
              phone: phone,
              slug: slug
            });
          }
        }
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.error(`Error for ${category}:`, error.message);
    }
  }
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Total unique members found so far: ${allMembers.length}`);
  
  // Also scrape the main directory pages
  console.log("\nScraping main directory pages...");
  
  for (let page = 1; page <= 5; page++) {
    const url = page === 1 
      ? 'https://sookeregionchamber.com/directory/'
      : `https://sookeregionchamber.com/directory/?_scoc_directory_page=${page}`;
    
    console.log(`Page ${page}...`);
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ["markdown"],
        waitFor: 3000
      });
      
      if (result.success && result.markdown) {
        // Parse member entries from directory listing
        const memberMatches = result.markdown.matchAll(/## ([^\n]+)\n\n(?:- \[([^\]]+)\][^\n]*\n)?(?:- ([^\n]*)\n)?(?:- ([^\n]*)\n)?\n\[Learn More\]\(https:\/\/www\.sookeregionchamber\.com\/members\/([^\/]+)\/\)/g);
        
        for (const match of memberMatches) {
          const name = match[1];
          const categoryText = match[2] || '';
          const address = match[3] || '';
          const phone = match[4] || '';
          const slug = match[5];
          
          if (!seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            allMembers.push({
              name: name,
              category: categoryText,
              address: address,
              phone: phone,
              slug: slug
            });
          }
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.error(`Error for page ${page}:`, error.message);
    }
  }
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Total unique members: ${allMembers.length}`);
  console.log("=".repeat(70));
  
  // Save results
  fs.writeFileSync('scripts/sooke-members.json', JSON.stringify(allMembers, null, 2));
  console.log("\nSaved to scripts/sooke-members.json");
  
  // Show sample
  console.log("\nSample members:");
  allMembers.slice(0, 15).forEach((m, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${m.name}`);
    if (m.category) console.log(`    Category: ${m.category}`);
  });
}

scrapeAllPages().catch(console.error);
