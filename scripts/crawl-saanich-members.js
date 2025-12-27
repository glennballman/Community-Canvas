/**
 * Use Firecrawl crawl feature to get all member pages
 * from Saanich Peninsula Chamber
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function crawlMembers() {
  console.log("=".repeat(70));
  console.log("Crawling Saanich Peninsula Chamber Member Pages");
  console.log("=".repeat(70));
  
  // Get the IDs we already found
  const existingIds = [
    "6449bb91af955177b476135c", "67d1dc32cb9cdea36706d263", "578ecc4264fb5a2b107b23ca",
    "61fb0394bd7f072bc60d0b38", "578ecc4264fb5a2b107b23d0", "642b2f53076879433a28d1e2",
    "578ecc4264fb5a2b107b23d2", "68810d09e34deb23f40e06d4", "578ecc4264fb5a2b107b23d3",
    "578ecc4264fb5a2b107b23d4", "6837480a370680a5a504c00b", "578ecc4264fb5a2b107b23d5",
    "578ecc4264fb5a2b107b23d6", "63c5e97dbd8b5d59e83fa1f6", "629e3d37710bed04743edb97",
    "5f9c7d4125e8d056815bf92a", "58bf022f178f4ee9799632f6", "618c5f54dc69e4054e2a431e",
    "578ecc4264fb5a2b107b23dc", "578ecc4264fb5a2b107b23dd", "578ecc4264fb5a2b107b23df",
    "58598ed8178f4e4c22d2ac78", "62672424c630c934b46f09d7", "65e77d09f239785fc408e864"
  ];
  
  // Try to scrape an individual member page to understand the format
  const testUrl = `https://peninsulachamber.ca/directory/#!biz/id/${existingIds[0]}`;
  
  console.log(`\nTesting individual member page: ${testUrl}`);
  
  try {
    const result = await app.scrapeUrl(testUrl, {
      formats: ["markdown"],
      waitFor: 5000
    });
    
    if (result.success && result.markdown) {
      console.log("\n--- Individual Member Page Content ---");
      console.log(result.markdown.substring(0, 2000));
      console.log("\n--- End ---\n");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
  
  // Now try crawling the whole directory
  console.log("\nCrawling directory...");
  
  try {
    const crawlResult = await app.crawlUrl("https://peninsulachamber.ca/directory/", {
      limit: 50,
      includePaths: ["/directory/*"],
      scrapeOptions: {
        formats: ["markdown"],
        waitFor: 3000
      }
    });
    
    if (crawlResult.success) {
      console.log(`\nCrawl status: ${crawlResult.status}`);
      console.log(`Pages found: ${crawlResult.data?.length || 0}`);
      
      if (crawlResult.data) {
        fs.writeFileSync('scripts/saanich-crawl-result.json', 
          JSON.stringify(crawlResult.data, null, 2));
        console.log("Saved to scripts/saanich-crawl-result.json");
      }
    } else {
      console.log("Crawl failed:", crawlResult);
    }
  } catch (error) {
    console.error("Crawl error:", error.message);
  }
}

crawlMembers();
