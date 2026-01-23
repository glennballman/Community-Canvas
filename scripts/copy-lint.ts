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

const GLOBAL_LINE_ALLOWLIST: RegExp[] = [
  /\/api\/contractor/,
  /\/app\/contractor/,
  /\/preview\/contractor/,
  /assigned_contractor_person_id/,
  /badge_label_contractor/,
  /contractor_id/,
  /contractorId/,
  /ContractorAssignment/,
  /ContractorIngestion/,
  /ContractorOnboarding/,
  /ContractorWorkRequest/,
  /ContractorCalendar/,
  /Contractor\w+Page/,
  /import.*[Cc]ontractor/,
  /export.*[Cc]ontractor/,
  /interface.*[Cc]ontractor/,
  /type.*[Cc]ontractor/,
  /'contractor'/,
  /"contractor"/,
  /mode.*=.*'contractor'/,
  /mode.*=.*"contractor"/,
  /=== 'contractor'/,
  /=== "contractor"/,
  /!== 'contractor'/,
  /!== "contractor"/,
  /Booking\.com/,
  /booking\.com/i,
  /Contractor Name/,
  /Contractor Email/,
  /Contractor Phone/,
  /Contractor View/,
  /Work\/Contractor/,
  /Ellen.*Contractor/,
  /Contractor.*reliability/,
  /Contractor.*rate/,
  /contractor.*travel/,
  /contract.*CONTRACTOR/,
  /contractor.*schedule/,
  /contractor.*absorbed/,
  /contractor.*approved/,
  /trust.*contractor/i,
  /contractor.*trust/i,
  /contractor\?/,
  /placeholder.*[Cc]ontractor/,
  /VALUES.*[Cc]ontractor/,
  /data-testid.*contractor/,
  /queryKey.*contractor/,
  /contractor.*token/i,
  /accepting.*feedback/,
  /accepting.*appreciation/,
  /preview.*contractor/,
  /booked/,
  /summaryLower\.includes/,
  /blockType.*booked/,
  /console\.error.*Contractor/,
  /reason.*Contractor absorbed/,
  /reason.*Contractor approved/,
  /Contractor.*calendar.*error/i,
  /ops-calendar.*error/i,
  /`Contractor.*\${/,
];

const CONTEXT_ALLOWLIST: Array<{ file: RegExp; patterns: RegExp[] }> = [
  {
    file: /contractor/i,
    patterns: [/.*/],
  },
  {
    file: /Contractor/,
    patterns: [/.*/],
  },
  {
    file: /OpsCalendarBoardPage\.tsx$/,
    patterns: [/mode/, /contractor/],
  },
  {
    file: /App\.tsx$/,
    patterns: [/contractor/, /Contractor/, /Route/],
  },
  {
    file: /routes\/appreciations\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/bids\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/calendar\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/conversations\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/dev-login\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/feedback\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/financing\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/p2-admin\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/p2-platform\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/platform\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/profiles\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/work-requests\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/p2-work-catalog\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/payments\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/public-event\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/shared-runs\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /routes\/trust-signals\.ts$/,
    patterns: [/contractor/],
  },
  {
    file: /PortalZonesPage\.tsx$/,
    patterns: [/contractor/, /badgeLabelContractor/, /Contractor/],
  },
  {
    file: /CreateServiceRun\.tsx$/,
    patterns: [/contractor/i],
  },
  {
    file: /ServiceRunDetail\.tsx$/,
    patterns: [/contractor/i],
  },
  {
    file: /ZoneBadge\.tsx$/,
    patterns: [/badge_label_contractor/, /ViewerContext/],
  },
  {
    file: /schema\.ts$/,
    patterns: [/badge_label_contractor/, /assigned_contractor/],
  },
  {
    file: /ContractorAssignmentPicker/,
    patterns: [/.*/],
  },
  {
    file: /WorkDisclosureSelector/,
    patterns: [/[Cc]ontractor/],
  },
  {
    file: /WorkRequestDetail/,
    patterns: [/ContractorAssignment/, /assigned_contractor/, /contractorId/, /Contractor/, /contractor/],
  },
  {
    file: /PropertyDetails/,
    patterns: [/Booking\.com/],
  },
  {
    file: /n3\//,
    patterns: [/contractor/],
  },
  {
    file: /BundleSimulation/,
    patterns: [/contractor.*travel/],
  },
  {
    file: /ZoneImpactSummary/,
    patterns: [/Contractor.*rate/],
  },
  {
    file: /ZoneHeatRow/,
    patterns: [/contractor/],
  },
  {
    file: /Coordination/,
    patterns: [/contractor/],
  },
  {
    file: /conversations\//,
    patterns: [/contractor/],
  },
  {
    file: /services\//,
    patterns: [/contractor/],
  },
  {
    file: /financing\//,
    patterns: [/contractor/],
  },
  {
    file: /payments\//,
    patterns: [/contractor/],
  },
  {
    file: /feedback\//,
    patterns: [/contractor/],
  },
  {
    file: /jobs\//,
    patterns: [/contractor/],
  },
  {
    file: /dev\//,
    patterns: [/contractor/],
  },
  {
    file: /lib\/api\//,
    patterns: [/contractor/],
  },
  {
    file: /host\//,
    patterns: [/contractor/],
  },
  {
    file: /admin\//,
    patterns: [/contractor/],
  },
  {
    file: /Fleet\//,
    patterns: [/contractor/],
  },
  {
    file: /public\//,
    patterns: [/contractor/],
  },
  {
    file: /ConversationsPage/,
    patterns: [/contractor/],
  },
  {
    file: /CreateOpportunityWizard/,
    patterns: [/contractor/],
  },
  {
    file: /OnboardingResults/,
    patterns: [/contractor/],
  },
  {
    file: /sampleBamfieldTrip/,
    patterns: [/booking/],
  },
  {
    file: /publicCopy/,
    patterns: [/booking/],
  },
  {
    file: /FounderReservationsPage/,
    patterns: [/booking/],
  },
  {
    file: /TripTimelineView/,
    patterns: [/booking/],
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
  if (GLOBAL_LINE_ALLOWLIST.some(pattern => pattern.test(line))) {
    return true;
  }
  
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
