#!/usr/bin/env tsx
/**
 * V3.5 Copy Lint Script
 * 
 * Scans codebase for forbidden industry-specific terms that should be
 * replaced with copy tokens. Enforces terminology standards.
 * 
 * Usage: npx tsx scripts/copy-lint.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface LintViolation {
  file: string;
  line: number;
  column: number;
  term: string;
  snippet: string;
}

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bcontractor\b/gi, name: 'contractor' },
  { pattern: /\bbooking\b/gi, name: 'booking' },
  { pattern: /\bbooked\b/gi, name: 'booked' },
  { pattern: /\bbookings\b/gi, name: 'bookings' },
];

const SCAN_DIRECTORIES = [
  'client/src',
  'server',
];

const EXCLUSION_PATTERNS = [
  /node_modules/,
  /dist\//,
  /build\//,
  /\.next\//,
  /generated/,
  /migrations/,
  /vendor/,
  /_deprecated/,
  /\.d\.ts$/,
];

const ALLOWLISTED_FILES = [
  /\.md$/,
  /copy-lint\.ts$/,
  /TERMINOLOGY/i,
  /entryPointCopy\.ts$/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
];

const FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
];

const CONTEXT_ALLOWLIST: Array<{ file: RegExp; patterns: RegExp[] }> = [
  {
    file: /contractor\//,
    patterns: [
      /ContractorCalendarPage/,
      /contractor-calendar/,
      /ContractorOnboarding/,
      /ContractorIngestion/,
      /badge_label_contractor/,
      /assigned_contractor_person_id/,
      /contractor_id/,
      /contractor\/\w+Page/,
    ],
  },
  {
    file: /routes\/calendar\.ts$/,
    patterns: [/mode.*contractor/, /contractor.*mode/],
  },
  {
    file: /OpsCalendarBoardPage\.tsx$/,
    patterns: [/mode.*contractor/, /contractor.*calendar/, /"contractor"/],
  },
  {
    file: /App\.tsx$/,
    patterns: [/contractor/, /Contractor/],
  },
  {
    file: /ZoneBadge\.tsx$/,
    patterns: [/badge_label_contractor/],
  },
  {
    file: /schema\.ts$/,
    patterns: [/badge_label_contractor/, /assigned_contractor/],
  },
  {
    file: /ContractorAssignmentPicker/,
    patterns: [/[Cc]ontractor/],
  },
  {
    file: /WorkDisclosureSelector/,
    patterns: [/[Cc]ontractor/],
  },
];

function isExcluded(filePath: string): boolean {
  return EXCLUSION_PATTERNS.some(pattern => pattern.test(filePath));
}

function isAllowlisted(filePath: string): boolean {
  return ALLOWLISTED_FILES.some(pattern => pattern.test(filePath));
}

function isValidExtension(filePath: string): boolean {
  return FILE_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

function isContextAllowlisted(filePath: string, line: string): boolean {
  for (const { file, patterns } of CONTEXT_ALLOWLIST) {
    if (file.test(filePath)) {
      if (patterns.some(pattern => pattern.test(line))) {
        return true;
      }
    }
  }
  return false;
}

function getAllFiles(dirPath: string, filesList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return filesList;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (isExcluded(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      getAllFiles(fullPath, filesList);
    } else if (isValidExtension(fullPath) && !isAllowlisted(fullPath)) {
      filesList.push(fullPath);
    }
  }

  return filesList;
}

function scanFile(filePath: string): LintViolation[] {
  const violations: LintViolation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }
    
    if (isContextAllowlisted(filePath, line)) {
      continue;
    }

    for (const { pattern, name } of FORBIDDEN_PATTERNS) {
      const matches = line.matchAll(new RegExp(pattern));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          violations.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            term: name,
            snippet: line.trim().substring(0, 100),
          });
        }
      }
    }
  }

  return violations;
}

function main() {
  console.log('V3.5 Copy Lint - Scanning for forbidden terms...\n');

  const allFiles: string[] = [];
  
  for (const dir of SCAN_DIRECTORIES) {
    getAllFiles(dir, allFiles);
  }

  console.log(`Scanning ${allFiles.length} files...\n`);

  const allViolations: LintViolation[] = [];

  for (const file of allFiles) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log('No forbidden terms found. Copy lint passed.\n');
    process.exit(0);
  }

  console.log(`Found ${allViolations.length} violation(s):\n`);

  const byFile = new Map<string, LintViolation[]>();
  for (const v of allViolations) {
    const existing = byFile.get(v.file) || [];
    existing.push(v);
    byFile.set(v.file, existing);
  }

  for (const [file, violations] of byFile) {
    console.log(`\n${file}:`);
    for (const v of violations) {
      console.log(`  Line ${v.line}:${v.column} - Forbidden term "${v.term}"`);
      console.log(`    ${v.snippet}`);
    }
  }

  console.log(`\n\nTotal: ${allViolations.length} violation(s) found.`);
  console.log('Please replace forbidden terms with copy tokens from client/src/copy/');
  process.exit(1);
}

main();
