/**
 * Scrape Saanich Peninsula Chamber of Commerce member directory
 * Platform: MembershipWorks
 * URL: https://peninsulachamber.ca/directory/
 */

import FirecrawlApp from "@mendable/firecrawl-js";

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeDirectory() {
  console.log("=".repeat(70));
  console.log("Saanich Peninsula Chamber of Commerce - Member Directory Scrape");
  console.log("=".repeat(70));
  
  // MembershipWorks uses hash-based routing, try the main directory
  const url = "https://peninsulachamber.ca/directory/";
  
  console.log(`\nScraping: ${url}`);
  
  try {
    const result = await app.scrapeUrl(url, {
      formats: ["markdown"],
      waitFor: 5000, // Wait for JavaScript to load
    });
    
    if (result.success) {
      console.log("\n--- Raw Content Preview ---");
      console.log(result.markdown?.substring(0, 8000) || "No markdown content");
      console.log("\n--- End Preview ---\n");
      
      // Write full content to file
      const fs = await import('fs');
      fs.writeFileSync('scripts/saanich-peninsula-raw.txt', result.markdown || '');
      console.log("Full content saved to scripts/saanich-peninsula-raw.txt");
    } else {
      console.log("Scrape failed:", result.error);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

scrapeDirectory();
