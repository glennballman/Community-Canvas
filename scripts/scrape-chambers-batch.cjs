const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

const chambers = [
  {
    id: 'burnaby-board-of-trade',
    name: 'Burnaby Board of Trade',
    url: 'https://www.bbot.ca/member-directory/',
    expected: 1100
  },
  {
    id: 'abbotsford-chamber',
    name: 'Abbotsford Chamber',
    url: 'https://www.abbotsfordchamber.com/member-directory',
    expected: 700
  },
  {
    id: 'comox-valley-chamber',
    name: 'Comox Valley Chamber',
    url: 'https://www.comoxvalleychamber.com/member-directory/',
    expected: 500
  },
  {
    id: 'west-kelowna-board-of-trade',
    name: 'West Kelowna Board of Trade',
    url: 'https://www.gwboardoftrade.com/member-directory/',
    expected: 400
  },
  {
    id: 'parksville-chamber',
    name: 'Parksville Chamber',
    url: 'https://www.parksvillechamber.com/member-directory/',
    expected: 400
  },
  {
    id: 'tofino-chamber',
    name: 'Tofino Chamber',
    url: 'https://www.tofinochamber.org/member-directory/',
    expected: 350
  }
];

async function scrapeChamber(app, chamber) {
  console.log(`\nScraping ${chamber.name}...`);
  
  try {
    const result = await app.scrapeUrl(chamber.url, {
      formats: ['extract'],
      extract: {
        schema: {
          type: 'object',
          properties: {
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Business name' },
                  category: { type: 'string', description: 'Industry or business category' },
                  website: { type: 'string', description: 'Business website URL' },
                  address: { type: 'string', description: 'Business address' },
                  phone: { type: 'string', description: 'Business phone number' }
                }
              }
            }
          }
        },
        prompt: 'Extract ALL business members from this chamber of commerce member directory. Include every business name, category, website, and contact info visible.'
      },
      waitFor: 8000
    });
    
    const members = result.extract?.members || [];
    const coverage = ((members.length / chamber.expected) * 100).toFixed(1);
    console.log(`  Found ${members.length} members (${coverage}% of expected ${chamber.expected})`);
    
    return {
      id: chamber.id,
      name: chamber.name,
      members,
      expected: chamber.expected,
      coverage: parseFloat(coverage)
    };
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return { id: chamber.id, name: chamber.name, members: [], error: error.message };
  }
}

async function main() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const results = [];
  
  for (const chamber of chambers) {
    const result = await scrapeChamber(app, chamber);
    results.push(result);
    
    // Save individual result
    fs.writeFileSync(`scripts/${chamber.id}-members.json`, JSON.stringify(result.members, null, 2));
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  results.forEach(r => {
    const status = r.coverage >= 80 ? 'PASS' : r.coverage >= 50 ? 'PARTIAL' : 'FAIL';
    console.log(`${r.name}: ${r.members?.length || 0} members (${r.coverage || 0}%) - ${status}`);
  });
  
  fs.writeFileSync('scripts/chambers-batch-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
