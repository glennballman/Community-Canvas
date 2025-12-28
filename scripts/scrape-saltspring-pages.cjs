const Firecrawl = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const API_KEY = process.env.FIRECRAWL_API_KEY;
const firecrawl = new Firecrawl({ apiKey: API_KEY });

async function scrapeSaltSpring() {
  console.log('Scraping Salt Spring Chamber with page range hints...');
  const allMembers = [];
  
  // Try scraping multiple times with different prompts for pagination
  const pages = [
    { range: '1-50', prompt: 'Extract businesses 1-50 from this member directory table. Get business names, websites, and industry categories.' },
    { range: '51-100', prompt: 'Extract businesses 51-100 from this member directory table. Look for the pagination showing 51-100. Get business names, websites, and industry.' },
    { range: '101-166', prompt: 'Extract businesses 101-166 from this member directory table. Look for the final pagination pages. Get business names, websites, and industry.' }
  ];
  
  for (const page of pages) {
    console.log(`Trying to get range ${page.range}...`);
    
    try {
      const result = await firecrawl.scrapeUrl('https://saltspringchamber.com/Our-Members', {
        formats: ['extract'],
        timeout: 90000,
        extract: {
          schema: {
            type: 'object',
            properties: {
              members: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    businessName: { type: 'string' },
                    website: { type: 'string' },
                    industry: { type: 'string' }
                  }
                }
              }
            }
          },
          prompt: page.prompt
        }
      });
      
      if (result.extract?.members?.length > 0) {
        allMembers.push(...result.extract.members);
        console.log(`  Found: ${result.extract.members.length}`);
      }
      
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allMembers.filter(m => {
    if (!m.businessName) return false;
    const key = m.businessName.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\nTotal unique: ${unique.length}`);
  fs.writeFileSync('scripts/saltspring-raw.json', JSON.stringify(unique, null, 2));
}

scrapeSaltSpring().catch(console.error);
