const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapePage(pageNum) {
  // The page uses JavaScript pagination, need to try different approach
  // Try the member profiles directly
  const baseUrl = 'https://saltspringchamber.com/Our-Members';
  
  try {
    const result = await firecrawl.scrapeUrl(baseUrl, {
      formats: ['markdown'],
      timeout: 120000
    });
    
    return result.markdown || '';
  } catch (err) {
    console.log('Error:', err.message);
    return '';
  }
}

async function main() {
  console.log('Fetching Salt Spring member listing...');
  const markdown = await scrapePage();
  
  // Extract business names from the markdown
  const businessPattern = /\[([^\]]+)\]\(https:\/\/saltspringchamber\.com\/Sys\/PublicProfile/g;
  const websitePattern = /\[https?:\/\/[^\]]+\]\((https?:\/\/[^\)]+)\)/g;
  const members = [];
  
  let match;
  while ((match = businessPattern.exec(markdown)) !== null) {
    const name = match[1].trim();
    if (name && name.length > 2 && !name.startsWith('Go to')) {
      members.push({ businessName: name });
    }
  }
  
  console.log('Extracted business names:', members.length);
  
  // Deduplicate
  const seen = new Set();
  const unique = members.filter(m => {
    const key = m.businessName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log('Unique members:', unique.length);
  fs.writeFileSync('scripts/saltspring-raw.json', JSON.stringify(unique, null, 2));
}

main().catch(console.error);
