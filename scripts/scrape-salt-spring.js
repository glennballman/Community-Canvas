/**
 * Salt Spring Island Chamber of Commerce - Member Directory Scrape
 * Platform: Wild Apricot
 * Shows 166 members in paginated table format
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeAllPages() {
  console.log("=".repeat(70));
  console.log("Salt Spring Island Chamber of Commerce - Member Directory");
  console.log("Platform: Wild Apricot");
  console.log("=".repeat(70));
  
  const allMembers = [];
  const seenNames = new Set();
  
  // There are 166 members shown in ranges: 1-50, 51-100, 101-150, 151-166
  const pages = ['1-50', '51-100', '101-150', '151-166'];
  
  // Start with the main page to get the format
  const mainUrl = 'https://saltspringchamber.com/Our-Members';
  
  for (const pageRange of pages) {
    console.log(`\nFetching page ${pageRange}...`);
    
    const url = pageRange === '1-50' 
      ? mainUrl 
      : `${mainUrl}?${pageRange.replace('-', '%2D')}`;
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ["markdown", "html"],
        waitFor: 5000,
        timeout: 60000
      });
      
      if (result.success && result.markdown) {
        // Parse table rows from markdown
        // Format: | ##### [Business Name](link) | website | Industry |
        const tableRows = result.markdown.split('\n').filter(line => 
          line.includes('##### [') && line.includes('](https://saltspringchamber.com/Sys/PublicProfile')
        );
        
        console.log(`  Found ${tableRows.length} table rows`);
        
        for (const row of tableRows) {
          // Extract business name and link
          const nameMatch = row.match(/\[([^\]]+)\]\(https:\/\/saltspringchamber\.com\/Sys\/PublicProfile\/(\d+)/);
          if (!nameMatch) continue;
          
          const name = nameMatch[1].trim();
          const profileId = nameMatch[2];
          
          // Extract website if present
          const websiteMatch = row.match(/\[https?:\/\/[^\]]+\]\((https?:\/\/[^)]+)\)/);
          const website = websiteMatch ? websiteMatch[1] : '';
          
          // Extract industry (last column)
          const parts = row.split('|').map(p => p.trim());
          const industry = parts[parts.length - 2] || '';
          
          // Extract contact name if present (after name in parentheses or newline)
          const contactMatch = row.match(/(?:Go to member details"\)|^)[^<]*<br>([^|<]+)/);
          const contact = contactMatch ? contactMatch[1].trim() : '';
          
          if (!seenNames.has(name.toLowerCase()) && name.length > 1) {
            seenNames.add(name.toLowerCase());
            allMembers.push({
              name,
              profileId,
              website,
              industry,
              contact
            });
          }
        }
      } else {
        console.log(`  Failed: ${result.error || 'Unknown error'}`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Total unique members: ${allMembers.length}`);
  console.log("=".repeat(70));
  
  // Save results
  fs.writeFileSync('scripts/salt-spring-members.json', JSON.stringify(allMembers, null, 2));
  console.log("\nSaved to scripts/salt-spring-members.json");
  
  // Show sample by industry
  const byIndustry = {};
  for (const m of allMembers) {
    const ind = m.industry || 'Uncategorized';
    byIndustry[ind] = (byIndustry[ind] || 0) + 1;
  }
  
  console.log("\nMembers by industry:");
  Object.entries(byIndustry).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([ind, count]) => {
    console.log(`  ${ind}: ${count}`);
  });
  
  console.log("\nSample members:");
  allMembers.slice(0, 20).forEach((m, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${m.name} | ${m.industry}`);
  });
}

scrapeAllPages().catch(console.error);
