const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scripts/nanaimo-raw.json', 'utf8'));
console.log('Raw entries:', raw.length);

// Patterns to exclude
const junkPatterns = [
  /^join now$/i,
  /^sort by/i,
  /^search/i,
  /^member login/i,
  /^directory/i,
  /^contact us$/i,
  /^about$/i,
  /^home$/i,
  /^\(\d{3}\)/,  // Phone numbers as names
  /^\d{3}[-.\s]/,  // Phone numbers
  /^[A-Z]$/,  // Single letters
  /^view map$/i,
  /^get directions$/i,
  /^categories$/i,
  /^events$/i,
  /^news$/i,
  /^members$/i,
  /^login$/i,
  /^sign up$/i,
  /^register$/i,
  /^forgot password$/i,
  /^privacy/i,
  /^terms/i,
  /^nanaimo chamber/i,  // The chamber itself
  /^greater nanaimo/i,
  /^chambermaster/i,
];

const cleaned = raw.filter(m => {
  // Check business name against patterns
  const name = m.businessName.trim();
  
  // Too short
  if (name.length < 3) return false;
  
  // Matches junk patterns
  for (const pattern of junkPatterns) {
    if (pattern.test(name)) return false;
  }
  
  // All digits or punctuation
  if (/^[\d\s\-\(\)\.]+$/.test(name)) return false;
  
  // Website-only entries with no real name
  if (name.startsWith('http')) return false;
  
  return true;
});

console.log('After cleaning:', cleaned.length);

// Deduplicate by normalized name
const seen = new Set();
const unique = cleaned.filter(m => {
  const key = m.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log('After deduplication:', unique.length);

// Format for integration
const formatted = unique.map(m => ({
  businessName: m.businessName.trim(),
  address: m.address || '',
  phone: m.phone || '',
  website: m.website && m.website.includes('chambermaster.com') ? '' : (m.website || ''),
  category: '',
  municipality: 'Nanaimo',
  region: 'Nanaimo Regional District'
}));

fs.writeFileSync('scripts/nanaimo-cleaned.json', JSON.stringify(formatted, null, 2));
console.log('Saved to scripts/nanaimo-cleaned.json');

// Show sample
console.log('\nSample entries:');
formatted.slice(0, 10).forEach(m => console.log(' -', m.businessName));
