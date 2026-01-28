/**
 * PROMPT-17B Regression Test: Forbidden Auth-Only Routes
 * 
 * This test enforces that operator and contractor route files cannot regress
 * back to auth-only patterns. Every non-public route handler MUST include
 * an explicit capability check.
 * 
 * Constitutional Reference: AUTH_CONSTITUTION.md §3 (Capability-First Authorization)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TARGET_FILES = [
  'server/routes/operator.ts',
  'server/routes/contractor-geo.ts',
  'server/routes/contractor-ingestions.ts',
];

const CAPABILITY_PATTERNS = [
  /await\s+can\s*\(\s*req/,
  /requireCapability\s*\(/,
  /authorize\s*\(\s*req/,
];

const PUBLIC_ROUTE_PATTERNS = [
  /async\s*\(\s*_req\s*[,:]/,
  /\/test\//,
  /\/test'/,
];

function isPublicRoute(routeLine: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(routeLine));
}

function hasCapabilityCheck(content: string, startLine: number): boolean {
  const lines = content.split('\n');
  const handlerBody = [];
  let braceCount = 0;
  let started = false;
  
  for (let i = startLine; i < Math.min(startLine + 20, lines.length); i++) {
    const line = lines[i];
    
    if (line.includes('{')) {
      braceCount += (line.match(/\{/g) || []).length;
      started = true;
    }
    if (line.includes('}')) {
      braceCount -= (line.match(/\}/g) || []).length;
    }
    
    if (started) {
      handlerBody.push(line);
      if (braceCount <= 0) break;
    }
  }
  
  const handlerText = handlerBody.join('\n');
  return CAPABILITY_PATTERNS.some(pattern => pattern.test(handlerText));
}

describe('PROMPT-17B: Forbidden Auth-Only Routes', () => {
  TARGET_FILES.forEach(filePath => {
    describe(`File: ${filePath}`, () => {
      it('should have router-level authenticateToken or per-route capability gates', () => {
        const fullPath = path.resolve(process.cwd(), filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
        
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        const hasRouterLevelAuth = /router\.use\s*\(\s*authenticateToken\s*\)/.test(content);
        expect(hasRouterLevelAuth).toBe(true);
      });

      it('should have denyCapability helper defined', () => {
        const fullPath = path.resolve(process.cwd(), filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        const hasDenyHelper = /function\s+denyCapability\s*\(/.test(content);
        expect(hasDenyHelper).toBe(true);
      });

      it('should have capability gates on all non-public routes', () => {
        const fullPath = path.resolve(process.cwd(), filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`]+['"`]/;
        const routesWithoutCapability: string[] = [];
        
        lines.forEach((line, index) => {
          if (routePattern.test(line)) {
            if (isPublicRoute(line)) {
              return;
            }
            
            if (!hasCapabilityCheck(content, index)) {
              routesWithoutCapability.push(`Line ${index + 1}: ${line.trim()}`);
            }
          }
        });
        
        if (routesWithoutCapability.length > 0) {
          console.error(`\nRoutes missing capability checks in ${filePath}:`);
          routesWithoutCapability.forEach(r => console.error(`  - ${r}`));
        }
        
        expect(routesWithoutCapability).toHaveLength(0);
      });
    });
  });

  it('should import can from auth/authorize in all target files', () => {
    TARGET_FILES.forEach(filePath => {
      const fullPath = path.resolve(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      const hasCanImport = /import\s*\{[^}]*can[^}]*\}\s*from\s*['"]\.\.\/auth\/authorize['"]/.test(content);
      expect(hasCanImport).toBe(true);
    });
  });

  it('should use canonical 403 response shape (AUTH_CONSTITUTION §8a)', () => {
    TARGET_FILES.forEach(filePath => {
      const fullPath = path.resolve(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      const has403Shape = content.includes("error: 'Forbidden'") &&
                          content.includes("code: 'NOT_AUTHORIZED'") &&
                          content.includes("reason: 'capability_not_granted'");
      
      expect(has403Shape).toBe(true);
    });
  });
});
