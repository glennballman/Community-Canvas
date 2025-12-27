/**
 * Scrape Saanich Peninsula Chamber with scroll actions
 * to load all paginated members
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeWithScroll() {
  console.log("=".repeat(70));
  console.log("Saanich Peninsula Chamber - Scroll Scrape");
  console.log("=".repeat(70));
  
  const url = "https://peninsulachamber.ca/directory/";
  
  try {
    // Use actions to scroll multiple times
    const result = await app.scrapeUrl(url, {
      formats: ["markdown"],
      waitFor: 8000, // Wait for initial load
      actions: [
        // Scroll down to trigger more content loading
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
      ]
    });
    
    if (result.success && result.markdown) {
      console.log(`\nContent length: ${result.markdown.length} chars`);
      
      // Count biz IDs
      const bizIds = result.markdown.match(/biz\/id\/[a-f0-9]{24}/g) || [];
      const uniqueIds = [...new Set(bizIds.map(b => b.replace('biz/id/', '')))];
      console.log(`Found ${uniqueIds.length} unique member IDs`);
      
      // Save full content
      fs.writeFileSync('scripts/saanich-peninsula-full.txt', result.markdown);
      console.log("Saved to scripts/saanich-peninsula-full.txt");
    } else {
      console.log("Scrape failed:", result.error);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

scrapeWithScroll();
