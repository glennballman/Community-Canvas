const https = require('https');
const fs = require('fs');

// Wild Apricot member directory endpoint - try common patterns
// Looking at typical Wild Apricot setups

async function fetchPage(pageNumber = 1) {
  return new Promise((resolve, reject) => {
    // Standard Wild Apricot member search endpoint
    const options = {
      hostname: 'saltspringchamber.com',
      path: '/Sys/MemberDirectorySearch/GetMembers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    };
    
    const postData = JSON.stringify({
      PageNumber: pageNumber,
      PageSize: 50
    });
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Page ${pageNumber} status:`, res.statusCode);
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            console.log('Response:', data.substring(0, 500));
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
    
    req.on('error', err => {
      console.log('Error:', err.message);
      resolve(null);
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Trying Wild Apricot API endpoint...');
  
  const result = await fetchPage(1);
  
  if (result && result.Members) {
    console.log('Success! Found:', result.Members.length, 'members on page 1');
    
    // Fetch all pages
    const allMembers = [...result.Members];
    const totalPages = Math.ceil(166 / 50);
    
    for (let p = 2; p <= totalPages; p++) {
      const pageResult = await fetchPage(p);
      if (pageResult && pageResult.Members) {
        allMembers.push(...pageResult.Members);
        console.log(`Page ${p}:`, pageResult.Members.length);
      }
    }
    
    console.log('Total fetched:', allMembers.length);
    fs.writeFileSync('scripts/saltspring-api.json', JSON.stringify(allMembers, null, 2));
  } else {
    console.log('API approach did not work, need to try Playwright');
  }
}

main();
