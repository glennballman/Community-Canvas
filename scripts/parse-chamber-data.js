/**
 * Robust Chamber Data Parser
 * Uses deterministic regex-based chunking with URL/phone anchors
 */

import fs from 'fs';

// Phone regex
const PHONE_REGEX = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
// URL regex
const URL_REGEX = /https?:\/\/[^\s,\)]+/g;
// Postal code regex
const POSTAL_REGEX = /[A-Z]\d[A-Z]\s?\d[A-Z]\d/g;

/**
 * Parse Saanich Peninsula data
 * Strategy: Use URLs as anchors to split mega-entries
 */
function parseSaanichData(rawEntries) {
  const allMembers = [];
  const errors = [];
  
  for (const entry of rawEntries) {
    const text = entry.name || '';
    
    // Skip empty
    if (!text || text.length < 5) continue;
    
    // If entry is short (under 150 chars), likely a single clean business
    if (text.length < 150) {
      const member = extractSingleBusiness(text);
      if (member) allMembers.push(member);
      continue;
    }
    
    // Long entry - split by URL anchors
    const urls = [...text.matchAll(URL_REGEX)];
    
    if (urls.length === 0) {
      // No URLs, try phone-based splitting
      const phones = [...text.matchAll(PHONE_REGEX)];
      if (phones.length > 1) {
        // Multiple phones = multiple businesses
        let lastIdx = 0;
        for (const phone of phones) {
          const chunk = text.substring(lastIdx, phone.index + phone[0].length);
          const member = extractSingleBusiness(chunk);
          if (member) allMembers.push(member);
          lastIdx = phone.index + phone[0].length;
        }
      } else {
        const member = extractSingleBusiness(text);
        if (member) allMembers.push(member);
      }
      continue;
    }
    
    // Split by URLs - each URL marks end of a business entry
    let lastIdx = 0;
    for (const url of urls) {
      // Find the next phone after URL (if any) as the true end
      const afterUrl = text.substring(url.index + url[0].length);
      const nextPhone = afterUrl.match(PHONE_REGEX);
      
      let endIdx = url.index + url[0].length;
      if (nextPhone && nextPhone.index < 20) {
        // Phone immediately after URL belongs to same business
        endIdx += nextPhone.index + nextPhone[0].length;
      }
      
      const chunk = text.substring(lastIdx, endIdx);
      const member = extractSingleBusiness(chunk);
      if (member) allMembers.push(member);
      lastIdx = endIdx;
    }
    
    // Handle remainder after last URL
    if (lastIdx < text.length - 10) {
      const remainder = text.substring(lastIdx);
      const member = extractSingleBusiness(remainder);
      if (member) allMembers.push(member);
    }
  }
  
  return { members: allMembers, errors };
}

/**
 * Extract a single business from a text chunk
 */
function extractSingleBusiness(text) {
  if (!text || text.length < 3) return null;
  
  // Extract fields
  const urlMatch = text.match(/https?:\/\/[^\s,\)]+/);
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const postalMatch = text.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/);
  
  // Extract name (before address/URL/phone)
  let name = text;
  
  // Remove URL and everything after
  if (urlMatch) {
    const idx = text.indexOf(urlMatch[0]);
    if (idx > 3) name = text.substring(0, idx);
  }
  
  // Remove phone and everything after
  if (phoneMatch && !urlMatch) {
    const idx = text.indexOf(phoneMatch[0]);
    if (idx > 3) name = text.substring(0, idx);
  }
  
  // Remove address patterns (number followed by street)
  const addrMatch = name.match(/(\d{1,5}\s+[\w\s]+(?:St|Ave|Rd|Dr|Blvd|Way|Pl|Cres|Road|Street|Avenue|Drive|Court|Lane|Highway|Hwy))/i);
  if (addrMatch) {
    const idx = name.indexOf(addrMatch[0]);
    if (idx > 3) name = name.substring(0, idx);
  }
  
  // Remove postal code patterns
  const postalInName = name.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/);
  if (postalInName) {
    const idx = name.indexOf(postalInName[0]);
    if (idx > 3) name = name.substring(0, idx);
  }
  
  // Remove city names at end
  name = name.replace(/(Victoria|Sidney|Saanich|Brentwood Bay|North Saanich|Central Saanich|Saanichton|BC|Canada|CA)\s*$/gi, '');
  
  // Clean up
  name = name.replace(/[,.\-:]+$/, '').trim();
  name = name.replace(/\d{3,5}$/, '').trim(); // Remove trailing unit numbers
  
  // Validate
  if (name.length < 3 || /^(About|Contact|Home|Menu|Read More)$/i.test(name)) {
    return null;
  }
  
  return {
    name,
    phone: phoneMatch ? phoneMatch[0].replace(/[^\d]/g, '') : '',
    website: urlMatch ? urlMatch[0] : '',
    postalCode: postalMatch ? postalMatch[0] : '',
    chamberId: 'saanich-peninsula-chamber'
  };
}

/**
 * Parse Pender Island data
 * Strategy: Detect name/description boundary using capitalization patterns
 */
function parsePenderData(rawEntries) {
  const members = [];
  const errors = [];
  
  // Common description starters
  const descPatterns = [
    /^(.+?)(Specializ)/,
    /^(.+?)(This\s)/,
    /^(.+?)(Our\s)/,
    /^(.+?)(A\s+sustainable)/,
    /^(.+?)(The\s+)/,
    /^(.+?)(We\s+)/,
    /^(.+?)(Pender-based)/,
    /^(.+?)(Indigenous)/,
    /^(.+?)(Farm-based)/,
    /^(.+?)(Leading)/,
    /^(.+?)(Fostering)/,
    /^(.+?)(Handcraft)/,
    /^(.+?)(Professional)/,
    /^(.+?)(Construct)/,
    /^(.+?)(Provid)/,
    /^(.+?)(Ready)/,
    /^(.+?)(Dockside)/,
    /^(.+?)(Creative)/,
    /^(.+?)(Classic)/,
    /^(.+?)(General\s+Contractor)/,
    /^(.+?)(Matching)/,
    /^(.+?)(small\s+batch)/,
    /^(.+?)(Driveway)/,
    /^(.+?)(Sterling)/,
    /^(.+?)(sustainable)/,
    /^(.+?)(Deluxe)/,
    /^(.+?)(Located)/,
    /^(.+?)(Offering)/,
    /^(.+?)(Featuring)/,
    /^(.+?)(Serving)/,
    /^(.+?)(Building)/,
    /^(.+?)(Since\s+\d)/,
    /^(.+?)(Established)/,
    /^(.+?)(Family)/,
    /^(.+?)(Local)/,
    /^(.+?)(Full\s+service)/,
  ];
  
  for (const entry of rawEntries) {
    let text = (entry.name || '').trim();
    if (!text || text.length < 5) continue;
    
    let name = text;
    let description = '';
    
    // Check for pipe separator first
    if (text.includes(' | ')) {
      const parts = text.split(' | ');
      name = parts[0].trim();
      description = parts.slice(1).join(' ').trim();
    } else {
      // Try description patterns
      for (const pattern of descPatterns) {
        const match = text.match(pattern);
        if (match && match[1].length >= 3 && match[1].length < text.length - 5) {
          name = match[1].trim();
          description = text.substring(match[1].length).trim();
          break;
        }
      }
    }
    
    // If still no split, try uppercase to lowercase transition
    if (name === text && text.length > 30) {
      // Look for pattern: CapitalizedWords followed by lowercase sentence
      const transitionMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z&][a-z]*)*(?:\s+Ltd\.?|\s+Inc\.?|\s+Co\.?)?)\s*([A-Z][a-z])/);
      if (transitionMatch && transitionMatch[1].length >= 5) {
        name = transitionMatch[1].trim();
        description = text.substring(transitionMatch[1].length).trim();
      }
    }
    
    // Clean name
    name = name.replace(/[,.\-:]+$/, '').trim();
    
    if (name.length < 3) continue;
    
    members.push({
      name,
      description: description.substring(0, 200),
      chamberId: 'pender-island-chamber'
    });
  }
  
  return { members, errors };
}

/**
 * Deduplicate members by normalized name
 */
function deduplicateMembers(members) {
  const seen = new Map();
  const unique = [];
  
  for (const m of members) {
    const key = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.length < 4) continue;
    
    if (!seen.has(key)) {
      seen.set(key, m);
      unique.push(m);
    } else {
      // Keep the one with more data
      const existing = seen.get(key);
      const existingScore = (existing.phone ? 1 : 0) + (existing.website ? 1 : 0);
      const newScore = (m.phone ? 1 : 0) + (m.website ? 1 : 0);
      if (newScore > existingScore) {
        const idx = unique.indexOf(existing);
        unique[idx] = m;
        seen.set(key, m);
      }
    }
  }
  
  return unique;
}

// Main execution
console.log('='.repeat(60));
console.log('Chamber Data Parsing Pipeline');
console.log('='.repeat(60));

// Parse Saanich
const saanichRaw = JSON.parse(fs.readFileSync('scripts/saanich-peninsula-final.json'));
console.log(`\nSaanich Peninsula: ${saanichRaw.length} raw entries`);
const saanichResult = parseSaanichData(saanichRaw);
const saanichUnique = deduplicateMembers(saanichResult.members);
console.log(`  Parsed: ${saanichResult.members.length} members`);
console.log(`  After dedup: ${saanichUnique.length} unique members`);

// Parse Pender
const penderRaw = JSON.parse(fs.readFileSync('scripts/pender-island-members-scroll.json'));
console.log(`\nPender Island: ${penderRaw.length} raw entries`);
const penderResult = parsePenderData(penderRaw);
const penderUnique = deduplicateMembers(penderResult.members);
console.log(`  Parsed: ${penderResult.members.length} members`);
console.log(`  After dedup: ${penderUnique.length} unique members`);

// Save results
fs.writeFileSync('scripts/saanich-parsed.json', JSON.stringify(saanichUnique, null, 2));
fs.writeFileSync('scripts/pender-parsed.json', JSON.stringify(penderUnique, null, 2));

// Quality samples
console.log('\n' + '='.repeat(60));
console.log('SAMPLE OUTPUT');
console.log('='.repeat(60));

console.log('\nSaanich Peninsula (first 10):');
saanichUnique.slice(0, 10).forEach((m, i) => {
  console.log(`  ${i+1}. ${m.name}`);
  if (m.phone) console.log(`     Phone: ${m.phone}`);
  if (m.website) console.log(`     Web: ${m.website}`);
});

console.log('\nPender Island (first 10):');
penderUnique.slice(0, 10).forEach((m, i) => {
  console.log(`  ${i+1}. ${m.name}`);
  if (m.description) console.log(`     Desc: ${m.description.substring(0, 60)}...`);
});

console.log('\nSaved to scripts/saanich-parsed.json and scripts/pender-parsed.json');
