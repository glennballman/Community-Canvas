# Data Collection Guide

> Last Updated: December 29, 2025
> Version: 1.0.0 - British Columbia

This document serves as the authoritative reference for data collection methodology across the Community Status Dashboard project. As we expand province by province and state by state, this guide will evolve.

---

## Table of Contents

1. [Overview](#overview)
2. [Completion Criteria](#completion-criteria)
3. [Data Collection Tools](#data-collection-tools)
4. [Member Count Methodology](#member-count-methodology)
5. [NAICS Code Assignment](#naics-code-assignment)
6. [Member Date Tracking](#member-date-tracking)
7. [Data Storage Architecture](#data-storage-architecture)
8. [Workflow Checklist](#workflow-checklist)

---

## Overview

### Project Scope
Building verified member directories for chambers of commerce, starting with British Columbia (107 chambers), then expanding to all Canadian provinces and US states.

### Data Sources
- **Primary**: Chamber of commerce websites (member directories)
- **Secondary**: Business registries, LinkedIn, Google Maps
- **Validation**: Cross-referencing multiple sources

---

## Completion Criteria

A chamber is considered **COMPLETED** (green status) when BOTH conditions are met:

| Criterion | Threshold | Rationale |
|-----------|-----------|-----------|
| Member Count | **30+ members** | Minimum viable dataset for analysis |
| Collection Rate | **80%+ of target** | Sufficient coverage for reliability |

### Target Calculation Priority
1. **Expected** (cyan) - Use if available from official sources
2. **Estimated** (orange) - Use only if Expected is unavailable

### Status Color Coding
| Status | Color | Criteria |
|--------|-------|----------|
| Completed | Green | 30+ members AND 80%+ of target |
| Partial | Yellow/Orange | Has data but missing one or both criteria |
| Pending | Gray | No members collected yet |
| In Progress | Blue | Currently being worked on |
| Blocked | Red | Cannot proceed (website down, legal issues, etc.) |

---

## Data Collection Tools

### Decision Matrix: Firecrawl vs Playwright

| Scenario | Tool | Reason |
|----------|------|--------|
| **Static HTML pages** | Firecrawl | Faster, cheaper, AI-powered extraction |
| **Paginated lists (static)** | Firecrawl | Can follow pagination links |
| **JavaScript-rendered content** | Playwright | Handles dynamic DOM |
| **Infinite scroll** | Playwright | Requires scroll simulation |
| **Login-protected content** | Playwright | Can manage sessions |
| **Interactive filters** | Playwright | Requires user interaction simulation |
| **PDF/Document extraction** | Firecrawl | Built-in document parsing |
| **Rate-limited sites** | Playwright | Better control over timing |
| **Large batch scraping** | Firecrawl | More cost-effective at scale |

### Firecrawl Usage

**Best for:**
- Chamber websites with public member directories
- Static HTML with clear structure
- Sites that expose member data in page source

**Configuration:**
```typescript
import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY 
});

// For structured extraction
const result = await firecrawl.scrapeUrl(url, {
  formats: ["extract"],
  extract: {
    schema: {
      members: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            businessType: { type: "string" },
            address: { type: "string" },
            phone: { type: "string" },
            website: { type: "string" },
            email: { type: "string" }
          }
        }
      }
    }
  }
});
```

**Cost Considerations:**
- Firecrawl charges per page scraped
- Use pagination detection to estimate total pages
- Consider crawl mode for multi-page directories

### Playwright Usage

**Best for:**
- Modern React/Vue/Angular member portals
- Interactive search/filter interfaces
- Directories requiring scroll-to-load

**Configuration:**
```typescript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Wait for dynamic content
await page.goto(url);
await page.waitForSelector('.member-card');

// Handle infinite scroll
let previousHeight = 0;
while (true) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const newHeight = await page.evaluate(() => document.body.scrollHeight);
  if (newHeight === previousHeight) break;
  previousHeight = newHeight;
}

// Extract data
const members = await page.$$eval('.member-card', cards => 
  cards.map(card => ({
    name: card.querySelector('.name')?.textContent,
    // ... other fields
  }))
);
```

**Best Practices:**
- Always set realistic timeouts
- Use headless mode for production
- Implement retry logic for flaky pages
- Respect robots.txt and rate limits

---

## Member Count Methodology

### Expected Members (Cyan)

**Definition:** Official member count from authoritative sources.

**Sources (in priority order):**
1. Chamber website homepage ("Serving X members")
2. About/FAQ pages with membership statistics
3. Annual reports (most recent year)
4. Press releases or news articles
5. Directory page count indicators ("Showing 1-20 of 450")

**How to Find:**
1. Visit chamber website
2. Check homepage for membership badges/counters
3. Navigate to "About Us" or "Membership" pages
4. Search page for keywords: "members", "businesses", "serving"
5. Check footer for statistics

**Recording:**
- Enter the exact number found
- Note the source in documentation
- Update when newer data becomes available

**Minimum Threshold:** Only record if >= 40 members (smaller counts may be outdated)

### Estimated Members (Orange)

**Definition:** Calculated estimate when Expected is unavailable.

**Calculation Methods:**

#### Method 1: Actual-Based (Preferred)
```
Estimated = Actual × 1.2 (rounded to nearest 10)
Minimum: 40
```

Example: If we've collected 83 members → Estimated = 100

#### Method 2: Region Tier Default (When no members collected yet)

| Region Type | Default | Examples |
|-------------|---------|----------|
| Metro | 400 | Metro Vancouver, Capital Regional District |
| Regional City | 250 | Central Okanagan, Thompson-Nicola, Fraser Valley, Nanaimo |
| Major Town | 200 | Regions with "Greater" or "Okanagan", "Kootenay" |
| Small Town | 120 | All other regions |

### Manual Override System

Administrators can manually set Expected or Estimated values:

1. Go to Admin > Chambers > Progress tab
2. Click on any Expected or Estimated number
3. Enter new value and press Enter
4. Status automatically recalculates

**When to Override:**
- Found official count on chamber website
- Received direct communication from chamber
- Previous estimate was clearly wrong
- Chamber merged/split with another

**Override Storage:**
- Stored in `chamber_overrides` database table
- Persists across data refreshes
- Applied before status calculation

---

## NAICS Code Assignment

### North American Industry Classification System

Every member MUST have a NAICS code assigned for proper categorization and analysis.

### Assignment Process

1. **Automatic Detection:**
   - Parse business name for industry keywords
   - Check business type/category from source
   - Match against NAICS keyword database

2. **Manual Assignment:**
   - Admin > NAICS tab for bulk management
   - Review unassigned members
   - Assign based on primary business activity

### NAICS Code Structure

```
XX       - Sector (2-digit)
XXX      - Subsector (3-digit)
XXXX     - Industry Group (4-digit)
XXXXX    - NAICS Industry (5-digit)
XXXXXX   - National Industry (6-digit)
```

### Common BC Chamber NAICS Codes

| Code | Description | Common Examples |
|------|-------------|-----------------|
| 44-45 | Retail Trade | Shops, boutiques, dealerships |
| 72 | Accommodation & Food | Hotels, restaurants, cafes |
| 54 | Professional Services | Law, accounting, consulting |
| 23 | Construction | Contractors, builders |
| 62 | Health Care | Clinics, dentists, therapists |
| 81 | Other Services | Salons, repair shops |
| 52 | Finance & Insurance | Banks, credit unions, brokers |
| 53 | Real Estate | Realtors, property managers |

### Keyword Matching Examples

```typescript
const naicsKeywords: Record<string, string> = {
  "restaurant": "722511",
  "cafe": "722515",
  "hotel": "721110",
  "motel": "721110",
  "law": "541110",
  "legal": "541110",
  "accounting": "541211",
  "dental": "621210",
  "construction": "236220",
  // ... extensive mapping
};
```

### NAICS Coverage Goal

Target: **100% NAICS coverage** for all members

Dashboard tracks:
- Total members per chamber
- Members with NAICS assigned
- Coverage percentage

---

## Member Date Tracking

### NEW REQUIREMENT

Every member record MUST include a `dateAdded` field.

### Purpose
- Enable accurate timeline charting
- Track collection velocity
- Identify data freshness
- Support historical analysis

### Implementation

**Schema Addition:**
```typescript
// In shared/schema.ts or shared/chamber-members.ts
interface ChamberMember {
  id: string;
  chamberId: string;
  name: string;
  // ... other fields
  dateAdded: string;  // ISO 8601 format: "2025-12-29"
}
```

### Date Assignment Rules

| Scenario | Date Value |
|----------|------------|
| New member scraped | Current date |
| Historical import | Best estimate or import date |
| Member updated | Original dateAdded preserved |
| Manual entry | Current date |

### Charting Uses

1. **Cumulative Growth Chart:**
   - X-axis: Date
   - Y-axis: Total members
   - Shows collection progress over time

2. **Daily Collection Rate:**
   - Members added per day
   - Identify productive collection sessions

3. **Chamber Comparison:**
   - Progress timeline per chamber
   - Identify stalled collections

---

## Data Storage Architecture

### Database Tables

```
chamber_overrides
├── chamberId (PK)
├── expectedMembers (nullable)
├── estimatedMembers (nullable)
└── updatedAt

snapshots
├── id (PK)
├── location
├── data (JSONB)
└── createdAt

(Future: member_tracking)
├── id (PK)
├── memberId
├── chamberId
├── dateAdded
├── dateUpdated
└── status
```

### Static Data Files

Location: `shared/`

| File | Purpose |
|------|---------|
| `chambers-of-commerce.ts` | Chamber definitions, contact info, GPS |
| `chamber-members.ts` | All collected member records |
| `chamber-progress.ts` | Progress calculation logic |

### Data Flow

```
Collection (Firecrawl/Playwright)
        ↓
Extraction & Parsing
        ↓
NAICS Assignment
        ↓
Date Tagging
        ↓
Storage (chamber-members.ts or DB)
        ↓
Progress Calculation
        ↓
Dashboard Display
```

---

## Workflow Checklist

### Per-Chamber Collection Workflow

- [ ] **Research Phase**
  - [ ] Visit chamber website
  - [ ] Locate member directory
  - [ ] Check for Expected member count
  - [ ] Determine collection tool (Firecrawl vs Playwright)
  
- [ ] **Collection Phase**
  - [ ] Configure scraping parameters
  - [ ] Run collection script
  - [ ] Verify extracted data quality
  - [ ] Handle pagination/infinite scroll
  
- [ ] **Processing Phase**
  - [ ] Deduplicate entries
  - [ ] Assign NAICS codes
  - [ ] Add dateAdded to all records
  - [ ] Validate required fields
  
- [ ] **Storage Phase**
  - [ ] Merge with existing data
  - [ ] Update chamber-members.ts
  - [ ] Verify in dashboard
  
- [ ] **Completion Phase**
  - [ ] Check completion criteria met
  - [ ] Update Expected/Estimated if needed
  - [ ] Mark chamber as completed

### Quality Assurance

- [ ] All members have NAICS codes
- [ ] All members have dateAdded
- [ ] No duplicate entries
- [ ] Contact info validated where possible
- [ ] Business names properly formatted

---

## Appendix

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Website blocks scraping | Use Playwright with delays, consider manual collection |
| Directory behind login | Contact chamber for data export |
| Mixed data quality | Prioritize name and category, clean address later |
| Stale data detected | Re-scrape, compare with previous, flag for review |
| NAICS unclear | Default to most general applicable code (2-digit sector) |

### Regional Expansion Notes

**Canada Provinces (Planned Order):**
1. British Columbia (Current - 107 chambers)
2. Alberta
3. Ontario
4. Quebec (French language considerations)
5. Remaining provinces

**US States (After Canada):**
- Start with border states (Washington, Montana, etc.)
- Prioritize business-heavy states

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-29 | Initial BC documentation |

---

*This document is version-controlled and should be updated whenever collection methodology changes.*
