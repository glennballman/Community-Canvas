/**
 * Scrape Saanich Peninsula by clicking "More" button
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeWithClick() {
  console.log("Saanich Peninsula - Click More Button Approach");
  
  const url = "https://peninsulachamber.ca/directory/";
  
  try {
    const result = await app.scrapeUrl(url, {
      formats: ["markdown"],
      waitFor: 5000,
      actions: [
        // Wait for content
        { type: "wait", milliseconds: 3000 },
        // Click "More" button multiple times
        { type: "click", selector: "a:contains('More')" },
        { type: "wait", milliseconds: 2000 },
        { type: "click", selector: "a:contains('More')" },
        { type: "wait", milliseconds: 2000 },
        { type: "click", selector: "a:contains('More')" },
        { type: "wait", milliseconds: 2000 },
        { type: "click", selector: "a:contains('More')" },
        { type: "wait", milliseconds: 2000 },
        { type: "click", selector: "a:contains('More')" },
        { type: "wait", milliseconds: 2000 },
      ],
      timeout: 60000
    });
    
    if (result.success && result.markdown) {
      const bizIds = result.markdown.match(/biz\/id\/[a-f0-9]{24}/g) || [];
      const uniqueIds = [...new Set(bizIds.map(b => b.replace('biz/id/', '')))];
      console.log(`Found ${uniqueIds.length} unique member IDs`);
      fs.writeFileSync('scripts/saanich-peninsula-full.txt', result.markdown);
    } else {
      console.log("Failed:", result.error || "Unknown error");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

scrapeWithClick();
