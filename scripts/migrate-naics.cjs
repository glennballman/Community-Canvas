/**
 * NAICS Migration Script
 * Adds NAICS codes to all chamber member records
 * Run with: node scripts/migrate-naics.js
 */

const fs = require('fs');
const path = require('path');

// NAICS mapping (inline for simplicity)
const categoryToNAICS = {
  // SECTOR 11: AGRICULTURE
  "agriculture": { code: "115000", subsector: "115", sector: "11", title: "Support Activities for Agriculture and Forestry" },
  "Farm": { code: "111000", subsector: "111", sector: "11", title: "Crop Production" },
  "forestry-logging": { code: "113310", subsector: "113", sector: "11", title: "Logging" },
  "fishing-marine": { code: "114111", subsector: "114", sector: "11", title: "Finfish Fishing" },
  
  // SECTOR 21: MINING
  "mining": { code: "212000", subsector: "212", sector: "21", title: "Mining (except Oil and Gas)" },
  
  // SECTOR 22: UTILITIES
  "utilities": { code: "221000", subsector: "221", sector: "22", title: "Utilities" },
  
  // SECTOR 23: CONSTRUCTION
  "construction": { code: "236000", subsector: "236", sector: "23", title: "Construction of Buildings" },
  "roofing": { code: "238160", subsector: "238", sector: "23", title: "Roofing Contractors" },
  "plumbing": { code: "238220", subsector: "238", sector: "23", title: "Plumbing, Heating, and Air-Conditioning Contractors" },
  "electrical": { code: "238210", subsector: "238", sector: "23", title: "Electrical Contractors" },
  "heating-cooling": { code: "238220", subsector: "238", sector: "23", title: "Plumbing, Heating, and Air-Conditioning Contractors" },
  "home-services": { code: "236118", subsector: "236", sector: "23", title: "Residential Remodelers" },
  
  // SECTOR 31-33: MANUFACTURING
  "manufacturing": { code: "332000", subsector: "332", sector: "31-33", title: "Fabricated Metal Product Manufacturing" },
  "winery-brewery": { code: "312120", subsector: "312", sector: "31-33", title: "Breweries" },
  "printing": { code: "323111", subsector: "323", sector: "31-33", title: "Commercial Printing" },
  
  // SECTOR 44-45: RETAIL
  "retail": { code: "453998", subsector: "453", sector: "44-45", title: "All Other Miscellaneous Store Retailers" },
  "automotive": { code: "441100", subsector: "441", sector: "44-45", title: "Automobile Dealers" },
  "grocery": { code: "445110", subsector: "445", sector: "44-45", title: "Supermarkets and Other Grocery Stores" },
  "pharmacy": { code: "446110", subsector: "446", sector: "44-45", title: "Pharmacies and Drug Stores" },
  "hardware-supplies": { code: "444130", subsector: "444", sector: "44-45", title: "Hardware Stores" },
  "pets": { code: "453910", subsector: "453", sector: "44-45", title: "Pet and Pet Supplies Stores" },
  "cannabis": { code: "453991", subsector: "453", sector: "44-45", title: "Tobacco Stores" },
  
  // SECTOR 48-49: TRANSPORTATION
  "aviation": { code: "481000", subsector: "481", sector: "48-49", title: "Air Transportation" },
  "marine": { code: "483000", subsector: "483", sector: "48-49", title: "Water Transportation" },
  "transit": { code: "485000", subsector: "485", sector: "48-49", title: "Transit and Ground Passenger Transportation" },
  "taxi-rideshare": { code: "485310", subsector: "485", sector: "48-49", title: "Taxi Service" },
  "trucking-freight": { code: "484000", subsector: "484", sector: "48-49", title: "Truck Transportation" },
  "transportation": { code: "488000", subsector: "488", sector: "48-49", title: "Support Activities for Transportation" },
  "courier-delivery": { code: "492110", subsector: "492", sector: "48-49", title: "Couriers and Express Delivery Services" },
  "towing": { code: "488410", subsector: "488", sector: "48-49", title: "Motor Vehicle Towing" },
  "storage": { code: "493110", subsector: "493", sector: "48-49", title: "General Warehousing and Storage" },
  
  // SECTOR 51: INFORMATION
  "media": { code: "511000", subsector: "511", sector: "51", title: "Publishing Industries" },
  "telecommunications": { code: "517000", subsector: "517", sector: "51", title: "Telecommunications" },
  "entertainment": { code: "512000", subsector: "512", sector: "51", title: "Motion Picture and Sound Recording Industries" },
  
  // SECTOR 52: FINANCE AND INSURANCE
  "banking-finance": { code: "522000", subsector: "522", sector: "52", title: "Credit Intermediation and Related Activities" },
  "financial-services": { code: "522000", subsector: "522", sector: "52", title: "Credit Intermediation and Related Activities" },
  "finance": { code: "522000", subsector: "522", sector: "52", title: "Credit Intermediation and Related Activities" },
  "insurance": { code: "524210", subsector: "524", sector: "52", title: "Insurance Agencies and Brokerages" },
  
  // SECTOR 53: REAL ESTATE
  "real-estate": { code: "531000", subsector: "531", sector: "53", title: "Real Estate" },
  "property-management": { code: "531311", subsector: "531", sector: "53", title: "Residential Property Managers" },
  
  // SECTOR 54: PROFESSIONAL SERVICES
  "professional-services": { code: "541000", subsector: "541", sector: "54", title: "Professional, Scientific, and Technical Services" },
  "professional": { code: "541000", subsector: "541", sector: "54", title: "Professional, Scientific, and Technical Services" },
  "services": { code: "541000", subsector: "541", sector: "54", title: "Professional, Scientific, and Technical Services" },
  "legal": { code: "541110", subsector: "541", sector: "54", title: "Offices of Lawyers" },
  "accounting": { code: "541211", subsector: "541", sector: "54", title: "Offices of Certified Public Accountants" },
  "engineering": { code: "541330", subsector: "541", sector: "54", title: "Engineering Services" },
  "it-technology": { code: "541512", subsector: "541", sector: "54", title: "Computer Systems Design Services" },
  "technology": { code: "541512", subsector: "541", sector: "54", title: "Computer Systems Design Services" },
  "consulting": { code: "541611", subsector: "541", sector: "54", title: "Administrative Management Consulting Services" },
  "marketing": { code: "541810", subsector: "541", sector: "54", title: "Advertising Agencies" },
  "marketing-advertising": { code: "541810", subsector: "541", sector: "54", title: "Advertising Agencies" },
  "photography": { code: "541921", subsector: "541", sector: "54", title: "Photography Studios, Portrait" },
  "veterinary": { code: "541940", subsector: "541", sector: "54", title: "Veterinary Services" },
  "environmental": { code: "541620", subsector: "541", sector: "54", title: "Environmental Consulting Services" },
  "creative": { code: "541430", subsector: "541", sector: "54", title: "Graphic Design Services" },
  
  // SECTOR 56: ADMINISTRATIVE
  "cleaning-janitorial": { code: "561720", subsector: "561", sector: "56", title: "Janitorial Services" },
  "landscaping": { code: "561730", subsector: "561", sector: "56", title: "Landscaping Services" },
  "security": { code: "561612", subsector: "561", sector: "56", title: "Security Guards and Patrol Services" },
  
  // SECTOR 61: EDUCATION
  "education": { code: "611000", subsector: "611", sector: "61", title: "Educational Services" },
  
  // SECTOR 62: HEALTH CARE
  "healthcare": { code: "621000", subsector: "621", sector: "62", title: "Ambulatory Health Care Services" },
  "health": { code: "621000", subsector: "621", sector: "62", title: "Ambulatory Health Care Services" },
  "medical": { code: "621111", subsector: "621", sector: "62", title: "Offices of Physicians" },
  "dental": { code: "621210", subsector: "621", sector: "62", title: "Offices of Dentists" },
  "optometry": { code: "621320", subsector: "621", sector: "62", title: "Offices of Optometrists" },
  "childcare": { code: "624410", subsector: "624", sector: "62", title: "Child Day Care Services" },
  "seniors": { code: "623311", subsector: "623", sector: "62", title: "Continuing Care Retirement Communities" },
  
  // SECTOR 71: ARTS, ENTERTAINMENT, RECREATION
  "arts-culture": { code: "711000", subsector: "711", sector: "71", title: "Performing Arts, Spectator Sports, Related" },
  "culture": { code: "711000", subsector: "711", sector: "71", title: "Performing Arts, Spectator Sports, Related" },
  "recreation": { code: "713000", subsector: "713", sector: "71", title: "Amusement, Gambling, and Recreation Industries" },
  "fitness-wellness": { code: "713940", subsector: "713", sector: "71", title: "Fitness and Recreational Sports Centers" },
  "spa-beauty": { code: "812111", subsector: "812", sector: "81", title: "Barber Shops" },
  
  // SECTOR 72: ACCOMMODATION AND FOOD
  "accommodation": { code: "721000", subsector: "721", sector: "72", title: "Accommodation" },
  "hospitality": { code: "722000", subsector: "722", sector: "72", title: "Food Services and Drinking Places" },
  "food-beverage": { code: "722000", subsector: "722", sector: "72", title: "Food Services and Drinking Places" },
  "food": { code: "722000", subsector: "722", sector: "72", title: "Food Services and Drinking Places" },
  "restaurant": { code: "722511", subsector: "722", sector: "72", title: "Full-Service Restaurants" },
  
  // SECTOR 81: OTHER SERVICES
  "funeral": { code: "812210", subsector: "812", sector: "81", title: "Funeral Homes and Funeral Services" },
  "charity-nonprofit": { code: "813000", subsector: "813", sector: "81", title: "Religious, Grantmaking, Civic, Professional Orgs" },
  "nonprofit": { code: "813110", subsector: "813", sector: "81", title: "Religious Organizations" },
  "associations": { code: "813910", subsector: "813", sector: "81", title: "Business Associations" },
  "religious": { code: "813110", subsector: "813", sector: "81", title: "Religious Organizations" },
  
  // SECTOR 92: PUBLIC ADMINISTRATION
  "government": { code: "921000", subsector: "921", sector: "92", title: "Executive, Legislative, General Government" },
  "first-nations": { code: "921150", subsector: "921", sector: "92", title: "American Indian and Alaska Native Tribal Governments" },
  
  // Default
  "other": { code: "999999", subsector: "999", sector: "99", title: "Unclassified" },
  "tourism": { code: "561510", subsector: "561", sector: "56", title: "Travel Agencies" },
};

const defaultNAICS = { code: "999999", subsector: "999", sector: "99", title: "Unclassified" };

function getNAICS(category) {
  return categoryToNAICS[category] || defaultNAICS;
}

const filePath = path.join(__dirname, '../shared/chamber-members.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Count members and stats
let processed = 0;
let matched = 0;
let unmatched = 0;
const unmatchedCategories = new Set();

// Process line by line
const lines = content.split('\n');
const newLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Check if this line has a category definition that's part of a chamber member
  if (line.includes('category:') && !line.includes('BusinessCategory') && !line.includes('businessCategoryLabels')) {
    // Extract the category value
    const catMatch = line.match(/category:\s*["']([^"']+)["']/);
    if (catMatch) {
      const category = catMatch[1];
      const naics = getNAICS(category);
      
      processed++;
      if (naics.code !== "999999") {
        matched++;
      } else {
        unmatched++;
        unmatchedCategories.add(category);
      }
      
      // Add the current line
      newLines.push(line);
      
      // Look ahead to find where to insert NAICS (after subcategory or description, before municipality)
      let j = i + 1;
      let insertPoint = -1;
      
      // Find the municipality line (that's where we insert before)
      while (j < lines.length && !lines[j].includes('},')) {
        if (lines[j].includes('municipality:')) {
          insertPoint = j;
          break;
        }
        j++;
      }
      
      // Add lines until municipality, then insert NAICS
      i++;
      while (i < insertPoint) {
        newLines.push(lines[i]);
        i++;
      }
      
      // Insert NAICS fields (with proper indentation)
      const indent = lines[insertPoint].match(/^(\s*)/)[1];
      newLines.push(`${indent}naicsCode: "${naics.code}",`);
      newLines.push(`${indent}naicsSubsector: "${naics.subsector}",`);
      newLines.push(`${indent}naicsSector: "${naics.sector}",`);
      newLines.push(`${indent}naicsTitle: "${naics.title}",`);
      
      // Continue from municipality line
      continue;
    }
  }
  
  newLines.push(line);
  i++;
}

// Write updated file
fs.writeFileSync(filePath, newLines.join('\n'));

console.log('\\nNAICS Migration Complete!');
console.log('========================');
console.log(`Total processed: ${processed}`);
console.log(`Matched: ${matched}`);
console.log(`Unmatched (using default): ${unmatched}`);
if (unmatchedCategories.size > 0) {
  console.log('\\nUnmatched categories (need to add to NAICS mapping):');
  [...unmatchedCategories].sort().forEach(cat => console.log(`  - "${cat}"`));
}
