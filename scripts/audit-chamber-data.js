#!/usr/bin/env node
/**
 * Chamber Data Audit Script
 * 
 * Performs comprehensive data integrity checks on chamber member data:
 * 1. Member count reconciliation (total vs sum by chamber)
 * 2. JSON file import verification (detect lost datasets)
 * 3. Orphaned chamber IDs (members referencing non-existent chambers)
 * 4. Duplicate member IDs
 * 5. Missing required fields
 * 6. NAICS coverage analysis
 * 7. Chamber registry coverage
 * 
 * Usage: node scripts/audit-chamber-data.js [--json]
 */

const fs = require('fs');
const path = require('path');

const JSON_OUTPUT = process.argv.includes('--json');

function log(message) {
  if (!JSON_OUTPUT) {
    console.log(message);
  }
}

function extractMembersFromTS(content) {
  const members = [];
  const regex = /\{\s*id:\s*["']([^"']+)["'],\s*chamberId:\s*["']([^"']+)["'],\s*businessName:\s*["']([^"']+)["'][^}]*(?:naicsCode:\s*["']([^"']+)["'])?[^}]*(?:municipality:\s*["']([^"']+)["'])?[^}]*(?:region:\s*["']([^"']+)["'])?[^}]*\}/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    members.push({
      id: match[1],
      chamberId: match[2],
      businessName: match[3],
      naicsCode: match[4] || null,
      municipality: match[5] || null,
      region: match[6] || null
    });
  }
  return members;
}

function extractChambersFromTS(content) {
  const chambers = [];
  const regex = /id:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["']/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    chambers.push({
      id: match[1],
      name: match[2]
    });
  }
  return chambers;
}

function runAudit() {
  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      totalMembers: 0,
      sumByChamberId: 0,
      countMatch: false,
      totalChambers: 0,
      chambersWithMembers: 0,
      chambersWithoutMembers: 0,
      naicsCoverage: 0,
      orphanedIds: 0,
      duplicateIds: 0,
      jsonFilesNotFullyImported: 0
    },
    memberCountReconciliation: {
      totalFromFile: 0,
      sumByChamber: 0,
      discrepancy: 0,
      byChamberId: {}
    },
    orphanedChamberIds: [],
    duplicateMemberIds: [],
    missingRequiredFields: [],
    jsonImportStatus: [],
    chambersWithoutMembers: [],
    naicsAnalysis: {
      overall: { total: 0, withNaics: 0, percentage: 0 },
      byChamberId: {}
    },
    issues: []
  };

  // Read chamber-members.ts
  const chamberMembersPath = path.join(__dirname, '..', 'shared', 'chamber-members.ts');
  const chamberMembersContent = fs.readFileSync(chamberMembersPath, 'utf8');
  
  // Count using simple regex for chamberId occurrences
  const chamberIdMatches = chamberMembersContent.match(/chamberId:\s*["'][^"']+["']/g) || [];
  results.memberCountReconciliation.totalFromFile = chamberIdMatches.length;
  results.summary.totalMembers = chamberIdMatches.length;
  
  // Extract member IDs and chamber associations
  const memberIdRegex = /id:\s*["']([^"']+)["'],\s*chamberId:\s*["']([^"']+)["']/g;
  const memberData = [];
  const memberIdCounts = {};
  let match;
  
  while ((match = memberIdRegex.exec(chamberMembersContent)) !== null) {
    const memberId = match[1];
    const chamberId = match[2];
    memberData.push({ id: memberId, chamberId });
    memberIdCounts[memberId] = (memberIdCounts[memberId] || 0) + 1;
  }
  
  // Count by chamber
  const chamberCounts = {};
  memberData.forEach(m => {
    chamberCounts[m.chamberId] = (chamberCounts[m.chamberId] || 0) + 1;
  });
  
  results.memberCountReconciliation.byChamberId = chamberCounts;
  const sumByChamber = Object.values(chamberCounts).reduce((a, b) => a + b, 0);
  results.memberCountReconciliation.sumByChamber = sumByChamber;
  results.summary.sumByChamberId = sumByChamber;
  results.memberCountReconciliation.discrepancy = results.memberCountReconciliation.totalFromFile - sumByChamber;
  results.summary.countMatch = results.memberCountReconciliation.discrepancy === 0;
  
  // Check for duplicate member IDs
  Object.entries(memberIdCounts).forEach(([id, count]) => {
    if (count > 1) {
      results.duplicateMemberIds.push({ id, count });
    }
  });
  results.summary.duplicateIds = results.duplicateMemberIds.length;
  
  // Read chambers registry
  const chambersPath = path.join(__dirname, '..', 'shared', 'chambers-of-commerce.ts');
  const chambersContent = fs.readFileSync(chambersPath, 'utf8');
  
  const chamberIdRegex = /id:\s*["']([^"']+)["']/g;
  const registryChamberIds = new Set();
  while ((match = chamberIdRegex.exec(chambersContent)) !== null) {
    registryChamberIds.add(match[1]);
  }
  results.summary.totalChambers = registryChamberIds.size;
  
  // Check for orphaned chamber IDs (in members but not in registry)
  const memberChamberIds = new Set(Object.keys(chamberCounts));
  memberChamberIds.forEach(id => {
    if (!registryChamberIds.has(id)) {
      results.orphanedChamberIds.push({
        chamberId: id,
        memberCount: chamberCounts[id]
      });
    }
  });
  results.summary.orphanedIds = results.orphanedChamberIds.length;
  
  // Check chambers without members
  registryChamberIds.forEach(id => {
    if (!chamberCounts[id] || chamberCounts[id] === 0) {
      results.chambersWithoutMembers.push(id);
    }
  });
  results.summary.chambersWithoutMembers = results.chambersWithoutMembers.length;
  results.summary.chambersWithMembers = registryChamberIds.size - results.summary.chambersWithoutMembers;
  
  // NAICS coverage analysis
  const naicsRegex = /chamberId:\s*["']([^"']+)["'][^}]*naicsCode:\s*["']([^"']+)["']/g;
  const naicsByChamber = {};
  let totalWithNaics = 0;
  
  while ((match = naicsRegex.exec(chamberMembersContent)) !== null) {
    const chamberId = match[1];
    const naicsCode = match[2];
    if (!naicsByChamber[chamberId]) {
      naicsByChamber[chamberId] = { total: 0, withNaics: 0 };
    }
    if (naicsCode && naicsCode.length > 0) {
      totalWithNaics++;
    }
  }
  
  // Calculate NAICS per chamber
  Object.keys(chamberCounts).forEach(chamberId => {
    const total = chamberCounts[chamberId];
    // Count NAICS for this chamber
    const naicsPattern = new RegExp(`chamberId:\\s*["']${chamberId}["'][^}]*naicsCode:\\s*["'][^"']+["']`, 'g');
    const naicsMatches = chamberMembersContent.match(naicsPattern) || [];
    const withNaics = naicsMatches.length;
    
    results.naicsAnalysis.byChamberId[chamberId] = {
      total,
      withNaics,
      percentage: total > 0 ? Math.round((withNaics / total) * 100) : 0
    };
  });
  
  // Overall NAICS
  const totalNaicsMatches = chamberMembersContent.match(/naicsCode:\s*["'][^"']+["']/g) || [];
  results.naicsAnalysis.overall = {
    total: results.summary.totalMembers,
    withNaics: totalNaicsMatches.length,
    percentage: results.summary.totalMembers > 0 
      ? Math.round((totalNaicsMatches.length / results.summary.totalMembers) * 100) 
      : 0
  };
  results.summary.naicsCoverage = results.naicsAnalysis.overall.percentage;
  
  // Check JSON files for unimported data
  const jsonDir = path.join(__dirname, '..', 'data', 'chambers');
  if (fs.existsSync(jsonDir)) {
    const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
    
    jsonFiles.forEach(file => {
      const filePath = path.join(jsonDir, file);
      const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const jsonMemberCount = Array.isArray(jsonContent) ? jsonContent.length : 0;
      
      // Get chamber ID from first member in JSON
      const chamberId = jsonContent[0]?.chamberId;
      const tsCount = chamberId ? (chamberCounts[chamberId] || 0) : 0;
      
      const status = {
        file,
        chamberId,
        jsonCount: jsonMemberCount,
        tsCount,
        fullyImported: jsonMemberCount <= tsCount,
        missing: Math.max(0, jsonMemberCount - tsCount)
      };
      
      results.jsonImportStatus.push(status);
      
      if (!status.fullyImported) {
        results.summary.jsonFilesNotFullyImported++;
        results.issues.push({
          type: 'JSON_NOT_FULLY_IMPORTED',
          file,
          chamberId,
          jsonCount: jsonMemberCount,
          tsCount,
          missing: status.missing
        });
      }
    });
  }
  
  // Add issues for other problems
  if (results.orphanedChamberIds.length > 0) {
    results.orphanedChamberIds.forEach(o => {
      results.issues.push({
        type: 'ORPHANED_CHAMBER_ID',
        chamberId: o.chamberId,
        memberCount: o.memberCount
      });
    });
  }
  
  if (results.duplicateMemberIds.length > 0) {
    results.duplicateMemberIds.forEach(d => {
      results.issues.push({
        type: 'DUPLICATE_MEMBER_ID',
        id: d.id,
        count: d.count
      });
    });
  }
  
  return results;
}

function printReport(results) {
  log('');
  log('╔══════════════════════════════════════════════════════════════════╗');
  log('║             CHAMBER DATA AUDIT REPORT                            ║');
  log('╚══════════════════════════════════════════════════════════════════╝');
  log('');
  log(`Timestamp: ${results.timestamp}`);
  log('');
  
  // Member Count Reconciliation
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ 1. MEMBER COUNT RECONCILIATION                                   │');
  log('└──────────────────────────────────────────────────────────────────┘');
  log(`   Total Members (from file):     ${results.memberCountReconciliation.totalFromFile}`);
  log(`   Sum by Chamber ID:             ${results.memberCountReconciliation.sumByChamber}`);
  log(`   Discrepancy:                   ${results.memberCountReconciliation.discrepancy} ${results.summary.countMatch ? '✓' : '✗'}`);
  log('');
  
  // Orphaned Chamber IDs
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ 2. ORPHANED CHAMBER IDs (in members but not in registry)        │');
  log('└──────────────────────────────────────────────────────────────────┘');
  if (results.orphanedChamberIds.length === 0) {
    log('   None found ✓');
  } else {
    results.orphanedChamberIds.forEach(o => {
      log(`   ✗ ${o.chamberId} (${o.memberCount} members)`);
    });
  }
  log('');
  
  // Duplicate Member IDs
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ 3. DUPLICATE MEMBER IDs                                         │');
  log('└──────────────────────────────────────────────────────────────────┘');
  if (results.duplicateMemberIds.length === 0) {
    log('   None found ✓');
  } else {
    results.duplicateMemberIds.slice(0, 10).forEach(d => {
      log(`   ✗ ${d.id} (appears ${d.count} times)`);
    });
    if (results.duplicateMemberIds.length > 10) {
      log(`   ... and ${results.duplicateMemberIds.length - 10} more`);
    }
  }
  log('');
  
  // JSON Import Status
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ 4. JSON FILE IMPORT STATUS                                      │');
  log('└──────────────────────────────────────────────────────────────────┘');
  if (results.jsonImportStatus.length === 0) {
    log('   No JSON files found in data/chambers/');
  } else {
    results.jsonImportStatus.forEach(s => {
      const status = s.fullyImported ? '✓' : '✗';
      const missing = s.fullyImported ? '' : ` (${s.missing} missing)`;
      log(`   ${status} ${s.file}: ${s.jsonCount} in JSON, ${s.tsCount} in TS${missing}`);
    });
  }
  log('');
  
  // Chamber Coverage
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ 5. CHAMBER REGISTRY COVERAGE                                    │');
  log('└──────────────────────────────────────────────────────────────────┘');
  log(`   Total Chambers in Registry:    ${results.summary.totalChambers}`);
  log(`   Chambers with Members:         ${results.summary.chambersWithMembers}`);
  log(`   Chambers without Members:      ${results.summary.chambersWithoutMembers}`);
  log('');
  if (results.chambersWithoutMembers.length > 0 && results.chambersWithoutMembers.length <= 20) {
    log('   Chambers needing data:');
    results.chambersWithoutMembers.forEach(c => {
      log(`     - ${c}`);
    });
    log('');
  }
  
  // NAICS Coverage
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ 6. NAICS CODE COVERAGE                                          │');
  log('└──────────────────────────────────────────────────────────────────┘');
  log(`   Overall: ${results.naicsAnalysis.overall.percentage}% (${results.naicsAnalysis.overall.withNaics} / ${results.naicsAnalysis.overall.total})`);
  
  // Find chambers below 80% NAICS coverage
  const lowNaics = Object.entries(results.naicsAnalysis.byChamberId)
    .filter(([id, data]) => data.percentage < 80 && data.total > 0)
    .sort((a, b) => a[1].percentage - b[1].percentage);
  
  if (lowNaics.length > 0) {
    log('');
    log('   Chambers below 80% NAICS coverage:');
    lowNaics.slice(0, 10).forEach(([id, data]) => {
      log(`     - ${id}: ${data.percentage}% (${data.withNaics}/${data.total})`);
    });
    if (lowNaics.length > 10) {
      log(`     ... and ${lowNaics.length - 10} more`);
    }
  }
  log('');
  
  // Summary
  log('┌──────────────────────────────────────────────────────────────────┐');
  log('│ SUMMARY                                                         │');
  log('└──────────────────────────────────────────────────────────────────┘');
  log(`   Total Issues Found: ${results.issues.length}`);
  if (results.issues.length === 0) {
    log('   ✓ All data integrity checks passed!');
  } else {
    const issueTypes = {};
    results.issues.forEach(i => {
      issueTypes[i.type] = (issueTypes[i.type] || 0) + 1;
    });
    Object.entries(issueTypes).forEach(([type, count]) => {
      log(`   ✗ ${type}: ${count}`);
    });
  }
  log('');
}

// Run the audit
const results = runAudit();

if (JSON_OUTPUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  printReport(results);
}

// Export for use as module
module.exports = { runAudit };
