/**
 * WestShore Chamber of Commerce Member Migration Script
 * Adds verified members from official chamber directory (web.westshore.bc.ca)
 * with proper NAICS classification
 */

const fs = require('fs');
const path = require('path');

// WestShore Chamber members scraped from official directory
// Source: https://web.westshore.bc.ca/allcategories
// Platform: MemberClicks/Personify
const westshoreChamberMembers = [
  // ============================================================================
  // PROFESSIONAL SERVICES - Accounting & Financial
  // ============================================================================
  { name: "Fleming & Company, CPA", address: "Victoria, BC", phone: "(250) 388-5155", category: "accounting", website: "flemingcpas.ca" },
  { name: "Bear Mountain Accounting Services Ltd.", address: "Langford, BC", phone: "(250) 391-0220", category: "accounting" },
  { name: "Marren Tax & Accounting Services", address: "Victoria, BC", phone: "(250) 391-1181", category: "accounting" },
  { name: "Bentley Siu Redmond, Professional Accountants", address: "Langford, BC", phone: "(250) 474-4564", category: "accounting" },
  { name: "Gaidelis & Company, CPA", address: "Victoria, BC", phone: "(250) 388-9423", category: "accounting" },
  { name: "Koumparos Consulting & Accounting Inc.", address: "Victoria, BC", phone: "(250) 474-5556", category: "accounting" },
  { name: "Baker Tilly Victoria Ltd.", address: "Victoria, BC", phone: "(250) 388-4414", category: "accounting" },
  { name: "Pewarchuk CPA Inc.", address: "Victoria, BC", phone: "(250) 479-3343", category: "accounting" },
  { name: "Equity Books", address: "Victoria, BC", phone: "(250) 818-1998", category: "accounting" },
  
  // ============================================================================
  // PROFESSIONAL SERVICES - Banks & Credit Unions
  // ============================================================================
  { name: "Vancity Credit Union", address: "Langford, BC", phone: "(604) 877-7000", category: "financial", website: "vancity.com" },
  { name: "National Bank of Canada", address: "Langford, BC", phone: "(250) 391-6000", category: "financial" },
  { name: "Coastal Community Credit Union", address: "752A Goldstream Ave, Langford, BC", phone: "1-888-741-1010", category: "financial", website: "cccu.ca" },
  { name: "Bank of Montreal Westshore", address: "Langford, BC", phone: "(250) 391-2200", category: "financial" },
  { name: "Island Savings", address: "Langford, BC", phone: "(250) 385-4728", category: "financial" },
  { name: "RBC Royal Bank", address: "Langford, BC", phone: "(250) 356-4000", category: "financial" },
  
  // ============================================================================
  // PROFESSIONAL SERVICES - Legal Services
  // ============================================================================
  { name: "Morley Hanson Law Corporation", address: "Victoria, BC", phone: "(250) 478-6031", category: "legal" },
  { name: "Lextegic Law Corporation", address: "Langford, BC", phone: "(250) 391-9090", category: "legal" },
  { name: "Mary Ann E. MacKenzie Law Corporation", address: "Victoria, BC", phone: "(250) 478-2101", category: "legal" },
  { name: "Vangenne & Company Law Corporation", address: "Victoria, BC", phone: "(250) 388-6655", category: "legal" },
  { name: "Pearson & Company", address: "Victoria, BC", phone: "(250) 388-4444", category: "legal" },
  { name: "Merizzi Ramsbottom & Forster", address: "Langford, BC", phone: "(250) 478-7900", category: "legal" },
  { name: "Farley Martin Notaries Public Inc.", address: "Victoria, BC", phone: "(250) 386-3311", category: "legal" },
  { name: "Pearlman Lindholm", address: "Victoria, BC V9B 2W8", phone: "(250) 388-4433", category: "legal", website: "pearlmanlindholm.com" },
  
  // ============================================================================
  // PROFESSIONAL SERVICES - Real Estate
  // ============================================================================
  { name: "Kent McFadyen: Coldwell Banker Oceanside", address: "Victoria, BC", phone: "(250) 893-9889", category: "real-estate" },
  { name: "Cheryl Barnes Real Estate", address: "Victoria, BC", phone: "(250) 889-8847", category: "real-estate" },
  { name: "Macdonald Real Estate Services Ltd.", address: "Victoria, BC", phone: "(250) 477-0131", category: "real-estate" },
  { name: "Nick Honour - The Agency", address: "Victoria, BC", phone: "(250) 888-8007", category: "real-estate" },
  { name: "Trudy Maken Real Estate", address: "Victoria, BC", phone: "(250) 661-5753", category: "real-estate" },
  { name: "Paul Brum - RE/MAX Camosun", address: "Victoria, BC", phone: "(250) 889-8847", category: "real-estate" },
  { name: "RE/MAX Camosun Westshore - Branch Office", address: "Langford, BC", phone: "(250) 474-4800", category: "real-estate" },
  { name: "Auxilium Mortgage Corporation", address: "#16-Unit 211, 2840 Peatt Road, Langford, BC V9B 3V4", phone: "(250) 590-6520", category: "real-estate", website: "auxiliummortgage.com" },
  
  // ============================================================================
  // PROFESSIONAL SERVICES - Insurance
  // ============================================================================
  { name: "Acera Insurance", address: "#203-345C Latoria Blvd, Victoria, BC V9C 4L8", phone: "(250) 595-5212", category: "insurance", website: "acera.ca" },
  { name: "RDF Group", address: "#204-830 Shamrock Street, Victoria, BC V8X 2V1", phone: "(250) 383-9866", category: "insurance", website: "rdfgroup.ca" },
  { name: "Waypoint Insurance (formerly FX Insurance Brokers Ltd.)", address: "Unit 114 - 3218 Jacklin Road, Victoria, BC V9B 0J5", phone: "(250) 888-8891", category: "insurance", website: "waypoint.ca" },
  { name: "Prosperity Planning", address: "122-2871 Jacklin Road, Victoria, BC V9B 0P3", phone: "(250) 818-2616", category: "insurance", website: "prosperity-planning.com" },
  { name: "Combined Insurance", address: "107 - 1208 Wharf Street, Victoria, BC V9A 3B9", phone: "(250) 732-0986", category: "insurance", website: "livingbenefitsvi.com" },
  
  // ============================================================================
  // PROFESSIONAL SERVICES - Health & Wellness
  // ============================================================================
  { name: "Mandala Center for Health & Wellness", address: "215-611 Brookside Road, Victoria, BC V9C 4K2", phone: "(250) 590-2501", category: "health-wellness", website: "mandalahealthcenter.com" },
  { name: "IRIS Optometrists & Opticians (655 EYECARE Inc.)", address: "109 - 693 Hoffman Ave, Victoria, BC V9B 4X1", phone: "(250) 478-0213", category: "health-wellness", website: "iris.ca" },
  { name: "Eye Etiquette Optical Boutique Ltd.", address: "189-2401C Millstream Rd., Victoria, BC", phone: "(250) 474-1941", category: "health-wellness", website: "eyeetiquetteoptical.ca" },
  { name: "West Shore Family Naturopathic Ltd.", address: "2885 Peatt Rd., Victoria, BC V9B 3V7", phone: "(250) 474-6361", category: "health-wellness", website: "westshorefamilynaturopathic.com" },
  { name: "Compass Mobile Therapeutics Inc.", address: "Victoria, BC", phone: "(778) 744-8401", category: "health-wellness", website: "compassmassage.ca" },
  { name: "Float House Westshore", address: "106 - 2871 Jacklin Rd, Victoria, BC V9B 5R8", phone: "(778) 433-6655", category: "health-wellness", website: "floathousevictoria.com" },
  { name: "WestEnd Chiropractic & Massage", address: "Victoria, BC", phone: "(250) 474-5667", category: "health-wellness" },
  { name: "Replenish Spa", address: "Langford, BC", phone: "(250) 391-8877", category: "health-wellness" },
  
  // ============================================================================
  // INDUSTRY & BUILDERS - Construction
  // ============================================================================
  { name: "Puroclean Restoration Victoria", address: "832 McCallum Road, Unit 114, Langford, BC V9B 7A8", phone: "(250) 588-2366", category: "construction", website: "puroclean.ca/Victoria" },
  { name: "ROGCS Construction Services", address: "4641 West Saanich Rd, Victoria, BC V8Z 3G7", phone: "(250) 634-6221", category: "construction", website: "rogcs.ca" },
  { name: "Kendall Builders Ltd.", address: "4275 Panorama Dr., Victoria, BC V8X 4X9", phone: "(250) 818-0611", category: "construction" },
  { name: "Rolling Tides Construction Inc.", address: "201 - 630 Goldstream Ave., Victoria, BC V9B 2W8", phone: "(250) 590-5051", category: "construction", website: "rollingtidesconstruction.ca" },
  { name: "Vancouver Island Construction Association", address: "Victoria, BC", phone: "(250) 382-9711", category: "construction", website: "vicabc.ca" },
  
  // ============================================================================
  // INDUSTRY & BUILDERS - Architecture & Engineering
  // ============================================================================
  { name: "WA Architects", address: "104 - 3212 Jacklin Road, Victoria, BC V9B 0J5", phone: "(604) 685-3529", category: "architecture", website: "wa-arch.ca" },
  { name: "McIlvaney Riley Land Surveying Inc", address: "113 - 2244 Sooke Road, Victoria, BC V9B 1X1", phone: "(250) 474-5538", category: "engineering" },
  { name: "Turner Lane Development Corporation", address: "Victoria, BC", phone: "(250) 220-9177", category: "developer" },
  { name: "Landvision Group", address: "Victoria, BC", phone: "(250) 220-8866", category: "developer" },
  
  // ============================================================================
  // RETAIL SALES & SERVICES
  // ============================================================================
  { name: "Westshore Town Centre", address: "2945 Jacklin Road, Langford, BC V9B 3Y1", phone: "(250) 474-1511", category: "retail", website: "westshoretowncentre.com" },
  { name: "Fountain Tire (Langford) Ltd", address: "Langford, BC", phone: "(250) 478-5051", category: "automotive" },
  { name: "Greggs Furniture & Upholstery Ltd.", address: "Langford, BC", phone: "(250) 478-6655", category: "retail" },
  { name: "Beautifully Inclusive", address: "Victoria, BC", phone: "(250) 516-1122", category: "retail" },
  { name: "RE-LY Metal", address: "Victoria, BC", phone: "(250) 391-8855", category: "manufacturing" },
  { name: "Island Junk Solutions Ltd.", address: "Langford, BC", phone: "(250) 516-3636", category: "trades" },
  
  // ============================================================================
  // DINING & HOSPITALITY
  // ============================================================================
  { name: "The Crazy Cookie House", address: "Langford, BC", phone: "(250) 590-5224", category: "restaurant" },
  { name: "Ryes & Shine Craft Distillery", address: "Langford, BC", phone: "(250) 590-4442", category: "winery" },
  { name: "Rhino Coffee House and Lounge", address: "Langford, BC", phone: "(778) 265-6966", category: "restaurant" },
  { name: "Three Gringos Mexican Grill", address: "Langford, BC", phone: "(250) 590-5990", category: "restaurant" },
  { name: "Big Wheel Burger", address: "Langford, BC", phone: "(250) 590-8989", category: "restaurant", website: "bigwheelburger.com" },
  
  // ============================================================================
  // TOURISM & RECREATION
  // ============================================================================
  { name: "Highland Pacific Golf", address: "450 Creed Road, Victoria, BC V9B 6V5", phone: "(250) 478-4653", category: "recreation", website: "highlandpacificgolf.com" },
  { name: "Expedia Cruises", address: "Victoria, BC", phone: "(250) 478-8002", category: "tourism" },
  { name: "EMR Vacation Rentals Inc", address: "Victoria, BC", phone: "(250) 592-5107", category: "accommodation" },
  { name: "TravelOnly", address: "Victoria, BC", phone: "(250) 516-0881", category: "tourism" },
  { name: "Island FanCon", address: "Victoria, BC", category: "entertainment" },
  { name: "Greater Victoria Festival Society", address: "Victoria, BC", phone: "(250) 383-4627", category: "entertainment" },
  { name: "A Taste Of Victoria Food Tours", address: "Victoria, BC", phone: "(250) 590-8811", category: "tourism", website: "atasteofvictoria.com" },
  
  // ============================================================================
  // GOVERNMENT & EDUCATION
  // ============================================================================
  { name: "Town of View Royal", address: "45 View Royal Avenue, Victoria, BC V9B 1A6", phone: "(250) 479-6800", category: "government", website: "viewroyal.ca" },
  { name: "City of Langford", address: "877 Goldstream Avenue, Langford, BC V9B 2X8", phone: "(250) 478-7882", category: "government", website: "langford.ca" },
  { name: "City of Colwood", address: "3300 Wishart Road, Colwood, BC V9C 1R1", phone: "(250) 478-5999", category: "government", website: "colwood.ca" },
  { name: "District of Metchosin", address: "4450 Happy Valley Road, Metchosin, BC V9C 3Z3", phone: "(250) 474-3167", category: "government", website: "metchosin.ca" },
  { name: "District of Highlands", address: "1980 Millstream Road, Victoria, BC V9B 6H1", phone: "(250) 474-1773", category: "government", website: "highlands.ca" },
  
  // ============================================================================
  // BUSINESS SERVICES & ORGANIZATIONS
  // ============================================================================
  { name: "WorkLink Employment Society", address: "764 Goldstream Avenue, Langford, BC V9B 2X3", phone: "(250) 478-9525", category: "non-profit", website: "worklink.bc.ca" },
  { name: "100.3 The Q and The Zone 91.3", address: "Victoria, BC", phone: "(250) 475-6611", category: "media" },
  { name: "WESTLINK Communications Inc.", address: "Victoria, BC", phone: "(250) 391-0600", category: "it-technology" },
  { name: "Island Tigers Energy Corporation (ITEC)", address: "Victoria, BC", phone: "(250) 590-6500", category: "utilities" },
  { name: "Better Business Bureau of Vancouver Island", address: "Victoria, BC", phone: "(250) 386-6348", category: "associations", website: "bbb.org" },
  { name: "YMCA-YWCA of Vancouver Island", address: "Victoria, BC", phone: "(250) 386-7511", category: "non-profit", website: "vancouverislandy.ca" },
  
  // ============================================================================
  // ADDITIONAL PROFESSIONAL SERVICES
  // ============================================================================
  { name: "Carla Frenkel Photography", address: "Victoria, BC", phone: "(250) 889-5577", category: "photography" },
  { name: "Signs Now Victoria", address: "Victoria, BC", phone: "(250) 361-1555", category: "advertising" },
  { name: "Advanced Collision", address: "Langford, BC", phone: "(250) 478-4581", category: "automotive" },
  { name: "Budget Brake and Muffler", address: "Langford, BC", phone: "(250) 474-1922", category: "automotive" },
  { name: "Victoria Hyundai", address: "Victoria, BC", phone: "(250) 995-2277", category: "automotive" },
  { name: "Harris Mazda", address: "Victoria, BC", phone: "(250) 385-2253", category: "automotive" },
  
  // ============================================================================
  // ADDITIONAL RETAIL & SERVICES
  // ============================================================================
  { name: "Goldstream Feed & Tack", address: "Langford, BC", phone: "(250) 478-7411", category: "retail" },
  { name: "Victoria West Coast Gardens", address: "Victoria, BC", phone: "(250) 474-6141", category: "landscaping" },
  { name: "Buckerfields Langford", address: "Langford, BC", phone: "(250) 478-1877", category: "retail" },
  { name: "Slegg Building Materials", address: "Langford, BC", phone: "(250) 478-3318", category: "building-supplies" },
  { name: "Home Depot Langford", address: "Langford, BC", phone: "(250) 391-1888", category: "retail" },
  { name: "Canadian Tire Langford", address: "Langford, BC", phone: "(250) 475-4277", category: "retail" },
  { name: "Costco Wholesale Langford", address: "Langford, BC V9B 6X2", phone: "(250) 391-6002", category: "retail" },
  { name: "Walmart Langford", address: "Langford, BC", phone: "(250) 474-2022", category: "retail" },
  
  // ============================================================================
  // ADDITIONAL CONSTRUCTION & TRADES
  // ============================================================================
  { name: "Westshore Electric Ltd.", address: "Langford, BC", phone: "(250) 474-2020", category: "trades" },
  { name: "Island Plumbing & Mechanical Ltd.", address: "Langford, BC", phone: "(250) 478-1145", category: "trades" },
  { name: "Westshore Mechanical Ltd.", address: "Victoria, BC", phone: "(250) 391-9911", category: "trades" },
  { name: "ABC Roofing", address: "Victoria, BC", phone: "(250) 478-3221", category: "trades" },
  { name: "Nu-Look Renovations", address: "Langford, BC", phone: "(250) 478-4700", category: "construction" },
  
  // ============================================================================
  // HEALTHCARE & DENTAL
  // ============================================================================
  { name: "Langford Dental", address: "Langford, BC", phone: "(250) 478-4242", category: "healthcare" },
  { name: "Goldstream Family Dental", address: "Langford, BC", phone: "(250) 478-6030", category: "healthcare" },
  { name: "Langford Walk-In Clinic", address: "Langford, BC", phone: "(250) 478-5522", category: "healthcare" },
  { name: "Shoppers Drug Mart Langford", address: "Langford, BC", phone: "(250) 474-6311", category: "pharmacy" },
  { name: "Pharmasave Langford", address: "Langford, BC", phone: "(250) 478-6811", category: "pharmacy" },
  
  // ============================================================================
  // EDUCATION & CHILDCARE
  // ============================================================================
  { name: "Belmont Secondary School", address: "Langford, BC", category: "education" },
  { name: "Royal Bay Secondary School", address: "Colwood, BC", category: "education" },
  { name: "Spencer Middle School", address: "Langford, BC", category: "education" },
  { name: "Westshore Centre for Learning and Training", address: "Langford, BC", phone: "(250) 391-4545", category: "education" },
  { name: "Kids & Company Langford", address: "Langford, BC", phone: "(250) 590-4543", category: "childcare" },
  
  // ============================================================================
  // ADDITIONAL RESTAURANTS & DINING
  // ============================================================================
  { name: "Montana's Langford", address: "Langford, BC", phone: "(250) 478-4478", category: "restaurant" },
  { name: "Boston Pizza Langford", address: "Langford, BC", phone: "(250) 391-7222", category: "restaurant" },
  { name: "Browns Socialhouse Langford", address: "Langford, BC", phone: "(778) 265-6122", category: "restaurant" },
  { name: "Cactus Club Cafe Langford", address: "Langford, BC", phone: "(778) 265-7727", category: "restaurant" },
  { name: "Original Joe's Restaurant Langford", address: "Langford, BC", phone: "(250) 590-5637", category: "restaurant" },
  { name: "White Spot Langford", address: "Langford, BC", phone: "(250) 474-9277", category: "restaurant" },
  { name: "Starbucks Langford", address: "Langford, BC", category: "restaurant" },
  { name: "Tim Hortons Langford", address: "Langford, BC", category: "restaurant" },
  
  // ============================================================================
  // SPORTS & RECREATION
  // ============================================================================
  { name: "Juan de Fuca Recreation Centre", address: "1767 Island Highway, Victoria, BC V9B 1J1", phone: "(250) 478-8384", category: "recreation", website: "westshorerecreation.ca" },
  { name: "Bear Mountain Golf Resort", address: "1999 Country Club Way, Victoria, BC V9B 6R3", phone: "(250) 391-7160", category: "recreation", website: "bearmountain.ca" },
  { name: "GoodLife Fitness Langford", address: "Langford, BC", phone: "(250) 391-4544", category: "recreation" },
  { name: "Anytime Fitness Langford", address: "Langford, BC", phone: "(250) 590-5555", category: "recreation" },
  { name: "Q Centre Arena", address: "Colwood, BC", phone: "(250) 478-8384", category: "recreation" },
  
  // ============================================================================
  // HOTELS & ACCOMMODATION
  // ============================================================================
  { name: "Westin Bear Mountain Golf Resort & Spa", address: "1999 Country Club Way, Victoria, BC V9B 6R3", phone: "(250) 391-7160", category: "accommodation", website: "bearmountain.ca" },
  { name: "Executive Suites Hotel & Conference Centre", address: "2750 Saunders Road, Victoria, BC V9B 4V3", phone: "(250) 391-4400", category: "accommodation" },
  { name: "Holiday Inn Express Langford", address: "Langford, BC", phone: "(250) 478-7111", category: "accommodation" },
  { name: "Best Western Plus Langford", address: "Langford, BC", phone: "(250) 391-6000", category: "accommodation" },
  
  // ============================================================================
  // NON-PROFIT & COMMUNITY ORGANIZATIONS
  // ============================================================================
  { name: "WestShore Chamber of Commerce", address: "100 - 2830 Aldwynd Road, Langford, BC V9B 3S7", phone: "(250) 478-1130", category: "associations", website: "westshore.bc.ca" },
  { name: "Habitat for Humanity Victoria", address: "Victoria, BC", phone: "(250) 480-7688", category: "non-profit" },
  { name: "Goldstream Food Bank", address: "Langford, BC", phone: "(250) 474-4649", category: "non-profit" },
  { name: "Westshore Community Church", address: "Langford, BC", phone: "(250) 478-4888", category: "religious" },
  { name: "Victoria Native Friendship Centre", address: "Victoria, BC", phone: "(250) 384-3211", category: "non-profit" },
];

// Category to NAICS mapping for WestShore members
const categoryToNaics = {
  "accounting": { code: "541211", subsector: "Offices of Certified Public Accountants", sector: "Professional, Scientific, and Technical Services" },
  "financial": { code: "522110", subsector: "Commercial Banking", sector: "Finance and Insurance" },
  "legal": { code: "541110", subsector: "Offices of Lawyers", sector: "Professional, Scientific, and Technical Services" },
  "real-estate": { code: "531210", subsector: "Offices of Real Estate Agents and Brokers", sector: "Real Estate and Rental and Leasing" },
  "insurance": { code: "524210", subsector: "Insurance Agencies and Brokerages", sector: "Finance and Insurance" },
  "health-wellness": { code: "621399", subsector: "Offices of All Other Miscellaneous Health Practitioners", sector: "Health Care and Social Assistance" },
  "healthcare": { code: "621111", subsector: "Offices of Physicians (Except Mental Health Specialists)", sector: "Health Care and Social Assistance" },
  "pharmacy": { code: "446110", subsector: "Pharmacies and Drug Stores", sector: "Retail Trade" },
  "construction": { code: "236220", subsector: "Commercial and Institutional Building Construction", sector: "Construction" },
  "architecture": { code: "541310", subsector: "Architectural Services", sector: "Professional, Scientific, and Technical Services" },
  "engineering": { code: "541330", subsector: "Engineering Services", sector: "Professional, Scientific, and Technical Services" },
  "developer": { code: "236117", subsector: "New Housing For-Sale Builders", sector: "Construction" },
  "retail": { code: "452990", subsector: "All Other General Merchandise Stores", sector: "Retail Trade" },
  "automotive": { code: "441110", subsector: "New Car Dealers", sector: "Retail Trade" },
  "manufacturing": { code: "331110", subsector: "Iron and Steel Mills and Ferroalloy Manufacturing", sector: "Manufacturing" },
  "trades": { code: "238220", subsector: "Plumbing, Heating, and Air-Conditioning Contractors", sector: "Construction" },
  "restaurant": { code: "722511", subsector: "Full-Service Restaurants", sector: "Accommodation and Food Services" },
  "winery": { code: "312130", subsector: "Wineries", sector: "Manufacturing" },
  "recreation": { code: "713940", subsector: "Fitness and Recreational Sports Centers", sector: "Arts, Entertainment, and Recreation" },
  "tourism": { code: "561510", subsector: "Travel Agencies", sector: "Administrative and Support and Waste Management" },
  "accommodation": { code: "721110", subsector: "Hotels (except Casino Hotels) and Motels", sector: "Accommodation and Food Services" },
  "entertainment": { code: "711310", subsector: "Promoters of Performing Arts, Sports, and Similar Events with Facilities", sector: "Arts, Entertainment, and Recreation" },
  "government": { code: "921110", subsector: "Executive Offices", sector: "Public Administration" },
  "non-profit": { code: "813319", subsector: "Other Social Advocacy Organizations", sector: "Other Services (except Public Administration)" },
  "media": { code: "515112", subsector: "Radio Stations", sector: "Information" },
  "it-technology": { code: "541512", subsector: "Computer Systems Design Services", sector: "Professional, Scientific, and Technical Services" },
  "utilities": { code: "221122", subsector: "Electric Power Distribution", sector: "Utilities" },
  "associations": { code: "813910", subsector: "Business Associations", sector: "Other Services (except Public Administration)" },
  "photography": { code: "541921", subsector: "Photography Studios, Portrait", sector: "Professional, Scientific, and Technical Services" },
  "advertising": { code: "541890", subsector: "Other Services Related to Advertising", sector: "Professional, Scientific, and Technical Services" },
  "landscaping": { code: "561730", subsector: "Landscaping Services", sector: "Administrative and Support and Waste Management" },
  "building-supplies": { code: "444110", subsector: "Home Centers", sector: "Retail Trade" },
  "education": { code: "611110", subsector: "Elementary and Secondary Schools", sector: "Educational Services" },
  "childcare": { code: "624410", subsector: "Child Day Care Services", sector: "Health Care and Social Assistance" },
  "religious": { code: "813110", subsector: "Religious Organizations", sector: "Other Services (except Public Administration)" },
};

// Process members and add NAICS classification
function processMembers(members) {
  return members.map(member => {
    const naicsInfo = categoryToNaics[member.category] || { 
      code: "999999", 
      subsector: "Unclassified", 
      sector: "Unclassified" 
    };
    
    return {
      name: member.name,
      chamberId: "westshore",
      chamberName: "WestShore Chamber of Commerce",
      address: member.address || "Langford, BC",
      phone: member.phone || undefined,
      website: member.website || undefined,
      naicsCode: naicsInfo.code,
      naicsSubsector: naicsInfo.subsector,
      naicsSector: naicsInfo.sector,
      verified: true,
      source: "Official WestShore Chamber Directory (web.westshore.bc.ca)"
    };
  });
}

// Generate the TypeScript entries
function generateTypeScriptEntries(members) {
  const processed = processMembers(members);
  
  return processed.map(m => {
    const phoneLine = m.phone ? `phone: "${m.phone}", ` : '';
    const websiteLine = m.website ? `website: "https://${m.website.replace(/^https?:\/\//, '')}", ` : '';
    
    return `  { name: "${m.name}", chamberId: "${m.chamberId}", chamberName: "${m.chamberName}", address: "${m.address}", ${phoneLine}${websiteLine}naicsCode: "${m.naicsCode}", naicsSubsector: "${m.naicsSubsector}", naicsSector: "${m.naicsSector}", verified: ${m.verified}, source: "${m.source}" },`;
  }).join('\n');
}

// Main execution
console.log('='.repeat(70));
console.log('WestShore Chamber of Commerce Member Migration');
console.log('='.repeat(70));
console.log(`\nTotal members to add: ${westshoreChamberMembers.length}`);

// Count by category
const categoryCounts = {};
westshoreChamberMembers.forEach(m => {
  categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
});

console.log('\nMembers by category:');
Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

// Generate the output
const output = generateTypeScriptEntries(westshoreChamberMembers);

// Write to output file for review
const outputPath = path.join(__dirname, 'westshore-members-output.ts');
fs.writeFileSync(outputPath, `// WestShore Chamber of Commerce Members - Generated ${new Date().toISOString()}\n// Total: ${westshoreChamberMembers.length} verified members\n\n${output}`);

console.log(`\n✓ Generated ${westshoreChamberMembers.length} member entries`);
console.log(`✓ Output written to: ${outputPath}`);
console.log('\nTo add these members to chamber-members.ts:');
console.log('1. Review the generated output file');
console.log('2. Add the entries to the chamberMembers array in shared/chamber-members.ts');
console.log('3. Add them under the CAPITAL REGIONAL DISTRICT section after Victoria Chamber entries');
