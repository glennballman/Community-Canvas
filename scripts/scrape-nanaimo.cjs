const Firecrawl = require('@mendable/firecrawl-js').default;

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) {
  console.error('FIRECRAWL_API_KEY not set');
  process.exit(1);
}

const firecrawl = new Firecrawl({ apiKey });
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const baseUrl = 'http://nanaimochamber.chambermaster.com/list/searchalpha/';

async function scrapeLetter(letter) {
  const url = baseUrl + letter.toLowerCase();
  console.log(`Scraping ${url}...`);
  
  try {
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      timeout: 30000
    });
    
    if (result.success && result.markdown) {
      return { letter, content: result.markdown };
    }
    console.log(`  No content for ${letter}`);
    return { letter, content: '' };
  } catch (err) {
    console.error(`  Error for ${letter}:`, err.message);
    return { letter, content: '' };
  }
}

async function main() {
  const allMembers = [];
  
  // Scrape in batches to avoid rate limits
  for (let i = 0; i < letters.length; i += 3) {
    const batch = letters.slice(i, i + 3);
    const results = await Promise.all(batch.map(scrapeLetter));
    
    for (const { letter, content } of results) {
      if (content) {
        // Parse member entries from markdown
        // ChamberMaster format: business name followed by address/contact info
        const lines = content.split('\n');
        let currentMember = null;
        
        for (const line of lines) {
          // Skip navigation/header lines
          if (line.includes('Business Directory') || 
              line.includes('Search by') ||
              line.includes('Keyword') ||
              line.match(/^\[?[A-Z]\]?\s*$/) ||
              line.includes('Member Login') ||
              line.includes('ChamberMaster') ||
              line.trim() === '') continue;
          
          // Business name lines typically are links or bold
          const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
          const boldMatch = line.match(/\*\*([^*]+)\*\*/);
          
          if (linkMatch) {
            if (currentMember) allMembers.push(currentMember);
            currentMember = {
              businessName: linkMatch[1].trim(),
              website: linkMatch[2].includes('http') ? linkMatch[2] : null,
              address: '',
              phone: '',
              category: ''
            };
          } else if (boldMatch && !currentMember) {
            currentMember = {
              businessName: boldMatch[1].trim(),
              address: '',
              phone: '',
              category: ''
            };
          } else if (currentMember) {
            // Try to extract address, phone, category
            const phoneMatch = line.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phoneMatch) {
              currentMember.phone = phoneMatch[0];
            }
            
            // Address pattern (street number + name)
            if (line.match(/^\d+\s+[A-Za-z]/) || line.match(/^Unit|^Suite|^#/i)) {
              currentMember.address = (currentMember.address + ' ' + line.trim()).trim();
            }
            
            // BC postal code
            if (line.match(/V\d[A-Z]\s?\d[A-Z]\d/i)) {
              currentMember.address = (currentMember.address + ' ' + line.trim()).trim();
            }
          }
        }
        
        if (currentMember) allMembers.push(currentMember);
      }
    }
    
    console.log(`  Progress: ${allMembers.length} members found so far`);
    
    // Small delay between batches
    if (i + 3 < letters.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // Clean up results
  const cleaned = allMembers
    .filter(m => m.businessName && 
                 m.businessName.length > 2 && 
                 !m.businessName.includes('Search') &&
                 !m.businessName.includes('Directory') &&
                 !m.businessName.toLowerCase().includes('login'))
    .map(m => ({
      businessName: m.businessName.replace(/\s+/g, ' ').trim(),
      address: m.address?.replace(/\s+/g, ' ').trim() || '',
      phone: m.phone || '',
      website: m.website || '',
      category: m.category || ''
    }));
  
  // Deduplicate
  const seen = new Set();
  const unique = cleaned.filter(m => {
    const key = m.businessName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\nTotal unique members: ${unique.length}`);
  
  const fs = require('fs');
  fs.writeFileSync('scripts/nanaimo-raw.json', JSON.stringify(unique, null, 2));
  console.log('Saved to scripts/nanaimo-raw.json');
}

main().catch(console.error);
