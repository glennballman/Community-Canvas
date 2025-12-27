/**
 * Clean and normalize chamber member data from Playwright scrapers
 * Parses raw text blobs into structured fields
 * Validates data quality before integration
 */

import fs from 'fs';

// Minimum acceptable coverage thresholds
const COVERAGE_THRESHOLDS = {
  'saanich-peninsula': { expected: 300, minPercent: 80 },
  'pender-island': { expected: 80, minPercent: 90 },
  'salt-spring-island': { expected: 166, minPercent: 80 },
  'sooke-region': { expected: 100, minPercent: 80 }
};

function parseSaanichMember(rawEntry) {
  const text = rawEntry.name || '';
  const lines = text.split('\n').filter(l => l.trim());
  
  if (lines.length === 0) return null;
  
  // First line is usually the business name
  let name = lines[0].trim();
  
  // If name contains digits followed by address patterns, extract just the name
  const addressPattern = /^(.+?)(\d{1,5}\s+[\w\s]+(?:St|Ave|Rd|Dr|Blvd|Way|Pl|Cres|Lane|Road|Street|Avenue|Drive|Boulevard|Place|Court|Ct|Circle|Cir))/i;
  const match = name.match(addressPattern);
  if (match) {
    name = match[1].trim();
  }
  
  // Also check for URL embedded in name
  const urlInName = name.match(/^(.+?)(https?:\/\/)/);
  if (urlInName) {
    name = urlInName[1].trim();
  }
  
  // Check for phone number at end of name
  const phoneAtEnd = name.match(/^(.+?)(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})$/);
  if (phoneAtEnd) {
    name = phoneAtEnd[1].trim();
  }
  
  // Remove trailing commas, periods
  name = name.replace(/[,.\-]+$/, '').trim();
  
  // Skip if name too short or contains only digits
  if (name.length < 3 || /^\d+$/.test(name)) return null;
  
  // Extract phone from full text
  const fullText = text + ' ' + (rawEntry.description || '');
  const phoneMatch = fullText.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  
  // Extract URL from full text
  const urlMatch = fullText.match(/(https?:\/\/[^\s,\)\]]+)/);
  
  // Extract address (look for postal code pattern)
  const postalMatch = fullText.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/);
  const addressMatch = fullText.match(/(\d+\s+[\w\s]+(?:St|Ave|Rd|Dr|Blvd|Way|Pl|Cres)[^,]*)/i);
  
  return {
    name,
    phone: phoneMatch ? phoneMatch[1] : '',
    website: urlMatch ? urlMatch[1] : '',
    address: addressMatch ? addressMatch[1].trim() : '',
    postalCode: postalMatch ? postalMatch[1] : '',
    chamberId: 'saanich-peninsula-chamber'
  };
}

function parsePenderMember(rawEntry) {
  const text = rawEntry.name || '';
  const lines = text.split(/[\n]/).filter(l => l.trim());
  
  if (lines.length === 0) return null;
  
  const name = lines[0].trim();
  const description = lines.slice(1).join(' ').trim();
  
  if (name.length < 3) return null;
  
  return {
    name,
    description: description.substring(0, 200),
    chamberId: 'pender-island-chamber'
  };
}

function parseSaltSpringMember(rawEntry) {
  const name = rawEntry.name?.trim();
  if (!name || name.length < 3) return null;
  
  return {
    name,
    website: rawEntry.website || '',
    industry: rawEntry.industry || '',
    chamberId: 'salt-spring-island-chamber'
  };
}

function parseSookeMember(rawEntry) {
  const name = rawEntry.name?.trim();
  if (!name || name.length < 3) return null;
  
  return {
    name,
    category: rawEntry.category || '',
    phone: rawEntry.phone || '',
    chamberId: 'sooke-region-chamber'
  };
}

function deduplicateMembers(members) {
  const seen = new Set();
  const unique = [];
  
  for (const m of members) {
    const key = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
  }
  
  return unique;
}

function processRawData() {
  console.log('='.repeat(60));
  console.log('Chamber Member Data Cleaning & Validation');
  console.log('='.repeat(60));
  
  const results = {};
  const qualityReport = [];
  
  // Process Saanich Peninsula
  try {
    const raw = JSON.parse(fs.readFileSync('scripts/saanich-peninsula-final.json'));
    const parsed = raw.map(parseSaanichMember).filter(m => m !== null);
    const unique = deduplicateMembers(parsed);
    results['saanich-peninsula'] = unique;
    
    const threshold = COVERAGE_THRESHOLDS['saanich-peninsula'];
    const coverage = Math.round(unique.length / threshold.expected * 100);
    const meetsThreshold = coverage >= threshold.minPercent;
    
    console.log(`\nSaanich Peninsula: ${unique.length} members (${coverage}% of ${threshold.expected})`);
    console.log(`  Status: ${meetsThreshold ? 'PASS' : 'FAIL - below ' + threshold.minPercent + '% threshold'}`);
    
    qualityReport.push({
      chamber: 'saanich-peninsula',
      count: unique.length,
      expected: threshold.expected,
      coverage: coverage,
      meetsThreshold,
      status: meetsThreshold ? 'ready' : 'incomplete'
    });
  } catch (e) {
    console.log('Saanich Peninsula: ERROR -', e.message);
    qualityReport.push({ chamber: 'saanich-peninsula', status: 'error', error: e.message });
  }
  
  // Process Pender Island
  try {
    const raw = JSON.parse(fs.readFileSync('scripts/pender-island-members-scroll.json'));
    const parsed = raw.map(parsePenderMember).filter(m => m !== null);
    const unique = deduplicateMembers(parsed);
    results['pender-island'] = unique;
    
    const threshold = COVERAGE_THRESHOLDS['pender-island'];
    const coverage = Math.round(unique.length / threshold.expected * 100);
    const meetsThreshold = coverage >= threshold.minPercent;
    
    console.log(`\nPender Island: ${unique.length} members (${coverage}% of ${threshold.expected})`);
    console.log(`  Status: ${meetsThreshold ? 'PASS' : 'FAIL - below ' + threshold.minPercent + '% threshold'}`);
    
    qualityReport.push({
      chamber: 'pender-island',
      count: unique.length,
      expected: threshold.expected,
      coverage: coverage,
      meetsThreshold,
      status: meetsThreshold ? 'ready' : 'incomplete'
    });
  } catch (e) {
    console.log('Pender Island: ERROR -', e.message);
    qualityReport.push({ chamber: 'pender-island', status: 'error', error: e.message });
  }
  
  // Process Salt Spring Island
  try {
    const raw = JSON.parse(fs.readFileSync('scripts/salt-spring-island-members.json'));
    const parsed = raw.map(parseSaltSpringMember).filter(m => m !== null);
    const unique = deduplicateMembers(parsed);
    results['salt-spring-island'] = unique;
    
    const threshold = COVERAGE_THRESHOLDS['salt-spring-island'];
    const coverage = Math.round(unique.length / threshold.expected * 100);
    const meetsThreshold = coverage >= threshold.minPercent;
    
    console.log(`\nSalt Spring Island: ${unique.length} members (${coverage}% of ${threshold.expected})`);
    console.log(`  Status: ${meetsThreshold ? 'PASS - but below threshold, marked incomplete' : 'FAIL - below ' + threshold.minPercent + '% threshold'}`);
    
    qualityReport.push({
      chamber: 'salt-spring-island',
      count: unique.length,
      expected: threshold.expected,
      coverage: coverage,
      meetsThreshold,
      status: meetsThreshold ? 'ready' : 'incomplete'
    });
  } catch (e) {
    console.log('Salt Spring Island: ERROR -', e.message);
    qualityReport.push({ chamber: 'salt-spring-island', status: 'error', error: e.message });
  }
  
  // Process Sooke
  try {
    const raw = JSON.parse(fs.readFileSync('scripts/sooke-region-members.json'));
    const parsed = raw.map(parseSookeMember).filter(m => m !== null);
    const unique = deduplicateMembers(parsed);
    results['sooke-region'] = unique;
    
    const threshold = COVERAGE_THRESHOLDS['sooke-region'];
    const coverage = Math.round(unique.length / threshold.expected * 100);
    const meetsThreshold = coverage >= threshold.minPercent;
    
    console.log(`\nSooke Region: ${unique.length} members (${coverage}% of ${threshold.expected})`);
    console.log(`  Status: ${meetsThreshold ? 'PASS' : 'FAIL - below ' + threshold.minPercent + '% threshold'}`);
    
    qualityReport.push({
      chamber: 'sooke-region',
      count: unique.length,
      expected: threshold.expected,
      coverage: coverage,
      meetsThreshold,
      status: meetsThreshold ? 'ready' : 'incomplete'
    });
  } catch (e) {
    console.log('Sooke Region: ERROR -', e.message);
    qualityReport.push({ chamber: 'sooke-region', status: 'error', error: e.message });
  }
  
  // Save results
  fs.writeFileSync('scripts/cleaned-chamber-data.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('scripts/quality-report.json', JSON.stringify(qualityReport, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const readyChambers = qualityReport.filter(r => r.status === 'ready');
  const incompleteChambers = qualityReport.filter(r => r.status === 'incomplete');
  
  console.log(`\nReady for integration: ${readyChambers.length} chambers`);
  readyChambers.forEach(r => console.log(`  - ${r.chamber}: ${r.count} members (${r.coverage}%)`));
  
  console.log(`\nIncomplete (below threshold): ${incompleteChambers.length} chambers`);
  incompleteChambers.forEach(r => console.log(`  - ${r.chamber}: ${r.count} members (${r.coverage}% - needs ${r.expected * 0.8}+ for integration)`));
  
  // Show sample of cleaned data
  console.log('\nSample cleaned entries:');
  
  for (const [chamber, members] of Object.entries(results)) {
    console.log(`\n${chamber}:`);
    members.slice(0, 3).forEach((m, i) => {
      console.log(`  ${i+1}. ${m.name}`);
      if (m.phone) console.log(`     Phone: ${m.phone}`);
      if (m.website) console.log(`     Web: ${m.website}`);
    });
  }
}

processRawData();
