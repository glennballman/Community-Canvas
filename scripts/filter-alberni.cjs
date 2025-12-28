const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scripts/port-alberni-chamber-playwright.json', 'utf8'));

// Filter out navigation and keep only real businesses
const navPatterns = [
  /^skip to/i, /^member directory$/i, /^member benefits$/i, /^business support/i,
  /^join/i, /^contact/i, /^about/i, /^home$/i, /^events$/i, /^news$/i, /^login/i,
  /^register/i, /^search$/i, /^menu$/i, /^close/i, /^newsletter/i
];

const businesses = raw.filter(b => {
  const name = b.name?.trim();
  if (!name || name.length < 4) return false;
  if (navPatterns.some(p => p.test(name))) return false;
  // Must have a directory URL
  if (!b.website?.includes('/directory/')) return false;
  // Skip if it's just the directory index
  if (b.website === 'https://albernichamber.ca/directory') return false;
  return true;
});

console.log(`Filtered ${raw.length} -> ${businesses.length} businesses`);

// Save
fs.writeFileSync('scripts/port-alberni-filtered.json', JSON.stringify(businesses, null, 2));

// Sample
businesses.slice(0, 10).forEach(b => console.log(`  - ${b.name}`));
