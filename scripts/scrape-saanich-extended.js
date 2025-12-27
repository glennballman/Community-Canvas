/**
 * Saanich Peninsula - Extended JavaScript execution
 * Try to get more members by allowing more JS execution time
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import fs from 'fs';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeExtended() {
  console.log("Saanich Peninsula - Extended Scrape");
  
  const url = "https://peninsulachamber.ca/directory/";
  
  try {
    const result = await app.scrapeUrl(url, {
      formats: ["markdown", "html"],
      waitFor: 15000, // Longer wait for JS
      timeout: 60000
    });
    
    if (result.success) {
      console.log(`\nMarkdown length: ${result.markdown?.length || 0}`);
      console.log(`HTML length: ${result.html?.length || 0}`);
      
      // Count IDs in markdown
      const mdIds = result.markdown?.match(/biz\/id\/[a-f0-9]{24}/g) || [];
      const uniqueMdIds = [...new Set(mdIds.map(b => b.replace('biz/id/', '')))];
      console.log(`\nUnique member IDs in markdown: ${uniqueMdIds.length}`);
      
      // Count IDs in HTML
      const htmlIds = result.html?.match(/biz\/id\/[a-f0-9]{24}/g) || [];
      const uniqueHtmlIds = [...new Set(htmlIds.map(b => b.replace('biz/id/', '')))];
      console.log(`Unique member IDs in HTML: ${uniqueHtmlIds.length}`);
      
      // Save HTML for further analysis
      if (result.html) {
        fs.writeFileSync('scripts/saanich-peninsula-extended.html', result.html);
        console.log("\nSaved HTML to scripts/saanich-peninsula-extended.html");
      }
      
      // Save markdown
      if (result.markdown) {
        fs.writeFileSync('scripts/saanich-peninsula-extended.md', result.markdown);
        console.log("Saved markdown to scripts/saanich-peninsula-extended.md");
      }
    } else {
      console.log("Failed:", result.error);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

scrapeExtended();
