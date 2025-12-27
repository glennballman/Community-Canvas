/**
 * Salt Spring Island Chamber - Fixed pagination
 * Wild Apricot uses different pagination mechanism
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeComplete() {
  console.log("=".repeat(70));
  console.log("Salt Spring Island Chamber - All Members");
  console.log("=".repeat(70));
  
  const allMembers = [];
  const seenNames = new Set();
  
  // Try different pagination approaches for Wild Apricot
  const urls = [
    'https://saltspringchamber.com/Our-Members',
    'https://saltspringchamber.com/Our-Members?tab=2',
  ];
  
  // First try the main page with longer wait to ensure all content loads
  console.log("\nFetching main directory page with extended wait...");
  
  try {
    const result = await app.scrapeUrl('https://saltspringchamber.com/Our-Members', {
      formats: ["markdown"],
      waitFor: 10000,
      timeout: 90000
    });
    
    if (result.success && result.markdown) {
      console.log(`  Content length: ${result.markdown.length} chars`);
      
      // Save raw for analysis
      fs.writeFileSync('scripts/salt-spring-raw.md', result.markdown);
      
      // Parse all table rows
      const lines = result.markdown.split('\n');
      
      for (const line of lines) {
        // Look for member entries in table format
        const nameMatch = line.match(/\[([^\]]+)\]\(https:\/\/saltspringchamber\.com\/Sys\/PublicProfile\/(\d+)/);
        if (!nameMatch) continue;
        
        const name = nameMatch[1].trim();
        if (name.length < 2 || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        
        const profileId = nameMatch[2];
        
        // Get website
        const websiteMatch = line.match(/\|\s*\[?https?:\/\/([^\s\|\]]+)/);
        const website = websiteMatch ? `https://${websiteMatch[1]}` : '';
        
        // Get industry (between last two pipes)
        const parts = line.split('|');
        let industry = '';
        if (parts.length >= 3) {
          industry = parts[parts.length - 2].trim();
        }
        
        allMembers.push({
          name,
          profileId,
          website,
          industry
        });
      }
      
      console.log(`  Parsed ${allMembers.length} members`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
  
  // Check if we got all 166
  if (allMembers.length < 166) {
    console.log("\nNote: Only got first page. Wild Apricot pagination uses JavaScript.");
    console.log("Total expected: 166 members");
  }
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Total members captured: ${allMembers.length}`);
  console.log("=".repeat(70));
  
  fs.writeFileSync('scripts/salt-spring-members.json', JSON.stringify(allMembers, null, 2));
  console.log("\nSaved to scripts/salt-spring-members.json");
  
  // Show industries
  const byIndustry = {};
  for (const m of allMembers) {
    const ind = m.industry || 'Uncategorized';
    byIndustry[ind] = (byIndustry[ind] || 0) + 1;
  }
  
  console.log("\nBy industry:");
  Object.entries(byIndustry).sort((a, b) => b[1] - a[1]).forEach(([ind, count]) => {
    console.log(`  ${count.toString().padStart(2)} - ${ind}`);
  });
}

scrapeComplete().catch(console.error);
