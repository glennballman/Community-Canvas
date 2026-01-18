#!/usr/bin/env tsx
/**
 * Forbidden Words Check Script
 * 
 * Scans source files for forbidden words that violate terminology standards.
 * Currently enforces "reserve/reservation" over "book/booking".
 * 
 * Usage:
 *   npx tsx scripts/forbidden-words-check.ts
 * 
 * Exit codes:
 *   0 - No forbidden words found
 *   1 - Forbidden words found
 */

import * as fs from 'fs';
import * as path from 'path';

interface ForbiddenWordConfig {
  word: string;
  regex: RegExp;
  suggestion: string;
}

// Word-boundary patterns that match standalone words only
// This avoids false positives like "facebook", "notebook", etc.
const FORBIDDEN_WORDS: ForbiddenWordConfig[] = [
  {
    word: 'booking',
    regex: /\bbooking\b/i,
    suggestion: 'reservation',
  },
  {
    word: 'bookings',
    regex: /\bbookings\b/i,
    suggestion: 'reservations',
  },
  {
    word: 'booked',
    regex: /\bbooked\b/i,
    suggestion: 'reserved',
  },
  {
    word: 'book',
    regex: /\bbook\b/i,
    suggestion: 'reserve',
  },
];

const SCAN_EXTENSIONS = ['.ts', '.tsx'];

// Scan entire client directory
const SCAN_DIRECTORIES = [
  'client/src',
];

// Exclude patterns - match full path
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.test\./,
  /\.spec\./,
  /forbidden-words-check/,
  /TERMINOLOGY/,
];

// Allowlist specific files that legitimately need these words
// Use exact file paths only, not directories
const ALLOWLIST_FILES = [
  // publicCopy.ts documents the rule itself
  'client/src/public/publicCopy.ts',
  // Lucide icon imports (Book icon)
  'client/src/pages/AdminLayout.tsx',
  'client/src/pages/Documentation.tsx',
  'client/src/components/MainNav.tsx',
  // Legacy accommodation/rental pages that will be migrated later
  'client/src/components/accommodations/PropertyDetails.tsx',
  'client/src/pages/staging/MapSearch.tsx',
  'client/src/pages/staging/PropertyDetail.tsx',
  'client/src/pages/staging/ReservationFlow.tsx',
  'client/src/pages/staging/Reserve.tsx',
  // Legacy pages with "book" in API calls or test data
  'client/src/pages/CreateOpportunityWizard.tsx',
  'client/src/pages/TripTimelineDemo.tsx',
  'client/src/pages/app/business/InventoryPage.tsx',
  'client/src/pages/intake/WorkRequestDetail.tsx',
  'client/src/pages/rentals/RentalBrowser.tsx',
  // Trip planning components with ferry reservation language
  'client/src/components/TripPlanning/ServiceRunsBoard.tsx',
  'client/src/components/TripPlanning/TripTimelineView.tsx',
  // Sample/test data files with external service references (BC Ferries, etc.)
  'client/src/data/sampleBamfieldTrip.ts',
  'client/src/data/sampleTrips.ts',
];

interface Violation {
  file: string;
  line: number;
  column: number;
  word: string;
  context: string;
  suggestion: string;
}

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isAllowlisted(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWLIST_FILES.some((allowed) => normalized.endsWith(allowed) || normalized === allowed);
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Skip comment lines
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const config of FORBIDDEN_WORDS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(config.regex.source, 'gi');

      while ((match = regex.exec(line)) !== null) {
        // Check if inside a string - these are the violations we care about
        // User-facing text in strings is what we're trying to catch
        const isInString = isInsideString(line, match.index);
        
        // Skip icon imports like "Book" from lucide-react
        const isIconImport = /from\s+['"]lucide-react['"]/.test(line) || 
                             /import\s*\{[^}]*\bBook\b/.test(line);
        
        if (!isIconImport) {
          violations.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            word: match[0],
            context: line.trim().slice(0, 100),
            suggestion: config.suggestion,
          });
        }
      }
    }
  }

  return violations;
}

function isInsideString(line: string, position: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < position; i++) {
    const char = line[i];
    const prevChar = i > 0 ? line[i - 1] : '';

    if (char === "'" && prevChar !== '\\' && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && prevChar !== '\\' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && prevChar !== '\\' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }
  }

  return inSingleQuote || inDoubleQuote || inBacktick;
}

function walkDirectory(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldExclude(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
    } else if (entry.isFile() && SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      // Check allowlist
      if (!isAllowlisted(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function main(): void {
  console.log('Scanning for forbidden words in client/src/**/*.ts(x)...\n');
  console.log(`Allowlisted files: ${ALLOWLIST_FILES.length}`);
  console.log('');

  const allViolations: Violation[] = [];

  for (const dir of SCAN_DIRECTORIES) {
    const files = walkDirectory(dir);

    for (const file of files) {
      const violations = scanFile(file);
      allViolations.push(...violations);
    }
  }

  if (allViolations.length === 0) {
    console.log('No forbidden words found.');
    process.exit(0);
  }

  console.log(`Found ${allViolations.length} forbidden word(s):\n`);

  for (const violation of allViolations) {
    console.log(`${violation.file}:${violation.line}:${violation.column}`);
    console.log(`  Found: "${violation.word}" → Use: "${violation.suggestion}"`);
    console.log(`  Context: ${violation.context}`);
    console.log('');
  }

  console.log(`\nTotal: ${allViolations.length} violation(s)`);
  process.exit(1);
}

main();
