const { chromium } = require('playwright');
const fs = require('fs');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Loading Salt Spring Chamber directory...');
  await page.goto('https://www.saltspringchamber.com/Member-Directory', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: 'scripts/salt-spring-debug.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Get page content
  const content = await page.content();
  fs.writeFileSync('scripts/salt-spring-debug.html', content);
  console.log('HTML saved');
  
  // Look for member data
  const memberData = await page.evaluate(() => {
    const result = {
      iframes: document.querySelectorAll('iframe').length,
      waWidgets: document.querySelectorAll('.waWidget').length,
      memberLinks: [],
      allLinks: []
    };
    
    // Get all links that might be members
    document.querySelectorAll('a').forEach(a => {
      const href = a.href;
      const text = a.textContent.trim();
      if (text && text.length > 2 && !text.includes('menu') && !text.includes('login')) {
        result.allLinks.push({ text: text.substring(0, 50), href: href.substring(0, 80) });
      }
    });
    
    // Check for Wild Apricot specific elements
    result.waDirectory = !!document.querySelector('#WebsiteSnippet');
    result.contentClass = document.querySelector('.contentBody')?.className || 'none';
    
    return result;
  });
  
  console.log('Page analysis:', JSON.stringify(memberData, null, 2).substring(0, 2000));
  
  await browser.close();
}

debug().catch(console.error);
