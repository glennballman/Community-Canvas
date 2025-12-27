/**
 * Sooke Region Chamber - Improved parsing approach
 * Split by ## headings and parse bullet lines flexibly
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

function parseMembers(markdown) {
  const members = [];
  
  // Split by ## headings
  const sections = markdown.split(/^## /gm);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Skip navigation/non-member sections
    if (section.startsWith('Business Directory') || 
        section.startsWith('Standing Cedars') === false && 
        !section.includes('[Learn More]')) continue;
    
    // Get the name (first line)
    const lines = section.split('\n');
    const name = lines[0].trim();
    
    if (!name || name.length < 2) continue;
    
    // Check if this is a member entry (has Learn More link)
    const learnMoreMatch = section.match(/\[Learn More\]\(https?:\/\/[^\/]+\/members\/([^\/]+)\/?\)/);
    if (!learnMoreMatch) continue;
    
    const slug = learnMoreMatch[1];
    
    // Parse categories (links to business-category)
    const categories = [];
    const categoryMatches = section.matchAll(/\[([^\]]+)\]\(https?:\/\/[^\/]+\/business-category\/[^)]+\)/g);
    for (const match of categoryMatches) {
      categories.push(match[1]);
    }
    
    // Parse address and phone from bullet lines
    let address = '';
    let phone = '';
    
    // Look for lines starting with "- " that aren't category links
    const bulletLines = lines.filter(l => l.startsWith('- ') && !l.includes('['));
    
    for (const line of bulletLines) {
      const content = line.replace(/^- /, '').trim();
      
      // Check if it's a phone number
      const phoneClean = content.replace(/[^\d]/g, '');
      if (phoneClean.length >= 10 && phoneClean.length <= 12) {
        phone = content;
      } else if (content && !address) {
        address = content;
      }
    }
    
    members.push({
      name,
      categories,
      address,
      phone,
      slug
    });
  }
  
  return members;
}

async function scrapeAllPages() {
  console.log("=".repeat(70));
  console.log("Sooke Region Chamber of Commerce - Improved Scraper");
  console.log("=".repeat(70));
  
  const allMembers = [];
  const seenSlugs = new Set();
  
  // Scrape main directory pages with pagination
  for (let page = 1; page <= 10; page++) {
    const url = page === 1 
      ? 'https://sookeregionchamber.com/directory/'
      : `https://sookeregionchamber.com/directory/?_scoc_directory_page=${page}`;
    
    console.log(`\nPage ${page}...`);
    
    try {
      const result = await app.scrapeUrl(url, {
        formats: ["markdown"],
        waitFor: 8000,
        timeout: 90000
      });
      
      if (result.success && result.markdown) {
        const members = parseMembers(result.markdown);
        console.log(`  Found ${members.length} members`);
        
        for (const m of members) {
          if (!seenSlugs.has(m.slug)) {
            seenSlugs.add(m.slug);
            allMembers.push(m);
          }
        }
      } else {
        console.log(`  Failed: ${result.error || 'Unknown'}`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      // If we get errors, we might have reached the end
      if (error.message.includes('timeout') && page > 5) break;
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
  allMembers.slice(0, 20).forEach((m, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${m.name}`);
    if (m.categories.length) console.log(`    Categories: ${m.categories.join(', ')}`);
    if (m.phone) console.log(`    Phone: ${m.phone}`);
  });
}

scrapeAllPages().catch(console.error);
