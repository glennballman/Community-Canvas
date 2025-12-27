/**
 * Salt Spring Island Chamber - Try Advanced Search tab
 * and individual industry category pages
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeByIndustry() {
  console.log("Salt Spring Chamber - Industry-based approach");
  
  const allMembers = [];
  const seenNames = new Set();
  
  // Industries from the directory
  const industries = [
    'Accommodation', 'Agriculture', 'Arts + Culture', 'Business Services',
    'Community + Government', 'Construction + Trades', 'Education',
    'Entertainment', 'Environmental + Sustainability', 'Events + Hospitality',
    'Food + Drink', 'Health + Wellness', 'Home + Garden', 'Media + Marketing',
    'Professional Services', 'Real Estate', 'Recreation', 'Retail',
    'Spirituality + Personal Growth', 'Transportation', 'Entrepreneur'
  ];
  
  // Try the advanced search tab
  console.log("\nTrying advanced search tab...");
  
  const advancedUrl = 'https://saltspringchamber.com/Our-Members?&tab=2';
  
  try {
    const result = await app.scrapeUrl(advancedUrl, {
      formats: ["markdown"],
      waitFor: 8000
    });
    
    if (result.success && result.markdown) {
      console.log(`Content length: ${result.markdown.length}`);
      
      // Check if it has different content
      if (result.markdown.includes('Search:') && result.markdown.includes('Industry')) {
        console.log("Advanced search available - checking for member data...");
        
        // Parse entries
        const lines = result.markdown.split('\n');
        for (const line of lines) {
          const nameMatch = line.match(/\[([^\]]+)\]\(https:\/\/saltspringchamber\.com\/Sys\/PublicProfile\/(\d+)/);
          if (!nameMatch) continue;
          
          const name = nameMatch[1].trim();
          if (name.length < 2 || seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());
          
          const profileId = nameMatch[2];
          const parts = line.split('|');
          const industry = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
          
          allMembers.push({ name, profileId, industry });
        }
      }
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  console.log(`\nTotal from advanced search: ${allMembers.length}`);
  
  // If still limited, we have partial data
  if (allMembers.length < 100) {
    console.log("\nWild Apricot pagination requires JavaScript - captured first page only.");
  }
  
  fs.writeFileSync('scripts/salt-spring-members.json', JSON.stringify(allMembers, null, 2));
  console.log(`Saved ${allMembers.length} members to scripts/salt-spring-members.json`);
  
  // Show all captured
  console.log("\nAll captured members:");
  allMembers.forEach((m, i) => {
    console.log(`${(i+1).toString().padStart(3)}. ${m.name} | ${m.industry}`);
  });
}

scrapeByIndustry().catch(console.error);
