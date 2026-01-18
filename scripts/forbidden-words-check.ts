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

const FORBIDDEN_WORDS: ForbiddenWordConfig[] = [
  {
    word: 'booking',
    regex: /\b(booking|bookings)\b/gi,
    suggestion: 'reservation(s)',
  },
  {
    word: 'book',
    regex: /\b(book|books|booked)\b/gi,
    suggestion: 'reserve/reserved',
  },
];

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Only scan the public reservation directory for now
// Can be expanded to include other directories as they are migrated to new terminology
const SCAN_DIRECTORIES = [
  'client/src/public',
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.test\./,
  /\.spec\./,
  /forbidden-words-check/,
  /TERMINOLOGY/,
  /publicCopy\.ts/, // Exclude the file that documents the rule
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

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    for (const config of FORBIDDEN_WORDS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(config.regex.source, 'gi');

      while ((match = regex.exec(line)) !== null) {
        const isInComment = line.trimStart().startsWith('//') || line.trimStart().startsWith('*');
        const isInString = isInsideString(line, match.index);

        if (!isInComment || isInString) {
          violations.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            word: match[0],
            context: line.trim().slice(0, 80),
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
      files.push(fullPath);
    }
  }

  return files;
}

function main(): void {
  console.log('Scanning for forbidden words...\n');

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
