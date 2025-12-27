/**
 * Scrape Saanich Peninsula Chamber of Commerce - Full approach
 * Try multiple methods to get all members
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeWithPagination() {
  console.log("=".repeat(70));
  console.log("Saanich Peninsula Chamber - Full Member Scrape");
  console.log("Platform: MembershipWorks (org ID: 15483)");
  console.log("=".repeat(70));
  
  const allMembers = [];
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  // Try fetching by letter search  
  for (const letter of alphabet) {
    console.log(`\nSearching: ${letter}...`);
    const url = `https://peninsulachamber.ca/directory/?search=${letter}`;
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ["markdown"],
        waitFor: 3000,
      });
      
      if (result.success && result.markdown) {
        // Parse member entries from markdown
        const memberPattern = /\[([^\]]+)\]\(https:\/\/peninsulachamber\.ca\/directory\/#!biz\/id\/([a-f0-9]+)\)/g;
        let match;
        
        while ((match = memberPattern.exec(result.markdown)) !== null) {
          const fullEntry = match[1];
          const memberId = match[2];
          
          // Extract business name (first line of the entry)
          const lines = fullEntry.split('\\n\\n').map(l => l.trim()).filter(l => l);
          if (lines.length > 0) {
            const name = lines[0].replace(/\!\[\]\([^)]+\)/, '').trim();
            if (name && !allMembers.some(m => m.id === memberId)) {
              const member = {
                id: memberId,
                name: name,
                address: lines.length > 1 ? lines[1] : '',
                website: lines.find(l => l.startsWith('http')) || '',
                phone: lines.find(l => /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|^\d{10}|^1-\d{3}/.test(l)) || ''
              };
              allMembers.push(member);
            }
          }
        }
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.error(`Error for ${letter}:`, error.message);
    }
  }
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Total unique members found: ${allMembers.length}`);
  console.log("=".repeat(70));
  
  // Write results
  fs.writeFileSync('scripts/saanich-peninsula-members.json', JSON.stringify(allMembers, null, 2));
  console.log("\nResults saved to scripts/saanich-peninsula-members.json");
  
  // Show sample
  console.log("\nSample members:");
  allMembers.slice(0, 10).forEach(m => {
    console.log(`  - ${m.name}`);
  });
}

scrapeWithPagination().catch(console.error);
