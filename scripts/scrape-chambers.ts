import FirecrawlApp from '@mendable/firecrawl-js';

interface ChamberToScrape {
  id: string;
  website: string;
}

const chambersToScrape: ChamberToScrape[] = [
  { id: "delta-chamber-of-commerce", website: "https://www.deltachamber.ca" },
  { id: "north-vancouver-chamber", website: "https://www.nvchamber.ca" },
  { id: "west-vancouver-chamber", website: "https://www.westvanchamber.com" },
  { id: "cloverdale-district-chamber", website: "https://www.cloverdalechamber.ca" },
  { id: "new-westminster-chamber", website: "https://www.newwestchamber.com" },
  { id: "chilliwack-chamber-of-commerce", website: "https://www.chilliwackchamber.com" },
  { id: "maple-ridge-pitt-meadows-chamber", website: "https://www.ridgemeadowschamber.com" },
  { id: "harrison-hot-springs-chamber", website: "https://www.tourharrison.com" },
  { id: "sooke-chamber", website: "https://www.sookeregionchamber.com" },
  { id: "pender-island-chamber", website: "https://www.penderislandchamber.com" },
  { id: "duncan-cowichan-chamber", website: "https://www.duncancc.bc.ca" },
  { id: "ladysmith-chamber", website: "https://www.ladysmithcofc.com" },
  { id: "chemainus-chamber", website: "https://www.chemainus.bc.ca" },
  { id: "cowichan-lake-chamber", website: "https://www.cowichanlake.ca" },
  { id: "qualicum-beach-chamber", website: "https://www.qualicum.bc.ca" },
  { id: "port-hardy-chamber", website: "https://www.porthardychamber.com" },
  { id: "port-mcneill-chamber", website: "https://www.portmcneillchamber.com" },
  { id: "port-alberni-chamber", website: "https://www.albernichamber.ca" },
  { id: "ucluelet-chamber", website: "https://www.uclueletchamber.com" },
  { id: "bamfield-chamber", website: "https://www.bamfieldchamber.com" },
  { id: "port-renfrew-chamber", website: "https://www.portrenfrewchamber.com" },
  { id: "kelowna-chamber", website: "https://www.kelownachamber.org" },
  { id: "lake-country-chamber", website: "https://www.lakecountrychamber.com" },
  { id: "peachland-chamber", website: "https://www.peachlandchamber.com" },
  { id: "vernon-chamber", website: "https://www.vernonchamber.ca" },
  { id: "armstrong-spallumcheen-chamber", website: "https://www.aschamber.com" },
  { id: "penticton-chamber", website: "https://www.penticton.org" },
  { id: "south-okanagan-chamber", website: "https://www.sochamber.ca" },
  { id: "summerland-chamber", website: "https://www.summerlandchamber.com" },
  { id: "similkameen-chamber", website: "https://www.similkameencountry.org" },
  { id: "princeton-chamber", website: "https://www.princetonchamber.ca" },
  { id: "salmon-arm-chamber", website: "https://www.sachamber.bc.ca" },
  { id: "golden-chamber", website: "https://www.goldenchamber.bc.ca" },
  { id: "merritt-chamber", website: "https://www.merrittchamber.com" },
  { id: "clearwater-chamber", website: "https://www.clearwaterbcchamber.com" },
  { id: "lytton-chamber", website: "https://www.lyttonchamber.ca" },
  { id: "corridor-chamber", website: "https://www.corridorchamber.ca" },
  { id: "prince-george-chamber", website: "https://www.pgchamber.bc.ca" },
  { id: "valemount-chamber", website: "https://www.valemountchamber.com" },
  { id: "mcbride-chamber", website: "https://www.mcbridechamber.com" },
  { id: "vanderhoof-chamber", website: "https://www.vanderhoofchamber.com" },
  { id: "burns-lake-chamber", website: "https://www.burnslakechamber.com" },
  { id: "houston-chamber", website: "https://www.houstonchamber.ca" },
  { id: "smithers-chamber", website: "https://www.smitherschamber.com" },
  { id: "fort-st-john-chamber", website: "https://www.fsjchamber.com" },
  { id: "dawson-creek-chamber", website: "https://www.dawsoncreekchamber.ca" },
  { id: "tumbler-ridge-chamber", website: "https://www.tumblerridgechamber.com" },
  { id: "chetwynd-chamber", website: "https://www.chetwyndchamber.ca" },
  { id: "fort-nelson-chamber", website: "https://www.fortnelsonchamber.com" },
  { id: "kitimat-chamber", website: "https://www.kitimatchamber.ca" },
  { id: "kimberley-chamber", website: "https://www.kimberleychamber.com" },
  { id: "columbia-valley-chamber", website: "https://www.cvchamber.ca" },
  { id: "creston-valley-chamber", website: "https://www.crestonvalleychamber.com" },
  { id: "castlegar-chamber", website: "https://www.chamber.castlegar.com" },
  { id: "squamish-chamber", website: "https://www.squamishchamber.com" },
  { id: "lillooet-chamber", website: "https://www.lillooetchamber.com" },
  { id: "gibsons-chamber", website: "https://www.gibsonschamber.com" },
  { id: "pender-harbour-chamber", website: "https://www.penderharbour.ca" },
  { id: "powell-river-chamber", website: "https://www.powellriverchamber.com" },
];

async function scrapeChambers() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY not set");
    process.exit(1);
  }

  const firecrawl = new FirecrawlApp({ apiKey });
  
  console.log(`Starting Firecrawl batch extraction for ${chambersToScrape.length} chamber websites...`);
  console.log("Using batches of 10 URLs (API limit)\n");

  const prompt = `Extract chamber of commerce membership information from this website.
  
  Look for:
  - Total number of members (e.g., "over 500 members", "700+ businesses", "representing 1,200 members")
  - Member count statistics on About page, homepage, or membership pages
  - Annual reports or impact statements mentioning member counts
  - Testimonials or descriptions mentioning membership size
  
  Return structured data:
  {
    "memberCount": string | null,  // e.g. "500+", "700", "1,200+", null if not found
    "source": string | null,       // Where you found this info (e.g., "About page", "Homepage hero")
    "confidence": "high" | "medium" | "low",
    "rawText": string | null       // The exact text mentioning member count
  }`;

  const allResults: any[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < chambersToScrape.length; i += batchSize) {
    const batch = chambersToScrape.slice(i, i + batchSize);
    const urls = batch.map(c => c.website);
    
    console.log(`\nBatch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chambersToScrape.length/batchSize)}: Processing ${batch.map(c => c.id).join(', ')}`);
    
    try {
      const result = await firecrawl.extract(urls, {
        prompt,
        schema: {
          type: "object",
          properties: {
            memberCount: { type: "string", nullable: true },
            source: { type: "string", nullable: true },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            rawText: { type: "string", nullable: true }
          }
        }
      });

      if (result.success) {
        console.log("Batch extraction successful!");
        batch.forEach((chamber, idx) => {
          const data = Array.isArray(result.data) ? result.data[idx] : result.data;
          allResults.push({
            id: chamber.id,
            website: chamber.website,
            ...data
          });
          if (data?.memberCount) {
            console.log(`  ${chamber.id}: ${data.memberCount} members`);
          }
        });
      } else {
        console.error("Batch extraction failed:", result.error);
        batch.forEach((chamber) => {
          allResults.push({
            id: chamber.id,
            website: chamber.website,
            memberCount: null,
            error: result.error
          });
        });
      }
    } catch (error) {
      console.error(`Batch error:`, error);
      batch.forEach((chamber) => {
        allResults.push({
          id: chamber.id,
          website: chamber.website,
          memberCount: null,
          error: String(error)
        });
      });
    }
    
    // Small delay between batches to be respectful of API
    if (i + batchSize < chambersToScrape.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save all results
  const fs = await import('fs');
  fs.writeFileSync('chamber-scrape-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalChambers: chambersToScrape.length,
    results: allResults
  }, null, 2));
  
  console.log("\n=== SUMMARY ===");
  const found = allResults.filter(r => r.memberCount);
  console.log(`Found member counts for ${found.length}/${allResults.length} chambers`);
  found.forEach(r => console.log(`  ${r.id}: ${r.memberCount}`));
  console.log("\nFull results saved to chamber-scrape-results.json");
}

scrapeChambers();
