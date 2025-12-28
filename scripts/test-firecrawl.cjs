const FirecrawlApp = require('@mendable/firecrawl-js').default;

async function test() {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  
  console.log('Testing Firecrawl API...');
  
  try {
    const result = await app.scrapeUrl('https://example.com', {
      formats: ['markdown']
    });
    console.log('Success! API is working.');
    console.log('Content length:', result.markdown?.length || 0);
  } catch (e) {
    console.log('Error:', e.message);
    console.log('Status code:', e.statusCode);
  }
}

test();
